import fs from 'node:fs';
import path from 'node:path';
import { dailyCards } from '../src/data/daily-card-catalog.js';

const frameworksDir = path.resolve('src/content/frameworks');
const outputDir = path.resolve('artifacts/daily-card-framework-candidates');
const allowedStatuses = new Set(['published', 'ready-for-build']);
const excludedHeadings = new Set(['key takeaway', 'sources', 'source', 'references', 'compliance', 'compliance note']);
const shortTokens = new Set(['dxy', 'usd', 'vix']);

function splitDocument(text, fileName) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error(`${fileName}: missing frontmatter`);
  return { frontmatter: match[1], body: match[2] };
}

function readScalar(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!match) return '';
  const value = match[1].trim();
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  return value;
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function slugify(value) {
  return normalize(value).replace(/\s+/g, '-');
}

function clean(value) {
  return String(value || '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstParagraph(lines, startIndex) {
  const parts = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    const raw = lines[index];
    if (/^##\s+/.test(raw)) break;
    const line = raw.trim();
    if (!line) {
      if (parts.length) break;
      continue;
    }
    if (/^(###|[-*+]\s|\d+\.\s|\||>|```|---)/.test(line)) {
      if (parts.length) break;
      continue;
    }
    parts.push(line);
  }
  return clean(parts.join(' '));
}

function suggestedCollection(heading, excerpt) {
  const text = normalize(`${heading} ${excerpt}`);
  if (/real rate|real yield|liquidity|credit spread|stress|fed funds|balance sheet|tips|nominal yield|volatility|vix/.test(text)) return 'rates-liquidity-policy';
  if (/weekly monitoring|transmit|transmission|risk appetite|confirmation/.test(text)) return 'market-application';
  if (/1971|bretton|reserve currenc|history|institution/.test(text)) return 'history-institutions';
  return 'core-framework';
}

function overlapCardIds(heading, excerpt) {
  const headingNorm = normalize(heading);
  const excerptNorm = normalize(excerpt);
  const tokens = [...new Set(headingNorm.split(' ').filter((token) => token.length >= 4 || shortTokens.has(token)))];
  return dailyCards.filter((card) => {
    const identity = normalize(`${card.slug} ${card.title} ${card.shortTitle || ''}`);
    const haystack = normalize(`${identity} ${(card.concepts || []).join(' ')}`);
    if (normalize(card.title) === headingNorm || normalize(card.shortTitle) === headingNorm) return true;
    const shared = tokens.filter((token) => haystack.split(' ').includes(token) || haystack.includes(token));
    const excerptSignal = tokens.some((token) => excerptNorm.includes(token) && haystack.includes(token));
    return shared.length >= 2 || (tokens.length === 1 && shared.length === 1 && excerptSignal);
  }).map((card) => card.id).slice(0, 8);
}

const files = fs.readdirSync(frameworksDir).filter((name) => name.endsWith('.md')).sort();
const sources = [];
const candidates = [];

for (const fileName of files) {
  const sourcePath = `src/content/frameworks/${fileName}`;
  const { frontmatter, body } = splitDocument(fs.readFileSync(path.join(frameworksDir, fileName), 'utf8'), fileName);
  const status = readScalar(frontmatter, 'status');
  if (!allowedStatuses.has(status)) continue;
  const title = readScalar(frontmatter, 'title');
  const slug = readScalar(frontmatter, 'slug');
  const lastReviewed = readScalar(frontmatter, 'lastReviewed');
  const readingLevel = readScalar(frontmatter, 'readingLevel');
  if (!title || !slug || !lastReviewed || !readingLevel) throw new Error(`${fileName}: reviewed framework metadata incomplete`);

  const lines = body.split(/\r?\n/);
  let sourceCandidateCount = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^##\s+(.+?)\s*$/);
    if (!match) continue;
    const heading = clean(match[1]);
    if (!heading || excludedHeadings.has(normalize(heading))) continue;
    const sourceExcerpt = firstParagraph(lines, index + 1);
    if (!sourceExcerpt) continue;
    const potentialOverlapCardIds = overlapCardIds(heading, sourceExcerpt);
    candidates.push({
      id: `candidate-framework-${fileName.replace(/\.md$/, '')}-${slugify(heading)}`,
      title: heading,
      suggestedCollectionId: suggestedCollection(heading, sourceExcerpt),
      suggestedFormat: /mistake/i.test(heading) ? 'mistake' : 'concept',
      suggestedLevel: /beginner/i.test(readingLevel) ? 'foundation' : 'intermediate',
      suggestedAccess: 'open',
      sourceHierarchyRank: 4,
      sourceType: 'reviewed-framework-section',
      sourcePath,
      sourcePageTitle: title,
      sourcePageSlug: slug,
      sourceStatus: status,
      sourceLastReviewed: lastReviewed,
      sourceHeading: heading,
      sourceExcerpt,
      potentialOverlapCardIds,
      reviewDisposition: potentialOverlapCardIds.length ? 'resolve-overlap' : 'likely-net-new',
      status: 'review',
      lastReviewed: null,
      productionNote: 'Extracted from a reviewed USD Impact framework H2 and first source paragraph. Editorial review must resolve overlap and complete canonical fields before promotion.',
    });
    sourceCandidateCount += 1;
  }
  sources.push({ sourcePath, title, slug, status, lastReviewed, candidateCount: sourceCandidateCount });
}

const likelyNetNew = candidates.filter((candidate) => candidate.reviewDisposition === 'likely-net-new');
const overlaps = candidates.filter((candidate) => candidate.reviewDisposition === 'resolve-overlap');
const generatedAt = new Date().toISOString();
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'candidates.json'), `${JSON.stringify({ generatedAt, sourceHierarchyRank: 4, sourceCount: sources.length, candidateCount: candidates.length, likelyNetNewCount: likelyNetNew.length, overlapCount: overlaps.length, sources, candidates }, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'review.md'), `${[
  '# Daily Card Framework review queue', '',
  `Generated: ${generatedAt}`, '',
  `Reviewed framework files: **${sources.length}**`,
  `Section candidates: **${candidates.length}**`,
  `Likely net-new: **${likelyNetNew.length}**`,
  `Potential overlaps: **${overlaps.length}**`, '',
  '## Source frameworks', '',
  ...sources.map((source) => `- **${source.title}** — ${source.status} — ${source.candidateCount} candidates — ${source.sourcePath}`), '',
  '## Likely net-new', '',
  ...(likelyNetNew.length ? likelyNetNew.map((candidate) => `- **${candidate.title}** — ${candidate.suggestedCollectionId} — ${candidate.sourcePageTitle}`) : ['- None']), '',
  '## Resolve overlap', '',
  ...(overlaps.length ? overlaps.map((candidate) => `- **${candidate.title}** — ${candidate.potentialOverlapCardIds.join(', ')}`) : ['- None']), '',
  'All candidates remain review-only. Empty framework metadata shells produce zero candidates.', '',
].join('\n')}\n`);
console.log(`Framework Daily Card queue: ${sources.length} reviewed files -> ${candidates.length} section candidates.`);
console.log(`Likely net-new: ${likelyNetNew.length}; overlaps: ${overlaps.length}.`);
for (const source of sources) console.log(`FRAMEWORK-SOURCE: ${source.title} [${source.status}] -> ${source.candidateCount}`);
