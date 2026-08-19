import {
  buildNotificationOutboxRecord,
  createConsentEventRecord,
  normalizeEmail,
} from './email-readiness-contracts.js';
import { readSupabaseServerConfig } from './supabase-server.js';

export const WAITLIST_DEVELOPMENT_PROJECT_REF = 'ycstrcvshdluovtuasjc';
export const WAITLIST_PRODUCTION_PROJECT_REF = 'gjzetjugmnwanvjkchux';
export const WAITLIST_CONSENT_PURPOSE = 'book_availability';
export const WAITLIST_CONSENT_TEXT_VERSION = 'waitlist-purchase-link-v1';
export const WAITLIST_PRIVACY_NOTICE_VERSION = 'privacy-2026-08-18';
export const WAITLIST_FORM_VERSION = 'waitlist-v1';
export const WAITLIST_CONFIRMATION_TEMPLATE_VERSION = 'waitlist-confirmation-v1';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESEND_IDEMPOTENCY_PREFIX = 'waitlist-confirmation/';
const RESEND_IDEMPOTENCY_MAX_LENGTH = 256;
const RESEND_RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const COMPLETE_STATUSES = new Set(['accepted', 'delivered']);
const BLOCKED_STATUSES = new Set([
  'soft_bounced',
  'hard_bounced',
  'complained',
  'suppressed',
  'terminal_failed',
  'cancelled',
]);

export class WaitlistReadinessError extends Error {
  constructor(message, code = 'WAITLIST_READINESS_FAILED') {
    super(message);
    this.name = 'WaitlistReadinessError';
    this.code = code;
  }
}

function requireSubmissionId(value) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw new WaitlistReadinessError('A valid waitlist submission identifier is required.', 'INVALID_SUBMISSION_ID');
  }
  return value.trim().toLowerCase();
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
  const actualRef = projectRefFromUrl(config.url);
  const vercelEnvironment = String(environment.VERCEL_ENV || '').trim().toLowerCase();

  if (vercelEnvironment === 'production') {
    if (environment.EMAIL_READINESS_PRODUCTION_APPROVED !== 'true') {
      throw new WaitlistReadinessError(
        'Production waitlist readiness writes are not approved.',
        'PRODUCTION_LEDGER_NOT_APPROVED',
      );
    }
    if (actualRef !== WAITLIST_PRODUCTION_PROJECT_REF) {
      throw new WaitlistReadinessError(
        'Production waitlist readiness target does not match the canonical Production project.',
        'UNEXPECTED_SUPABASE_PROJECT',
      );
    }
    return actualRef;
  }

  if (actualRef !== WAITLIST_DEVELOPMENT_PROJECT_REF) {
    throw new WaitlistReadinessError(
      'Non-production waitlist readiness writes must target the canonical Development project.',
      'UNEXPECTED_SUPABASE_PROJECT',
    );
  }
  return actualRef;
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
    throw new WaitlistReadinessError(
      `Supabase waitlist readiness request failed with status ${response.status}.`,
      'WAITLIST_LEDGER_REQUEST_FAILED',
    );
  }
  return payload;
}

async function insertOrLoadConsent({ config, record, fetchImpl }) {
  const inserted = await serviceRequest({
    config,
    path: '/rest/v1/marketing_consent_events?on_conflict=idempotency_key',
    method: 'POST',
    body: record,
    prefer: 'resolution=ignore-duplicates,return=representation',
    fetchImpl,
  });

  if (Array.isArray(inserted) && inserted.length === 1) return inserted[0];

  const rows = await serviceRequest({
    config,
    path: `/rest/v1/marketing_consent_events?idempotency_key=eq.${encodeURIComponent(record.idempotency_key)}&select=id,idempotency_key,email_normalized,purpose,status,captured_at&limit=1`,
    fetchImpl,
  });
  const existing = Array.isArray(rows) ? rows[0] : null;
  if (!existing) {
    throw new WaitlistReadinessError('Consent event could not be loaded after an idempotency conflict.', 'CONSENT_EVENT_MISSING');
  }
  if (
    existing.idempotency_key !== record.idempotency_key
    || existing.email_normalized !== record.email_normalized
    || existing.purpose !== record.purpose
    || existing.status !== 'granted'
  ) {
    throw new WaitlistReadinessError('Consent event identity conflicts with existing evidence.', 'CONSENT_EVENT_CONFLICT');
  }
  return existing;
}

async function insertOrLoadOutbox({ config, record, fetchImpl }) {
  const {
    status: _status,
    attempt_count: _attemptCount,
    ...insertable
  } = record;
  const inserted = await serviceRequest({
    config,
    path: '/rest/v1/notification_outbox?on_conflict=idempotency_key',
    method: 'POST',
    body: insertable,
    prefer: 'resolution=ignore-duplicates,return=representation',
    fetchImpl,
  });

  if (Array.isArray(inserted) && inserted.length === 1) return inserted[0];

  const rows = await serviceRequest({
    config,
    path: `/rest/v1/notification_outbox?idempotency_key=eq.${encodeURIComponent(record.idempotency_key)}&select=id,idempotency_key,message_id,recipient_email_normalized,status,attempt_count,next_attempt_at,provider_message_ref,error_code,accepted_at,created_at&limit=1`,
    fetchImpl,
  });
  const existing = Array.isArray(rows) ? rows[0] : null;
  if (!existing) {
    throw new WaitlistReadinessError('Notification outbox row could not be loaded after an idempotency conflict.', 'OUTBOX_EVENT_MISSING');
  }
  if (
    existing.idempotency_key !== record.idempotency_key
    || existing.message_id !== record.message_id
    || existing.recipient_email_normalized !== record.recipient_email_normalized
  ) {
    throw new WaitlistReadinessError('Notification outbox identity conflicts with existing state.', 'OUTBOX_EVENT_CONFLICT');
  }
  return existing;
}

function timestampMs(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function withinProviderIdempotencyWindow(outbox, nowMs) {
  const createdAt = timestampMs(outbox?.created_at);
  if (createdAt === null) return false;
  const age = nowMs - createdAt;
  return age >= -CLOCK_SKEW_MS && age <= RESEND_RETRY_WINDOW_MS;
}

function hasAcceptedProviderState(outbox) {
  return typeof outbox?.provider_message_ref === 'string'
    && outbox.provider_message_ref.trim().length > 0
    && timestampMs(outbox.accepted_at) !== null;
}

export function resolveWaitlistOutboxDecision(outbox, nowMs = Date.now()) {
  if (!outbox || typeof outbox !== 'object') {
    return Object.freeze({ action: 'reconcile', reason: 'missing-outbox' });
  }

  const status = String(outbox.status || '');
  if (COMPLETE_STATUSES.has(status)) {
    return hasAcceptedProviderState(outbox)
      ? Object.freeze({ action: 'complete', reason: status })
      : Object.freeze({ action: 'reconcile', reason: 'incomplete-provider-state' });
  }

  if (BLOCKED_STATUSES.has(status)) {
    return Object.freeze({ action: 'blocked', reason: status });
  }

  if (status === 'queued') {
    const attempts = Number.isInteger(outbox.attempt_count) ? outbox.attempt_count : 0;
    return attempts === 0
      ? Object.freeze({ action: 'send', reason: 'queued' })
      : Object.freeze({ action: 'reconcile', reason: 'queued-after-attempt' });
  }

  if (status === 'sending') {
    if (hasAcceptedProviderState(outbox)) {
      return Object.freeze({ action: 'complete', reason: 'accepted-provider-state' });
    }
    return withinProviderIdempotencyWindow(outbox, nowMs)
      ? Object.freeze({ action: 'send', reason: 'idempotent-sending-retry' })
      : Object.freeze({ action: 'reconcile', reason: 'expired-sending-window' });
  }

  if (status === 'retry_scheduled') {
    if (hasAcceptedProviderState(outbox)) {
      return Object.freeze({ action: 'complete', reason: 'accepted-provider-state' });
    }
    const nextAttemptAt = timestampMs(outbox.next_attempt_at);
    if (nextAttemptAt === null) {
      return Object.freeze({ action: 'reconcile', reason: 'invalid-next-attempt' });
    }
    if (nextAttemptAt > nowMs) {
      return Object.freeze({ action: 'wait', reason: 'retry-not-due' });
    }
    return withinProviderIdempotencyWindow(outbox, nowMs)
      ? Object.freeze({ action: 'send', reason: 'idempotent-scheduled-retry' })
      : Object.freeze({ action: 'reconcile', reason: 'expired-retry-window' });
  }

  return Object.freeze({ action: 'reconcile', reason: 'unknown-status' });
}

function resendIdempotencyKey(submissionId) {
  const key = `${RESEND_IDEMPOTENCY_PREFIX}${submissionId}`;
  if (key.length > RESEND_IDEMPOTENCY_MAX_LENGTH) {
    throw new WaitlistReadinessError('Provider idempotency key is too long.', 'INVALID_PROVIDER_IDEMPOTENCY_KEY');
  }
  return key;
}

export function waitlistReadinessEnabled(environment = process.env) {
  return environment.EMAIL_READINESS_LEDGER_ENABLED === 'true';
}

export function createWaitlistReadinessRecords({ email, submissionId, capturedAt }) {
  const normalizedSubmissionId = requireSubmissionId(submissionId);
  const normalizedEmail = normalizeEmail(email);
  const sourceEventId = `waitlist.submit:${normalizedSubmissionId}`;

  const consentRecord = createConsentEventRecord({
    sourceEventId,
    email: normalizedEmail,
    purpose: WAITLIST_CONSENT_PURPOSE,
    status: 'granted',
    consentTextVersion: WAITLIST_CONSENT_TEXT_VERSION,
    privacyNoticeVersion: WAITLIST_PRIVACY_NOTICE_VERSION,
    source: 'waitlist_form',
    capturedAt,
    evidenceContext: {
      consentCheckbox: true,
      formVersion: WAITLIST_FORM_VERSION,
    },
  });

  const outboxRecord = buildNotificationOutboxRecord({
    eventId: `waitlist.confirm:${normalizedSubmissionId}`,
    messageId: 'waitlist_confirmation',
    classification: 'operational',
    businessObjectType: 'waitlist_submission',
    businessObjectId: normalizedSubmissionId,
    stateVersion: 1,
    recipientEmail: normalizedEmail,
    templateId: 'waitlist_confirmation',
    templateVersion: WAITLIST_CONFIRMATION_TEMPLATE_VERSION,
    provider: 'resend',
    payload: {},
    nextAttemptAt: capturedAt,
  });

  return Object.freeze({
    submissionId: normalizedSubmissionId,
    email: normalizedEmail,
    consentRecord,
    outboxRecord,
    providerIdempotencyKey: resendIdempotencyKey(normalizedSubmissionId),
  });
}

export async function prepareWaitlistReadiness({
  email,
  submissionId,
  capturedAt = new Date().toISOString(),
  environment = process.env,
  fetchImpl = fetch,
  nowMs = Date.now(),
}) {
  if (!waitlistReadinessEnabled(environment)) {
    return Object.freeze({ enabled: false });
  }

  let config;
  try {
    config = readSupabaseServerConfig(environment, { requireSecret: true });
  } catch (error) {
    throw new WaitlistReadinessError(
      `Waitlist readiness database configuration is invalid: ${error?.code || 'CONFIGURATION_ERROR'}.`,
      'WAITLIST_LEDGER_CONFIGURATION_ERROR',
    );
  }
  const projectRef = assertExpectedProject(config, environment);
  const records = createWaitlistReadinessRecords({ email, submissionId, capturedAt });
  const consent = await insertOrLoadConsent({ config, record: records.consentRecord, fetchImpl });
  const outbox = await insertOrLoadOutbox({ config, record: records.outboxRecord, fetchImpl });
  const decision = resolveWaitlistOutboxDecision(outbox, nowMs);

  return Object.freeze({
    enabled: true,
    config,
    projectRef,
    submissionId: records.submissionId,
    email: records.email,
    consentId: consent.id,
    outbox,
    providerIdempotencyKey: records.providerIdempotencyKey,
    decision,
    shouldSend: decision.action === 'send',
  });
}

async function patchOutbox({ state, body, fetchImpl = fetch }) {
  if (!state?.enabled || !state?.config || !state?.outbox?.id) return null;
  const rows = await serviceRequest({
    config: state.config,
    path: `/rest/v1/notification_outbox?id=eq.${encodeURIComponent(state.outbox.id)}`,
    method: 'PATCH',
    body,
    prefer: 'return=representation',
    fetchImpl,
  });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function markWaitlistOutboxSending({ state, attemptedAt = new Date().toISOString(), fetchImpl = fetch }) {
  if (!state?.enabled) return null;
  const currentAttempts = Number.isInteger(state.outbox?.attempt_count) ? state.outbox.attempt_count : 0;
  return patchOutbox({
    state,
    body: {
      status: 'sending',
      attempt_count: currentAttempts + 1,
      next_attempt_at: attemptedAt,
      error_code: null,
    },
    fetchImpl,
  });
}

export async function markWaitlistOutboxAccepted({
  state,
  providerMessageRef,
  acceptedAt = new Date().toISOString(),
  fetchImpl = fetch,
}) {
  if (!state?.enabled) return null;
  if (typeof providerMessageRef !== 'string' || providerMessageRef.trim().length === 0 || providerMessageRef.length > 255) {
    throw new WaitlistReadinessError('Provider message reference is missing or invalid.', 'INVALID_PROVIDER_MESSAGE_REF');
  }
  return patchOutbox({
    state,
    body: {
      status: 'accepted',
      provider_message_ref: providerMessageRef.trim(),
      accepted_at: acceptedAt,
      error_code: null,
    },
    fetchImpl,
  });
}

export async function markWaitlistOutboxRetry({
  state,
  retryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  errorCode = 'RESEND_SEND_FAILED',
  fetchImpl = fetch,
}) {
  if (!state?.enabled) return null;
  if (!/^[A-Z][A-Z0-9_]{1,79}$/.test(errorCode)) {
    throw new WaitlistReadinessError('Retry error code is invalid.', 'INVALID_RETRY_ERROR_CODE');
  }
  return patchOutbox({
    state,
    body: {
      status: 'retry_scheduled',
      next_attempt_at: retryAt,
      error_code: errorCode,
    },
    fetchImpl,
  });
}
