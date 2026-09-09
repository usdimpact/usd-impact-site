export const MEMBER_REFERRAL_POLICY_VERSION = 1;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const PARTNER_COMMISSION_TIERS = deepFreeze({
  standard: 0.15,
  growth: 0.2,
  preferred: 0.25,
  strategicMaximum: 0.3,
});

export const PARTNER_COMMISSION_CEILING = PARTNER_COMMISSION_TIERS.strategicMaximum;

export const MEMBER_REFERRAL_MILESTONES = deepFreeze([
  { qualifiedReferrals: 1, totalFreeMonths: 3, incrementalFreeMonths: 3 },
  { qualifiedReferrals: 3, totalFreeMonths: 6, incrementalFreeMonths: 3 },
  { qualifiedReferrals: 5, totalFreeMonths: 12, incrementalFreeMonths: 6 },
]);

export const memberReferralPolicy = deepFreeze({
  contractVersion: MEMBER_REFERRAL_POLICY_VERSION,
  status: 'inactive',
  runtimeEnabled: false,
  priceAuthority: false,
  entitlementAuthority: false,
  partnerCommission: {
    eligibleProduct: 'library-pass',
    fullPriceOnly: true,
    tiers: PARTNER_COMMISSION_TIERS,
    ceiling: PARTNER_COMMISSION_CEILING,
  },
  newClientBenefit: {
    eligibleProduct: 'research-membership',
    billingPeriod: 'annual',
    discountRate: 0.5,
    discountTerm: 'first_annual_term',
  },
  referringMemberBenefit: {
    type: 'research_access_months',
    cashValue: false,
    annualDiscount: false,
    maximumFreeMonths: 12,
    milestones: MEMBER_REFERRAL_MILESTONES,
  },
  intendedCustomerProgramPairing: {
    buyerFirstAnnualDiscount: true,
    referringMemberFreeMonths: true,
  },
  affiliateAndCustomerProgramStackingAllowed: false,
});

export function getPartnerCommissionTier(rate) {
  if (!Number.isFinite(rate) || rate < 0) return null;
  return Object.entries(PARTNER_COMMISSION_TIERS).find(([, tierRate]) => tierRate === rate)?.[0] ?? null;
}

export function getMemberReferralProgress(qualifiedReferrals, alreadyGrantedMonths = 0) {
  if (!Number.isInteger(qualifiedReferrals) || qualifiedReferrals < 0) {
    throw new TypeError('qualifiedReferrals must be a non-negative integer.');
  }
  if (!Number.isInteger(alreadyGrantedMonths) || alreadyGrantedMonths < 0) {
    throw new TypeError('alreadyGrantedMonths must be a non-negative integer.');
  }

  const achieved = MEMBER_REFERRAL_MILESTONES
    .filter((milestone) => qualifiedReferrals >= milestone.qualifiedReferrals)
    .at(-1) ?? null;
  const next = MEMBER_REFERRAL_MILESTONES.find(
    (milestone) => qualifiedReferrals < milestone.qualifiedReferrals,
  ) ?? null;
  const totalFreeMonths = achieved?.totalFreeMonths ?? 0;

  return deepFreeze({
    qualifiedReferrals,
    achievedThreshold: achieved?.qualifiedReferrals ?? 0,
    totalFreeMonths,
    additionalFreeMonths: Math.max(0, totalFreeMonths - alreadyGrantedMonths),
    nextThreshold: next?.qualifiedReferrals ?? null,
    nextTotalFreeMonths: next?.totalFreeMonths ?? null,
    maximumReached: totalFreeMonths === memberReferralPolicy.referringMemberBenefit.maximumFreeMonths,
  });
}

export function evaluateMemberReferralEvent(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Member-referral event input must be an object.');
  }

  const reasons = [];
  const reject = (condition, reason) => {
    if (condition) reasons.push(reason);
  };

  reject(input.memberReferralApproved !== true, 'member_referral_not_approved');
  reject(input.paymentCompleted !== true, 'payment_not_completed');
  reject(input.referrerResearchEntitled !== true, 'referrer_not_research_entitled');
  reject(input.referrerInternalAccount !== false, 'internal_account');
  reject(input.newResearchCustomer !== true, 'buyer_not_new_research_customer');
  reject(input.annualResearchPurchase !== true, 'purchase_not_annual_research');
  reject(input.firstAnnualTerm !== true, 'purchase_not_first_annual_term');
  reject(input.buyerDiscountRate !== memberReferralPolicy.newClientBenefit.discountRate, 'incorrect_buyer_discount');
  reject(input.affiliateAttributed !== false, 'affiliate_customer_program_stacking');
  reject(input.otherCheckoutDiscount !== false, 'checkout_discount_stacking');
  reject(input.selfReferral !== false, 'self_referral');
  reject(input.circularReferral !== false, 'circular_referral');
  reject(input.buyerAlreadyCounted !== false, 'buyer_already_counted');
  reject(input.refunded !== false, 'refunded');
  reject(input.disputed !== false, 'disputed');
  reject(input.chargebackCompleted !== false, 'chargeback_completed');

  const referralCountValid = Number.isInteger(input.qualifiedReferralsAfterEvent)
    && input.qualifiedReferralsAfterEvent >= 1;
  reject(!referralCountValid, 'invalid_qualified_referral_count');

  const alreadyGrantedMonthsValid = Number.isInteger(input.alreadyGrantedMonths)
    && input.alreadyGrantedMonths >= 0
    && input.alreadyGrantedMonths <= memberReferralPolicy.referringMemberBenefit.maximumFreeMonths;
  reject(!alreadyGrantedMonthsValid, 'invalid_already_granted_months');

  const progress = getMemberReferralProgress(
    referralCountValid ? input.qualifiedReferralsAfterEvent : 0,
    alreadyGrantedMonthsValid ? input.alreadyGrantedMonths : 0,
  );
  reject(
    alreadyGrantedMonthsValid && input.alreadyGrantedMonths > progress.totalFreeMonths,
    'already_granted_months_exceed_earned_total',
  );

  const qualifiesUnderPolicy = reasons.length === 0;

  return deepFreeze({
    qualifiesUnderPolicy,
    runtimeEligible: qualifiesUnderPolicy && memberReferralPolicy.runtimeEnabled,
    reasons,
    benefits: {
      newClient: {
        discountRate: memberReferralPolicy.newClientBenefit.discountRate,
        discountTerm: memberReferralPolicy.newClientBenefit.discountTerm,
      },
      referringMember: {
        totalFreeMonths: progress.totalFreeMonths,
        additionalFreeMonths: progress.additionalFreeMonths,
        annualDiscount: false,
        cashValue: false,
      },
    },
    runtimeEnabled: memberReferralPolicy.runtimeEnabled,
    priceAuthority: memberReferralPolicy.priceAuthority,
    entitlementAuthority: memberReferralPolicy.entitlementAuthority,
  });
}
