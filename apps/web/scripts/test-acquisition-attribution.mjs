import assert from 'node:assert/strict';
import {
  ACQUISITION_CHANNELS,
  acquisitionAttributionRules,
  attributionRewardEligible,
  normalizeAcquisitionAttribution,
  toCommerceAttributionMetadata,
  validateAcquisitionAttribution,
} from '../src/lib/acquisition-attribution.js';

const partner = normalizeAcquisitionAttribution({
  partnerId: 'macro-educator-01',
  landingPath: '/usd-gold/',
  utmSource: 'creator',
  utmMedium: 'partner',
  utmCampaign: 'launch-beta',
});

assert.equal(partner.channel, ACQUISITION_CHANNELS.PARTNER);
assert.equal(partner.partnerId, 'macro-educator-01');
assert.equal(partner.referralCode, null);
assert.equal(partner.landingPath, '/usd-gold/');
assert.deepEqual(validateAcquisitionAttribution(partner), partner);

const referral = normalizeAcquisitionAttribution({
  referralCode: 'MEMBER_8A41ZX',
  landingPath: '/start-here/',
});
assert.equal(referral.channel, ACQUISITION_CHANNELS.MEMBER_REFERRAL);
assert.equal(referral.referralCode, 'MEMBER_8A41ZX');
assert.equal(referral.partnerId, null);

assert.equal(normalizeAcquisitionAttribution({}), null);

assert.throws(
  () => normalizeAcquisitionAttribution({ partnerId: 'partner-one', referralCode: 'MEMBER123' }),
  /cannot stack/,
);
assert.throws(() => normalizeAcquisitionAttribution({ partnerId: 'A' }), /partnerId/);
assert.throws(() => normalizeAcquisitionAttribution({ referralCode: 'short' }), /referralCode/);
assert.throws(
  () => normalizeAcquisitionAttribution({ partnerId: 'partner-one', landingPath: '//external.example' }),
  /landingPath/,
);

const metadata = toCommerceAttributionMetadata(partner);
assert.equal(metadata.acquisitionAttribution.channel, ACQUISITION_CHANNELS.PARTNER);
assert.equal(metadata.acquisitionAttribution.partnerId, 'macro-educator-01');

assert.equal(
  attributionRewardEligible(partner, { paymentCompleted: true, partnerApproved: true }),
  true,
);
assert.equal(
  attributionRewardEligible(partner, { paymentCompleted: true, partnerApproved: false }),
  false,
);
assert.equal(
  attributionRewardEligible(partner, { paymentCompleted: true, partnerApproved: true, refunded: true }),
  false,
);
assert.equal(
  attributionRewardEligible(partner, { paymentCompleted: true, partnerApproved: true, disputed: true }),
  false,
);
assert.equal(
  attributionRewardEligible(partner, { paymentCompleted: true, partnerApproved: true, selfReferral: true }),
  false,
);
assert.equal(
  attributionRewardEligible(referral, { paymentCompleted: true, memberReferralApproved: true }),
  true,
);
assert.equal(
  attributionRewardEligible(referral, { paymentCompleted: true, memberReferralApproved: true, chargebackCompleted: true }),
  false,
);

assert.equal(acquisitionAttributionRules.stackingAllowed, false);
assert.equal(acquisitionAttributionRules.entitlementAuthority, false);
assert.equal(acquisitionAttributionRules.priceAuthority, false);
assert.equal(acquisitionAttributionRules.rewardRequiresVerifiedPayment, true);

console.log('Acquisition attribution contract tests passed.');
