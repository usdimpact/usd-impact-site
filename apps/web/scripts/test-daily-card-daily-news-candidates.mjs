import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { dailyCards } from '../src/data/daily-card-catalog.js';

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
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const errors = [];

const expectedIds = new Set([
  'candidate-daily-catalyst-not-direction',
  'candidate-daily-narrow-data-broad-signal',
  'candidate-daily-transmission-chain',
  'candidate-daily-oil-inventory-mix',
  'candidate-daily-expectations-positioning',
]);

if (artifact.sourceHierarchyRank !== 7) errors.push('source hierarchy rank must be 7');
if (artifact.sourceType !== 'daily-usd-impact-methodology') errors.push('source type must be daily-usd-impact-methodology');
if (artifact.reviewedEditionCount !== 5) errors.push(`expected exactly five reviewed Daily editions, found ${artifact.reviewedEditionCount}`);
if (artifact.candidateCount !== 5 || artifact.candidates?.length !== 5) errors.push('expected exactly five bounded Daily USD Impact methodology candidates');
if (!Array.isArray(artifact.reviewedEditionPaths) || artifact.reviewedEditionPaths.length !== 5) errors.push('reviewed edition paths must contain the five bounded evidence editions');

const ids = new Set();
const titles = new Set();
for (const candidate of artifact.candidates || []) {
  if (!expectedIds.has(candidate.id)) errors.push(`${candidate.id}: unexpected candidate id`);
  if (!candidate.id || ids.has(candidate.id)) errors.push(`duplicate or missing candidate id: ${candidate.id || '(missing)'}`);
  if (!candidate.title || titles.has(candidate.title)) errors.push(`duplicate or missing candidate title: ${candidate.title || '(missing)'}`);
  ids.add(candidate.id);
  titles.add(candidate.title);

  if (candidate.status !== 'review') errors.push(`${candidate.id}: status must remain review`);
  if (candidate.lastReviewed !== null) errors.push(`${candidate.id}: lastReviewed must remain null`);
  if (candidate.suggestedAccess !== 'open') errors.push(`${candidate.id}: Daily USD Impact candidates should remain suggested Open access`);
  if (candidate.sourceHierarchyRank !== 7 || candidate.sourceType !== 'daily-usd-impact-methodology') errors.push(`${candidate.id}: source hierarchy metadata is invalid`);
  if (candidate.sourceEvidenceCount < 3) errors.push(`${candidate.id}: at least three published Daily editions are required`);
  if (!candidate.evergreen) errors.push(`${candidate.id}: candidate must be marked evergreen`);
  if (!['likely-net-new', 'resolve-overlap'].includes(candidate.reviewDisposition)) errors.push(`${candidate.id}: invalid review disposition`);
  if (!Array.isArray(candidate.sourcePaths) || candidate.sourcePaths.length !== candidate.sourceEvidenceCount) errors.push(`${candidate.id}: source paths are incomplete`);
  if (!candidate.sourcePaths?.every((sourcePath) => /^src\/content\/news\/2026-08-(17|18|19|20|21)\.md$/.test(sourcePath))) errors.push(`${candidate.id}: evidence escaped the bounded Daily source window`);
  if (!candidate.candidateDefinition || !candidate.candidateWhyItMatters || !candidate.candidateKeyTakeaway) errors.push(`${candidate.id}: candidate editorial scaffold incomplete`);
  if (dailyCards.some((card) => card.id === candidate.id)) errors.push(`${candidate.id}: review candidate must not be a canonical card`);

  const evergreenProse = [candidate.title, candidate.sourceClaim, candidate.candidateDefinition, candidate.candidateWhyItMatters, candidate.candidateKeyTakeaway].join(' ');
  if (/2026-\d{2}-\d{2}/.test(evergreenProse)) errors.push(`${candidate.id}: edition-specific date leaked into evergreen candidate prose`);
  if (/\$\s?\d|\b\d+(?:\.\d+)?%\b/.test(evergreenProse)) errors.push(`${candidate.id}: edition-specific market value leaked into evergreen candidate prose`);
}

for (const expectedId of expectedIds) {
  if (!ids.has(expectedId)) errors.push(`${expectedId}: expected candidate missing`);
}
if (!(artifact.candidates || []).some((candidate) => candidate.suggestedCollectionId === 'market-application')) errors.push('expected Market Application candidates');
if (!(artifact.candidates || []).some((candidate) => candidate.suggestedCollectionId === 'asset-transmission')) errors.push('expected an Asset Transmission candidate');

if (errors.length) {
  console.error('Daily USD Impact Daily Card candidate contract failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Daily USD Impact Daily Card candidate contract passed: ${artifact.candidateCount} review-only candidates from ${artifact.reviewedEditionCount} published editions.`);
