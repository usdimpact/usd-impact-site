import { normalizeEmail } from './email-readiness-contracts.js';
import {
  LaunchEmailDispatchError,
  createLaunchEmailDispatchIntent,
  dispatchEnqueuedLaunchEmail,
  enqueueLaunchEmailIntent,
} from './launch-email-dispatch.js';

export const ACCOUNT_DELETION_COMPLETED_MESSAGE_ID = 'account_deletion_completed';
export const ACCOUNT_DELETION_COMPLETED_BUSINESS_OBJECT_TYPE = 'account_deletion_request';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSTGRES_INTEGER_MAX = 2_147_483_647;

function requirePlainObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new LaunchEmailDispatchError(`${fieldName} must be a plain object.`, 'INVALID_ACCOUNT_DELETION_COMPLETION');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new LaunchEmailDispatchError(`${fieldName} must be a plain object.`, 'INVALID_ACCOUNT_DELETION_COMPLETION');
  }
  return value;
}

function requireUuid(value, fieldName) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new LaunchEmailDispatchError(`${fieldName} must be a UUID.`, 'INVALID_ACCOUNT_DELETION_COMPLETION');
  }
  return normalized;
}

function requireTimestamp(value, fieldName) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new LaunchEmailDispatchError(`${fieldName} must be an ISO-8601 timestamp.`, 'INVALID_ACCOUNT_DELETION_COMPLETION');
  }
  return new Date(value).toISOString();
}

export function accountDeletionCompletedStateVersion(deletedAt) {
  const timestamp = requireTimestamp(deletedAt, 'deletedAt');
  const version = Math.floor(Date.parse(timestamp) / 60_000);
  if (!Number.isSafeInteger(version) || version < 1 || version > POSTGRES_INTEGER_MAX) {
    throw new LaunchEmailDispatchError(
      'The account deletion completion state version is outside the durable outbox range.',
      'INVALID_ACCOUNT_DELETION_COMPLETION_VERSION',
    );
  }
  return version;
}

export function createAccountDeletionCompletedEmailIntent({ finalizationResult }) {
  const result = requirePlainObject(finalizationResult, 'finalizationResult');
  const accountId = requireUuid(result.account_id, 'finalizationResult.account_id');
  const recipientEmail = normalizeEmail(result.recipient_email);
  const deletionRequestedAt = requireTimestamp(
    result.deletion_requested_at,
    'finalizationResult.deletion_requested_at',
  );
  const deletedAt = requireTimestamp(result.deleted_at, 'finalizationResult.deleted_at');
  if (Date.parse(deletedAt) < Date.parse(deletionRequestedAt)) {
    throw new LaunchEmailDispatchError(
      'Account deletion completion cannot precede the deletion request.',
      'ACCOUNT_DELETION_COMPLETION_TIMESTAMP_MISMATCH',
    );
  }

  return createLaunchEmailDispatchIntent({
    messageId: ACCOUNT_DELETION_COMPLETED_MESSAGE_ID,
    businessObjectType: ACCOUNT_DELETION_COMPLETED_BUSINESS_OBJECT_TYPE,
    businessObjectId: accountId,
    stateVersion: accountDeletionCompletedStateVersion(deletedAt),
    recipientEmail,
    occurredAt: deletedAt,
  });
}

export async function enqueueAccountDeletionCompletedEmail({
  finalizationResult,
  environment = process.env,
  fetchImpl = fetch,
}) {
  const intent = createAccountDeletionCompletedEmailIntent({ finalizationResult });
  return enqueueLaunchEmailIntent({ intent, environment, fetchImpl });
}

export async function dispatchAccountDeletionCompletedEmail({
  state,
  providerAdapter,
  suppressionState = 'none',
  environment = process.env,
  fetchImpl = fetch,
  nowMs = Date.now(),
}) {
  if (
    state?.intent?.messageId !== ACCOUNT_DELETION_COMPLETED_MESSAGE_ID
    || state?.intent?.outboxRecord?.business_object_type !== ACCOUNT_DELETION_COMPLETED_BUSINESS_OBJECT_TYPE
  ) {
    throw new LaunchEmailDispatchError(
      'The persisted state is not an account-deletion-completed email intent.',
      'ACCOUNT_DELETION_COMPLETION_INTENT_MISMATCH',
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
