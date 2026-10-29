import assert from 'node:assert/strict';
import {
  finalizeOneDueAccount,
  readAccountDeletionFinalizerConfig,
  revalidateDeletionBeforeAuth,
} from '../src/lib/account-deletion-finalizer.js';

// Synthetic fixtures only. Real Auth Admin and network are never invoked.
const id = '11111111-2222-4333-8444-555555555555';
const requestedAt = '2026-08-20T18:00:00.000Z';
const dueAt = '2026-08-27T18:00:00.000Z';
const now = new Date('2026-08-27T18:10:00.000Z');
const environment = Object.freeze({
  VERCEL_ENV: 'preview',
  ACCOUNT_DELETION_FINALIZER_ENABLED: 'true',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'p'.repeat(32),
  SUPABASE_SECRET_KEY: 'sb_secret_' + 's'.repeat(32),
});
const config = readAccountDeletionFinalizerConfig(environment);
const scanned = Object.freeze({
  account_id: id,
  email: 'reader@example.invalid',
  status: 'deletion_pending',
  deletion_requested_at: requestedAt,
  deletion_due_at: dueAt,
});
const current = Object.freeze({ ...scanned, deleted_at: null });

function mockProfileRead(rows, calls) {
  return async (url, options = {}) => {
    const uri = new URL(url);
    calls.push({ url: uri, method: options.method });
    assert.equal(uri.origin, environment.SUPABASE_URL);
    assert.equal(uri.pathname, '/rest/v1/profiles');
    assert.equal(uri.searchParams.get('account_id'), 'eq.' + id);
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.apikey, environment.SUPABASE_SECRET_KEY);
    assert.equal(Object.hasOwn(options.headers, 'Authorization'), false);
    return new Response(JSON.stringify(rows), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
}

let cases = 0;
{
  const calls = [];
  const result = await revalidateDeletionBeforeAuth({
    config, profile: scanned, now, fetchImpl: mockProfileRead([current], calls),
  });
  assert.deepEqual(result, { alreadyFinalized: false });
  assert.equal(calls.length, 1);
  cases += 1;
}
{
  const calls = [];
  const done = { ...current, status: 'deleted', deleted_at: now.toISOString() };
  const result = await finalizeOneDueAccount({
    config, profile: scanned, environment, now,
    fetchImpl: mockProfileRead([done], calls),
  });
  assert.equal(result.status, 'already_finalized');
  assert.equal(calls.length, 1, 'previously completed deletion must not repeat Auth DELETE or email');
  cases += 1;
}

// Each changed or invalid snapshot MUST stop before an Auth Admin, an
// entitlement update, or a support escalation (which could retain old PII).
const negative = [
  ['cancelled', [{ ...current, status: 'active' }]],
  ['rescheduled later', [{ ...current, deletion_due_at: '2026-09-01T18:00:00.000Z' }]],
  ['re-requested later', [{ ...current, deletion_requested_at: '2026-08-25T18:00:00.000Z' }]],
  ['email changed', [{ ...current, email: 'different@example.invalid' }]],
  ['no longer due', [{ ...current, deletion_due_at: '2026-08-27T19:00:00.000Z' }]],
  ['inconsistent timestamp', [{ ...current, deletion_due_at: '2026-08-15T00:00:00.000Z' }]],
  ['wrong account returned', [{ ...current, account_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' }]],
  ['deleted without proof', [{ ...current, status: 'deleted' }]],
  ['premature deleted_at', [{ ...current, deleted_at: now.toISOString() }]],
  ['missing request time', [{ ...current, deletion_requested_at: null }]],
  ['missing due time', [{ ...current, deletion_due_at: null }]],
  ['missing email', [{ ...current, email: '' }]],
  ['empty profile', []],
];
for (const [label, rows] of negative) {
  const calls = [];
  await assert.rejects(
    () => finalizeOneDueAccount({
      config, profile: scanned, environment, now,
      fetchImpl: mockProfileRead(rows, calls),
    }),
    (error) => error?.code === 'ACCOUNT_DELETION_PREAUTH_STALE',
    label,
  );
  assert.equal(calls.length, 1, label + ': no external Auth DELETE or escalation must occur');
  cases += 1;
}

// The scanner itself is not trusted: even a forged in-memory result from a
// stale queue must fail before Auth Admin.
for (const candidate of [
  { ...scanned, status: 'active' },
  { ...scanned, email: '' },
  { ...scanned, deletion_requested_at: null },
  { ...scanned, deletion_due_at: null },
  { ...scanned, deletion_due_at: '2026-09-30T18:00:00Z' },
  { ...scanned, account_id: 'not-a-uuid' },
]) {
  const calls = [];
  await assert.rejects(
    () => finalizeOneDueAccount({
      config, profile: candidate, environment, now,
      fetchImpl: mockProfileRead([current], calls),
    }),
    (error) => error?.code === 'ACCOUNT_DELETION_PREAUTH_STALE',
  );
  assert.equal(calls.some((entry) => entry.url.pathname.startsWith('/auth/v1/admin/')), false);
  cases += 1;
}

// A PostgREST read error must also prevent all destructive operations.
{
  let calls = 0;
  await assert.rejects(
    () => finalizeOneDueAccount({
      config, profile: scanned, environment, now,
      fetchImpl: async (url, options) => {
        calls += 1;
        assert.ok(String(url).includes('/rest/v1/profiles?'));
        assert.equal(options.method, 'GET');
        return new Response('{"message":"unavailable"}', { status: 503 });
      },
    }),
    (error) => error?.code === 'ACCOUNT_DELETION_PROFILE_RELOAD_FAILED',
  );
  assert.equal(calls, 1);
  cases += 1;
}
{
  let called = false;
  await assert.rejects(
    () => finalizeOneDueAccount({
      config, profile: scanned, environment, now: new Date('invalid'),
      fetchImpl: async () => {
        called = true;
        throw Error('must not fetch');
      },
    }),
    (error) => error?.code === 'ACCOUNT_DELETION_PREAUTH_STALE',
  );
  assert.equal(called, false);
  cases += 1;
}

console.log('Account deletion pre-Auth snapshot fail-close tests passed: ' + cases + ' cases.');
