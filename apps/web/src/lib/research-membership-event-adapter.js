import {
  RESEARCH_MEMBERSHIP_PRODUCT_ID,
  normalizeResearchMembershipLifecycleEvent,
  researchMembershipEntitlementDecision,
} from './research-membership-runtime.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function requireAccountId(value) {
  const normalized = text(value);
  if (!UUID_PATTERN.test(normalized)) throw new TypeError('accountId must be a valid UUID.');
  return normalized;
}

function requireExistingSubscription(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('existingSubscription is required.');
  }
  return value;
}

function requireEventKeys(value) {
  if (!Array.isArray(value)) throw new TypeError('processedEventKeys must be an array.');
  return new Set(value.map((entry) => text(entry)).filter(Boolean));
}

export function researchMembershipEventKey(provider, providerEventId) {
  const normalizedProvider = text(provider);
  const normalizedEventId = text(providerEventId);
  if (!normalizedProvider || !normalizedEventId) throw new TypeError('provider and providerEventId are required.');
  return `${normalizedProvider}:${normalizedEventId}`;
}

export function buildResearchMembershipMutationPlan({
  providerEvent,
  existingSubscription,
  processedEventKeys = [],
} = {}) {
  const subscription = requireExistingSubscription(existingSubscription);
  const accountId = requireAccountId(subscription.accountId);
  if (subscription.productId !== RESEARCH_MEMBERSHIP_PRODUCT_ID) {
    throw new Error('Existing subscription product mismatch.');
  }

  const event = normalizeResearchMembershipLifecycleEvent({
    ...providerEvent,
    accountId,
    currentState: subscription.state,
  });

  if (event.provider !== subscription.provider) throw new Error('Provider mismatch.');
  if (event.providerSubscriptionId !== subscription.providerSubscriptionId) {
    throw new Error('Provider subscription mismatch.');
  }

  const eventKey = researchMembershipEventKey(event.provider, event.providerEventId);
  if (requireEventKeys(processedEventKeys).has(eventKey)) {
    return Object.freeze({
      action: 'duplicate',
      eventKey,
      event,
      subscriptionPatch: null,
      entitlementPatch: null,
      eventInsert: null,
    });
  }

  const entitlement = researchMembershipEntitlementDecision(event.toState);
  const entitlementPatch = Object.freeze({
    productId: RESEARCH_MEMBERSHIP_PRODUCT_ID,
    state: entitlement.entitled ? 'active' : 'inactive',
    startsAt: entitlement.entitled ? event.currentPeriodStart : null,
    endsAt: entitlement.entitled ? event.currentPeriodEnd : event.occurredAt,
  });

  const subscriptionPatch = Object.freeze({
    state: event.toState,
    currentPeriodStart: event.currentPeriodStart,
    currentPeriodEnd: event.currentPeriodEnd,
    cancelAtPeriodEnd: event.cancelAtPeriodEnd,
    lastProviderEventId: event.providerEventId,
  });

  const eventInsert = Object.freeze({
    eventKey,
    accountId,
    productId: RESEARCH_MEMBERSHIP_PRODUCT_ID,
    fromState: event.fromState,
    toState: event.toState,
    reason: event.eventType,
    actorType: 'provider_webhook',
    providerEventId: event.providerEventId,
    occurredAt: event.occurredAt,
    metadata: event.metadata,
  });

  return Object.freeze({
    action: 'apply',
    eventKey,
    event,
    subscriptionPatch,
    entitlementPatch,
    eventInsert,
  });
}
