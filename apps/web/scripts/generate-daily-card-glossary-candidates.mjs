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
  wti: 'asset-transmission',
  xauusd: 'asset-transmission',
});

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return JSON.parse(trimmed);
  }
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
    potentialOverlapCardIds: overlapCardIds({ term, title: frontmatter.title, definition: frontmatter.definition }),
    status: 'review',
    lastReviewed: null,
    productionNote: 'Auto-derived from a ready-for-build USD Impact glossary entry. Resolve overlap, complete editorial fields, verify authoritative external sources where required, and explicitly review before promotion.',
  };
}).filter(Boolean);

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  path.join(outputDir, 'candidates.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), count: candidates.length, candidates }, null, 2)}\n`,
);

console.log(`Generated ${candidates.length} review-only Daily Card candidates from ready-for-build glossary entries.`);
console.log(`Potential-overlap candidates: ${candidates.filter((candidate) => candidate.potentialOverlapCardIds.length > 0).length}.`);
