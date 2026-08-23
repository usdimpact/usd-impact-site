import fs from 'node:fs';
import path from 'node:path';
import { dailyCards } from '../src/data/daily-card-catalog.js';
import { dailyCardInventoryTargets } from '../src/data/daily-card-inventory-plan.js';

const outputDir = path.resolve('artifacts/daily-card-daily-news-candidates');
const evidenceFiles = [
  '2026-08-17.md',
  '2026-08-18.md',
  '2026-08-19.md',
  '2026-08-20.md',
  '2026-08-21.md',
];
const newsDir = path.resolve('src/content/news');

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

const editions = new Map();
for (const fileName of evidenceFiles) {
  const sourcePath = `src/content/news/${fileName}`;
  const { frontmatter, body } = splitDocument(fs.readFileSync(path.join(newsDir, fileName), 'utf8'), fileName);
  if (readScalar(frontmatter, 'status') !== 'published') throw new Error(`${fileName}: Daily USD Impact evidence must remain published`);
  if (readScalar(frontmatter, 'category') !== 'Daily USD Impact') throw new Error(`${fileName}: unexpected Daily USD Impact category`);
  const date = readScalar(frontmatter, 'date');
  const lastReviewed = readScalar(frontmatter, 'lastReviewed');
  if (!date || !lastReviewed) throw new Error(`${fileName}: Daily USD Impact evidence metadata incomplete`);
  editions.set(fileName, { fileName, sourcePath, date, lastReviewed, body, fullText: `${frontmatter}\n${body}` });
}

const templates = [
  {
    id: 'candidate-daily-catalyst-not-direction',
    title: 'A Scheduled Catalyst Is Not a Directional Signal',
    suggestedCollectionId: 'market-application',
    suggestedFormat: 'mistake',
    suggestedLevel: 'foundation',
    concepts: ['scheduled catalyst', 'conditional interpretation', 'market direction'],
    evidence: [
      ['2026-08-17.md', /calendar identifies when information arrives; it does not determine the market outcome/i],
      ['2026-08-20.md', /market responses depend on positioning and the dominant regime/i],
      ['2026-08-21.md', /none of those channels predetermines the direction/i],
    ],
    sourceClaim: 'Multiple published Daily USD Impact editions separate the verified event calendar from the direction of the later market response.',
    candidateDefinition: 'A scheduled release or policy event tells you when new information may arrive; it does not determine whether the dollar, yields or risk assets will move up or down.',
    candidateWhyItMatters: 'Pre-interpreting an event can turn a verified calendar fact into an unsupported forecast before the data, policy content and market response exist.',
    candidateKeyTakeaway: 'Verify the event first, then interpret the released information and cross-asset response instead of assigning direction from the calendar label.',
  },
  {
    id: 'candidate-daily-narrow-data-broad-signal',
    title: 'Narrow Data Should Not Be Upgraded Into a Broad Macro Signal',
    suggestedCollectionId: 'market-application',
    suggestedFormat: 'mistake',
    suggestedLevel: 'foundation',
    concepts: ['data scope', 'labor data', 'broad macro conclusion'],
    evidence: [
      ['2026-08-19.md', /regional employment and unemployment detail can refine the labor-market picture/i],
      ['2026-08-20.md', /narrower than the monthly Employment Situation/i],
      ['2026-08-21.md', /should not be extrapolated into a national labor conclusion/i],
    ],
    sourceClaim: 'Three consecutive Daily USD Impact editions distinguish regional or demographic labor detail from the broader national labor signal.',
    candidateDefinition: 'A narrow dataset can add useful evidence without representing the entire economy, labor market or policy backdrop.',
    candidateWhyItMatters: 'Data scope determines how strong a conclusion the evidence can support. Regional, demographic or sector-specific releases should be combined with broader measures before making a national macro claim.',
    candidateKeyTakeaway: 'Match the breadth of the conclusion to the breadth of the dataset.',
  },
  {
    id: 'candidate-daily-transmission-chain',
    title: 'Read Macro Releases Through a Transmission Chain',
    suggestedCollectionId: 'market-application',
    suggestedFormat: 'connection',
    suggestedLevel: 'intermediate',
    concepts: ['macro release', 'policy expectations', 'Treasury yields', 'dollar transmission'],
    evidence: [
      ['2026-08-17.md', /repricing in the expected path of rates could affect the dollar, Treasury yields/i],
      ['2026-08-19.md', /which can influence U\.S\. rates, the dollar and rate-sensitive risk assets/i],
      ['2026-08-21.md', /may change policy-path and Treasury-yield expectations, with potential transmission into DXY/i],
    ],
    sourceClaim: 'Published Daily USD Impact editions repeatedly trace macro and policy information through expectations, Treasury yields, the dollar and rate-sensitive assets.',
    candidateDefinition: 'A macro release usually matters through a chain: the information changes expectations, expectations affect rates or financial conditions, and those changes can transmit into the dollar and other assets.',
    candidateWhyItMatters: 'Skipping the intermediate steps encourages mechanical rules such as “strong data equals stronger dollar” even when yields, positioning or the prevailing regime respond differently.',
    candidateKeyTakeaway: 'Trace the expectation and rates channel before assigning an asset-level conclusion to a macro release.',
  },
  {
    id: 'candidate-daily-oil-inventory-mix',
    title: 'One Headline Inventory Number Is Not the Whole Oil Balance',
    suggestedCollectionId: 'asset-transmission',
    suggestedFormat: 'mistake',
    suggestedLevel: 'intermediate',
    concepts: ['oil inventories', 'inventory mix', 'production', 'refinery utilization', 'product demand'],
    evidence: [
      ['2026-08-18.md', /weekly crude and product inventory changes/i],
      ['2026-08-20.md', /market response remains conditional on the inventory mix/i],
      ['2026-08-21.md', /single headline inventory figure is not sufficient on its own/i],
    ],
    sourceClaim: 'Multiple Daily USD Impact editions treat weekly petroleum data as a mix of crude, products, production, refinery activity and demand rather than one headline inventory number.',
    candidateDefinition: 'Weekly petroleum data describes several parts of the physical oil balance. A crude build or draw is only one input alongside product inventories, production, refinery utilization and demand indicators.',
    candidateWhyItMatters: 'Different components can point in different directions, so the headline crude figure can overstate or hide the broader physical-market message.',
    candidateKeyTakeaway: 'Read the inventory mix and physical balance before translating one crude headline into a WTI conclusion.',
  },
  {
    id: 'candidate-daily-expectations-positioning',
    title: 'Market Reaction Depends on Expectations and Positioning, Not the Data Sign Alone',
    suggestedCollectionId: 'market-application',
    suggestedFormat: 'connection',
    suggestedLevel: 'intermediate',
    concepts: ['expectations', 'positioning', 'market reaction', 'regime'],
    evidence: [
      ['2026-08-17.md', /compare them with expectations and prior data/i],
      ['2026-08-20.md', /market responses depend on positioning and the dominant regime/i],
      ['2026-08-21.md', /material surprises may change policy-path and Treasury-yield expectations/i],
    ],
    sourceClaim: 'Published Daily USD Impact editions repeatedly frame market reaction around surprise versus expectations, positioning and the dominant regime rather than the sign of the release alone.',
    candidateDefinition: 'Markets respond to information relative to what was expected and already positioned, not simply to whether a data point looks strong or weak in isolation.',
    candidateWhyItMatters: 'A “good” or “bad” number can produce an unexpected asset move when the surprise was already priced, positioning is crowded or another macro driver dominates.',
    candidateKeyTakeaway: 'Compare the release with expectations and positioning before interpreting the price response.',
  },
];

for (const template of templates) {
  for (const [fileName, pattern] of template.evidence) {
    const edition = editions.get(fileName);
    if (!edition) throw new Error(`${template.id}: missing evidence edition ${fileName}`);
    if (!pattern.test(edition.fullText)) throw new Error(`${template.id}: recurring methodology evidence changed in ${fileName}`);
  }
}

const counts = Object.fromEntries(Object.keys(dailyCardInventoryTargets).map((collectionId) => [
  collectionId,
  dailyCards.filter((card) => card.collectionId === collectionId).length,
]));
const deficits = Object.fromEntries(Object.entries(dailyCardInventoryTargets).map(([collectionId, target]) => [
  collectionId,
  Math.max(0, target - (counts[collectionId] || 0)),
]));

const candidates = templates.map((template) => {
  const evidence = template.evidence.map(([fileName]) => editions.get(fileName));
  const potentialOverlapCardIds = overlapCardIds(template.title, template.concepts);
  return {
    id: template.id,
    title: template.title,
    suggestedCollectionId: template.suggestedCollectionId,
    suggestedFormat: template.suggestedFormat,
    suggestedLevel: template.suggestedLevel,
    suggestedAccess: 'open',
    concepts: template.concepts,
    sourceClaim: template.sourceClaim,
    candidateDefinition: template.candidateDefinition,
    candidateWhyItMatters: template.candidateWhyItMatters,
    candidateKeyTakeaway: template.candidateKeyTakeaway,
    sourceHierarchyRank: 7,
    sourceType: 'daily-usd-impact-methodology',
    sourcePaths: evidence.map((item) => item.sourcePath),
    sourceDates: evidence.map((item) => item.date),
    sourceLastReviewed: evidence.map((item) => item.lastReviewed),
    sourceEvidenceCount: evidence.length,
    potentialOverlapCardIds,
    reviewDisposition: potentialOverlapCardIds.length ? 'resolve-overlap' : 'likely-net-new',
    evergreen: true,
    status: 'review',
    lastReviewed: null,
    productionNote: 'Review-only Daily USD Impact methodology candidate. Do not promote edition-specific dates, values, event outcomes, forecasts or market moves into evergreen learning content.',
  };
});

const generatedAt = new Date().toISOString();
const likelyNetNew = candidates.filter((candidate) => candidate.reviewDisposition === 'likely-net-new');
const overlaps = candidates.filter((candidate) => candidate.reviewDisposition === 'resolve-overlap');
const output = {
  generatedAt,
  sourceHierarchyRank: 7,
  sourceType: 'daily-usd-impact-methodology',
  reviewedEditionCount: editions.size,
  reviewedEditionPaths: [...editions.values()].map((edition) => edition.sourcePath),
  currentCollectionCounts: counts,
  currentCollectionDeficits: deficits,
  candidateCount: candidates.length,
  likelyNetNewCount: likelyNetNew.length,
  overlapCount: overlaps.length,
  candidates,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'candidates.json'), `${JSON.stringify(output, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'review.md'), `${[
  '# Daily USD Impact Daily Card review queue', '',
  `Generated: ${generatedAt}`, '',
  `Reviewed published Daily editions: **${editions.size}**`,
  `Recurring evergreen methodology candidates: **${candidates.length}**`,
  `Likely net-new: **${likelyNetNew.length}**`,
  `Potential overlaps: **${overlaps.length}**`, '',
  '## Source boundary', '',
  '- Hierarchy tier: **7 — Daily USD Impact**',
  '- Suggested access: **Open** because the source editions are public.',
  '- Each candidate must be supported by at least three published editions.',
  '- Edition-specific dates, values, event outcomes, forecasts and market moves are not eligible for evergreen promotion.', '',
  '## Candidates', '',
  ...candidates.map((candidate) => `- **${candidate.title}** — ${candidate.suggestedCollectionId} — ${candidate.reviewDisposition} — evidence ${candidate.sourceEvidenceCount}`), '',
  'All candidates remain `status: review` and `lastReviewed: null` until explicit editorial/source review.', '',
].join('\n')}\n`);

console.log(`Daily USD Impact Daily Card queue: ${editions.size} reviewed editions -> ${candidates.length} recurring methodology candidates.`);
console.log(`Likely net-new: ${likelyNetNew.length}; overlaps: ${overlaps.length}.`);
for (const candidate of candidates) {
  console.log(`DAILY-NEWS-CANDIDATE: ${candidate.title} -> ${candidate.suggestedCollectionId} [${candidate.reviewDisposition}]`);
}
