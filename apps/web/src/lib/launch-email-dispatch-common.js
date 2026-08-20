import { createHash } from 'node:crypto';

export const LAUNCH_EMAIL_DISPATCH_VERSION = '2026-08-20.v1';
export const LAUNCH_EMAIL_DEVELOPMENT_PROJECT_REF = 'ycstrcvshdluovtuasjc';
export const LAUNCH_EMAIL_PRODUCTION_PROJECT_REF = 'gjzetjugmnwanvjkchux';
export const PROVIDER_IDEMPOTENCY_WINDOW_MS = 23 * 60 * 60 * 1000;
export const CLOCK_SKEW_MS = 5 * 60 * 1000;
export const PROVIDER_BOUNDARIES = new Set([
  'application_owned',
  'application_owned_after_verified_event',
  'shared_after_provider_selection',
  'supabase_auth',
]);
export const CONSENT_STATES = new Set(['granted', 'withdrawn', 'missing', 'not_applicable']);
export const SENDABLE_STATUSES = new Set(['queued', 'retry_scheduled', 'soft_bounced']);
export const PROVIDER_RESULT_STATES = new Set(['accepted', 'delivered']);
export const FAILURE_PROVIDER_STATES = new Set([
  'failed',
  'accepted_ambiguous',
  'bounced',
  'complained',
  'suppressed',
]);
export const OUTBOX_SELECT_FIELDS = [
  'id',
  'idempotency_key',
  'event_id',
  'message_id',
  'classification',
  'business_object_type',
  'business_object_id',
  'state_version',
  'recipient_email_normalized',
  'template_id',
  'template_version',
  'provider',
  'consent_required',
  'consent_record_id',
  'consent_purpose',
  'consent_checked_at',
  'payload',
  'status',
  'attempt_count',
  'next_attempt_at',
  'provider_message_ref',
  'error_code',
  'accepted_at',
  'delivered_at',
  'failed_at',
  'created_at',
  'updated_at',
].join(',');

const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,79}$/;
const PROVIDER_IDEMPOTENCY_PREFIX = 'launch-email/';

export class LaunchEmailDispatchError extends Error {
  constructor(message, code = 'LAUNCH_EMAIL_DISPATCH_FAILED') {
    super(message);
    this.name = 'LaunchEmailDispatchError';
    this.code = code;
  }
}

export function requireString(value, fieldName, maxLength = 200) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new LaunchEmailDispatchError(
      `${fieldName} must be a non-empty string no longer than ${maxLength} characters.`,
      'INVALID_DISPATCH_INPUT',
    );
  }
  return value.trim();
}

export function requireInteger(value, fieldName, minimum = 1) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new LaunchEmailDispatchError(
      `${fieldName} must be an integer greater than or equal to ${minimum}.`,
      'INVALID_DISPATCH_INPUT',
    );
  }
  return value;
}

export function requireTimestamp(value, fieldName) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new LaunchEmailDispatchError(
      `${fieldName} must be an ISO-8601 timestamp.`,
      'INVALID_DISPATCH_INPUT',
    );
  }
  return new Date(value).toISOString();
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function timestampMs(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function projectRefFromUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const suffix = '.supabase.co';
    if (!hostname.endsWith(suffix)) return null;
    return hostname.slice(0, -suffix.length) || null;
  } catch {
    return null;
  }
}

export function createDispatchIdentity({
  messageId,
  businessObjectType,
  businessObjectId,
  stateVersion,
  recipientEmail,
}) {
  const canonical = JSON.stringify({
    messageId,
    businessObjectType,
    businessObjectId,
    stateVersion,
    recipientEmail,
  });
  const digest = createHash('sha256').update(canonical).digest('hex');
  return Object.freeze({
    eventId: `${messageId}:${digest.slice(0, 40)}:v${stateVersion}`,
    customerReference: `ui-${digest.slice(0, 16)}`,
    providerIdempotencyKey: `${PROVIDER_IDEMPOTENCY_PREFIX}${digest}`,
  });
}

export function safeErrorCode(value, fallback = 'PROVIDER_SEND_FAILED') {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .slice(0, 80);
  return ERROR_CODE_PATTERN.test(normalized) ? normalized : fallback;
}
