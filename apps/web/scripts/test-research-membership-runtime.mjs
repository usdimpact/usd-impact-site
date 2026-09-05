import assert from 'node:assert/strict';
import {
  RESEARCH_MEMBERSHIP_EVENT_TYPES,
  RESEARCH_MEMBERSHIP_STATES,
  assertAllowedResearchMembershipTransition,
  normalizeResearchMembershipLifecycleEvent,
  researchMembershipEntitlementDecision,
} from '../src/lib/research-membership-runtime.js';

const base = {
  provider: 'provider-test',
  providerEventId: 'evt-1',
  providerSubscriptionId: 'sub-1',
  accountId: '223e4567-e89b-42d3-a456-426614174000',
  occurredAt: '2026-09-05T20:00:00Z',
  currentPeriodStart: '2026-09-01T00:00:00Z',
  currentPeriodEnd: '2026-10-01T00:00:00Z',
};

function normalize(eventType, currentState, extra = {}) {
  return normalizeResearchMembershipLifecycleEvent({
    ...base,
    providerEventId: `${base.providerEventId}-${eventType}`,
    eventType,
    currentState,
    ...extra,
  });
}

const activation = normalize(RESEARCH_MEMBERSHIP_EVENT_TYPES.ACTIVATED, RESEARCH_MEMBERSHIP_STATES.PENDING);
assert.equal(activation.toState, RESEARCH_MEMBERSHIP_STATES.ACTIVE);
assert.equal(researchMembershipEntitlementDecision(activation.toState).entitled, true);

const renewal = normalize(RESEARCH_MEMBERSHIP_EVENT_TYPES.RENEWED, RESEARCH_MEMBERSHIP_STATES.ACTIVE);
assert.equal(renewal.toState, RESEARCH_MEMBERSHIP_STATES.ACTIVE);

const paymentFailure = normalize(RESEARCH_MEMBERSHIP_EVENT_TYPES.PAYMENT_FAILED, RESEARCH_MEMBERSHIP_STATES.ACTIVE);
assert.equal(paymentFailure.toState, RESEARCH_MEMBERSHIP_STATES.PAST_DUE);
assert.equal(researchMembershipEntitlementDecision(paymentFailure.toState).entitled, false);

const paymentRecovered = normalize(RESEARCH_MEMBERSHIP_EVENT_TYPES.PAYMENT_RECOVERED, RESEARCH_MEMBERSHIP_STATES.PAST_DUE);
assert.equal(paymentRecovered.toState, RESEARCH_MEMBERSHIP_STATES.ACTIVE);

const scheduled = normalize(
  RESEARCH_MEMBERSHIP_EVENT_TYPES.CANCELLATION_SCHEDULED,
  RESEARCH_MEMBERSHIP_STATES.ACTIVE,
  { cancelAtPeriodEnd: true },
);
assert.equal(scheduled.toState, RESEARCH_MEMBERSHIP_STATES.CANCEL_SCHEDULED);
assert.equal(scheduled.cancelAtPeriodEnd, true);
assert.equal(researchMembershipEntitlementDecision(scheduled.toState).entitled, true);

const cancellationRevoked = normalize(
  RESEARCH_MEMBERSHIP_EVENT_TYPES.CANCELLATION_REVOKED,
  RESEARCH_MEMBERSHIP_STATES.CANCEL_SCHEDULED,
);
assert.equal(cancellationRevoked.toState, RESEARCH_MEMBERSHIP_STATES.ACTIVE);

const cancelled = normalize(
  RESEARCH_MEMBERSHIP_EVENT_TYPES.CANCELLED,
  RESEARCH_MEMBERSHIP_STATES.CANCEL_SCHEDULED,
);
assert.equal(cancelled.toState, RESEARCH_MEMBERSHIP_STATES.CANCELLED);
assert.equal(researchMembershipEntitlementDecision(cancelled.toState).entitled, false);

const refunded = normalize(RESEARCH_MEMBERSHIP_EVENT_TYPES.REFUNDED, RESEARCH_MEMBERSHIP_STATES.ACTIVE);
assert.equal(refunded.toState, RESEARCH_MEMBERSHIP_STATES.REFUNDED);
assert.equal(researchMembershipEntitlementDecision(refunded.toState).entitled, false);

const disputed = normalize(RESEARCH_MEMBERSHIP_EVENT_TYPES.DISPUTED, RESEARCH_MEMBERSHIP_STATES.ACTIVE);
assert.equal(disputed.toState, RESEARCH_MEMBERSHIP_STATES.DISPUTED);
assert.equal(researchMembershipEntitlementDecision(disputed.toState).entitled, false);

const disputeRecovered = normalize(
  RESEARCH_MEMBERSHIP_EVENT_TYPES.DISPUTE_RECOVERED,
  RESEARCH_MEMBERSHIP_STATES.DISPUTED,
);
assert.equal(disputeRecovered.toState, RESEARCH_MEMBERSHIP_STATES.ACTIVE);

const chargeback = normalize(RESEARCH_MEMBERSHIP_EVENT_TYPES.CHARGED_BACK, RESEARCH_MEMBERSHIP_STATES.DISPUTED);
assert.equal(chargeback.toState, RESEARCH_MEMBERSHIP_STATES.CHARGED_BACK);
assert.equal(researchMembershipEntitlementDecision(chargeback.toState).entitled, false);

assert.throws(
  () => assertAllowedResearchMembershipTransition(
    RESEARCH_MEMBERSHIP_STATES.CANCELLED,
    RESEARCH_MEMBERSHIP_STATES.ACTIVE,
  ),
  (error) => error?.code === 'RESEARCH_MEMBERSHIP_INVALID_TRANSITION',
);

assert.throws(
  () => normalize(
    RESEARCH_MEMBERSHIP_EVENT_TYPES.CANCELLATION_SCHEDULED,
    RESEARCH_MEMBERSHIP_STATES.ACTIVE,
    { cancelAtPeriodEnd: false },
  ),
  /Scheduled cancellation requires/,
);

assert.throws(
  () => normalizeResearchMembershipLifecycleEvent({
    ...base,
    eventType: 'subscription.unknown',
    currentState: RESEARCH_MEMBERSHIP_STATES.ACTIVE,
  }),
  /eventType is not supported/,
);

console.log('Research Membership recurring runtime lifecycle matrix passed.');
