// Draft UI-37 policy for the future free-first educational offer. This does not
// authorize media release or new paid products; default behavior is unchanged.
export const LEARNING_OFFER_MODE_KEY = 'USD_IMPACT_LEARNING_OFFER_MODE';

// One-way SOURCE-COMMITTED free-launch safety barrier. It is intentionally
// false in this Draft and in current Production. The future FREE launch must
// change it to true in an independently approved exact-head release commit,
// together with the authorized free routes, customer terms and media rights.
// After that release, missing/stale 'legacy' env values cannot reopen checkout.
// Never roll back a publicly free release to an earlier pre-free commit.
export const FREE_CORE_PUBLIC_RELEASE_COMMITTED = false;

export const LEARNING_OFFER_MODES = Object.freeze({
  LEGACY: 'legacy',
  FREE: 'free',
  PAID: 'paid',
  INVALID: 'invalid',
});

/**
 * Only the existing (already released) Library Pass checkout is permitted by
 * default. "free" prevents new Library purchases; "paid" is an intentionally
 * closed placeholder until a separately approved SKU, terms and access policy
 * have been implemented. Existing webhook/reconciliation and Research flows
 * are deliberately outside this policy.
 */
// Tests model both pre-free and future free-committed releases without
// altering process.env or changing the Production baseline.
export function resolveLearningOfferCommercePolicyForRelease(environment, freeReleaseCommitted) {
  if (typeof freeReleaseCommitted !== 'boolean'
      || !environment || typeof environment !== 'object' || Array.isArray(environment)) {
    return Object.freeze({ mode: LEARNING_OFFER_MODES.INVALID, allowNewLibraryCheckout: false });
  }

  const configured = environment[LEARNING_OFFER_MODE_KEY];

  if (freeReleaseCommitted) {
    // No calendar-based transition. Once the public free launch is committed,
    // the old $39 Library checkout stays shut even when the env key disappears
    // or a stale 'legacy' value is restored. A future 'paid' request remains
    // CLOSED until a new, separately licensed product and consumer contract
    // are reviewed and implemented.
    if (configured === undefined || configured === null || configured === '') {
      return Object.freeze({ mode: LEARNING_OFFER_MODES.FREE, allowNewLibraryCheckout: false });
    }
    if (typeof configured !== 'string') {
      return Object.freeze({ mode: LEARNING_OFFER_MODES.INVALID, allowNewLibraryCheckout: false });
    }
    const next = configured.trim().toLowerCase();
    if (next === LEARNING_OFFER_MODES.FREE || next === LEARNING_OFFER_MODES.PAID) {
      return Object.freeze({ mode: next, allowNewLibraryCheckout: false });
    }
    return Object.freeze({ mode: LEARNING_OFFER_MODES.INVALID, allowNewLibraryCheckout: false });
  }
  // Keep the established Production Library checkout unchanged unless the
  // owner explicitly supplies a new server-side offer-mode setting.
  if (configured === undefined || configured === null || configured === '') {
    return Object.freeze({ mode: LEARNING_OFFER_MODES.LEGACY, allowNewLibraryCheckout: true });
  }
  if (typeof configured !== 'string') {
    return Object.freeze({ mode: LEARNING_OFFER_MODES.INVALID, allowNewLibraryCheckout: false });
  }
  const mode = configured.trim().toLowerCase();
  if (mode === LEARNING_OFFER_MODES.LEGACY) {
    return Object.freeze({ mode, allowNewLibraryCheckout: true });
  }
  if (mode === LEARNING_OFFER_MODES.FREE || mode === LEARNING_OFFER_MODES.PAID) {
    return Object.freeze({ mode, allowNewLibraryCheckout: false });
  }
  return Object.freeze({ mode: LEARNING_OFFER_MODES.INVALID, allowNewLibraryCheckout: false });
}

// Runtime entry point has no caller-controlled override of the committed
// free-launch barrier. New entitlements and Research subscriptions do not
// depend on the learning offer checkout policy.
export function resolveLearningOfferCommercePolicy(environment = process.env) {
  return resolveLearningOfferCommercePolicyForRelease(environment, FREE_CORE_PUBLIC_RELEASE_COMMITTED);
}

export function gateLearningOfferCommerceReadiness(commerce, environment = process.env) {
  if (!commerce || typeof commerce !== 'object' || Array.isArray(commerce)) {
    throw new TypeError('Commerce readiness must be an object.');
  }
  if (resolveLearningOfferCommercePolicy(environment).allowNewLibraryCheckout) return commerce;
  // Never advertise the existing paid Library Pass checkout when educational
  // access is intended to be free, unrecognized, or awaiting a NEW paid offer.
  return Object.freeze({
    ...commerce,
    state: 'blocked',
    checkoutEnabled: false,
    message: 'Library Pass checkout is not offered under the current learning access policy.',
  });
}
