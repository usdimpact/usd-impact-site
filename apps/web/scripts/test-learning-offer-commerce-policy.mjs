import assert from 'node:assert/strict';
import { readResearchMembershipCheckoutConfig, buildResearchMembershipCheckoutRequest } from '../src/lib/research-membership-first-purchase.js';
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


// Guard Research checkout against any future coupling to FREE/PAID education.
// All provider IDs, emails, credentials and identities below are synthetic.
// Configuration and checkout payload builders run entirely offline: no fetch,
// merchant checkout, real account creation, or subscription mutation.
const researchAccount = Object.freeze({ id: '11111111-1111-4111-8111-111111111111' });
const researchPreviewEnvironment = Object.freeze({
  VERCEL_ENV: 'preview',
  RESEARCH_MEMBERSHIP_WEBHOOK_ENABLED: 'true',
  LEMON_SQUEEZY_RESEARCH_TEST_MODE: 'true',
  LEMON_SQUEEZY_RESEARCH_TEST_STORE_ID: '42',
  LEMON_SQUEEZY_RESEARCH_TEST_PRODUCT_ID: '99',
  LEMON_SQUEEZY_RESEARCH_TEST_MONTHLY_VARIANT_ID: '314',
  LEMON_SQUEEZY_RESEARCH_TEST_ANNUAL_VARIANT_ID: '315',
  LEMON_SQUEEZY_TEST_API_KEY: 'test_api_key_abcdefghijklmnopqrstuvwxyz',
  COMMERCE_SANDBOX_QA_EMAIL: 'qa@example.com',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
});
const researchProductionEnvironment = Object.freeze({
  VERCEL_ENV: 'production',
  RESEARCH_MEMBERSHIP_WEBHOOK_ENABLED: 'true',
  RESEARCH_MEMBERSHIP_PRODUCTION_ACTIVATION_APPROVED: 'true',
  RESEARCH_MEMBERSHIP_PRODUCTION_CHECKOUT_ENABLED: 'true',
  LEMON_SQUEEZY_RESEARCH_PRODUCTION_TEST_MODE: 'false',
  LEMON_SQUEEZY_RESEARCH_PRODUCTION_STORE_ID: '142',
  LEMON_SQUEEZY_RESEARCH_PRODUCTION_PRODUCT_ID: '199',
  LEMON_SQUEEZY_RESEARCH_PRODUCTION_MONTHLY_VARIANT_ID: '414',
  LEMON_SQUEEZY_RESEARCH_PRODUCTION_ANNUAL_VARIANT_ID: '415',
  LEMON_SQUEEZY_RESEARCH_PRODUCTION_API_KEY: 'research_live_api_key_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
});
const fictionalNow = new Date('2026-11-02T12:00:00.000Z');
for (const [environment, email] of [
  [researchPreviewEnvironment, 'qa@example.com'],
  [researchProductionEnvironment, 'member@example.com'],
]) {
  const baseline = readResearchMembershipCheckoutConfig(environment);
  assert.ok(Object.isFrozen(baseline));
  const checkoutFor = (config, interval) => buildResearchMembershipCheckoutRequest({
    config,
    user: { ...researchAccount, email },
    billingInterval: interval,
    idempotencyKey: `research-isolation-${interval}-001`,
    now: fictionalNow,
  });
  const monthlyBaseline = checkoutFor(baseline, 'monthly');
  const annualBaseline = checkoutFor(baseline, 'annual');
  const variants = [undefined, 'legacy', 'free', 'paid', 'PAID', 'invalid', ' '];
  for (const mode of variants) {
    const offerEnvironment = mode === undefined
      ? environment
      : { ...environment, [LEARNING_OFFER_MODE_KEY]: mode };
    const researchConfig = readResearchMembershipCheckoutConfig(offerEnvironment);
    assert.deepEqual(researchConfig, baseline, 'Research configuration must not inherit educational offer mode.');
    assert.deepEqual(checkoutFor(researchConfig, 'monthly'), monthlyBaseline);
    assert.deepEqual(checkoutFor(researchConfig, 'annual'), annualBaseline);
    for (const futureFreeCommitted of [false, true]) {
      const learningPolicy = resolveLearningOfferCommercePolicyForRelease(offerEnvironment, futureFreeCommitted);
      assert.equal(typeof learningPolicy.allowNewLibraryCheckout, 'boolean');
      assert.deepEqual(readResearchMembershipCheckoutConfig(offerEnvironment), baseline);
    }
  }
  // A free education mode must never silently ENABLE disabled Research billing.
  for (const mode of ['free', 'paid']) {
    assert.throws(
      () => readResearchMembershipCheckoutConfig({
        ...environment,
        RESEARCH_MEMBERSHIP_WEBHOOK_ENABLED: 'false',
        [LEARNING_OFFER_MODE_KEY]: mode,
      }),
      { code: 'RESEARCH_WEBHOOK_DISABLED' },
    );
  }
}
console.log('Research checkout remains independent of learning-offer states (synthetic, offline).');

console.log('Free-first/new-paid Library checkout policy offline unit tests passed.');
