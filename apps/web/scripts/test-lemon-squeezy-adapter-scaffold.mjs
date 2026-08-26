import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validateCommerceAdapter } from '../src/lib/commerce-provider.js';
import {
  LEMON_SQUEEZY_ADAPTER_SCAFFOLD,
  buildLemonSqueezyCheckoutRequest,
  createLemonSqueezyTestCheckout,
  normalizeLemonSqueezyOrderEvent,
  verifyLemonSqueezyWebhookSignature,
} from '../src/lib/lemon-squeezy-adapter-scaffold.js';

const accountId = '123e4567-e89b-42d3-a456-426614174000';
const purchaseIntentId = '223e4567-e89b-42d3-a456-426614174000';
const secret = 'test-signing-secret';
const rawBody = JSON.stringify({ hello: 'world' });
const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

assert.equal(verifyLemonSqueezyWebhookSignature({ rawBody, signature, secret }), true);
assert.equal(verifyLemonSqueezyWebhookSignature({ rawBody: `${rawBody} `, signature, secret }), false);
assert.equal(verifyLemonSqueezyWebhookSignature({ rawBody, signature: '0'.repeat(64), secret }), false);
assert.equal(verifyLemonSqueezyWebhookSignature({ rawBody, signature: '', secret }), false);

const checkoutBody = buildLemonSqueezyCheckoutRequest({
  storeId: '42',
  variantId: 314,
  accountId,
  purchaseIntentId,
  email: 'buyer@example.com',
  redirectUrl: 'https://www.usd-impact.com/account/',
  testMode: true,
});
assert.equal(checkoutBody.data.type, 'checkouts');
assert.equal(checkoutBody.data.attributes.test_mode, true);
assert.deepEqual(checkoutBody.data.attributes.product_options.enabled_variants, [314]);
assert.deepEqual(checkoutBody.data.attributes.checkout_data.variant_quantities, [{ variant_id: 314, quantity: 1 }]);
assert.equal(checkoutBody.data.attributes.checkout_data.custom.usd_impact_account_id, accountId);
assert.equal(checkoutBody.data.attributes.checkout_data.custom.usd_impact_purchase_intent_id, purchaseIntentId);
assert.equal('custom_price' in checkoutBody.data.attributes, false);
assert.throws(() => buildLemonSqueezyCheckoutRequest({
  storeId: '42', variantId: 314, accountId, purchaseIntentId, testMode: false,
}), /Test Mode/);

let capturedRequest = null;
const checkout = await createLemonSqueezyTestCheckout({
  apiKey: 'test-api-key',
  storeId: '42',
  variantId: 314,
  accountId,
  purchaseIntentId,
  fetchImpl: async (url, init) => {
    capturedRequest = { url, init };
    return {
      ok: true,
      status: 201,
      async json() {
        return {
          data: {
            type: 'checkouts',
            id: 'checkout_123',
            attributes: {
              test_mode: true,
              url: 'https://store.lemonsqueezy.com/checkout/custom/example',
            },
          },
        };
      },
    };
  },
});
assert.equal(checkout.provider, 'lemon-squeezy');
assert.equal(checkout.testMode, true);
assert.equal(capturedRequest.url, 'https://api.lemonsqueezy.com/v1/checkouts');
assert.equal(capturedRequest.init.method, 'POST');
assert.match(capturedRequest.init.headers.Authorization, /^Bearer /);
assert.doesNotMatch(capturedRequest.init.body, /custom_price/);

const baseOrder = {
  meta: {
    event_name: 'order_created',
    custom_data: {
      usd_impact_account_id: accountId,
      usd_impact_purchase_intent_id: purchaseIntentId,
    },
  },
  data: {
    type: 'orders',
    id: '7001',
    attributes: {
      store_id: 42,
      customer_id: 88,
      identifier: '104e18a2-d755-4d4b-80c4-a6c1dcbe1c10',
      currency: 'USD',
      total: 4900,
      refunded_amount: 0,
      status: 'paid',
      first_order_item: {
        product_id: 99,
        variant_id: 314,
      },
      created_at: '2026-08-26T12:00:00.000Z',
      updated_at: '2026-08-26T12:00:01.000Z',
      test_mode: true,
    },
  },
};

const completed = normalizeLemonSqueezyOrderEvent(baseOrder, {
  expectedStoreId: 42,
  expectedProductId: 99,
  expectedVariantId: 314,
});
assert.equal(completed.provider, 'lemon-squeezy');
assert.equal(completed.eventType, 'payment.completed');
assert.equal(completed.transactionId, '7001');
assert.equal(completed.accountId, accountId);
assert.equal(completed.purchaseIntentId, purchaseIntentId);
assert.equal(completed.amountCents, 4900);
assert.equal(completed.currency, 'USD');
assert.equal(completed.metadata.lemonSqueezyTestMode, true);

const refunded = normalizeLemonSqueezyOrderEvent({
  ...baseOrder,
  meta: { ...baseOrder.meta, event_name: 'order_refunded' },
  data: {
    ...baseOrder.data,
    attributes: {
      ...baseOrder.data.attributes,
      status: 'refunded',
      refunded_amount: 4900,
      updated_at: '2026-08-26T12:30:00.000Z',
    },
  },
}, {
  expectedStoreId: 42,
  expectedProductId: 99,
  expectedVariantId: 314,
});
assert.equal(refunded.eventType, 'refund.completed');
assert.equal(refunded.amountCents, 4900);
assert.equal(refunded.metadata.fullRefund, true);

assert.throws(() => normalizeLemonSqueezyOrderEvent({
  ...baseOrder,
  data: { ...baseOrder.data, attributes: { ...baseOrder.data.attributes, status: 'failed' } },
}), /status is paid/);
assert.throws(() => normalizeLemonSqueezyOrderEvent(baseOrder, { expectedVariantId: 999 }), /variant/);
assert.throws(() => normalizeLemonSqueezyOrderEvent({
  ...baseOrder,
  data: { ...baseOrder.data, attributes: { ...baseOrder.data.attributes, test_mode: false } },
}), /Test Mode/);
assert.throws(() => normalizeLemonSqueezyOrderEvent({
  ...baseOrder,
  meta: { ...baseOrder.meta, event_name: 'subscription_created' },
}), /only normalizes/);

// The scaffold must remain impossible to register until the lifecycle contract is closed.
assert.throws(() => validateCommerceAdapter(LEMON_SQUEEZY_ADAPTER_SCAFFOLD), /missing/i);
assert.equal(LEMON_SQUEEZY_ADAPTER_SCAFFOLD.assessConfiguration().ready, false);

console.log('Lemon Squeezy fail-closed adapter scaffold tests passed.');
