import { normalizeEmail } from './email-readiness-contracts.js';
import {
  LaunchEmailDispatchError,
  createLaunchEmailDispatchIntent,
  dispatchEnqueuedLaunchEmail,
  enqueueLaunchEmailIntent,
} from './launch-email-dispatch.js';

export const PRIVACY_EXPORT_EMAIL_MESSAGE_ID = 'privacy_export_acknowledgement';
export const PRIVACY_EXPORT_EMAIL_BUSINESS_OBJECT_TYPE = 'privacy_export_request';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSTGRES_INTEGER_MAX = 2_147_483_647;

function requirePlainObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new LaunchEmailDispatchError(
      `${fieldName} must be a plain object.`,
      'INVALID_PRIVACY_EXPORT_EVENT',
    );
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new LaunchEmailDispatchError(
      `${fieldName} must be a plain object.`,
      'INVALID_PRIVACY_EXPORT_EVENT',
    );
  }
  return value;
}

function requireUuid(value, fieldName) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new LaunchEmailDispatchError(
      `${fieldName} must be a UUID.`,
      'INVALID_PRIVACY_EXPORT_EVENT',
    );
  }
  return normalized;
}

function requireTimestamp(value, fieldName) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new LaunchEmailDispatchError(
      `${fieldName} must be an ISO-8601 timestamp.`,
      'INVALID_PRIVACY_EXPORT_EVENT',
    );
  }
  return new Date(value).toISOString();
}

export function privacyExportStateVersion(generatedAt) {
  const occurredAt = requireTimestamp(generatedAt, 'generatedAt');
  const version = Math.floor(Date.parse(occurredAt) / 60_000);
  if (!Number.isSafeInteger(version) || version < 1 || version > POSTGRES_INTEGER_MAX) {
    throw new LaunchEmailDispatchError(
      'The privacy export state version is outside the durable outbox range.',
      'INVALID_PRIVACY_EXPORT_STATE_VERSION',
    );
  }
  return version;
}

export function createPrivacyExportAcknowledgementEmailIntent({
  exportResult,
  verifiedUser,
}) {
  const result = requirePlainObject(exportResult, 'exportResult');
  const user = requirePlainObject(verifiedUser, 'verifiedUser');

  if (!Object.prototype.hasOwnProperty.call(result, 'data')) {
    throw new LaunchEmailDispatchError(
      'The authoritative account export result is incomplete.',
      'PRIVACY_EXPORT_RESULT_INCOMPLETE',
    );
  }

  const accountId = requireUuid(result.accountId, 'exportResult.accountId');
  const verifiedAccountId = requireUuid(user.id, 'verifiedUser.id');
  if (verifiedAccountId !== accountId) {
    throw new LaunchEmailDispatchError(
      'The privacy export does not belong to the verified account.',
      'PRIVACY_EXPORT_IDENTITY_MISMATCH',
    );
  }

  const generatedAt = requireTimestamp(result.generatedAt, 'exportResult.generatedAt');
  const emailConfirmedAt = requireTimestamp(
    user.emailConfirmedAt,
    'verifiedUser.emailConfirmedAt',
  );
  if (Date.parse(emailConfirmedAt) > Date.parse(generatedAt)) {
    throw new LaunchEmailDispatchError(
      'The verified account confirmation time follows the export time.',
      'PRIVACY_EXPORT_VERIFICATION_TIME_MISMATCH',
    );
  }

  const intent = createLaunchEmailDispatchIntent({
    messageId: PRIVACY_EXPORT_EMAIL_MESSAGE_ID,
    businessObjectType: PRIVACY_EXPORT_EMAIL_BUSINESS_OBJECT_TYPE,
    businessObjectId: accountId,
    stateVersion: privacyExportStateVersion(generatedAt),
    recipientEmail: normalizeEmail(user.email),
    occurredAt: generatedAt,
  });

  if (intent.spec.securePayloadForbidden !== true) {
    throw new LaunchEmailDispatchError(
      'The privacy export template does not prohibit secure payload delivery.',
      'PRIVACY_EXPORT_TEMPLATE_BOUNDARY_MISSING',
    );
  }
  if (Object.keys(intent.outboxRecord.payload).length !== 0) {
    throw new LaunchEmailDispatchError(
      'The privacy export acknowledgement payload must remain empty.',
      'PRIVACY_EXPORT_PAYLOAD_NOT_MINIMIZED',
    );
  }

  return intent;
}

export async function enqueuePrivacyExportAcknowledgementEmail({
  exportResult,
  verifiedUser,
  environment = process.env,
  fetchImpl = fetch,
}) {
  const intent = createPrivacyExportAcknowledgementEmailIntent({
    exportResult,
    verifiedUser,
  });
  return enqueueLaunchEmailIntent({ intent, environment, fetchImpl });
}

export async function dispatchPrivacyExportAcknowledgementEmail({
  state,
  providerAdapter,
  suppressionState = 'none',
  environment = process.env,
  fetchImpl = fetch,
  nowMs = Date.now(),
}) {
  if (
    state?.intent?.messageId !== PRIVACY_EXPORT_EMAIL_MESSAGE_ID
    || state?.intent?.outboxRecord?.business_object_type
      !== PRIVACY_EXPORT_EMAIL_BUSINESS_OBJECT_TYPE
  ) {
    throw new LaunchEmailDispatchError(
      'The persisted state is not a privacy-export acknowledgement intent.',
      'PRIVACY_EXPORT_INTENT_MISMATCH',
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
