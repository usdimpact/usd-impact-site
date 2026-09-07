import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  bindResearchMembershipFirstPurchase,
  buildResearchMembershipCheckoutRequest,
  createResearchMembershipCheckout,
  inspectResearchMembershipFirstPurchase,
  processResearchMembershipWebhookWithFirstPurchase,
  readResearchMembershipCheckoutConfig,
} from '../src/lib/research-membership-first-purchase.js';

const accountId = '11111111-1111-4111-8111-111111111111';
const subscriptionId = '22222222-2222-4222-8222-222222222222';
const environment = {
  VERCEL_ENV: 'preview',
  RESEARCH_MEMBERSHIP_WEBHOOK_ENABLED: 'true',
  LEMON_SQUEEZY_RESEARCH_TEST_MODE: 'true',
  LEMON_SQUEEZY_RESEARCH_TEST_WEBHOOK_SECRET: 'research-first-purchase-test-secret',
  LEMON_SQUEEZY_RESEARCH_TEST_STORE_ID: '42',
  LEMON_SQUEEZY_RESEARCH_TEST_PRODUCT_ID: '99',
  LEMON_SQUEEZY_RESEARCH_TEST_MONTHLY_VARIANT_ID: '314',
  LEMON_SQUEEZY_RESEARCH_TEST_ANNUAL_VARIANT_ID: '315',
  LEMON_SQUEEZY_TEST_API_KEY: 'test_api_key_abcdefghijklmnopqrstuvwxyz',
  COMMERCE_SANDBOX_QA_EMAIL: 'qa@example.com',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
};
const productionEnvironment = {
  VERCEL_ENV: 'production',
  RESEARCH_MEMBERSHIP_WEBHOOK_ENABLED: 'true',
  RESEARCH_MEMBERSHIP_PRODUCTION_ACTIVATION_APPROVED: 'true',
  RESEARCH_MEMBERSHIP_PRODUCTION_CHECKOUT_ENABLED: 'true',
  LEMON_SQUEEZY_RESEARCH_PRODUCTION_TEST_MODE: 'false',
  LEMON_SQUEEZY_RESEARCH_PRODUCTION_WEBHOOK_SECRET: 'research-first-purchase-live-secret',
  LEMON_SQUEEZY_RESEARCH_PRODUCTION_STORE_ID: '142',
  LEMON_SQUEEZY_RESEARCH_PRODUCTION_PRODUCT_ID: '199',
  LEMON_SQUEEZY_RESEARCH_PRODUCTION_MONTHLY_VARIANT_ID: '414',
  LEMON_SQUEEZY_RESEARCH_PRODUCTION_ANNUAL_VARIANT_ID: '415',
  LEMON_SQUEEZY_RESEARCH_PRODUCTION_API_KEY: 'research_live_api_key_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
};
const user = { id: accountId, email: 'qa@example.com' };
const productionUser = { id: accountId, email: 'member@example.com' };

function payload(overrides = {}) {
  return {
    meta: {
      event_name: 'subscription_created',
      custom_data: {
        usd_impact_account_id: accountId,
        usd_impact_research_product_id: 'research-membership',
        usd_impact_research_billing_interval: 'monthly',
        usd_impact_research_checkout_key: 'research-checkout-001',
      },
    },
    data: {
      type: 'subscriptions',
      id: 'sub_first_1',
      attributes: {
        store_id: 42,
        customer_id: 456,
        product_id: 99,
        variant_id: 314,
        status: 'active',
        cancelled: false,
        trial_ends_at: null,
        created_at: '2026-09-07T15:45:00.000Z',
        renews_at: '2026-10-07T15:45:00.000Z',
        test_mode: true,
        ...overrides,
      },
    },
  };
}

function productionPayload(overrides = {}) {
  return payload({
    store_id: 142,
    product_id: 199,
    variant_id: 414,
    test_mode: false,
    ...overrides,
  });
}

function signed(value = payload(), signingEnvironment = environment) {
  const rawBody = Buffer.from(JSON.stringify(value));
  const secret = signingEnvironment.VERCEL_ENV === 'production'
    ? signingEnvironment.LEMON_SQUEEZY_RESEARCH_PRODUCTION_WEBHOOK_SECRET
    : signingEnvironment.LEMON_SQUEEZY_RESEARCH_TEST_WEBHOOK_SECRET;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return { rawBody, signature };
}

const config = readResearchMembershipCheckoutConfig(environment);
assert.equal(config.testMode, true);
assert.equal(config.controlledQaOnly, true);
assert.equal(config.storeId, 42);
assert.equal(config.monthlyVariantId, 314);
assert.equal(config.annualVariantId, 315);
assert.throws(
  () => readResearchMembershipCheckoutConfig({ ...environment, LEMON_SQUEEZY_RESEARCH_TEST_MODE: 'false' }),
  { code: 'RESEARCH_FIRST_PURCHASE_TEST_MODE_REQUIRED' },
);
assert.throws(
  () => readResearchMembershipCheckoutConfig({ ...environment, SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co' }),
  { code: 'RESEARCH_FIRST_PURCHASE_DATABASE_MISMATCH' },
);

const productionConfig = readResearchMembershipCheckoutConfig(productionEnvironment);
assert.equal(productionConfig.testMode, false);
assert.equal(productionConfig.controlledQaOnly, false);
assert.equal(productionConfig.qaEmail, null);
assert.equal(productionConfig.storeId, 142);
assert.equal(productionConfig.monthlyVariantId, 414);
assert.equal(productionConfig.annualVariantId, 415);
assert.throws(
  () => readResearchMembershipCheckoutConfig({
    ...productionEnvironment,
    RESEARCH_MEMBERSHIP_PRODUCTION_CHECKOUT_ENABLED: 'false',
  }),
  { code: 'RESEARCH_CHECKOUT_DISABLED' },
);
assert.throws(
  () => readResearchMembershipCheckoutConfig({
    ...productionEnvironment,
    RESEARCH_MEMBERSHIP_PRODUCTION_ACTIVATION_APPROVED: 'false',
  }),
  { code: 'RESEARCH_FIRST_PURCHASE_PRODUCTION_NOT_APPROVED' },
);
assert.throws(
  () => readResearchMembershipCheckoutConfig({
    ...productionEnvironment,
    LEMON_SQUEEZY_RESEARCH_PRODUCTION_TEST_MODE: 'true',
  }),
  { code: 'RESEARCH_FIRST_PURCHASE_PRODUCTION_TEST_MODE_REJECTED' },
);
assert.throws(
  () => readResearchMembershipCheckoutConfig({
    ...productionEnvironment,
    SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  }),
  { code: 'RESEARCH_FIRST_PURCHASE_DATABASE_MISMATCH' },
);
assert.throws(
  () => readResearchMembershipCheckoutConfig({
    ...productionEnvironment,
    LEMON_SQUEEZY_RESEARCH_PRODUCTION_ANNUAL_VARIANT_ID: '414',
  }),
  { code: 'RESEARCH_FIRST_PURCHASE_CONFIGURATION_INVALID' },
);

const checkoutRequest = buildResearchMembershipCheckoutRequest({
  config,
  user,
  billingInterval: 'monthly',
  idempotencyKey: 'research-checkout-001',
  now: new Date('2026-09-07T15:00:00.000Z'),
});
assert.equal(checkoutRequest.data.attributes.test_mode, true);
assert.equal(checkoutRequest.data.attributes.checkout_options.discount, false);
assert.equal(checkoutRequest.data.attributes.checkout_options.skip_trial, true);
assert.equal(checkoutRequest.data.attributes.expires_at, '2026-09-07T15:30:00.000Z');
assert.deepEqual(checkoutRequest.data.attributes.product_options.enabled_variants, [314]);
assert.equal(checkoutRequest.data.relationships.store.data.id, '42');
assert.equal(checkoutRequest.data.relationships.variant.data.id, '314');
assert.equal(checkoutRequest.data.attributes.checkout_data.custom.usd_impact_account_id, accountId);
assert.equal(checkoutRequest.data.attributes.checkout_data.custom.usd_impact_research_product_id, 'research-membership');
assert.equal(checkoutRequest.data.attributes.checkout_data.custom.usd_impact_research_billing_interval, 'monthly');
assert.equal(checkoutRequest.data.attributes.checkout_data.custom.usd_impact_research_checkout_key, 'research-checkout-001');
assert.equal(Object.hasOwn(checkoutRequest.data.attributes, 'custom_price'), false);
assert.throws(
  () => buildResearchMembershipCheckoutRequest({ config, user: { ...user, email: 'other@example.com' }, billingInterval: 'monthly', idempotencyKey: 'research-checkout-001' }),
  { code: 'RESEARCH_CHECKOUT_QA_ACCOUNT_REQUIRED' },
);
assert.throws(
  () => buildResearchMembershipCheckoutRequest({ config, user, billingInterval: 'weekly', idempotencyKey: 'research-checkout-001' }),
  { code: 'RESEARCH_CHECKOUT_INTERVAL_INVALID' },
);

const productionCheckoutRequest = buildResearchMembershipCheckoutRequest({
  config: productionConfig,
  user: productionUser,
  billingInterval: 'annual',
  idempotencyKey: 'research-live-checkout-001',
  now: new Date('2026-09-07T15:00:00.000Z'),
});
assert.equal(productionCheckoutRequest.data.attributes.test_mode, false);
assert.equal(productionCheckoutRequest.data.attributes.checkout_options.discount, false);
assert.equal(productionCheckoutRequest.data.attributes.checkout_options.skip_trial, true);
assert.deepEqual(productionCheckoutRequest.data.attributes.product_options.enabled_variants, [415]);
assert.equal(productionCheckoutRequest.data.attributes.checkout_data.email, 'member@example.com');
assert.equal(productionCheckoutRequest.data.attributes.checkout_data.custom.usd_impact_research_billing_interval, 'annual');

let providerCalls = 0;
const checkout = await createResearchMembershipCheckout({
  config,
  user,
  billingInterval: 'monthly',
  idempotencyKey: 'research-checkout-001',
  now: new Date('2026-09-07T15:00:00.000Z'),
  fetchImpl: async (url, init = {}) => {
    if (String(url).startsWith(`${config.supabase.url}/rest/v1/subscriptions?`)) {
      assert.equal(init.method, undefined);
      const parsed = new URL(url);
      assert.equal(parsed.searchParams.get('product_id'), 'eq.research-membership');
      assert.equal(parsed.searchParams.get('state'), 'in.(pending,active,past_due,cancel_scheduled)');
      return new Response('[]', { status: 200 });
    }
    assert.equal(url, 'https://api.lemonsqueezy.com/v1/checkouts');
    assert.equal(init.method, 'POST');
    assert.match(init.headers.Authorization, /^Bearer test_api_key_/);
    const body = JSON.parse(init.body);
    assert.equal(body.data.attributes.checkout_data.custom.usd_impact_account_id, accountId);
    assert.equal(body.data.attributes.checkout_data.custom.usd_impact_research_checkout_key, 'research-checkout-001');
    providerCalls += 1;
    return new Response(JSON.stringify({
      data: {
        type: 'checkouts',
        id: 'checkout_1',
        attributes: {
          store_id: 42,
          variant_id: 314,
          test_mode: true,
          url: 'https://example.lemonsqueezy.com/checkout/custom/checkout_1',
        },
      },
    }), { status: 201 });
  },
});
assert.equal(providerCalls, 1);
assert.equal(checkout.checkoutId, 'checkout_1');
assert.equal(checkout.billingInterval, 'monthly');
assert.equal(checkout.testMode, true);

let productionProviderCalls = 0;
const productionCheckout = await createResearchMembershipCheckout({
  config: productionConfig,
  user: productionUser,
  billingInterval: 'monthly',
  idempotencyKey: 'research-live-checkout-002',
  fetchImpl: async (url, init = {}) => {
    if (String(url).startsWith(`${productionConfig.supabase.url}/rest/v1/subscriptions?`)) {
      return new Response('[]', { status: 200 });
    }
    assert.equal(url, 'https://api.lemonsqueezy.com/v1/checkouts');
    assert.equal(init.method, 'POST');
    assert.match(init.headers.Authorization, /^Bearer research_live_api_key_/);
    const body = JSON.parse(init.body);
    assert.equal(body.data.attributes.test_mode, false);
    assert.equal(body.data.attributes.checkout_data.email, 'member@example.com');
    productionProviderCalls += 1;
    return new Response(JSON.stringify({
      data: {
        type: 'checkouts',
        id: 'checkout_live_1',
        attributes: {
          store_id: 142,
          variant_id: 414,
          test_mode: false,
          url: 'https://example.lemonsqueezy.com/checkout/custom/checkout_live_1',
        },
      },
    }), { status: 201 });
  },
});
assert.equal(productionProviderCalls, 1);
assert.equal(productionCheckout.checkoutId, 'checkout_live_1');
assert.equal(productionCheckout.testMode, false);

let blockedProviderCalls = 0;
await assert.rejects(
  () => createResearchMembershipCheckout({
    config,
    user,
    billingInterval: 'monthly',
    idempotencyKey: 'research-checkout-002',
    fetchImpl: async (url) => {
      if (String(url).startsWith(`${config.supabase.url}/rest/v1/subscriptions?`)) {
        return new Response(JSON.stringify([{ id: subscriptionId, state: 'active' }]), { status: 200 });
      }
      blockedProviderCalls += 1;
      return new Response('{}', { status: 500 });
    },
  }),
  { code: 'RESEARCH_CHECKOUT_CURRENT_SUBSCRIPTION_EXISTS', status: 409 },
);
assert.equal(blockedProviderCalls, 0);

const event = signed();
const inspected = inspectResearchMembershipFirstPurchase({ ...event, environment });
assert.equal(inspected.accountId, accountId);
assert.equal(inspected.providerSubscriptionId, 'sub_first_1');
assert.equal(inspected.providerCustomerId, '456');
assert.equal(inspected.providerPriceId, '314');
assert.equal(inspected.billingInterval, 'monthly');
assert.equal(inspected.metadata.checkoutKey, 'research-checkout-001');
assert.equal(inspected.metadata.testMode, true);

const productionEvent = signed(productionPayload(), productionEnvironment);
const productionInspected = inspectResearchMembershipFirstPurchase({
  ...productionEvent,
  environment: { ...productionEnvironment, RESEARCH_MEMBERSHIP_PRODUCTION_CHECKOUT_ENABLED: 'false' },
});
assert.equal(productionInspected.providerPriceId, '414');
assert.equal(productionInspected.billingInterval, 'monthly');
assert.equal(productionInspected.metadata.testMode, false);

for (const [label, mutate, expectedCode] of [
  ['variant', (value) => { value.data.attributes.variant_id = 999; }, 'RESEARCH_FIRST_PURCHASE_VARIANT_MISMATCH'],
  ['trial', (value) => { value.data.attributes.trial_ends_at = '2026-09-08T00:00:00.000Z'; }, 'RESEARCH_FIRST_PURCHASE_STATE_INVALID'],
  ['event', (value) => { value.meta.event_name = 'subscription_updated'; }, 'RESEARCH_FIRST_PURCHASE_EVENT_REQUIRED'],
  ['product custom data', (value) => { value.meta.custom_data.usd_impact_research_product_id = 'library-pass'; }, 'RESEARCH_FIRST_PURCHASE_CUSTOM_DATA_MISMATCH'],
  ['interval custom data', (value) => { value.meta.custom_data.usd_impact_research_billing_interval = 'annual'; }, 'RESEARCH_FIRST_PURCHASE_CUSTOM_DATA_MISMATCH'],
]) {
  const value = payload();
  mutate(value);
  const attempt = signed(value);
  assert.throws(
    () => inspectResearchMembershipFirstPurchase({ ...attempt, environment }),
    { code: expectedCode },
    label,
  );
}
assert.throws(
  () => inspectResearchMembershipFirstPurchase({ ...event, signature: '0'.repeat(64), environment }),
  { code: 'RESEARCH_WEBHOOK_SIGNATURE_INVALID', status: 401 },
);
assert.throws(
  () => inspectResearchMembershipFirstPurchase({
    ...productionEvent,
    environment: { ...productionEnvironment, RESEARCH_MEMBERSHIP_PRODUCTION_ACTIVATION_APPROVED: 'false' },
  }),
  { code: 'RESEARCH_FIRST_PURCHASE_PRODUCTION_NOT_APPROVED' },
);

let bindCalls = 0;
const bound = await bindResearchMembershipFirstPurchase({
  binding: inspected,
  environment,
  fetchImpl: async (url, init) => {
    assert.equal(url, `${environment.SUPABASE_URL}/rest/v1/rpc/bind_research_membership_subscription`);
    assert.equal(init.method, 'POST');
    const body = JSON.parse(init.body);
    assert.equal(body.p_account_id, accountId);
    assert.equal(body.p_provider, 'lemon-squeezy');
    assert.equal(body.p_provider_subscription_id, 'sub_first_1');
    assert.equal(body.p_provider_customer_id, '456');
    assert.equal(body.p_provider_price_id, '314');
    assert.equal(body.p_billing_interval, 'monthly');
    bindCalls += 1;
    return new Response(JSON.stringify({ action: 'created', subscription_id: subscriptionId, subscription_state: 'pending' }), { status: 200 });
  },
});
assert.equal(bindCalls, 1);
assert.equal(bound.action, 'created');

let processCalls = 0;
let wrapperBindCalls = 0;
const wrapperResult = await processResearchMembershipWebhookWithFirstPurchase({
  ...event,
  environment,
  processImpl: async () => {
    processCalls += 1;
    if (processCalls === 1) {
      const error = new Error('missing');
      error.code = 'RESEARCH_WEBHOOK_SUBSCRIPTION_NOT_FOUND';
      error.status = 409;
      throw error;
    }
    return { action: 'applied', eventKey: 'lemon-squeezy:event' };
  },
  fetchImpl: async (url) => {
    assert.equal(url, `${environment.SUPABASE_URL}/rest/v1/rpc/bind_research_membership_subscription`);
    wrapperBindCalls += 1;
    return new Response(JSON.stringify({ action: 'existing', subscription_id: subscriptionId, subscription_state: 'pending' }), { status: 200 });
  },
});
assert.equal(processCalls, 2);
assert.equal(wrapperBindCalls, 1);
assert.equal(wrapperResult.action, 'applied');

let unexpectedFetches = 0;
await assert.rejects(
  () => processResearchMembershipWebhookWithFirstPurchase({
    ...event,
    environment,
    processImpl: async () => {
      const error = new Error('signature');
      error.code = 'RESEARCH_WEBHOOK_SIGNATURE_INVALID';
      error.status = 401;
      throw error;
    },
    fetchImpl: async () => {
      unexpectedFetches += 1;
      return new Response('{}', { status: 500 });
    },
  }),
  { code: 'RESEARCH_WEBHOOK_SIGNATURE_INVALID' },
);
assert.equal(unexpectedFetches, 0);

const migration = await readFile(
  new URL('../../../supabase/migrations/20260907154500_research_membership_first_purchase_binding.sql', import.meta.url),
  'utf8',
);
assert.match(migration, /^begin;/i);
assert.match(migration, /create or replace function public\.bind_research_membership_subscription\(/i);
assert.match(migration, /language plpgsql\s+security definer\s+set search_path = public/i);
assert.match(migration, /product_id <> 'research-membership'|product_id = 'research-membership'/i);
assert.match(migration, /p_provider <> 'lemon-squeezy'/i);
assert.match(migration, /status = 'active'/i);
assert.match(migration, /state in \('pending', 'active', 'past_due', 'cancel_scheduled'\)/i);
assert.match(migration, /insert into public\.subscriptions[\s\S]*?'pending'/i);
assert.match(migration, /provider subscription binding conflicts with existing evidence/i);
assert.match(migration, /grant execute on function public\.bind_research_membership_subscription\([\s\S]*?to service_role;/i);
assert.doesNotMatch(migration, /grant\s+insert\s+on\s+(?:table\s+)?public\.subscriptions\s+to\s+service_role/i);
assert.doesNotMatch(migration, /grant\s+(?:all|delete|truncate)\b[\s\S]*?service_role/i);
assert.doesNotMatch(migration, /usd-impact-production|gjzetjugmnwanvjkchux/i);
assert.match(migration, /commit;\s*$/i);

const commerceRoute = await readFile(new URL('../api/commerce.js', import.meta.url), 'utf8');
assert.match(commerceRoute, /testMode:\s*result\.testMode/);

console.log('Research Membership first-purchase checkout and binding regressions passed.');
