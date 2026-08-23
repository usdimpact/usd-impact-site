import fs from 'node:fs';
import path from 'node:path';
import { dailyCards } from '../src/data/daily-card-catalog.js';
import { dailyCardInventoryTargets } from '../src/data/daily-card-inventory-plan.js';
import { dailyCardWeeklyScoreResolutions } from '../src/data/daily-card-weekly-score-resolutions.js';

const reportsDir = path.resolve('src/content/weekly-reports');
const scorePagePath = path.resolve('src/pages/score.astro');
const outputDir = path.resolve('artifacts/daily-card-weekly-score-candidates');
const MIN_PUBLISHED_REPORTS = 3;

function splitDocument(text, fileName) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error(`${fileName}: missing frontmatter`);
  return { frontmatter: match[1], body: match[2] };
}

function readScalar(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'));
  if (!match) return '';
  const value = match[1].trim();
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  return value;
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function sectionBody(body, heading) {
  const lines = body.split(/\r?\n/);
  const normalizedHeading = normalize(heading);
  let active = false;
  const parts = [];
  for (const raw of lines) {
    const match = raw.match(/^##\s+(.+?)\s*$/);
    if (match) {
      if (active) break;
      active = normalize(match[1]) === normalizedHeading;
      continue;
    }
    if (active) parts.push(raw);
  }
  return parts.join('\n').trim();
}

function overlapCardIds(title, concepts = []) {
  const titleNorm = normalize(title);
  const tokens = [...new Set(normalize(`${title} ${concepts.join(' ')}`).split(' ').filter((token) => token.length >= 4))];
  return dailyCards.filter((card) => {
    const identity = normalize(`${card.slug} ${card.title} ${card.shortTitle || ''} ${(card.concepts || []).join(' ')}`);
    if (normalize(card.title) === titleNorm || normalize(card.shortTitle) === titleNorm) return true;
    const shared = tokens.filter((token) => identity.split(' ').includes(token));
    return shared.length >= Math.min(3, Math.max(2, Math.ceil(tokens.length / 3)));
  }).map((card) => card.id).slice(0, 8);
}

const reportFiles = fs.readdirSync(reportsDir).filter((name) => name.endsWith('.md')).sort();
const reports = [];
for (const fileName of reportFiles) {
  const sourcePath = `src/content/weekly-reports/${fileName}`;
  const { frontmatter, body } = splitDocument(fs.readFileSync(path.join(reportsDir, fileName), 'utf8'), fileName);
  if (readScalar(frontmatter, 'status') !== 'published') continue;
  const periodEnd = readScalar(frontmatter, 'periodEnd');
  const lastReviewed = readScalar(frontmatter, 'lastReviewed');
  const sourceUrl = readScalar(frontmatter, 'sourceUrl');
  const weekOverWeekChange = readScalar(frontmatter, 'weekOverWeekChange');
  const fourWeekChange = readScalar(frontmatter, 'fourWeekChange');
  const nearestRegimeBoundary = readScalar(frontmatter, 'nearestRegimeBoundary');
  if (!periodEnd || !lastReviewed || !sourceUrl) throw new Error(`${fileName}: published Weekly Score metadata incomplete`);
  reports.push({
    sourcePath,
    fileName,
    periodEnd,
    lastReviewed,
    sourceUrl,
    weekOverWeekChange,
    fourWeekChange,
    nearestRegimeBoundary,
    newsScoreSection: sectionBody(body, 'How the news and score fit together'),
    watchSection: sectionBody(body, 'What to watch next'),
    methodologySection: sectionBody(body, 'Methodology note'),
  });
}

if (reports.length < MIN_PUBLISHED_REPORTS) {
  throw new Error(`Weekly Score review tier requires at least ${MIN_PUBLISHED_REPORTS} published weekly reports; found ${reports.length}.`);
}

const scorePage = fs.readFileSync(scorePagePath, 'utf8');
if (!/combines market inputs into one weekly regime reading rather than treating DXY as a complete measure/i.test(scorePage)) {
  throw new Error('Weekly Score page no longer contains the cross-asset/DXY methodology boundary.');
}
if (!/Context, not a signal/i.test(scorePage)) {
  throw new Error('Weekly Score page no longer contains the context-not-signal boundary.');
}

const reportChecks = [
  {
    id: 'eight-input-configuration',
    match: (report) => /score measures the completed week['’]s configuration across eight standardized market inputs/i.test(report.newsScoreSection),
  },
  {
    id: 'news-vs-score',
    match: (report) => /news brief tracks verified developments and conditional transmission channels/i.test(report.newsScoreSection)
      && /score measures the completed week['’]s configuration/i.test(report.newsScoreSection),
  },
  {
    id: 'component-offsets',
    match: (report) => /softer-dollar contributions/i.test(report.newsScoreSection)
      && /firmer-dollar offsets/i.test(report.newsScoreSection),
  },
  {
    id: 'multiple-horizons',
    match: (report) => report.weekOverWeekChange !== '' && report.fourWeekChange !== '',
  },
  {
    id: 'component-breadth',
    match: (report) => /breadth of the score['’]s eight component contributions/i.test(report.watchSection),
  },
];

for (const check of reportChecks) {
  const unsupported = reports.filter((report) => !check.match(report));
  if (unsupported.length) {
    throw new Error(`${check.id}: methodology is not consistently supported by published reports: ${unsupported.map((report) => report.fileName).join(', ')}`);
  }
}

const templates = [
  {
    id: 'candidate-weekly-score-cross-asset-regime',
    title: 'A Weekly Dollar Regime Needs Cross-Asset Evidence',
    suggestedCollectionId: 'core-framework',
    suggestedFormat: 'concept',
    suggestedLevel: 'foundation',
    concepts: ['weekly score', 'cross-asset regime', 'DXY', 'eight standardized inputs'],
    sourceClaim: 'Published Weekly USD Impact Briefs consistently define the score as a completed-week configuration across eight standardized market inputs, while the score page says it is broader than DXY alone.',
    candidateDefinition: 'A weekly dollar-regime score summarizes a cross-asset configuration rather than treating one dollar index as the whole system.',
    candidateWhyItMatters: 'It separates a broad regime framework from a single-market observation and makes the score easier to read alongside DXY rather than as a substitute for it.',
    candidateKeyTakeaway: 'Use the weekly score as cross-asset context; do not equate one DXY move with the entire dollar regime.',
  },
  {
    id: 'candidate-weekly-score-news-vs-regime',
    title: 'News Sensitivity and the Weekly Regime Can Answer Different Questions',
    suggestedCollectionId: 'market-application',
    suggestedFormat: 'connection',
    suggestedLevel: 'intermediate',
    concepts: ['news flow', 'weekly regime', 'transmission channels', 'cross-asset configuration'],
    sourceClaim: 'Every published Weekly USD Impact Brief distinguishes verified news and conditional transmission channels from the completed-week score configuration.',
    candidateDefinition: 'News flow describes events and their possible transmission channels, while the weekly score summarizes the completed cross-asset configuration.',
    candidateWhyItMatters: 'A fresh event can carry one directional sensitivity without immediately overturning the broader weekly regime, because the two readings summarize different information sets.',
    candidateKeyTakeaway: 'Do not force the latest headline and the completed-week regime into the same directional conclusion.',
  },
  {
    id: 'candidate-weekly-score-components-offset',
    title: 'Weekly Score Components Can Offset Each Other',
    suggestedCollectionId: 'market-application',
    suggestedFormat: 'connection',
    suggestedLevel: 'intermediate',
    concepts: ['component contributions', 'offsets', 'cross-asset score'],
    sourceClaim: 'Across published weekly briefs, softer-dollar component contributions coexist with firmer-dollar offsets inside the same combined score.',
    candidateDefinition: 'A combined cross-asset score can contain components pointing in opposite directions at the same time; the headline reading reflects their combined contribution.',
    candidateWhyItMatters: 'Looking only at the largest component can misstate the regime when other inputs materially offset it.',
    candidateKeyTakeaway: 'Read both reinforcing and offsetting components before interpreting the headline weekly score.',
  },
  {
    id: 'candidate-weekly-score-multiple-horizons',
    title: 'Read Weekly Score Change Across More Than One Horizon',
    suggestedCollectionId: 'market-application',
    suggestedFormat: 'concept',
    suggestedLevel: 'foundation',
    concepts: ['week-over-week change', 'four-week change', 'time horizon'],
    sourceClaim: 'Every published Weekly USD Impact Brief records both week-over-week and four-week score changes.',
    candidateDefinition: 'Week-over-week and four-week score changes describe movement over different horizons and should be interpreted separately from the current regime level.',
    candidateWhyItMatters: 'The latest weekly move can be small even when a multi-week shift has accumulated, or large without yet establishing a durable multi-week change.',
    candidateKeyTakeaway: 'Separate the current level, the latest weekly change, and the multi-week direction before describing regime momentum.',
  },
  {
    id: 'candidate-weekly-score-component-breadth',
    title: 'Component Breadth Is a Weekly Regime Confirmation Check',
    suggestedCollectionId: 'market-application',
    suggestedFormat: 'watch',
    suggestedLevel: 'intermediate',
    concepts: ['component breadth', 'confirmation', 'eight standardized inputs'],
    sourceClaim: 'Published weekly briefs repeatedly identify the breadth of the score’s eight component contributions as a condition to watch when judging whether the regime persists or narrows.',
    candidateDefinition: 'Component breadth asks whether the score’s underlying inputs are broadly aligned or whether the headline regime is being carried by a narrower subset of contributions.',
    candidateWhyItMatters: 'A regime supported by broader participation is different evidence from the same headline value driven by only a few large components.',
    candidateKeyTakeaway: 'Treat breadth as confirmation context for the weekly score, not as a standalone forecast.',
  },
];

const counts = Object.fromEntries(Object.keys(dailyCardInventoryTargets).map((collectionId) => [
  collectionId,
  dailyCards.filter((card) => card.collectionId === collectionId).length,
]));
const deficits = Object.fromEntries(Object.entries(dailyCardInventoryTargets).map(([collectionId, target]) => [
  collectionId,
  Math.max(0, target - (counts[collectionId] || 0)),
]));

const sourcePaths = reports.map((report) => report.sourcePath);
const sourcePeriodEnds = reports.map((report) => report.periodEnd);
const sourceLastReviewed = reports.map((report) => report.lastReviewed);
const allCandidates = templates.map((template) => {
  const potentialOverlapCardIds = overlapCardIds(template.title, template.concepts);
  return {
    ...template,
    suggestedAccess: 'research',
    sourceHierarchyRank: 6,
    sourceType: 'weekly-score-methodology',
    sourcePaths,
    sourcePeriodEnds,
    sourceLastReviewed,
    sourceEvidenceCount: reports.length,
    supportingScorePage: 'src/pages/score.astro',
    potentialOverlapCardIds,
    reviewDisposition: potentialOverlapCardIds.length ? 'resolve-overlap' : 'likely-net-new',
    evergreen: true,
    status: 'review',
    lastReviewed: null,
    productionNote: 'Review-only Weekly Score methodology candidate. Do not promote week-specific score values, event claims, or component readings into evergreen learning content.',
  };
});

const templateIds = new Set(templates.map((template) => template.id));
const resolutionByCandidateId = new Map();
for (const resolution of dailyCardWeeklyScoreResolutions) {
  if (!templateIds.has(resolution.candidateId)) throw new Error(`Weekly Score resolution references unknown candidate ${resolution.candidateId}.`);
  if (resolutionByCandidateId.has(resolution.candidateId)) throw new Error(`Duplicate Weekly Score resolution for ${resolution.candidateId}.`);
  if (!['promoted', 'resolved-overlap'].includes(resolution.disposition)) throw new Error(`${resolution.candidateId}: invalid Weekly Score resolution disposition.`);
  if (resolution.disposition === 'promoted') {
    if (!dailyCards.some((card) => card.id === resolution.canonicalCardId)) throw new Error(`${resolution.candidateId}: promoted canonical card ${resolution.canonicalCardId} does not exist.`);
  } else if (!dailyCards.some((card) => card.id === resolution.primaryCardId)) {
    throw new Error(`${resolution.candidateId}: overlap primary card ${resolution.primaryCardId} does not exist.`);
  }
  resolutionByCandidateId.set(resolution.candidateId, resolution);
}

const candidates = allCandidates.filter((candidate) => !resolutionByCandidateId.has(candidate.id));
const resolved = allCandidates.filter((candidate) => resolutionByCandidateId.has(candidate.id)).map((candidate) => ({
  candidateId: candidate.id,
  candidateTitle: candidate.title,
  sourceHierarchyRank: candidate.sourceHierarchyRank,
  sourceType: candidate.sourceType,
  sourceEvidenceCount: candidate.sourceEvidenceCount,
  sourcePaths: candidate.sourcePaths,
  ...resolutionByCandidateId.get(candidate.id),
}));
const promoted = resolved.filter((item) => item.disposition === 'promoted');
const resolvedOverlaps = resolved.filter((item) => item.disposition === 'resolved-overlap');
const likelyNetNew = candidates.filter((candidate) => candidate.reviewDisposition === 'likely-net-new');
const overlaps = candidates.filter((candidate) => candidate.reviewDisposition === 'resolve-overlap');
const generatedAt = new Date().toISOString();

const output = {
  generatedAt,
  sourceHierarchyRank: 6,
  sourceType: 'weekly-score-methodology',
  publishedReportCount: reports.length,
  sourcePaths,
  sourcePeriodEnds,
  currentCollectionCounts: counts,
  currentCollectionDeficits: deficits,
  totalMethodologyConceptCount: allCandidates.length,
  accountedForCount: resolved.length,
  promotedCount: promoted.length,
  resolvedOverlapCount: resolvedOverlaps.length,
  candidateCount: candidates.length,
  likelyNetNewCount: likelyNetNew.length,
  overlapCount: overlaps.length,
  candidates,
};

const resolvedOutput = {
  generatedAt,
  sourceHierarchyRank: 6,
  sourceType: 'weekly-score-methodology',
  totalMethodologyConceptCount: allCandidates.length,
  accountedForCount: resolved.length,
  promotedCount: promoted.length,
  resolvedOverlapCount: resolvedOverlaps.length,
  resolutions: resolved,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'candidates.json'), `${JSON.stringify(output, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'resolved.json'), `${JSON.stringify(resolvedOutput, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'review.md'), `${[
  '# Daily Card Weekly Score review queue', '',
  `Generated: ${generatedAt}`, '',
  `Published Weekly Score reports reviewed: **${reports.length}**`,
  `Recurring methodology concepts: **${allCandidates.length}**`,
  `Accounted for: **${resolved.length}**`,
  `Promoted: **${promoted.length}**`,
  `Resolved as overlap: **${resolvedOverlaps.length}**`,
  `Remaining review candidates: **${candidates.length}**`, '',
  '## Source boundary', '',
  '- Hierarchy tier: **6 — Weekly Score**',
  '- Candidate access: **Research**',
  '- Evidence must recur across at least three published weekly reports.',
  '- Week-specific values, regime readings, dates and event claims are not eligible for evergreen promotion from this queue.', '',
  '## Editorial resolutions', '',
  ...resolved.map((item) => `- **${item.candidateTitle}** — ${item.disposition}${item.canonicalCardId ? ` -> ${item.canonicalCardId}` : ` -> ${item.primaryCardId}`}`), '',
  '## Remaining candidates', '',
  ...(candidates.length ? candidates.map((candidate) => `- **${candidate.title}** — ${candidate.suggestedCollectionId} — ${candidate.reviewDisposition} — evidence ${candidate.sourceEvidenceCount}/${reports.length}`) : ['- None. Tier 6 is fully accounted for.']), '',
  'Any future Weekly Score methodology candidate remains review-only with `lastReviewed: null` until explicit editorial/source review.', '',
].join('\n')}\n`);

console.log(`Weekly Score Daily Card tier: ${reports.length} published reports -> ${allCandidates.length} recurring methodology concepts.`);
console.log(`Accounted for: ${resolved.length}; promoted: ${promoted.length}; overlap resolutions: ${resolvedOverlaps.length}; remaining review candidates: ${candidates.length}.`);
for (const item of resolved) {
  console.log(`WEEKLY-SCORE-RESOLUTION: ${item.candidateTitle} -> ${item.disposition} [${item.canonicalCardId || item.primaryCardId}]`);
}
for (const candidate of candidates) {
  console.log(`WEEKLY-SCORE-CANDIDATE: ${candidate.title} -> ${candidate.suggestedCollectionId} [${candidate.reviewDisposition}]`);
}
