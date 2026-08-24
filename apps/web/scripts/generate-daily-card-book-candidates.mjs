import fs from 'node:fs';
import path from 'node:path';
import { dailyCards } from '../src/data/daily-card-catalog.js';
import { dailyCardBookResolutions } from '../src/data/daily-card-book-resolutions.js';

const pagesDir = path.resolve('src/content/pages');
const outputDir = path.resolve('artifacts/daily-card-book-candidates');

const COLLECTION_BY_PAGE = Object.freeze({
  'dxy-vs-broad-usd': 'core-framework',
  'fx-depreciation-vs-inflation': 'global-dollar-fx',
  'how-to-read-the-dollar': 'market-application',
  'lng-natural-gas': 'asset-transmission',
  'usd-and-currency-risk': 'global-dollar-fx',
  'usd-bitcoin': 'asset-transmission',
  'usd-equities': 'asset-transmission',
  'usd-gold': 'asset-transmission',
  'usd-wti': 'asset-transmission',
  'what-is-dxy': 'core-framework',
  'what-is-the-us-dollar': 'core-framework',
});

const EXCLUDED_HEADINGS = new Set([
  'sources',
  'source',
  'references',
  'compliance',
  'compliance note',
  'key takeaway',
  'key takeaways',
  'summary',
  'conclusion',
  'related reading',
  'related content',
]);

const SHORT_IDENTIFIER_TOKENS = new Set([
  'btc',
  'cpi',
  'dxy',
  'lng',
  'tga',
  'tips',
  'usd',
  'vix',
  'wti',
]);

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
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugify(value) {
  return normalize(value).replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
}

function cleanInlineMarkdown(value) {
  return String(value || '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstParagraph(lines, startIndex) {
  const paragraph = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    const raw = lines[index];
    if (/^##\s+/.test(raw)) break;
    const line = raw.trim();
    if (!line) {
      if (paragraph.length) break;
      continue;
    }
    if (/^(###|[-*+]\s|\d+\.\s|\||>|```|<)/.test(line)) {
      if (paragraph.length) break;
      continue;
    }
    paragraph.push(line);
  }
  return cleanInlineMarkdown(paragraph.join(' '));
}

function overlapCardIds({ heading, excerpt }) {
  const headingNorm = normalize(heading);
  const excerptNorm = normalize(excerpt);
  const headingTokens = [...new Set(headingNorm.split(' ').filter(Boolean))];
  const tokens = headingTokens.filter((token) => token.length >= 4 || SHORT_IDENTIFIER_TOKENS.has(token));
  const shortIdentifiers = headingTokens.filter((token) => SHORT_IDENTIFIER_TOKENS.has(token));

  return dailyCards
    .filter((card) => {
      const identity = normalize(`${card.slug} ${card.title} ${card.shortTitle || ''}`);
      const identityTokens = new Set(identity.split(' ').filter(Boolean));
      const haystack = normalize(`${identity} ${(card.concepts || []).join(' ')}`);
      if (headingNorm && (normalize(card.title) === headingNorm || normalize(card.shortTitle) === headingNorm)) return true;
      if (shortIdentifiers.some((token) => identityTokens.has(token) || haystack.split(' ').includes(token))) return true;
      const shared = tokens.filter((token) => haystack.includes(token));
      const excerptSignal = tokens.some((token) => excerptNorm.includes(token) && haystack.includes(token));
      return shared.length >= 2 || (tokens.length === 1 && shared.length === 1 && excerptSignal);
    })
    .map((card) => card.id)
    .slice(0, 8);
}

function proposedLevel(readingLevel) {
  return /beginner/i.test(readingLevel) ? 'foundation' : 'intermediate';
}

function sourceSectionKey(sourcePath, sourceHeading) {
  return `${sourcePath}::${sourceHeading}`;
}

const promotedBookSectionKeys = new Set(
  dailyCards
    .filter((card) => card.status === 'ready-for-build' && typeof card.sourcePath === 'string' && card.sourcePath.startsWith('src/content/pages/') && typeof card.sourceHeading === 'string')
    .map((card) => sourceSectionKey(card.sourcePath, card.sourceHeading)),
);

const resolvedBookSectionKeys = new Set(
  dailyCardBookResolutions.map((resolution) => sourceSectionKey(resolution.sourcePath, resolution.sourceHeading)),
);

for (const key of resolvedBookSectionKeys) {
  if (promotedBookSectionKeys.has(key)) throw new Error(`Book source section cannot be both promoted and resolved: ${key}`);
}

const pageFiles = fs.readdirSync(pagesDir).filter((name) => name.endsWith('.md')).sort();
const lessons = [];
const candidates = [];
const ids = new Set();

for (const fileName of pageFiles) {
  const sourcePath = `src/content/pages/${fileName}`;
  const pageKey = fileName.replace(/\.md$/, '');
  const raw = fs.readFileSync(path.join(pagesDir, fileName), 'utf8');
  const { frontmatter, body } = splitDocument(raw, fileName);
  const status = readScalar(frontmatter, 'status');
  const category = readScalar(frontmatter, 'category');
  if (status !== 'published' || !category.startsWith('Book lesson')) continue;

  const title = readScalar(frontmatter, 'title');
  const slug = readScalar(frontmatter, 'slug');
  const lastReviewed = readScalar(frontmatter, 'lastReviewed');
  const readingLevel = readScalar(frontmatter, 'readingLevel');
  const collectionId = COLLECTION_BY_PAGE[pageKey];
  if (!title || !slug || !lastReviewed || !readingLevel) {
    throw new Error(`${fileName}: published Book lesson must include title, slug, lastReviewed and readingLevel`);
  }
  if (!collectionId) throw new Error(`${fileName}: published Book lesson is missing a deterministic Daily Card collection mapping`);

  const lines = body.split(/\r?\n/);
  const lessonCandidates = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^##\s+(.+?)\s*$/);
    if (!match) continue;
    const heading = cleanInlineMarkdown(match[1]);
    const headingNorm = normalize(heading);
    if (!heading || EXCLUDED_HEADINGS.has(headingNorm)) continue;
    const sourceKey = sourceSectionKey(sourcePath, heading);
    if (promotedBookSectionKeys.has(sourceKey) || resolvedBookSectionKeys.has(sourceKey)) continue;
    const sectionAnchor = slugify(heading);
    const sourceExcerpt = firstParagraph(lines, index + 1);
    if (!sourceExcerpt) continue;
    const id = `candidate-book-${pageKey}-${sectionAnchor}`;
    if (ids.has(id)) throw new Error(`${fileName}: duplicate candidate ID ${id}`);
    ids.add(id);
    const potentialOverlapCardIds = overlapCardIds({ heading, excerpt: sourceExcerpt });
    const candidate = {
      id,
      title: heading,
      suggestedCollectionId: collectionId,
      suggestedFormat: /mistake|error|wrong/i.test(heading) ? 'mistake' : 'concept',
      suggestedLevel: proposedLevel(readingLevel),
      suggestedAccess: 'open',
      sourceHierarchyRank: 3,
      sourceType: 'published-book-lesson',
      sourcePath,
      sourcePageTitle: title,
      sourcePageSlug: slug,
      sourceCategory: category,
      sourceStatus: status,
      sourceLastReviewed: lastReviewed,
      sourceSectionAnchor: sectionAnchor,
      sourceExcerpt,
      potentialOverlapCardIds,
      reviewDisposition: potentialOverlapCardIds.length ? 'resolve-overlap' : 'likely-net-new',
      status: 'review',
      lastReviewed: null,
      productionNote: 'Extracted from an existing published USD Impact Book lesson heading and source paragraph. Editorial review must resolve overlap, complete the canonical card fields, preserve source traceability and explicitly approve the card before promotion.',
    };
    lessonCandidates.push(candidate);
    candidates.push(candidate);
  }

  lessons.push({
    sourcePath,
    title,
    slug,
    category,
    lastReviewed,
    readingLevel,
    suggestedCollectionId: collectionId,
    candidateCount: lessonCandidates.length,
  });
}

if (!lessons.length) throw new Error('No published Book lessons were discovered.');
if (!candidates.length) throw new Error('Published Book lessons produced no H2 review candidates.');

const likelyNetNew = candidates.filter((candidate) => candidate.reviewDisposition === 'likely-net-new');
const overlaps = candidates.filter((candidate) => candidate.reviewDisposition === 'resolve-overlap');
const generatedAt = new Date().toISOString();

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'candidates.json'), `${JSON.stringify({
  generatedAt,
  sourceHierarchyRank: 3,
  promotedSectionCount: promotedBookSectionKeys.size,
  resolvedSectionCount: resolvedBookSectionKeys.size,
  lessonCount: lessons.length,
  candidateCount: candidates.length,
  likelyNetNewCount: likelyNetNew.length,
  overlapCount: overlaps.length,
  lessons,
  candidates,
}, null, 2)}\n`);

const reviewMarkdown = [
  '# Daily Card Book lesson review queue',
  '',
  `Generated: ${generatedAt}`,
  '',
  `Promoted Book sections excluded: **${promotedBookSectionKeys.size}**`,
  `Reviewed overlap resolutions excluded: **${resolvedBookSectionKeys.size}**`,
  `Published Book lessons: **${lessons.length}**`,
  `Heading-level candidates remaining: **${candidates.length}**`,
  `Likely net-new: **${likelyNetNew.length}**`,
  `Potential overlaps: **${overlaps.length}**`,
  '',
  '## Source lessons',
  '',
  ...lessons.map((lesson) => `- **${lesson.title}** — ${lesson.candidateCount} candidates — ${lesson.suggestedCollectionId} — ${lesson.sourcePath}`),
  '',
  '## Likely net-new candidates',
  '',
  ...(likelyNetNew.length
    ? likelyNetNew.map((candidate) => `- **${candidate.title}** — ${candidate.suggestedCollectionId} — ${candidate.sourcePageTitle}`)
    : ['- None']),
  '',
  '## Potential overlaps',
  '',
  ...(overlaps.length
    ? overlaps.map((candidate) => `- **${candidate.title}** — matches: ${candidate.potentialOverlapCardIds.join(', ')}`)
    : ['- None']),
  '',
  'All candidates are review-only. No finance prose is invented by this generator: title and excerpt come from the existing published lesson source.',
  '',
];
fs.writeFileSync(path.join(outputDir, 'review.md'), `${reviewMarkdown.join('\n')}\n`);

console.log(`Excluded ${promotedBookSectionKeys.size} promoted Book sections and ${resolvedBookSectionKeys.size} reviewed overlap resolutions from the review queue.`);
console.log(`Book lesson Daily Card queue: ${lessons.length} published lessons -> ${candidates.length} remaining review candidates.`);
console.log(`Likely net-new: ${likelyNetNew.length}; potential overlaps: ${overlaps.length}.`);
for (const lesson of lessons) console.log(`BOOK-SOURCE: ${lesson.title} -> ${lesson.candidateCount} candidates (${lesson.suggestedCollectionId})`);
