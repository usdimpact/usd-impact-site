import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { dailyCards } from '../src/data/daily-card-catalog.js';

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
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const errors = [];

if (artifact.sourceHierarchyRank !== 6) errors.push('source hierarchy rank must be 6');
if (artifact.sourceType !== 'weekly-score-methodology') errors.push('source type must be weekly-score-methodology');
if (artifact.publishedReportCount < 3) errors.push('at least three published weekly reports are required');
if (artifact.candidateCount !== 5 || artifact.candidates?.length !== 5) errors.push('expected exactly five bounded methodology candidates');
if (!Array.isArray(artifact.sourcePaths) || artifact.sourcePaths.length !== artifact.publishedReportCount) errors.push('source paths must cover every published report');
if (!Array.isArray(artifact.sourcePeriodEnds) || artifact.sourcePeriodEnds.length !== artifact.publishedReportCount) errors.push('source period ends must cover every published report');

const ids = new Set();
const titles = new Set();
for (const candidate of artifact.candidates || []) {
  if (!candidate.id || ids.has(candidate.id)) errors.push(`duplicate or missing candidate id: ${candidate.id || '(missing)'}`);
  if (!candidate.title || titles.has(candidate.title)) errors.push(`duplicate or missing candidate title: ${candidate.title || '(missing)'}`);
  ids.add(candidate.id);
  titles.add(candidate.title);
  if (candidate.status !== 'review') errors.push(`${candidate.id}: status must remain review`);
  if (candidate.lastReviewed !== null) errors.push(`${candidate.id}: lastReviewed must remain null`);
  if (candidate.suggestedAccess !== 'research') errors.push(`${candidate.id}: Weekly Score candidates must remain Research-only`);
  if (candidate.sourceHierarchyRank !== 6 || candidate.sourceType !== 'weekly-score-methodology') errors.push(`${candidate.id}: source hierarchy metadata is invalid`);
  if (candidate.sourceEvidenceCount !== artifact.publishedReportCount) errors.push(`${candidate.id}: evidence count must equal published report count`);
  if (!candidate.evergreen) errors.push(`${candidate.id}: candidate must be marked evergreen`);
  if (!['likely-net-new', 'resolve-overlap'].includes(candidate.reviewDisposition)) errors.push(`${candidate.id}: invalid review disposition`);
  if (!Array.isArray(candidate.sourcePaths) || candidate.sourcePaths.length !== artifact.publishedReportCount) errors.push(`${candidate.id}: source paths are incomplete`);
  if (!candidate.supportingScorePage?.endsWith('src/pages/score.astro')) errors.push(`${candidate.id}: score page provenance missing`);
  if (!candidate.candidateDefinition || !candidate.candidateWhyItMatters || !candidate.candidateKeyTakeaway) errors.push(`${candidate.id}: candidate editorial scaffold incomplete`);
  const prose = JSON.stringify(candidate);
  if (/\b-?\d+\.\d{2,}\b/.test(prose)) errors.push(`${candidate.id}: week-specific numeric score value leaked into evergreen candidate`);
  if (/2026-\d{2}-\d{2}/.test(candidate.sourceClaim || '')) errors.push(`${candidate.id}: week-specific date leaked into source claim`);
  if (dailyCards.some((card) => card.id === candidate.id)) errors.push(`${candidate.id}: review candidate must not be a canonical card`);
}

const expectedCollections = new Set(['core-framework', 'market-application']);
for (const collectionId of expectedCollections) {
  if (!(artifact.candidates || []).some((candidate) => candidate.suggestedCollectionId === collectionId)) {
    errors.push(`expected at least one ${collectionId} Weekly Score candidate`);
  }
}

if (errors.length) {
  console.error('Weekly Score Daily Card candidate contract failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Weekly Score Daily Card candidate contract passed: ${artifact.candidateCount} review-only candidates across ${artifact.publishedReportCount} published reports.`);
