import assert from 'node:assert/strict';
import {
  applyPaddleTransactionLifecycle,
  normalizePaddleTransactionLifecycleEvent,
  paddleTransactionTransition,
} from '../src/lib/paddle-transactions.js';

const ids = {
  event: 'evt_01kyabcdefghijklmnopqrstuv',
  transaction: 'txn_01kyabcdefghijklmnopqrstuv',
  account: '2a95425a-0a46-4c20-8b31-7ad474768559',
  intent: 'df3c49c8-5d27-4fe6-b832-af42b08bf783',
};

function event(eventType = 'transaction.payment_failed', overrides = {}) {
  const data = {
    id: ids.transaction,
    status: 'ready',
    custom_data: {
      account_id: ids.account,
      purchase_intent_id: ids.intent,
      product_id: 'read-the-dollar-first-guided-interactive-edition',
    },
    payments: [{ status: 'error', error_code: 'declined' }],
    ...overrides,
  };
  return {
    eventId: ids.event,
    eventType,
    occurredAt: '2026-07-31T20:00:00.000Z',
    data,
    payload: { event_id: ids.event, event_type: eventType, data },
  };
}

assert.equal(paddleTransactionTransition('transaction.payment_failed', 'ready'), 'failed');
assert.equal(paddleTransactionTransition('transaction.past_due', 'past_due'), 'failed');
assert.equal(paddleTransactionTransition('transaction.canceled', 'canceled'), 'cancelled');
assert.equal(paddleTransactionTransition('transaction.updated', 'ready'), 'pending');
assert.equal(paddleTransactionTransition('transaction.updated', 'paid'), 'pending');
assert.equal(paddleTransactionTransition('transaction.updated', 'completed'), null);

const failed = normalizePaddleTransactionLifecycleEvent(event());
assert.equal(failed.transition, 'failed');
assert.equal(failed.paymentErrorCode, 'declined');
assert.equal(failed.intentId, ids.intent);
assert.equal(failed.accountId, ids.account);

const pending = normalizePaddleTransactionLifecycleEvent(event('transaction.updated', {
  status: 'ready',
  payments: [],
}));
assert.equal(pending.transition, 'pending');
assert.equal(pending.paymentErrorCode, null);

const canceled = normalizePaddleTransactionLifecycleEvent(event('transaction.canceled', {
  status: 'canceled',
}));
assert.equal(canceled.transition, 'cancelled');

assert.throws(() => normalizePaddleTransactionLifecycleEvent(event('transaction.updated', {
  custom_data: {
    account_id: 'attacker-controlled',
    purchase_intent_id: ids.intent,
    product_id: 'read-the-dollar-first-guided-interactive-edition',
  },
})), /trusted references/);

let request = null;
const applied = await applyPaddleTransactionLifecycle({
  event: event(),
  config: { url: 'https://example.supabase.co', secretKey: 'secret' },
  fetchImpl: async (url, options) => {
    request = { url, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({
      handled: true,
      state_changed: true,
      transition: 'failed',
      intent_status: 'failed',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});
assert.equal(applied.processed, true);
assert.equal(applied.ignored, false);
assert.equal(
  request.url,
  'https://example.supabase.co/rest/v1/rpc/apply_paddle_transaction_lifecycle',
);
assert.equal(request.body.p_transaction_id, ids.transaction);
assert.equal(request.body.p_transition, 'failed');
assert.equal(request.body.p_payment_error_code, 'declined');

console.log('Paddle transaction lifecycle tests passed.');
