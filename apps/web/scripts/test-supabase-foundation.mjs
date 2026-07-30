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
const publicConfig = Object.freeze({
  url: 'https://development.supabase.co',
  publishableKey: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  secretKey: null,
});
const privilegedConfig = Object.freeze({
  ...publicConfig,
  secretKey: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
});

const response = (status, body) => new Response(body == null ? '' : JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});
const verifiedUser = () => ({
  id: accountId,
  email: 'Reader@Example.com',
  email_confirmed_at: '2026-07-29T20:00:00.000Z',
});

assert.deepEqual(readSupabaseServerConfig({
  SUPABASE_URL: 'https://development.supabase.co/path',
  SUPABASE_PUBLISHABLE_KEY: publicConfig.publishableKey,
}), publicConfig);
assert.deepEqual(readSupabaseServerConfig({
  SUPABASE_URL: 'https://development.supabase.co/path',
  SUPABASE_PUBLISHABLE_KEY: publicConfig.publishableKey,
  SUPABASE_SECRET_KEY: privilegedConfig.secretKey,
}, { requireSecret: true }), privilegedConfig);
assert.throws(
  () => readSupabaseServerConfig({
    SUPABASE_URL: 'https://development.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: publicConfig.publishableKey,
  }, { requireSecret: true }),
  (error) => error instanceof SupabaseConfigurationError,
);
assert.throws(() => readSupabaseServerConfig({}), (error) => error instanceof SupabaseConfigurationError);
assert.equal(readBearerToken({ headers: { authorization: `Bearer ${accessToken}` } }), accessToken);
assert.equal(readBearerToken({ headers: { authorization: 'Basic abc' } }), null);

const verified = await getVerifiedSupabaseUser(accessToken, {
  config: publicConfig,
  fetchImpl: async (url, options) => {
    assert.equal(url, `${publicConfig.url}/auth/v1/user`);
    assert.equal(options.headers.apikey, publicConfig.publishableKey);
    assert.equal(options.headers.Authorization, `Bearer ${accessToken}`);
    return response(200, verifiedUser());
  },
});
assert.equal(verified.email, 'reader@example.com');

await assert.rejects(() => getVerifiedSupabaseUser(accessToken, {
  config: publicConfig,
  fetchImpl: async () => response(200, { ...verifiedUser(), email_confirmed_at: null }),
}), (error) => error instanceof SupabaseRequestError && error.code === 'VERIFIED_ACCOUNT_REQUIRED');

const activeState = await readAccountAccessState({
  accessToken,
  config: publicConfig,
  nowMs: Date.parse('2026-07-29T20:30:00.000Z'),
  fetchImpl: async (url, options) => {
    assert.equal(options.headers.apikey, publicConfig.publishableKey);
    assert.equal(options.headers.Authorization, `Bearer ${accessToken}`);
    if (url.endsWith('/auth/v1/user')) return response(200, verifiedUser());
    if (url.includes('/rest/v1/profiles?')) return response(200, [{
      account_id: accountId,
      email: 'reader@example.com',
      status: 'active',
    }]);
    if (url.includes('/rest/v1/entitlements?')) return response(200, [{
      id: entitlementId,
      account_id: accountId,
      product_id: 'read-the-dollar-first-guided-interactive-edition',
      state: 'active',
      starts_at: '2026-07-29T20:00:00.000Z',
      ends_at: null,
      version: 1,
      updated_at: '2026-07-29T20:00:00.000Z',
    }]);
    throw new Error(`Unexpected URL: ${url}`);
  },
});
assert.equal(activeState.allowed, true);
assert.equal(activeState.reason, 'active');

const suspendedState = await readAccountAccessState({
  accessToken,
  config: publicConfig,
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
  config: publicConfig,
  fetchImpl: async (url, options) => {
    if (url.endsWith('/auth/v1/user')) return response(200, verifiedUser());
    assert.equal(url, `${publicConfig.url}/rest/v1/rpc/account_export`);
    assert.equal(options.headers.apikey, publicConfig.publishableKey);
    assert.equal(options.headers.Authorization, `Bearer ${accessToken}`);
    assert.deepEqual(JSON.parse(options.body), { export_account_id: accountId });
    return response(200, { profile: { account_id: accountId }, purchases: [] });
  },
});
assert.equal(exported.accountId, accountId);

const deletion = await requestOwnAccountDeletion({
  accessToken,
  config: publicConfig,
  fetchImpl: async (url, options) => {
    if (url.endsWith('/auth/v1/user')) return response(200, verifiedUser());
    assert.equal(url, `${publicConfig.url}/rest/v1/rpc/request_account_deletion`);
    assert.equal(options.headers.apikey, publicConfig.publishableKey);
    assert.equal(options.headers.Authorization, `Bearer ${accessToken}`);
    assert.deepEqual(JSON.parse(options.body), {});
    return response(200, { account_id: accountId, status: 'deletion_pending' });
  },
});
assert.equal(deletion.profile.status, 'deletion_pending');

const migration = await readFile(
  new URL('../../../supabase/migrations/20260729203000_paid_access_foundation.sql', import.meta.url),
  'utf8',
);
for (const table of [
  'profiles', 'purchase_intents', 'purchases', 'entitlements', 'entitlement_events',
  'webhook_receipts', 'learning_progress', 'bookmarks', 'support_requests',
  'privacy_requests', 'admin_audit_entries',
]) {
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
}
assert.match(migration, /revoke all on all tables in schema public from anon, authenticated;/);
assert.doesNotMatch(migration, /grant\s+(insert|update|delete)[^;]*on public\.(purchases|entitlements|entitlement_events|webhook_receipts)/i);
assert.match(migration, /create policy purchases_select_own[\s\S]*account_id = auth\.uid\(\)/);
assert.match(migration, /create policy entitlements_select_own[\s\S]*account_id = auth\.uid\(\)/);
assert.match(migration, /deletion_due_at = now\(\) \+ interval '7 days'/);
assert.match(migration, /create or replace function public\.account_export\(export_account_id uuid\)/);

console.log('Supabase account and durable-record foundation tests passed.');
