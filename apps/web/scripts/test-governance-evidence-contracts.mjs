import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { videos } from '../src/data/video-library.js';
import { VIDEO_STREAM_UIDS } from '../src/lib/video-stream-map.js';

const read = (path) => readFile(new URL(path, import.meta.url));
const text = async (path) => (await read(path)).toString('utf8');

const [
  migration,
  migrationEvidence,
  privateMediaEvidence,
  videoEvidence,
  followUpEvidence,
] = await Promise.all([
  read('../../../supabase/migrations/20260831002428_create_private_library_pass_book_bucket.sql'),
  text('../../../docs/operations/supabase-private-book-migration-equivalence-2026-09-04.md'),
  text('../../../docs/operations/private-media-authoritative-manifest-2026-09-04.md'),
  text('../../../docs/operations/video-media-reconciliation-2026-09-04.md'),
  text('../../../docs/operations/opt-in-learning-follow-up-spec-2026-09-04.md'),
]);

assert.equal(
  createHash('sha256').update(migration).digest('hex'),
  '69cb0f2a492cce45b9a23f201dd281655d80fc4cb0e1c0728711419148d6dd09',
);
for (const version of ['20260831010828', '20260831003226']) {
  assert.match(migrationEvidence, new RegExp(version));
}
assert.equal(migrationEvidence.match(/a9a95f6e7292a04097151bea9b211ebd/g)?.length, 2);
assert.match(migrationEvidence, /Do not delete, rename, insert, or otherwise rewrite/);

assert.equal(privateMediaEvidence.match(/^\| audiobook \|/gm)?.length, 20);
assert.equal(privateMediaEvidence.match(/^\| book \|/gm)?.length, 1);
assert.match(privateMediaEvidence, /placeholder[\s\S]*excluded/i);
assert.match(privateMediaEvidence, /must not be represented as PDF\/UA-conformant/);

assert.equal(videos.length, 51);
assert.equal(Object.keys(VIDEO_STREAM_UIDS).length, 51);
assert.equal(new Set(Object.values(VIDEO_STREAM_UIDS)).size, 51);
for (const video of videos) assert.ok(VIDEO_STREAM_UIDS[video.slug], `Missing Stream UID for ${video.slug}`);
assert.match(videoEvidence, /43 completed renders/);
assert.match(videoEvidence, /Destructive action: prohibited/i);
assert.match(videoEvidence, /Cloudflare provider inventory[\s\S]*unverified/i);

assert.match(followUpEvidence, /design complete; sending not activated/i);
assert.match(followUpEvidence, /one learning follow-up per entitlement lifetime/i);
assert.match(followUpEvidence, /adds no message-registry entry, environment flag, schedule, provider webhook, or send path/i);

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

for (const [path, expected] of [
  ['../public/assets/logo/USDImpact_Horizontal_Color_NoTagline_256.png', [256, 77]],
  ['../public/assets/logo/USDImpact_Horizontal_Color_NoTagline_512.png', [512, 154]],
  ['../public/assets/logo/USDImpact_Icon_Color_192.png', [192, 192]],
  ['../public/assets/logo/USDImpact_Icon_Color_512.png', [512, 512]],
  ['../public/assets/cover/USD_Impact_Ebook_Cover_ThumbnailFocused_320x480.png', [320, 480]],
  ['../public/assets/cover/USD_Impact_Ebook_Cover_ThumbnailFocused_640x960.png', [640, 960]],
]) {
  assert.deepEqual(pngDimensions(await read(path)), expected, `${path} dimensions changed`);
}

console.log('Governance, media, and responsive-asset evidence contracts passed.');
