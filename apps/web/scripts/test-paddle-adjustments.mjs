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
    type: 'full',
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

const approvedFullRefund = normalizePaddleAdjustment(event());
assert.equal(approvedFullRefund.revokesAccess, true);

assert.equal(normalizePaddleAdjustment(event({ status: 'pending_approval' })).revokesAccess, false);
assert.equal(normalizePaddleAdjustment(event({ status: 'rejected' })).revokesAccess, false);
assert.equal(normalizePaddleAdjustment(event({ type: 'partial' })).revokesAccess, false);
assert.equal(normalizePaddleAdjustment(event({ action: 'chargeback_warning' })).revokesAccess, false);
assert.equal(normalizePaddleAdjustment(event({ action: 'chargeback' })).revokesAccess, true);

let called = false;
const ignored = await applyPaddleAdjustment({
  event: event({ type: 'partial' }),
  config: { url: 'https://example.supabase.co', secretKey: 'secret' },
  fetchImpl: async () => {
    called = true;
    throw new Error('RPC must not be called for partial refunds.');
  },
});
assert.equal(ignored.ignored, true);
assert.equal(called, false);

let body;
const processed = await applyPaddleAdjustment({
  event: event(),
  config: { url: 'https://example.supabase.co', secretKey: 'secret' },
  fetchImpl: async (url, request) => {
    assert.equal(url, 'https://example.supabase.co/rest/v1/rpc/apply_paddle_access_revocation');
    body = JSON.parse(request.body);
    return new Response(JSON.stringify({ entitlement_state: 'refunded' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});

assert.equal(processed.processed, true);
assert.equal(body.p_adjustment_id, ids.adjustment);
assert.equal(body.p_transaction_id, ids.transaction);
assert.equal(body.p_action, 'refund');

console.log('Paddle adjustment tests passed.');
