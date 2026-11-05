import assert from 'node:assert/strict';
import {
  ResearchDeletionBillingHoldError,
  researchDeletionHoldReviewGate,
  reviewResearchBillingBeforeAuthDeletion,
} from '../src/lib/research-deletion-billing-hold.js';
import {
  finalizeOneDueAccount,
  runDueAccountDeletionFinalizer,
} from '../src/lib/account-deletion-finalizer.js';

const accountId = 'cccccccc-cccc-4ccc-8ccc-000000008008';
const base = 'https://ycstrcvshdluovtuasjc.supabase.co';
const key = 'sb_secret_synthetic_review_only_abcdefghijklmnopqrstuvwxyz';
const config = Object.freeze({
  production: false,
  supabase: { url: base, secretKey: key },
});
const env = Object.freeze({
  VERCEL_ENV: 'preview',
  RESEARCH_DELETION_HOLD_V1_ENABLED: 'true',
  RESEARCH_DELETION_HOLD_V1_REVIEW_APPROVED: 'true',
});
const due = Object.freeze({
  account_id: accountId,
  email: 'test-only@invalid.example',
  status: 'deletion_pending',
  deletion_requested_at: '2026-11-01T00:00:00Z',
  deletion_due_at: '2026-11-04T00:00:00Z',
});
const stamp = '2026-11-06T00:00:00Z';
const escalation = '2026-11-07T00:00:00Z';

function res(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function mock({ state = null, hold = false, queryCode = null, rpcCode = null, invalid = null } = {}) {
  const calls = [];
  return {
    calls,
    async fetch(url, options = {}) {
      const u = String(url);
      calls.push({ url: u, method: options.method, body: options.body });
      assert(u.startsWith(base), 'Unexpected external network request');
      if (u.includes('/research_deletion_billing_holds?')) {
        assert.equal(options.method, 'GET');
        assert(u.includes('account_id=eq.' + accountId));
        if (queryCode === 'hold') return res([], 503);
        return res(hold ? [{ account_id: accountId, hold_state: 'open' }] : []);
      }
      if (u.includes('/subscriptions?')) {
        assert.equal(options.method, 'GET');
        assert(u.includes('product_id=eq.research-membership'));
        if (queryCode === 'subscriptions') return res([], 503);
        if (invalid === 'malformed') return res({ wrong: 'shape' });
        return res(state ? [
          { account_id: accountId, product_id: 'research-membership', state },
        ] : []);
      }
      if (u.endsWith('/rpc/record_research_deletion_billing_hold')) {
        assert.equal(options.method, 'POST');
        const payload = JSON.parse(options.body);
        assert.equal(payload.p_account_id, accountId);
        if (rpcCode === 'unavailable') return res({ code: 'service-down' }, 503);
        if (rpcCode === 'invalid_ack') return res({ hold_state: 'open' });
        assert([
          'subscription_present', 'existing_hold', 'lookup_unavailable', 'lookup_malformed',
        ].includes(payload.p_reason_code));
        return res({
          hold_state: 'open',
          reason_code: payload.p_reason_code,
          attempt_count: 1,
          next_check_at: stamp,
          escalate_at: escalation,
        });
      }
      if (u.includes('/auth/v1/admin/users/')) {
        assert.equal(options.method, 'DELETE');
        return res({ id: accountId });
      }
      if (u.endsWith('/rpc/finalize_account_deletion')) {
        assert.equal(options.method, 'POST');
        return res([]);
      }
      if (u.includes('/profiles?account_id=')) {
        assert.equal(options.method, 'GET');
        return res([{
          account_id: accountId, status: 'deleted',
          deleted_at: '2026-11-05T14:00:00Z',
        }]);
      }
      if (u.includes('/support_requests?category=eq.privacy')) return res([]);
      if (u.includes('/profiles?status=eq.deletion_pending')) return res([due]);
      throw Error('Unexpected mock request method/path');
    },
  };
}

assert.equal(researchDeletionHoldReviewGate({}, config), false);
assert.equal(researchDeletionHoldReviewGate(env, config), true);
for (const forbidden of [
  { ...env, RESEARCH_DELETION_HOLD_V1_REVIEW_APPROVED: '' },
  { ...env, RESEARCH_DELETION_HOLD_V1_REVIEW_APPROVED: 'false' },
]) {
  assert.throws(
    () => researchDeletionHoldReviewGate(forbidden, config),
    (err) => err instanceof ResearchDeletionBillingHoldError
      && err.code === 'RESEARCH_DELETION_HOLD_REVIEW_NOT_APPROVED',
  );
}
assert.throws(
  () => researchDeletionHoldReviewGate(env, { ...config, production: true }),
  (err) => err.code === 'RESEARCH_DELETION_HOLD_REVIEW_NOT_APPROVED',
);
console.log('D33_APP_REVIEW_GATE_DEFAULT_OFF_AND_PRODUCTION_REFUSAL_PASS');

for (const state of ['pending', 'active', 'past_due', 'cancel_scheduled',
  'cancelled', 'refunded', 'charged_back', 'disputed']) {
  const m = mock({ state });
  const result = await finalizeOneDueAccount({
    profile: due, config, environment: env, fetchImpl: m.fetch,
  });
  assert.equal(result.status, 'billing_hold');
  assert.equal(result.nextCheckAt, stamp);
  assert(m.calls.some((v) => v.url.endsWith(
    '/rpc/record_research_deletion_billing_hold')));
  assert.equal(m.calls.some((v) => v.url.includes('/auth/v1/admin/')), false);
  assert.equal(m.calls.some((v) => v.url.includes('/finalize_account_deletion')), false);
}
console.log('D33_APP_ALL_RESEARCH_BILLING_STATES_HELD_BEFORE_AUTH_PASS');

for (const conditions of [
  { hold: true, expected: 'existing_hold' },
  { queryCode: 'hold', expected: 'lookup_unavailable' },
  { queryCode: 'subscriptions', expected: 'lookup_unavailable' },
  { invalid: 'malformed', expected: 'lookup_malformed' },
]) {
  const m = mock(conditions);
  const result = await reviewResearchBillingBeforeAuthDeletion({
    accountId, config, fetchImpl: m.fetch,
  });
  assert.equal(result.decision, 'hold');
  assert.equal(result.reason, conditions.expected);
  assert.equal(m.calls.some((v) => v.url.includes('/auth/v1/admin/')), false);
  if (conditions.hold) {
    assert.equal(m.calls.some((v) => v.url.includes('/subscriptions?')), false);
  }
}
console.log('D33_APP_HISTORICAL_HOLD_AND_BAD_LOOKUP_RECONCILIATION_PASS');

for (const rpcCode of ['unavailable', 'invalid_ack']) {
  const m = mock({ state: 'active', rpcCode });
  await assert.rejects(
    finalizeOneDueAccount({
      profile: due, config, environment: env, fetchImpl: m.fetch,
    }),
    (err) => err instanceof ResearchDeletionBillingHoldError
      && ['RESEARCH_DELETION_HOLD_NOT_DURABLE',
        'RESEARCH_DELETION_HOLD_ACK_INVALID'].includes(err.code),
  );
  assert.equal(m.calls.some((v) => v.url.includes('/auth/v1/admin/')), false);
  assert.equal(m.calls.some((v) => v.includes?.('/support_requests')), false);
}
console.log('D33_APP_MISSING_LEDGER_WRITES_FAIL_CLOSED_WITHOUT_AUTH_PASS');

const empty = mock();
const clear = await reviewResearchBillingBeforeAuthDeletion({
  accountId, config, fetchImpl: empty.fetch,
});
assert.equal(clear.decision, 'clear');
assert.equal(empty.calls.some((v) => v.url.includes('/record_research_deletion_billing_hold')), false);
const cleanRun = mock();
const cleanResult = await finalizeOneDueAccount({
  profile: due, config, environment: env, fetchImpl: cleanRun.fetch,
});
assert.equal(cleanResult.status, 'already_finalized');
assert.equal(cleanRun.calls.filter((v) => v.url.includes('/auth/v1/admin/')).length, 1);
console.log('D33_APP_NO_SUBSCRIPTION_LEGACY_FINALIZER_BEHAVIOR_PASS');

const legacy = mock();
const legacyResult = await finalizeOneDueAccount({
  profile: due, config, environment: {}, fetchImpl: legacy.fetch,
});
assert.equal(legacyResult.status, 'already_finalized');
assert.equal(legacy.calls.some((v) => v.url.includes('/subscriptions?')), false);
assert.equal(legacy.calls.some((v) => v.url.includes('/auth/v1/admin/')), true);
console.log('D33_APP_FEATURE_OFF_CURRENT_BEHAVIOR_UNCHANGED_PASS');

const wholeEnv = {
  ...env,
  ACCOUNT_DELETION_FINALIZER_ENABLED: 'true',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  SUPABASE_URL: base,
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_review_only',
  SUPABASE_SECRET_KEY: key,
};
const tally = mock({ state: 'active' });
const summary = await runDueAccountDeletionFinalizer({
  environment: wholeEnv, fetchImpl: tally.fetch,
});
assert.equal(summary.scanned, 1);
assert.equal(summary.billingHeld, 1);
assert.equal(summary.finalized, 0);
assert.equal(summary.failed, 0);
assert.equal(tally.calls.some((v) => v.url.includes('/auth/v1/admin/')), false);
console.log('D33_APP_DAILY_WORKER_BILLING_HELD_COUNTS_PASS');
console.log('D33_APP_CANDIDATE_TESTS_PASS: inactive gate, no network or database changes');
