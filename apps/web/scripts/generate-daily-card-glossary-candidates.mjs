import fs from 'node:fs';
import path from 'node:path';
import { dailyCards } from '../src/data/daily-card-catalog.js';

const glossaryDir = path.resolve('src/content/glossary');
const outputDir = path.resolve('artifacts/daily-card-glossary-candidates');

const SUGGESTED_COLLECTION_BY_TERM = Object.freeze({
  benchmark: 'core-framework',
  'broad-usd': 'core-framework',
  btcusd: 'asset-transmission',
  cpi: 'rates-liquidity-policy',
  'dollar-regime': 'market-application',
  dxy: 'core-framework',
  eia: 'history-institutions',
  fed: 'history-institutions',
  'liquidity-stress': 'dollar-funding-stack',
  lng: 'asset-transmission',
  'real-rates': 'rates-liquidity-policy',
  'risk-off': 'market-application',
  tips: 'rates-liquidity-policy',
  'treasury-yields': 'rates-liquidity-policy',
  usd: 'core-framework',
  vix: 'market-application',
  wti: 'asset-transmission',
  xauusd: 'asset-transmission',
});

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return JSON.parse(trimmed);
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  return trimmed;
}

function parseFrontmatter(text, fileName) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`${fileName}: missing frontmatter`);
  const data = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf(':');
    if (separator < 1) throw new Error(`${fileName}: unsupported frontmatter line ${line}`);
    const key = line.slice(0, separator).trim();
    data[key] = unquote(line.slice(separator + 1));
  }
  return data;
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function overlapCardIds({ term, title, definition }) {
  const termTokens = new Set([
    ...normalize(term).split(' '),
    ...normalize(title).split(' '),
  ].filter((token) => token.length >= 3));
  const definitionText = normalize(definition);
  return dailyCards
    .filter((card) => {
      const haystack = normalize(`${card.slug} ${card.title} ${card.shortTitle || ''} ${(card.concepts || []).join(' ')}`);
      const shared = [...termTokens].filter((token) => haystack.includes(token));
      const exactTitle = normalize(card.title) === normalize(title) || normalize(card.shortTitle) === normalize(title);
      const definitionSignal = termTokens.size > 0 && [...termTokens].some((token) => definitionText.includes(token) && haystack.includes(token));
      return exactTitle || shared.length >= 2 || definitionSignal;
    })
    .map((card) => card.id)
    .slice(0, 8);
}

function suggestedCollection(term) {
  return SUGGESTED_COLLECTION_BY_TERM[term] || 'core-framework';
}

const files = fs.readdirSync(glossaryDir)
  .filter((name) => name.endsWith('.md'))
  .sort();

const candidates = files.map((fileName) => {
  const term = fileName.replace(/\.md$/, '');
  const sourcePath = `src/content/glossary/${fileName}`;
  const frontmatter = parseFrontmatter(fs.readFileSync(path.join(glossaryDir, fileName), 'utf8'), fileName);
  if (frontmatter.status !== 'ready-for-build') return null;
  if (!frontmatter.title || !frontmatter.definition || !frontmatter.slug) {
    throw new Error(`${fileName}: ready glossary entry must include title, definition and slug`);
  }
  const collectionId = suggestedCollection(term);
  const potentialOverlapCardIds = overlapCardIds({ term, title: frontmatter.title, definition: frontmatter.definition });
  return {
    id: `candidate-glossary-${term}`,
    slug: `glossary-${term}`,
    title: frontmatter.title,
    shortTitle: frontmatter.title,
    collectionId,
    format: 'word',
    level: ['rates-liquidity-policy', 'dollar-funding-stack', 'global-dollar-fx'].includes(collectionId) ? 'intermediate' : 'foundation',
    access: 'open',
    hook: frontmatter.definition,
    definition: frontmatter.definition,
    whyItMatters: '',
    example: '',
    commonMistake: '',
    whatToWatch: [],
    keyTakeaway: '',
    assets: [],
    concepts: [frontmatter.title],
    relatedCardIds: [],
    sourceNames: ['USD Impact Glossary'],
    sourcePath,
    sourceSlug: frontmatter.slug,
    potentialOverlapCardIds,
    reviewDisposition: potentialOverlapCardIds.length > 0 ? 'resolve-overlap' : 'likely-net-new',
    status: 'review',
    lastReviewed: null,
    productionNote: 'Auto-derived from a ready-for-build USD Impact glossary entry. Resolve overlap, complete editorial fields, verify authoritative external sources where required, and explicitly review before promotion.',
  };
}).filter(Boolean);

const likelyNetNew = candidates.filter((candidate) => candidate.reviewDisposition === 'likely-net-new');
const overlaps = candidates.filter((candidate) => candidate.reviewDisposition === 'resolve-overlap');
const generatedAt = new Date().toISOString();

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  path.join(outputDir, 'candidates.json'),
  `${JSON.stringify({ generatedAt, count: candidates.length, likelyNetNewCount: likelyNetNew.length, overlapCount: overlaps.length, candidates }, null, 2)}\n`,
);

const reviewMarkdown = [
  '# Daily Card glossary review queue',
  '',
  `Generated: ${generatedAt}`,
  '',
  `Ready glossary entries: **${candidates.length}**`,
  `Likely net-new: **${likelyNetNew.length}**`,
  `Potential overlaps: **${overlaps.length}**`,
  '',
  '## Likely net-new',
  '',
  ...(likelyNetNew.length
    ? likelyNetNew.map((candidate) => `- **${candidate.title}** — ${candidate.collectionId} — ${candidate.sourcePath}`)
    : ['- None']),
  '',
  '## Resolve overlap before promotion',
  '',
  ...(overlaps.length
    ? overlaps.map((candidate) => `- **${candidate.title}** — matches: ${candidate.potentialOverlapCardIds.join(', ')}`)
    : ['- None']),
  '',
  'All entries remain review-only. This heuristic is a triage aid, not editorial approval.',
  '',
];
fs.writeFileSync(path.join(outputDir, 'review.md'), `${reviewMarkdown.join('\n')}\n`);

console.log(`Generated ${candidates.length} review-only Daily Card candidates from ready-for-build glossary entries.`);
console.log(`Likely net-new candidates: ${likelyNetNew.length}.`);
for (const candidate of likelyNetNew) console.log(`NET-NEW: ${candidate.title} -> ${candidate.collectionId}`);
console.log(`Potential-overlap candidates: ${overlaps.length}.`);
for (const candidate of overlaps) console.log(`OVERLAP: ${candidate.title} -> ${candidate.potentialOverlapCardIds.join(',')}`);
