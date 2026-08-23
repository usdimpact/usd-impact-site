import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { dailyCards } from '../src/data/daily-card-catalog.js';

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
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const errors = [];

const expectedCandidateIds = new Set([
  'candidate-catalyst-primary-source-timing',
  'candidate-catalyst-preview-outcome-separation',
  'candidate-catalyst-component-breadth',
  'candidate-catalyst-rates-transmission-check',
]);

if (artifact.sourceHierarchyRank !== 8) errors.push('source hierarchy rank must be 8');
if (artifact.sourceType !== 'catalyst-brief-methodology') errors.push('source type must be catalyst-brief-methodology');
if (artifact.publishedBriefCount < 1) errors.push('at least one published Catalyst Brief is required');
if (!Array.isArray(artifact.publishedBriefPaths) || artifact.publishedBriefPaths.length !== artifact.publishedBriefCount) errors.push('published Catalyst Brief paths are incomplete');
if (artifact.candidateCount !== 4 || artifact.candidates?.length !== 4) errors.push('expected exactly four conservative Tier 8 methodology candidates');
if (artifact.likelyNetNewCount + artifact.overlapCount !== 4) errors.push('every candidate must be classified as likely-net-new or resolve-overlap');

const canonicalIds = new Set(dailyCards.map((card) => card.id));
const seenIds = new Set();
for (const candidate of artifact.candidates || []) {
  if (!expectedCandidateIds.has(candidate.id)) errors.push(`${candidate.id}: unexpected Catalyst Brief candidate`);
  if (seenIds.has(candidate.id)) errors.push(`${candidate.id}: duplicate candidate id`);
  seenIds.add(candidate.id);
  if (canonicalIds.has(candidate.id)) errors.push(`${candidate.id}: candidate id already exists in canonical catalog`);
  if (candidate.status !== 'review') errors.push(`${candidate.id}: machine-derived candidate must remain review-only`);
  if (candidate.lastReviewed !== null) errors.push(`${candidate.id}: lastReviewed must remain null before editorial review`);
  if (candidate.sourceHierarchyRank !== 8) errors.push(`${candidate.id}: hierarchy rank must remain 8`);
  if (candidate.sourceType !== 'catalyst-brief-methodology') errors.push(`${candidate.id}: source type changed`);
  if (candidate.suggestedAccess !== 'open') errors.push(`${candidate.id}: public Catalyst Brief source should suggest Open access`);
  if (!['market-application', 'rates-liquidity-policy'].includes(candidate.suggestedCollectionId)) errors.push(`${candidate.id}: unexpected collection ${candidate.suggestedCollectionId}`);
  if (!Array.isArray(candidate.sourcePaths) || candidate.sourcePaths.length !== 1 || !candidate.sourcePaths[0].startsWith('src/content/catalyst-briefs/')) errors.push(`${candidate.id}: exact Catalyst Brief source path is required`);
  if (!Array.isArray(candidate.sourceEventKeys) || candidate.sourceEventKeys.length !== 1) errors.push(`${candidate.id}: source event key is required`);
  if (!Array.isArray(candidate.sourcePhases) || candidate.sourcePhases.length !== 1 || candidate.sourcePhases[0] !== 'preview') errors.push(`${candidate.id}: source phase must be preview`);
  if (!Array.isArray(candidate.sourceLastReviewed) || candidate.sourceLastReviewed.length !== 1) errors.push(`${candidate.id}: source review date is required as provenance`);
  if (!Array.isArray(candidate.sourceNames) || candidate.sourceNames.length < 2) errors.push(`${candidate.id}: primary source publisher names are required`);
  if (candidate.sourceEvidenceCount !== 1) errors.push(`${candidate.id}: current Tier 8 evidence count must be one published preview brief`);
  if (!['likely-net-new', 'resolve-overlap'].includes(candidate.reviewDisposition)) errors.push(`${candidate.id}: invalid review disposition`);
  if (candidate.reviewDisposition === 'resolve-overlap' && (!Array.isArray(candidate.potentialOverlapCardIds) || candidate.potentialOverlapCardIds.length === 0)) errors.push(`${candidate.id}: overlap disposition requires canonical overlap ids`);

  const editorialProse = [
    candidate.title,
    candidate.sourceClaim,
    candidate.candidateDefinition,
    candidate.candidateWhyItMatters,
    candidate.candidateKeyTakeaway,
  ].join(' ');
  if (/\b20\d{2}-\d{2}-\d{2}\b/.test(editorialProse)) errors.push(`${candidate.id}: event date leaked into evergreen candidate prose`);
  if (/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}\b/i.test(editorialProse)) errors.push(`${candidate.id}: calendar date leaked into evergreen candidate prose`);
  if (/\b\d{1,2}:\d{2}\b/.test(editorialProse)) errors.push(`${candidate.id}: event time leaked into evergreen candidate prose`);
  if (/\b\d+(?:\.\d+)?\s*%/.test(editorialProse)) errors.push(`${candidate.id}: event-specific percentage leaked into evergreen candidate prose`);
  if (/stronger-than-expected|softer-than-expected|hotter-than-expected|cooler-than-expected/i.test(editorialProse)) errors.push(`${candidate.id}: directional event scenario leaked into evergreen candidate prose`);
}

for (const candidateId of expectedCandidateIds) {
  if (!seenIds.has(candidateId)) errors.push(`${candidateId}: missing expected Catalyst Brief candidate`);
}

if (errors.length) {
  console.error('Catalyst Brief Daily Card Tier 8 contract failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Catalyst Brief Daily Card Tier 8 contract passed: ${artifact.candidateCount} review-only evergreen methodology candidates; no event-specific publication content promoted.`);
