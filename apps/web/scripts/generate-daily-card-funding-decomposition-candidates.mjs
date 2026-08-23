import fs from 'node:fs';
import path from 'node:path';
import { dailyCards } from '../src/data/daily-card-catalog.js';
import { dailyCardFundingDecompositionResolutions } from '../src/data/daily-card-funding-decomposition-resolutions.js';

const outputDir = path.resolve('artifacts/daily-card-funding-decomposition');

const decompositionSpecs = Object.freeze([
  Object.freeze({ id: 'candidate-funding-map-participants-instruments', title: 'Funding Map: Participants, Instruments and Constraints', parentCardId: 'card-funding-stack-foundations', parentModule: 'src/data/daily-card-video-batch-01.js', sourceField: 'definition' }),
  Object.freeze({ id: 'candidate-fx-swap-two-contractual-legs', title: 'FX Swap Funding Has Two Contractual Legs', parentCardId: 'card-fx-swap-engine', parentModule: 'src/data/daily-card-video-batch-01.js', sourceField: 'definition' }),
  Object.freeze({ id: 'candidate-repo-haircut-funding-capacity', title: 'A Higher Haircut Reduces Cash Raised Against the Same Collateral', parentCardId: 'card-repo-collateral-haircuts', parentModule: 'src/data/daily-card-video-batch-01.js', sourceField: 'example' }),
  Object.freeze({ id: 'candidate-repo-collateral-terms-tighten-funding', title: 'Collateral Terms Can Tighten Funding Without More Cash Demand', parentCardId: 'card-repo-collateral-haircuts', parentModule: 'src/data/daily-card-video-batch-01.js', sourceField: 'whyItMatters' }),
  Object.freeze({ id: 'candidate-dealer-capacity-market-liquidity', title: 'Dealer Capacity Can Constrain Market Liquidity', parentCardId: 'card-dealer-intermediation-capacity', parentModule: 'src/data/daily-card-video-batch-04.js', sourceField: 'whyItMatters' }),
  Object.freeze({ id: 'candidate-funding-stress-multiple-channels', title: 'Funding Stress Can Travel Through Financing, Collateral and Leverage', parentCardId: 'card-funding-stress-transmission', parentModule: 'src/data/daily-card-video-batch-04.js', sourceField: 'definition' }),
  Object.freeze({ id: 'candidate-private-funding-basis-backstop-layers', title: 'Separate FX Swap Funding, Basis Pricing and Official Backstops', parentCardId: 'card-global-funding-fx-swaps-stack', parentModule: 'src/data/daily-card-video-batch-04.js', sourceField: 'definition' }),
  Object.freeze({ id: 'candidate-backstop-access-counterparty-terms', title: 'Backstop Access Depends on Counterparty and Terms', parentCardId: 'card-liquidity-backstops-stack', parentModule: 'src/data/daily-card-video-batch-04.js', sourceField: 'whyItMatters' }),
]);

const allCandidates = decompositionSpecs.map((spec) => {
  const parent = dailyCards.find((card) => card.id === spec.parentCardId);
  if (!parent) throw new Error(`${spec.id}: parent card ${spec.parentCardId} is missing.`);
  if (parent.collectionId !== 'dollar-funding-stack') throw new Error(`${spec.id}: parent is not a Dollar Funding Stack card.`);
  if (parent.access !== 'research' || parent.status !== 'ready-for-build') throw new Error(`${spec.id}: parent must remain research + ready-for-build.`);
  if (!parent.videoSlug || !Array.isArray(parent.sourceNames) || parent.sourceNames.length < 2) throw new Error(`${spec.id}: parent video/source provenance is incomplete.`);
  const sourceExcerpt = String(parent[spec.sourceField] || '').trim();
  if (sourceExcerpt.length < 20) throw new Error(`${spec.id}: source field ${spec.sourceField} is missing or too short.`);

  return Object.freeze({
    id: spec.id,
    title: spec.title,
    suggestedCollectionId: 'dollar-funding-stack',
    suggestedFormat: spec.sourceField === 'example' ? 'connection' : 'concept',
    suggestedLevel: 'advanced',
    suggestedAccess: 'research',
    sourceHierarchyRank: 1,
    sourceType: 'reviewed-video-card-decomposition',
    sourceParentCardId: parent.id,
    sourceParentSlug: parent.slug,
    sourceParentTitle: parent.title,
    sourceParentModule: spec.parentModule,
    sourceVideoSlug: parent.videoSlug,
    sourceField: spec.sourceField,
    sourceExcerpt,
    sourceNames: parent.sourceNames,
    parentConcepts: parent.concepts,
    reviewDisposition: 'decomposition-review',
    status: 'review',
    lastReviewed: null,
    productionNote: 'Review-only decomposition of an existing reviewed Funding Stack card. Promotion requires a distinct learning objective, explicit non-duplication against the parent and canonical catalog, and renewed primary-source review. Do not auto-publish.',
  });
});

const specIds = new Set(decompositionSpecs.map((spec) => spec.id));
const resolutionIds = new Set();
const resolutions = dailyCardFundingDecompositionResolutions.map((resolution) => {
  if (!specIds.has(resolution.candidateId)) throw new Error(`Funding resolution references unknown candidate ${resolution.candidateId}.`);
  if (resolutionIds.has(resolution.candidateId)) throw new Error(`Duplicate Funding resolution for ${resolution.candidateId}.`);
  resolutionIds.add(resolution.candidateId);
  if (resolution.resolution !== 'promoted') throw new Error(`${resolution.candidateId}: unsupported Funding resolution ${resolution.resolution}.`);
  const card = dailyCards.find((candidate) => candidate.id === resolution.cardId);
  if (!card) throw new Error(`${resolution.candidateId}: promoted card ${resolution.cardId} is missing.`);
  if (card.collectionId !== 'dollar-funding-stack' || card.access !== 'research' || card.status !== 'ready-for-build') throw new Error(`${resolution.cardId}: promoted Funding card has an invalid canonical boundary.`);
  if (!Array.isArray(card.sourceUrls) || card.sourceUrls.length < 1) throw new Error(`${resolution.cardId}: promoted Funding card lacks independent primary-source URLs.`);
  return Object.freeze({ ...resolution, cardTitle: card.title, cardSlug: card.slug, sourceUrls: card.sourceUrls });
});

const candidates = allCandidates.filter((candidate) => !resolutionIds.has(candidate.id));
const ids = candidates.map((candidate) => candidate.id);
if (new Set(ids).size !== ids.length) throw new Error('Funding decomposition candidate IDs must be unique.');
const titles = candidates.map((candidate) => candidate.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
if (new Set(titles).size !== titles.length) throw new Error('Funding decomposition candidate titles must be unique.');

const canonicalFunding = dailyCards.filter((card) => card.collectionId === 'dollar-funding-stack' && card.status === 'ready-for-build');
const unresolvedParentCounts = candidates.reduce((map, candidate) => {
  map[candidate.sourceParentCardId] = (map[candidate.sourceParentCardId] || 0) + 1;
  return map;
}, {});
const generatedAt = new Date().toISOString();
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'candidates.json'), `${JSON.stringify({
  generatedAt,
  sourceHierarchyRank: 1,
  sourceType: 'reviewed-video-card-decomposition',
  targetCollectionId: 'dollar-funding-stack',
  canonicalTarget: 15,
  canonicalCount: canonicalFunding.length,
  originalCandidateCount: allCandidates.length,
  resolvedCount: resolutions.length,
  candidateCount: candidates.length,
  unresolvedParentCounts,
  candidates,
}, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'resolved.json'), `${JSON.stringify({ generatedAt, count: resolutions.length, resolutions }, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'review.md'), `${[
  '# Dollar Funding Stack decomposition review queue', '',
  `Generated: ${generatedAt}`, '',
  'Canonical target: **15**',
  `Current canonical Funding Stack cards: **${canonicalFunding.length}**`,
  `Original decomposition candidates: **${allCandidates.length}**`,
  `Resolved/promoted after independent primary-source review: **${resolutions.length}**`,
  `Remaining review-only decompositions: **${candidates.length}**`, '',
  '## Remaining candidate review order', '',
  ...candidates.map((candidate, index) => `${index + 1}. **${candidate.title}** — parent \`${candidate.sourceParentCardId}\` — ${candidate.sourceField} — ${candidate.sourceVideoSlug}`), '',
  '## Resolved promotions', '',
  ...resolutions.map((resolution) => `- **${resolution.cardTitle}** — from \`${resolution.candidateId}\` — independent primary-source review recorded`), '',
  '## Promotion boundary', '',
  'Remaining candidates are not automatic new cards. Each must prove a distinct learning objective versus its parent and the wider canonical catalog, then pass renewed primary-source review before promotion.', '',
].join('\n')}\n`);

console.log(`Funding Stack decomposition queue: ${candidates.length} unresolved from ${allCandidates.length} original candidates; ${resolutions.length} promoted resolutions; ${canonicalFunding.length}/15 canonical Funding Stack cards.`);
for (const candidate of candidates) console.log(`FUNDING-DECOMP: ${candidate.title} | ${candidate.sourceParentCardId} | ${candidate.sourceField}`);
for (const resolution of resolutions) console.log(`FUNDING-RESOLVED: ${resolution.candidateId} -> ${resolution.cardId}`);
