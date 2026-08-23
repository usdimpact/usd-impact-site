import assert from 'node:assert/strict';
import { dailyCardRatesPrimaryBatch01 } from '../src/data/daily-card-rates-primary-batch-01.js';
import { dailyCards } from '../src/data/daily-card-catalog.js';

const expectedIds = new Set([
  'card-fed-target-range-vs-effr',
  'card-iorb-administered-rate',
  'card-on-rrp-floor-nonbank-cash',
  'card-sofr-vs-effr-secured-unsecured',
  'card-treasury-price-yield-inverse',
  'card-treasury-coupon-vs-yield',
  'card-treasury-maturity-rate-sensitivity',
  'card-tips-principal-inflation-adjustment',
]);

const allowedSourceHosts = new Set([
  'www.federalreserve.gov',
  'www.newyorkfed.org',
  'www.treasurydirect.gov',
  'www.investor.gov',
]);

assert.equal(dailyCardRatesPrimaryBatch01.length, 8, 'Rates primary Batch 01 must remain exactly eight reviewed promotions.');
assert.deepEqual(new Set(dailyCardRatesPrimaryBatch01.map((card) => card.id)), expectedIds, 'Rates primary Batch 01 IDs changed unexpectedly.');
assert.equal(dailyCardRatesPrimaryBatch01.filter((card) => card.access === 'open').length, 4, 'Rates primary Batch 01 must keep four foundation cards Open.');
assert.equal(dailyCardRatesPrimaryBatch01.filter((card) => card.access === 'research').length, 4, 'Rates primary Batch 01 must keep four implementation cards Research-only.');

const allCardIds = new Set(dailyCards.map((card) => card.id));
const ids = new Set();
const slugs = new Set();

for (const card of dailyCardRatesPrimaryBatch01) {
  assert.equal(ids.has(card.id), false, `${card.id}: duplicate ID.`);
  assert.equal(slugs.has(card.slug), false, `${card.slug}: duplicate slug.`);
  ids.add(card.id);
  slugs.add(card.slug);

  assert.equal(card.collectionId, 'rates-liquidity-policy', `${card.id}: must remain in Rates, Liquidity & Policy.`);
  assert.equal(['open', 'research'].includes(card.access), true, `${card.id}: invalid access tier.`);
  assert.equal(['foundation', 'intermediate', 'advanced'].includes(card.level), true, `${card.id}: invalid level.`);
  assert.equal(card.status, 'ready-for-build', `${card.id}: must remain ready-for-build.`);
  assert.equal(card.lastReviewed, '2026-08-24', `${card.id}: review date changed.`);
  assert.equal(card.sourceType, 'primary-rates-liquidity', `${card.id}: source type changed.`);
  assert.equal(Boolean(card.definition && card.whyItMatters && card.keyTakeaway), true, `${card.id}: editorial fields incomplete.`);
  assert.equal(Boolean(card.example && card.commonMistake), true, `${card.id}: example and commonMistake required.`);
  assert.equal(Array.isArray(card.whatToWatch) && card.whatToWatch.length >= 5, true, `${card.id}: whatToWatch must remain substantive.`);
  assert.equal(Array.isArray(card.sourceNames) && card.sourceNames.length >= 1, true, `${card.id}: source names required.`);
  assert.equal(Array.isArray(card.sourceUrls) && card.sourceUrls.length >= 2, true, `${card.id}: at least two primary-source URLs required.`);
  assert.equal(Array.isArray(card.relatedCardIds) && card.relatedCardIds.length >= 2, true, `${card.id}: related cards required.`);

  for (const sourceUrl of card.sourceUrls) {
    const url = new URL(sourceUrl);
    assert.equal(url.protocol, 'https:', `${card.id}: source URL must use HTTPS.`);
    assert.equal(allowedSourceHosts.has(url.hostname), true, `${card.id}: unapproved primary-source host ${url.hostname}.`);
  }

  for (const relatedId of card.relatedCardIds) {
    assert.equal(allCardIds.has(relatedId), true, `${card.id}: related card ${relatedId} does not exist.`);
  }
}

const canonicalRates = dailyCards.filter((card) => card.collectionId === 'rates-liquidity-policy' && card.status === 'ready-for-build');
assert.equal(canonicalRates.length, 26, `Expected 26 canonical Rates/Liquidity cards after Batch 01, found ${canonicalRates.length}.`);
assert.equal(canonicalRates.filter((card) => card.access === 'open').length >= 9, true, 'Rates/Liquidity should retain its existing Open foundation plus four new Open primary cards.');

console.log('Daily Card Rates primary-source Batch 01: PASS (8 promoted, 26/35 canonical Rates/Liquidity; 4 Open + 4 Research).');
