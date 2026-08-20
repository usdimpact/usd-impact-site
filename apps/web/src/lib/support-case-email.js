import { normalizeEmail } from './email-readiness-contracts.js';
import {
  LaunchEmailDispatchError,
  createLaunchEmailDispatchIntent,
  dispatchEnqueuedLaunchEmail,
  enqueueLaunchEmailIntent,
} from './launch-email-dispatch.js';

export const SUPPORT_CASE_EMAIL_MESSAGE_ID = 'support_case_received';
export const SUPPORT_CASE_EMAIL_BUSINESS_OBJECT_TYPE = 'support_case';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSTGRES_INTEGER_MAX = 2_147_483_647;
const SUPPORT_CATEGORIES = new Set([
  'access',
  'commerce',
  'privacy',
  'security',
  'product',
  'general',
]);

function requirePlainObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new LaunchEmailDispatchError(
      `${fieldName} must be a plain object.`,
      'INVALID_SUPPORT_CASE_EVENT',
    );
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new LaunchEmailDispatchError(
      `${fieldName} must be a plain object.`,
      'INVALID_SUPPORT_CASE_EVENT',
    );
  }
  return value;
}

function requireUuid(value, fieldName) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new LaunchEmailDispatchError(
      `${fieldName} must be a UUID.`,
      'INVALID_SUPPORT_CASE_EVENT',
    );
  }
  return normalized;
}

function requireTimestamp(value, fieldName) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new LaunchEmailDispatchError(
      `${fieldName} must be an ISO-8601 timestamp.`,
      'INVALID_SUPPORT_CASE_EVENT',
    );
  }
  return new Date(value).toISOString();
}

function requireCategory(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!SUPPORT_CATEGORIES.has(normalized)) {
    throw new LaunchEmailDispatchError(
      'The support category is not approved.',
      'INVALID_SUPPORT_CASE_CATEGORY',
    );
  }
  return normalized;
}

export function supportCaseStateVersion(createdAt) {
  const occurredAt = requireTimestamp(createdAt, 'createdAt');
  const version = Math.floor(Date.parse(occurredAt) / 60_000);
  if (!Number.isSafeInteger(version) || version < 1 || version > POSTGRES_INTEGER_MAX) {
    throw new LaunchEmailDispatchError(
      'The support-case state version is outside the durable outbox range.',
      'INVALID_SUPPORT_CASE_STATE_VERSION',
    );
  }
  return version;
}

export function createSupportCaseReceivedEmailIntent({ supportResult }) {
  const result = requirePlainObject(supportResult, 'supportResult');
  const user = requirePlainObject(result.user, 'supportResult.user');
  const request = requirePlainObject(result.request, 'supportResult.request');

  const userId = requireUuid(user.id, 'supportResult.user.id');
  const requestId = requireUuid(request.id, 'supportResult.request.id');
  const requestAccountId = requireUuid(
    request.account_id,
    'supportResult.request.account_id',
  );
  if (requestAccountId !== userId) {
    throw new LaunchEmailDispatchError(
      'The support request does not belong to the verified account.',
      'SUPPORT_CASE_IDENTITY_MISMATCH',
    );
  }

  const userEmail = normalizeEmail(user.email);
  const requestEmail = normalizeEmail(request.email);
  if (requestEmail !== userEmail) {
    throw new LaunchEmailDispatchError(
      'The support request email does not match the verified account.',
      'SUPPORT_CASE_EMAIL_MISMATCH',
    );
  }

  requireCategory(request.category);
  if (request.status !== 'open') {
    throw new LaunchEmailDispatchError(
      'Only newly opened support requests may create a received acknowledgement.',
      'SUPPORT_CASE_STATUS_MISMATCH',
    );
  }

  const createdAt = requireTimestamp(request.created_at, 'supportResult.request.created_at');
  const emailConfirmedAt = requireTimestamp(
    user.emailConfirmedAt,
    'supportResult.user.emailConfirmedAt',
  );
  if (Date.parse(emailConfirmedAt) > Date.parse(createdAt)) {
    throw new LaunchEmailDispatchError(
      'The verified account confirmation time follows the support request.',
      'SUPPORT_CASE_VERIFICATION_TIME_MISMATCH',
    );
  }

  const intent = createLaunchEmailDispatchIntent({
    messageId: SUPPORT_CASE_EMAIL_MESSAGE_ID,
    businessObjectType: SUPPORT_CASE_EMAIL_BUSINESS_OBJECT_TYPE,
    businessObjectId: requestId,
    stateVersion: supportCaseStateVersion(createdAt),
    recipientEmail: userEmail,
    occurredAt: createdAt,
  });

  if (Object.keys(intent.outboxRecord.payload).length !== 0) {
    throw new LaunchEmailDispatchError(
      'The support acknowledgement payload must remain empty.',
      'SUPPORT_CASE_PAYLOAD_NOT_MINIMIZED',
    );
  }

  return intent;
}

export async function enqueueSupportCaseReceivedEmail({
  supportResult,
  environment = process.env,
  fetchImpl = fetch,
}) {
  const intent = createSupportCaseReceivedEmailIntent({ supportResult });
  return enqueueLaunchEmailIntent({ intent, environment, fetchImpl });
}

export async function dispatchSupportCaseReceivedEmail({
  state,
  providerAdapter,
  suppressionState = 'none',
  environment = process.env,
  fetchImpl = fetch,
  nowMs = Date.now(),
}) {
  if (
    state?.intent?.messageId !== SUPPORT_CASE_EMAIL_MESSAGE_ID
    || state?.intent?.outboxRecord?.business_object_type
      !== SUPPORT_CASE_EMAIL_BUSINESS_OBJECT_TYPE
  ) {
    throw new LaunchEmailDispatchError(
      'The persisted state is not a support-case acknowledgement intent.',
      'SUPPORT_CASE_INTENT_MISMATCH',
    );
  }

  return dispatchEnqueuedLaunchEmail({
    state,
    providerAdapter,
    consentState: 'not_applicable',
    suppressionState,
    environment,
    fetchImpl,
    nowMs,
  });
}
