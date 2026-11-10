import assert from 'node:assert/strict';
import { buildResearchMembershipMutationPlan } from '../src/lib/research-membership-event-adapter.js';
import {
  persistResearchMembershipTransition,
  researchMembershipPersistenceRpcBody,
} from '../src/lib/research-membership-persistence.js';

const accountId = '11111111-1111-4111-8111-111111111111';
const subscriptionId = '22222222-2222-4222-8222-222222222222';
const existingSubscription = {
  accountId,
  productId: 'research-membership',
  provider: 'test-provider',
  providerSubscriptionId: 'sub_123',
  state: 'active',
};
const plan = buildResearchMembershipMutationPlan({
  existingSubscription,
  providerEvent: {
    provider: 'test-provider',
    providerEventId: 'evt_failed',
    providerSubscriptionId: 'sub_123',
    eventType: 'subscription.payment_failed',
    occurredAt: '2026-09-06T00:00:00Z',
    currentPeriodStart: '2026-09-01T00:00:00Z',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    metadata: { fixture: true },
  },
});

const body = researchMembershipPersistenceRpcBody({ plan, subscriptionId });
assert.equal(body.p_subscription_id, subscriptionId);
assert.equal(body.p_expected_from_state, 'active');
assert.equal(body.p_to_state, 'past_due');
assert.equal(body.p_entitlement_state, 'suspended');
assert.equal(body.p_event_key, 'test-provider:evt_failed');

let request;
const applied = await persistResearchMembershipTransition({
  plan,
  subscriptionId,
  environment: {
    VERCEL_ENV: 'preview',
    SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
    SUPABASE_SECRET_KEY: `sb_secret_${'x'.repeat(32)}`,
  },
  fetchImpl: async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({
      action: 'applied',
      subscription_id: subscriptionId,
      subscription_state: 'past_due',
      entitlement_id: '33333333-3333-4333-8333-333333333333',
      entitlement_state: 'suspended',
      event_key: 'test-provider:evt_failed',
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  },
});
assert.equal(applied.action, 'applied');
assert.equal(request.url, 'https://ycstrcvshdluovtuasjc.supabase.co/rest/v1/rpc/apply_research_membership_transition');
assert.equal(request.init.method, 'POST');
assert.equal(JSON.parse(request.init.body).p_entitlement_state, 'suspended');
assert.equal(request.init.headers.apikey, `sb_secret_${'x'.repeat(32)}`);
assert.equal(Object.keys(request.init.headers).some((name) => name.toLowerCase() === 'authorization'), false,
  'Research Membership RPC must not send opaque sb_secret_ as a Bearer JWT');

const duplicatePlan = Object.freeze({ ...plan, action: 'duplicate', subscriptionPatch: null, entitlementPatch: null, eventInsert: null });
let duplicateFetchCalled = false;
const duplicate = await persistResearchMembershipTransition({
  plan: duplicatePlan,
  subscriptionId,
  environment: {},
  fetchImpl: async () => {
    duplicateFetchCalled = true;
    throw new Error('should not fetch');
  },
});
assert.equal(duplicate.action, 'duplicate');
assert.equal(duplicateFetchCalled, false);

await assert.rejects(
  () => persistResearchMembershipTransition({
    plan,
    subscriptionId,
    environment: {
      VERCEL_ENV: 'preview',
    SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
      SUPABASE_SECRET_KEY: `sb_secret_${'x'.repeat(32)}`,
    },
    fetchImpl: async () => new Response(JSON.stringify({ message: 'state drift' }), { status: 409 }),
  }),
  /state drift/,
);

// Non-canonical or cross-environment privileged URLs fail before any fetch.
let unsafeFetchCalled = false;
const expectBlocked = async (environment) => {
  await assert.rejects(
    () => persistResearchMembershipTransition({
      plan, subscriptionId, environment,
      fetchImpl: async () => { unsafeFetchCalled = true; throw new Error('UNSAFE_NETWORK'); },
    }),
    /canonical project|VERCEL_ENV is required|SUPABASE_SECRET_KEY is invalid/,
  );
  assert.equal(unsafeFetchCalled, false);
};
const canonical = Object.freeze({
  VERCEL_ENV: 'preview',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_SECRET_KEY: `sb_secret_${'x'.repeat(32)}`,
});
for (const override of [
  { VERCEL_ENV: 'production' },
  { VERCEL_ENV: 'development' },
  { VERCEL_ENV: undefined },
  { SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co' },
  { SUPABASE_URL: 'https://example.supabase.co' },
  { SUPABASE_URL: 'http://ycstrcvshdluovtuasjc.supabase.co' },
  { SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co/other' },
  { SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co?next=elsewhere' },
  { SUPABASE_SECRET_KEY: 'sb_publishable_wrong_role' },
]) await expectBlocked({ ...canonical, ...override });

// Production branch mapping is checked only with an injected mock. No network,
// payment, subscription, or entitlement is accessed.
let productionMockCalls = 0;
const productionMock = await persistResearchMembershipTransition({
  plan, subscriptionId,
  environment: {
    ...canonical, VERCEL_ENV: 'production',
    SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
  },
  fetchImpl: async (url, init) => {
    productionMockCalls += 1;
    assert.equal(new URL(url).origin, 'https://gjzetjugmnwanvjkchux.supabase.co');
    assert.equal(Object.hasOwn(init.headers, 'Authorization'), false);
    return new Response(JSON.stringify({ action: 'duplicate' }), { status: 200 });
  },
});
assert.equal(productionMock.action, 'duplicate');
assert.equal(productionMockCalls, 1);

console.log('Research Membership persistence client matrix passed.');
