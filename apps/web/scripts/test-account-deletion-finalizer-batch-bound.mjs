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
    const href = String(url);
    assert.equal(options.method, href.includes('/support_requests?') ? 'GET' : 'POST');
    if (options.method === 'POST') {
      assert.equal(href.endsWith('/rest/v1/rpc/list_due_account_deletions_fair'), true);
      assert.equal(JSON.parse(options.body).p_limit, 1);
    }
    defaultUrls.push(href);
    return response([]);
  },
});
assert.equal(defaultUrls.some((url) => url.includes('/support_requests?') && url.includes('limit=4')), true);
assert.equal(defaultUrls.some((url) => url.endsWith('/rest/v1/rpc/list_due_account_deletions_fair')), true);

const configuredUrls = [];
await runDueAccountDeletionFinalizer({
  environment: {
    ...baseEnvironment,
    ACCOUNT_DELETION_FINALIZER_BATCH_SIZE: '5',
  },
  fetchImpl: async (url, options = {}) => {
    const href = String(url);
    assert.equal(options.method, href.includes('/support_requests?') ? 'GET' : 'POST');
    if (options.method === 'POST') {
      assert.equal(href.endsWith('/rest/v1/rpc/list_due_account_deletions_fair'), true);
      assert.equal(JSON.parse(options.body).p_limit, 5);
    }
    configuredUrls.push(href);
    return response([]);
  },
});
assert.equal(configuredUrls.some((url) => url.includes('/support_requests?') && url.includes('limit=20')), true);
assert.equal(configuredUrls.some((url) => url.endsWith('/rest/v1/rpc/list_due_account_deletions_fair')), true);

const previewConfig = readAccountDeletionFinalizerConfig({
  ...baseEnvironment,
  VERCEL_ENV: 'preview',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
});
assert.equal(previewConfig.production, false);
assert.equal(previewConfig.batchSize, 25);

console.log('Account deletion Production batch-bound tests passed.');

// Include the temporary cron diagnostic regressions in the existing CI entrypoint.
await import("./test-cron-authorization-diagnostics.mjs");
