import assert from 'node:assert/strict';
import { resolveCommercePublicDisclosure } from '../src/lib/commerce-public-disclosure.js';
import {
  CANONICAL_COMMERCE_EVENT_TYPES,
  COMMERCE_MODES,
  COMMERCE_READINESS_STATES,
  REQUIRED_COMMERCE_CAPABILITIES,
  createCommerceAdapterRegistry,
  publicCommerceReadiness,
  resolveCommerceReadiness,
  validateCanonicalCommerceEvent,
  validateCommerceAdapter,
} from '../src/lib/commerce-provider.js';

function adapter(overrides = {}) {
  return {
    provider: 'replacement-provider',
    version: '1.0.0',
    capabilities: [...REQUIRED_COMMERCE_CAPABILITIES],
    async createCheckout() {},
    async verifyWebhookSignature() {},
    normalizeEvent(value) { return value; },
    assessConfiguration(_environment, mode) {
      return {
        ready: true,
        reason: mode === COMMERCE_MODES.LIVE
          ? 'Replacement provider is approved and configured for Live checkout.'
          : 'Replacement provider configuration is ready for controlled verification.',
      };
    },
    ...overrides,
  };
}

function disclosureEnvironment(overrides = {}) {
  return {
    COMMERCE_TRADER_ADDRESS_PUBLIC: 'Verified public trader address, Romania',
    COMMERCE_TAX_STATUS_PUBLIC: 'Verified seller tax / VAT status for customer disclosure.',
    COMMERCE_MERCHANT_OF_RECORD_NAME: 'Replacement Provider',
    COMMERCE_MERCHANT_OF_RECORD_TERMS_URL: 'https://provider.example/buyer-terms',
    COMMERCE_MERCHANT_OF_RECORD_PRIVACY_URL: 'https://provider.example/privacy',
    COMMERCE_TAX_CHECKOUT_PUBLIC: 'Applicable taxes and supported currency conversion are shown before payment.',
    COMMERCE_REFUND_SUPPORT_PUBLIC: 'USD Impact handles product access support; the Merchant of Record handles payment processing under the linked buyer terms.',
    COMMERCE_SELLER_DISCLOSURE_APPROVED: 'true',
    ...overrides,
  };
}

{
  const disclosure = resolveCommercePublicDisclosure(disclosureEnvironment());
  assert.equal(disclosure.ready, true);
  assert.equal(disclosure.approved, true);
  assert.equal(disclosure.publicDisclosure.legalName, 'SC Kela Leads SRL');
  assert.equal(disclosure.publicDisclosure.merchantOfRecord, 'Replacement Provider');
  assert.equal(disclosure.publicDisclosure.buyerTermsUrl, 'https://provider.example/buyer-terms');
}

{
  const partial = resolveCommercePublicDisclosure({
    COMMERCE_TRADER_ADDRESS_PUBLIC: 'Partial data must not leak',
  });
  assert.equal(partial.ready, false);
  assert.equal(partial.publicDisclosure, null);
  assert.ok(partial.reasons.length >= 1);
}

{
  const invalidUrl = resolveCommercePublicDisclosure(disclosureEnvironment({
    COMMERCE_MERCHANT_OF_RECORD_TERMS_URL: 'http://provider.example/terms',
  }));
  assert.equal(invalidUrl.ready, false);
  assert.equal(invalidUrl.publicDisclosure, null);
  assert.ok(invalidUrl.reasons.some((reason) => /HTTPS URL/i.test(reason)));
}

{
  const readiness = resolveCommerceReadiness({});
  assert.equal(readiness.state, COMMERCE_READINESS_STATES.READY_FOR_PROVIDER_CONFIGURATION);
  assert.equal(readiness.mode, COMMERCE_MODES.DISABLED);
  assert.equal(readiness.provider, null);
  assert.equal(readiness.checkoutEnabled, false);
  assert.equal(readiness.controlledLiveTestEnabled, false);
  assert.equal(readiness.sandboxVerified, false);
  assert.equal(readiness.controlledLiveTestVerified, false);
  assert.equal(readiness.liveApproved, false);
  assert.equal(readiness.disclosuresComplete, false);
  assert.equal(readiness.sellerDisclosure, null);

  const publicState = publicCommerceReadiness(readiness);
  assert.equal(publicState.state, COMMERCE_READINESS_STATES.READY_FOR_PROVIDER_CONFIGURATION);
  assert.equal(publicState.checkoutEnabled, false);
  assert.equal(publicState.provider, null);
  assert.equal(publicState.disclosuresComplete, false);
  assert.equal(publicState.sellerDisclosure, null);
  assert.equal('liveApproved' in publicState, false);
  assert.equal('legacyPaddleConfigurationIgnored' in publicState, false);
}

{
  const readiness = resolveCommerceReadiness({
    COMMERCE_MODE: 'disabled',
    VERCEL_ENV: 'preview',
    ...disclosureEnvironment(),
  });
  assert.equal(readiness.state, COMMERCE_READINESS_STATES.READY_FOR_PROVIDER_CONFIGURATION);
  assert.equal(readiness.checkoutEnabled, false);
  assert.equal(readiness.provider, null);
  assert.equal(readiness.disclosuresComplete, true);
  assert.equal(readiness.sellerDisclosure.merchantOfRecord, 'Replacement Provider');

  const publicState = publicCommerceReadiness(readiness);
  assert.equal(publicState.state, COMMERCE_READINESS_STATES.READY_FOR_PROVIDER_CONFIGURATION);
  assert.equal(publicState.checkoutEnabled, false);
  assert.equal(publicState.provider, null);
  assert.equal(publicState.providerConfigured, false);
  assert.equal(publicState.disclosuresComplete, true);
  assert.equal(publicState.sellerDisclosure.legalName, 'SC Kela Leads SRL');
  assert.equal(publicState.sellerDisclosure.geographicAddress, 'Verified public trader address, Romania');
}

{
  const readiness = resolveCommerceReadiness({
    PADDLE_API_KEY: 'legacy-secret-that-must-not-be-used',
    PADDLE_WEBHOOK_SECRET: 'legacy-webhook-secret',
  });
  assert.equal(readiness.state, COMMERCE_READINESS_STATES.READY_FOR_PROVIDER_CONFIGURATION);
  assert.equal(readiness.legacyPaddleConfigurationIgnored, true);
  assert.doesNotMatch(JSON.stringify(readiness), /legacy-secret|legacy-webhook/i);
  assert.doesNotMatch(JSON.stringify(publicCommerceReadiness(readiness)), /paddle|legacy/i);
}

{
  const readiness = resolveCommerceReadiness({
    COMMERCE_MODE: 'live',
    COMMERCE_PROVIDER: 'replacement-provider',
    COMMERCE_SANDBOX_VERIFIED: 'true',
    COMMERCE_CONTROLLED_LIVE_VERIFIED: 'true',
    COMMERCE_LIVE_APPROVED: 'true',
    VERCEL_ENV: 'production',
    ...disclosureEnvironment(),
  });
  assert.equal(readiness.state, COMMERCE_READINESS_STATES.BLOCKED);
  assert.match(readiness.reason, /no registered application adapter/i);
  assert.equal(readiness.checkoutEnabled, false);
  const publicState = publicCommerceReadiness(readiness);
  assert.equal(publicState.message, 'Commerce configuration is not ready. Public checkout remains disabled.');
  assert.equal(publicState.provider, null);
  assert.equal(publicState.sellerDisclosure, null);
}

{
  const registry = createCommerceAdapterRegistry([adapter()]);
  const sandbox = resolveCommerceReadiness({
    COMMERCE_MODE: 'sandbox',
    COMMERCE_PROVIDER: 'replacement-provider',
    VERCEL_ENV: 'preview',
  }, registry);
  assert.equal(sandbox.state, COMMERCE_READINESS_STATES.READY_FOR_SANDBOX);
  assert.equal(sandbox.adapterVersion, '1.0.0');
  assert.equal(sandbox.checkoutEnabled, false);
  assert.equal(sandbox.disclosuresComplete, false);

  const liveTest = resolveCommerceReadiness({
    COMMERCE_MODE: 'live-test',
    COMMERCE_PROVIDER: 'replacement-provider',
    COMMERCE_SANDBOX_VERIFIED: 'true',
    VERCEL_ENV: 'preview',
    ...disclosureEnvironment(),
  }, registry);
  assert.equal(liveTest.state, COMMERCE_READINESS_STATES.READY_FOR_CONTROLLED_LIVE_TEST);
  assert.equal(liveTest.controlledLiveTestEnabled, true);
  assert.equal(liveTest.checkoutEnabled, false);
  assert.equal(liveTest.disclosuresComplete, true);
  assert.equal(liveTest.sellerDisclosure.merchantOfRecord, 'Replacement Provider');
  const publicLiveTest = publicCommerceReadiness(liveTest);
  assert.equal(publicLiveTest.disclosuresComplete, true);
  assert.equal(publicLiveTest.sellerDisclosure.legalName, 'SC Kela Leads SRL');

  const live = resolveCommerceReadiness({
    COMMERCE_MODE: 'live',
    COMMERCE_PROVIDER: 'replacement-provider',
    COMMERCE_SANDBOX_VERIFIED: 'true',
    COMMERCE_CONTROLLED_LIVE_VERIFIED: 'true',
    COMMERCE_LIVE_APPROVED: 'true',
    VERCEL_ENV: 'production',
    ...disclosureEnvironment(),
  }, registry);
  assert.equal(live.state, COMMERCE_READINESS_STATES.ACTIVE);
  assert.equal(live.checkoutEnabled, true);
  assert.equal(live.disclosuresComplete, true);
  const publicLive = publicCommerceReadiness(live);
  assert.equal(publicLive.provider, 'replacement-provider');
  assert.equal(publicLive.adapterVersion, '1.0.0');
  assert.equal(publicLive.checkoutEnabled, true);
  assert.equal(publicLive.disclosuresComplete, true);
  assert.equal(publicLive.sellerDisclosure.geographicAddress, 'Verified public trader address, Romania');
  assert.equal(publicLive.sellerDisclosure.buyerTermsUrl, 'https://provider.example/buyer-terms');
}

{
  const blocked = resolveCommerceReadiness({
    COMMERCE_MODE: 'live',
    COMMERCE_PROVIDER: 'replacement-provider',
    COMMERCE_SANDBOX_VERIFIED: 'true',
    COMMERCE_CONTROLLED_LIVE_VERIFIED: 'true',
    COMMERCE_LIVE_APPROVED: 'true',
    VERCEL_ENV: 'production',
  }, [adapter()]);
  assert.equal(blocked.state, COMMERCE_READINESS_STATES.BLOCKED);
  assert.match(blocked.reason, /buyer-facing seller disclosures/i);
  assert.equal(blocked.checkoutEnabled, false);
  assert.equal(blocked.disclosuresComplete, false);
  const publicBlocked = publicCommerceReadiness(blocked);
  assert.equal(publicBlocked.disclosuresComplete, false);
  assert.equal(publicBlocked.sellerDisclosure, null);
  assert.doesNotMatch(JSON.stringify(publicBlocked), /COMMERCE_TRADER_ADDRESS_PUBLIC|COMMERCE_TAX_STATUS_PUBLIC/);
}

{
  const blocked = resolveCommerceReadiness({
    COMMERCE_MODE: 'live',
    COMMERCE_PROVIDER: 'replacement-provider',
    COMMERCE_SANDBOX_VERIFIED: 'true',
    COMMERCE_CONTROLLED_LIVE_VERIFIED: 'true',
    COMMERCE_LIVE_APPROVED: 'true',
    VERCEL_ENV: 'production',
    ...disclosureEnvironment({ COMMERCE_MERCHANT_OF_RECORD_TERMS_URL: 'javascript:alert(1)' }),
  }, [adapter()]);
  assert.equal(blocked.state, COMMERCE_READINESS_STATES.BLOCKED);
  assert.match(blocked.reason, /buyer-facing seller disclosures/i);
  assert.equal(publicCommerceReadiness(blocked).sellerDisclosure, null);
}

{
  const blocked = resolveCommerceReadiness({
    COMMERCE_MODE: 'live',
    COMMERCE_PROVIDER: 'replacement-provider',
    COMMERCE_SANDBOX_VERIFIED: 'true',
    COMMERCE_CONTROLLED_LIVE_VERIFIED: 'true',
    VERCEL_ENV: 'production',
    ...disclosureEnvironment(),
  }, [adapter()]);
  assert.equal(blocked.state, COMMERCE_READINESS_STATES.BLOCKED);
  assert.match(blocked.reason, /explicit Live approval/i);
}

{
  const blocked = resolveCommerceReadiness({
    COMMERCE_MODE: 'live',
    COMMERCE_PROVIDER: 'replacement-provider',
    COMMERCE_SANDBOX_VERIFIED: 'true',
    COMMERCE_CONTROLLED_LIVE_VERIFIED: 'true',
    COMMERCE_LIVE_APPROVED: 'true',
    VERCEL_ENV: 'preview',
    ...disclosureEnvironment(),
  }, [adapter()]);
  assert.equal(blocked.state, COMMERCE_READINESS_STATES.BLOCKED);
  assert.match(blocked.reason, /Production environment/i);
}

{
  const blocked = resolveCommerceReadiness({
    COMMERCE_MODE: 'live-test',
    COMMERCE_PROVIDER: 'replacement-provider',
    VERCEL_ENV: 'preview',
    ...disclosureEnvironment(),
  }, [adapter()]);
  assert.equal(blocked.state, COMMERCE_READINESS_STATES.BLOCKED);
  assert.match(blocked.reason, /sandbox verification/i);
}

{
  const blocked = resolveCommerceReadiness({
    COMMERCE_MODE: 'disabled',
    COMMERCE_PROVIDER: 'replacement-provider',
  }, [adapter()]);
  assert.equal(blocked.state, COMMERCE_READINESS_STATES.BLOCKED);
  assert.equal(blocked.checkoutEnabled, false);
}

{
  const unavailable = resolveCommerceReadiness({
    COMMERCE_MODE: 'sandbox',
    COMMERCE_PROVIDER: 'replacement-provider',
    VERCEL_ENV: 'preview',
  }, [adapter({
    assessConfiguration() {
      return { ready: false, reason: 'Provider credentials are incomplete.' };
    },
  })]);
  assert.equal(unavailable.state, COMMERCE_READINESS_STATES.BLOCKED);
  assert.equal(unavailable.reason, 'Provider credentials are incomplete.');
  assert.equal(publicCommerceReadiness(unavailable).message, 'Commerce configuration is not ready. Public checkout remains disabled.');
}

assert.throws(() => resolveCommerceReadiness({ COMMERCE_LIVE_APPROVED: 'yes' }), /true\/false/);
assert.throws(() => validateCommerceAdapter({}), TypeError);
assert.throws(() => createCommerceAdapterRegistry([adapter(), adapter()]), /Duplicate commerce adapter/);
assert.throws(
  () => validateCommerceAdapter(adapter({ capabilities: ['checkout.create'] })),
  /missing/i,
);
assert.throws(
  () => validateCommerceAdapter(adapter({ verifyWebhookSignature: null })),
  /verifyWebhookSignature/,
);

{
  const event = validateCanonicalCommerceEvent({
    provider: 'replacement-provider',
    providerEventId: 'event_123',
    eventType: CANONICAL_COMMERCE_EVENT_TYPES.PAYMENT_COMPLETED,
    occurredAt: '2026-08-20T00:00:00.000Z',
    transactionId: 'transaction_123',
    customerId: 'customer_123',
    checkoutId: 'checkout_123',
    accountId: '123e4567-e89b-42d3-a456-426614174000',
    purchaseIntentId: '223e4567-e89b-42d3-a456-426614174000',
    amountCents: 4_900,
    currency: 'usd',
    metadata: { source: 'verified-webhook' },
  });
  assert.equal(event.currency, 'USD');
  assert.equal(event.amountCents, 4_900);
  assert.equal(event.productId, 'read-the-dollar-first-guided-interactive-edition');
  assert.equal(Object.isFrozen(event), true);
}

assert.throws(() => validateCanonicalCommerceEvent({
  provider: 'replacement-provider',
  providerEventId: 'event_124',
  eventType: CANONICAL_COMMERCE_EVENT_TYPES.PAYMENT_COMPLETED,
  occurredAt: '2026-08-20T00:00:00.000Z',
  transactionId: 'transaction_124',
  accountId: '123e4567-e89b-42d3-a456-426614174000',
  amountCents: 4_900,
  currency: 'USD',
}), /purchase intent/i);

assert.throws(() => validateCanonicalCommerceEvent({
  provider: 'replacement-provider',
  providerEventId: 'event_125',
  eventType: CANONICAL_COMMERCE_EVENT_TYPES.PAYMENT_COMPLETED,
  occurredAt: '2026-08-20T00:00:00.000Z',
  transactionId: 'transaction_125',
  accountId: '123e4567-e89b-42d3-a456-426614174000',
  purchaseIntentId: '223e4567-e89b-42d3-a456-426614174000',
  productId: 'different-product',
  amountCents: 4_900,
  currency: 'USD',
}), /active USD Impact paid product/i);

assert.throws(() => validateCanonicalCommerceEvent({
  provider: 'replacement-provider',
  providerEventId: 'event_126',
  eventType: 'provider-specific.unknown',
  occurredAt: '2026-08-20T00:00:00.000Z',
}), /canonical commerce contract/i);

console.log('Provider-neutral commerce contract tests passed.');
