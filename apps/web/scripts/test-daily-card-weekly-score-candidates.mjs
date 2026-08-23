import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { dailyCards } from '../src/data/daily-card-catalog.js';
import { dailyCardWeeklyScoreResolutions } from '../src/data/daily-card-weekly-score-resolutions.js';

const generator = spawnSync(process.execPath, ['scripts/generate-daily-card-weekly-score-candidates.mjs'], {
  cwd: process.cwd(),
  encoding: 'utf8',
});
if (generator.status !== 0) {
  process.stderr.write(generator.stdout || '');
  process.stderr.write(generator.stderr || '');
  process.exit(generator.status || 1);
}

const artifactPath = path.resolve('artifacts/daily-card-weekly-score-candidates/candidates.json');
const resolvedPath = path.resolve('artifacts/daily-card-weekly-score-candidates/resolved.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const resolvedArtifact = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
const errors = [];

const expectedCandidateIds = new Set([
  'candidate-weekly-score-cross-asset-regime',
  'candidate-weekly-score-news-vs-regime',
  'candidate-weekly-score-components-offset',
  'candidate-weekly-score-multiple-horizons',
  'candidate-weekly-score-component-breadth',
]);
const expectedPromotedCardIds = new Set([
  'card-weekly-score-news-vs-regime',
  'card-weekly-score-component-offsets',
  'card-weekly-score-component-breadth',
]);

if (artifact.sourceHierarchyRank !== 6) errors.push('source hierarchy rank must be 6');
if (artifact.sourceType !== 'weekly-score-methodology') errors.push('source type must be weekly-score-methodology');
if (artifact.publishedReportCount < 3) errors.push('at least three published weekly reports are required');
if (artifact.totalMethodologyConceptCount !== 5) errors.push('expected exactly five recurring Weekly Score methodology concepts');
if (artifact.accountedForCount !== 5) errors.push('all five Weekly Score methodology concepts must be accounted for');
if (artifact.promotedCount !== 3) errors.push('expected exactly three promoted Weekly Score methodology concepts');
if (artifact.resolvedOverlapCount !== 2) errors.push('expected exactly two Weekly Score overlap resolutions');
if (artifact.candidateCount !== 0 || artifact.candidates?.length !== 0) errors.push('Tier 6 Weekly Score queue must have zero unresolved candidates after editorial closure');
if (!Array.isArray(artifact.sourcePaths) || artifact.sourcePaths.length !== artifact.publishedReportCount) errors.push('source paths must cover every published report');
if (!Array.isArray(artifact.sourcePeriodEnds) || artifact.sourcePeriodEnds.length !== artifact.publishedReportCount) errors.push('source period ends must cover every published report');

if (resolvedArtifact.totalMethodologyConceptCount !== 5 || resolvedArtifact.accountedForCount !== 5) {
  errors.push('resolved artifact must account for all five methodology concepts');
}
if (resolvedArtifact.promotedCount !== 3 || resolvedArtifact.resolvedOverlapCount !== 2) {
  errors.push('resolved artifact must preserve the 3-promote / 2-overlap editorial decision');
}

const resolutions = dailyCardWeeklyScoreResolutions;
if (resolutions.length !== 5) errors.push(`expected five durable Weekly Score resolutions, found ${resolutions.length}`);
const resolutionIds = new Set();
const promotedCardIds = new Set();
for (const resolution of resolutions) {
  if (!expectedCandidateIds.has(resolution.candidateId)) errors.push(`${resolution.candidateId}: unexpected Weekly Score candidate resolution`);
  if (resolutionIds.has(resolution.candidateId)) errors.push(`${resolution.candidateId}: duplicate Weekly Score resolution`);
  resolutionIds.add(resolution.candidateId);
  if (!resolution.reviewedAt) errors.push(`${resolution.candidateId}: reviewedAt is required`);

  if (resolution.disposition === 'promoted') {
    if (!expectedPromotedCardIds.has(resolution.canonicalCardId)) errors.push(`${resolution.candidateId}: unexpected promoted canonical card ${resolution.canonicalCardId}`);
    if (promotedCardIds.has(resolution.canonicalCardId)) errors.push(`${resolution.candidateId}: duplicate promoted canonical card ${resolution.canonicalCardId}`);
    promotedCardIds.add(resolution.canonicalCardId);
    if (!dailyCards.some((card) => card.id === resolution.canonicalCardId)) errors.push(`${resolution.candidateId}: promoted canonical card missing from catalog`);
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

const weeklyScoreCards = dailyCards.filter((card) => expectedPromotedCardIds.has(card.id));
if (weeklyScoreCards.length !== 3) errors.push(`expected exactly three promoted Weekly Score cards, found ${weeklyScoreCards.length}`);
for (const card of weeklyScoreCards) {
  if (card.access !== 'research') errors.push(`${card.id}: Weekly Score promotion must remain Research-only`);
  if (card.collectionId !== 'market-application') errors.push(`${card.id}: Weekly Score promotion must remain in Market Application`);
  if (card.status !== 'ready-for-build') errors.push(`${card.id}: promoted card must be ready-for-build`);
  if (!card.lastReviewed) errors.push(`${card.id}: lastReviewed is required`);
  if (!Array.isArray(card.sourcePaths) || card.sourcePaths.length < 3) errors.push(`${card.id}: at least three reviewed weekly-report source paths are required`);
  if (card.supportingScorePage !== 'src/pages/score.astro') errors.push(`${card.id}: score page provenance missing`);
  if (!Array.isArray(card.sourceNames) || card.sourceNames.length === 0) errors.push(`${card.id}: source names are required`);
  const editorialProse = [card.title, card.hook, card.definition, card.whyItMatters, card.example, card.commonMistake, card.keyTakeaway].join(' ');
  if (/\b-?\d+\.\d{2,}\b/.test(editorialProse)) errors.push(`${card.id}: week-specific numeric score value leaked into evergreen card`);
  if (/2026-\d{2}-\d{2}/.test(editorialProse)) errors.push(`${card.id}: week-specific date leaked into evergreen card`);
}

for (const item of resolvedArtifact.resolutions || []) {
  if (!resolutionIds.has(item.candidateId)) errors.push(`${item.candidateId}: generated resolution is not in the durable registry`);
  if (item.sourceHierarchyRank !== 6 || item.sourceType !== 'weekly-score-methodology') errors.push(`${item.candidateId}: generated resolution lost hierarchy metadata`);
  if (item.sourceEvidenceCount !== artifact.publishedReportCount) errors.push(`${item.candidateId}: evidence count must equal published report count`);
  if (!Array.isArray(item.sourcePaths) || item.sourcePaths.length !== artifact.publishedReportCount) errors.push(`${item.candidateId}: generated resolution source paths are incomplete`);
}

if (errors.length) {
  console.error('Weekly Score Daily Card editorial contract failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Weekly Score Daily Card editorial contract passed: 5/5 methodology concepts accounted for across ${artifact.publishedReportCount} published reports; 3 promoted Research cards, 2 overlap resolutions, 0 pending.`);
