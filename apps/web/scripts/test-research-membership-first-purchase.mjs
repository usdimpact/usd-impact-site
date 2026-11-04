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
const issuedProof = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const productionIssuedProof = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const intentId = '44444444-4444-4444-8444-444444444444';
const productionIntentId = '55555555-5555-4555-8555-555555555555';
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
        usd_impact_research_checkout_key: issuedProof,
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
    if (url === `${config.supabase.url}/rest/v1/rpc/issue_research_membership_checkout_intent`) {
      const body = JSON.parse(init.body);
      assert.equal(body.p_account_id, accountId);
      assert.equal(body.p_variant_id, '314');
      assert.equal(body.p_client_request_id, 'research-checkout-001');
      return new Response(JSON.stringify({
        action: 'reserved', intent_id: intentId, checkout_key: issuedProof,
        account_id: accountId, store_id: '42', variant_id: '314',
        billing_interval: 'monthly', test_mode: true,
        expires_at: '2026-09-07T15:30:00.000Z',
      }), { status: 200 });
    }
    if (url === `${config.supabase.url}/rest/v1/rpc/attach_research_membership_checkout_intent`) {
      const body = JSON.parse(init.body);
      assert.equal(body.p_intent_id, intentId);
      assert.equal(body.p_checkout_proof, issuedProof);
      assert.equal(body.p_provider_checkout_id, 'checkout_1');
      return new Response(JSON.stringify({
        action: 'attached', intent_id: intentId, provider_checkout_id: 'checkout_1',
      }), { status: 200 });
    }
    assert.equal(url, 'https://api.lemonsqueezy.com/v1/checkouts');
    assert.equal(init.method, 'POST');
    assert.match(init.headers.Authorization, /^Bearer test_api_key_/);
    const body = JSON.parse(init.body);
    assert.equal(body.data.attributes.checkout_data.custom.usd_impact_account_id, accountId);
    assert.equal(body.data.attributes.checkout_data.custom.usd_impact_research_checkout_key, issuedProof);
    assert.notEqual(body.data.attributes.checkout_data.custom.usd_impact_research_checkout_key, 'research-checkout-001');
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
  now: new Date('2026-09-07T15:00:00.000Z'),
  fetchImpl: async (url, init = {}) => {
    if (String(url).startsWith(`${productionConfig.supabase.url}/rest/v1/subscriptions?`)) {
      return new Response('[]', { status: 200 });
    }
    if (url === `${productionConfig.supabase.url}/rest/v1/rpc/issue_research_membership_checkout_intent`) {
      const body = JSON.parse(init.body);
      assert.equal(body.p_client_request_id, 'research-live-checkout-002');
      return new Response(JSON.stringify({
        action: 'reserved', intent_id: productionIntentId,
        checkout_key: productionIssuedProof,
        account_id: accountId, store_id: '142', variant_id: '414',
        billing_interval: 'monthly', test_mode: false,
        expires_at: '2026-09-07T15:30:00.000Z',
      }), { status: 200 });
    }
    if (url === `${productionConfig.supabase.url}/rest/v1/rpc/attach_research_membership_checkout_intent`) {
      const body = JSON.parse(init.body);
      assert.equal(body.p_intent_id, productionIntentId);
      assert.equal(body.p_checkout_proof, productionIssuedProof);
      return new Response(JSON.stringify({
        action: 'attached', intent_id: productionIntentId,
        provider_checkout_id: 'checkout_live_1',
      }), { status: 200 });
    }
    assert.equal(url, 'https://api.lemonsqueezy.com/v1/checkouts');
    assert.equal(init.method, 'POST');
    assert.match(init.headers.Authorization, /^Bearer research_live_api_key_/);
    const body = JSON.parse(init.body);
    assert.equal(body.data.attributes.test_mode, false);
    assert.equal(body.data.attributes.checkout_data.email, 'member@example.com');
    assert.equal(body.data.attributes.checkout_data.custom.usd_impact_research_checkout_key, productionIssuedProof);
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
assert.equal(inspected.metadata.checkoutKey, issuedProof);
assert.equal(inspected.metadata.testMode, true);
assert.equal(inspected.metadata.rawBodySha256, crypto.createHash('sha256').update(event.rawBody).digest('hex'));

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
    assert.equal(url, `${environment.SUPABASE_URL}/rest/v1/rpc/bind_research_membership_with_checkout_intent`);
    assert.equal(init.method, 'POST');
    const body = JSON.parse(init.body);
    assert.equal(body.p_checkout_proof, issuedProof);
    assert.equal(body.p_store_id, '42');
    assert.equal(body.p_product_id, 'research-membership');
    assert.notEqual(body.p_product_id, String(config.productId));
    assert.equal(body.p_test_mode, true);
    assert.equal(body.p_raw_body_sha256, inspected.metadata.rawBodySha256);
    assert.equal(body.p_account_id, accountId);
    assert.equal(body.p_provider, 'lemon-squeezy');
    assert.equal(body.p_provider_subscription_id, 'sub_first_1');
    assert.equal(body.p_provider_customer_id, '456');
    assert.equal(body.p_provider_price_id, '314');
    assert.equal(body.p_billing_interval, 'monthly');
    bindCalls += 1;
    return new Response(JSON.stringify({ action: 'created', subscription_id: subscriptionId,
      subscription_state: 'pending', raw_body_sha256: inspected.metadata.rawBodySha256 }), { status: 200 });
  },
});
assert.equal(bindCalls, 1);
assert.equal(bound.action, 'created');

let processCalls = 0;
let wrapperBindCalls = 0;
let observedSignedPaidCalls = 0;
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
  fetchImpl: async (url, init) => {
    if (url === `${environment.SUPABASE_URL}/rest/v1/rpc/observe_signed_research_subscription_created`) {
      const body = JSON.parse(init.body);
      const sha = crypto.createHash('sha256').update(event.rawBody).digest('hex');
      assert.equal(body.p_raw_body_sha256, sha);
      assert.equal(body.p_product_id, 'research-membership');
      assert.notEqual(body.p_product_id, String(config.productId));
      assert.equal(body.p_provider_subscription_id, 'sub_first_1');
      assert.equal(body.p_claimed_account_id, accountId);
      assert.equal(body.p_claimed_checkout_proof_sha256,
        crypto.createHash('sha256').update(issuedProof).digest('hex'));
      observedSignedPaidCalls += 1;
      return new Response(JSON.stringify({
        action: 'recorded', provider_subscription_id: 'sub_first_1',
        raw_body_sha256: sha,
      }), { status: 200 });
    }
    assert.equal(url, `${environment.SUPABASE_URL}/rest/v1/rpc/bind_research_membership_with_checkout_intent`);
    wrapperBindCalls += 1;
    return new Response(JSON.stringify({ action: 'existing', subscription_id: subscriptionId,
      subscription_state: 'pending', raw_body_sha256: inspected.metadata.rawBodySha256 }), { status: 200 });
  },
});
assert.equal(processCalls, 2);
assert.equal(wrapperBindCalls, 1);
assert.equal(observedSignedPaidCalls, 1);
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


let unknownIntentProviderCalls = 0;
await assert.rejects(
  () => createResearchMembershipCheckout({
    config, user, billingInterval: 'monthly', idempotencyKey: 'client-supplied-key-001',
    now: new Date('2026-09-07T15:00:00.000Z'),
    fetchImpl: async (url) => {
      if (String(url).includes('/rest/v1/subscriptions?')) return new Response('[]', { status: 200 });
      if (String(url).includes('/rpc/issue_research_membership_checkout_intent')) {
        return new Response(JSON.stringify({ error: 'not_installed' }), { status: 404 });
      }
      unknownIntentProviderCalls += 1;
      return new Response('{}', { status: 201 });
    },
  }),
  { code: 'RESEARCH_CHECKOUT_INTENT_UNAVAILABLE', status: 503 },
);
assert.equal(unknownIntentProviderCalls, 0, 'No provider checkout without a committed private issuer');

for (const mismatch of [
  { account_id: '99999999-9999-4999-8999-999999999999' },
  { checkout_key: 'client-supplied-key-001' },
  { variant_id: '315' },
  { expires_at: '2026-09-07T16:00:00.000Z' },
]) {
  let unexpectedProviderWrites = 0;
  await assert.rejects(
    () => createResearchMembershipCheckout({
      config, user, billingInterval: 'monthly', idempotencyKey: 'request-uid-12345',
      now: new Date('2026-09-07T15:00:00.000Z'),
      fetchImpl: async (url) => {
        if (String(url).includes('/rest/v1/subscriptions?')) return new Response('[]', { status: 200 });
        if (String(url).includes('/rpc/issue_research_membership_checkout_intent')) {
          return new Response(JSON.stringify({
            action: 'reserved', intent_id: intentId, checkout_key: issuedProof,
            account_id: accountId, store_id: '42', variant_id: '314',
            billing_interval: 'monthly', test_mode: true,
            expires_at: '2026-09-07T15:30:00.000Z',
            ...mismatch,
          }), { status: 200 });
        }
        unexpectedProviderWrites += 1;
        return new Response('{}', { status: 201 });
      },
    }),
    { status: 503 },
  );
  assert.equal(unexpectedProviderWrites, 0, 'Inconsistent issuer output must never reach Lemon Squeezy');
}

const forgedSignedPayload = payload();
forgedSignedPayload.meta.custom_data.usd_impact_research_checkout_key = 'F'.repeat(43);
const forgedEvent = signed(forgedSignedPayload);
let forgedProcessCalls = 0;
let forgedBindAttempts = 0;
await assert.rejects(
  () => processResearchMembershipWebhookWithFirstPurchase({
    ...forgedEvent, environment,
    processImpl: async () => {
      forgedProcessCalls += 1;
      const error = new Error('No matching subscription');
      error.code = 'RESEARCH_WEBHOOK_SUBSCRIPTION_NOT_FOUND';
      error.status = 409;
      throw error;
    },
    fetchImpl: async (url) => {
      if (url === `${environment.SUPABASE_URL}/rest/v1/rpc/observe_signed_research_subscription_created`) {
        return new Response(JSON.stringify({
          action: 'recorded', provider_subscription_id: 'sub_first_1',
          raw_body_sha256: crypto.createHash('sha256').update(forgedEvent.rawBody).digest('hex'),
        }), { status: 200 });
      }
      assert.equal(url, `${environment.SUPABASE_URL}/rest/v1/rpc/bind_research_membership_with_checkout_intent`);
      forgedBindAttempts += 1;
      return new Response(JSON.stringify({ error: 'reservation_missing' }), { status: 409 });
    },
  }),
  { code: 'RESEARCH_FIRST_PURCHASE_TRUSTED_BINDING_UNAVAILABLE', status: 503 },
);
assert.equal(forgedProcessCalls, 1, 'Untrusted checkout metadata must never re-enter entitlement processing');
assert.equal(forgedBindAttempts, 1);
assert.throws(
  () => inspectResearchMembershipFirstPurchase({
    ...signed({ ...payload(), meta: { ...payload().meta, custom_data: {
      ...payload().meta.custom_data, usd_impact_research_checkout_key: 'guessed-short-key',
    } } }), environment,
  }),
  { code: 'RESEARCH_CHECKOUT_INTENT_PROOF_INVALID' },
);


let attachProviderCalls = 0;
await assert.rejects(
  () => createResearchMembershipCheckout({
    config, user, billingInterval: 'monthly', idempotencyKey: 'attach-test-001',
    now: new Date('2026-09-07T15:00:00.000Z'),
    fetchImpl: async (url) => {
      if (String(url).includes('/rest/v1/subscriptions?')) return new Response('[]', { status: 200 });
      if (String(url).includes('/rpc/issue_research_membership_checkout_intent')) {
        return new Response(JSON.stringify({
          action: 'reserved', intent_id: intentId, checkout_key: issuedProof,
          account_id: accountId, store_id: '42', variant_id: '314',
          billing_interval: 'monthly', test_mode: true,
          expires_at: '2026-09-07T15:30:00.000Z',
        }), { status: 200 });
      }
      if (String(url).includes('/rpc/attach_research_membership_checkout_intent')) {
        return new Response(JSON.stringify({ error: 'durable_attach_failed' }), { status: 503 });
      }
      assert.equal(url, 'https://api.lemonsqueezy.com/v1/checkouts');
      attachProviderCalls += 1;
      return new Response(JSON.stringify({
        data: {
          type: 'checkouts', id: 'orphan_checkout',
          attributes: {
            store_id: 42, variant_id: 314, test_mode: true,
            url: 'https://example.lemonsqueezy.com/checkout/orphan_checkout',
          },
        },
      }), { status: 201 });
    },
  }),
  { code: 'RESEARCH_CHECKOUT_INTENT_ATTACH_FAILED', status: 503 },
);
assert.equal(attachProviderCalls, 1, 'Failed durable attach must withhold the provider URL');

let unreadableIssuerProviderCalls = 0;
await assert.rejects(
  () => createResearchMembershipCheckout({
    config, user, billingInterval: 'monthly', idempotencyKey: 'unreadable-issuer-001',
    fetchImpl: async (url) => {
      if (String(url).includes('/rest/v1/subscriptions?')) return new Response('[]', { status: 200 });
      if (String(url).includes('/rpc/issue_research_membership_checkout_intent')) {
        return { ok: true, async text() { throw new Error('private read failure'); } };
      }
      unreadableIssuerProviderCalls += 1;
      throw new Error('No merchant request may be made');
    },
  }),
  { code: 'RESEARCH_CHECKOUT_INTENT_UNAVAILABLE', status: 503 },
);
assert.equal(unreadableIssuerProviderCalls, 0, 'Unreadable issuer response cannot start a purchase');

await assert.rejects(
  () => bindResearchMembershipFirstPurchase({
    binding: inspected, environment,
    fetchImpl: async () => { throw new Error('internal database network failure'); },
  }),
  { code: 'RESEARCH_FIRST_PURCHASE_TRUSTED_BINDING_UNAVAILABLE', status: 503 },
);


const directShareWithoutBinding = payload();
delete directShareWithoutBinding.meta.custom_data;
const unboundSignedEvent = signed(directShareWithoutBinding);
let unboundProcessingAttempts = 0;
let unboundEvidenceCommits = 0;
const unboundResult = await processResearchMembershipWebhookWithFirstPurchase({
  ...unboundSignedEvent, environment,
  processImpl: async () => {
    unboundProcessingAttempts += 1;
    const error = new Error('no signed local binding');
    error.code = 'RESEARCH_WEBHOOK_SUBSCRIPTION_NOT_FOUND';
    throw error;
  },
  fetchImpl: async (url, init) => {
    assert.equal(url, `${environment.SUPABASE_URL}/rest/v1/rpc/observe_signed_research_subscription_created`);
    const body = JSON.parse(init.body);
    assert.equal(body.p_claimed_account_id, null);
    assert.equal(body.p_product_id, 'research-membership');
    assert.equal(body.p_claimed_checkout_proof_sha256, null);
    assert.equal(body.p_raw_body_sha256,
      crypto.createHash('sha256').update(unboundSignedEvent.rawBody).digest('hex'));
    unboundEvidenceCommits += 1;
    return new Response(JSON.stringify({
      action: 'recorded', provider_subscription_id: 'sub_first_1',
      raw_body_sha256: body.p_raw_body_sha256,
    }), { status: 200 });
  },
});
assert.equal(unboundResult.action, 'held_unbound');
assert.equal(unboundProcessingAttempts, 1, 'Signed but unbound event cannot retry entitlement processing');
assert.equal(unboundEvidenceCommits, 1, 'Signed unbound event must be durably observed before provider ACK');

let noCustodyBindCalls = 0;
await assert.rejects(
  () => processResearchMembershipWebhookWithFirstPurchase({
    ...unboundSignedEvent, environment,
    processImpl: async () => {
      const error = new Error('no local binding');
      error.code = 'RESEARCH_WEBHOOK_SUBSCRIPTION_NOT_FOUND';
      throw error;
    },
    fetchImpl: async (url) => {
      assert.equal(url, `${environment.SUPABASE_URL}/rest/v1/rpc/observe_signed_research_subscription_created`);
      noCustodyBindCalls += 1;
      return new Response('{}', { status: 404 });
    },
  }),
  { code: 'RESEARCH_PAID_EVIDENCE_UNAVAILABLE', status: 503 },
);
assert.equal(noCustodyBindCalls, 1, 'No binding may follow failed paid evidence custody');

let conflictBindCalls = 0;
const conflictHeld = await processResearchMembershipWebhookWithFirstPurchase({
  ...event, environment,
  processImpl: async () => {
    const error = new Error('no local binding');
    error.code = 'RESEARCH_WEBHOOK_SUBSCRIPTION_NOT_FOUND';
    throw error;
  },
  fetchImpl: async (url) => {
    assert.equal(url, `${environment.SUPABASE_URL}/rest/v1/rpc/observe_signed_research_subscription_created`);
    conflictBindCalls += 1;
    return new Response(JSON.stringify({
      action: 'conflict_recorded', provider_subscription_id: 'sub_first_1',
      raw_body_sha256: crypto.createHash('sha256').update(event.rawBody).digest('hex'),
    }), { status: 200 });
  },
});
assert.equal(conflictHeld.action, 'held_paid_evidence_conflict');
assert.equal(conflictBindCalls, 1, 'Immutable conflicting event evidence never authorizes an account bind');


let paidConflictProcessing = 0;
let committedPaidConflict = 0;
const duplicatePaidResult = await processResearchMembershipWebhookWithFirstPurchase({
  ...event, environment,
  processImpl: async () => {
    paidConflictProcessing += 1;
    const error = new Error('not yet linked');
    error.code = 'RESEARCH_WEBHOOK_SUBSCRIPTION_NOT_FOUND';
    throw error;
  },
  fetchImpl: async (url) => {
    if (url.endsWith('/rpc/observe_signed_research_subscription_created')) {
      committedPaidConflict += 1;
      return new Response(JSON.stringify({
        action: 'recorded', provider_subscription_id: 'sub_first_1',
        raw_body_sha256: inspected.metadata.rawBodySha256,
      }), { status: 200 });
    }
    assert.ok(url.endsWith('/rpc/bind_research_membership_with_checkout_intent'));
    return new Response(JSON.stringify({
      action: 'conflict', code: 'duplicate_paid_subscription',
      conflict_evidence_id: '66666666-6666-4666-8666-666666666666',
      raw_body_sha256: inspected.metadata.rawBodySha256,
    }), { status: 200 });
  },
});
assert.equal(duplicatePaidResult.action, 'held_paid_binding_conflict');
assert.equal(duplicatePaidResult.reason, 'duplicate_paid_subscription');
assert.equal(paidConflictProcessing, 1, 'Duplicate paid never activates a second subscription');
assert.equal(committedPaidConflict, 1, 'Duplicate paid evidence must be pre-committed before conflict');

await assert.rejects(
  () => bindResearchMembershipFirstPurchase({
    binding: inspected, environment,
    fetchImpl: async () => new Response(JSON.stringify({
      action: 'conflict', code: 'duplicate_paid_subscription',
      conflict_evidence_id: '66666666-6666-4666-8666-666666666666',
      raw_body_sha256: 'f'.repeat(64),
    }), { status: 200 }),
  }),
  { code: 'RESEARCH_FIRST_PURCHASE_BINDING_INVALID', status: 502 },
);
await assert.rejects(
  () => bindResearchMembershipFirstPurchase({
    binding: { ...inspected, metadata: { ...inspected.metadata, rawBodySha256: 'bad' } },
    environment,
    fetchImpl: async () => {
      throw new Error('Invalid signed observation identity must stop before DB call');
    },
  }),
  { code: 'RESEARCH_FIRST_PURCHASE_OBSERVATION_INVALID', status: 503 },
);

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
