import assert from 'node:assert/strict';
import { dailyCardVideoBatch01 } from '../src/data/daily-card-video-batch-01.js';
import { videos } from '../src/data/video-library.js';

const videoBySlug = new Map(videos.map((video) => [video.slug, video]));
const ids = new Set();
const slugs = new Set();

for (const card of dailyCardVideoBatch01) {
  assert.equal(ids.has(card.id), false, `${card.id} is duplicated inside batch 01.`);
  assert.equal(slugs.has(card.slug), false, `${card.slug} is duplicated inside batch 01.`);
  ids.add(card.id);
  slugs.add(card.slug);

  const video = videoBySlug.get(card.videoSlug);
  assert.ok(video, `${card.id} references unknown reviewed video ${card.videoSlug}.`);
  assert.equal(card.collectionId, video.collectionId, `${card.id} changed the reviewed video collection.`);
  assert.deepEqual(card.sourceNames, video.sources || [], `${card.id} sourceNames must match reviewed video provenance exactly.`);
  assert.equal(card.status, 'ready-for-build');
  assert.equal(card.lastReviewed, '2026-08-23');
  assert.equal(Boolean(card.definition), true);
  assert.equal(Boolean(card.whyItMatters), true);
  assert.equal(Boolean(card.keyTakeaway), true);
  assert.equal(Array.isArray(card.whatToWatch) && card.whatToWatch.length > 0, true);
}

assert.equal(dailyCardVideoBatch01.length, 10, 'Batch 01 must remain exactly ten reviewed promotions.');
console.log('Daily Card reviewed-video batch 01 provenance: PASS (10 cards).');
