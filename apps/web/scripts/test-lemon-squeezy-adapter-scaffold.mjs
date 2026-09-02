import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validateCommerceAdapter } from '../src/lib/commerce-provider.js';
import {
  LEMON_SQUEEZY_ADAPTER_SCAFFOLD,
  buildLemonSqueezyCheckoutRequest,
  createLemonSqueezyLiveCheckout,
  createLemonSqueezyTestCheckout,
  normalizeLemonSqueezyOrderEvent,
  reconcileLemonSqueezyOrder,
  retrieveLemonSqueezyOrder,
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
assert.equal(checkoutBody.data.attributes.checkout_options.discount, false);
assert.deepEqual(checkoutBody.data.attributes.product_options.enabled_variants, [314]);
assert.equal(checkoutBody.data.attributes.product_options.receipt_button_text, 'Open USD Impact');
assert.equal(
  checkoutBody.data.attributes.product_options.receipt_link_url,
  'https://www.usd-impact.com/account/',
);
assert.match(
  checkoutBody.data.attributes.product_options.receipt_thank_you_note,
  /access is tied to the USD Impact account confirmed before checkout/i,
);
assert.deepEqual(checkoutBody.data.attributes.checkout_data.variant_quantities, [{ variant_id: 314, quantity: 1 }]);
assert.equal(checkoutBody.data.attributes.checkout_data.custom.usd_impact_account_id, accountId);
assert.equal(checkoutBody.data.attributes.checkout_data.custom.usd_impact_purchase_intent_id, purchaseIntentId);
assert.equal('custom_price' in checkoutBody.data.attributes, false);
const liveCheckoutBody = buildLemonSqueezyCheckoutRequest({
  storeId: '42', variantId: 314, accountId, purchaseIntentId, testMode: false,
});
assert.equal(liveCheckoutBody.data.attributes.test_mode, false);

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
assert.match(capturedRequest.init.body, /"discount":false/);

const liveCheckout = await createLemonSqueezyLiveCheckout({
  apiKey: 'live-api-key',
  storeId: '42',
  variantId: 314,
  accountId,
  purchaseIntentId,
  fetchImpl: async () => ({
    ok: true,
    status: 201,
    async json() {
      return {
        data: {
          type: 'checkouts',
          id: 'checkout_live_123',
          attributes: {
            test_mode: false,
            url: 'https://store.lemonsqueezy.com/checkout/custom/live-example',
          },
        },
      };
    },
  }),
});
assert.equal(liveCheckout.testMode, false);
assert.equal(liveCheckout.checkoutId, 'checkout_live_123');
await assert.rejects(
  () => createLemonSqueezyLiveCheckout({
    apiKey: 'live-api-key',
    storeId: '42', variantId: 314, accountId, purchaseIntentId,
    fetchImpl: async () => ({
      ok: true,
      status: 201,
      async json() {
        return { data: { type: 'checkouts', id: 'wrong_mode', attributes: { test_mode: true, url: 'https://example.com' } } };
      },
    }),
  }),
  /Live checkout response/,
);

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
      subtotal: 4900,
      discount_total: 0,
      tax: 1000,
      total: 5900,
      refunded_amount: 0,
      status: 'paid',
      first_order_item: {
        product_id: 99,
        variant_id: 314,
        quantity: 1,
        // Current Lemon Squeezy examples can show this as the tax-inclusive charged amount.
        // The trusted pre-tax base-price invariant is therefore the documented order subtotal.
        price: 5900,
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
  expectedSubtotalCents: 4900,
  expectedCurrency: 'USD',
});
assert.equal(completed.provider, 'lemon-squeezy');
assert.match(completed.providerEventId, /^lemon-squeezy:order_created:/);
assert.equal(completed.eventType, 'payment.completed');
assert.equal(completed.transactionId, '7001');
assert.equal(completed.accountId, accountId);
assert.equal(completed.purchaseIntentId, purchaseIntentId);
assert.equal(completed.amountCents, 4900);
assert.equal(completed.currency, 'USD');
assert.equal(completed.metadata.lemonSqueezyOrderItemPriceCents, 5900);
assert.equal(completed.metadata.lemonSqueezySubtotalCents, 4900);
assert.equal(completed.metadata.lemonSqueezyDiscountTotalCents, 0);
assert.equal(completed.metadata.lemonSqueezyTaxCents, 1000);
assert.equal(completed.metadata.lemonSqueezyTaxInclusiveTotalCents, 5900);
assert.equal(completed.metadata.lemonSqueezyTestMode, true);

const refunded = normalizeLemonSqueezyOrderEvent({
  ...baseOrder,
  meta: { ...baseOrder.meta, event_name: 'order_refunded' },
  data: {
    ...baseOrder.data,
    attributes: {
      ...baseOrder.data.attributes,
      status: 'refunded',
      refunded_amount: 5900,
      updated_at: '2026-08-26T12:30:00.000Z',
    },
  },
}, {
  expectedStoreId: 42,
  expectedProductId: 99,
  expectedVariantId: 314,
  expectedSubtotalCents: 4900,
});
assert.equal(refunded.eventType, 'refund.completed');
assert.equal(refunded.amountCents, 5900);
assert.equal(refunded.metadata.fullRefund, true);
assert.match(refunded.providerEventId, /^lemon-squeezy:order_refunded:/);

assert.throws(() => normalizeLemonSqueezyOrderEvent({
  ...baseOrder,
  data: { ...baseOrder.data, attributes: { ...baseOrder.data.attributes, status: 'failed' } },
}), /status is paid/);
assert.throws(() => normalizeLemonSqueezyOrderEvent(baseOrder, { expectedVariantId: 999 }), /variant/);
assert.throws(() => normalizeLemonSqueezyOrderEvent(baseOrder, { expectedSubtotalCents: 3900 }), /subtotal/);
assert.throws(() => normalizeLemonSqueezyOrderEvent(baseOrder, { expectedCurrency: 'EUR' }), /currency/);
assert.throws(() => normalizeLemonSqueezyOrderEvent({
  ...baseOrder,
  data: {
    ...baseOrder.data,
    attributes: {
      ...baseOrder.data.attributes,
      discount_total: 100,
    },
  },
}), /Discounted/);
assert.throws(() => normalizeLemonSqueezyOrderEvent({
  ...baseOrder,
  data: {
    ...baseOrder.data,
    attributes: {
      ...baseOrder.data.attributes,
      first_order_item: { ...baseOrder.data.attributes.first_order_item, quantity: 2 },
    },
  },
}), /quantity/);
assert.throws(() => normalizeLemonSqueezyOrderEvent({
  ...baseOrder,
  data: { ...baseOrder.data, attributes: { ...baseOrder.data.attributes, test_mode: false } },
}), /Test Mode/);
const liveOrder = {
  ...baseOrder,
  data: { ...baseOrder.data, attributes: { ...baseOrder.data.attributes, test_mode: false } },
};
const liveCompleted = normalizeLemonSqueezyOrderEvent(liveOrder, {
  expectedStoreId: 42,
  expectedProductId: 99,
  expectedVariantId: 314,
  expectedSubtotalCents: 4900,
  expectedTestMode: false,
  requireTestMode: false,
});
assert.equal(liveCompleted.metadata.lemonSqueezyTestMode, false);
assert.throws(() => normalizeLemonSqueezyOrderEvent({
  ...baseOrder,
  meta: { ...baseOrder.meta, event_name: 'subscription_created' },
}), /only normalizes/);

let orderRequest = null;
const retrieved = await retrieveLemonSqueezyOrder({
  apiKey: 'test-api-key',
  orderId: '7001',
  fetchImpl: async (url, init) => {
    orderRequest = { url, init };
    return {
      ok: true,
      status: 200,
      async json() { return { data: baseOrder.data }; },
    };
  },
});
assert.equal(orderRequest.url, 'https://api.lemonsqueezy.com/v1/orders/7001');
assert.equal(orderRequest.init.method, 'GET');
assert.equal(retrieved.data.id, '7001');
const retrievedLive = await retrieveLemonSqueezyOrder({
  apiKey: 'live-api-key',
  orderId: '7001',
  expectedTestMode: false,
  requireTestMode: false,
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    async json() { return { data: liveOrder.data }; },
  }),
});
assert.equal(retrievedLive.data.attributes.test_mode, false);

const reconcileOptions = {
  expectedStoreId: 42,
  expectedProductId: 99,
  expectedVariantId: 314,
  expectedSubtotalCents: 4900,
  expectedCurrency: 'USD',
};
const paidState = reconcileLemonSqueezyOrder(baseOrder.data, reconcileOptions);
assert.equal(paidState.action, 'retain');
assert.equal(paidState.eventType, null);

const refundedState = reconcileLemonSqueezyOrder({
  ...baseOrder.data,
  attributes: { ...baseOrder.data.attributes, status: 'refunded', refunded_amount: 5900 },
}, reconcileOptions);
assert.equal(refundedState.action, 'revoke');
assert.equal(refundedState.eventType, 'refund.completed');

const fraudulentState = reconcileLemonSqueezyOrder({
  ...baseOrder.data,
  attributes: { ...baseOrder.data.attributes, status: 'fraudulent' },
}, reconcileOptions);
assert.equal(fraudulentState.action, 'revoke');
assert.equal(fraudulentState.eventType, 'payment.revoked');

const pendingState = reconcileLemonSqueezyOrder({
  ...baseOrder.data,
  attributes: { ...baseOrder.data.attributes, status: 'pending' },
}, reconcileOptions);
assert.equal(pendingState.action, 'hold');
assert.equal(pendingState.eventType, null);

const partialState = reconcileLemonSqueezyOrder({
  ...baseOrder.data,
  attributes: { ...baseOrder.data.attributes, status: 'partial_refund', refunded_amount: 1000 },
}, reconcileOptions);
assert.equal(partialState.action, 'review');
assert.match(partialState.reason, /full refunds only/i);

const validated = validateCommerceAdapter(LEMON_SQUEEZY_ADAPTER_SCAFFOLD);
assert.equal(validated.lifecycleModel, 'mor-final-state-reconciliation');
assert.equal(validated.provider, 'lemon-squeezy');
assert.equal(typeof validated.retrieveOrder, 'function');
assert.equal(typeof validated.reconcileTransaction, 'function');
assert.equal(LEMON_SQUEEZY_ADAPTER_SCAFFOLD.assessConfiguration().ready, false);
const liveAssessmentEnvironment = {
  LEMON_SQUEEZY_LIVE_API_KEY: 'live_api_key_abcdefghijklmnopqrstuvwxyz',
  LEMON_SQUEEZY_LIVE_WEBHOOK_SECRET: 'live_webhook_secret_abcdefghijklmnopqrstuvwxyz',
  LEMON_SQUEEZY_LIVE_STORE_ID: '42',
  LEMON_SQUEEZY_LIVE_PRODUCT_ID: '1319591',
  LEMON_SQUEEZY_LIVE_LAUNCH_VARIANT_ID: '2062957',
  LEMON_SQUEEZY_LIVE_STANDARD_VARIANT_ID: '2062958',
  LEMON_SQUEEZY_LIVE_REDIRECT_URL: 'https://www.usd-impact.com/account/',
  COMMERCE_CONTROLLED_LIVE_QA_EMAIL: 'qa@example.com',
  COMMERCE_RECONCILIATION_ENABLED: 'true',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
};
assert.equal(LEMON_SQUEEZY_ADAPTER_SCAFFOLD.assessConfiguration(liveAssessmentEnvironment, 'live-test').ready, true);
assert.equal(LEMON_SQUEEZY_ADAPTER_SCAFFOLD.assessConfiguration({
  ...liveAssessmentEnvironment,
  LEMON_SQUEEZY_TEST_API_KEY: 'must-not-fall-back',
}, 'live-test').ready, false);
assert.equal(LEMON_SQUEEZY_ADAPTER_SCAFFOLD.assessConfiguration({
  ...liveAssessmentEnvironment,
  LEMON_SQUEEZY_LIVE_STANDARD_VARIANT_ID: '9999999',
}, 'live').ready, false);
assert.equal(LEMON_SQUEEZY_ADAPTER_SCAFFOLD.assessConfiguration({
  ...liveAssessmentEnvironment,
  SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
}, 'live').ready, true);

console.log('Lemon Squeezy fail-closed final-state reconciliation scaffold tests passed.');
