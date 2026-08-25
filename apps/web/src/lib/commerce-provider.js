import { PAID_PRODUCT_ID } from './paid-access.js';
import { resolveCommercePublicDisclosure } from './commerce-public-disclosure.js';

export const COMMERCE_CONTRACT_VERSION = 2;

export const COMMERCE_MODES = Object.freeze({
  DISABLED: 'disabled',
  SANDBOX: 'sandbox',
  LIVE_TEST: 'live-test',
  LIVE: 'live',
});

export const COMMERCE_READINESS_STATES = Object.freeze({
  READY_FOR_PROVIDER_CONFIGURATION: 'ready_for_provider_configuration',
  READY_FOR_SANDBOX: 'ready_for_sandbox',
  READY_FOR_CONTROLLED_LIVE_TEST: 'ready_for_controlled_live_test',
  ACTIVE: 'active',
  BLOCKED: 'blocked',
});

export const CANONICAL_COMMERCE_EVENT_TYPES = Object.freeze({
  CHECKOUT_PENDING: 'checkout.pending',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_CANCELLED: 'payment.cancelled',
  PAYMENT_EXPIRED: 'payment.expired',
  REFUND_COMPLETED: 'refund.completed',
  DISPUTE_OPENED: 'dispute.opened',
  CHARGEBACK_COMPLETED: 'chargeback.completed',
  DISPUTE_REVERSED: 'dispute.reversed',
});

export const REQUIRED_COMMERCE_CAPABILITIES = Object.freeze([
  'checkout.create',
  'webhook.verify-raw-body',
  'event.normalize',
  'payment.complete',
  'refund.complete',
  'dispute.open',
  'chargeback.complete',
  'dispute.reverse',
]);

const PROVIDER_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,254}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const EVENT_TYPES = new Set(Object.values(CANONICAL_COMMERCE_EVENT_TYPES));
const MODES = new Set(Object.values(COMMERCE_MODES));
const PUBLIC_READINESS_MESSAGES = Object.freeze({
  [COMMERCE_READINESS_STATES.READY_FOR_PROVIDER_CONFIGURATION]:
    'The commerce foundation is ready for an approved provider adapter. Public checkout remains disabled.',
  [COMMERCE_READINESS_STATES.READY_FOR_SANDBOX]:
    'The selected provider adapter is ready for controlled sandbox verification. Public checkout remains disabled.',
  [COMMERCE_READINESS_STATES.READY_FOR_CONTROLLED_LIVE_TEST]:
    'The selected provider adapter and buyer disclosures are ready for a separately approved controlled Live test. Public checkout remains disabled.',
  [COMMERCE_READINESS_STATES.ACTIVE]:
    'Secure checkout is active through the approved provider with buyer-facing seller disclosures verified. Access still requires verified payment confirmation.',
  [COMMERCE_READINESS_STATES.BLOCKED]:
    'Commerce configuration is not ready. Public checkout remains disabled.',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeProvider(value) {
  const provider = normalizedString(value).toLowerCase();
  return provider || null;
}

function normalizeBoolean(value) {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0' || value == null || value === '') return false;
  throw new TypeError('Boolean commerce configuration must use true/false or 1/0.');
}

function requireIdentifier(value, fieldName) {
  const normalized = normalizedString(value);
  if (!IDENTIFIER_PATTERN.test(normalized)) {
    throw new TypeError(`${fieldName} must be a stable identifier.`);
  }
  return normalized;
}

function requireTimestamp(value, fieldName) {
  const normalized = normalizedString(value);
  const parsed = Date.parse(normalized);
  if (!normalized || !Number.isFinite(parsed)) {
    throw new TypeError(`${fieldName} must be an ISO-8601 timestamp.`);
  }
  return new Date(parsed).toISOString();
}

function requireInteger(value, fieldName, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${fieldName} must be an integer greater than or equal to ${minimum}.`);
  }
  return value;
}

function normalizeMetadata(value) {
  if (value == null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('metadata must be an object.');
  }
  return structuredClone(value);
}

function capabilitySet(value) {
  if (!Array.isArray(value)) throw new TypeError('adapter.capabilities must be an array.');
  const normalized = value.map((item) => normalizedString(item));
  if (normalized.some((item) => !item)) throw new TypeError('adapter.capabilities contains an invalid value.');
  return new Set(normalized);
}

export function validateCommerceAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object' || Array.isArray(adapter)) {
    throw new TypeError('A commerce adapter object is required.');
  }

  const provider = normalizeProvider(adapter.provider);
  if (!provider || !PROVIDER_PATTERN.test(provider)) {
    throw new TypeError('adapter.provider must be a lowercase stable provider identifier.');
  }

  const version = normalizedString(adapter.version);
  if (!VERSION_PATTERN.test(version)) {
    throw new TypeError('adapter.version must use semantic versioning.');
  }

  const capabilities = capabilitySet(adapter.capabilities);
  const missingCapabilities = REQUIRED_COMMERCE_CAPABILITIES.filter((item) => !capabilities.has(item));
  if (missingCapabilities.length > 0) {
    throw new TypeError(`adapter.capabilities is missing: ${missingCapabilities.join(', ')}.`);
  }

  for (const method of ['createCheckout', 'verifyWebhookSignature', 'normalizeEvent', 'assessConfiguration']) {
    if (typeof adapter[method] !== 'function') {
      throw new TypeError(`adapter.${method} must be a function.`);
    }
  }

  return Object.freeze({
    provider,
    version,
    capabilities: Object.freeze([...capabilities].sort()),
    createCheckout: adapter.createCheckout,
    verifyWebhookSignature: adapter.verifyWebhookSignature,
    normalizeEvent: adapter.normalizeEvent,
    assessConfiguration: adapter.assessConfiguration,
  });
}

export function createCommerceAdapterRegistry(adapters = []) {
  if (!Array.isArray(adapters)) throw new TypeError('adapters must be an array.');
  const registry = new Map();
  for (const candidate of adapters) {
    const adapter = validateCommerceAdapter(candidate);
    if (registry.has(adapter.provider)) {
      throw new TypeError(`Duplicate commerce adapter: ${adapter.provider}.`);
    }
    registry.set(adapter.provider, adapter);
  }
  return registry;
}

export function resolveCommerceReadiness(environment = {}, adapters = []) {
  const mode = normalizedString(environment.COMMERCE_MODE || COMMERCE_MODES.DISABLED).toLowerCase();
  const provider = normalizeProvider(environment.COMMERCE_PROVIDER);
  const sandboxVerified = normalizeBoolean(environment.COMMERCE_SANDBOX_VERIFIED);
  const controlledLiveTestVerified = normalizeBoolean(environment.COMMERCE_CONTROLLED_LIVE_VERIFIED);
  const liveApproved = normalizeBoolean(environment.COMMERCE_LIVE_APPROVED);
  const vercelEnvironment = normalizedString(environment.VERCEL_ENV).toLowerCase() || null;
  const publicDisclosure = resolveCommercePublicDisclosure(environment);
  const legacyPaddleConfigurationIgnored = Object.entries(environment).some(
    ([key, value]) => key.startsWith('PADDLE_') && normalizedString(String(value ?? '')) !== '',
  );

  const registry = adapters instanceof Map ? adapters : createCommerceAdapterRegistry(adapters);
  const reasons = [];

  if (!MODES.has(mode)) reasons.push('COMMERCE_MODE is invalid.');
  if (provider && !PROVIDER_PATTERN.test(provider)) reasons.push('COMMERCE_PROVIDER is invalid.');
  if (mode === COMMERCE_MODES.DISABLED && (
    provider || sandboxVerified || controlledLiveTestVerified || liveApproved
  )) {
    reasons.push('Disabled commerce must not declare a provider or approval evidence.');
  }
  if (mode !== COMMERCE_MODES.DISABLED && !provider) {
    reasons.push('An enabled commerce mode requires a provider.');
  }
  if (provider && !registry.has(provider)) {
    reasons.push('The configured provider has no registered application adapter.');
  }
  if (mode === COMMERCE_MODES.LIVE_TEST && !sandboxVerified) {
    reasons.push('A controlled Live test requires completed sandbox verification.');
  }
  if (mode === COMMERCE_MODES.LIVE_TEST && !publicDisclosure.ready) {
    reasons.push('Controlled Live testing requires complete, explicitly approved buyer-facing seller disclosures.');
  }
  if (mode === COMMERCE_MODES.LIVE) {
    if (!sandboxVerified) reasons.push('Live checkout requires completed sandbox verification.');
    if (!controlledLiveTestVerified) reasons.push('Live checkout requires completed controlled Live verification.');
    if (!liveApproved) reasons.push('Live checkout requires explicit Live approval.');
    if (vercelEnvironment !== 'production') reasons.push('Live checkout is permitted only in the Production environment.');
    if (!publicDisclosure.ready) reasons.push('Live checkout requires complete, explicitly approved buyer-facing seller disclosures.');
  }
  if (
    (mode === COMMERCE_MODES.SANDBOX || mode === COMMERCE_MODES.LIVE_TEST)
    && vercelEnvironment === 'production'
  ) {
    reasons.push('Sandbox and controlled Live-test modes must run outside Production.');
  }
  if (mode !== COMMERCE_MODES.LIVE && liveApproved) {
    reasons.push('Live approval is only valid in Live mode.');
  }
  if (mode !== COMMERCE_MODES.LIVE && controlledLiveTestVerified) {
    reasons.push('Controlled Live verification is only valid when preparing Live mode.');
  }

  let state = COMMERCE_READINESS_STATES.BLOCKED;
  let reason = reasons.join(' ');
  let adapterVersion = null;
  let configuration = null;

  if (reasons.length === 0 && mode === COMMERCE_MODES.DISABLED) {
    state = COMMERCE_READINESS_STATES.READY_FOR_PROVIDER_CONFIGURATION;
    reason = PUBLIC_READINESS_MESSAGES[state];
  } else if (reasons.length === 0) {
    const adapter = registry.get(provider);
    adapterVersion = adapter.version;
    const assessment = adapter.assessConfiguration(environment, mode);
    if (!assessment || typeof assessment !== 'object' || Array.isArray(assessment)) {
      throw new TypeError('adapter.assessConfiguration must return an object.');
    }
    configuration = {
      ready: assessment.ready === true,
      reason: normalizedString(assessment.reason) || 'Provider configuration was not confirmed.',
    };

    if (!configuration.ready) {
      reason = configuration.reason;
    } else if (mode === COMMERCE_MODES.SANDBOX) {
      state = COMMERCE_READINESS_STATES.READY_FOR_SANDBOX;
      reason = configuration.reason;
    } else if (mode === COMMERCE_MODES.LIVE_TEST) {
      state = COMMERCE_READINESS_STATES.READY_FOR_CONTROLLED_LIVE_TEST;
      reason = configuration.reason;
    } else if (mode === COMMERCE_MODES.LIVE) {
      state = COMMERCE_READINESS_STATES.ACTIVE;
      reason = configuration.reason;
    }
  }

  return deepFreeze({
    contractVersion: COMMERCE_CONTRACT_VERSION,
    productId: PAID_PRODUCT_ID,
    state,
    reason,
    mode: MODES.has(mode) ? mode : null,
    provider,
    providerConfigured: Boolean(provider),
    adapterVersion,
    sandboxVerified,
    controlledLiveTestVerified,
    liveApproved,
    vercelEnvironment,
    checkoutEnabled: state === COMMERCE_READINESS_STATES.ACTIVE,
    controlledLiveTestEnabled: state === COMMERCE_READINESS_STATES.READY_FOR_CONTROLLED_LIVE_TEST,
    disclosuresComplete: publicDisclosure.ready,
    sellerDisclosure: publicDisclosure.publicDisclosure,
    legacyPaddleConfigurationIgnored,
    configuration,
  });
}

export function publicCommerceReadiness(readiness) {
  if (!readiness || typeof readiness !== 'object' || Array.isArray(readiness)) {
    throw new TypeError('A resolved commerce readiness object is required.');
  }
  const state = Object.values(COMMERCE_READINESS_STATES).includes(readiness.state)
    ? readiness.state
    : COMMERCE_READINESS_STATES.BLOCKED;
  const discloseProvider = state !== COMMERCE_READINESS_STATES.BLOCKED && readiness.providerConfigured === true;
  const discloseSeller = (
    (state === COMMERCE_READINESS_STATES.READY_FOR_CONTROLLED_LIVE_TEST || state === COMMERCE_READINESS_STATES.ACTIVE)
    && readiness.disclosuresComplete === true
    && readiness.sellerDisclosure
  );

  return deepFreeze({
    contractVersion: readiness.contractVersion === COMMERCE_CONTRACT_VERSION
      ? COMMERCE_CONTRACT_VERSION
      : null,
    productId: readiness.productId === PAID_PRODUCT_ID ? PAID_PRODUCT_ID : null,
    state,
    message: PUBLIC_READINESS_MESSAGES[state],
    mode: MODES.has(readiness.mode) ? readiness.mode : null,
    provider: discloseProvider ? readiness.provider : null,
    providerConfigured: discloseProvider,
    adapterVersion: discloseProvider ? readiness.adapterVersion : null,
    disclosuresComplete: discloseSeller === true || Boolean(discloseSeller),
    sellerDisclosure: discloseSeller ? readiness.sellerDisclosure : null,
    checkoutEnabled: state === COMMERCE_READINESS_STATES.ACTIVE && readiness.checkoutEnabled === true,
  });
}

export function validateCanonicalCommerceEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new TypeError('A canonical commerce event object is required.');
  }

  const provider = normalizeProvider(event.provider);
  if (!provider || !PROVIDER_PATTERN.test(provider)) {
    throw new TypeError('event.provider is invalid.');
  }

  const eventType = normalizedString(event.eventType);
  if (!EVENT_TYPES.has(eventType)) {
    throw new TypeError('event.eventType is not part of the canonical commerce contract.');
  }

  const transactionRequired = eventType !== CANONICAL_COMMERCE_EVENT_TYPES.CHECKOUT_PENDING;
  const completion = eventType === CANONICAL_COMMERCE_EVENT_TYPES.PAYMENT_COMPLETED;
  const transactionId = event.transactionId == null
    ? null
    : requireIdentifier(event.transactionId, 'event.transactionId');

  if (transactionRequired && !transactionId) {
    throw new TypeError('event.transactionId is required for this event type.');
  }

  const accountId = event.accountId == null ? null : requireIdentifier(event.accountId, 'event.accountId');
  const purchaseIntentId = event.purchaseIntentId == null
    ? null
    : requireIdentifier(event.purchaseIntentId, 'event.purchaseIntentId');
  const amountCents = event.amountCents == null ? null : requireInteger(event.amountCents, 'event.amountCents', 0);
  const currency = event.currency == null ? null : normalizedString(event.currency).toUpperCase();
  const productId = event.productId == null
    ? PAID_PRODUCT_ID
    : requireIdentifier(event.productId, 'event.productId');

  if (productId !== PAID_PRODUCT_ID) {
    throw new TypeError('event.productId does not match the active USD Impact paid product.');
  }
  if (completion && (!accountId || !purchaseIntentId || amountCents == null || amountCents <= 0 || !currency)) {
    throw new TypeError('Completed payments require account, purchase intent, positive amount, and currency.');
  }
  if (currency && !CURRENCY_PATTERN.test(currency)) {
    throw new TypeError('event.currency must be a three-letter uppercase ISO currency code.');
  }

  return deepFreeze({
    contractVersion: COMMERCE_CONTRACT_VERSION,
    provider,
    providerEventId: requireIdentifier(event.providerEventId, 'event.providerEventId'),
    eventType,
    occurredAt: requireTimestamp(event.occurredAt, 'event.occurredAt'),
    transactionId,
    customerId: event.customerId == null ? null : requireIdentifier(event.customerId, 'event.customerId'),
    checkoutId: event.checkoutId == null ? null : requireIdentifier(event.checkoutId, 'event.checkoutId'),
    accountId,
    purchaseIntentId,
    productId,
    priceId: event.priceId == null ? null : requireIdentifier(event.priceId, 'event.priceId'),
    amountCents,
    currency,
    metadata: normalizeMetadata(event.metadata),
  });
}
