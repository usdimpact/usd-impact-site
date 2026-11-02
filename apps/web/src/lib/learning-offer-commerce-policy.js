// Draft UI-37 policy for the future free-first educational offer. This does not
// authorize media release or new paid products; default behavior is unchanged.
export const LEARNING_OFFER_MODE_KEY = 'USD_IMPACT_LEARNING_OFFER_MODE';

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
export function resolveLearningOfferCommercePolicy(environment = process.env) {
  if (!environment || typeof environment !== 'object' || Array.isArray(environment)) {
    return Object.freeze({ mode: LEARNING_OFFER_MODES.INVALID, allowNewLibraryCheckout: false });
  }

  const configured = environment[LEARNING_OFFER_MODE_KEY];
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
