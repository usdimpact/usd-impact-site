import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  collections,
  getCollectionVideos,
  libraryMeta,
  videos,
} from '../src/data/video-library.js';
import { STREAM_CUSTOMER_CODE, VIDEO_STREAM_UIDS } from '../api/_video-stream-map.js';

assert.equal(videos.length, 51);
assert.equal(collections.length, 5);
assert.deepEqual(collections.map((collection) => getCollectionVideos(collection.id).length), [3, 6, 13, 22, 7]);
assert.equal(new Set(videos.map((video) => video.slug)).size, 51);
assert.equal(Object.keys(VIDEO_STREAM_UIDS).length, 51);
assert.deepEqual(new Set(Object.keys(VIDEO_STREAM_UIDS)), new Set(videos.map((video) => video.slug)));
assert.equal(new Set(Object.values(VIDEO_STREAM_UIDS)).size, 51);
assert.match(STREAM_CUSTOMER_CODE, /^[a-z0-9]+$/i);
for (const [slug, uid] of Object.entries(VIDEO_STREAM_UIDS)) {
  assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.match(uid, /^[a-f0-9]{32}$/i);
}
const duration = videos.reduce((total, video) => total + video.durationSeconds, 0);
assert.ok(Math.abs(duration - libraryMeta.totalDurationSeconds) < 0.01);
const publicSource = fs.readFileSync(new URL('../src/pages/video-library/index.astro', import.meta.url), 'utf8');
assert.doesNotMatch(publicSource, /[a-f0-9]{32}/i);
assert.doesNotMatch(publicSource, /CLOUDFLARE_STREAM_/);

console.log('Video library catalog and signed-delivery map tests passed.');
