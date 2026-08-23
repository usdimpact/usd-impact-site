import assert from 'node:assert/strict';
import { dailyCardFundingPrimaryBatch01 } from '../src/data/daily-card-funding-primary-batch-01.js';
import { dailyCardFundingDecompositionResolutions } from '../src/data/daily-card-funding-decomposition-resolutions.js';
import { dailyCards } from '../src/data/daily-card-catalog.js';

const expectedIds = new Set([
  'card-repo-haircut-funding-capacity',
  'card-dealer-slr-var-constraints',
  'card-cross-currency-basis-funding-price',
  'card-fima-vs-standing-repo-access',
]);
const allowedSourceHosts = new Set([
  'www.newyorkfed.org',
  'www.federalreserve.gov',
  'www.bis.org',
]);

assert.equal(dailyCardFundingPrimaryBatch01.length, 4, 'Funding primary Batch 01 must remain exactly four reviewed promotions.');
assert.deepEqual(new Set(dailyCardFundingPrimaryBatch01.map((card) => card.id)), expectedIds, 'Funding primary Batch 01 IDs changed unexpectedly.');
assert.equal(dailyCardFundingDecompositionResolutions.length, 4, 'Exactly four decomposition candidates must be resolved by Batch 01.');

const allCardIds = new Set(dailyCards.map((card) => card.id));
const resolutionByCard = new Map(dailyCardFundingDecompositionResolutions.map((resolution) => [resolution.cardId, resolution]));
const ids = new Set();
const slugs = new Set();
const resolutionIds = new Set();

for (const card of dailyCardFundingPrimaryBatch01) {
  assert.equal(ids.has(card.id), false, `${card.id}: duplicate ID.`);
  assert.equal(slugs.has(card.slug), false, `${card.slug}: duplicate slug.`);
  ids.add(card.id);
  slugs.add(card.slug);

  assert.equal(card.collectionId, 'dollar-funding-stack', `${card.id}: must remain in Dollar Funding Stack.`);
  assert.equal(card.access, 'research', `${card.id}: primary Funding cards must remain Research-only.`);
  assert.equal(card.level, 'advanced', `${card.id}: Funding cards must remain advanced.`);
  assert.equal(card.status, 'ready-for-build', `${card.id}: must remain ready-for-build.`);
  assert.equal(card.lastReviewed, '2026-08-23', `${card.id}: review date changed.`);
  assert.equal(Boolean(card.definition && card.whyItMatters && card.keyTakeaway), true, `${card.id}: editorial fields incomplete.`);
  assert.equal(Array.isArray(card.whatToWatch) && card.whatToWatch.length >= 4, true, `${card.id}: whatToWatch must remain substantive.`);
  assert.equal(Array.isArray(card.sourceNames) && card.sourceNames.length >= 1, true, `${card.id}: source names required.`);
  assert.equal(Array.isArray(card.sourceUrls) && card.sourceUrls.length >= 2, true, `${card.id}: at least two primary-source URLs required.`);

  const hosts = new Set(card.sourceUrls.map((value) => {
    const url = new URL(value);
    assert.equal(url.protocol, 'https:', `${card.id}: source URL must use HTTPS.`);
    assert.equal(allowedSourceHosts.has(url.hostname), true, `${card.id}: unapproved primary-source host ${url.hostname}.`);
    return url.hostname;
  }));
  assert.equal(hosts.size >= 1, true, `${card.id}: source host set is empty.`);

  const parent = dailyCards.find((candidate) => candidate.id === card.sourceParentCardId);
  assert.ok(parent, `${card.id}: parent card missing.`);
  assert.equal(parent.collectionId, 'dollar-funding-stack', `${card.id}: parent must remain Funding Stack.`);
  assert.equal(parent.access, 'research', `${card.id}: parent must remain Research-only.`);
  assert.equal(parent.status, 'ready-for-build', `${card.id}: parent must remain ready-for-build.`);
  assert.equal(parent.videoSlug, card.sourceVideoSlug, `${card.id}: source video no longer matches parent.`);

  for (const relatedId of card.relatedCardIds) {
    assert.equal(allCardIds.has(relatedId), true, `${card.id}: related card ${relatedId} does not exist.`);
  }

  const resolution = resolutionByCard.get(card.id);
  assert.ok(resolution, `${card.id}: decomposition resolution missing.`);
  assert.equal(resolution.resolution, 'promoted', `${card.id}: resolution must remain promoted.`);
  assert.equal(resolutionIds.has(resolution.candidateId), false, `${card.id}: duplicate decomposition resolution.`);
  resolutionIds.add(resolution.candidateId);
}

const canonicalFunding = dailyCards.filter((card) => card.collectionId === 'dollar-funding-stack' && card.status === 'ready-for-build');
assert.equal(canonicalFunding.length, 11, `Expected 11 canonical Funding Stack cards after Batch 01, found ${canonicalFunding.length}.`);
assert.equal(canonicalFunding.filter((card) => card.access === 'open').length, 0, 'Funding Stack must remain Research-only after Batch 01.');

console.log('Daily Card Funding primary-source Batch 01: PASS (4 promoted, 11/15 canonical Funding Stack, Research-only).');
