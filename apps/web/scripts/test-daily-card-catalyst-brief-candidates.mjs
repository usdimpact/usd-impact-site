import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { dailyCards } from '../src/data/daily-card-catalog.js';
import { dailyCardCatalystBriefResolutions } from '../src/data/daily-card-catalyst-brief-resolutions.js';

const generator = spawnSync(process.execPath, ['scripts/generate-daily-card-catalyst-brief-candidates.mjs'], {
  cwd: process.cwd(),
  encoding: 'utf8',
});
if (generator.status !== 0) {
  process.stderr.write(generator.stdout || '');
  process.stderr.write(generator.stderr || '');
  process.exit(generator.status || 1);
}

const artifactPath = path.resolve('artifacts/daily-card-catalyst-brief-candidates/candidates.json');
const resolvedPath = path.resolve('artifacts/daily-card-catalyst-brief-candidates/resolved.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const resolvedArtifact = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
const errors = [];

const expectedCandidateIds = new Set([
  'candidate-catalyst-primary-source-timing',
  'candidate-catalyst-preview-outcome-separation',
  'candidate-catalyst-component-breadth',
  'candidate-catalyst-rates-transmission-check',
]);
const expectedPromotedCardIds = new Set(['card-inflation-release-component-mix']);

if (artifact.sourceHierarchyRank !== 8) errors.push('source hierarchy rank must be 8');
if (artifact.sourceType !== 'catalyst-brief-methodology') errors.push('source type must be catalyst-brief-methodology');
if (artifact.publishedBriefCount < 1) errors.push('at least one published Catalyst Brief is required');
if (!Array.isArray(artifact.publishedBriefPaths) || artifact.publishedBriefPaths.length !== artifact.publishedBriefCount) errors.push('published Catalyst Brief paths are incomplete');
if (artifact.totalMethodologyConceptCount !== 4) errors.push('expected exactly four bounded Tier 8 methodology concepts');
if (artifact.accountedForCount !== 4) errors.push('all four Tier 8 concepts must be accounted for');
if (artifact.promotedCount !== 1) errors.push('expected exactly one promoted Tier 8 concept');
if (artifact.resolvedOverlapCount !== 3) errors.push('expected exactly three Tier 8 overlap resolutions');
if (artifact.candidateCount !== 0 || artifact.candidates?.length !== 0) errors.push('Tier 8 Catalyst Brief queue must have zero unresolved candidates after editorial closure');

if (resolvedArtifact.totalMethodologyConceptCount !== 4 || resolvedArtifact.accountedForCount !== 4) {
  errors.push('resolved artifact must account for all four Catalyst Brief methodology concepts');
}
if (resolvedArtifact.promotedCount !== 1 || resolvedArtifact.resolvedOverlapCount !== 3) {
  errors.push('resolved artifact must preserve the 1-promote / 3-overlap editorial decision');
}

const resolutionIds = new Set();
const promotedCardIds = new Set();
for (const resolution of dailyCardCatalystBriefResolutions) {
  if (!expectedCandidateIds.has(resolution.candidateId)) errors.push(`${resolution.candidateId}: unexpected Catalyst Brief candidate resolution`);
  if (resolutionIds.has(resolution.candidateId)) errors.push(`${resolution.candidateId}: duplicate Catalyst Brief resolution`);
  resolutionIds.add(resolution.candidateId);
  if (!resolution.reviewedAt) errors.push(`${resolution.candidateId}: reviewedAt is required`);

  if (resolution.disposition === 'promoted') {
    if (!expectedPromotedCardIds.has(resolution.canonicalCardId)) errors.push(`${resolution.candidateId}: unexpected promoted canonical card ${resolution.canonicalCardId}`);
    if (promotedCardIds.has(resolution.canonicalCardId)) errors.push(`${resolution.candidateId}: duplicate promoted canonical card ${resolution.canonicalCardId}`);
    promotedCardIds.add(resolution.canonicalCardId);
    const card = dailyCards.find((item) => item.id === resolution.canonicalCardId);
    if (!card) errors.push(`${resolution.candidateId}: promoted canonical card missing from catalog`);
    else if (card.access !== 'open') errors.push(`${resolution.candidateId}: Catalyst Brief promotion must remain Open`);
  } else if (resolution.disposition === 'resolved-overlap') {
    if (!['alias', 'composite'].includes(resolution.resolutionMode)) errors.push(`${resolution.candidateId}: overlap resolution mode must be alias or composite`);
    if (!dailyCards.some((card) => card.id === resolution.primaryCardId)) errors.push(`${resolution.candidateId}: overlap primary card missing from catalog`);
    for (const relatedId of resolution.relatedCardIds || []) {
      if (!dailyCards.some((card) => card.id === relatedId)) errors.push(`${resolution.candidateId}: overlap related card ${relatedId} missing from catalog`);
    }
  } else {
    errors.push(`${resolution.candidateId}: invalid resolution disposition ${resolution.disposition}`);
  }
}

for (const candidateId of expectedCandidateIds) {
  if (!resolutionIds.has(candidateId)) errors.push(`${candidateId}: missing durable editorial resolution`);
}
for (const cardId of expectedPromotedCardIds) {
  if (!promotedCardIds.has(cardId)) errors.push(`${cardId}: missing promoted resolution mapping`);
}

const promotedCards = dailyCards.filter((card) => expectedPromotedCardIds.has(card.id));
if (promotedCards.length !== 1) errors.push(`expected exactly one promoted Catalyst Brief card, found ${promotedCards.length}`);
for (const card of promotedCards) {
  if (card.collectionId !== 'rates-liquidity-policy') errors.push(`${card.id}: promoted Catalyst Brief card must remain in Rates, Liquidity & Policy`);
  if (card.status !== 'ready-for-build') errors.push(`${card.id}: promoted card must be ready-for-build`);
  if (!card.lastReviewed) errors.push(`${card.id}: lastReviewed is required`);
  if (card.access !== 'open') errors.push(`${card.id}: public Catalyst Brief promotion must remain Open`);
  if (!Array.isArray(card.sourcePaths) || card.sourcePaths.length !== 1 || card.sourcePaths[0] !== 'src/content/catalyst-briefs/2026-08-12-bls-consumer-price-index-cpi-for-july-2026-preview.md') errors.push(`${card.id}: exact Catalyst Brief source path is required`);
  if (!Array.isArray(card.sourceNames) || card.sourceNames.length < 2) errors.push(`${card.id}: source names are required`);
  const evergreenProse = [card.title, card.hook, card.definition, card.whyItMatters, card.example, card.commonMistake, card.keyTakeaway].join(' ');
  if (/\b20\d{2}-\d{2}-\d{2}\b/.test(evergreenProse)) errors.push(`${card.id}: event date leaked into evergreen card`);
  if (/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}\b/i.test(evergreenProse)) errors.push(`${card.id}: calendar date leaked into evergreen card`);
  if (/\b\d{1,2}:\d{2}\b/.test(evergreenProse)) errors.push(`${card.id}: event time leaked into evergreen card`);
  if (/\b\d+(?:\.\d+)?\s*%/.test(evergreenProse)) errors.push(`${card.id}: event-specific percentage leaked into evergreen card`);
}

const timingResolution = dailyCardCatalystBriefResolutions.find((item) => item.candidateId === 'candidate-catalyst-primary-source-timing');
if (timingResolution?.primaryCardId !== 'card-scheduled-catalyst-not-direction') errors.push('primary-source timing candidate must resolve to the existing scheduled-catalyst card');
const phaseResolution = dailyCardCatalystBriefResolutions.find((item) => item.candidateId === 'candidate-catalyst-preview-outcome-separation');
if (phaseResolution?.primaryCardId !== 'card-scheduled-catalyst-not-direction' || !phaseResolution.relatedCardIds?.includes('card-market-reaction-expectations-positioning')) errors.push('preview/outcome candidate must resolve across scheduled-catalyst and market-reaction cards');
const ratesResolution = dailyCardCatalystBriefResolutions.find((item) => item.candidateId === 'candidate-catalyst-rates-transmission-check');
if (ratesResolution?.primaryCardId !== 'card-macro-release-transmission-chain') errors.push('rates transmission candidate must resolve to the existing macro-release transmission card');

for (const item of resolvedArtifact.resolutions || []) {
  if (!resolutionIds.has(item.candidateId)) errors.push(`${item.candidateId}: generated resolution is not in the durable registry`);
  if (item.sourceHierarchyRank !== 8 || item.sourceType !== 'catalyst-brief-methodology') errors.push(`${item.candidateId}: generated resolution lost hierarchy metadata`);
  if (item.sourceEvidenceCount !== 1) errors.push(`${item.candidateId}: generated resolution must preserve the bounded Catalyst Brief evidence count`);
  if (!Array.isArray(item.sourcePaths) || item.sourcePaths.length !== 1) errors.push(`${item.candidateId}: generated resolution lost exact source provenance`);
}

if (errors.length) {
  console.error('Catalyst Brief Daily Card Tier 8 editorial contract failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Catalyst Brief Daily Card Tier 8 editorial contract passed: 4/4 methodology concepts accounted for; 1 promoted Open card, 3 overlap resolutions, 0 pending.');
