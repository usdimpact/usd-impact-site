import assert from 'node:assert/strict';
import {
  MEMBER_REFERRAL_MILESTONES,
  PARTNER_COMMISSION_CEILING,
  PARTNER_COMMISSION_TIERS,
  evaluateMemberReferralEvent,
  getMemberReferralProgress,
  getPartnerCommissionTier,
  memberReferralPolicy,
} from '../src/lib/member-referral-policy.js';

assert.deepEqual(Object.values(PARTNER_COMMISSION_TIERS), [0.15, 0.2, 0.25, 0.3]);
assert.equal(PARTNER_COMMISSION_CEILING, 0.3);
assert.equal(getPartnerCommissionTier(0.15), 'standard');
assert.equal(getPartnerCommissionTier(0.2), 'growth');
assert.equal(getPartnerCommissionTier(0.25), 'preferred');
assert.equal(getPartnerCommissionTier(0.3), 'strategicMaximum');
assert.equal(getPartnerCommissionTier(0.1), null);
assert.equal(getPartnerCommissionTier(0.31), null);

assert.deepEqual(
  MEMBER_REFERRAL_MILESTONES.map((milestone) => [
    milestone.qualifiedReferrals,
    milestone.totalFreeMonths,
    milestone.incrementalFreeMonths,
  ]),
  [[1, 3, 3], [3, 6, 3], [5, 12, 6]],
);

assert.equal(getMemberReferralProgress(0).totalFreeMonths, 0);
assert.equal(getMemberReferralProgress(1, 0).additionalFreeMonths, 3);
assert.equal(getMemberReferralProgress(2, 3).additionalFreeMonths, 0);
assert.equal(getMemberReferralProgress(3, 3).additionalFreeMonths, 3);
assert.equal(getMemberReferralProgress(4, 6).additionalFreeMonths, 0);
assert.equal(getMemberReferralProgress(5, 6).additionalFreeMonths, 6);
assert.equal(getMemberReferralProgress(6, 12).additionalFreeMonths, 0);
assert.equal(getMemberReferralProgress(5).maximumReached, true);
assert.throws(() => getMemberReferralProgress(-1), /non-negative integer/);
assert.throws(() => getMemberReferralProgress(1.5), /non-negative integer/);

const validInput = {
  memberReferralApproved: true,
  paymentCompleted: true,
  referrerResearchEntitled: true,
  referrerInternalAccount: false,
  newResearchCustomer: true,
  annualResearchPurchase: true,
  firstAnnualTerm: true,
  buyerDiscountRate: 0.5,
  affiliateAttributed: false,
  otherCheckoutDiscount: false,
  selfReferral: false,
  circularReferral: false,
  buyerAlreadyCounted: false,
  refunded: false,
  disputed: false,
  chargebackCompleted: false,
  qualifiedReferralsAfterEvent: 1,
  alreadyGrantedMonths: 0,
};

const valid = evaluateMemberReferralEvent(validInput);
assert.equal(valid.qualifiesUnderPolicy, true);
assert.equal(valid.runtimeEligible, false);
assert.equal('eligible' in valid, false);
assert.deepEqual(valid.reasons, []);
assert.equal(valid.benefits.newClient.discountRate, 0.5);
assert.equal(valid.benefits.newClient.discountTerm, 'first_annual_term');
assert.equal(valid.benefits.referringMember.totalFreeMonths, 3);
assert.equal(valid.benefits.referringMember.additionalFreeMonths, 3);
assert.equal(valid.benefits.referringMember.annualDiscount, false);
assert.equal(valid.benefits.referringMember.cashValue, false);

const explicitFalseGates = [
  ['referrerInternalAccount', 'internal_account'],
  ['affiliateAttributed', 'affiliate_customer_program_stacking'],
  ['otherCheckoutDiscount', 'checkout_discount_stacking'],
  ['selfReferral', 'self_referral'],
  ['circularReferral', 'circular_referral'],
  ['buyerAlreadyCounted', 'buyer_already_counted'],
  ['refunded', 'refunded'],
  ['disputed', 'disputed'],
  ['chargebackCompleted', 'chargeback_completed'],
];

for (const [field, reason] of explicitFalseGates) {
  for (const unsafeValue of [true, undefined, null, 'unknown']) {
    const candidate = { ...validInput };
    if (unsafeValue === undefined) delete candidate[field];
    else candidate[field] = unsafeValue;
    const result = evaluateMemberReferralEvent(candidate);
    assert.equal(result.qualifiesUnderPolicy, false, `${field}=${String(unsafeValue)} must fail closed`);
    assert.equal(result.runtimeEligible, false);
    assert.equal(result.reasons.includes(reason), true);
  }
}

assert.equal(
  evaluateMemberReferralEvent({ ...validInput, firstAnnualTerm: false }).reasons.includes('purchase_not_first_annual_term'),
  true,
);
assert.equal(
  evaluateMemberReferralEvent({ ...validInput, buyerDiscountRate: 0.3 }).reasons.includes('incorrect_buyer_discount'),
  true,
);
assert.equal(
  evaluateMemberReferralEvent({ ...validInput, memberReferralApproved: false }).reasons.includes('member_referral_not_approved'),
  true,
);

for (const [field, reason] of [
  ['memberReferralApproved', 'member_referral_not_approved'],
  ['paymentCompleted', 'payment_not_completed'],
  ['referrerResearchEntitled', 'referrer_not_research_entitled'],
  ['newResearchCustomer', 'buyer_not_new_research_customer'],
  ['annualResearchPurchase', 'purchase_not_annual_research'],
  ['firstAnnualTerm', 'purchase_not_first_annual_term'],
]) {
  for (const invalidValue of [false, undefined, null, 'unknown']) {
    const candidate = { ...validInput };
    if (invalidValue === undefined) delete candidate[field];
    else candidate[field] = invalidValue;
    const result = evaluateMemberReferralEvent(candidate);
    assert.equal(result.qualifiesUnderPolicy, false, `${field}=${String(invalidValue)} must fail closed`);
    assert.equal(result.runtimeEligible, false);
    assert.equal(result.reasons.includes(reason), true);
  }
}

for (const invalidValue of [undefined, null, -1, 1.5, 13, '0']) {
  const candidate = { ...validInput };
  if (invalidValue === undefined) delete candidate.alreadyGrantedMonths;
  else candidate.alreadyGrantedMonths = invalidValue;
  const result = evaluateMemberReferralEvent(candidate);
  assert.equal(
    result.qualifiesUnderPolicy,
    false,
    `alreadyGrantedMonths=${String(invalidValue)} must fail closed`,
  );
  assert.equal(result.runtimeEligible, false);
  assert.equal(result.reasons.includes('invalid_already_granted_months'), true);
}

const inconsistentGrantState = evaluateMemberReferralEvent({
  ...validInput,
  qualifiedReferralsAfterEvent: 1,
  alreadyGrantedMonths: 6,
});
assert.equal(inconsistentGrantState.qualifiesUnderPolicy, false);
assert.equal(inconsistentGrantState.runtimeEligible, false);
assert.equal(
  inconsistentGrantState.reasons.includes('already_granted_months_exceed_earned_total'),
  true,
);

assert.equal(memberReferralPolicy.status, 'inactive');
assert.equal(memberReferralPolicy.runtimeEnabled, false);
assert.equal(memberReferralPolicy.priceAuthority, false);
assert.equal(memberReferralPolicy.entitlementAuthority, false);
assert.equal(memberReferralPolicy.referringMemberBenefit.annualDiscount, false);
assert.equal(memberReferralPolicy.intendedCustomerProgramPairing.buyerFirstAnnualDiscount, true);
assert.equal(memberReferralPolicy.intendedCustomerProgramPairing.referringMemberFreeMonths, true);
assert.equal(memberReferralPolicy.affiliateAndCustomerProgramStackingAllowed, false);
assert.equal(Object.isFrozen(memberReferralPolicy), true);
assert.equal(Object.isFrozen(MEMBER_REFERRAL_MILESTONES), true);

console.log('Inactive member-referral policy contract tests passed.');
