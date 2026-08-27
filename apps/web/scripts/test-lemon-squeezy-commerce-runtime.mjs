import assert from 'node:assert/strict';
import {
  LemonSqueezyCommerceRuntimeError,
  createLockedLemonSqueezyTestCheckout,
  createSandboxCommerceCheckout,
  nextCommerceReconciliationAt,
  processLemonSqueezyWebhook,
  readLemonSqueezyCommerceRuntimeConfig,
  retrieveAuthoritativeLemonSqueezyOrder,
  selectTrustedLemonSqueezyVariant,
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

assert.equal(readLemonSqueezyCommerceRuntimeConfig({}).enabled, false);
assert.throws(
  () => readLemonSqueezyCommerceRuntimeConfig({ ...baseEnvironment, VERCEL_ENV: 'production' }),
  (error) => error instanceof LemonSqueezyCommerceRuntimeError
    && error.code === 'COMMERCE_SANDBOX_PRODUCTION_FORBIDDEN',
);
assert.throws(
  () => readLemonSqueezyCommerceRuntimeConfig({ ...baseEnvironment, LEMON_SQUEEZY_TEST_MODE: 'false' }),
  /Test Mode/,
);
assert.throws(
  () => readLemonSqueezyCommerceRuntimeConfig({
    ...baseEnvironment,
    SUPABASE_URL: 'https://not-development.supabase.co',
  }),
  /canonical Development/,
);
assert.throws(
  () => readLemonSqueezyCommerceRuntimeConfig({
    ...baseEnvironment,
    LEMON_SQUEEZY_TEST_STANDARD_VARIANT_ID: '313',
  }),
  /distinct fixed-price variants/,
);

const runtime = readLemonSqueezyCommerceRuntimeConfig(baseEnvironment);
assert.equal(runtime.enabled, true);
assert.equal(runtime.testMode, true);
assert.equal(runtime.reconciliationEnabled, false);
assert.equal(runtime.projectRef, 'ycstrcvshdluovtuasjc');

const launchIntent = {
  id: '223e4567-e89b-42d3-a456-426614174000',
  account_id: '123e4567-e89b-42d3-a456-426614174000',
  product_id: 'read-the-dollar-first-guided-interactive-edition',
  price_tier: 'launch',
  amount_cents: 3900,
  currency: 'USD',
};
const standardIntent = { ...launchIntent, price_tier: 'standard', amount_cents: 4900 };
assert.deepEqual(selectTrustedLemonSqueezyVariant(launchIntent, runtime), {
  variantId: 313,
  priceTier: 'launch',
  expectedSubtotalCents: 3900,
  currency: 'USD',
});
assert.deepEqual(selectTrustedLemonSqueezyVariant(standardIntent, runtime), {
  variantId: 314,
  priceTier: 'standard',
  expectedSubtotalCents: 4900,
  currency: 'USD',
});
assert.throws(
  () => selectTrustedLemonSqueezyVariant({ ...launchIntent, amount_cents: 4900 }, runtime),
  /amount mismatch/,
);

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
const orderItems = [{
  type: 'order-items',
  id: '9001',
  attributes: {
    order_id: 7001,
    product_id: 99,
    variant_id: 314,
    price: 5900,
    quantity: 1,
  },
}];

const commercial = validateLemonSqueezyOrderCommercialTerms({
  order,
  orderItems,
  config: runtime,
  expectedVariantId: 314,
  expectedSubtotalCents: 4900,
});
assert.equal(commercial.subtotalCents, 4900);
assert.equal(commercial.totalCents, 5900);
assert.equal(commercial.taxCents, 1000);
assert.equal(commercial.variantId, 314);
assert.throws(() => validateLemonSqueezyOrderCommercialTerms({
  order: { ...order, attributes: { ...order.attributes, subtotal: 3900 } },
  orderItems,
  config: runtime,
  expectedVariantId: 314,
  expectedSubtotalCents: 4900,
}), /subtotal/);
assert.throws(() => validateLemonSqueezyOrderCommercialTerms({
  order: { ...order, attributes: { ...order.attributes, discount_total: 100 } },
  orderItems,
  config: runtime,
  expectedVariantId: 314,
  expectedSubtotalCents: 4900,
}), /Discounted/);
assert.throws(() => validateLemonSqueezyOrderCommercialTerms({
  order,
  orderItems: [{ ...orderItems[0], attributes: { ...orderItems[0].attributes, quantity: 2 } }],
  config: runtime,
  expectedVariantId: 314,
  expectedSubtotalCents: 4900,
}), /quantity/);
assert.throws(() => validateLemonSqueezyOrderCommercialTerms({
  order,
  orderItems: [orderItems[0], orderItems[0]],
  config: runtime,
  expectedVariantId: 314,
  expectedSubtotalCents: 4900,
}), /exactly one item/);

let checkoutRequest = null;
const checkout = await createLockedLemonSqueezyTestCheckout({
  config: runtime,
  accountId: launchIntent.account_id,
  purchaseIntentId: launchIntent.id,
  variantId: 313,
  email: 'qa@example.com',
  fetchImpl: async (url, init) => {
    checkoutRequest = { url, init };
    return new Response(JSON.stringify({
      data: {
        type: 'checkouts',
        id: 'checkout_123',
        attributes: { test_mode: true, url: 'https://store.lemonsqueezy.com/checkout/custom/example' },
      },
    }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.equal(checkout.checkoutId, 'checkout_123');
const checkoutRequestBody = JSON.parse(checkoutRequest.init.body);
assert.equal(checkoutRequestBody.data.attributes.checkout_options.discount, false);
assert.deepEqual(checkoutRequestBody.data.attributes.product_options.enabled_variants, [313]);
assert.equal('custom_price' in checkoutRequestBody.data.attributes, false);

const providerRequests = [];
const authoritative = await retrieveAuthoritativeLemonSqueezyOrder({
  config: runtime,
  orderId: '7001',
  fetchImpl: async (url) => {
    providerRequests.push(url);
    if (url.endsWith('/orders/7001')) {
      return new Response(JSON.stringify({ data: order }), { status: 200 });
    }
    if (url.includes('/order-items?filter[order_id]=7001')) {
      return new Response(JSON.stringify({ data: orderItems }), { status: 200 });
    }
    throw new Error(`Unexpected provider URL: ${url}`);
  },
});
assert.equal(authoritative.order.id, '7001');
assert.equal(authoritative.orderItems.length, 1);
assert.equal(providerRequests.length, 2);

assert.equal(
  nextCommerceReconciliationAt({ attemptCount: 0, now: new Date('2026-08-26T00:00:00Z') }),
  '2026-08-27T00:00:00.000Z',
);
assert.equal(
  nextCommerceReconciliationAt({ attemptCount: 2, now: new Date('2026-08-26T00:00:00Z') }),
  '2026-08-29T00:00:00.000Z',
);
assert.equal(
  nextCommerceReconciliationAt({ attemptCount: 5, now: new Date('2026-08-26T00:00:00Z') }),
  '2026-09-02T00:00:00.000Z',
);

let fetchCalled = false;
await assert.rejects(
  () => processLemonSqueezyWebhook({
    config: runtime,
    rawBody: Buffer.from('{}'),
    signature: '0'.repeat(64),
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error('must not fetch before signature verification');
    },
  }),
  (error) => error instanceof LemonSqueezyCommerceRuntimeError
    && error.code === 'INVALID_COMMERCE_WEBHOOK_SIGNATURE',
);
assert.equal(fetchCalled, false);

assert.throws(
  () => readLemonSqueezyCommerceRuntimeConfig({
    ...baseEnvironment,
    SUPABASE_SECRET_KEY: '',
  }),
  (error) => error instanceof LemonSqueezyCommerceRuntimeError
    && error.code === 'COMMERCE_SANDBOX_CONFIGURATION_INVALID'
    && error.status === 503,
);

let providerCheckoutCalled = false;
await assert.rejects(
  () => createSandboxCommerceCheckout({
    config: runtime,
    user: { id: launchIntent.account_id, email: 'qa@example.com' },
    idempotencyKey: 'expired-intent-key',
    now: new Date('2026-08-26T12:00:00Z'),
    fetchImpl: async (url, init = {}) => {
      if (url.includes('/rest/v1/rpc/reserve_commerce_purchase_intent')) {
        return new Response(JSON.stringify({
          ...launchIntent,
          status: 'completed',
          expires_at: '2026-08-26T11:59:59.000Z',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.startsWith('https://api.lemonsqueezy.com/')) {
        providerCheckoutCalled = true;
      }
      throw new Error(`Unexpected URL after closed intent: ${url}`);
    },
  }),
  (error) => error instanceof LemonSqueezyCommerceRuntimeError
    && error.code === 'COMMERCE_PURCHASE_INTENT_NOT_OPEN'
    && error.status === 409,
);
assert.equal(providerCheckoutCalled, false);

console.log('Lemon Squeezy sandbox commerce runtime tests passed.');
