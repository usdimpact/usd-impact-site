import assert from 'node:assert/strict';
import { dailyCardCorePrimaryBatch01 } from '../src/data/daily-card-core-primary-batch-01.js';
import { dailyCards } from '../src/data/daily-card-catalog.js';

const expectedIds = new Set([
  'card-dollar-international-role-multiple-measures',
  'card-fx-currency-shares-total-two-hundred',
  'card-dollar-vehicle-currency-fx',
  'card-dollar-invoicing-beyond-us-trade',
  'card-structural-dollar-use-vs-exchange-rate',
]);
const allowedSourceHosts = new Set([
  'www.federalreserve.gov',
  'www.bis.org',
  'www.imf.org',
]);

assert.equal(dailyCardCorePrimaryBatch01.length, 5, 'Core primary Batch 01 must remain exactly five reviewed promotions.');
assert.deepEqual(new Set(dailyCardCorePrimaryBatch01.map((card) => card.id)), expectedIds, 'Core primary Batch 01 IDs changed unexpectedly.');
assert.equal(dailyCardCorePrimaryBatch01.every((card) => card.access === 'open'), true, 'Core primary Batch 01 must remain Open foundation/intermediate learning content.');

const allCardIds = new Set(dailyCards.map((card) => card.id));
const ids = new Set();
const slugs = new Set();
for (const card of dailyCardCorePrimaryBatch01) {
  assert.equal(ids.has(card.id), false, `${card.id}: duplicate ID.`);
  assert.equal(slugs.has(card.slug), false, `${card.slug}: duplicate slug.`);
  ids.add(card.id);
  slugs.add(card.slug);

  assert.equal(card.collectionId, 'core-framework', `${card.id}: must remain in Core Dollar Framework.`);
  assert.equal(['foundation', 'intermediate'].includes(card.level), true, `${card.id}: unexpected level.`);
  assert.equal(card.status, 'ready-for-build', `${card.id}: must remain ready-for-build.`);
  assert.equal(card.lastReviewed, '2026-08-24', `${card.id}: review date changed.`);
  assert.equal(card.sourceType, 'primary-core-dollar', `${card.id}: source type changed.`);
  assert.equal(Boolean(card.definition && card.whyItMatters && card.keyTakeaway), true, `${card.id}: editorial fields incomplete.`);
  assert.equal(Boolean(card.example && card.commonMistake), true, `${card.id}: example and commonMistake required.`);
  assert.equal(Array.isArray(card.whatToWatch) && card.whatToWatch.length >= 5, true, `${card.id}: whatToWatch must remain substantive.`);
  assert.equal(Array.isArray(card.sourceNames) && card.sourceNames.length >= 1, true, `${card.id}: source names required.`);
  assert.equal(Array.isArray(card.sourceUrls) && card.sourceUrls.length >= 2, true, `${card.id}: at least two primary-source URLs required.`);
  assert.equal(Array.isArray(card.relatedCardIds) && card.relatedCardIds.length >= 3, true, `${card.id}: three related canonical cards required.`);

  for (const sourceUrl of card.sourceUrls) {
    const url = new URL(sourceUrl);
    assert.equal(url.protocol, 'https:', `${card.id}: source URL must use HTTPS.`);
    assert.equal(allowedSourceHosts.has(url.hostname), true, `${card.id}: unapproved primary-source host ${url.hostname}.`);
  }
  for (const relatedId of card.relatedCardIds) {
    assert.equal(allCardIds.has(relatedId), true, `${card.id}: related card ${relatedId} does not exist.`);
  }

  const prose = [card.title, card.hook, card.definition, card.whyItMatters, card.example, card.commonMistake, card.keyTakeaway].join(' ');
  assert.equal(/\b20\d{2}\b/.test(prose), false, `${card.id}: dated statistic leaked into evergreen prose.`);
  assert.equal(/\b\d+(?:\.\d+)?\s*%\b/.test(prose) && card.id !== 'card-fx-currency-shares-total-two-hundred', false, `${card.id}: current percentage leaked into evergreen prose.`);
}

const fxShareCard = dailyCardCorePrimaryBatch01.find((card) => card.id === 'card-fx-currency-shares-total-two-hundred');
assert.ok(fxShareCard.definition.includes('200 percent'), 'FX share card must explain the BIS two-currency counting convention.');
assert.equal(fxShareCard.definition.includes('89.2'), false, 'FX share card must not freeze a current dollar turnover statistic into evergreen prose.');

const canonicalCore = dailyCards.filter((card) => card.collectionId === 'core-framework' && card.status === 'ready-for-build');
assert.equal(canonicalCore.length, 16, `Expected 16 canonical Core Dollar cards after Batch 01, found ${canonicalCore.length}.`);
assert.equal(canonicalCore.filter((card) => card.access === 'open').length, 16, 'All current Core Dollar Framework cards should remain Open.');

console.log('Daily Card Core primary-source Batch 01: PASS (5 promoted; Core Dollar Framework 16/25; all Open).');
