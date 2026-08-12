import assert from 'node:assert/strict';
import {
  completePaddlePurchase,
  normalizeCompletedPaddleTransaction,
} from '../src/lib/paddle-commerce.js';

const environment = {
  PADDLE_ENVIRONMENT: 'sandbox',
  PADDLE_API_KEY: 'pdl_sdbx_apikey_test_value_that_is_long_enough_1234567890',
  PADDLE_LAUNCH_PRICE_ID: 'pri_01kytags0sybwaqtmpczg7brny',
  PADDLE_STANDARD_PRICE_ID: 'pri_01kytambh8fs7c7dagrq3mjqqt',
};

const event = {
  eventId: 'evt_01kyabcdefghijklmnopqrstuv',
  eventType: 'transaction.completed',
  occurredAt: '2026-07-31T16:30:00.000Z',
  data: {
    id: 'txn_01kyabcdefghijklmnopqrstuv',
    status: 'completed',
    customer_id: 'ctm_01kyabcdefghijklmnopqrstuv',
    currency_code: 'USD',
    custom_data: {
      account_id: '2a95425a-0a46-4c20-8b31-7ad474768559',
      purchase_intent_id: 'df3c49c8-5d27-4fe6-b832-af42b08bf783',
      product_id: 'read-the-dollar-first-guided-interactive-edition',
      price_tier: 'standard',
      amount_cents: 4900,
      currency: 'USD',
    },
    items: [{
      price: { id: environment.PADDLE_STANDARD_PRICE_ID },
      quantity: 1,
    }],
    details: {
      totals: {
        subtotal: '4900',
        tax: '980',
        total: '5880',
      },
    },
  },
  payload: { event_type: 'transaction.completed' },
};

const normalized = normalizeCompletedPaddleTransaction(event, environment);
assert.equal(normalized.accountId, event.data.custom_data.account_id);
assert.equal(normalized.intentId, event.data.custom_data.purchase_intent_id);
assert.equal(normalized.priceId, environment.PADDLE_STANDARD_PRICE_ID);
assert.equal(normalized.subtotalCents, 4900);
assert.equal(normalized.taxCents, 980);
assert.equal(normalized.totalCents, 5880);

assert.throws(() => normalizeCompletedPaddleTransaction({
  ...event,
  data: {
    ...event.data,
    items: [{ price: { id: environment.PADDLE_LAUNCH_PRICE_ID }, quantity: 1 }],
  },
}, environment), /reserved price/);

assert.throws(() => normalizeCompletedPaddleTransaction({
  ...event,
  data: {
    ...event.data,
    custom_data: { ...event.data.custom_data, account_id: 'attacker-controlled' },
  },
}, environment), /trusted references/);

let rpc = null;
const result = await completePaddlePurchase({
  event,
  environment,
  config: {
    url: 'https://project.supabase.co',
    publishableKey: 'sb_publishable_test_1234567890123456',
    secretKey: 'sb_secret_test_1234567890123456',
  },
  fetchImpl: async (url, options) => {
    rpc = { url, options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({
      purchase_id: 'f5c1f345-71a1-4b29-93f2-42d3b4adfe20',
      entitlement_id: 'bf8e1cf5-6794-4880-9025-60b8a3e96f67',
      duplicate_transaction: false,
      duplicate_purchase: false,
      refund_required: false,
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  },
});
assert.equal(result.processed, true);
assert.equal(result.duplicatePurchase, false);
assert.match(rpc.url, /\/rest\/v1\/rpc\/complete_paddle_purchase$/);
assert.equal(rpc.body.p_account_id, event.data.custom_data.account_id);
assert.equal(rpc.body.p_intent_id, event.data.custom_data.purchase_intent_id);
assert.equal(rpc.body.p_transaction_id, event.data.id);
assert.equal(rpc.body.p_subtotal_cents, 4900);

const duplicateCalls = [];
let duplicateRefundTransactionId = null;
const duplicateResult = await completePaddlePurchase({
  event,
  environment,
  config: {
    url: 'https://project.supabase.co',
    publishableKey: 'sb_publishable_test_1234567890123456',
    secretKey: 'sb_secret_test_1234567890123456',
  },
  ensureDuplicateRefund: async ({ transactionId }) => {
    duplicateRefundTransactionId = transactionId;
    return {
      id: 'adj_01kyabcdefghijklmnopqrstuv',
      status: 'pending_approval',
      raw: { id: 'adj_01kyabcdefghijklmnopqrstuv', status: 'pending_approval' },
    };
  },
  fetchImpl: async (url, options) => {
    duplicateCalls.push({ url, body: JSON.parse(options.body) });
    if (url.endsWith('/rpc/complete_paddle_purchase')) {
      return new Response(JSON.stringify({
        duplicate_purchase_id: 'c9fa8f7e-d027-4a54-9f54-39b7c347fbcb',
        original_purchase_id: 'f5c1f345-71a1-4b29-93f2-42d3b4adfe20',
        duplicate_purchase: true,
        refund_required: true,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.endsWith('/rpc/record_paddle_duplicate_refund_request')) {
      return new Response(JSON.stringify({
        status: 'refund_pending',
        adjustment_id: 'adj_01kyabcdefghijklmnopqrstuv',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected RPC URL: ${url}`);
  },
});
assert.equal(duplicateResult.processed, true);
assert.equal(duplicateResult.duplicatePurchase, true);
assert.equal(duplicateRefundTransactionId, event.data.id);
assert.equal(duplicateCalls.length, 2);
assert.equal(duplicateCalls[1].body.p_adjustment_status, 'pending_approval');

console.log('Paddle commerce processing tests passed.');
