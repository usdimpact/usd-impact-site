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
    SUPABASE_URL: 'https://example.supabase.co',
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
assert.equal(request.url, 'https://example.supabase.co/rest/v1/rpc/apply_research_membership_transition');
assert.equal(request.init.method, 'POST');
assert.equal(JSON.parse(request.init.body).p_entitlement_state, 'suspended');
assert.match(request.init.headers.Authorization, /^Bearer sb_secret_/);

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
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SECRET_KEY: `sb_secret_${'x'.repeat(32)}`,
    },
    fetchImpl: async () => new Response(JSON.stringify({ message: 'state drift' }), { status: 409 }),
  }),
  /state drift/,
);

console.log('Research Membership persistence client matrix passed.');
