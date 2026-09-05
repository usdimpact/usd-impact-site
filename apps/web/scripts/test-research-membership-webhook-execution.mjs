import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import handler from '../api/research-membership-webhook.js';
import { processResearchMembershipWebhook } from '../src/lib/research-membership-webhook-handler.js';

const environment = {
  VERCEL_ENV: 'preview',
  RESEARCH_MEMBERSHIP_WEBHOOK_ENABLED: 'true',
  LEMON_SQUEEZY_RESEARCH_TEST_MODE: 'true',
  LEMON_SQUEEZY_RESEARCH_TEST_WEBHOOK_SECRET: 'research_test_webhook_secret_abcdefghijklmnopqrstuvwxyz',
  LEMON_SQUEEZY_RESEARCH_TEST_STORE_ID: '42',
  LEMON_SQUEEZY_RESEARCH_TEST_PRODUCT_ID: '99',
  LEMON_SQUEEZY_RESEARCH_TEST_MONTHLY_VARIANT_ID: '314',
  LEMON_SQUEEZY_RESEARCH_TEST_ANNUAL_VARIANT_ID: '315',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
};

const payload = {
  meta: {
    event_name: 'subscription_updated',
    custom_data: { usd_impact_account_id: '123e4567-e89b-42d3-a456-426614174000' },
  },
  data: {
    type: 'subscriptions',
    id: 'sub_7001',
    attributes: {
      store_id: 42,
      product_id: 99,
      variant_id: 314,
      status: 'active',
      cancelled: false,
      test_mode: true,
      created_at: '2026-09-05T20:00:00.000Z',
      updated_at: '2026-09-05T21:00:00.000Z',
      renews_at: '2026-10-05T20:00:00.000Z',
      ends_at: null,
    },
  },
};
const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
const signature = crypto
  .createHmac('sha256', environment.LEMON_SQUEEZY_RESEARCH_TEST_WEBHOOK_SECRET)
  .update(rawBody)
  .digest('hex');

const requests = [];
const result = await processResearchMembershipWebhook({
  rawBody,
  signature,
  environment,
  fetchImpl: async (url, init = {}) => {
    requests.push({ url, init });
    if (url.includes('/rest/v1/subscriptions?')) {
      return new Response(JSON.stringify([{
        id: '223e4567-e89b-42d3-a456-426614174000',
        account_id: '123e4567-e89b-42d3-a456-426614174000',
        product_id: 'research-membership',
        provider: 'lemon-squeezy',
        provider_subscription_id: 'sub_7001',
        state: 'active',
        current_period_start: '2026-09-05T20:00:00.000Z',
        current_period_end: '2026-09-30T20:00:00.000Z',
        cancel_at_period_end: false,
      }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.endsWith('/rest/v1/rpc/apply_research_membership_transition')) {
      const body = JSON.parse(init.body);
      assert.equal(body.p_subscription_id, '223e4567-e89b-42d3-a456-426614174000');
      assert.equal(body.p_expected_provider, 'lemon-squeezy');
      assert.equal(body.p_expected_provider_subscription_id, 'sub_7001');
      assert.equal(body.p_expected_from_state, 'active');
      assert.equal(body.p_to_state, 'active');
      assert.equal(body.p_current_period_end, '2026-10-05T20:00:00.000Z');
      return new Response(JSON.stringify({ action: 'applied', eventKey: body.p_event_key }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  },
});
assert.equal(result.action, 'applied');
assert.equal(result.providerSubscriptionId, 'sub_7001');
assert.equal(requests.length, 2);
assert.match(requests[0].url, /provider_subscription_id=eq\.sub_7001/);

let fetchCalled = false;
await assert.rejects(
  () => processResearchMembershipWebhook({
    rawBody,
    signature,
    environment: { ...environment, VERCEL_ENV: 'production' },
    fetchImpl: async () => { fetchCalled = true; throw new Error('must not fetch'); },
  }),
  (error) => error.code === 'RESEARCH_WEBHOOK_PREVIEW_ONLY',
);
assert.equal(fetchCalled, false);

fetchCalled = false;
await assert.rejects(
  () => processResearchMembershipWebhook({
    rawBody,
    signature: '0'.repeat(64),
    environment,
    fetchImpl: async () => { fetchCalled = true; throw new Error('must not fetch'); },
  }),
  (error) => error.code === 'RESEARCH_WEBHOOK_SIGNATURE_INVALID',
);
assert.equal(fetchCalled, false);

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = String(value); },
    end(value = '') { this.body = String(value); },
  };
}

const managedKeys = Object.keys(environment);
const original = Object.fromEntries(managedKeys.map((key) => [key, process.env[key]]));
try {
  for (const key of managedKeys) process.env[key] = environment[key];
  let parsedBodyAccesses = 0;
  const request = {
    method: 'POST',
    url: '/api/research-membership-webhook',
    headers: { 'content-type': 'application/json', 'x-signature': '0'.repeat(64) },
    get body() { parsedBodyAccesses += 1; return payload; },
    async *[Symbol.asyncIterator]() { yield rawBody; },
  };
  const response = responseRecorder();
  await handler(request, response);
  const body = JSON.parse(response.body);
  assert.equal(parsedBodyAccesses, 0, 'endpoint must never touch Vercel parsed request.body');
  assert.equal(response.statusCode, 401);
  assert.equal(body.code, 'RESEARCH_WEBHOOK_SIGNATURE_INVALID');
} finally {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

console.log('Research Membership webhook execution tests passed.');
