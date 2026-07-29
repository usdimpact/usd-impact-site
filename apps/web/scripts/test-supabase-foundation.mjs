import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SupabaseConfigurationError,
  SupabaseRequestError,
  exportOwnAccount,
  getVerifiedSupabaseUser,
  readAccountAccessState,
  readBearerToken,
  readSupabaseServerConfig,
  requestOwnAccountDeletion,
} from '../src/lib/supabase-server.js';

const accountId = '46d8a4a1-e616-4d9d-8faf-d877a42af310';
const entitlementId = 'aa921ce7-11ce-41d0-92e1-57960d91e20d';
const accessToken = 'eyJhbGciOiJIUzI1NiJ9.test-access-token-that-is-long-enough.signature';
const config = Object.freeze({
  url: 'https://development.supabase.co',
  publishableKey: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  secretKey: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
});

function response(status, body) {
  return new Response(body == null ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function verifiedUser() {
  return {
    id: accountId,
    email: 'Reader@Example.com',
    email_confirmed_at: '2026-07-29T20:00:00.000Z',
  };
}

assert.deepEqual(
  readSupabaseServerConfig({
    SUPABASE_URL: 'https://development.supabase.co/path',
    SUPABASE_PUBLISHABLE_KEY: config.publishableKey,
    SUPABASE_SECRET_KEY: config.secretKey,
  }),
  config,
);
assert.throws(
  () => readSupabaseServerConfig({}),
  (error) => error instanceof SupabaseConfigurationError,
);

assert.equal(readBearerToken({ headers: { authorization: `Bearer ${accessToken}` } }), accessToken);
assert.equal(readBearerToken({ headers: { authorization: 'Basic abc' } }), null);
assert.equal(readBearerToken({ headers: {} }), null);

const verified = await getVerifiedSupabaseUser(accessToken, {
  config,
  fetchImpl: async (url, options) => {
    assert.equal(url, `${config.url}/auth/v1/user`);
    assert.equal(options.headers.apikey, config.publishableKey);
    assert.equal(options.headers.Authorization, `Bearer ${accessToken}`);
    return response(200, verifiedUser());
  },
});
assert.equal(verified.id, accountId);
assert.equal(verified.email, 'reader@example.com');

await assert.rejects(
  () => getVerifiedSupabaseUser(accessToken, {
    config,
    fetchImpl: async () => response(200, {
      id: accountId,
      email: 'reader@example.com',
      email_confirmed_at: null,
    }),
  }),
  (error) => error instanceof SupabaseRequestError && error.code === 'VERIFIED_ACCOUNT_REQUIRED',
);

const calls = [];
const activeState = await readAccountAccessState({
  accessToken,
  config,
  nowMs: Date.parse('2026-07-29T20:30:00.000Z'),
  fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/auth/v1/user')) return response(200, verifiedUser());
    if (url.includes('/rest/v1/profiles?')) {
      assert.equal(options.headers.apikey, config.secretKey);
      return response(200, [{
        account_id: accountId,
        email: 'reader@example.com',
        status: 'active',
        deletion_requested_at: null,
        deletion_due_at: null,
        deleted_at: null,
        created_at: '2026-07-29T20:00:00.000Z',
        updated_at: '2026-07-29T20:00:00.000Z',
      }]);
    }
    if (url.includes('/rest/v1/entitlements?')) {
      assert.equal(options.headers.apikey, config.secretKey);
      return response(200, [{
        id: entitlementId,
        account_id: accountId,
        product_id: 'read-the-dollar-first-guided-interactive-edition',
        state: 'active',
        starts_at: '2026-07-29T20:00:00.000Z',
        ends_at: null,
        version: 1,
        updated_at: '2026-07-29T20:00:00.000Z',
      }]);
    }
    throw new Error(`Unexpected URL: ${url}`);
  },
});
assert.equal(activeState.allowed, true);
assert.equal(activeState.reason, 'active');
assert.equal(calls.length, 3);

const suspendedState = await readAccountAccessState({
  accessToken,
  config,
  fetchImpl: async (url) => {
    if (url.endsWith('/auth/v1/user')) return response(200, verifiedUser());
    if (url.includes('/rest/v1/profiles?')) return response(200, [{ account_id: accountId, status: 'suspended' }]);
    if (url.includes('/rest/v1/entitlements?')) return response(200, []);
    throw new Error(`Unexpected URL: ${url}`);
  },
});
assert.equal(suspendedState.allowed, false);
assert.equal(suspendedState.reason, 'suspended');

const exported = await exportOwnAccount({
  accessToken,
  config,
  fetchImpl: async (url, options) => {
    if (url.endsWith('/auth/v1/user')) return response(200, verifiedUser());
    assert.equal(url, `${config.url}/rest/v1/rpc/account_export`);
    assert.equal(options.headers.apikey, config.publishableKey);
    assert.equal(options.headers.Authorization, `Bearer ${accessToken}`);
    assert.deepEqual(JSON.parse(options.body), { export_account_id: accountId });
    return response(200, { profile: { account_id: accountId }, purchases: [] });
  },
});
assert.equal(exported.accountId, accountId);
assert.deepEqual(exported.data.purchases, []);

const deletion = await requestOwnAccountDeletion({
  accessToken,
  config,
  fetchImpl: async (url, options) => {
    if (url.endsWith('/auth/v1/user')) return response(200, verifiedUser());
    assert.equal(url, `${config.url}/rest/v1/rpc/request_account_deletion`);
    assert.deepEqual(JSON.parse(options.body), {});
    return response(200, {
      account_id: accountId,
      status: 'deletion_pending',
      deletion_requested_at: '2026-07-29T20:40:00.000Z',
      deletion_due_at: '2026-08-05T20:40:00.000Z',
    });
  },
});
assert.equal(deletion.profile.status, 'deletion_pending');

const migrationUrl = new URL('../../supabase/migrations/20260729203000_paid_access_foundation.sql', import.meta.url);
const migration = await readFile(migrationUrl, 'utf8');

const sensitiveTables = [
  'profiles',
  'purchase_intents',
  'purchases',
  'entitlements',
  'entitlement_events',
  'webhook_receipts',
  'learning_progress',
  'bookmarks',
  'support_requests',
  'privacy_requests',
  'admin_audit_entries',
];
for (const table of sensitiveTables) {
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
}

assert.match(migration, /revoke all on all tables in schema public from anon, authenticated;/);
assert.doesNotMatch(migration, /grant\s+(insert|update|delete)[^;]*on public\.(purchases|entitlements|entitlement_events|webhook_receipts)/i);
assert.match(migration, /create policy purchases_select_own[\s\S]*account_id = auth\.uid\(\)/);
assert.match(migration, /create policy entitlements_select_own[\s\S]*account_id = auth\.uid\(\)/);
assert.match(migration, /create or replace function public\.request_account_deletion\(\)/);
assert.match(migration, /deletion_due_at = now\(\) \+ interval '7 days'/);
assert.match(migration, /create or replace function public\.account_export\(export_account_id uuid\)/);

console.log('Supabase account and durable-record foundation tests passed.');
