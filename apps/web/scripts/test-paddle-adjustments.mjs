import assert from 'node:assert/strict';
import {
  applyPaddleAdjustment,
  normalizePaddleAdjustment,
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

const approvedDashboardRefund = normalizePaddleAdjustment(event());
assert.equal(approvedDashboardRefund.revocationCandidate, true);
assert.equal(approvedDashboardRefund.totalCents, 4900);
assert.equal(approvedDashboardRefund.type, 'partial');

assert.equal(normalizePaddleAdjustment(event({ status: 'pending_approval' })).revocationCandidate, false);
assert.equal(normalizePaddleAdjustment(event({ status: 'rejected' })).revocationCandidate, false);
assert.equal(normalizePaddleAdjustment(event({ action: 'chargeback_warning' })).revocationCandidate, false);
assert.equal(normalizePaddleAdjustment(event({ action: 'chargeback' })).revocationCandidate, true);

let called = false;
const ignoredPending = await applyPaddleAdjustment({
  event: event({ status: 'pending_approval' }),
  config: { url: 'https://example.supabase.co', secretKey: 'secret' },
  fetchImpl: async () => {
    called = true;
    throw new Error('RPC must not be called for pending refunds.');
  },
});
assert.equal(ignoredPending.ignored, true);
assert.equal(called, false);

let partialBody;
const ignoredPartial = await applyPaddleAdjustment({
  event: event({ totals: { total: '1000' } }),
  config: { url: 'https://example.supabase.co', secretKey: 'secret' },
  fetchImpl: async (_url, request) => {
    partialBody = JSON.parse(request.body);
    return new Response(JSON.stringify({ revoked: false, reason: 'partial_amount' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});
assert.equal(ignoredPartial.ignored, true);
assert.equal(ignoredPartial.processed, false);
assert.equal(partialBody.p_adjustment_total_cents, 1000);

let body;
const processed = await applyPaddleAdjustment({
  event: event(),
  config: { url: 'https://example.supabase.co', secretKey: 'secret' },
  fetchImpl: async (url, request) => {
    assert.equal(url, 'https://example.supabase.co/rest/v1/rpc/apply_paddle_access_revocation');
    body = JSON.parse(request.body);
    return new Response(JSON.stringify({ revoked: true, entitlement_state: 'refunded' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});

assert.equal(processed.processed, true);
assert.equal(body.p_adjustment_id, ids.adjustment);
assert.equal(body.p_transaction_id, ids.transaction);
assert.equal(body.p_action, 'refund');
assert.equal(body.p_adjustment_total_cents, 4900);
assert.equal(body.p_adjustment_type, 'partial');

console.log('Paddle adjustment tests passed.');
