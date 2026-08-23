import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { dailyCards } from '../src/data/daily-card-catalog.js';
import { dailyCardDailyNewsResolutions } from '../src/data/daily-card-daily-news-resolutions.js';

const generator = spawnSync(process.execPath, ['scripts/generate-daily-card-daily-news-candidates.mjs'], {
  cwd: process.cwd(),
  encoding: 'utf8',
});
if (generator.status !== 0) {
  process.stderr.write(generator.stdout || '');
  process.stderr.write(generator.stderr || '');
  process.exit(generator.status || 1);
}

const artifactPath = path.resolve('artifacts/daily-card-daily-news-candidates/candidates.json');
const resolvedPath = path.resolve('artifacts/daily-card-daily-news-candidates/resolved.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const resolvedArtifact = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
const errors = [];

const expectedCandidateIds = new Set([
  'candidate-daily-catalyst-not-direction',
  'candidate-daily-narrow-data-broad-signal',
  'candidate-daily-transmission-chain',
  'candidate-daily-oil-inventory-mix',
  'candidate-daily-expectations-positioning',
]);
const expectedPromotedCardIds = new Set([
  'card-scheduled-catalyst-not-direction',
  'card-data-scope-matches-conclusion',
  'card-macro-release-transmission-chain',
  'card-market-reaction-expectations-positioning',
]);

if (artifact.sourceHierarchyRank !== 7) errors.push('source hierarchy rank must be 7');
if (artifact.sourceType !== 'daily-usd-impact-methodology') errors.push('source type must be daily-usd-impact-methodology');
if (artifact.reviewedEditionCount !== 5) errors.push(`expected exactly five reviewed Daily editions, found ${artifact.reviewedEditionCount}`);
if (artifact.totalMethodologyConceptCount !== 5) errors.push('expected exactly five recurring Daily USD Impact methodology concepts');
if (artifact.accountedForCount !== 5) errors.push('all five Daily USD Impact methodology concepts must be accounted for');
if (artifact.promotedCount !== 4) errors.push('expected exactly four promoted Daily USD Impact concepts');
if (artifact.resolvedOverlapCount !== 1) errors.push('expected exactly one Daily USD Impact overlap resolution');
if (artifact.candidateCount !== 0 || artifact.candidates?.length !== 0) errors.push('Tier 7 Daily USD Impact queue must have zero unresolved candidates after editorial closure');
if (!Array.isArray(artifact.reviewedEditionPaths) || artifact.reviewedEditionPaths.length !== 5) errors.push('reviewed edition paths must contain the five bounded evidence editions');

if (resolvedArtifact.totalMethodologyConceptCount !== 5 || resolvedArtifact.accountedForCount !== 5) {
  errors.push('resolved artifact must account for all five Daily methodology concepts');
}
if (resolvedArtifact.promotedCount !== 4 || resolvedArtifact.resolvedOverlapCount !== 1) {
  errors.push('resolved artifact must preserve the 4-promote / 1-overlap editorial decision');
}

const resolutionIds = new Set();
const promotedCardIds = new Set();
for (const resolution of dailyCardDailyNewsResolutions) {
  if (!expectedCandidateIds.has(resolution.candidateId)) errors.push(`${resolution.candidateId}: unexpected Daily USD Impact candidate resolution`);
  if (resolutionIds.has(resolution.candidateId)) errors.push(`${resolution.candidateId}: duplicate Daily USD Impact resolution`);
  resolutionIds.add(resolution.candidateId);
  if (!resolution.reviewedAt) errors.push(`${resolution.candidateId}: reviewedAt is required`);

  if (resolution.disposition === 'promoted') {
    if (!expectedPromotedCardIds.has(resolution.canonicalCardId)) errors.push(`${resolution.candidateId}: unexpected promoted canonical card ${resolution.canonicalCardId}`);
    if (promotedCardIds.has(resolution.canonicalCardId)) errors.push(`${resolution.candidateId}: duplicate promoted canonical card ${resolution.canonicalCardId}`);
    promotedCardIds.add(resolution.canonicalCardId);
    const card = dailyCards.find((item) => item.id === resolution.canonicalCardId);
    if (!card) errors.push(`${resolution.candidateId}: promoted canonical card missing from catalog`);
    else if (card.access !== 'open') errors.push(`${resolution.candidateId}: Daily USD Impact promotion must remain Open`);
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
if (promotedCards.length !== 4) errors.push(`expected exactly four promoted Daily USD Impact cards, found ${promotedCards.length}`);
for (const card of promotedCards) {
  if (card.collectionId !== 'market-application') errors.push(`${card.id}: Daily USD Impact Batch 01 promotion must remain in Market Application`);
  if (card.status !== 'ready-for-build') errors.push(`${card.id}: promoted card must be ready-for-build`);
  if (!card.lastReviewed) errors.push(`${card.id}: lastReviewed is required`);
  if (!Array.isArray(card.sourcePaths) || card.sourcePaths.length < 3) errors.push(`${card.id}: at least three reviewed Daily source paths are required`);
  if (!card.sourcePaths?.every((sourcePath) => /^src\/content\/news\/2026-08-(17|18|19|20|21)\.md$/.test(sourcePath))) errors.push(`${card.id}: source provenance escaped the bounded Daily evidence window`);
  if (!Array.isArray(card.sourceNames) || card.sourceNames.length === 0) errors.push(`${card.id}: source names are required`);
  const evergreenProse = [card.title, card.hook, card.definition, card.whyItMatters, card.example, card.commonMistake, card.keyTakeaway].join(' ');
  if (/2026-\d{2}-\d{2}/.test(evergreenProse)) errors.push(`${card.id}: edition-specific date leaked into evergreen card`);
  if (/\$\s?\d|\b\d+(?:\.\d+)?%\b/.test(evergreenProse)) errors.push(`${card.id}: edition-specific market value leaked into evergreen card`);
}

const oilResolution = dailyCardDailyNewsResolutions.find((resolution) => resolution.candidateId === 'candidate-daily-oil-inventory-mix');
if (oilResolution?.primaryCardId !== 'card-oil-inventories-matter') errors.push('oil inventory candidate must resolve to the existing Why Oil Inventories Matter card');

for (const item of resolvedArtifact.resolutions || []) {
  if (!resolutionIds.has(item.candidateId)) errors.push(`${item.candidateId}: generated resolution is not in the durable registry`);
  if (item.sourceHierarchyRank !== 7 || item.sourceType !== 'daily-usd-impact-methodology') errors.push(`${item.candidateId}: generated resolution lost hierarchy metadata`);
  if (item.sourceEvidenceCount < 3) errors.push(`${item.candidateId}: generated resolution must preserve at least three evidence editions`);
}

if (errors.length) {
  console.error('Daily USD Impact Daily Card editorial contract failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Daily USD Impact Daily Card editorial contract passed: 5/5 methodology concepts accounted for across ${artifact.reviewedEditionCount} published editions; 4 promoted Open cards, 1 overlap resolution, 0 pending.`);
