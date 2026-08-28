import assert from 'node:assert/strict';
import { resolveCommerceReadiness } from '../src/lib/commerce-provider.js';
import { LEMON_SQUEEZY_ADAPTER_SCAFFOLD } from '../src/lib/lemon-squeezy-adapter-scaffold.js';
import {
  LemonSqueezyCommerceRuntimeError,
  createCommerceCheckout,
  createLockedLemonSqueezyCheckout,
  readLemonSqueezyCommerceRuntimeConfig,
  validateLemonSqueezyOrderCommercialTerms,
} from '../src/lib/lemon-squeezy-commerce-runtime.js';

const disclosureEnvironment = {
  COMMERCE_TRADER_ADDRESS_PUBLIC: 'Str. Doctor Hacman nr. 28, bl. 83, sc. B, ap. 9, 240232 Râmnicu Vâlcea, România',
  COMMERCE_TAX_STATUS_PUBLIC: 'Applicable indirect taxes are handled by Lemon Squeezy as Merchant of Record.',
  COMMERCE_MERCHANT_OF_RECORD_NAME: 'Lemon Squeezy — Link, LLC f/k/a Lemon Squeezy LLC',
  COMMERCE_MERCHANT_OF_RECORD_TERMS_URL: 'https://www.lemonsqueezy.com/buyer-terms',
  COMMERCE_MERCHANT_OF_RECORD_PRIVACY_URL: 'https://www.lemonsqueezy.com/privacy',
  COMMERCE_TAX_CHECKOUT_PUBLIC: 'Applicable indirect taxes are shown before payment.',
  COMMERCE_REFUND_SUPPORT_PUBLIC: 'Contact support@usd-impact.com for refund review.',
  COMMERCE_SELLER_DISCLOSURE_APPROVED: 'true',
};

const liveProviderEnvironment = {
  LEMON_SQUEEZY_LIVE_API_KEY: 'live_api_key_abcdefghijklmnopqrstuvwxyz',
  LEMON_SQUEEZY_LIVE_WEBHOOK_SECRET: 'live_webhook_secret_abcdefghijklmnopqrstuvwxyz',
  LEMON_SQUEEZY_LIVE_STORE_ID: '123456',
  LEMON_SQUEEZY_LIVE_PRODUCT_ID: '1319591',
  LEMON_SQUEEZY_LIVE_LAUNCH_VARIANT_ID: '2062957',
  LEMON_SQUEEZY_LIVE_STANDARD_VARIANT_ID: '2062958',
  LEMON_SQUEEZY_LIVE_REDIRECT_URL: 'https://www.usd-impact.com/account/',
  COMMERCE_RECONCILIATION_ENABLED: 'true',
};

const databaseEnvironment = {
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
};

const controlledLiveEnvironment = {
  COMMERCE_MODE: 'live-test',
  COMMERCE_PROVIDER: 'lemon-squeezy',
  COMMERCE_SANDBOX_VERIFIED: 'true',
  VERCEL_ENV: 'preview',
  COMMERCE_CONTROLLED_LIVE_QA_EMAIL: 'qa@example.com',
  ...disclosureEnvironment,
  ...liveProviderEnvironment,
  ...databaseEnvironment,
};

const controlled = readLemonSqueezyCommerceRuntimeConfig(controlledLiveEnvironment);
assert.equal(controlled.enabled, true);
assert.equal(controlled.mode, 'live-test');
assert.equal(controlled.testMode, false);
assert.equal(controlled.controlledQaOnly, true);
assert.equal(controlled.qaEmail, 'qa@example.com');
assert.equal(controlled.projectRef, 'ycstrcvshdluovtuasjc');
assert.equal(controlled.productId, 1319591);
assert.equal(controlled.launchVariantId, 2062957);
assert.equal(controlled.standardVariantId, 2062958);
assert.equal(controlled.reconciliationEnabled, true);
assert.equal(controlled.readiness.state, 'ready_for_controlled_live_test');

const controlledReadiness = resolveCommerceReadiness(
  controlledLiveEnvironment,
  [LEMON_SQUEEZY_ADAPTER_SCAFFOLD],
);
assert.equal(controlledReadiness.state, 'ready_for_controlled_live_test');
assert.equal(controlledReadiness.checkoutEnabled, false);
assert.equal(controlledReadiness.configuration.ready, true);

const mixedNamespaceReadiness = resolveCommerceReadiness({
  ...controlledLiveEnvironment,
  LEMON_SQUEEZY_TEST_API_KEY: 'forbidden_test_fallback',
}, [LEMON_SQUEEZY_ADAPTER_SCAFFOLD]);
assert.equal(mixedNamespaceReadiness.state, 'blocked');
assert.equal(mixedNamespaceReadiness.checkoutEnabled, false);

for (const mutation of [
  { LEMON_SQUEEZY_TEST_API_KEY: 'forbidden_test_fallback' },
  { LEMON_SQUEEZY_TEST_MODE: 'true' },
  { LEMON_SQUEEZY_LIVE_PRODUCT_ID: '9999999' },
  { LEMON_SQUEEZY_LIVE_LAUNCH_VARIANT_ID: '9999998' },
  { LEMON_SQUEEZY_LIVE_STANDARD_VARIANT_ID: '9999997' },
  { COMMERCE_RECONCILIATION_ENABLED: 'false' },
  { COMMERCE_SELLER_DISCLOSURE_APPROVED: 'false' },
  { COMMERCE_SANDBOX_VERIFIED: 'false' },
  { VERCEL_ENV: 'production' },
]) {
  assert.throws(
    () => readLemonSqueezyCommerceRuntimeConfig({ ...controlledLiveEnvironment, ...mutation }),
    (error) => error instanceof LemonSqueezyCommerceRuntimeError
      && error.code === 'COMMERCE_RELEASE_GATE_BLOCKED'
      && error.status === 503,
  );
}

assert.throws(
  () => readLemonSqueezyCommerceRuntimeConfig({
    ...controlledLiveEnvironment,
    SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
  }),
  (error) => error instanceof LemonSqueezyCommerceRuntimeError
    && error.code === 'COMMERCE_DATABASE_PROJECT_MISMATCH',
);

const liveOrder = {
  type: 'orders',
  id: '7001',
  attributes: {
    store_id: 123456,
    identifier: '104e18a2-d755-4d4b-80c4-a6c1dcbe1c10',
    currency: 'USD',
    subtotal: 3900,
    discount_total: 0,
    tax: 800,
    total: 4700,
    refunded_amount: 0,
    status: 'paid',
    test_mode: false,
    updated_at: '2026-08-27T12:00:01.000Z',
  },
};
const liveOrderItems = [{
  type: 'order-items',
  id: '9001',
  attributes: {
    order_id: 7001,
    product_id: 1319591,
    variant_id: 2062957,
    price: 4700,
    quantity: 1,
  },
}];

const commercial = validateLemonSqueezyOrderCommercialTerms({
  order: liveOrder,
  orderItems: liveOrderItems,
  config: controlled,
  expectedVariantId: 2062957,
  expectedSubtotalCents: 3900,
});
assert.equal(commercial.subtotalCents, 3900);
assert.equal(commercial.variantId, 2062957);
assert.throws(
  () => validateLemonSqueezyOrderCommercialTerms({
    order: { ...liveOrder, attributes: { ...liveOrder.attributes, test_mode: true } },
    orderItems: liveOrderItems,
    config: controlled,
    expectedVariantId: 2062957,
    expectedSubtotalCents: 3900,
  }),
  (error) => error instanceof LemonSqueezyCommerceRuntimeError
    && error.code === 'LEMON_SQUEEZY_ORDER_MODE_MISMATCH',
);

let checkoutRequest = null;
const checkout = await createLockedLemonSqueezyCheckout({
  config: controlled,
  accountId: '123e4567-e89b-42d3-a456-426614174000',
  purchaseIntentId: '223e4567-e89b-42d3-a456-426614174000',
  variantId: 2062957,
  email: 'qa@example.com',
  fetchImpl: async (url, init) => {
    checkoutRequest = { url, init };
    return new Response(JSON.stringify({
      data: {
        type: 'checkouts',
        id: 'checkout_live_123',
        attributes: { test_mode: false, url: 'https://store.lemonsqueezy.com/checkout/custom/live-example' },
      },
    }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.equal(checkout.testMode, false);
assert.equal(JSON.parse(checkoutRequest.init.body).data.attributes.test_mode, false);

await assert.rejects(
  () => createLockedLemonSqueezyCheckout({
    config: controlled,
    accountId: '123e4567-e89b-42d3-a456-426614174000',
    purchaseIntentId: '223e4567-e89b-42d3-a456-426614174000',
    variantId: 2062957,
    email: 'qa@example.com',
    fetchImpl: async () => new Response(JSON.stringify({
      data: {
        type: 'checkouts',
        id: 'wrong_mode',
        attributes: { test_mode: true, url: 'https://example.com' },
      },
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }),
  }),
  (error) => error instanceof LemonSqueezyCommerceRuntimeError
    && error.code === 'INVALID_LIVE_CHECKOUT',
);

let databaseCalled = false;
await assert.rejects(
  () => createCommerceCheckout({
    config: controlled,
    user: { id: '123e4567-e89b-42d3-a456-426614174000', email: 'not-qa@example.com' },
    idempotencyKey: 'controlled-live-qa-only',
    fetchImpl: async () => {
      databaseCalled = true;
      throw new Error('must not reach the database for a non-QA account');
    },
  }),
  (error) => error instanceof LemonSqueezyCommerceRuntimeError
    && error.code === 'COMMERCE_CONTROLLED_LIVE_QA_ONLY'
    && error.status === 403,
);
assert.equal(databaseCalled, false);

const productionLiveEnvironment = {
  ...controlledLiveEnvironment,
  COMMERCE_MODE: 'live',
  COMMERCE_CONTROLLED_LIVE_VERIFIED: 'true',
  COMMERCE_LIVE_APPROVED: 'true',
  VERCEL_ENV: 'production',
  SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
};
delete productionLiveEnvironment.COMMERCE_CONTROLLED_LIVE_QA_EMAIL;

const productionLive = readLemonSqueezyCommerceRuntimeConfig(productionLiveEnvironment);
assert.equal(productionLive.enabled, true);
assert.equal(productionLive.mode, 'live');
assert.equal(productionLive.testMode, false);
assert.equal(productionLive.controlledQaOnly, false);
assert.equal(productionLive.qaEmail, null);
assert.equal(productionLive.projectRef, 'gjzetjugmnwanvjkchux');
assert.equal(productionLive.readiness.state, 'active');

const productionReadiness = resolveCommerceReadiness(
  productionLiveEnvironment,
  [LEMON_SQUEEZY_ADAPTER_SCAFFOLD],
);
assert.equal(productionReadiness.state, 'active');
assert.equal(productionReadiness.checkoutEnabled, true);
assert.equal(productionReadiness.configuration.ready, true);

const disabledProductionReadiness = resolveCommerceReadiness(
  { COMMERCE_MODE: 'disabled', VERCEL_ENV: 'production' },
  [LEMON_SQUEEZY_ADAPTER_SCAFFOLD],
);
assert.equal(disabledProductionReadiness.state, 'ready_for_provider_configuration');
assert.equal(disabledProductionReadiness.provider, null);
assert.equal(disabledProductionReadiness.checkoutEnabled, false);

assert.throws(
  () => readLemonSqueezyCommerceRuntimeConfig({
    ...productionLiveEnvironment,
    LEMON_SQUEEZY_LIVE_REDIRECT_URL: 'https://preview.example.com/account/',
  }),
  (error) => error instanceof LemonSqueezyCommerceRuntimeError
    && error.code === 'COMMERCE_RELEASE_GATE_BLOCKED',
);
assert.throws(
  () => readLemonSqueezyCommerceRuntimeConfig({
    ...productionLiveEnvironment,
    SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  }),
  (error) => error instanceof LemonSqueezyCommerceRuntimeError
    && error.code === 'COMMERCE_DATABASE_PROJECT_MISMATCH',
);

console.log('Lemon Squeezy controlled Live and Production Live runtime tests passed.');
