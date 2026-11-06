import assert from 'node:assert/strict';
import { SENDABLE_STATUSES } from '../src/lib/launch-email-dispatch-common.js';
import { readAccountAccessState } from '../src/lib/supabase-server.js';
import {
  prepareDraftDatabaseFinalization, claimDraftAuthCleanup,
  resumeDraftAuthCleanup, runDraftAuthCleanupBatch,
  runDraftTwoPhaseReviewCycle,
} from '../src/lib/account-deletion-two-phase-review.js';

const account = '46d8a4a1-e616-4d9d-8faf-d877a42af310';
const lease = '9ca40ee4-6477-4fcb-88cc-bf4488dd9adc';
const outbox = '51a40ee4-6477-4fcb-88cc-bf4488dd9adc';
const origin = 'https://ycstrcvshdluovtuasjc.supabase.co';
const config = Object.freeze({
  enabled: true, production: false, projectRef: 'ycstrcvshdluovtuasjc',
  supabase: { url: origin, secretKey: 'sb_secret_abcdefghijklmnopqrstuvwxyz' },
});
const receipt = Object.freeze({
  phase: 'auth_confirmed', account_id: account,
  recipient_email: 'review@invalid.example',
  deleted_at: '2026-11-05T20:00:00.000Z',
  deletion_requested_at: '2026-10-05T20:00:00.000Z',
});
const row = Object.freeze({ account_id: account, lease_id: lease, phase: 'auth_pending', attempt_count: 1 });
const json = (code, body) => new Response(JSON.stringify(body), { status: code });
const empty = (code) => new Response(null, { status: code });
let passed = 0;
function check(value, label) { assert.ok(value, label); passed += 1; }

{
  let calls = 0;
  const fetchImpl = () => { calls += 1; throw Error('must not fetch'); };
  await assert.rejects(
    () => prepareDraftDatabaseFinalization({
      config: { ...config, production: true }, accountId: account, fetchImpl,
    }),
    (error) => error.code === 'TWO_PHASE_DRAFT_DEVELOPMENT_ONLY',
  );
  await assert.rejects(
    () => claimDraftAuthCleanup({
      config: { ...config, projectRef: 'gjzetjugmnwanvjkchux' }, fetchImpl,
    }),
    (error) => error.code === 'TWO_PHASE_DRAFT_DEVELOPMENT_ONLY',
  );
  await assert.rejects(
    () => prepareDraftDatabaseFinalization({ config, accountId: 'not-a-uuid', fetchImpl }),
    (error) => error.code === 'TWO_PHASE_ACCOUNT_INVALID',
  );
  await assert.rejects(
    () => claimDraftAuthCleanup({
      config: { ...config, supabase: {
        ...config.supabase, url: 'https://ycstrcvshdluovtuasjc.attacker.invalid',
      } }, fetchImpl,
    }),
    (error) => error.code === 'TWO_PHASE_DRAFT_DEVELOPMENT_ONLY',
  );
  check(calls === 0, 'Production/malformed or spoofed Development host rejected before network');
}
{
  const calls = [];
  const answer = await prepareDraftDatabaseFinalization({
    config, accountId: account, fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return json(200, { phase: 'auth_pending', account_id: account });
    },
  });
  check(answer.phase === 'auth_pending' && calls.length === 1
    && calls[0].url.endsWith('/rpc/finalize_deletion_and_queue_auth_cleanup')
    && calls[0].init.method === 'POST'
    && JSON.parse(calls[0].init.body).p_account_id === account,
  'Phase A is one DB transaction with no Auth/Admin requests');
  await assert.rejects(
    () => prepareDraftDatabaseFinalization({
      config, accountId: account, fetchImpl: async () => json(500, { code: '55000' }),
    }),
    (error) => error.code === 'TWO_PHASE_DATABASE_UNAVAILABLE',
  );
  check(true, 'Phase A refusal does not invoke an Auth or completion operation');
}
{
  await assert.rejects(
    () => claimDraftAuthCleanup({ config, batchSize: 26, fetchImpl: async () => { throw Error('no calls'); } }),
    (error) => error.code === 'TWO_PHASE_BATCH_INVALID',
  );
  await assert.rejects(
    () => claimDraftAuthCleanup({ config, fetchImpl: async () => json(200, [{...row, lease_id: 'forged'}]) }),
    (error) => error.code === 'TWO_PHASE_CLAIM_RECEIPT_INVALID',
  );
  const rows = await claimDraftAuthCleanup({
    config, fetchImpl: async (url, init) => {
      assert.ok(url.endsWith('/rpc/claim_deletion_auth_cleanup_batch'));
      assert.deepEqual(JSON.parse(init.body), { p_limit: 1 });
      return json(200, [row]);
    },
  });
  check(rows.length === 1 && rows[0].account_id === account,
    'only validated, bounded private-lease claims accepted');
}

const baseWorld = (overrides = {}) => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const href = String(url);
    let kind;
    if (href.includes('/auth/v1/admin/users/')) {
      if (init.method === 'DELETE') {
        assert.equal(href, `${origin}/auth/v1/admin/users/${account}`,
          'Auth deletion must use the canonical URL without a query workaround');
        assert.deepEqual(JSON.parse(init.body), { should_soft_delete: true },
          'GoTrue must receive the soft-delete flag in the JSON request body');
        kind = 'AUTH_DELETE';
      } else {
        assert.equal(init.method, 'GET');
        kind = 'AUTH_GET';
      }
    }
    else if (href.endsWith('/rpc/check_deletion_auth_cleanup_billing_fence')) kind = 'FENCE';
    else if (href.endsWith('/rpc/list_due_account_deletions_fair')) kind = 'DUE';
    else if (href.endsWith('/rpc/finalize_deletion_and_queue_auth_cleanup')) kind = 'PREPARE';
    else if (href.endsWith('/rpc/confirm_deletion_auth_cleanup')) kind = 'CONFIRM';
    else if (href.endsWith('/rpc/finish_deletion_auth_cleanup')) kind = 'FINISH';
    else if (href.endsWith('/rpc/claim_deletion_auth_cleanup_batch')) kind = 'CLAIM';
    else throw Error('Unexpected network call: ' + href);
    calls.push(kind);
    if (overrides[kind]) return overrides[kind](url, init);
    if (kind === 'DUE') return json(200, [{
      account_id: account, status: 'deletion_pending',
      deletion_due_at: '2026-11-01T00:00:00.000Z',
    }]);
    if (kind === 'PREPARE') return json(200, { phase: 'auth_pending', account_id: account });
    if (kind === 'FENCE') return json(200, true);
    if (kind === 'AUTH_DELETE') return json(200, { id: account });
    if (kind === 'AUTH_GET') return empty(404);
    if (kind === 'CONFIRM') return json(200, receipt);
    if (kind === 'FINISH') return json(200, true);
    if (kind === 'CLAIM') return json(200, [row]);
  };
  const emails = [];
  const enqueueImpl = async (args) => {
    emails.push(args.finalizationResult);
    return overrides.EMAIL ? overrides.EMAIL() : { enabled: true, outbox: { id: outbox, status: 'deletion_staged' } };
  };
  return { calls, emails, fetchImpl, enqueueImpl };
};
{
  const world = baseWorld({ AUTH_DELETE: () => json(503, {}) });
  await assert.rejects(
    () => resumeDraftAuthCleanup({ config, row, ...world }),
    (error) => error.code === 'TWO_PHASE_AUTH_DELETE_UNAVAILABLE',
  );
  check(world.calls.join(',') === 'FENCE,AUTH_DELETE' && world.emails.length === 0,
    'Auth DELETE failure retains DB queue and cannot acknowledge completion');
}
{
  const world = baseWorld({ AUTH_GET: () => json(200, { id: account, email: 'still-active@invalid.example' }) });
  await assert.rejects(
    () => resumeDraftAuthCleanup({ config, row, ...world }),
    (error) => error.code === 'TWO_PHASE_AUTH_NOT_RETIRED',
  );
  check(world.calls.join(',') === 'FENCE,AUTH_DELETE,AUTH_GET' && world.emails.length === 0,
    'Auth Admin still-active response blocks confirmation and completion email');
}
{
  const world = baseWorld();
  const done = await resumeDraftAuthCleanup({ config, row, ...world });
  check(done.status === 'auth_and_email_confirmed'
    && world.calls.join(',') === 'FENCE,AUTH_DELETE,AUTH_GET,CONFIRM,FINISH'
    && world.emails.length === 1 && world.emails[0].account_id === account,
    '200 DELETE and 404 Auth verification permit confirm, durable email, then scrub');
}
{
  const world = baseWorld({ AUTH_DELETE: () => empty(404) });
  const done = await resumeDraftAuthCleanup({ config, row, ...world });
  check(done.status === 'auth_and_email_confirmed'
    && world.calls[2] === 'AUTH_GET',
    'retry after already absent Auth identity is idempotent');
}
{
  const world = baseWorld({ AUTH_GET: () => json(200, { user: { id: account, deleted_at: '2026-11-05T20:00:00.000Z' } }) });
  const done = await resumeDraftAuthCleanup({ config, row, ...world });
  check(done.status === 'auth_and_email_confirmed',
    'matching Auth soft-deleted object is accepted, not merely HTTP 200');
}
{
  const world = baseWorld();
  const retry = { ...row, phase: 'auth_confirmed', attempt_count: 2 };
  const done = await resumeDraftAuthCleanup({ config, row: retry, ...world });
  check(done.status === 'auth_and_email_confirmed'
    && world.calls.join(',') === 'FENCE,CONFIRM,FINISH',
    'crash after Auth confirmation resumes email without another Auth DELETE');
}
{
  const world = baseWorld({ EMAIL: () => ({ enabled: false }) });
  await assert.rejects(
    () => resumeDraftAuthCleanup({ config, row, ...world }),
    (error) => error.code === 'TWO_PHASE_EMAIL_NOT_DURABLE',
  );
  check(!world.calls.includes('FINISH'),
    'failed email enqueue preserves email/DB recovery state for later retry');
}
{
  const world = baseWorld({ EMAIL: () => ({
    enabled: true, outbox: { id: outbox, status: 'queued' },
  }) });
  await assert.rejects(
    () => resumeDraftAuthCleanup({ config, row, ...world }),
    (error) => error.code === 'TWO_PHASE_EMAIL_NOT_STAGED',
  );
  check(!world.calls.includes('FINISH'),
    'prematurely dispatchable outbox is rejected before SQL completion');
}
{
  const world = baseWorld({ CONFIRM: () => json(200, { ...receipt, account_id: lease }) });
  await assert.rejects(
    () => resumeDraftAuthCleanup({ config, row, ...world }),
    (error) => error.code === 'TWO_PHASE_AUTH_CONFIRM_RECEIPT_INVALID',
  );
  check(world.emails.length === 0 && !world.calls.includes('FINISH'),
    'forged/mismatched completion receipt cannot send email or scrub ledger');
}
{
  const world = baseWorld({ FINISH: () => json(500, {}) });
  await assert.rejects(
    () => resumeDraftAuthCleanup({ config, row, ...world }),
    (error) => error.code === 'TWO_PHASE_DATABASE_UNAVAILABLE',
  );
  check(world.emails.length === 1,
    'post-email acknowledgement failure remains retryable and email dedupes via outbox');
}
{
  const world = baseWorld({ AUTH_DELETE: () => json(503, {}) });
  const result = await runDraftAuthCleanupBatch({ config, batchSize: 1, ...world });
  check(result.scanned === 1 && result.completed === 0 && result.held === 1
    && result.errors[0] === 'TWO_PHASE_AUTH_DELETE_UNAVAILABLE'
    && world.emails.length === 0,
    'batch runner holds failed Auth and emits only non-PII structured errors');
}
// Late signed paid evidence or unverifiable merchant state must stop before
// Auth Admin DELETE. Mocked fence outcomes never count as provider proof.
{
  const world = baseWorld({ FENCE: () => json(503, { code: 'BILLING_UNVERIFIED' }) });
  await assert.rejects(
    () => resumeDraftAuthCleanup({ config, row, ...world }),
    (error) => error.code === 'TWO_PHASE_DATABASE_UNAVAILABLE',
  );
  check(world.calls.join(',') === 'FENCE' && world.emails.length === 0,
    'late paid/unverified billing fence blocks Auth API and completion before calls');
}
{
  const world = baseWorld({ FENCE: () => json(200, false) });
  const retry = { ...row, phase: 'auth_confirmed', attempt_count: 2 };
  await assert.rejects(
    () => resumeDraftAuthCleanup({ config, row: retry, ...world }),
    (error) => error.code === 'TWO_PHASE_BILLING_FENCE_REFUSED',
  );
  check(world.calls.join(',') === 'FENCE' && world.emails.length === 0,
    'payment arriving after Auth confirmation still holds email and privacy completion');
}
// Entire Draft-only deletion cycle exercises ordering without registering a
// web route or touching a connected database, merchant, or Auth identity.
{
  let calls = 0;
  await assert.rejects(
    () => runDraftTwoPhaseReviewCycle({
      config: { ...config, production: true },
      fetchImpl: () => { calls += 1; throw Error('unexpected'); },
    }),
    (error) => error.code === 'TWO_PHASE_DRAFT_DEVELOPMENT_ONLY',
  );
  check(calls === 0, 'Draft review cycle refuses Production before network IO');
}
{
  const world = baseWorld();
  const result = await runDraftTwoPhaseReviewCycle({
    config, now: '2026-11-05T21:00:00Z', ...world,
  });
  check(result.prepared === 1 && result.cleanupCompleted === 1
    && result.held === 0 && result.cleanupHeld === 0
    && world.calls.join(',') === 'DUE,PREPARE,CLAIM,FENCE,AUTH_DELETE,AUTH_GET,CONFIRM,FINISH',
  'Draft cycle always commits DB Phase A before Auth, confirmation and email');
}
{
  const world = baseWorld({
    PREPARE: () => json(550, { code: '55000', message: 'billing hold' }),
    CLAIM: () => json(200, []),
  });
  const result = await runDraftTwoPhaseReviewCycle({
    config, now: '2026-11-05T21:00:00Z', ...world,
  });
  check(result.prepared === 0 && result.held === 1
    && result.cleanupCompleted === 0
    && world.calls.join(',') === 'DUE,PREPARE,CLAIM',
  'failed Phase A never calls Auth or queues a deletion-completed email');
}
{
  const world = baseWorld({
    DUE: () => json(200, [
      { account_id: account, status: 'deletion_pending', deletion_due_at: '2026-11-01T00:00:00Z' },
      { account_id: account, status: 'deletion_pending', deletion_due_at: '2026-11-01T00:00:00Z' },
    ]),
  });
  await assert.rejects(
    () => runDraftTwoPhaseReviewCycle({
      config, now: '2026-11-05T21:00:00Z', batchSize: 2, ...world,
    }),
    (error) => error.code === 'TWO_PHASE_DUE_SCAN_INVALID',
  );
  check(world.calls.join(',') === 'DUE' && world.emails.length === 0,
    'duplicated due identities fail closed before Phase A and Auth calls');
}
// Access-token revocation is not guaranteed by an Auth soft-delete call.
// A valid-looking, previously issued JWT with a still-active entitlement must
// NOT unlock paid materials once the profile enters the deletion workflow.
// This checks the existing server-side access gate, not hosted Auth semantics.
{
  const token = 'eyJhbGciOiJIUzI1NiJ9.valid-synthetic-jwt-token.signature';
  const accessConfig = Object.freeze({
    url: origin,
    publishableKey: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
    secretKey: null,
  });
  for (const status of ['deletion_pending', 'deleted']) {
    const calls = [];
    const state = await readAccountAccessState({
      accessToken: token,
      config: accessConfig,
      fetchImpl: async (url) => {
        calls.push(url);
        if (url.endsWith('/auth/v1/user')) {
          return json(200, {
            id: account,
            email: 'synthetic@example.invalid',
            email_confirmed_at: '2026-10-01T10:00:00Z',
          });
        }
        if (url.includes('/rest/v1/profiles?')) {
          return json(200, [{ account_id: account, status }]);
        }
        if (url.includes('/rest/v1/entitlements?')) {
          return json(200, [{
            id: 'aa921ce7-11ce-41d0-92e1-57960d91e20d',
            account_id: account,
            product_id: 'read-the-dollar-first-guided-interactive-edition',
            state: 'active',
            starts_at: '2026-10-01T10:00:00Z',
            ends_at: null,
            version: 1,
            updated_at: '2026-10-01T10:00:00Z',
          }]);
        }
        throw Error('No network request expected outside mocked Auth/profile/entitlement');
      },
    });
    check(state.allowed === false && state.reason === status
      && calls.some(url => url.endsWith('/auth/v1/user'))
      && calls.some(url => url.includes('/rest/v1/profiles?'))
      && calls.some(url => url.includes('/rest/v1/entitlements?')),
    'previous JWT and active entitlement cannot unlock paid content for ' + status);
  }
}

check(!SENDABLE_STATUSES.has('deletion_staged'),
  'shared email dispatcher cannot send staged deletion completion before SQL release');
console.log('Research P1 two-phase offline review passed (' + passed + ' assertions).');
