import assert from 'node:assert/strict';
import {
  cancelPaddleTransaction,
  ensurePaddleDuplicateRefund,
  getPaddleTransaction,
} from '../src/lib/paddle-api.js';

const transactionId = 'txn_01kyabcdefghijklmnopqrstuv';
const adjustmentId = 'adj_01kyabcdefghijklmnopqrstuv';
const config = {
  mode: 'sandbox',
  apiKey: 'pdl_sdbx_apikey_test_value_that_is_long_enough_1234567890',
  launchPriceId: 'pri_01kytags0sybwaqtmpczg7brny',
  standardPriceId: 'pri_01kytambh8fs7c7dagrq3mjqqt',
  checkoutUrl: null,
  baseUrl: 'https://sandbox-api.paddle.com',
};

const fetched = await getPaddleTransaction({
  transactionId,
  config,
  fetchImpl: async (url, options) => {
    assert.equal(url, `https://sandbox-api.paddle.com/transactions/${transactionId}`);
    assert.equal(options.method, 'GET');
    return new Response(JSON.stringify({
      data: {
        id: transactionId,
        status: 'ready',
        checkout: { url: `https://checkout.example.test/?_ptxn=${transactionId}` },
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.equal(fetched.status, 'ready');
assert.match(fetched.checkoutUrl, /_ptxn=/);

const canceled = await cancelPaddleTransaction({
  transactionId,
  config,
  fetchImpl: async (_url, options) => {
    assert.equal(options.method, 'PATCH');
    assert.deepEqual(JSON.parse(options.body), { status: 'canceled' });
    return new Response(JSON.stringify({
      data: { id: transactionId, status: 'canceled', checkout: null },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.equal(canceled.status, 'canceled');

const createdRefund = await ensurePaddleDuplicateRefund({
  transactionId,
  config,
  fetchImpl: async (url, options) => {
    assert.equal(url, 'https://sandbox-api.paddle.com/adjustments');
    assert.equal(options.method, 'POST');
    const body = JSON.parse(options.body);
    assert.equal(body.action, 'refund');
    assert.equal(body.type, 'full');
    assert.equal(body.transaction_id, transactionId);
    return new Response(JSON.stringify({
      data: {
        id: adjustmentId,
        action: 'refund',
        type: 'full',
        transaction_id: transactionId,
        status: 'pending_approval',
      },
    }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.equal(createdRefund.id, adjustmentId);
assert.equal(createdRefund.reused, false);

let calls = 0;
const recoveredRefund = await ensurePaddleDuplicateRefund({
  transactionId,
  config,
  fetchImpl: async (url) => {
    calls += 1;
    if (url.endsWith('/adjustments')) {
      return new Response(JSON.stringify({
        error: {
          code: 'adjustment_pending_refund_request',
          detail: 'A refund is already pending.',
        },
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    assert.match(url, /\/adjustments\?/);
    return new Response(JSON.stringify({
      data: [{
        id: adjustmentId,
        action: 'refund',
        type: 'full',
        transaction_id: transactionId,
        status: 'pending_approval',
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.equal(calls, 2);
assert.equal(recoveredRefund.reused, true);
assert.equal(recoveredRefund.id, adjustmentId);

console.log('Paddle API recovery tests passed.');
