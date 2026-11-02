import assert from 'node:assert/strict';
import {
  finalizeOneDueAccount,
  prepareDeletionAuthRemoval,
  readAccountDeletionFinalizerConfig,
  softDeleteAuthUser,
} from '../src/lib/account-deletion-finalizer.js';

const id = '11111111-2222-4333-8444-555555555555';
const email = 'synthetic@example.invalid';
const requested = '2026-08-20T18:00:00.000Z';
const due = '2026-08-27T18:00:00.000Z';
const now = new Date('2026-08-27T18:10:00.000Z');
const env = Object.freeze({
  VERCEL_ENV: 'preview',
  ACCOUNT_DELETION_FINALIZER_ENABLED: 'true',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'a'.repeat(32),
  SUPABASE_SECRET_KEY: 'sb_secret_' + 'b'.repeat(32),
});
const config = readAccountDeletionFinalizerConfig(env);
const scanned = Object.freeze({
  account_id: id,
  email,
  status: 'deletion_pending',
  deletion_requested_at: requested,
  deletion_due_at: due,
});
const ok = (status, payload) => new Response(
  payload === undefined ? null : JSON.stringify(payload),
  { status, headers: { 'content-type': 'application/json' } },
);
let assertions = 0;

// Exact bounded and privileged PostgREST preparation protocol: service-role
// RPC must run before Auth Admin, and opaque sb_secret_ must not be Bearer.
{
  let count = 0;
  const result = await prepareDeletionAuthRemoval({
    config, accountId: id,
    fetchImpl: async (url, options) => {
      count++;
      assert.equal(String(url), env.SUPABASE_URL + '/rest/v1/rpc/prepare_account_deletion_auth_removal');
      assert.equal(options.method, 'POST');
      assert.deepEqual(JSON.parse(options.body), { prepare_account_id: id });
      assert.equal(options.headers.apikey, env.SUPABASE_SECRET_KEY);
      assert.equal(Object.hasOwn(options.headers, 'Authorization'), false);
      return ok(200, true);
    },
  });
  assert.equal(result, true);
  assert.equal(count, 1);
  assertions += 1;
}

// The provider's supported JSON flag is mandatory: a query-string option is
// not interpreted as should_soft_delete by the GoTrue Admin API.
{
  let count = 0;
  const result = await softDeleteAuthUser({
    config, accountId: id,
    fetchImpl: async (url, options) => {
      count++;
      assert.equal(String(url), env.SUPABASE_URL + '/auth/v1/admin/users/' + id);
      assert.equal(new URL(url).search, '');
      assert.equal(options.method, 'DELETE');
      assert.deepEqual(JSON.parse(options.body), { should_soft_delete: true });
      assert.equal(options.headers.apikey, env.SUPABASE_SECRET_KEY);
      // Auth Admin Bearer compatibility remains unchanged and UNVERIFIED
      // until separately approved protected HTTP acceptance.
      assert.equal(options.headers.Authorization, 'Bearer ' + env.SUPABASE_SECRET_KEY);
      return ok(200, { id });
    },
  });
  assert.equal(result.alreadyAbsent, false);
  assert.equal(count, 1);
  assertions += 1;
}

// An already-missing identity is idempotent at this isolated RPC boundary.
{
  const r = await softDeleteAuthUser({
    config, accountId: id, fetchImpl: async () => ok(404, { error: 'not found' }),
  });
  assert.equal(r.alreadyAbsent, true);
  assertions += 1;
}

// A broken or ambiguous preparation must fail before any identity operation.
for (const [label, status, responseBody, code] of [
  ['no confirmation', 200, false, 'ACCOUNT_DELETION_AUTH_PREPARE_NOT_CONFIRMED'],
  ['null response', 200, null, 'ACCOUNT_DELETION_AUTH_PREPARE_NOT_CONFIRMED'],
  ['unexpected object', 200, { ok: true }, 'ACCOUNT_DELETION_AUTH_PREPARE_NOT_CONFIRMED'],
  ['missing payload', 204, undefined, 'ACCOUNT_DELETION_AUTH_PREPARE_NOT_CONFIRMED'],
  ['permission denied', 403, { code: '42501' }, 'ACCOUNT_DELETION_AUTH_PREPARE_FAILED'],
  ['stale request', 409, { code: '22023' }, 'ACCOUNT_DELETION_AUTH_PREPARE_FAILED'],
  ['unavailable RPC', 503, { error: 'unavailable' }, 'ACCOUNT_DELETION_AUTH_PREPARE_FAILED'],
]) {
  const calls = [];
  await assert.rejects(
    () => finalizeOneDueAccount({
      config, profile: scanned, environment: env, now,
      fetchImpl: async (url, options) => {
        const path = new URL(url).pathname;
        calls.push({ path, method: options.method });
        if (path === '/rest/v1/profiles') return ok(200, [{ ...scanned, deleted_at: null }]);
        if (path === '/rest/v1/rpc/prepare_account_deletion_auth_removal') {
          assert.equal(options.method, 'POST');
          return ok(status, responseBody);
        }
        assert.fail(label + ': must NOT call Auth/Admin, SQL finalization, outbox or support');
      },
    }),
    (error) => error?.code === code,
    label,
  );
  assert.deepEqual(calls.map(c => c.path),
    ['/rest/v1/profiles', '/rest/v1/rpc/prepare_account_deletion_auth_removal'],
    label + ': no privileged external operation may follow preparation failure');
  assertions += 1;
}

console.log('Account deletion prepare / soft-delete protocol contract passed: ' + assertions + ' scenarios.');
