import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  WEEKLY_SCORE_DOWNLOAD_NAME,
  downloadWeeklyScoreMemberPackage,
} from '../src/lib/private-paid-assets.js';

const config = Object.freeze({
  url: 'https://example.supabase.co',
  publishableKey: 'sb_publishable_test_value_that_is_long_enough',
  secretKey: 'sb_secret_test_value_that_is_long_enough',
});
const bytes = Buffer.from('frozen-private-member-package');
const expectedSha256 = createHash('sha256').update(bytes).digest('hex');

const downloaded = await downloadWeeklyScoreMemberPackage({
  config,
  expectedSha256,
  fetchImpl: async (url, options) => {
    assert.equal(
      url,
      `https://example.supabase.co/storage/v1/object/authenticated/paid-member-assets/weekly-score/v1.1/${WEEKLY_SCORE_DOWNLOAD_NAME}`,
    );
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.apikey, config.secretKey);
    assert.equal(options.headers.Authorization, `Bearer ${config.secretKey}`);
    assert.equal(options.cache, 'no-store');
    return new Response(bytes, {
      status: 200,
      headers: { 'Content-Type': 'application/zip', 'Content-Length': String(bytes.length) },
    });
  },
});
assert.deepEqual(downloaded.bytes, bytes);
assert.equal(downloaded.sha256, expectedSha256);
assert.equal(downloaded.size, bytes.length);

await assert.rejects(
  () => downloadWeeklyScoreMemberPackage({
    config,
    expectedSha256: '0'.repeat(64),
    fetchImpl: async () => new Response(bytes, { status: 200 }),
  }),
  (error) => error?.code === 'PRIVATE_PAID_ASSET_INTEGRITY_FAILED',
);

await assert.rejects(
  () => downloadWeeklyScoreMemberPackage({
    config,
    expectedSha256,
    fetchImpl: async () => new Response('missing', { status: 404 }),
  }),
  (error) => error?.code === 'PRIVATE_PAID_ASSET_NOT_READY' && error?.status === 503,
);

await assert.rejects(
  () => downloadWeeklyScoreMemberPackage({
    config,
    expectedSha256,
    fetchImpl: async () => new Response(bytes, {
      status: 200,
      headers: { 'Content-Length': String(11 * 1024 * 1024) },
    }),
  }),
  (error) => error?.code === 'PRIVATE_PAID_ASSET_TOO_LARGE',
);

console.log('Private paid-asset tests passed.');
