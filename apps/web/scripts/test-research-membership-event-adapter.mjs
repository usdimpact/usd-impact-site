import assert from 'node:assert/strict';
import {
  buildResearchMembershipMutationPlan,
  researchMembershipEventKey,
} from '../src/lib/research-membership-event-adapter.js';

const accountId = '11111111-1111-4111-8111-111111111111';
const baseSubscription = {
  accountId,
  productId: 'research-membership',
  provider: 'test-provider',
  providerSubscriptionId: 'sub_123',
  state: 'active',
};

const event = (overrides = {}) => ({
  provider: 'test-provider',
  providerEventId: 'evt_123',
  providerSubscriptionId: 'sub_123',
  eventType: 'subscription.cancellation_scheduled',
  occurredAt: '2026-09-06T00:00:00Z',
  currentPeriodStart: '2026-09-01T00:00:00Z',
  currentPeriodEnd: '2026-10-01T00:00:00Z',
  cancelAtPeriodEnd: true,
  metadata: { source: 'fixture' },
  ...overrides,
});

assert.equal(researchMembershipEventKey('test-provider', 'evt_123'), 'test-provider:evt_123');

const scheduled = buildResearchMembershipMutationPlan({
  providerEvent: event(),
  existingSubscription: baseSubscription,
});
assert.equal(scheduled.action, 'apply');
assert.equal(scheduled.subscriptionPatch.state, 'cancel_scheduled');
assert.equal(scheduled.entitlementPatch.state, 'active');
assert.equal(scheduled.entitlementPatch.endsAt, '2026-10-01T00:00:00.000Z');
assert.equal(scheduled.eventInsert.actorType, 'provider_webhook');
assert.equal(scheduled.eventInsert.eventKey, 'test-provider:evt_123');

const duplicate = buildResearchMembershipMutationPlan({
  providerEvent: event(),
  existingSubscription: baseSubscription,
  processedEventKeys: ['test-provider:evt_123'],
});
assert.equal(duplicate.action, 'duplicate');
assert.equal(duplicate.subscriptionPatch, null);
assert.equal(duplicate.entitlementPatch, null);

const paymentFailure = buildResearchMembershipMutationPlan({
  providerEvent: event({
    providerEventId: 'evt_failed',
    eventType: 'subscription.payment_failed',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  }),
  existingSubscription: baseSubscription,
});
assert.equal(paymentFailure.subscriptionPatch.state, 'past_due');
assert.equal(paymentFailure.entitlementPatch.state, 'inactive');
assert.equal(paymentFailure.entitlementPatch.endsAt, '2026-09-06T00:00:00.000Z');

const recovered = buildResearchMembershipMutationPlan({
  providerEvent: event({
    providerEventId: 'evt_recovered',
    eventType: 'subscription.payment_recovered',
    currentPeriodEnd: '2026-10-01T00:00:00Z',
    cancelAtPeriodEnd: false,
  }),
  existingSubscription: { ...baseSubscription, state: 'past_due' },
});
assert.equal(recovered.subscriptionPatch.state, 'active');
assert.equal(recovered.entitlementPatch.state, 'active');

for (const [label, subscription, providerEvent, pattern] of [
  ['provider mismatch', baseSubscription, event({ provider: 'other-provider' }), /Provider mismatch/],
  ['subscription mismatch', baseSubscription, event({ providerSubscriptionId: 'sub_other' }), /Provider subscription mismatch/],
  ['product mismatch', { ...baseSubscription, productId: 'library-pass' }, event(), /product mismatch/i],
]) {
  assert.throws(
    () => buildResearchMembershipMutationPlan({ existingSubscription: subscription, providerEvent }),
    pattern,
    label,
  );
}

assert.throws(
  () => buildResearchMembershipMutationPlan({
    existingSubscription: baseSubscription,
    providerEvent: event({ eventType: 'subscription.activated' }),
  }),
  /Invalid Research Membership transition/,
);

console.log('Research Membership provider-neutral event adapter matrix passed.');
