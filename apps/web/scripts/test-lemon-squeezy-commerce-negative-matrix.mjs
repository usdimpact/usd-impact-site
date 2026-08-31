import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  LemonSqueezyCommerceRuntimeError,
  processLemonSqueezyWebhook,
  readLemonSqueezyCommerceRuntimeConfig,
  retrieveAuthoritativeLemonSqueezyOrder,
  runDueLemonSqueezyReconciliation,
  validateLemonSqueezyOrderCommercialTerms,
} from '../src/lib/lemon-squeezy-commerce-runtime.js';

const baseEnvironment = {
  COMMERCE_MODE: 'sandbox',
  COMMERCE_PROVIDER: 'lemon-squeezy',
  VERCEL_ENV: 'preview',
  LEMON_SQUEEZY_TEST_MODE: 'true',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
  COMMERCE_SANDBOX_QA_EMAIL: 'qa@example.com',
  LEMON_SQUEEZY_TEST_API_KEY: 'test_api_key_abcdefghijklmnopqrstuvwxyz',
  LEMON_SQUEEZY_TEST_WEBHOOK_SECRET: 'test_webhook_secret_abcdefghijklmnopqrstuvwxyz',
  LEMON_SQUEEZY_TEST_STORE_ID: '42',
  LEMON_SQUEEZY_TEST_PRODUCT_ID: '99',
  LEMON_SQUEEZY_TEST_LAUNCH_VARIANT_ID: '313',
  LEMON_SQUEEZY_TEST_STANDARD_VARIANT_ID: '314',
  LEMON_SQUEEZY_TEST_REDIRECT_URL: 'https://www.usd-impact.com/account/',
  COMMERCE_RECONCILIATION_ENABLED: 'false',
};

const runtime = readLemonSqueezyCommerceRuntimeConfig(baseEnvironment);
const order = {
  type: 'orders',
  id: '7001',
  attributes: {
    store_id: 42,
    identifier: '104e18a2-d755-4d4b-80c4-a6c1dcbe1c10',
    currency: 'USD',
    subtotal: 4900,
    discount_total: 0,
    tax: 1000,
    total: 5900,
    refunded_amount: 0,
    status: 'paid',
    test_mode: true,
    updated_at: '2026-08-26T12:00:01.000Z',
  },
};
const item = {
  type: 'order-items',
  id: '9001',
  attributes: {
    order_id: 7001,
    product_id: 99,
    variant_id: 314,
    price: 5900,
    quantity: 1,
  },
};

function validate(overrides = {}) {
  return validateLemonSqueezyOrderCommercialTerms({
    order: overrides.order ?? order,
    orderItems: overrides.orderItems ?? [item],
    config: runtime,
    expectedVariantId: 314,
    expectedSubtotalCents: 4900,
    expectedCurrency: 'USD',
  });
}

assert.throws(
  () => validate({ order: { ...order, attributes: { ...order.attributes, store_id: 999 } } }),
  /Store mismatch/,
);
assert.throws(
  () => validate({ orderItems: [{ ...item, attributes: { ...item.attributes, product_id: 999 } }] }),
  /Product mismatch/,
);
assert.throws(
  () => validate({ orderItems: [{ ...item, attributes: { ...item.attributes, variant_id: 999 } }] }),
  /Variant mismatch/,
);
assert.throws(
  () => validate({ order: { ...order, attributes: { ...order.attributes, currency: 'EUR' } } }),
  /currency mismatch/,
);
assert.throws(
  () => validate({ order: { ...order, attributes: { ...order.attributes, subtotal: 4800 } } }),
  (error) => error instanceof LemonSqueezyCommerceRuntimeError
    && error.code === 'LEMON_SQUEEZY_ORDER_SUBTOTAL_MISMATCH',
);
assert.throws(
  () => validate({ order: { ...order, attributes: { ...order.attributes, discount_total: 100 } } }),
  (error) => error instanceof LemonSqueezyCommerceRuntimeError
    && error.code === 'LEMON_SQUEEZY_ORDER_DISCOUNT_FORBIDDEN',
);
assert.throws(
  () => validate({ orderItems: [] }),
  (error) => error instanceof LemonSqueezyCommerceRuntimeError
    && error.code === 'LEMON_SQUEEZY_ORDER_ITEM_COUNT_MISMATCH',
);
assert.throws(
  () => validate({ orderItems: [item, item] }),
  (error) => error instanceof LemonSqueezyCommerceRuntimeError
    && error.code === 'LEMON_SQUEEZY_ORDER_ITEM_COUNT_MISMATCH',
);
assert.throws(
  () => validate({ orderItems: [{ ...item, attributes: { ...item.attributes, quantity: 2 } }] }),
  (error) => error instanceof LemonSqueezyCommerceRuntimeError
    && error.code === 'LEMON_SQUEEZY_ORDER_QUANTITY_MISMATCH',
);
assert.throws(
  () => validate({ order: { ...order, attributes: { ...order.attributes, test_mode: false } } }),
  /Non-Test-Mode order rejected/,
);

const substitutionPayload = {
  meta: {
    event_name: 'order_created',
    custom_data: {
      usd_impact_account_id: '123e4567-e89b-42d3-a456-426614174000',
      usd_impact_purchase_intent_id: '223e4567-e89b-42d3-a456-426614174000',
    },
  },
  data: { type: 'orders', id: '7001' },
};
const substitutionRawBody = Buffer.from(JSON.stringify(substitutionPayload));
const substitutionSignature = crypto
  .createHmac('sha256', runtime.webhookSecret)
  .update(substitutionRawBody)
  .digest('hex');
let substitutionReadCount = 0;
await assert.rejects(
  () => processLemonSqueezyWebhook({
    config: runtime,
    rawBody: substitutionRawBody,
    signature: substitutionSignature,
    fetchImpl: async (url) => {
      substitutionReadCount += 1;
      if (url.includes('/rest/v1/purchase_intents?')) {
        return new Response(JSON.stringify([{
          id: '223e4567-e89b-42d3-a456-426614174000',
          account_id: '523e4567-e89b-42d3-a456-426614174000',
          product_id: 'read-the-dollar-first-guided-interactive-edition',
          status: 'checkout_created',
          price_tier: 'standard',
          amount_cents: 4900,
          currency: 'USD',
          offer_terms: {},
          provider_checkout_id: 'checkout_123',
          expires_at: '2026-08-27T12:00:00.000Z',
        }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      throw new Error(`Substitution test crossed the trusted-intent boundary: ${url}`);
    },
  }),
  (error) => error instanceof LemonSqueezyCommerceRuntimeError
    && error.code === 'WEBHOOK_PURCHASE_INTENT_ACCOUNT_MISMATCH'
    && error.status === 409,
);
assert.equal(substitutionReadCount, 1);

await assert.rejects(
  () => retrieveAuthoritativeLemonSqueezyOrder({
    config: runtime,
    orderId: '7001',
    fetchImpl: async () => new Response(JSON.stringify({ errors: [{ detail: 'temporary outage' }] }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }),
  }),
  (error) => error instanceof LemonSqueezyCommerceRuntimeError
    && error.code === 'LEMON_SQUEEZY_TEST_API_REQUEST_FAILED'
    && error.status === 503,
);

const reconciliationRuntime = readLemonSqueezyCommerceRuntimeConfig({
  ...baseEnvironment,
  COMMERCE_RECONCILIATION_ENABLED: 'true',
});
const failureBodies = [];
let providerCalls = 0;
const summary = await runDueLemonSqueezyReconciliation({
  config: reconciliationRuntime,
  now: new Date('2026-08-26T00:00:00Z'),
  limit: 25,
  fetchImpl: async (url, init = {}) => {
    if (url.startsWith(`${reconciliationRuntime.supabase.url}/rest/v1/commerce_reconciliations?`)) {
      return new Response(JSON.stringify([{
        id: '323e4567-e89b-42d3-a456-426614174000',
        provider_transaction_id: '7001',
        purchase_id: '423e4567-e89b-42d3-a456-426614174000',
        purchase_intent_id: '223e4567-e89b-42d3-a456-426614174000',
        account_id: '123e4567-e89b-42d3-a456-426614174000',
        product_id: 'read-the-dollar-first-guided-interactive-edition',
        provider_price_id: '314',
        price_tier: 'standard',
        expected_subtotal_cents: 4900,
        currency: 'USD',
        provider_status: 'paid',
        attempt_count: 2,
        next_reconcile_at: '2026-08-25T00:00:00.000Z',
      }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.startsWith('https://api.lemonsqueezy.com/v1/')) {
      providerCalls += 1;
      return new Response(JSON.stringify({ errors: [{ detail: 'temporary outage' }] }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.endsWith('/rest/v1/rpc/record_commerce_reconciliation_failure')) {
      failureBodies.push(JSON.parse(init.body));
      return new Response(JSON.stringify({
        provider_transaction_id: '7001',
        disposition: 'tracking',
        attempt_count: 3,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`Unexpected negative-matrix URL: ${url}`);
  },
});

assert.equal(summary.enabled, true);
assert.equal(summary.scanned, 1);
assert.equal(summary.failed, 1);
assert.equal(summary.tracking, 0);
assert.equal(summary.reviewed, 0);
assert.equal(summary.terminal, 0);
assert.equal(providerCalls, 2);
assert.equal(failureBodies.length, 1);
assert.equal(failureBodies[0].p_provider, 'lemon-squeezy');
assert.equal(failureBodies[0].p_transaction_id, '7001');
assert.equal(failureBodies[0].p_error_code, 'LEMON_SQUEEZY_TEST_API_REQUEST_FAILED');
assert.equal(failureBodies[0].p_next_reconcile_at, '2026-08-29T00:00:00.000Z');

console.log('Lemon Squeezy automatic negative sandbox matrix tests passed.');
