export const ACQUISITION_ATTRIBUTION_CONTRACT_VERSION = 1;

export const ACQUISITION_CHANNELS = Object.freeze({
  PARTNER: 'partner',
  MEMBER_REFERRAL: 'member_referral',
});

const CHANNELS = new Set(Object.values(ACQUISITION_CHANNELS));
const PARTNER_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,47}$/;
const REFERRAL_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{5,31}$/;
const CAMPAIGN_PATTERN = /^[a-zA-Z0-9._~-]{1,64}$/;
const ROUTE_PATTERN = /^\/[a-zA-Z0-9/_-]{0,199}$/;

function normalizedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalCampaignValue(value, fieldName) {
  const normalized = normalizedString(value);
  if (!normalized) return null;
  if (!CAMPAIGN_PATTERN.test(normalized)) {
    throw new TypeError(`${fieldName} is invalid.`);
  }
  return normalized;
}

function optionalLandingPath(value) {
  const normalized = normalizedString(value);
  if (!normalized) return null;
  if (!ROUTE_PATTERN.test(normalized) || normalized.includes('//')) {
    throw new TypeError('landingPath is invalid.');
  }
  return normalized;
}

function normalizePartnerId(value) {
  const partnerId = normalizedString(value).toLowerCase();
  if (!partnerId) return null;
  if (!PARTNER_ID_PATTERN.test(partnerId)) {
    throw new TypeError('partnerId must be a lowercase stable identifier.');
  }
  return partnerId;
}

function normalizeReferralCode(value) {
  const referralCode = normalizedString(value).toUpperCase();
  if (!referralCode) return null;
  if (!REFERRAL_CODE_PATTERN.test(referralCode)) {
    throw new TypeError('referralCode must be a stable non-personal code.');
  }
  return referralCode;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function normalizeAcquisitionAttribution(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Attribution input must be an object.');
  }

  const partnerId = normalizePartnerId(input.partnerId);
  const referralCode = normalizeReferralCode(input.referralCode);

  if (partnerId && referralCode) {
    throw new TypeError('Partner and member-referral attribution cannot stack on one purchase.');
  }

  if (!partnerId && !referralCode) return null;

  const channel = partnerId
    ? ACQUISITION_CHANNELS.PARTNER
    : ACQUISITION_CHANNELS.MEMBER_REFERRAL;

  return deepFreeze({
    contractVersion: ACQUISITION_ATTRIBUTION_CONTRACT_VERSION,
    channel,
    partnerId,
    referralCode,
    landingPath: optionalLandingPath(input.landingPath),
    utmSource: optionalCampaignValue(input.utmSource, 'utmSource'),
    utmMedium: optionalCampaignValue(input.utmMedium, 'utmMedium'),
    utmCampaign: optionalCampaignValue(input.utmCampaign, 'utmCampaign'),
  });
}

export function validateAcquisitionAttribution(attribution) {
  if (!attribution || typeof attribution !== 'object' || Array.isArray(attribution)) {
    throw new TypeError('A normalized attribution object is required.');
  }

  if (attribution.contractVersion !== ACQUISITION_ATTRIBUTION_CONTRACT_VERSION) {
    throw new TypeError('Attribution contractVersion is unsupported.');
  }

  if (!CHANNELS.has(attribution.channel)) {
    throw new TypeError('Attribution channel is invalid.');
  }

  const normalized = normalizeAcquisitionAttribution({
    partnerId: attribution.partnerId,
    referralCode: attribution.referralCode,
    landingPath: attribution.landingPath,
    utmSource: attribution.utmSource,
    utmMedium: attribution.utmMedium,
    utmCampaign: attribution.utmCampaign,
  });

  if (!normalized || normalized.channel !== attribution.channel) {
    throw new TypeError('Attribution channel does not match its identifier.');
  }

  return normalized;
}

export function toCommerceAttributionMetadata(attribution) {
  if (attribution == null) return {};
  const normalized = validateAcquisitionAttribution(attribution);

  return deepFreeze({
    acquisitionAttribution: {
      contractVersion: normalized.contractVersion,
      channel: normalized.channel,
      partnerId: normalized.partnerId,
      referralCode: normalized.referralCode,
      landingPath: normalized.landingPath,
      utmSource: normalized.utmSource,
      utmMedium: normalized.utmMedium,
      utmCampaign: normalized.utmCampaign,
    },
  });
}

export function attributionRewardEligible(attribution, options = {}) {
  const normalized = validateAcquisitionAttribution(attribution);
  const {
    paymentCompleted = false,
    refunded = false,
    disputed = false,
    chargebackCompleted = false,
    selfReferral = false,
    partnerApproved = false,
    memberReferralApproved = false,
  } = options;

  if (!paymentCompleted || refunded || disputed || chargebackCompleted || selfReferral) return false;

  if (normalized.channel === ACQUISITION_CHANNELS.PARTNER) {
    return partnerApproved === true;
  }

  return memberReferralApproved === true;
}

export const acquisitionAttributionRules = deepFreeze({
  identifiersAreNonPersonal: true,
  stackingAllowed: false,
  entitlementAuthority: false,
  priceAuthority: false,
  productAuthority: false,
  rewardRequiresVerifiedPayment: true,
  refundReversesRewardEligibility: true,
  disputeSuspendsRewardEligibility: true,
  chargebackReversesRewardEligibility: true,
  selfReferralEligible: false,
});
