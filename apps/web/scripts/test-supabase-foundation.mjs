import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import {
  SupabaseConfigurationError,
  SupabaseRequestError,
  createOwnSupportRequest,
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
    if (url.includes('/rest/v1/purchase_intents?')) return response(200, [{
      id: '8b759b85-1218-4d31-94d0-91786d0ddec7',
      status: 'completed',
      provider_checkout_id: 'txn_01kytags0sybwaqtmpczg7brny',
      expires_at: '2026-07-29T20:30:00.000Z',
      created_at: '2026-07-29T20:00:00.000Z',
      updated_at: '2026-07-29T20:01:00.000Z',
    }]);
    throw new Error(`Unexpected URL: ${url}`);
  },
});
assert.equal(activeState.allowed, true);
assert.equal(activeState.reason, 'active');
assert.equal(activeState.checkout.status, 'completed');

const suspendedState = await readAccountAccessState({
  accessToken,
  config: publicConfig,
  fetchImpl: async (url) => {
    if (url.endsWith('/auth/v1/user')) return response(200, verifiedUser());
    if (url.includes('/rest/v1/profiles?')) return response(200, [{ account_id: accountId, status: 'suspended' }]);
    if (url.includes('/rest/v1/entitlements?')) return response(200, []);
    if (url.includes('/rest/v1/purchase_intents?')) return response(200, []);
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

const supportRequest = await createOwnSupportRequest({
  accessToken,
  category: 'duplicate_charge',
  message: 'I see two charges and need help checking the automatic refund status.',
  config: publicConfig,
  fetchImpl: async (url, options) => {
    if (url.endsWith('/auth/v1/user')) return response(200, verifiedUser());
    assert.equal(
      url,
      `${publicConfig.url}/rest/v1/support_requests?select=id,category,subject,status,created_at`,
    );
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, `Bearer ${accessToken}`);
    assert.equal(options.headers.Prefer, 'return=representation');
    assert.deepEqual(JSON.parse(options.body), {
      account_id: accountId,
      email: 'reader@example.com',
      category: 'duplicate_charge',
      subject: 'Possible duplicate charge',
      message: 'I see two charges and need help checking the automatic refund status.',
    });
    return response(201, [{
      id: 'af5ca9a5-e711-4648-8dc2-f067e9214c0c',
      category: 'duplicate_charge',
      subject: 'Possible duplicate charge',
      status: 'open',
      created_at: '2026-07-31T21:00:00.000Z',
    }]);
  },
});
assert.equal(supportRequest.status, 'open');

await assert.rejects(() => createOwnSupportRequest({
  accessToken,
  category: 'invented',
  message: 'This message is long enough but the category is invalid.',
  config: publicConfig,
  fetchImpl: async (url) => {
    if (url.endsWith('/auth/v1/user')) return response(200, verifiedUser());
    throw new Error(`Unexpected URL: ${url}`);
  },
}), (error) => error instanceof SupabaseRequestError && error.code === 'INVALID_SUPPORT_CATEGORY');

const migrationDirectory = new URL('../../../supabase/migrations/', import.meta.url);
const migration = await readFile(
  new URL('20260729203000_paid_access_foundation.sql', migrationDirectory),
  'utf8',
);
const migrationFiles = (await readdir(migrationDirectory))
  .filter((name) => name.endsWith('.sql'))
  .sort();
const migrationChain = (
  await Promise.all(
    migrationFiles.map((name) => readFile(new URL(name, migrationDirectory), 'utf8')),
  )
).join('\n');
const securityHardeningMigration = await readFile(
  new URL('../../../supabase/migrations/20260804154505_supabase_security_hardening.sql', import.meta.url),
  'utf8',
);
const performanceHardeningMigration = await readFile(
  new URL('../../../supabase/migrations/20260804160932_optimize_rls_and_foreign_key_indexes.sql', import.meta.url),
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
assert.match(
  securityHardeningMigration,
  /revoke all on function public\.handle_new_auth_user\(\)\s+from public, anon, authenticated, service_role;/,
);
for (const policy of [
  'profiles_select_own', 'purchase_intents_select_own', 'purchases_select_own',
  'entitlements_select_own', 'entitlement_events_select_own', 'learning_progress_select_own',
  'learning_progress_insert_own', 'learning_progress_update_own', 'learning_progress_delete_own',
  'bookmarks_select_own', 'bookmarks_insert_own', 'bookmarks_update_own',
  'bookmarks_delete_own', 'support_requests_select_own', 'support_requests_insert_own',
  'privacy_requests_select_own', 'privacy_requests_insert_own',
]) {
  assert.match(
    performanceHardeningMigration,
    new RegExp(`alter policy ${policy}[\\s\\S]*?\\(select auth\\.uid\\(\\)\\)`),
  );
}
for (const index of [
  'entitlement_events_account_id_idx', 'entitlements_purchase_id_idx',
  'paddle_duplicate_purchases_purchase_intent_id_idx', 'privacy_requests_account_id_idx',
  'purchases_purchase_intent_id_idx', 'support_requests_account_id_idx',
]) {
  assert.match(performanceHardeningMigration, new RegExp(`create index ${index}`));
}

// SECURITY DEFINER RPCs are intentionally callable by authenticated customers,
// so their source-level identity and privilege boundaries are release gates.
// Scan the complete ordered migration chain so a later migration cannot silently
// redefine either RPC or grant it to an unapproved role.
assert.equal(
  (migrationChain.match(
    /create or replace function public\.account_export\(export_account_id uuid\)/gi,
  ) ?? []).length,
  1,
  'account_export has an unreviewed later definition',
);
assert.equal(
  (migrationChain.match(
    /create or replace function public\.request_account_deletion\(\)/gi,
  ) ?? []).length,
  1,
  'request_account_deletion has an unreviewed later definition',
);

const accountExportStart = migration.indexOf(
  'create or replace function public.account_export(export_account_id uuid)',
);
const accountDeletionStart = migration.indexOf(
  'create or replace function public.request_account_deletion()',
);
const productOfferSeedStart = migration.indexOf(
  'insert into public.product_offers',
);
assert.ok(accountExportStart >= 0);
assert.ok(accountDeletionStart > accountExportStart);
assert.ok(productOfferSeedStart > accountDeletionStart);

const accountExportSql = migration.slice(accountExportStart, accountDeletionStart);
assert.match(accountExportSql, /security definer/i);
assert.match(accountExportSql, /set search_path = public/i);
assert.match(accountExportSql, /where export_account_id = auth\.uid\(\)/i);
assert.match(
  accountExportSql,
  /revoke all on function public\.account_export\(uuid\) from public, anon;/i,
);
assert.match(
  accountExportSql,
  /grant execute on function public\.account_export\(uuid\) to authenticated;/i,
);
assert.doesNotMatch(
  migrationChain,
  /grant\s+execute\s+on\s+function\s+public\.account_export\(uuid\)\s+to\s+[^;]*\b(?:public|anon|service_role)\b[^;]*;/i,
);

const accountDeletionSql = migration.slice(accountDeletionStart, productOfferSeedStart);
assert.match(accountDeletionSql, /security definer/i);
assert.match(accountDeletionSql, /set search_path = public/i);
assert.match(accountDeletionSql, /where account_id = auth\.uid\(\)/i);
assert.match(
  accountDeletionSql,
  /revoke all on function public\.request_account_deletion\(\) from public, anon;/i,
);
assert.match(
  accountDeletionSql,
  /grant execute on function public\.request_account_deletion\(\) to authenticated;/i,
);
assert.doesNotMatch(
  migrationChain,
  /grant\s+execute\s+on\s+function\s+public\.request_account_deletion\(\)\s+to\s+[^;]*\b(?:public|anon|service_role)\b[^;]*;/i,
);

console.log('Supabase account and durable-record foundation tests passed.');
