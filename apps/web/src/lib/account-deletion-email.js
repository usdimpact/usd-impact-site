import { normalizeEmail } from './email-readiness-contracts.js';
import {
  LaunchEmailDispatchError,
  createLaunchEmailDispatchIntent,
  dispatchEnqueuedLaunchEmail,
  enqueueLaunchEmailIntent,
} from './launch-email-dispatch.js';

export const ACCOUNT_DELETION_EMAIL_MESSAGE_ID = 'account_deletion_requested';
export const ACCOUNT_DELETION_EMAIL_BUSINESS_OBJECT_TYPE = 'account_deletion_request';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSTGRES_INTEGER_MAX = 2_147_483_647;

function requirePlainObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new LaunchEmailDispatchError(
      `${fieldName} must be a plain object.`,
      'INVALID_ACCOUNT_DELETION_EVENT',
    );
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new LaunchEmailDispatchError(
      `${fieldName} must be a plain object.`,
      'INVALID_ACCOUNT_DELETION_EVENT',
    );
  }
  return value;
}

function requireUuid(value, fieldName) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new LaunchEmailDispatchError(
      `${fieldName} must be a UUID.`,
      'INVALID_ACCOUNT_DELETION_EVENT',
    );
  }
  return normalized;
}

function requireTimestamp(value, fieldName) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new LaunchEmailDispatchError(
      `${fieldName} must be an ISO-8601 timestamp.`,
      'INVALID_ACCOUNT_DELETION_EVENT',
    );
  }
  return new Date(value).toISOString();
}

export function accountDeletionStateVersion(deletionRequestedAt) {
  const occurredAt = requireTimestamp(deletionRequestedAt, 'deletionRequestedAt');
  const version = Math.floor(Date.parse(occurredAt) / 60_000);
  if (!Number.isSafeInteger(version) || version < 1 || version > POSTGRES_INTEGER_MAX) {
    throw new LaunchEmailDispatchError(
      'The account deletion state version is outside the durable outbox range.',
      'INVALID_ACCOUNT_DELETION_STATE_VERSION',
    );
  }
  return version;
}

export function createAccountDeletionRequestedEmailIntent({ deletionResult }) {
  const result = requirePlainObject(deletionResult, 'deletionResult');
  const user = requirePlainObject(result.user, 'deletionResult.user');
  const profile = requirePlainObject(result.profile, 'deletionResult.profile');

  const accountId = requireUuid(user.id, 'deletionResult.user.id');
  const profileAccountId = requireUuid(
    profile.account_id,
    'deletionResult.profile.account_id',
  );
  if (profileAccountId !== accountId) {
    throw new LaunchEmailDispatchError(
      'The deletion profile does not belong to the verified account.',
      'ACCOUNT_DELETION_IDENTITY_MISMATCH',
    );
  }

  const recipientEmail = normalizeEmail(user.email);
  if (normalizeEmail(profile.email) !== recipientEmail) {
    throw new LaunchEmailDispatchError(
      'The deletion profile email does not match the verified account.',
      'ACCOUNT_DELETION_EMAIL_MISMATCH',
    );
  }
  if (profile.status !== 'deletion_pending') {
    throw new LaunchEmailDispatchError(
      'The account is not in the deletion-pending state.',
      'ACCOUNT_DELETION_STATE_MISMATCH',
    );
  }

  const occurredAt = requireTimestamp(
    profile.deletion_requested_at,
    'deletionResult.profile.deletion_requested_at',
  );
  const deletionDueAt = requireTimestamp(
    profile.deletion_due_at,
    'deletionResult.profile.deletion_due_at',
  );
  if (Date.parse(deletionDueAt) <= Date.parse(occurredAt)) {
    throw new LaunchEmailDispatchError(
      'The account deletion due time must follow the request time.',
      'ACCOUNT_DELETION_TIMESTAMP_MISMATCH',
    );
  }

  return createLaunchEmailDispatchIntent({
    messageId: ACCOUNT_DELETION_EMAIL_MESSAGE_ID,
    businessObjectType: ACCOUNT_DELETION_EMAIL_BUSINESS_OBJECT_TYPE,
    businessObjectId: accountId,
    stateVersion: accountDeletionStateVersion(occurredAt),
    recipientEmail,
    occurredAt,
  });
}

export async function enqueueAccountDeletionRequestedEmail({
  deletionResult,
  environment = process.env,
  fetchImpl = fetch,
}) {
  const intent = createAccountDeletionRequestedEmailIntent({ deletionResult });
  return enqueueLaunchEmailIntent({ intent, environment, fetchImpl });
}

export async function dispatchAccountDeletionRequestedEmail({
  state,
  providerAdapter,
  suppressionState = 'none',
  environment = process.env,
  fetchImpl = fetch,
  nowMs = Date.now(),
}) {
  if (
    state?.intent?.messageId !== ACCOUNT_DELETION_EMAIL_MESSAGE_ID
    || state?.intent?.outboxRecord?.business_object_type
      !== ACCOUNT_DELETION_EMAIL_BUSINESS_OBJECT_TYPE
  ) {
    throw new LaunchEmailDispatchError(
      'The persisted state is not an account-deletion-request email intent.',
      'ACCOUNT_DELETION_INTENT_MISMATCH',
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
