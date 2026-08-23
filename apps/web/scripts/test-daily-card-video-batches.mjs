import assert from 'node:assert/strict';
import { dailyCardVideoBatch01 } from '../src/data/daily-card-video-batch-01.js';
import { dailyCardVideoBatch02 } from '../src/data/daily-card-video-batch-02.js';
import { dailyCardVideoBatch03 } from '../src/data/daily-card-video-batch-03.js';
import { videos } from '../src/data/video-library.js';

const videoBySlug = new Map(videos.map((video) => [video.slug, video]));
const ids = new Set();
const slugs = new Set();
const batches = [dailyCardVideoBatch01, dailyCardVideoBatch02, dailyCardVideoBatch03];

for (const [batchIndex, batch] of batches.entries()) {
  for (const card of batch) {
    assert.equal(ids.has(card.id), false, `${card.id} is duplicated across reviewed-video batches.`);
    assert.equal(slugs.has(card.slug), false, `${card.slug} is duplicated across reviewed-video batches.`);
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
    if (batchIndex >= 1) assert.equal(card.access, 'research', `${card.id} in Batch ${batchIndex + 1} must remain Research-only.`);
  }
}

assert.equal(dailyCardVideoBatch01.length, 10, 'Batch 01 must remain exactly ten reviewed promotions.');
assert.equal(dailyCardVideoBatch02.length, 10, 'Batch 02 must remain exactly ten reviewed promotions.');
assert.equal(dailyCardVideoBatch03.length, 10, 'Batch 03 must remain exactly ten reviewed promotions.');
console.log('Daily Card reviewed-video provenance: PASS (30 promoted cards across three batches).');
