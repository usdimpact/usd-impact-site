export const PAID_PRODUCT_ID = 'read-the-dollar-first-guided-interactive-edition';

export const ENTITLEMENT_STATES = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  SUSPENDED_DISPUTE: 'suspended_dispute',
  REFUNDED: 'refunded',
  CHARGED_BACK: 'charged_back',
  REVOKED: 'revoked',
  ACCOUNT_DELETED: 'account_deleted',
});

export const PURCHASE_INTENT_STATUSES = Object.freeze({
  PENDING: 'pending',
  CHECKOUT_CREATED: 'checkout_created',
  COMPLETED: 'completed',
  FAILED: 'failed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
});

export const DEFAULT_LAUNCH_PRICE_CENTS = 3_900;
export const DEFAULT_STANDARD_PRICE_CENTS = 4_900;
export const DEFAULT_LAUNCH_PURCHASE_LIMIT = null;
export const DEFAULT_LAUNCH_DURATION_DAYS = null;
export const DEFAULT_CURRENCY = 'USD';

const IDENTIFIER_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const KNOWN_ENTITLEMENT_STATES = new Set(Object.values(ENTITLEMENT_STATES));
const KNOWN_PURCHASE_INTENT_STATUSES = new Set(Object.values(PURCHASE_INTENT_STATUSES));

const ALLOWED_ENTITLEMENT_TRANSITIONS = Object.freeze({
  [ENTITLEMENT_STATES.ACTIVE]: new Set([
    ENTITLEMENT_STATES.SUSPENDED,
    ENTITLEMENT_STATES.SUSPENDED_DISPUTE,
    ENTITLEMENT_STATES.REFUNDED,
    ENTITLEMENT_STATES.CHARGED_BACK,
    ENTITLEMENT_STATES.REVOKED,
    ENTITLEMENT_STATES.ACCOUNT_DELETED,
  ]),
  [ENTITLEMENT_STATES.SUSPENDED]: new Set([
    ENTITLEMENT_STATES.ACTIVE,
    ENTITLEMENT_STATES.SUSPENDED_DISPUTE,
    ENTITLEMENT_STATES.REFUNDED,
    ENTITLEMENT_STATES.CHARGED_BACK,
    ENTITLEMENT_STATES.REVOKED,
    ENTITLEMENT_STATES.ACCOUNT_DELETED,
  ]),
  [ENTITLEMENT_STATES.SUSPENDED_DISPUTE]: new Set([
    ENTITLEMENT_STATES.ACTIVE,
    ENTITLEMENT_STATES.REFUNDED,
    ENTITLEMENT_STATES.CHARGED_BACK,
    ENTITLEMENT_STATES.REVOKED,
    ENTITLEMENT_STATES.ACCOUNT_DELETED,
  ]),
  [ENTITLEMENT_STATES.REFUNDED]: new Set([
    ENTITLEMENT_STATES.ACCOUNT_DELETED,
  ]),
  [ENTITLEMENT_STATES.CHARGED_BACK]: new Set([
    ENTITLEMENT_STATES.ACTIVE,
    ENTITLEMENT_STATES.ACCOUNT_DELETED,
  ]),
  [ENTITLEMENT_STATES.REVOKED]: new Set([
    ENTITLEMENT_STATES.ACTIVE,
    ENTITLEMENT_STATES.ACCOUNT_DELETED,
  ]),
  [ENTITLEMENT_STATES.ACCOUNT_DELETED]: new Set(),
});

export class PaidAccessDeniedError extends Error {
  constructor(reason) {
    super(`Paid access denied: ${reason}.`);
    this.name = 'PaidAccessDeniedError';
    this.code = 'PAID_ACCESS_DENIED';
    this.reason = reason;
  }
}

function requireIdentifier(value, fieldName) {
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) {
    throw new TypeError(`${fieldName} must be a non-empty stable identifier.`);
  }
  return value;
}

function requireNonEmptyString(value, fieldName, maxLength = 512) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new TypeError(`${fieldName} must be a non-empty string no longer than ${maxLength} characters.`);
  }
  return value.trim();
}

function requireInteger(value, fieldName, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${fieldName} must be an integer greater than or equal to ${minimum}.`);
  }
  return value;
}

function requireTimestamp(value, fieldName) {
  if (typeof value !== 'string') {
    throw new TypeError(`${fieldName} must be an ISO-8601 timestamp.`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`${fieldName} must be an ISO-8601 timestamp.`);
  }
  return new Date(parsed).toISOString();
}

function optionalTimestamp(value, fieldName) {
  return value == null ? null : requireTimestamp(value, fieldName);
}

function isoTimestamp(nowMs = Date.now()) {
  if (!Number.isFinite(nowMs)) throw new TypeError('nowMs must be a finite timestamp.');
  return new Date(nowMs).toISOString();
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function isEntitlementState(value) {
  return KNOWN_ENTITLEMENT_STATES.has(value);
}

export function isPurchaseIntentStatus(value) {
  return KNOWN_PURCHASE_INTENT_STATUSES.has(value);
}

export function validateEntitlementRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { valid: false, reason: 'malformed' };
  }

  try {
    const normalized = {
      id: requireIdentifier(record.id, 'entitlement.id'),
      accountId: requireIdentifier(record.accountId, 'entitlement.accountId'),
      productId: requireIdentifier(record.productId, 'entitlement.productId'),
      state: record.state,
      startsAt: requireTimestamp(record.startsAt, 'entitlement.startsAt'),
      endsAt: optionalTimestamp(record.endsAt, 'entitlement.endsAt'),
      version: requireInteger(record.version, 'entitlement.version', 1),
      updatedAt: requireTimestamp(record.updatedAt, 'entitlement.updatedAt'),
    };

    if (!isEntitlementState(normalized.state)) {
      return { valid: false, reason: 'unknown-state' };
    }
    if (normalized.endsAt && Date.parse(normalized.endsAt) <= Date.parse(normalized.startsAt)) {
      return { valid: false, reason: 'invalid-window' };
    }
    return { valid: true, reason: 'valid', entitlement: deepFreeze(normalized) };
  } catch {
    return { valid: false, reason: 'malformed' };
  }
}

export function authorizePaidAccess(entitlement, productId, nowMs = Date.now()) {
  if (!entitlement) return { allowed: false, reason: 'missing' };

  const validated = validateEntitlementRecord(entitlement);
  if (!validated.valid) return { allowed: false, reason: validated.reason };

  const normalized = validated.entitlement;
  if (normalized.productId !== productId) return { allowed: false, reason: 'wrong-product' };
  if (normalized.state !== ENTITLEMENT_STATES.ACTIVE) {
    return { allowed: false, reason: normalized.state };
  }

  const startsAtMs = Date.parse(normalized.startsAt);
  const endsAtMs = normalized.endsAt ? Date.parse(normalized.endsAt) : null;
  if (nowMs < startsAtMs) return { allowed: false, reason: 'not-started' };
  if (endsAtMs != null && nowMs >= endsAtMs) return { allowed: false, reason: 'expired' };

  return { allowed: true, reason: 'active', entitlement: normalized };
}

export function requirePaidAccess(entitlement, productId, nowMs = Date.now()) {
  const authorization = authorizePaidAccess(entitlement, productId, nowMs);
  if (!authorization.allowed) throw new PaidAccessDeniedError(authorization.reason);
  return authorization.entitlement;
}

export function canTransitionEntitlement(fromState, toState) {
  if (!isEntitlementState(fromState) || !isEntitlementState(toState)) return false;
  return ALLOWED_ENTITLEMENT_TRANSITIONS[fromState].has(toState);
}

export function transitionEntitlement({
  entitlement,
  toState,
  eventId,
  reason,
  actorType,
  actorId = null,
  nowMs = Date.now(),
}) {
  const validated = validateEntitlementRecord(entitlement);
  if (!validated.valid) throw new TypeError(`Cannot transition a ${validated.reason} entitlement.`);
  if (!canTransitionEntitlement(validated.entitlement.state, toState)) {
    throw new Error(`Entitlement transition ${validated.entitlement.state} -> ${toState} is not allowed.`);
  }

  const at = isoTimestamp(nowMs);
  const event = deepFreeze({
    eventId: requireIdentifier(eventId, 'eventId'),
    entitlementId: validated.entitlement.id,
    accountId: validated.entitlement.accountId,
    productId: validated.entitlement.productId,
    fromState: validated.entitlement.state,
    toState,
    reason: requireNonEmptyString(reason, 'reason'),
    actorType: requireIdentifier(actorType, 'actorType'),
    actorId: actorId == null ? null : requireIdentifier(actorId, 'actorId'),
    occurredAt: at,
  });

  const updatedEntitlement = deepFreeze({
    ...validated.entitlement,
    state: toState,
    version: validated.entitlement.version + 1,
    updatedAt: at,
  });

  return deepFreeze({ entitlement: updatedEntitlement, event });
}

export function createLaunchOffer({
  productId = PAID_PRODUCT_ID,
  launchStartsAt,
  launchPriceCents = DEFAULT_LAUNCH_PRICE_CENTS,
  standardPriceCents = DEFAULT_STANDARD_PRICE_CENTS,
  currency = DEFAULT_CURRENCY,
  purchaseLimit = DEFAULT_LAUNCH_PURCHASE_LIMIT,
  durationDays = DEFAULT_LAUNCH_DURATION_DAYS,
}) {
  const startsAt = requireTimestamp(launchStartsAt, 'launchStartsAt');
  const startsAtMs = Date.parse(startsAt);
  const normalizedDurationDays = durationDays == null
    ? null
    : requireInteger(durationDays, 'durationDays', 1);
  const normalizedPurchaseLimit = purchaseLimit == null
    ? null
    : requireInteger(purchaseLimit, 'purchaseLimit', 1);
  const normalizedLaunchPrice = requireInteger(launchPriceCents, 'launchPriceCents', 1);
  const normalizedStandardPrice = requireInteger(standardPriceCents, 'standardPriceCents', 1);
  if (normalizedLaunchPrice >= normalizedStandardPrice) {
    throw new TypeError('launchPriceCents must be lower than standardPriceCents.');
  }
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
    throw new TypeError('currency must be a three-letter uppercase ISO currency code.');
  }

  return deepFreeze({
    version: 1,
    productId: requireIdentifier(productId, 'productId'),
    currency,
    launchPriceCents: normalizedLaunchPrice,
    standardPriceCents: normalizedStandardPrice,
    purchaseLimit: normalizedPurchaseLimit,
    launchStartsAt: startsAt,
    launchEndsAt: normalizedDurationDays == null
      ? null
      : new Date(startsAtMs + (normalizedDurationDays * DAY_MS)).toISOString(),
  });
}

export function evaluateLaunchOffer({
  offer,
  completedLivePurchaseCount,
  inFlightLaunchReservationCount = 0,
  closedAt = null,
  nowMs = Date.now(),
}) {
  if (!offer || typeof offer !== 'object' || Array.isArray(offer)) {
    throw new TypeError('offer is required.');
  }
  const completedCount = requireInteger(completedLivePurchaseCount, 'completedLivePurchaseCount');
  const reservationCount = requireInteger(inFlightLaunchReservationCount, 'inFlightLaunchReservationCount');
  const normalizedClosedAt = optionalTimestamp(closedAt, 'closedAt');
  const startsAtMs = Date.parse(requireTimestamp(offer.launchStartsAt, 'offer.launchStartsAt'));
  const endsAtMs = offer.launchEndsAt == null
    ? null
    : Date.parse(requireTimestamp(offer.launchEndsAt, 'offer.launchEndsAt'));
  const purchaseLimit = offer.purchaseLimit == null
    ? null
    : requireInteger(offer.purchaseLimit, 'offer.purchaseLimit', 1);

  let priceTier = 'launch';
  let reason = 'launch-active';
  if (normalizedClosedAt) {
    priceTier = 'standard';
    reason = 'offer-closed';
  } else if (nowMs < startsAtMs) {
    priceTier = 'standard';
    reason = 'launch-not-started';
  } else if (endsAtMs != null && nowMs >= endsAtMs) {
    priceTier = 'standard';
    reason = 'launch-deadline-reached';
  } else if (purchaseLimit != null && completedCount >= purchaseLimit) {
    priceTier = 'standard';
    reason = 'launch-purchase-limit-reached';
  } else if (purchaseLimit != null && (completedCount + reservationCount) >= purchaseLimit) {
    priceTier = 'standard';
    reason = 'launch-capacity-reserved';
  }

  const amountCents = priceTier === 'launch' ? offer.launchPriceCents : offer.standardPriceCents;
  return deepFreeze({
    priceTier,
    reason,
    amountCents,
    currency: offer.currency,
    completedLivePurchaseCount: completedCount,
    inFlightLaunchReservationCount: reservationCount,
    evaluatedAt: isoTimestamp(nowMs),
    closedAt: normalizedClosedAt,
  });
}

export function createOfferTermsSnapshot(offer, evaluation) {
  return deepFreeze({
    version: offer.version,
    productId: offer.productId,
    currency: offer.currency,
    launchPriceCents: offer.launchPriceCents,
    standardPriceCents: offer.standardPriceCents,
    purchaseLimit: offer.purchaseLimit,
    launchStartsAt: offer.launchStartsAt,
    launchEndsAt: offer.launchEndsAt,
    selectedPriceTier: evaluation.priceTier,
    selectedAmountCents: evaluation.amountCents,
    selectionReason: evaluation.reason,
    selectedAt: evaluation.evaluatedAt,
    completedLivePurchaseCountAtSelection: evaluation.completedLivePurchaseCount,
    inFlightLaunchReservationCountAtSelection: evaluation.inFlightLaunchReservationCount,
    offerClosedAtSelection: evaluation.closedAt,
  });
}

function requirePurchaseRepository(repository) {
  for (const method of ['withLaunchOfferLock', 'getLaunchOfferState', 'createPurchaseIntent']) {
    if (typeof repository?.[method] !== 'function') {
      throw new TypeError(`repository.${method} must be a function.`);
    }
  }
  return repository;
}

export async function reservePurchaseIntent({
  repository,
  offer,
  intentId,
  idempotencyKey,
  accountId,
  nowMs = Date.now(),
}) {
  const adapter = requirePurchaseRepository(repository);
  const normalizedIntentId = requireIdentifier(intentId, 'intentId');
  const normalizedIdempotencyKey = requireIdentifier(idempotencyKey, 'idempotencyKey');
  const normalizedAccountId = requireIdentifier(accountId, 'accountId');

  return adapter.withLaunchOfferLock(offer.productId, async () => {
    const state = await adapter.getLaunchOfferState(offer.productId);
    const evaluation = evaluateLaunchOffer({
      offer,
      completedLivePurchaseCount: state.completedLivePurchaseCount,
      inFlightLaunchReservationCount: state.inFlightLaunchReservationCount,
      closedAt: state.closedAt,
      nowMs,
    });

    const intent = deepFreeze({
      id: normalizedIntentId,
      idempotencyKey: normalizedIdempotencyKey,
      accountId: normalizedAccountId,
      productId: offer.productId,
      status: PURCHASE_INTENT_STATUSES.PENDING,
      priceTier: evaluation.priceTier,
      amountCents: evaluation.amountCents,
      currency: evaluation.currency,
      createdAt: evaluation.evaluatedAt,
      offerTerms: createOfferTermsSnapshot(offer, evaluation),
    });

    const storedIntent = await adapter.createPurchaseIntent(intent);
    return deepFreeze({ ...storedIntent });
  });
}
