import assert from 'node:assert/strict';
import {
  LEARNING_OFFER_MODE_KEY,
  LEARNING_OFFER_MODES,
  FREE_CORE_PUBLIC_RELEASE_COMMITTED,
  resolveLearningOfferCommercePolicyForRelease,
  gateLearningOfferCommerceReadiness,
  resolveLearningOfferCommercePolicy,
} from '../src/lib/learning-offer-commerce-policy.js';

for (const value of [undefined, null, '', 'legacy', ' LEGACY ']) {
  const env = value === undefined ? {} : { [LEARNING_OFFER_MODE_KEY]: value };
  const policy = resolveLearningOfferCommercePolicy(env);
  assert.equal(policy.mode, LEARNING_OFFER_MODES.LEGACY);
  assert.equal(policy.allowNewLibraryCheckout, true);
  assert.ok(Object.isFrozen(policy));
}

for (const [rawMode, expectedMode] of [
  ['free', LEARNING_OFFER_MODES.FREE],
  [' FREE ', LEARNING_OFFER_MODES.FREE],
  ['paid', LEARNING_OFFER_MODES.PAID],
  ['paid-pending', LEARNING_OFFER_MODES.INVALID],
  [' ' , LEARNING_OFFER_MODES.INVALID],
  ['on', LEARNING_OFFER_MODES.INVALID],
  ['true', LEARNING_OFFER_MODES.INVALID],
  [true, LEARNING_OFFER_MODES.INVALID],
]) {
  const policy = resolveLearningOfferCommercePolicy({ [LEARNING_OFFER_MODE_KEY]: rawMode });
  assert.equal(policy.mode, expectedMode);
  assert.equal(policy.allowNewLibraryCheckout, false);
}
assert.equal(resolveLearningOfferCommercePolicy(null).allowNewLibraryCheckout, false);

const approvedLegacyReadiness = Object.freeze({
  contractVersion: 3,
  state: 'active',
  mode: 'live',
  checkoutEnabled: true,
  disclosuresComplete: true,
});
assert.equal(gateLearningOfferCommerceReadiness(approvedLegacyReadiness, {}), approvedLegacyReadiness);
for (const mode of ['free', 'paid', 'invalid']) {
  const gated = gateLearningOfferCommerceReadiness(approvedLegacyReadiness, { [LEARNING_OFFER_MODE_KEY]: mode });
  assert.equal(gated.state, 'blocked');
  assert.equal(gated.checkoutEnabled, false);
  assert.equal(gated.mode, 'live'); // Provider readiness is not a site-mode switch.
  assert.equal(gated.disclosuresComplete, true);
  assert.ok(Object.isFrozen(gated));
}
assert.equal(approvedLegacyReadiness.checkoutEnabled, true); // No mutation.
assert.throws(() => gateLearningOfferCommerceReadiness(null, {}), TypeError);


assert.equal(FREE_CORE_PUBLIC_RELEASE_COMMITTED, false, 'This Draft must never commit the public free launch.');
for (const rawMode of [undefined, null, '', 'free', ' FREE ']) {
  const env = rawMode === undefined ? {} : { [LEARNING_OFFER_MODE_KEY]: rawMode };
  const future = resolveLearningOfferCommercePolicyForRelease(env, true);
  assert.equal(future.mode, LEARNING_OFFER_MODES.FREE);
  assert.equal(future.allowNewLibraryCheckout, false);
  assert.ok(Object.isFrozen(future));
}
for (const rawMode of ['legacy', ' LEGACY ', 'paid-pending', 'true', ' ', true, 42]) {
  const future = resolveLearningOfferCommercePolicyForRelease({ [LEARNING_OFFER_MODE_KEY]: rawMode }, true);
  assert.equal(future.mode, LEARNING_OFFER_MODES.INVALID);
  assert.equal(future.allowNewLibraryCheckout, false);
}
const futurePaid = resolveLearningOfferCommercePolicyForRelease({ [LEARNING_OFFER_MODE_KEY]: 'paid' }, true);
assert.equal(futurePaid.mode, LEARNING_OFFER_MODES.PAID);
assert.equal(futurePaid.allowNewLibraryCheckout, false, 'A paid request is not a merchant authorization.');
assert.equal(resolveLearningOfferCommercePolicyForRelease({}, false).allowNewLibraryCheckout, true);
assert.equal(resolveLearningOfferCommercePolicyForRelease(null, true).allowNewLibraryCheckout, false);
assert.equal(resolveLearningOfferCommercePolicyForRelease({}, 'true').allowNewLibraryCheckout, false);

console.log('Free-first/new-paid Library checkout policy offline unit tests passed.');
