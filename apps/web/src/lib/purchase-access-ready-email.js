import { normalizeEmail } from './email-readiness-contracts.js';
import {
  LaunchEmailDispatchError,
  createLaunchEmailDispatchIntent,
  createResendLaunchEmailAdapter,
  dispatchEnqueuedLaunchEmail,
  enqueueLaunchEmailIntent,
  lifecycleEmailDispatchEnabled,
} from './launch-email-dispatch.js';

export const PURCHASE_ACCESS_READY_EMAIL_MESSAGE_ID = 'purchase_access_ready';
export const PURCHASE_ACCESS_READY_EMAIL_BUSINESS_OBJECT_TYPE = 'purchase';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSTGRES_INTEGER_MAX = 2_147_483_647;

function requirePlainObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new LaunchEmailDispatchError(
      `${fieldName} must be a plain object.`,
      'INVALID_PURCHASE_ACCESS_READY_EVENT',
    );
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new LaunchEmailDispatchError(
      `${fieldName} must be a plain object.`,
      'INVALID_PURCHASE_ACCESS_READY_EVENT',
    );
  }
  return value;
}

function requireUuid(value, fieldName) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new LaunchEmailDispatchError(
      `${fieldName} must be a UUID.`,
      'INVALID_PURCHASE_ACCESS_READY_EVENT',
    );
  }
  return normalized;
}

function requireTimestamp(value, fieldName) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new LaunchEmailDispatchError(
      `${fieldName} must be an ISO-8601 timestamp.`,
      'INVALID_PURCHASE_ACCESS_READY_EVENT',
    );
  }
  return new Date(value).toISOString();
}

function requireEntitlementVersion(value) {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1 || version > POSTGRES_INTEGER_MAX) {
    throw new LaunchEmailDispatchError(
      'The entitlement version is outside the durable outbox range.',
      'INVALID_PURCHASE_ACCESS_READY_STATE_VERSION',
    );
  }
  return version;
}

export function createPurchaseAccessReadyEmailIntent({ accessResult }) {
  const result = requirePlainObject(accessResult, 'accessResult');
  const profile = requirePlainObject(result.profile, 'accessResult.profile');
  const purchase = requirePlainObject(result.purchase, 'accessResult.purchase');
  const entitlement = requirePlainObject(result.entitlement, 'accessResult.entitlement');

  const accountId = requireUuid(profile.account_id, 'accessResult.profile.account_id');
  const purchaseId = requireUuid(purchase.id, 'accessResult.purchase.id');
  const entitlementId = requireUuid(entitlement.id, 'accessResult.entitlement.id');
  if (
    requireUuid(purchase.account_id, 'accessResult.purchase.account_id') !== accountId
    || requireUuid(entitlement.account_id, 'accessResult.entitlement.account_id') !== accountId
    || requireUuid(entitlement.purchase_id, 'accessResult.entitlement.purchase_id') !== purchaseId
  ) {
    throw new LaunchEmailDispatchError(
      'The purchase, entitlement, and access account identities do not match.',
      'PURCHASE_ACCESS_READY_IDENTITY_MISMATCH',
    );
  }
  if (profile.status !== 'active' || purchase.status !== 'completed' || entitlement.state !== 'active') {
    throw new LaunchEmailDispatchError(
      'Only a completed purchase with active account access may create this email.',
      'PURCHASE_ACCESS_READY_STATE_MISMATCH',
    );
  }

  const occurredAt = requireTimestamp(purchase.completed_at, 'accessResult.purchase.completed_at');
  const intent = createLaunchEmailDispatchIntent({
    messageId: PURCHASE_ACCESS_READY_EMAIL_MESSAGE_ID,
    businessObjectType: PURCHASE_ACCESS_READY_EMAIL_BUSINESS_OBJECT_TYPE,
    businessObjectId: purchaseId,
    stateVersion: requireEntitlementVersion(entitlement.version),
    recipientEmail: normalizeEmail(profile.email),
    occurredAt,
  });

  if (Object.keys(intent.outboxRecord.payload).length !== 0) {
    throw new LaunchEmailDispatchError(
      'The purchase access email payload must remain empty.',
      'PURCHASE_ACCESS_READY_PAYLOAD_NOT_MINIMIZED',
    );
  }

  return Object.freeze({ intent, entitlementId });
}

export async function deliverPurchaseAccessReadyEmail({
  accessResult,
  environment = process.env,
  ledgerFetchImpl = fetch,
  providerFetchImpl = fetch,
  nowMs = Date.now(),
}) {
  const prepared = createPurchaseAccessReadyEmailIntent({ accessResult });
  const state = await enqueueLaunchEmailIntent({
    intent: prepared.intent,
    environment,
    fetchImpl: ledgerFetchImpl,
  });
  if (!state.enabled || !lifecycleEmailDispatchEnabled(environment)) {
    return Object.freeze({ enabled: false, state, delivery: null });
  }

  const providerAdapter = createResendLaunchEmailAdapter({
    environment,
    fetchImpl: providerFetchImpl,
  });
  const delivery = await dispatchEnqueuedLaunchEmail({
    state,
    providerAdapter,
    consentState: 'not_applicable',
    suppressionState: 'none',
    environment,
    fetchImpl: ledgerFetchImpl,
    nowMs,
  });
  return Object.freeze({ enabled: true, state, delivery });
}
