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

for (const [field, reason] of [
  ['affiliateAttributed', 'affiliate_customer_program_stacking'],
  ['otherCheckoutDiscount', 'checkout_discount_stacking'],
  ['selfReferral', 'self_referral'],
  ['circularReferral', 'circular_referral'],
  ['buyerAlreadyCounted', 'buyer_already_counted'],
  ['refunded', 'refunded'],
  ['disputed', 'disputed'],
  ['chargebackCompleted', 'chargeback_completed'],
]) {
  const result = evaluateMemberReferralEvent({ ...validInput, [field]: true });
  assert.equal(result.qualifiesUnderPolicy, false);
  assert.equal(result.runtimeEligible, false);
  assert.equal(result.reasons.includes(reason), true);
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
