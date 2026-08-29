import assert from 'node:assert/strict';
import {
  DEFAULT_LAUNCH_PRICE_CENTS,
  DEFAULT_STANDARD_PRICE_CENTS,
  ENTITLEMENT_STATES,
  PAID_PRODUCT_ID,
  PaidAccessDeniedError,
  authorizePaidAccess,
  canTransitionEntitlement,
  createLaunchOffer,
  evaluateLaunchOffer,
  requirePaidAccess,
  reservePurchaseIntent,
  transitionEntitlement,
  validateEntitlementRecord,
} from '../src/lib/paid-access.js';

const now = Date.UTC(2026, 6, 29, 18, 0, 0);
const nowIso = new Date(now).toISOString();
const baseEntitlement = Object.freeze({
  id: 'entitlement-1',
  accountId: 'account-1',
  productId: PAID_PRODUCT_ID,
  state: ENTITLEMENT_STATES.ACTIVE,
  startsAt: nowIso,
  endsAt: null,
  version: 1,
  updatedAt: nowIso,
});

const validated = validateEntitlementRecord(baseEntitlement);
assert.equal(validated.valid, true);
assert.equal(Object.isFrozen(validated.entitlement), true);
assert.deepEqual(authorizePaidAccess(null, PAID_PRODUCT_ID, now), { allowed: false, reason: 'missing' });
assert.equal(authorizePaidAccess(baseEntitlement, PAID_PRODUCT_ID, now).allowed, true);
assert.equal(authorizePaidAccess({ ...baseEntitlement, productId: 'other-product' }, PAID_PRODUCT_ID, now).reason, 'wrong-product');
assert.equal(authorizePaidAccess({ ...baseEntitlement, startsAt: new Date(now + 1).toISOString() }, PAID_PRODUCT_ID, now).reason, 'not-started');
assert.equal(authorizePaidAccess({ ...baseEntitlement, endsAt: new Date(now).toISOString() }, PAID_PRODUCT_ID, now).reason, 'invalid-window');
assert.equal(authorizePaidAccess({ ...baseEntitlement, state: 'invented' }, PAID_PRODUCT_ID, now).reason, 'unknown-state');

for (const state of Object.values(ENTITLEMENT_STATES)) {
  const result = authorizePaidAccess({ ...baseEntitlement, state }, PAID_PRODUCT_ID, now);
  assert.equal(result.allowed, state === ENTITLEMENT_STATES.ACTIVE, `Unexpected access result for ${state}`);
}

assert.throws(
  () => requirePaidAccess({ ...baseEntitlement, state: ENTITLEMENT_STATES.REFUNDED }, PAID_PRODUCT_ID, now),
  (error) => error instanceof PaidAccessDeniedError && error.reason === ENTITLEMENT_STATES.REFUNDED,
);

assert.equal(canTransitionEntitlement(ENTITLEMENT_STATES.ACTIVE, ENTITLEMENT_STATES.REFUNDED), true);
assert.equal(canTransitionEntitlement(ENTITLEMENT_STATES.REFUNDED, ENTITLEMENT_STATES.ACTIVE), false);
assert.equal(canTransitionEntitlement(ENTITLEMENT_STATES.CHARGED_BACK, ENTITLEMENT_STATES.ACTIVE), true);
assert.equal(canTransitionEntitlement(ENTITLEMENT_STATES.ACCOUNT_DELETED, ENTITLEMENT_STATES.ACTIVE), false);

const refunded = transitionEntitlement({
  entitlement: baseEntitlement,
  toState: ENTITLEMENT_STATES.REFUNDED,
  eventId: 'event-refund-1',
  reason: 'Approved full refund',
  actorType: 'paddle-webhook',
  nowMs: now + 1_000,
});
assert.equal(refunded.entitlement.state, ENTITLEMENT_STATES.REFUNDED);
assert.equal(refunded.entitlement.version, 2);
assert.equal(refunded.event.fromState, ENTITLEMENT_STATES.ACTIVE);
assert.equal(refunded.event.toState, ENTITLEMENT_STATES.REFUNDED);
assert.equal(Object.isFrozen(refunded.event), true);
assert.throws(() => transitionEntitlement({
  entitlement: refunded.entitlement,
  toState: ENTITLEMENT_STATES.ACTIVE,
  eventId: 'event-invalid-1',
  reason: 'Not allowed',
  actorType: 'system',
  nowMs: now + 2_000,
}), /not allowed/);

const offer = createLaunchOffer({ launchStartsAt: nowIso });
assert.equal(offer.launchPriceCents, DEFAULT_LAUNCH_PRICE_CENTS);
assert.equal(offer.standardPriceCents, DEFAULT_STANDARD_PRICE_CENTS);
assert.equal(offer.purchaseLimit, null);
assert.equal(offer.launchEndsAt, null);

assert.equal(evaluateLaunchOffer({ offer, completedLivePurchaseCount: 0, nowMs: now }).priceTier, 'launch');
assert.equal(evaluateLaunchOffer({ offer, completedLivePurchaseCount: 99, nowMs: now }).priceTier, 'launch');
assert.equal(evaluateLaunchOffer({ offer, completedLivePurchaseCount: 1_000_000, nowMs: now }).priceTier, 'launch');
assert.equal(evaluateLaunchOffer({
  offer,
  completedLivePurchaseCount: 1_000_000,
  inFlightLaunchReservationCount: 1_000_000,
  nowMs: now,
}).reason, 'launch-active');

const limitedOffer = createLaunchOffer({
  launchStartsAt: nowIso,
  purchaseLimit: 100,
  durationDays: 30,
});
assert.equal(limitedOffer.purchaseLimit, 100);
assert.equal(limitedOffer.launchEndsAt, new Date(now + (30 * 24 * 60 * 60 * 1000)).toISOString());
assert.equal(evaluateLaunchOffer({ offer: limitedOffer, completedLivePurchaseCount: 100, nowMs: now }).reason, 'launch-purchase-limit-reached');
assert.equal(evaluateLaunchOffer({
  offer: limitedOffer,
  completedLivePurchaseCount: 0,
  nowMs: Date.parse(limitedOffer.launchEndsAt),
}).reason, 'launch-deadline-reached');
assert.equal(evaluateLaunchOffer({
  offer: limitedOffer,
  completedLivePurchaseCount: 1,
  inFlightLaunchReservationCount: 99,
  nowMs: now,
}).reason, 'launch-capacity-reserved');
assert.equal(evaluateLaunchOffer({
  offer,
  completedLivePurchaseCount: 0,
  inFlightLaunchReservationCount: 0,
  closedAt: new Date(now + 10_000).toISOString(),
  nowMs: now + 20_000,
}).reason, 'offer-closed');

class InMemoryPurchaseRepository {
  constructor() {
    this.intents = [];
    this.completedLivePurchaseCount = 0;
    this.closedAt = null;
    this.lockTail = Promise.resolve();
  }

  async withLaunchOfferLock(_productId, work) {
    const previous = this.lockTail;
    let release;
    this.lockTail = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  async getLaunchOfferState() {
    return {
      completedLivePurchaseCount: this.completedLivePurchaseCount,
      inFlightLaunchReservationCount: this.intents.filter((intent) => intent.priceTier === 'launch').length,
      closedAt: this.closedAt,
    };
  }

  async createPurchaseIntent(intent) {
    assert.equal(Object.isFrozen(intent), true);
    this.intents.push(intent);
    return intent;
  }
}

const repository = new InMemoryPurchaseRepository();
const intents = await Promise.all(Array.from({ length: 101 }, (_, index) => reservePurchaseIntent({
  repository,
  offer,
  intentId: `intent-${index + 1}`,
  idempotencyKey: `idempotency-${index + 1}`,
  accountId: `account-${index + 1}`,
  nowMs: now + 5_000,
})));

assert.equal(intents.filter((intent) => intent.priceTier === 'launch').length, 101);
assert.equal(intents.filter((intent) => intent.priceTier === 'standard').length, 0);
assert.equal(intents[0].amountCents, DEFAULT_LAUNCH_PRICE_CENTS);
assert.equal(intents[100].amountCents, DEFAULT_LAUNCH_PRICE_CENTS);
assert.equal(intents[0].offerTerms.selectedAmountCents, DEFAULT_LAUNCH_PRICE_CENTS);
assert.equal(Object.isFrozen(intents[0].offerTerms), true);
assert.equal(repository.intents.length, 101);

repository.closedAt = new Date(now + 6_000).toISOString();
repository.intents = [];
const afterClosure = await reservePurchaseIntent({
  repository,
  offer,
  intentId: 'intent-after-close',
  idempotencyKey: 'idempotency-after-close',
  accountId: 'account-after-close',
  nowMs: now + 7_000,
});
assert.equal(afterClosure.priceTier, 'standard');
assert.equal(afterClosure.offerTerms.selectionReason, 'offer-closed');

console.log('Paid access core tests passed.');
