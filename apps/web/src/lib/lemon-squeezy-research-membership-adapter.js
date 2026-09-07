import { createHash } from 'node:crypto';
import { verifyLemonSqueezyWebhookSignature } from './lemon-squeezy-adapter-scaffold.js';
import { buildResearchMembershipMutationPlan } from './research-membership-event-adapter.js';
import {
  RESEARCH_MEMBERSHIP_EVENT_TYPES,
  RESEARCH_MEMBERSHIP_PRODUCT_ID,
} from './research-membership-runtime.js';

export const LEMON_SQUEEZY_RESEARCH_PROVIDER = 'lemon-squeezy';

export const LEMON_SQUEEZY_RESEARCH_EVENTS = Object.freeze([
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_resumed',
  'subscription_expired',
  'subscription_payment_failed',
  'subscription_payment_success',
  'subscription_payment_recovered',
]);

const STABLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,254}$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function object(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${fieldName} must be an object.`);
  }
  return value;
}

function stableIdentifier(value, fieldName) {
  const normalized = text(String(value ?? ''));
  if (!STABLE_ID_PATTERN.test(normalized)) {
    throw new TypeError(`${fieldName} must be a stable identifier.`);
  }
  return normalized;
}

function positiveInteger(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new TypeError(`${fieldName} must be a positive integer.`);
  }
  return parsed;
}

function isoTimestamp(value, fieldName) {
  const normalized = text(value);
  if (!normalized || Number.isNaN(Date.parse(normalized))) {
    throw new TypeError(`${fieldName} must be an ISO timestamp.`);
  }
  return new Date(normalized).toISOString();
}

function optionalIsoTimestamp(value, fieldName) {
  return value == null ? null : isoTimestamp(value, fieldName);
}

function exactRawBody(rawBody) {
  if (Buffer.isBuffer(rawBody)) return rawBody;
  if (typeof rawBody === 'string') return Buffer.from(rawBody, 'utf8');
  throw new TypeError('rawBody must be the exact Lemon Squeezy webhook body.');
}

function parseSignedPayload({ rawBody, signature, secret }) {
  const body = exactRawBody(rawBody);
  if (!verifyLemonSqueezyWebhookSignature({ rawBody: body, signature, secret })) {
    const error = new Error('Invalid Lemon Squeezy webhook signature.');
    error.code = 'LEMON_SQUEEZY_RESEARCH_SIGNATURE_INVALID';
    throw error;
  }
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    throw new TypeError('Lemon Squeezy webhook body must contain valid JSON.');
  }
}

function requireExistingSubscription(value) {
  const subscription = object(value, 'existingSubscription');
  if (subscription.productId !== RESEARCH_MEMBERSHIP_PRODUCT_ID) {
    throw new Error('Existing subscription product mismatch.');
  }
  if (subscription.provider !== LEMON_SQUEEZY_RESEARCH_PROVIDER) {
    throw new Error('Existing subscription provider mismatch.');
  }
  return subscription;
}

function validateEnvironment(attributes, {
  expectedStoreId,
  expectedProductId,
  expectedVariantIds,
  expectedTestMode,
  subscriptionObject,
}) {
  if (String(attributes.store_id) !== String(positiveInteger(expectedStoreId, 'expectedStoreId'))) {
    throw new Error('Lemon Squeezy store mismatch.');
  }
  if (typeof expectedTestMode !== 'boolean' || attributes.test_mode !== expectedTestMode) {
    throw new Error('Lemon Squeezy Test/Live mode mismatch.');
  }
  if (!subscriptionObject) return;
  if (String(attributes.product_id) !== String(positiveInteger(expectedProductId, 'expectedProductId'))) {
    throw new Error('Lemon Squeezy Research product mismatch.');
  }
  if (!Array.isArray(expectedVariantIds) || expectedVariantIds.length === 0) {
    throw new TypeError('expectedVariantIds must contain at least one trusted recurring variant.');
  }
  const trustedVariants = new Set(expectedVariantIds.map((value) => String(positiveInteger(value, 'expectedVariantId'))));
  if (!trustedVariants.has(String(attributes.variant_id))) {
    throw new Error('Lemon Squeezy Research variant mismatch.');
  }
}

function providerEventId(eventName, data, attributes) {
  const timestamp = isoTimestamp(attributes.updated_at || attributes.created_at, 'provider event timestamp');
  return stableIdentifier(
    `${LEMON_SQUEEZY_RESEARCH_PROVIDER}:${eventName}:${data.type}:${data.id}:${timestamp}`,
    'providerEventId',
  );
}

function canonicalFromSubscription({ eventName, attributes, existingSubscription }) {
  const status = text(attributes.status).toLowerCase();
  const currentState = text(existingSubscription.state);
  const renewsAt = optionalIsoTimestamp(attributes.renews_at, 'renews_at');
  const endsAt = optionalIsoTimestamp(attributes.ends_at, 'ends_at');
  const createdAt = isoTimestamp(attributes.created_at, 'created_at');
  const existingStart = optionalIsoTimestamp(existingSubscription.currentPeriodStart, 'existing currentPeriodStart');
  const existingEnd = optionalIsoTimestamp(existingSubscription.currentPeriodEnd, 'existing currentPeriodEnd');

  if (eventName === 'subscription_cancelled') {
    if (status !== 'cancelled' || attributes.cancelled !== true || !endsAt) {
      throw new Error('Lemon Squeezy cancellation payload is inconsistent.');
    }
    return {
      eventType: RESEARCH_MEMBERSHIP_EVENT_TYPES.CANCELLATION_SCHEDULED,
      currentPeriodStart: existingStart || createdAt,
      currentPeriodEnd: endsAt,
      cancelAtPeriodEnd: true,
    };
  }

  if (eventName === 'subscription_resumed') {
    if (status !== 'active' || attributes.cancelled !== false) {
      throw new Error('Lemon Squeezy resume payload is inconsistent.');
    }
    return {
      eventType: RESEARCH_MEMBERSHIP_EVENT_TYPES.CANCELLATION_REVOKED,
      currentPeriodStart: existingStart || createdAt,
      currentPeriodEnd: renewsAt || existingEnd,
      cancelAtPeriodEnd: false,
    };
  }

  if (eventName === 'subscription_expired') {
    if (status !== 'expired') throw new Error('Lemon Squeezy expiry payload is inconsistent.');
    return {
      eventType: RESEARCH_MEMBERSHIP_EVENT_TYPES.CANCELLED,
      currentPeriodStart: existingStart || createdAt,
      currentPeriodEnd: endsAt || existingEnd,
      cancelAtPeriodEnd: false,
    };
  }

  if (!['subscription_created', 'subscription_updated'].includes(eventName)) {
    throw new TypeError('Unsupported Lemon Squeezy subscription-object event.');
  }

  if (status === 'active') {
    let eventType = RESEARCH_MEMBERSHIP_EVENT_TYPES.RENEWED;
    if (currentState === 'pending') eventType = RESEARCH_MEMBERSHIP_EVENT_TYPES.ACTIVATED;
    else if (currentState === 'past_due') eventType = RESEARCH_MEMBERSHIP_EVENT_TYPES.PAYMENT_RECOVERED;
    else if (currentState === 'cancel_scheduled') eventType = RESEARCH_MEMBERSHIP_EVENT_TYPES.CANCELLATION_REVOKED;

    return {
      eventType,
      currentPeriodStart: currentState === 'active' && existingEnd && renewsAt && Date.parse(renewsAt) > Date.parse(existingEnd)
        ? existingEnd
        : existingStart || createdAt,
      currentPeriodEnd: renewsAt || existingEnd,
      cancelAtPeriodEnd: false,
    };
  }

  if (status === 'past_due') {
    return {
      eventType: RESEARCH_MEMBERSHIP_EVENT_TYPES.PAYMENT_FAILED,
      currentPeriodStart: existingStart || createdAt,
      currentPeriodEnd: existingEnd,
      cancelAtPeriodEnd: false,
    };
  }

  if (status === 'cancelled' && attributes.cancelled === true && endsAt) {
    return {
      eventType: RESEARCH_MEMBERSHIP_EVENT_TYPES.CANCELLATION_SCHEDULED,
      currentPeriodStart: existingStart || createdAt,
      currentPeriodEnd: endsAt,
      cancelAtPeriodEnd: true,
    };
  }

  if (status === 'expired') {
    return {
      eventType: RESEARCH_MEMBERSHIP_EVENT_TYPES.CANCELLED,
      currentPeriodStart: existingStart || createdAt,
      currentPeriodEnd: endsAt || existingEnd,
      cancelAtPeriodEnd: false,
    };
  }

  throw new Error(`Unsupported Lemon Squeezy subscription status: ${status || 'missing'}.`);
}

function canonicalFromInvoice({ eventName, attributes, existingSubscription }) {
  const currentPeriodStart = optionalIsoTimestamp(existingSubscription.currentPeriodStart, 'existing currentPeriodStart');
  const currentPeriodEnd = optionalIsoTimestamp(existingSubscription.currentPeriodEnd, 'existing currentPeriodEnd');

  if (eventName === 'subscription_payment_failed') {
    return {
      action: 'apply',
      eventType: RESEARCH_MEMBERSHIP_EVENT_TYPES.PAYMENT_FAILED,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    };
  }

  if (eventName === 'subscription_payment_recovered') {
    return {
      action: 'apply',
      eventType: RESEARCH_MEMBERSHIP_EVENT_TYPES.PAYMENT_RECOVERED,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    };
  }

  if (eventName === 'subscription_payment_success') {
    if (existingSubscription.state === 'past_due') {
      return {
        action: 'apply',
        eventType: RESEARCH_MEMBERSHIP_EVENT_TYPES.PAYMENT_RECOVERED,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
      };
    }
    return {
      action: 'ignore',
      reason: 'subscription_payment_success is followed by subscription_updated, which is authoritative for the new billing period.',
    };
  }

  throw new TypeError('Unsupported Lemon Squeezy subscription-invoice event.');
}

export function inspectLemonSqueezyResearchMembershipWebhook({
  rawBody,
  signature,
  secret,
  existingSubscription,
  expectedStoreId,
  expectedProductId,
  expectedVariantIds,
  expectedTestMode = true,
} = {}) {
  const subscription = requireExistingSubscription(existingSubscription);
  const payload = parseSignedPayload({ rawBody, signature, secret });
  const meta = object(payload.meta, 'payload.meta');
  const data = object(payload.data, 'payload.data');
  const attributes = object(data.attributes, 'payload.data.attributes');
  const eventName = text(meta.event_name);

  if (!LEMON_SQUEEZY_RESEARCH_EVENTS.includes(eventName)) {
    throw new TypeError('Lemon Squeezy event is not approved for Research Membership recurring lifecycle processing.');
  }

  const isSubscriptionObject = data.type === 'subscriptions';
  const isInvoiceObject = data.type === 'subscription-invoices';
  if (!isSubscriptionObject && !isInvoiceObject) {
    throw new TypeError('Lemon Squeezy Research recurring webhook has an unsupported data type.');
  }

  validateEnvironment(attributes, {
    expectedStoreId,
    expectedProductId,
    expectedVariantIds,
    expectedTestMode,
    subscriptionObject: isSubscriptionObject,
  });

  const providerSubscriptionId = isSubscriptionObject
    ? stableIdentifier(data.id, 'subscription id')
    : stableIdentifier(attributes.subscription_id, 'subscription_id');
  if (providerSubscriptionId !== subscription.providerSubscriptionId) {
    throw new Error('Lemon Squeezy subscription binding mismatch.');
  }

  const customData = meta.custom_data == null ? null : object(meta.custom_data, 'payload.meta.custom_data');
  if (customData?.usd_impact_account_id != null
      && stableIdentifier(customData.usd_impact_account_id, 'custom account id') !== subscription.accountId) {
    throw new Error('Lemon Squeezy account binding mismatch.');
  }

  // Validate the event/object pairing and payload before a duplicate lookup.
  // These helpers do not authorize a state transition or perform any writes.
  if (isSubscriptionObject) canonicalFromSubscription({ eventName, attributes, existingSubscription: subscription });
  else canonicalFromInvoice({ eventName, attributes, existingSubscription: subscription });

  const metadata = {
    lemonEventName: eventName,
    lemonDataType: data.type,
    lemonDataId: stableIdentifier(data.id, 'data id'),
    lemonStatus: text(attributes.status) || null,
    lemonBillingReason: text(attributes.billing_reason) || null,
    testMode: attributes.test_mode,
  };
  const identity = {
    provider: LEMON_SQUEEZY_RESEARCH_PROVIDER,
    providerEventId: providerEventId(eventName, data, attributes),
    providerSubscriptionId,
    occurredAt: isoTimestamp(attributes.updated_at || attributes.created_at, 'occurredAt'),
  };
  // Preserve only a digest of the binding and transition-driving signed fields.
  // Formatting and expiring delivery URLs are deliberately not event identity.
  const replayFingerprint = createHash('sha256').update(JSON.stringify({
    version: 1,
    ...identity,
    ...metadata,
    accountId: subscription.accountId,
    storeId: String(attributes.store_id),
    productId: isSubscriptionObject ? String(attributes.product_id) : null,
    variantId: isSubscriptionObject ? String(attributes.variant_id) : null,
    createdAt: isoTimestamp(attributes.created_at, 'created_at'),
    cancelled: isSubscriptionObject ? (attributes.cancelled ?? null) : null,
    renewsAt: isSubscriptionObject ? optionalIsoTimestamp(attributes.renews_at, 'renews_at') : null,
    endsAt: isSubscriptionObject ? optionalIsoTimestamp(attributes.ends_at, 'ends_at') : null,
  })).digest('hex');
  return Object.freeze({
    ...identity, eventName, data, attributes, subscription, isSubscriptionObject,
    metadata: Object.freeze({ ...metadata, replayFingerprintVersion: 1, replayFingerprint }),
  });
}

export function normalizeLemonSqueezyResearchMembershipWebhook(options = {}) {
  const inspected = inspectLemonSqueezyResearchMembershipWebhook(options);
  const { eventName, data, attributes, subscription, isSubscriptionObject, providerSubscriptionId } = inspected;
  const canonical = isSubscriptionObject
    ? { action: 'apply', ...canonicalFromSubscription({ eventName, attributes, existingSubscription: subscription }) }
    : canonicalFromInvoice({ eventName, attributes, existingSubscription: subscription });

  if (canonical.action === 'ignore') {
    return Object.freeze({
      action: 'ignore',
      provider: LEMON_SQUEEZY_RESEARCH_PROVIDER,
      providerEventId: providerEventId(eventName, data, attributes),
      providerSubscriptionId,
      reason: canonical.reason,
    });
  }

  return Object.freeze({
    action: 'apply',
    providerEvent: Object.freeze({
      provider: LEMON_SQUEEZY_RESEARCH_PROVIDER,
      providerEventId: providerEventId(eventName, data, attributes),
      providerSubscriptionId,
      eventType: canonical.eventType,
      occurredAt: isoTimestamp(attributes.updated_at || attributes.created_at, 'occurredAt'),
      currentPeriodStart: canonical.currentPeriodStart,
      currentPeriodEnd: canonical.currentPeriodEnd,
      cancelAtPeriodEnd: canonical.cancelAtPeriodEnd,
      metadata: inspected.metadata,
    }),
  });
}

export function prepareLemonSqueezyResearchMembershipTransition(options = {}) {
  const normalized = normalizeLemonSqueezyResearchMembershipWebhook(options);
  if (normalized.action === 'ignore') return normalized;
  return buildResearchMembershipMutationPlan({
    providerEvent: normalized.providerEvent,
    existingSubscription: options.existingSubscription,
    processedEventKeys: options.processedEventKeys || [],
  });
}
