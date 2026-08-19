import { createHash } from 'node:crypto';

export const NOTIFICATION_CLASSIFICATIONS = Object.freeze([
  'transactional',
  'transactional_security',
  'transactional_operational',
  'operational',
  'marketing',
]);

const CLASSIFICATION_SET = new Set(NOTIFICATION_CLASSIFICATIONS);
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_.:-]{1,127}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORBIDDEN_PAYLOAD_KEY_PATTERN = /(?:^|_)(?:authorization|cookie|set_cookie|password|passcode|secret|api_?key|cvv|cvc|card_number|access_token|refresh_token|auth_token|learning_answer|learning_note|private_learning_input)(?:$|_)/i;
const FORBIDDEN_EVIDENCE_KEY_PATTERN = /(?:^|_)(?:email|ip|ip_address|user_agent|fingerprint|device_id|full_name|first_name|last_name)(?:$|_)/i;

function requirePlainObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${fieldName} must be a plain object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${fieldName} must be a plain object.`);
  }
  return value;
}

function requireString(value, fieldName, maxLength = 200) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new TypeError(`${fieldName} must be a non-empty string no longer than ${maxLength} characters.`);
  }
  return value.trim();
}

function requireIdentifier(value, fieldName, maxLength = 128) {
  const normalized = requireString(value, fieldName, maxLength);
  if (!IDENTIFIER_PATTERN.test(normalized)) {
    throw new TypeError(`${fieldName} must be a stable lowercase identifier.`);
  }
  return normalized;
}

function optionalUuid(value, fieldName) {
  if (value == null) return null;
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new TypeError(`${fieldName} must be a UUID.`);
  }
  return value.toLowerCase();
}

function requireUuid(value, fieldName) {
  const normalized = optionalUuid(value, fieldName);
  if (!normalized) throw new TypeError(`${fieldName} must be a UUID.`);
  return normalized;
}

function requireInteger(value, fieldName, minimum = 1) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${fieldName} must be an integer greater than or equal to ${minimum}.`);
  }
  return value;
}

function requireTimestamp(value, fieldName) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new TypeError(`${fieldName} must be an ISO-8601 timestamp.`);
  }
  return new Date(value).toISOString();
}

function canonicalize(value, path = 'value') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((item, index) => canonicalize(item, `${path}[${index}]`));
  requirePlainObject(value, path);
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key], `${path}.${key}`)]),
  );
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizedKey(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase();
}

function assertSafeObjectKeys(value, pattern, path) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeObjectKeys(item, pattern, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  requirePlainObject(value, path);
  for (const [key, child] of Object.entries(value)) {
    if (pattern.test(normalizedKey(key))) {
      throw new TypeError(`${path}.${key} is not allowed.`);
    }
    assertSafeObjectKeys(child, pattern, `${path}.${key}`);
  }
}

function requireBoundedJsonObject(value, fieldName, forbiddenKeyPattern) {
  requirePlainObject(value, fieldName);
  assertSafeObjectKeys(value, forbiddenKeyPattern, fieldName);
  const normalized = canonicalize(value, fieldName);
  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > 65_536) {
    throw new TypeError(`${fieldName} must not exceed 65536 bytes.`);
  }
  return normalized;
}

function requireBoundedJsonSize(value, fieldName) {
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 65_536) {
    throw new TypeError(`${fieldName} must not exceed 65536 bytes.`);
  }
  return value;
}

export function normalizeEmail(value) {
  const email = requireString(value, 'email', 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new TypeError('email must be a valid address.');
  }
  return email;
}

export function createConsentEventIdempotencyKey({
  sourceEventId,
  email,
  purpose,
  status,
  consentTextVersion,
  privacyNoticeVersion,
}) {
  const identity = canonicalize({
    version: 1,
    sourceEventId: requireString(sourceEventId, 'sourceEventId'),
    email: normalizeEmail(email),
    purpose: requireIdentifier(purpose, 'purpose', 80),
    status: requireConsentStatus(status),
    consentTextVersion: requireString(consentTextVersion, 'consentTextVersion', 80),
    privacyNoticeVersion: requireString(privacyNoticeVersion, 'privacyNoticeVersion', 80),
  });
  return `consent:v1:${sha256(JSON.stringify(identity))}`;
}

function requireConsentStatus(status) {
  if (status !== 'granted' && status !== 'withdrawn') {
    throw new TypeError('status must be granted or withdrawn.');
  }
  return status;
}

export function createConsentEventRecord({
  sourceEventId,
  email,
  userId = null,
  purpose,
  status,
  consentTextVersion,
  privacyNoticeVersion,
  source,
  capturedAt,
  withdrawnAt = null,
  withdrawalSource = null,
  relatedGrantId = null,
  providerContactRef = null,
  evidenceContext = {},
}) {
  const normalizedStatus = requireConsentStatus(status);
  const normalizedSource = requireIdentifier(source, 'source', 80);
  const normalizedPurpose = requireIdentifier(purpose, 'purpose', 80);
  const normalizedCapturedAt = requireTimestamp(capturedAt, 'capturedAt');
  const normalizedWithdrawnAt = withdrawnAt == null
    ? null
    : requireTimestamp(withdrawnAt, 'withdrawnAt');
  const normalizedWithdrawalSource = withdrawalSource == null
    ? null
    : requireIdentifier(withdrawalSource, 'withdrawalSource', 80);
  const normalizedRelatedGrantId = optionalUuid(relatedGrantId, 'relatedGrantId');
  const hasAnyWithdrawalField = Boolean(
    normalizedWithdrawnAt || normalizedWithdrawalSource || normalizedRelatedGrantId,
  );
  const hasCompleteWithdrawalFields = Boolean(
    normalizedWithdrawnAt && normalizedWithdrawalSource && normalizedRelatedGrantId,
  );
  if (
    (normalizedStatus === 'granted' && hasAnyWithdrawalField)
    || (normalizedStatus === 'withdrawn' && !hasCompleteWithdrawalFields)
  ) {
    throw new TypeError('Withdrawal events require withdrawnAt, withdrawalSource, and relatedGrantId.');
  }
  if (normalizedWithdrawnAt && Date.parse(normalizedWithdrawnAt) < Date.parse(normalizedCapturedAt)) {
    throw new TypeError('withdrawnAt must not precede capturedAt.');
  }

  const normalizedEvidenceContext = requireBoundedJsonObject(
    evidenceContext,
    'evidenceContext',
    FORBIDDEN_EVIDENCE_KEY_PATTERN,
  );
  const normalizedConsentTextVersion = requireString(
    consentTextVersion,
    'consentTextVersion',
    80,
  );
  const normalizedPrivacyNoticeVersion = requireString(
    privacyNoticeVersion,
    'privacyNoticeVersion',
    80,
  );

  const identity = {
    sourceEventId,
    email,
    purpose,
    status: normalizedStatus,
    consentTextVersion,
    privacyNoticeVersion,
  };
  const evidence = requireBoundedJsonSize(canonicalize({
    purpose: normalizedPurpose,
    status: normalizedStatus,
    consent_text_version: normalizedConsentTextVersion,
    privacy_notice_version: normalizedPrivacyNoticeVersion,
    source: normalizedSource,
    source_event_id: requireString(sourceEventId, 'sourceEventId'),
    captured_at: normalizedCapturedAt,
    withdrawn_at: normalizedWithdrawnAt,
    withdrawal_source: normalizedWithdrawalSource,
    context: normalizedEvidenceContext,
  }, 'evidence'), 'evidence');
  return deepFreeze({
    idempotency_key: createConsentEventIdempotencyKey(identity),
    source_event_id: requireString(sourceEventId, 'sourceEventId'),
    email_normalized: normalizeEmail(email),
    user_id: optionalUuid(userId, 'userId'),
    purpose: normalizedPurpose,
    status: normalizedStatus,
    consent_text_version: normalizedConsentTextVersion,
    privacy_notice_version: normalizedPrivacyNoticeVersion,
    source: normalizedSource,
    captured_at: normalizedCapturedAt,
    withdrawn_at: normalizedWithdrawnAt,
    withdrawal_source: normalizedWithdrawalSource,
    related_grant_id: normalizedRelatedGrantId,
    provider_contact_ref: providerContactRef == null
      ? null
      : requireString(providerContactRef, 'providerContactRef', 255),
    evidence,
    evidence_checksum: sha256(JSON.stringify(evidence)),
  });
}

export function createNotificationIdempotencyKey({
  messageId,
  businessObjectType,
  businessObjectId,
  stateVersion,
  recipientEmail,
}) {
  const identity = canonicalize({
    version: 1,
    messageId: requireIdentifier(messageId, 'messageId'),
    businessObjectType: requireIdentifier(businessObjectType, 'businessObjectType', 80),
    businessObjectId: requireString(businessObjectId, 'businessObjectId'),
    stateVersion: requireInteger(stateVersion, 'stateVersion'),
    recipientEmail: normalizeEmail(recipientEmail),
  });
  return `notification:v1:${sha256(JSON.stringify(identity))}`;
}

export function buildNotificationOutboxRecord({
  eventId,
  messageId,
  classification,
  businessObjectType,
  businessObjectId,
  stateVersion,
  recipientEmail,
  templateId,
  templateVersion,
  provider,
  consent = null,
  consentCheckedAt = null,
  payload = {},
  nextAttemptAt,
}) {
  if (!CLASSIFICATION_SET.has(classification)) {
    throw new TypeError('classification is not supported.');
  }
  const consentRequired = classification === 'marketing' || consent != null;
  let normalizedConsent = null;
  if (consentRequired) {
    requirePlainObject(consent, 'consent');
    if (consent.status !== 'granted') {
      throw new TypeError('Consent-required notifications require a granted consent record.');
    }
    const recipientEmailNormalized = normalizeEmail(recipientEmail);
    if (normalizeEmail(consent.emailNormalized) !== recipientEmailNormalized) {
      throw new TypeError('The consent recipient must match the notification recipient.');
    }
    normalizedConsent = {
      id: requireUuid(consent.id, 'consent.id'),
      purpose: requireIdentifier(consent.purpose, 'consent.purpose', 80),
      checkedAt: requireTimestamp(consentCheckedAt, 'consentCheckedAt'),
    };
  }
  const normalizedPayload = requireBoundedJsonObject(
    payload,
    'payload',
    FORBIDDEN_PAYLOAD_KEY_PATTERN,
  );
  const identity = {
    messageId,
    businessObjectType,
    businessObjectId,
    stateVersion,
    recipientEmail,
  };

  return deepFreeze({
    idempotency_key: createNotificationIdempotencyKey(identity),
    event_id: requireString(eventId, 'eventId'),
    message_id: requireIdentifier(messageId, 'messageId'),
    classification,
    business_object_type: requireIdentifier(businessObjectType, 'businessObjectType', 80),
    business_object_id: requireString(businessObjectId, 'businessObjectId'),
    state_version: requireInteger(stateVersion, 'stateVersion'),
    recipient_email_normalized: normalizeEmail(recipientEmail),
    template_id: requireIdentifier(templateId, 'templateId'),
    template_version: requireString(templateVersion, 'templateVersion', 80),
    provider: requireIdentifier(provider, 'provider', 80),
    consent_required: consentRequired,
    consent_record_id: normalizedConsent?.id ?? null,
    consent_purpose: normalizedConsent?.purpose ?? null,
    consent_checked_at: normalizedConsent?.checkedAt ?? null,
    payload: normalizedPayload,
    status: 'queued',
    attempt_count: 0,
    next_attempt_at: requireTimestamp(nextAttemptAt, 'nextAttemptAt'),
  });
}
