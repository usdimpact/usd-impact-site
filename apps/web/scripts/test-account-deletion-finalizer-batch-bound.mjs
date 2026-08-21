import assert from 'node:assert/strict';
import {
  readAccountDeletionFinalizerConfig,
  runDueAccountDeletionFinalizer,
} from '../src/lib/account-deletion-finalizer.js';

const baseEnvironment = Object.freeze({
  VERCEL_ENV: 'production',
  ACCOUNT_DELETION_FINALIZER_ENABLED: 'true',
  ACCOUNT_DELETION_FINALIZER_PRODUCTION_APPROVED: 'true',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  EMAIL_READINESS_PRODUCTION_APPROVED: 'true',
  SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
});

const defaultConfig = readAccountDeletionFinalizerConfig(baseEnvironment);
assert.equal(defaultConfig.production, true);
assert.equal(defaultConfig.batchSize, 1);

const configured = readAccountDeletionFinalizerConfig({
  ...baseEnvironment,
  ACCOUNT_DELETION_FINALIZER_BATCH_SIZE: '5',
});
assert.equal(configured.batchSize, 5);

for (const invalid of ['0', '26', 'abc', '1.5', '-1']) {
  assert.throws(
    () => readAccountDeletionFinalizerConfig({
      ...baseEnvironment,
      ACCOUNT_DELETION_FINALIZER_BATCH_SIZE: invalid,
    }),
    (error) => error?.code === 'ACCOUNT_DELETION_BATCH_SIZE_INVALID',
  );
}

function response(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const defaultUrls = [];
await runDueAccountDeletionFinalizer({
  environment: baseEnvironment,
  fetchImpl: async (url, options = {}) => {
    assert.equal(options.method, 'GET');
    defaultUrls.push(String(url));
    return response([]);
  },
});
assert.equal(defaultUrls.some((url) => url.includes('/support_requests?') && url.includes('limit=4')), true);
assert.equal(defaultUrls.some((url) => url.includes('/profiles?') && url.includes('limit=1')), true);

const configuredUrls = [];
await runDueAccountDeletionFinalizer({
  environment: {
    ...baseEnvironment,
    ACCOUNT_DELETION_FINALIZER_BATCH_SIZE: '5',
  },
  fetchImpl: async (url, options = {}) => {
    assert.equal(options.method, 'GET');
    configuredUrls.push(String(url));
    return response([]);
  },
});
assert.equal(configuredUrls.some((url) => url.includes('/support_requests?') && url.includes('limit=20')), true);
assert.equal(configuredUrls.some((url) => url.includes('/profiles?') && url.includes('limit=5')), true);

const previewConfig = readAccountDeletionFinalizerConfig({
  ...baseEnvironment,
  VERCEL_ENV: 'preview',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
});
assert.equal(previewConfig.production, false);
assert.equal(previewConfig.batchSize, 25);

console.log('Account deletion Production batch-bound tests passed.');
