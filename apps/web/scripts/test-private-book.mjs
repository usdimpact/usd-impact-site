import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  BOOK_DOWNLOAD_PATH,
  BOOK_MEMBER_PATH,
  BOOK_SIGNED_URL_TTL_SECONDS,
  PRIVATE_BOOK_BUCKET,
  PRIVATE_BOOK_PREFIX,
  createSignedBookUrl,
  privateBookDocument,
} from '../src/lib/private-book.js';

const config = {
  url: 'https://project-ref.supabase.co',
  secretKey: 'sb_secret_test_value_that_is_long_enough',
};
const expectedAccessibility = 'This private digital-reader PDF is untagged and is not PDF/UA-conformant. This limitation is accepted for private Library Pass delivery. The PDF must not be represented as PDF/UA-conformant.';

assert.equal(BOOK_MEMBER_PATH, '/guided-edition/book/');
assert.equal(BOOK_DOWNLOAD_PATH, '/guided-edition/book/download/');
assert.equal(PRIVATE_BOOK_BUCKET, 'library-pass-books');
assert.equal(Object.isFrozen(privateBookDocument), true);
assert.equal(privateBookDocument.edition, '1.3');
assert.equal(privateBookDocument.size, 2281645);
assert.equal(privateBookDocument.sha256, 'b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666');
assert.equal(
  privateBookDocument.objectPath,
  `${PRIVATE_BOOK_PREFIX}/USD_Impact_Read_the_Dollar_First_Edition_1.3_v5.95_Phase2C_Scoped_Candidate_2.pdf`,
);
assert.equal(privateBookDocument.accessibility, expectedAccessibility);
assert.doesNotMatch(privateBookDocument.accessibility, /review PDF|private Development proof|publication approval/i);

let signingRequest = null;
const signedUrl = await createSignedBookUrl({
  config,
  fetchImpl: async (url, options) => {
    signingRequest = { url, options };
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          signedURL: `/object/sign/${PRIVATE_BOOK_BUCKET}/${privateBookDocument.objectPath}?token=temporary-token`,
        };
      },
    };
  },
});
assert.equal(
  signingRequest.url,
  `${config.url}/storage/v1/object/sign/${PRIVATE_BOOK_BUCKET}/${privateBookDocument.objectPath}`,
);
assert.equal(signingRequest.options.method, 'POST');
assert.equal(signingRequest.options.cache, 'no-store');
assert.equal(signingRequest.options.headers.apikey, config.secretKey);
assert.equal(signingRequest.options.headers.Authorization, `Bearer ${config.secretKey}`);
assert.deepEqual(JSON.parse(signingRequest.options.body), { expiresIn: BOOK_SIGNED_URL_TTL_SECONDS });
assert.equal(
  signedUrl,
  `${config.url}/storage/v1/object/sign/${PRIVATE_BOOK_BUCKET}/${privateBookDocument.objectPath}?token=temporary-token`,
);

for (const payload of [
  {},
  { signedURL: `/object/sign/${PRIVATE_BOOK_BUCKET}/${privateBookDocument.objectPath}` },
  { signedURL: `/object/sign/wrong-bucket/${privateBookDocument.objectPath}?token=x` },
  { signedURL: `/object/sign/${PRIVATE_BOOK_BUCKET}/book/wrong.pdf?token=x` },
  { signedURL: `https://attacker.invalid/storage/v1/object/sign/${PRIVATE_BOOK_BUCKET}/${privateBookDocument.objectPath}?token=x` },
]) {
  await assert.rejects(
    createSignedBookUrl({
      config,
      fetchImpl: async () => ({ ok: true, status: 200, async json() { return payload; } }),
    }),
    (error) => error.code === 'INVALID_SIGNED_URL',
  );
}

await assert.rejects(
  createSignedBookUrl({
    config,
    fetchImpl: async () => ({ ok: false, status: 404, async json() { return { message: 'not found' }; } }),
  }),
  (error) => error.code === 'BOOK_SIGNING_FAILED' && error.status === 502,
);
for (const expiresIn of [59, 901, 300.5]) {
  await assert.rejects(
    createSignedBookUrl({ config, expiresIn }),
    (error) => error.code === 'INVALID_SIGNED_URL_EXPIRY',
  );
}

const bucketMigration = await readFile(
  new URL('../../../supabase/migrations/20260831002428_create_private_library_pass_book_bucket.sql', import.meta.url),
  'utf8',
);
assert.match(bucketMigration, /'library-pass-books'/);
assert.match(bucketMigration, /public,\s*file_size_limit,\s*allowed_mime_types/s);
assert.match(bucketMigration, /false,\s*10485760,\s*array\['application\/pdf'\]::text\[\]/s);
assert.doesNotMatch(bucketMigration, /library-pass-assets/);
assert.doesNotMatch(bucketMigration, /create\s+policy|to\s+(?:anon|authenticated)/i);

const audiobookMigration = await readFile(
  new URL('../../../supabase/migrations/20260812104532_create_private_audiobook_bucket.sql', import.meta.url),
  'utf8',
);
assert.match(audiobookMigration, /'library-pass-assets'/);
assert.match(audiobookMigration, /array\['audio\/mpeg'\]::text\[\]/);

console.log('Private book manifest, isolated bucket, hash, expiry, accessibility copy, and signed-delivery tests passed.');
