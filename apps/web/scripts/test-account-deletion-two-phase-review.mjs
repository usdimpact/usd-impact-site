import assert from 'node:assert/strict';
import {
  prepareDraftDatabaseFinalization, claimDraftAuthCleanup,
  resumeDraftAuthCleanup, runDraftAuthCleanupBatch,
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
  check(calls === 0, 'Production/malformed account rejected before network');
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
    if (href.endsWith('should_soft_delete=true')) kind = 'AUTH_DELETE';
    else if (href.includes('/auth/v1/admin/users/')) kind = 'AUTH_GET';
    else if (href.endsWith('/rpc/confirm_deletion_auth_cleanup')) kind = 'CONFIRM';
    else if (href.endsWith('/rpc/finish_deletion_auth_cleanup')) kind = 'FINISH';
    else if (href.endsWith('/rpc/claim_deletion_auth_cleanup_batch')) kind = 'CLAIM';
    else throw Error('Unexpected network call: ' + href);
    calls.push(kind);
    if (overrides[kind]) return overrides[kind](url, init);
    if (kind === 'AUTH_DELETE') return json(200, { id: account });
    if (kind === 'AUTH_GET') return empty(404);
    if (kind === 'CONFIRM') return json(200, receipt);
    if (kind === 'FINISH') return json(200, true);
    if (kind === 'CLAIM') return json(200, [row]);
  };
  const emails = [];
  const enqueueImpl = async (args) => {
    emails.push(args.finalizationResult);
    return overrides.EMAIL ? overrides.EMAIL() : { enabled: true, outbox: { id: outbox } };
  };
  return { calls, emails, fetchImpl, enqueueImpl };
};
{
  const world = baseWorld({ AUTH_DELETE: () => json(503, {}) });
  await assert.rejects(
    () => resumeDraftAuthCleanup({ config, row, ...world }),
    (error) => error.code === 'TWO_PHASE_AUTH_DELETE_UNAVAILABLE',
  );
  check(world.calls.join(',') === 'AUTH_DELETE' && world.emails.length === 0,
    'Auth DELETE failure retains DB queue and cannot acknowledge completion');
}
{
  const world = baseWorld({ AUTH_GET: () => json(200, { id: account, email: 'still-active@invalid.example' }) });
  await assert.rejects(
    () => resumeDraftAuthCleanup({ config, row, ...world }),
    (error) => error.code === 'TWO_PHASE_AUTH_NOT_RETIRED',
  );
  check(world.calls.join(',') === 'AUTH_DELETE,AUTH_GET' && world.emails.length === 0,
    'Auth Admin still-active response blocks confirmation and completion email');
}
{
  const world = baseWorld();
  const done = await resumeDraftAuthCleanup({ config, row, ...world });
  check(done.status === 'auth_and_email_confirmed'
    && world.calls.join(',') === 'AUTH_DELETE,AUTH_GET,CONFIRM,FINISH'
    && world.emails.length === 1 && world.emails[0].account_id === account,
    '200 DELETE and 404 Auth verification permit confirm, durable email, then scrub');
}
{
  const world = baseWorld({ AUTH_DELETE: () => empty(404) });
  const done = await resumeDraftAuthCleanup({ config, row, ...world });
  check(done.status === 'auth_and_email_confirmed'
    && world.calls[1] === 'AUTH_GET',
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
    && world.calls.join(',') === 'CONFIRM,FINISH',
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
console.log('Research P1 two-phase offline review passed (' + passed + ' assertions).');
