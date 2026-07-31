import assert from 'node:assert/strict';
import {
  applyPaddleAdjustment,
  normalizePaddleAdjustment,
  paddleAdjustmentTransition,
} from '../src/lib/paddle-adjustments.js';

const ids = {
  event: 'evt_01kywhr3epw118s45sg3hemhp0',
  adjustment: 'adj_01kywhr3epw118s45sg3hemhp0',
  transaction: 'txn_01kywhr3epw118s45sg3hemhp0',
};

function event(overrides = {}) {
  const data = {
    id: ids.adjustment,
    transaction_id: ids.transaction,
    action: 'refund',
    status: 'approved',
    type: 'partial',
    reason: 'no longer needed',
    totals: { total: '4900' },
    ...overrides,
  };
  return {
    eventId: ids.event,
    eventType: 'adjustment.updated',
    occurredAt: '2026-07-31T17:03:29.000Z',
    data,
    payload: { event_id: ids.event, event_type: 'adjustment.updated', data },
  };
}

assert.equal(paddleAdjustmentTransition('refund', 'approved'), 'refund');
assert.equal(paddleAdjustmentTransition('chargeback_warning', 'approved'), 'chargeback_warning');
assert.equal(paddleAdjustmentTransition('chargeback', 'approved'), 'chargeback');
assert.equal(paddleAdjustmentTransition('chargeback_reverse', 'approved'), 'chargeback_reverse');
assert.equal(
  paddleAdjustmentTransition('chargeback_warning_reverse', 'approved'),
  'chargeback_warning_reverse',
);
assert.equal(paddleAdjustmentTransition('chargeback', 'reversed'), 'chargeback_reverse');
assert.equal(
  paddleAdjustmentTransition('chargeback_warning', 'reversed'),
  'chargeback_warning_reverse',
);
assert.equal(paddleAdjustmentTransition('refund', 'pending_approval'), null);
assert.equal(paddleAdjustmentTransition('refund', 'rejected'), null);

const approvedDashboardRefund = normalizePaddleAdjustment(event());
assert.equal(approvedDashboardRefund.lifecycleCandidate, true);
assert.equal(approvedDashboardRefund.revocationCandidate, true);
assert.equal(approvedDashboardRefund.totalCents, 4900);
assert.equal(approvedDashboardRefund.type, 'partial');
assert.equal(approvedDashboardRefund.reason, 'no longer needed');

const warning = normalizePaddleAdjustment(event({ action: 'chargeback_warning' }));
assert.equal(warning.transition, 'chargeback_warning');
assert.equal(warning.suspensionCandidate, true);
assert.equal(warning.revocationCandidate, false);

const chargeback = normalizePaddleAdjustment(event({ action: 'chargeback' }));
assert.equal(chargeback.transition, 'chargeback');
assert.equal(chargeback.revocationCandidate, true);

const chargebackReverse = normalizePaddleAdjustment(event({ action: 'chargeback_reverse' }));
assert.equal(chargebackReverse.transition, 'chargeback_reverse');
assert.equal(chargebackReverse.restorationCandidate, true);

const warningReversedUpdate = normalizePaddleAdjustment(event({
  action: 'chargeback_warning',
  status: 'reversed',
}));
assert.equal(warningReversedUpdate.transition, 'chargeback_warning_reverse');
assert.equal(warningReversedUpdate.restorationCandidate, true);

let called = false;
const ignoredCredit = await applyPaddleAdjustment({
  event: event({ action: 'credit' }),
  config: { url: 'https://example.supabase.co', secretKey: 'secret' },
  fetchImpl: async () => {
    called = true;
    throw new Error('RPC must not be called for unrelated credits.');
  },
});
assert.equal(ignoredCredit.ignored, true);
assert.equal(called, false);

async function applyWithResult(overrides, result) {
  let request;
  const applied = await applyPaddleAdjustment({
    event: event(overrides),
    config: { url: 'https://example.supabase.co', secretKey: 'secret' },
    fetchImpl: async (url, options) => {
      request = { url, body: JSON.parse(options.body) };
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  return { applied, request };
}

const pending = await applyWithResult(
  { status: 'pending_approval' },
  { handled: true, state_changed: false, transition: 'none' },
);
assert.equal(pending.applied.processed, true);
assert.equal(pending.applied.stateChanged, false);
assert.equal(pending.request.body.p_status, 'pending_approval');

const suspended = await applyWithResult(
  { action: 'chargeback_warning', reason: 'dispute warning' },
  {
    handled: true,
    state_changed: true,
    transition: 'chargeback_warning',
    entitlement_state: 'suspended_dispute',
  },
);
assert.equal(suspended.applied.processed, true);
assert.equal(suspended.applied.stateChanged, true);
assert.equal(
  suspended.request.url,
  'https://example.supabase.co/rest/v1/rpc/apply_paddle_adjustment_lifecycle',
);
assert.equal(suspended.request.body.p_action, 'chargeback_warning');
assert.equal(suspended.request.body.p_reason, 'dispute warning');

const revoked = await applyWithResult(
  { action: 'chargeback' },
  {
    handled: true,
    state_changed: true,
    transition: 'chargeback',
    entitlement_state: 'charged_back',
  },
);
assert.equal(revoked.applied.stateChanged, true);
assert.equal(revoked.request.body.p_adjustment_total_cents, 4900);

const restored = await applyWithResult(
  { action: 'chargeback_reverse' },
  {
    handled: true,
    state_changed: true,
    transition: 'chargeback_reverse',
    entitlement_state: 'active',
    restore_allowed: true,
  },
);
assert.equal(restored.applied.stateChanged, true);
assert.equal(restored.request.body.p_action, 'chargeback_reverse');
assert.equal(restored.request.body.p_adjustment_type, 'partial');
assert.equal(restored.request.body.p_event_id, ids.event);
assert.equal(restored.request.body.p_adjustment_id, ids.adjustment);
assert.equal(restored.request.body.p_transaction_id, ids.transaction);

console.log('Paddle adjustment lifecycle tests passed.');
