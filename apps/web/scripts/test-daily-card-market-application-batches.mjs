import assert from 'node:assert/strict';
import { dailyCardMarketApplicationBatch01 } from '../src/data/daily-card-market-application-batch-01.js';
import { dailyCards } from '../src/data/daily-card-catalog.js';

const expectedIds = new Set([
  'card-dollar-breadth-signal-matrix',
  'card-regime-benchmark-selection',
]);
const allowedSourceHosts = new Set([
  'www.federalreserve.gov',
  'home.treasury.gov',
  'www.chicagofed.org',
  'www.bis.org',
]);

assert.equal(dailyCardMarketApplicationBatch01.length, 2, 'Market Application Batch 01 must remain exactly two reviewed cards.');
assert.deepEqual(new Set(dailyCardMarketApplicationBatch01.map((card) => card.id)), expectedIds, 'Market Application Batch 01 IDs changed unexpectedly.');

const allCardIds = new Set(dailyCards.map((card) => card.id));
const ids = new Set();
const slugs = new Set();

for (const card of dailyCardMarketApplicationBatch01) {
  assert.equal(ids.has(card.id), false, `${card.id}: duplicate ID.`);
  assert.equal(slugs.has(card.slug), false, `${card.slug}: duplicate slug.`);
  ids.add(card.id);
  slugs.add(card.slug);

  assert.equal(card.collectionId, 'market-application', `${card.id}: must remain in Market Application.`);
  assert.equal(card.access, 'open', `${card.id}: reviewed Market Application Batch 01 must remain Open.`);
  assert.equal(card.status, 'ready-for-build', `${card.id}: must remain ready-for-build.`);
  assert.equal(card.lastReviewed, '2026-08-24', `${card.id}: review date changed.`);
  assert.equal(card.sourcePath, 'src/content/pages/how-to-read-the-dollar.md', `${card.id}: source path changed.`);
  assert.equal(card.sourcePageSlug, '/regime/how-to-read-the-dollar', `${card.id}: source page changed.`);
  assert.equal(Boolean(card.sourceHeading), true, `${card.id}: exact source heading is required.`);
  assert.equal(Boolean(card.definition && card.whyItMatters && card.keyTakeaway), true, `${card.id}: editorial fields incomplete.`);
  assert.equal(Array.isArray(card.whatToWatch) && card.whatToWatch.length >= 5, true, `${card.id}: whatToWatch must remain substantive.`);
  assert.equal(Array.isArray(card.sourceNames) && card.sourceNames.length >= 3, true, `${card.id}: source names are incomplete.`);
  assert.equal(Array.isArray(card.sourceUrls) && card.sourceUrls.length >= 2, true, `${card.id}: at least two primary-source URLs are required.`);

  for (const value of card.sourceUrls) {
    const url = new URL(value);
    assert.equal(url.protocol, 'https:', `${card.id}: source URL must use HTTPS.`);
    assert.equal(allowedSourceHosts.has(url.hostname), true, `${card.id}: unapproved primary-source host ${url.hostname}.`);
  }

  for (const relatedId of card.relatedCardIds) {
    assert.equal(allCardIds.has(relatedId), true, `${card.id}: related card ${relatedId} does not exist.`);
  }
}

assert.equal(dailyCardMarketApplicationBatch01[0].sourceHeading, 'Signal matrix learning block');
assert.equal(dailyCardMarketApplicationBatch01[1].sourceHeading, 'Layer 1: define the benchmark');

const canonicalMarketApplication = dailyCards.filter((card) => card.collectionId === 'market-application' && card.status === 'ready-for-build');
assert.equal(canonicalMarketApplication.length, 15, `Expected Market Application to remain complete at 15/15, found ${canonicalMarketApplication.length}.`);

console.log('Daily Card Market Application Batch 01: PASS (2 promoted; Market Application remains complete at 15/15).');
