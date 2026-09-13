import {
  createConsentEventRecord,
  createNotificationIdempotencyKey,
  normalizeEmail,
} from './email-readiness-contracts.js';
import {
  MARKETING_OPT_IN_DEFAULT_TTL_SECONDS,
  MARKETING_OPT_IN_PURPOSES,
  createMarketingOptInToken,
  verifyMarketingOptInToken,
} from './marketing-opt-in-token.js';
import { readSupabaseServerConfig } from './supabase-server.js';

export const MARKETING_OPT_IN_DEVELOPMENT_PROJECT_REF = 'ycstrcvshdluovtuasjc';
export const MARKETING_OPT_IN_PRODUCTION_PROJECT_REF = 'gjzetjugmnwanvjkchux';
export const MARKETING_OPT_IN_MESSAGE_ID = 'marketing_opt_in_confirmation';
export const MARKETING_OPT_IN_TEMPLATE_ID = 'marketing_opt_in_confirmation';
export const MARKETING_OPT_IN_TEMPLATE_VERSION = 'marketing-opt-in-confirmation-v1';
export const MARKETING_OPT_IN_FORM_VERSION = 'email-opt-in-v1';
export const MARKETING_OPT_IN_PRIVACY_NOTICE_VERSION = 'privacy-2026-08-31';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PURPOSE_SET = new Set(MARKETING_OPT_IN_PURPOSES);
const CONFIRMABLE_OUTBOX_STATUSES = new Set([
  'queued',
  'sending',
  'accepted',
  'delivered',
  'retry_scheduled',
]);
const MAX_CONSENT_EVENTS = 100;

const PURPOSE_CONFIG = Object.freeze({
  weekly_newsletter: Object.freeze({
    consentTextVersion: 'weekly-newsletter-v1',
    requiresAccount: false,
  }),
  learning_progress_updates: Object.freeze({
    consentTextVersion: 'learning-progress-updates-v1',
    requiresAccount: true,
  }),
});

export class MarketingOptInReadinessError extends Error {
  constructor(message, code = 'MARKETING_OPT_IN_FAILED', status = 400) {
    super(message);
    this.name = 'MarketingOptInReadinessError';
    this.code = code;
    this.status = status;
  }
}

function requireRequestId(value) {
  const requestId = String(value ?? '').trim().toLowerCase();
  if (!UUID_PATTERN.test(requestId)) {
    throw new MarketingOptInReadinessError(
      'A valid opt-in request identifier is required.',
      'INVALID_OPT_IN_REQUEST_ID',
      400,
    );
  }
  return requestId;
}

function requirePurpose(value) {
  const purpose = String(value ?? '').trim().toLowerCase();
  if (!PURPOSE_SET.has(purpose)) {
    throw new MarketingOptInReadinessError(
      'The requested email purpose is not approved.',
      'INVALID_OPT_IN_PURPOSE',
      400,
    );
  }
  return purpose;
}

function optionalUserId(value) {
  if (value == null || value === '') return null;
  const userId = String(value).trim().toLowerCase();
  if (!UUID_PATTERN.test(userId)) {
    throw new MarketingOptInReadinessError('Account identity is invalid.', 'INVALID_ACCOUNT_ID', 400);
  }
  return userId;
}

function requireTimestamp(value, fieldName) {
  const parsed = Date.parse(String(value ?? ''));
  if (!Number.isFinite(parsed)) {
    throw new MarketingOptInReadinessError(`${fieldName} is invalid.`, 'INVALID_OPT_IN_TIMESTAMP', 400);
  }
  return new Date(parsed).toISOString();
}

function projectRefFromUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const suffix = '.supabase.co';
    if (!hostname.endsWith(suffix)) return null;
    return hostname.slice(0, -suffix.length) || null;
  } catch {
    return null;
  }
}

function assertExpectedProject(config, environment) {
  const projectRef = projectRefFromUrl(config.url);
  const vercelEnvironment = String(environment.VERCEL_ENV || '').trim().toLowerCase();

  if (vercelEnvironment === 'production') {
    if (environment.EMAIL_OPT_IN_PRODUCTION_APPROVED !== 'true') {
      throw new MarketingOptInReadinessError(
        'Production email opt-in writes are not approved.',
        'PRODUCTION_OPT_IN_NOT_APPROVED',
        503,
      );
    }
    if (projectRef !== MARKETING_OPT_IN_PRODUCTION_PROJECT_REF) {
      throw new MarketingOptInReadinessError(
        'Production email opt-in target is not canonical.',
        'UNEXPECTED_SUPABASE_PROJECT',
        503,
      );
    }
    return projectRef;
  }

  if (projectRef !== MARKETING_OPT_IN_DEVELOPMENT_PROJECT_REF) {
    throw new MarketingOptInReadinessError(
      'Non-production email opt-in writes must target Development.',
      'UNEXPECTED_SUPABASE_PROJECT',
      503,
    );
  }
  return projectRef;
}

function readConfig(environment) {
  if (environment.EMAIL_READINESS_LEDGER_ENABLED !== 'true') {
    throw new MarketingOptInReadinessError(
      'The email consent ledger is not enabled.',
      'EMAIL_LEDGER_DISABLED',
      503,
    );
  }

  let config;
  try {
    config = readSupabaseServerConfig(environment, { requireSecret: true });
  } catch {
    throw new MarketingOptInReadinessError(
      'Email consent database configuration is unavailable.',
      'EMAIL_OPT_IN_DATABASE_CONFIGURATION_ERROR',
      503,
    );
  }
  assertExpectedProject(config, environment);
  return config;
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function serviceRequest({ config, path, method = 'GET', body, prefer, fetchImpl = fetch }) {
  const response = await fetchImpl(`${config.url}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: config.secretKey,
      Authorization: `Bearer ${config.secretKey}`,
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await readJsonSafely(response);
  if (!response.ok) {
    throw new MarketingOptInReadinessError(
      `Email opt-in database request failed with status ${response.status}.`,
      'EMAIL_OPT_IN_DATABASE_REQUEST_FAILED',
      503,
    );
  }
  return payload;
}

function activeGrantFromEvents(events) {
  const withdrawals = new Set(
    events
      .filter((event) => event.status === 'withdrawn' && event.related_grant_id)
      .map((event) => event.related_grant_id),
  );
  return events.find((event) => event.status === 'granted' && !withdrawals.has(event.id)) || null;
}

async function loadRecipientEvents({ config, email, purpose, fetchImpl }) {
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/marketing_consent_events?email_normalized=eq.${encodeURIComponent(normalizeEmail(email))}&purpose=eq.${encodeURIComponent(purpose)}&select=id,idempotency_key,email_normalized,user_id,purpose,status,consent_text_version,privacy_notice_version,provider_contact_ref,captured_at,related_grant_id,withdrawn_at,created_at&order=captured_at.desc&limit=${MAX_CONSENT_EVENTS}`,
    fetchImpl,
  });
  if (!Array.isArray(rows)) {
    throw new MarketingOptInReadinessError(
      'Consent lookup returned an invalid response.',
      'INVALID_CONSENT_RESPONSE',
      503,
    );
  }
  return rows;
}

function normalizeRequestIdentity({ email, requestId, purpose, userId = null, locale = 'en' }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedRequestId = requireRequestId(requestId);
  const normalizedPurpose = requirePurpose(purpose);
  const normalizedUserId = optionalUserId(userId);
  if (locale !== 'en') {
    throw new MarketingOptInReadinessError(
      'Only the approved English email preference flow is enabled.',
      'UNAPPROVED_OPT_IN_LOCALE',
      400,
    );
  }
  if (PURPOSE_CONFIG[normalizedPurpose].requiresAccount && !normalizedUserId) {
    throw new MarketingOptInReadinessError(
      'Learning progress updates require a verified account.',
      'VERIFIED_ACCOUNT_REQUIRED',
      401,
    );
  }
  return Object.freeze({
    email: normalizedEmail,
    requestId: normalizedRequestId,
    purpose: normalizedPurpose,
    userId: normalizedUserId,
    locale,
  });
}

export function createMarketingOptInOutboxRecord({
  email,
  requestId,
  purpose,
  userId = null,
  locale = 'en',
  requestedAt,
}) {
  const identity = normalizeRequestIdentity({ email, requestId, purpose, userId, locale });
  const normalizedRequestedAt = requireTimestamp(requestedAt, 'requestedAt');
  const issuedAt = Math.floor(Date.parse(normalizedRequestedAt) / 1000);
  const businessObjectType = 'marketing_opt_in_request';
  const payload = {
    purpose: identity.purpose,
    issuedAt,
    locale: identity.locale,
    ...(identity.userId ? { userId: identity.userId } : {}),
  };

  return Object.freeze({
    idempotency_key: createNotificationIdempotencyKey({
      messageId: MARKETING_OPT_IN_MESSAGE_ID,
      businessObjectType,
      businessObjectId: identity.requestId,
      stateVersion: 1,
      recipientEmail: identity.email,
    }),
    event_id: `marketing.opt_in.request:${identity.requestId}:${identity.purpose}`,
    message_id: MARKETING_OPT_IN_MESSAGE_ID,
    classification: 'operational',
    business_object_type: businessObjectType,
    business_object_id: identity.requestId,
    state_version: 1,
    recipient_email_normalized: identity.email,
    template_id: MARKETING_OPT_IN_TEMPLATE_ID,
    template_version: MARKETING_OPT_IN_TEMPLATE_VERSION,
    provider: 'resend',
    consent_required: false,
    consent_record_id: null,
    consent_purpose: null,
    consent_checked_at: null,
    payload,
    status: 'queued',
    attempt_count: 0,
    next_attempt_at: normalizedRequestedAt,
  });
}

function assertSameOutbox(existing, expected) {
  const same = existing
    && existing.idempotency_key === expected.idempotency_key
    && existing.message_id === expected.message_id
    && existing.business_object_type === expected.business_object_type
    && existing.business_object_id === expected.business_object_id
    && existing.recipient_email_normalized === expected.recipient_email_normalized
    && existing.template_id === expected.template_id
    && existing.template_version === expected.template_version
    && existing.classification === 'operational'
    && existing.consent_required === false
    && existing.consent_record_id == null
    && existing.consent_purpose == null
    && existing.consent_checked_at == null
    && existing.payload?.purpose === expected.payload.purpose
    && existing.payload?.issuedAt === expected.payload.issuedAt
    && existing.payload?.locale === expected.payload.locale
    && (existing.payload?.userId ?? null) === (expected.payload.userId ?? null);
  if (!same) {
    throw new MarketingOptInReadinessError(
      'Opt-in request identity conflicts with existing state.',
      'OPT_IN_REQUEST_CONFLICT',
      409,
    );
  }
  return existing;
}

async function insertOrLoadOutbox({ config, record, fetchImpl }) {
  const { status: _status, attempt_count: _attemptCount, ...insertable } = record;
  const inserted = await serviceRequest({
    config,
    path: '/rest/v1/notification_outbox?on_conflict=idempotency_key',
    method: 'POST',
    body: insertable,
    prefer: 'resolution=ignore-duplicates,return=representation',
    fetchImpl,
  });
  if (Array.isArray(inserted) && inserted.length === 1) {
    return Object.freeze({ created: true, outbox: Object.freeze({ ...inserted[0] }) });
  }

  const rows = await serviceRequest({
    config,
    path: `/rest/v1/notification_outbox?idempotency_key=eq.${encodeURIComponent(record.idempotency_key)}&select=id,idempotency_key,message_id,classification,business_object_type,business_object_id,state_version,recipient_email_normalized,template_id,template_version,provider,consent_required,consent_record_id,consent_purpose,consent_checked_at,payload,status,attempt_count,next_attempt_at,provider_message_ref,created_at&limit=2`,
    fetchImpl,
  });
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new MarketingOptInReadinessError(
      'Opt-in request could not be loaded after an idempotency conflict.',
      'OPT_IN_REQUEST_MISSING',
      503,
    );
  }
  assertSameOutbox(rows[0], record);
  return Object.freeze({ created: false, outbox: Object.freeze({ ...rows[0] }) });
}

export async function prepareMarketingOptInRequest({
  email,
  requestId,
  purpose,
  userId = null,
  locale = 'en',
  requestedAt = new Date().toISOString(),
  environment = process.env,
  fetchImpl = fetch,
}) {
  const identity = normalizeRequestIdentity({ email, requestId, purpose, userId, locale });
  const config = readConfig(environment);
  const events = await loadRecipientEvents({
    config,
    email: identity.email,
    purpose: identity.purpose,
    fetchImpl,
  });
  const existingGrant = activeGrantFromEvents(events);
  if (existingGrant) {
    if (
      PURPOSE_CONFIG[identity.purpose].requiresAccount
      && existingGrant.user_id
      && existingGrant.user_id !== identity.userId
    ) {
      throw new MarketingOptInReadinessError(
        'Existing consent is bound to a different account.',
        'CONSENT_ACCOUNT_CONFLICT',
        409,
      );
    }
    return Object.freeze({
      created: false,
      action: 'already_subscribed',
      grant: Object.freeze({ ...existingGrant }),
      outbox: null,
    });
  }

  const record = createMarketingOptInOutboxRecord({
    ...identity,
    requestedAt,
  });
  const result = await insertOrLoadOutbox({ config, record, fetchImpl });
  return Object.freeze({
    ...result,
    action: result.created ? 'confirmation_queued' : 'confirmation_already_queued',
  });
}

function validatePendingOutbox(row, verified) {
  if (!row || typeof row !== 'object') {
    throw new MarketingOptInReadinessError('Opt-in request was not found.', 'OPT_IN_REQUEST_NOT_FOUND', 400);
  }
  if (
    row.message_id !== MARKETING_OPT_IN_MESSAGE_ID
    || row.template_id !== MARKETING_OPT_IN_TEMPLATE_ID
    || row.business_object_type !== 'marketing_opt_in_request'
    || row.business_object_id !== verified.requestId
    || row.classification !== 'operational'
    || row.consent_required !== false
    || row.consent_record_id != null
    || row.consent_purpose != null
    || row.consent_checked_at != null
    || row.payload?.purpose !== verified.purpose
    || row.payload?.locale !== 'en'
    || !Number.isSafeInteger(row.payload?.issuedAt)
  ) {
    throw new MarketingOptInReadinessError(
      'Opt-in request evidence is invalid.',
      'INVALID_OPT_IN_REQUEST_EVIDENCE',
      503,
    );
  }
  if (!CONFIRMABLE_OUTBOX_STATUSES.has(row.status)) {
    throw new MarketingOptInReadinessError(
      'Opt-in request is no longer confirmable.',
      'OPT_IN_REQUEST_NOT_CONFIRMABLE',
      410,
    );
  }
  const expectedExpiresAt = row.payload.issuedAt + MARKETING_OPT_IN_DEFAULT_TTL_SECONDS;
  const verifiedExpiresAt = Math.floor(Date.parse(verified.expiresAt) / 1000);
  if (verifiedExpiresAt !== expectedExpiresAt) {
    throw new MarketingOptInReadinessError(
      'Opt-in request expiry does not match durable evidence.',
      'OPT_IN_EXPIRY_MISMATCH',
      400,
    );
  }
  const userId = optionalUserId(row.payload.userId);
  if (PURPOSE_CONFIG[verified.purpose].requiresAccount && !userId) {
    throw new MarketingOptInReadinessError(
      'Learning progress opt-in is missing its account binding.',
      'OPT_IN_ACCOUNT_BINDING_MISSING',
      503,
    );
  }
  return Object.freeze({ ...row, userId });
}

async function loadPendingRequest({ config, requestId, fetchImpl }) {
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/notification_outbox?message_id=eq.${MARKETING_OPT_IN_MESSAGE_ID}&business_object_type=eq.marketing_opt_in_request&business_object_id=eq.${encodeURIComponent(requestId)}&select=id,idempotency_key,message_id,classification,business_object_type,business_object_id,state_version,recipient_email_normalized,template_id,template_version,provider,consent_required,consent_record_id,consent_purpose,consent_checked_at,payload,status,attempt_count,provider_message_ref,created_at&limit=2`,
    fetchImpl,
  });
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new MarketingOptInReadinessError('Opt-in request was not found.', 'OPT_IN_REQUEST_NOT_FOUND', 400);
  }
  return rows[0];
}

function consentRecordForConfirmation({ pending, verified, confirmedAt }) {
  const purposeConfig = PURPOSE_CONFIG[verified.purpose];
  return createConsentEventRecord({
    sourceEventId: `marketing.opt_in.confirm:${verified.requestId}:${verified.purpose}`,
    email: pending.recipient_email_normalized,
    userId: pending.userId,
    purpose: verified.purpose,
    status: 'granted',
    consentTextVersion: purposeConfig.consentTextVersion,
    privacyNoticeVersion: MARKETING_OPT_IN_PRIVACY_NOTICE_VERSION,
    source: 'email_double_opt_in',
    capturedAt: confirmedAt,
    evidenceContext: {
      consentCheckbox: true,
      formVersion: MARKETING_OPT_IN_FORM_VERSION,
      request: { locale: pending.payload.locale },
    },
  });
}

async function insertOrLoadGrant({ config, record, fetchImpl }) {
  const inserted = await serviceRequest({
    config,
    path: '/rest/v1/marketing_consent_events?on_conflict=idempotency_key',
    method: 'POST',
    body: record,
    prefer: 'resolution=ignore-duplicates,return=representation',
    fetchImpl,
  });
  if (Array.isArray(inserted) && inserted.length === 1) {
    return Object.freeze({ created: true, grant: Object.freeze({ ...inserted[0] }) });
  }

  const rows = await serviceRequest({
    config,
    path: `/rest/v1/marketing_consent_events?idempotency_key=eq.${encodeURIComponent(record.idempotency_key)}&select=id,idempotency_key,email_normalized,user_id,purpose,status,consent_text_version,privacy_notice_version,provider_contact_ref,captured_at,related_grant_id,withdrawn_at&limit=2`,
    fetchImpl,
  });
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new MarketingOptInReadinessError(
      'Confirmed consent could not be loaded after an idempotency conflict.',
      'CONFIRMED_CONSENT_MISSING',
      503,
    );
  }
  const existing = rows[0];
  if (
    existing.email_normalized !== record.email_normalized
    || existing.user_id !== record.user_id
    || existing.purpose !== record.purpose
    || existing.status !== 'granted'
    || existing.consent_text_version !== record.consent_text_version
    || existing.privacy_notice_version !== record.privacy_notice_version
  ) {
    throw new MarketingOptInReadinessError(
      'Confirmed consent conflicts with existing evidence.',
      'CONFIRMED_CONSENT_CONFLICT',
      409,
    );
  }
  return Object.freeze({ created: false, grant: Object.freeze({ ...existing }) });
}

export function createMarketingOptInTokenForOutbox({ outbox, secret }) {
  if (!outbox?.business_object_id || !outbox?.payload?.purpose || !Number.isSafeInteger(outbox?.payload?.issuedAt)) {
    throw new MarketingOptInReadinessError(
      'Opt-in outbox evidence cannot produce a confirmation token.',
      'INVALID_OPT_IN_REQUEST_EVIDENCE',
      500,
    );
  }
  return createMarketingOptInToken({
    requestId: outbox.business_object_id,
    purpose: outbox.payload.purpose,
    secret,
    issuedAt: outbox.payload.issuedAt,
    ttlSeconds: MARKETING_OPT_IN_DEFAULT_TTL_SECONDS,
  });
}

export async function confirmMarketingOptIn({
  token,
  confirmedAt = new Date().toISOString(),
  environment = process.env,
  fetchImpl = fetch,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  const verified = verifyMarketingOptInToken({
    token,
    secret: environment.MARKETING_OPT_IN_SECRET,
    now: nowSeconds,
  });
  const normalizedConfirmedAt = requireTimestamp(confirmedAt, 'confirmedAt');
  const config = readConfig(environment);
  const pendingRow = await loadPendingRequest({
    config,
    requestId: verified.requestId,
    fetchImpl,
  });
  const pending = validatePendingOutbox(pendingRow, verified);

  const events = await loadRecipientEvents({
    config,
    email: pending.recipient_email_normalized,
    purpose: verified.purpose,
    fetchImpl,
  });
  const activeGrant = activeGrantFromEvents(events);
  if (activeGrant) {
    if (
      PURPOSE_CONFIG[verified.purpose].requiresAccount
      && activeGrant.user_id !== pending.userId
    ) {
      throw new MarketingOptInReadinessError(
        'Confirmed consent is bound to a different account.',
        'CONSENT_ACCOUNT_CONFLICT',
        409,
      );
    }
    return Object.freeze({ created: false, grant: Object.freeze({ ...activeGrant }) });
  }

  const record = consentRecordForConfirmation({ pending, verified, confirmedAt: normalizedConfirmedAt });
  return insertOrLoadGrant({ config, record, fetchImpl });
}
