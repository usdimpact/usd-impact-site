import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readTheDollarFirstAudiobook } from '../src/data/read-the-dollar-first-audiobook.js';
import {
  AUDIOBOOK_SIGNED_URL_TTL_SECONDS,
  AUDIOBOOK_TRACK_PATH_PREFIX,
  PRIVATE_AUDIOBOOK_BUCKET,
  PRIVATE_AUDIOBOOK_PREFIX,
  createSignedAudiobookTrackUrl,
  getPrivateAudiobookTrack,
  privateAudiobookTrackHref,
  privateAudiobookTracks,
} from '../src/lib/private-audiobook.js';

const config = {
  url: 'https://project-ref.supabase.co',
  secretKey: 'sb_secret_test_value_that_is_long_enough',
};
const firstTrack = privateAudiobookTracks[0];

assert.equal(Object.isFrozen(readTheDollarFirstAudiobook), true);
assert.equal(Object.isFrozen(readTheDollarFirstAudiobook.chapters), true);
assert.equal(readTheDollarFirstAudiobook.chapters.length, 20);
for (const publicTrack of readTheDollarFirstAudiobook.chapters) {
  assert.deepEqual(Object.keys(publicTrack), ['index', 'title', 'slug', 'duration']);
}
assert.equal(privateAudiobookTracks.length, 20);
assert.equal(Object.isFrozen(privateAudiobookTracks), true);
assert.equal(Object.isFrozen(firstTrack), true);
assert.equal(firstTrack.size, 2128764);
assert.equal(firstTrack.sha256, '946012ea5010c48be184b0d358741ec7926a844bb42960398443aac9dc4ddb91');
assert.equal(firstTrack.objectPath, `${PRIVATE_AUDIOBOOK_PREFIX}/00-read-the-dollar-first.mp3`);
for (const privateTrack of privateAudiobookTracks) {
  assert.match(privateTrack.file, /^\d{2}-[a-z0-9-]+\.mp3$/);
  assert.ok(Number.isInteger(privateTrack.size) && privateTrack.size > 0);
  assert.match(privateTrack.sha256, /^[a-f0-9]{64}$/);
}
assert.equal(getPrivateAudiobookTrack('READ-THE-DOLLAR-FIRST'), firstTrack);
assert.equal(getPrivateAudiobookTrack('../read-the-dollar-first'), null);
assert.equal(getPrivateAudiobookTrack('missing'), null);
assert.equal(privateAudiobookTrackHref(firstTrack), `${AUDIOBOOK_TRACK_PATH_PREFIX}read-the-dollar-first/`);
assert.throws(() => privateAudiobookTrackHref({ ...firstTrack }), (error) => error.code === 'INVALID_AUDIOBOOK_TRACK');

let signingRequest = null;
const signedUrl = await createSignedAudiobookTrackUrl({
  slug: firstTrack.slug,
  config,
  fetchImpl: async (url, options) => {
    signingRequest = { url, options };
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          signedURL: `/object/sign/${PRIVATE_AUDIOBOOK_BUCKET}/${firstTrack.objectPath}?token=temporary-token`,
        };
      },
    };
  },
});
assert.equal(
  signingRequest.url,
  `${config.url}/storage/v1/object/sign/${PRIVATE_AUDIOBOOK_BUCKET}/${firstTrack.objectPath}`,
);
assert.equal(signingRequest.options.method, 'POST');
assert.equal(signingRequest.options.cache, 'no-store');
assert.equal(signingRequest.options.headers.apikey, config.secretKey);
assert.equal(signingRequest.options.headers.Authorization, `Bearer ${config.secretKey}`);
assert.deepEqual(JSON.parse(signingRequest.options.body), { expiresIn: AUDIOBOOK_SIGNED_URL_TTL_SECONDS });
assert.equal(
  signedUrl,
  `${config.url}/storage/v1/object/sign/${PRIVATE_AUDIOBOOK_BUCKET}/${firstTrack.objectPath}?token=temporary-token`,
);

for (const payload of [
  {},
  { signedURL: `/object/sign/${PRIVATE_AUDIOBOOK_BUCKET}/${firstTrack.objectPath}` },
  { signedURL: `/object/sign/wrong-bucket/${firstTrack.objectPath}?token=x` },
  { signedURL: `https://attacker.invalid/storage/v1/object/sign/${PRIVATE_AUDIOBOOK_BUCKET}/${firstTrack.objectPath}?token=x` },
]) {
  await assert.rejects(
    createSignedAudiobookTrackUrl({
      slug: firstTrack.slug,
      config,
      fetchImpl: async () => ({ ok: true, status: 200, async json() { return payload; } }),
    }),
    (error) => error.code === 'INVALID_SIGNED_URL',
  );
}

await assert.rejects(
  createSignedAudiobookTrackUrl({
    slug: firstTrack.slug,
    config,
    fetchImpl: async () => ({ ok: false, status: 404, async json() { return { message: 'not found' }; } }),
  }),
  (error) => error.code === 'AUDIOBOOK_SIGNING_FAILED' && error.status === 502,
);
await assert.rejects(
  createSignedAudiobookTrackUrl({ slug: firstTrack.slug, config, expiresIn: 30 }),
  (error) => error.code === 'INVALID_SIGNED_URL_EXPIRY',
);
await assert.rejects(
  createSignedAudiobookTrackUrl({ slug: 'missing', config }),
  (error) => error.code === 'INVALID_AUDIOBOOK_TRACK' && error.status === 404,
);

const bucketMigration = await readFile(
  new URL('../../../supabase/migrations/20260812104532_create_private_audiobook_bucket.sql', import.meta.url),
  'utf8',
);
assert.match(bucketMigration, /'library-pass-assets'/);
assert.match(bucketMigration, /public,\s*file_size_limit,\s*allowed_mime_types/s);
assert.match(bucketMigration, /false,\s*41943040,\s*array\['audio\/mpeg'\]::text\[\]/s);
assert.doesNotMatch(bucketMigration, /create\s+policy|to\s+(?:anon|authenticated)/i);

console.log('Private audiobook manifest and signed-delivery tests passed.');
