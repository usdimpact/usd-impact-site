// Offline regressions for the Auth-absent financial split correction.
// Synthetic mocks only: no connected database, Auth, merchant or email.
// The SQL side (fresh evidence, durable hold, claim filter) is proven in
// supabase/tests/research-p1/test_research_p1_auth_split_fence.py. These
// cases prove the worker classifies every refusal durably and fails closed.
import assert from 'node:assert/strict';
import {
  resumeDraftAuthCleanup,
  runDraftAuthCleanupBatch,
} from '../src/lib/account-deletion-two-phase-review.js';

const origin = 'https://ycstrcvshdluovtuasjc.supabase.co';
const account = 'b6f0b7a4-1d2e-4f3a-8b9c-0d1e2f3a4b5c';
const lease = 'c7a1c8b5-2e3f-4a4b-9c0d-1e2f3a4b5c6d';
const outbox = 'd8b2d9c6-3f4a-4b5c-8d1e-2f3a4b5c6d7e';
const config = Object.freeze({
  enabled: true, production: false, projectRef: 'ycstrcvshdluovtuasjc',
  supabase: { url: origin, secretKey: 'sb_secret_abcdefghijklmnopqrstuvwxyz' },
});
const pending = Object.freeze({ account_id: account, lease_id: lease, phase: 'auth_pending', attempt_count: 1 });
const receipt = Object.freeze({
  phase: 'auth_confirmed', account_id: account, recipient_email: 'split@invalid.example',
  deletion_requested_at: '2026-10-05T20:00:00.000Z', deleted_at: '2026-11-05T20:00:00.000Z',
});
const json = (status, body) => new Response(JSON.stringify(body), { status });
const refusal = () => json(400, { code: '55000', message: 'financial evidence (synthetic)' });
let passed = 0;
const check = (condition, label) => { assert.ok(condition, label); passed += 1; };

function world(overrides = {}) {
  const calls = [];
  const holds = [];
  const emails = [];
  const fetchImpl = async (url, init) => {
    const href = String(url);
    assert.ok(href.startsWith(origin + '/'), 'only the canonical Development origin');
    assert.ok(init.signal instanceof AbortSignal, 'every privileged request is bounded');
    let kind;
    if (href.includes('/auth/v1/admin/users/')) kind = init.method === 'DELETE' ? 'AUTH_DELETE' : 'AUTH_GET';
    else if (href.endsWith('/rpc/check_deletion_auth_cleanup_billing_fence')) kind = 'FENCE';
    else if (href.endsWith('/rpc/confirm_deletion_auth_cleanup')) kind = 'CONFIRM';
    else if (href.endsWith('/rpc/finish_deletion_auth_cleanup')) kind = 'FINISH';
    else if (href.endsWith('/rpc/hold_deletion_auth_cleanup')) kind = 'HOLD';
    else if (href.endsWith('/rpc/claim_deletion_auth_cleanup_batch')) kind = 'CLAIM';
    else throw Error('Unexpected network call: ' + href);
    calls.push(kind);
    if (kind === 'HOLD') holds.push(JSON.parse(init.body));
    if (overrides[kind]) return overrides[kind](url, init);
    if (kind === 'FENCE') return json(200, true);
    if (kind === 'AUTH_DELETE') return json(200, { id: account });
    if (kind === 'AUTH_GET') return new Response(null, { status: 404 });
    if (kind === 'CONFIRM') return json(200, receipt);
    if (kind === 'FINISH') return json(200, true);
    if (kind === 'HOLD') return json(200, null);
    if (kind === 'CLAIM') return json(200, [pending]);
    throw Error('unhandled ' + kind);
  };
  const enqueueImpl = async (args) => {
    emails.push(args.finalizationResult);
    return { enabled: true, outbox: { id: outbox, status: 'deletion_staged' } };
  };
  return { calls, holds, emails, fetchImpl, enqueueImpl };
}

const rejectsWith = (code, run) => assert.rejects(run, (error) => error.code === code, code);

// Before the fence: no fresh provider evidence. No Auth call; durable hold.
{
  const w = world({ FENCE: refusal, HOLD: () => json(200, 'auth_intact_cessation_unverified') });
  await rejectsWith('TWO_PHASE_CESSATION_UNVERIFIED',
    () => resumeDraftAuthCleanup({ config, row: pending, ...w }));
  check(w.calls.join(',') === 'FENCE,HOLD' && w.emails.length === 0,
    'unverified provider cessation never reaches Auth Admin');
  check(w.holds[0].p_auth_retired_observed === false && w.holds[0].p_lease_id === lease,
    'pre-Auth hold is never classified as Auth retired');
}
// Before/during the fence: signed payment evidence. Auth stays intact.
{
  const w = world({ FENCE: refusal, HOLD: () => json(200, 'auth_intact_financial_evidence') });
  await rejectsWith('TWO_PHASE_FINANCIAL_HOLD_AUTH_INTACT',
    () => resumeDraftAuthCleanup({ config, row: pending, ...w }));
  check(!w.calls.includes('AUTH_DELETE') && !w.calls.includes('CONFIRM'),
    'payment before or during the fence blocks every Auth and completion step');
}
// After the fence: payment lands before DELETE. The worker verified Auth
// retirement itself, so SQL must be told it is a split, not "unknown".
{
  const w = world({ CONFIRM: refusal, HOLD: () => json(200, 'auth_retired_financial_evidence') });
  await rejectsWith('TWO_PHASE_FINANCIAL_SPLIT_AUTH_RETIRED',
    () => resumeDraftAuthCleanup({ config, row: pending, ...w }));
  check(w.calls.join(',') === 'FENCE,AUTH_DELETE,AUTH_GET,CONFIRM,HOLD',
    'post-fence payment is detected at confirmation and durably classified');
  check(w.holds[0].p_auth_retired_observed === true && w.emails.length === 0
      && !w.calls.includes('FINISH'),
    'split: no completion email, no privacy completion, Auth retirement reported');
}
// After Auth confirmation and staged email: payment before final release.
{
  const w = world({ FINISH: refusal, HOLD: () => json(200, 'auth_retired_financial_evidence') });
  const confirmed = { ...pending, phase: 'auth_confirmed', attempt_count: 2 };
  await rejectsWith('TWO_PHASE_FINANCIAL_SPLIT_AUTH_RETIRED',
    () => resumeDraftAuthCleanup({ config, row: confirmed, ...w }));
  check(w.calls.join(',') === 'FENCE,CONFIRM,FINISH,HOLD' && w.emails.length === 1,
    'staged email stays unreleased when payment arrives before final acknowledgement');
}
// Ambiguous Auth outcome: DELETE times out. Not a financial stage, so no
// hold is recorded there; the retry's fence refusal is classified UNKNOWN.
{
  const first = world({ AUTH_DELETE: () => { throw Error('synthetic timeout carrying PII'); } });
  await rejectsWith('TWO_PHASE_AUTH_DELETE_UNAVAILABLE',
    () => resumeDraftAuthCleanup({ config, row: pending, ...first }));
  check(first.calls.join(',') === 'FENCE,AUTH_DELETE',
    'ambiguous DELETE leaves the leased row for a fenced retry');
  const retry = world({ FENCE: refusal, HOLD: () => json(200, 'auth_outcome_unknown_financial_evidence') });
  await rejectsWith('TWO_PHASE_FINANCIAL_HOLD_AUTH_UNKNOWN',
    () => resumeDraftAuthCleanup({ config, row: { ...pending, attempt_count: 2 }, ...retry }));
  check(retry.calls.join(',') === 'FENCE,HOLD' && !retry.calls.includes('AUTH_DELETE'),
    'retry after ambiguous outcome never re-sends DELETE once evidence appears');
  check(retry.holds[0].p_auth_retired_observed === false,
    'worker does not claim knowledge of the ambiguous Auth outcome');
}
// Q-16: a held split is re-admitted by a newer owner clearance while the
// signed quarantine is still open. The fence refuses before any Auth call,
// so the worker can only report what it saw (retired=false). The incident
// must still surface as the Auth-retired split that SQL durably recorded,
// with no second DELETE and no completion.
{
  const readmitted = { ...pending, attempt_count: 3 };
  const w = world({ FENCE: refusal, HOLD: () => json(200, 'auth_retired_financial_evidence') });
  await rejectsWith('TWO_PHASE_FINANCIAL_SPLIT_AUTH_RETIRED',
    () => resumeDraftAuthCleanup({ config, row: readmitted, ...w }));
  check(w.calls.join(',') === 'FENCE,HOLD' && w.emails.length === 0,
    're-admitted split refuses at the fence without re-sending Auth DELETE');
  check(w.holds[0].p_auth_retired_observed === false,
    'worker never claims Auth knowledge it did not observe; SQL keeps the verified fact');
}
// Fail closed on the classifier itself.
{
  const w = world({ FENCE: refusal, HOLD: () => json(200, 'auth_intact_all_clear') });
  await rejectsWith('TWO_PHASE_FINANCIAL_HOLD_MALFORMED',
    () => resumeDraftAuthCleanup({ config, row: pending, ...w }));
  check(!w.calls.includes('AUTH_DELETE'), 'unknown hold class never proceeds');
}
{
  const w = world({ FENCE: refusal, HOLD: () => json(503, {}) });
  await rejectsWith('TWO_PHASE_DATABASE_UNAVAILABLE',
    () => resumeDraftAuthCleanup({ config, row: pending, ...w }));
  check(w.calls.join(',') === 'FENCE,HOLD',
    'classifier outage keeps the original refusal; the next fence re-checks');
}
{
  const w = world({ FENCE: refusal });
  await rejectsWith('TWO_PHASE_DATABASE_UNAVAILABLE',
    () => resumeDraftAuthCleanup({ config, row: pending, ...w }));
  check(w.calls.join(',') === 'FENCE,HOLD', 'clean evidence (transient error) keeps normal retry');
}
// Batch summary codes stay within the worker route's accepted error grammar.
{
  const w = world({ CONFIRM: refusal, HOLD: () => json(200, 'auth_retired_financial_evidence') });
  const result = await runDraftAuthCleanupBatch({ config, batchSize: 1, ...w });
  check(result.held === 1 && result.completed === 0
      && result.errors[0] === 'TWO_PHASE_FINANCIAL_SPLIT_AUTH_RETIRED'
      && /^TWO_PHASE_[A-Z_]{1,60}$/.test(result.errors[0]),
    'split is reported as held with a bounded, non-PII code');
}

console.log('Research P1 financial-hold worker regressions passed (' + passed + ' assertions).');
