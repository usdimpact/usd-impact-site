// D1 ONLY: capture real application JS RPC bodies with entirely fake data.
// No provider or Supabase network traffic, no secrets and no customer records.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  createResearchMembershipCheckout,
  processResearchMembershipWebhookWithFirstPurchase,
  readResearchMembershipCheckoutConfig,
} from '../src/lib/research-membership-first-purchase.js';

const account = '88888888-8888-4888-8888-888888888888';
if (process.env.GITHUB_ACTIONS !== 'true'
    || process.env.GITHUB_HEAD_REF !== 'agent/1103-b5-rpc-sql-isolated-d1-20261104') {
  throw new Error('Real JS-to-Postgres bridge runs only in isolated B5 Draft CI');
}
const issued = JSON.parse(process.env.RESEARCH_B5_ISSUED_INTENT_JSON || '{}');
const intent = issued.intent_id;
const proof = issued.checkout_key;
assert.match(intent || '', /^[a-f0-9-]{36}$/i);
assert.match(proof || '', /^[A-Za-z0-9_-]{43}$/);
const subscription = 'sub_b5_real_js_bridge';
const checkoutId = 'checkout_b5_js_bridge';
const now = new Date();
const env = {
  VERCEL_ENV: 'preview', RESEARCH_MEMBERSHIP_WEBHOOK_ENABLED: 'true',
  LEMON_SQUEEZY_RESEARCH_TEST_MODE: 'true',
  LEMON_SQUEEZY_RESEARCH_TEST_WEBHOOK_SECRET: 'synthetic-b5-only',
  LEMON_SQUEEZY_RESEARCH_TEST_STORE_ID: '42',
  LEMON_SQUEEZY_RESEARCH_TEST_PRODUCT_ID: '99',
  LEMON_SQUEEZY_RESEARCH_TEST_MONTHLY_VARIANT_ID: '314',
  LEMON_SQUEEZY_RESEARCH_TEST_ANNUAL_VARIANT_ID: '315',
  LEMON_SQUEEZY_TEST_API_KEY: 'test_only_synthetic_b5_api_key_abcdefghijklmnopqrstuvwxyz',
  COMMERCE_SANDBOX_QA_EMAIL: 'synthetic@example.com',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
};
const config = readResearchMembershipCheckoutConfig(env);
const requests = {};
let providerCalls = 0;
const checkout = await createResearchMembershipCheckout({
  config,
  user: { id: account, email: 'synthetic@example.com' },
  billingInterval: 'monthly',
  idempotencyKey: 'b5-real-js-bridge-request-001',
  now,
  fetchImpl: async (url, init = {}) => {
    if (url.startsWith(config.supabase.url + '/rest/v1/subscriptions?')) {
      return new Response('[]', { status: 200 });
    }
    if (url.endsWith('/rpc/issue_research_membership_checkout_intent')) {
      requests.issue = JSON.parse(init.body);
      return new Response(JSON.stringify({
        action: 'reserved', intent_id: intent, checkout_key: proof,
        account_id: account, store_id: '42', variant_id: '314',
        billing_interval: 'monthly', test_mode: true,
        expires_at: issued.expires_at,
      }), { status: 200 });
    }
    if (url.endsWith('/rpc/attach_research_membership_checkout_intent')) {
      requests.attach = JSON.parse(init.body);
      return new Response(JSON.stringify({
        action: 'attached', intent_id: intent, provider_checkout_id: checkoutId,
      }), { status: 200 });
    }
    assert.equal(url, 'https://api.lemonsqueezy.com/v1/checkouts');
    providerCalls += 1;
    return new Response(JSON.stringify({
      data: { type: 'checkouts', id: checkoutId,
        attributes: { store_id: 42, variant_id: 314, test_mode: true,
          url: 'https://example.lemonsqueezy.com/checkout/custom/' + checkoutId } },
    }), { status: 201 });
  },
});
assert.equal(checkout.checkoutId, checkoutId);
assert.equal(providerCalls, 1);
const signedPayload = {
  meta: { event_name: 'subscription_created',
    custom_data: {
      usd_impact_account_id: account,
      usd_impact_research_product_id: 'research-membership',
      usd_impact_research_billing_interval: 'monthly',
      usd_impact_research_checkout_key: proof,
    } },
  data: { type: 'subscriptions', id: subscription,
    attributes: { store_id: 42, product_id: 99, variant_id: 314,
      customer_id: 456, status: 'active', cancelled: false, trial_ends_at: null,
      created_at: now.toISOString(),
      renews_at: new Date(now.getTime() + 30 * 86400000).toISOString(),
      test_mode: true } },
};
const rawBody = Buffer.from(JSON.stringify(signedPayload));
const signature = crypto.createHmac('sha256', env.LEMON_SQUEEZY_RESEARCH_TEST_WEBHOOK_SECRET)
  .update(rawBody).digest('hex');
let dispatches = 0;
const outcome = await processResearchMembershipWebhookWithFirstPurchase({
  rawBody, signature, environment: env,
  processImpl: async () => {
    dispatches += 1;
    if (dispatches === 1) {
      const error = new Error('Synthetic missing first subscription');
      error.code = 'RESEARCH_WEBHOOK_SUBSCRIPTION_NOT_FOUND';
      error.status = 409;
      throw error;
    }
    return { action: 'applied' };
  },
  fetchImpl: async (url, init) => {
    if (url.endsWith('/rpc/observe_signed_research_subscription_created')) {
      requests.observe = JSON.parse(init.body);
      return new Response(JSON.stringify({
        action: 'recorded', provider_subscription_id: subscription,
        raw_body_sha256: requests.observe.p_raw_body_sha256,
      }), { status: 200 });
    }
    assert.ok(url.endsWith('/rpc/bind_research_membership_with_checkout_intent'));
    requests.bind = JSON.parse(init.body);
    return new Response(JSON.stringify({
      action: 'created', subscription_id: '99999999-9999-4999-8999-999999999999',
      subscription_state: 'pending',
      raw_body_sha256: requests.bind.p_raw_body_sha256,
    }), { status: 200 });
  },
});
assert.equal(outcome.action, 'applied');
assert.equal(dispatches, 2);
assert.deepEqual(Object.keys(requests).sort(), ['attach', 'bind', 'issue', 'observe']);
for (const kind of ['issue', 'observe', 'bind']) {
  assert.equal(requests[kind].p_product_id, 'research-membership');
}
assert.equal(String(config.productId), '99');
assert.equal(requests.observe.p_raw_body_sha256, requests.bind.p_raw_body_sha256);
assert.equal(requests.observe.p_provider_price_id, '314');
assert.equal(requests.issue.p_account_id, account);
console.log(JSON.stringify({ source: 'actual-app-JS', capturedAt: now.toISOString(),
  requests }));
