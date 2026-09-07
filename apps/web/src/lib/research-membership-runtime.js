const STABLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,254}$/;

export const RESEARCH_MEMBERSHIP_PRODUCT_ID = 'research-membership';

export const RESEARCH_MEMBERSHIP_STATES = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCEL_SCHEDULED: 'cancel_scheduled',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  DISPUTED: 'disputed',
  CHARGED_BACK: 'charged_back',
});

export const RESEARCH_MEMBERSHIP_EVENT_TYPES = Object.freeze({
  ACTIVATED: 'subscription.activated',
  RENEWED: 'subscription.renewed',
  PAYMENT_FAILED: 'subscription.payment_failed',
  CANCELLATION_SCHEDULED: 'subscription.cancellation_scheduled',
  CANCELLATION_REVOKED: 'subscription.cancellation_revoked',
  CANCELLED: 'subscription.cancelled',
  REFUNDED: 'subscription.refunded',
  DISPUTED: 'subscription.disputed',
  CHARGED_BACK: 'subscription.charged_back',
  DISPUTE_RECOVERED: 'subscription.dispute_recovered',
  PAYMENT_RECOVERED: 'subscription.payment_recovered',
});

const ALLOWED_TRANSITIONS = Object.freeze({
  pending: new Set(['active', 'cancelled']),
  active: new Set(['past_due', 'cancel_scheduled', 'cancelled', 'refunded', 'disputed', 'charged_back']),
  past_due: new Set(['active', 'cancel_scheduled', 'cancelled', 'refunded', 'disputed', 'charged_back']),
  cancel_scheduled: new Set(['active', 'cancelled', 'refunded', 'disputed', 'charged_back']),
  disputed: new Set(['active', 'refunded', 'charged_back']),
  cancelled: new Set(),
  refunded: new Set(),
  charged_back: new Set(),
});

const EVENT_TARGETS = Object.freeze({
  [RESEARCH_MEMBERSHIP_EVENT_TYPES.ACTIVATED]: 'active',
  [RESEARCH_MEMBERSHIP_EVENT_TYPES.RENEWED]: 'active',
  [RESEARCH_MEMBERSHIP_EVENT_TYPES.PAYMENT_FAILED]: 'past_due',
  [RESEARCH_MEMBERSHIP_EVENT_TYPES.CANCELLATION_SCHEDULED]: 'cancel_scheduled',
  [RESEARCH_MEMBERSHIP_EVENT_TYPES.CANCELLATION_REVOKED]: 'active',
  [RESEARCH_MEMBERSHIP_EVENT_TYPES.CANCELLED]: 'cancelled',
  [RESEARCH_MEMBERSHIP_EVENT_TYPES.REFUNDED]: 'refunded',
  [RESEARCH_MEMBERSHIP_EVENT_TYPES.DISPUTED]: 'disputed',
  [RESEARCH_MEMBERSHIP_EVENT_TYPES.CHARGED_BACK]: 'charged_back',
  [RESEARCH_MEMBERSHIP_EVENT_TYPES.DISPUTE_RECOVERED]: 'active',
  [RESEARCH_MEMBERSHIP_EVENT_TYPES.PAYMENT_RECOVERED]: 'active',
});

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function stableIdentifier(value, fieldName) {
  const normalized = text(String(value ?? ''));
  if (!STABLE_ID_PATTERN.test(normalized)) {
    throw new TypeError(`${fieldName} must be a stable identifier.`);
  }
  return normalized;
}

function isoTimestamp(value, fieldName) {
  const normalized = text(value);
  const parsed = Date.parse(normalized);
  if (!normalized || Number.isNaN(parsed)) {
    throw new TypeError(`${fieldName} must be an ISO timestamp.`);
  }
  return new Date(parsed).toISOString();
}

function optionalIsoTimestamp(value, fieldName) {
  return value == null ? null : isoTimestamp(value, fieldName);
}

function requireState(value, fieldName = 'state') {
  const normalized = text(value);
  if (!Object.values(RESEARCH_MEMBERSHIP_STATES).includes(normalized)) {
    throw new TypeError(`${fieldName} is not a supported Research Membership state.`);
  }
  return normalized;
}

export function isAllowedResearchMembershipTransition(fromState, toState) {
  const from = requireState(fromState, 'fromState');
  const to = requireState(toState, 'toState');
  return from === to || ALLOWED_TRANSITIONS[from].has(to);
}

export function assertAllowedResearchMembershipTransition(fromState, toState) {
  const from = requireState(fromState, 'fromState');
  const to = requireState(toState, 'toState');
  if (!isAllowedResearchMembershipTransition(from, to)) {
    const error = new Error(`Invalid Research Membership transition: ${from} -> ${to}`);
    error.code = 'RESEARCH_MEMBERSHIP_INVALID_TRANSITION';
    throw error;
  }
  return true;
}

// Validate event data without authorizing a new state transition. Callers must
// still use normalizeResearchMembershipLifecycleEvent for an unprocessed event.
export function normalizeResearchMembershipLifecycleEventData({
  provider,
  providerEventId,
  providerSubscriptionId,
  accountId,
  eventType,
  currentState,
  occurredAt,
  currentPeriodStart = null,
  currentPeriodEnd = null,
  cancelAtPeriodEnd = false,
  metadata = {},
}) {
  const normalizedEventType = text(eventType);
  const targetState = EVENT_TARGETS[normalizedEventType];
  if (!targetState) throw new TypeError('eventType is not supported.');

  const fromState = requireState(currentState, 'currentState');

  const periodStart = optionalIsoTimestamp(currentPeriodStart, 'currentPeriodStart');
  const periodEnd = optionalIsoTimestamp(currentPeriodEnd, 'currentPeriodEnd');
  if (periodStart && periodEnd && Date.parse(periodEnd) <= Date.parse(periodStart)) {
    throw new TypeError('currentPeriodEnd must be after currentPeriodStart.');
  }

  if (targetState === RESEARCH_MEMBERSHIP_STATES.CANCEL_SCHEDULED) {
    if (cancelAtPeriodEnd !== true || !periodEnd) {
      throw new TypeError('Scheduled cancellation requires cancelAtPeriodEnd=true and currentPeriodEnd.');
    }
  }

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new TypeError('metadata must be an object.');
  }

  return Object.freeze({
    provider: stableIdentifier(provider, 'provider'),
    providerEventId: stableIdentifier(providerEventId, 'providerEventId'),
    providerSubscriptionId: stableIdentifier(providerSubscriptionId, 'providerSubscriptionId'),
    accountId: stableIdentifier(accountId, 'accountId'),
    productId: RESEARCH_MEMBERSHIP_PRODUCT_ID,
    eventType: normalizedEventType,
    fromState,
    toState: targetState,
    occurredAt: isoTimestamp(occurredAt, 'occurredAt'),
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: targetState === RESEARCH_MEMBERSHIP_STATES.CANCEL_SCHEDULED
      ? true
      : false,
    metadata: Object.freeze({ ...metadata }),
  });
}

export function normalizeResearchMembershipLifecycleEvent(options) {
  const event = normalizeResearchMembershipLifecycleEventData(options);
  assertAllowedResearchMembershipTransition(event.fromState, event.toState);
  return event;
}

export function researchMembershipEntitlementDecision(state) {
  const normalized = requireState(state);
  return Object.freeze({
    productId: RESEARCH_MEMBERSHIP_PRODUCT_ID,
    entitled: normalized === RESEARCH_MEMBERSHIP_STATES.ACTIVE
      || normalized === RESEARCH_MEMBERSHIP_STATES.CANCEL_SCHEDULED,
    state: normalized,
  });
}
