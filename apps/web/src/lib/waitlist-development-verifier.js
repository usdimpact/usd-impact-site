import { createHash } from 'node:crypto';
import { readSupabaseServerConfig } from './supabase-server.js';
import {
  WAITLIST_CONSENT_PURPOSE,
  WAITLIST_DEVELOPMENT_PROJECT_REF,
  WAITLIST_FORM_VERSION,
  WAITLIST_PRIVACY_NOTICE_VERSION,
  WAITLIST_CONSENT_TEXT_VERSION,
  WAITLIST_CONFIRMATION_TEMPLATE_VERSION,
  createWaitlistReadinessRecords,
} from './waitlist-readiness.js';

const VERIFIED_STATES = new Set(['accepted', 'delivered']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export class WaitlistDevelopmentVerificationError extends Error {
  constructor(message, code = 'WAITLIST_DEVELOPMENT_VERIFICATION_FAILED') {
    super(message);
    this.name = 'WaitlistDevelopmentVerificationError';
    this.code = code;
  }
}

function requireSubmissionId(value) {
  const submissionId = String(value ?? '').trim().toLowerCase();
  if (!UUID_PATTERN.test(submissionId)) {
    throw new WaitlistDevelopmentVerificationError(
      'WAITLIST_TEST_SUBMISSION_ID must be a valid UUID.',
      'INVALID_SUBMISSION_ID',
    );
  }
  return submissionId;
}

function requireExpectedState(value) {
  const state = String(value ?? 'delivered').trim().toLowerCase();
  if (!VERIFIED_STATES.has(state)) {
    throw new WaitlistDevelopmentVerificationError(
      'WAITLIST_EXPECTED_STATE must be accepted or delivered.',
      'INVALID_EXPECTED_STATE',
    );
  }
  return state;
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

function assertDevelopmentTarget(config) {
  const projectRef = projectRefFromUrl(config.url);
  if (projectRef !== WAITLIST_DEVELOPMENT_PROJECT_REF) {
    throw new WaitlistDevelopmentVerificationError(
      'The verifier only permits the canonical Development Supabase project.',
      'UNEXPECTED_SUPABASE_PROJECT',
    );
  }
  return projectRef;
}

function maskEmail(value) {
  const [localPart = '', domain = ''] = String(value).split('@');
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${'*'.repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function providerReferenceFingerprint(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
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

async function serviceGet({ config, path, fetchImpl = fetch }) {
  const response = await fetchImpl(`${config.url}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      apikey: config.secretKey,
      Authorization: `Bearer ${config.secretKey}`,
    },
  });
  const payload = await readJsonSafely(response);
  if (!response.ok) {
    throw new WaitlistDevelopmentVerificationError(
      `Development verification query failed with status ${response.status}.`,
      'DEVELOPMENT_QUERY_FAILED',
    );
  }
  if (!Array.isArray(payload)) {
    throw new WaitlistDevelopmentVerificationError(
      'Development verification query returned an invalid response.',
      'INVALID_DEVELOPMENT_RESPONSE',
    );
  }
  return payload;
}

function requireSingleRow(rows, entity) {
  if (rows.length === 0) {
    throw new WaitlistDevelopmentVerificationError(
      `${entity} was not found for the controlled submission.`,
      entity === 'Consent evidence' ? 'CONSENT_EVIDENCE_MISSING' : 'OUTBOX_EVIDENCE_MISSING',
    );
  }
  if (rows.length > 1) {
    throw new WaitlistDevelopmentVerificationError(
      `${entity} is duplicated for the controlled submission.`,
      entity === 'Consent evidence' ? 'DUPLICATE_CONSENT_EVIDENCE' : 'DUPLICATE_OUTBOX_EVIDENCE',
    );
  }
  return rows[0];
}

function assertConsentEvidence(row, expected) {
  const evidence = row?.evidence;
  const context = evidence?.context;
  const matches = row?.idempotency_key === expected.idempotency_key
    && row?.source_event_id === expected.source_event_id
    && row?.email_normalized === expected.email_normalized
    && row?.purpose === WAITLIST_CONSENT_PURPOSE
    && row?.status === 'granted'
    && row?.consent_text_version === WAITLIST_CONSENT_TEXT_VERSION
    && row?.privacy_notice_version === WAITLIST_PRIVACY_NOTICE_VERSION
    && row?.source === 'waitlist_form'
    && validTimestamp(row?.captured_at)
    && SHA256_PATTERN.test(String(row?.evidence_checksum || ''))
    && evidence?.purpose === WAITLIST_CONSENT_PURPOSE
    && evidence?.status === 'granted'
    && evidence?.consent_text_version === WAITLIST_CONSENT_TEXT_VERSION
    && evidence?.privacy_notice_version === WAITLIST_PRIVACY_NOTICE_VERSION
    && evidence?.source === 'waitlist_form'
    && evidence?.source_event_id === expected.source_event_id
    && validTimestamp(evidence?.captured_at)
    && context?.consentCheckbox === true
    && context?.formVersion === WAITLIST_FORM_VERSION;

  if (!matches) {
    throw new WaitlistDevelopmentVerificationError(
      'Consent evidence does not match the reviewed waitlist contract.',
      'CONSENT_EVIDENCE_MISMATCH',
    );
  }
}

function assertOutboxEvidence(row, expected, expectedState) {
  const identityMatches = row?.idempotency_key === expected.idempotency_key
    && row?.event_id === expected.event_id
    && row?.message_id === 'waitlist_confirmation'
    && row?.classification === 'operational'
    && row?.business_object_type === 'waitlist_submission'
    && row?.business_object_id === expected.business_object_id
    && row?.state_version === 1
    && row?.recipient_email_normalized === expected.recipient_email_normalized
    && row?.template_id === 'waitlist_confirmation'
    && row?.template_version === WAITLIST_CONFIRMATION_TEMPLATE_VERSION
    && row?.provider === 'resend'
    && row?.consent_required === false
    && row?.consent_record_id === null
    && row?.consent_purpose === null
    && row?.consent_checked_at === null
    && row?.payload
    && typeof row.payload === 'object'
    && !Array.isArray(row.payload)
    && Object.keys(row.payload).length === 0
    && Number.isInteger(row?.attempt_count)
    && row.attempt_count >= 1;

  if (!identityMatches) {
    throw new WaitlistDevelopmentVerificationError(
      'Notification outbox evidence does not match the reviewed waitlist contract.',
      'OUTBOX_EVIDENCE_MISMATCH',
    );
  }

  const providerMessageRef = String(row?.provider_message_ref || '').trim();
  if (!providerMessageRef || !validTimestamp(row?.accepted_at)) {
    throw new WaitlistDevelopmentVerificationError(
      'The outbox does not contain an accepted provider correlation.',
      'PROVIDER_CORRELATION_MISSING',
    );
  }

  if (row?.error_code !== null || row?.failed_at !== null) {
    throw new WaitlistDevelopmentVerificationError(
      'The outbox contains an unexpected error or failure timestamp.',
      'OUTBOX_FAILURE_PRESENT',
    );
  }

  if (expectedState === 'accepted') {
    if (row?.status !== 'accepted' && row?.status !== 'delivered') {
      throw new WaitlistDevelopmentVerificationError(
        `The outbox state is ${String(row?.status || 'unknown')}, not accepted or delivered.`,
        'OUTBOX_STATE_NOT_VERIFIED',
      );
    }
  } else if (row?.status !== 'delivered' || !validTimestamp(row?.delivered_at)) {
    throw new WaitlistDevelopmentVerificationError(
      `The outbox state is ${String(row?.status || 'unknown')}, not delivered.`,
      'OUTBOX_STATE_NOT_VERIFIED',
    );
  }

  return providerMessageRef;
}

export async function verifyWaitlistDevelopmentLifecycle({
  email,
  submissionId,
  expectedState = 'delivered',
  environment = process.env,
  fetchImpl = fetch,
}) {
  const normalizedSubmissionId = requireSubmissionId(submissionId);
  const normalizedExpectedState = requireExpectedState(expectedState);

  let config;
  try {
    config = readSupabaseServerConfig(environment, { requireSecret: true });
  } catch (error) {
    throw new WaitlistDevelopmentVerificationError(
      `Supabase verifier configuration is invalid: ${error?.code || 'CONFIGURATION_ERROR'}.`,
      'VERIFIER_CONFIGURATION_ERROR',
    );
  }
  const projectRef = assertDevelopmentTarget(config);
  const records = createWaitlistReadinessRecords({
    email,
    submissionId: normalizedSubmissionId,
    capturedAt: '2000-01-01T00:00:00.000Z',
  });

  const consentSelect = [
    'id',
    'idempotency_key',
    'source_event_id',
    'email_normalized',
    'purpose',
    'status',
    'consent_text_version',
    'privacy_notice_version',
    'source',
    'captured_at',
    'evidence',
    'evidence_checksum',
    'created_at',
  ].join(',');
  const outboxSelect = [
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
    'provider_message_ref',
    'error_code',
    'accepted_at',
    'delivered_at',
    'failed_at',
    'created_at',
    'updated_at',
  ].join(',');

  const [consentRows, outboxRows] = await Promise.all([
    serviceGet({
      config,
      path: `/rest/v1/marketing_consent_events?idempotency_key=eq.${encodeURIComponent(records.consentRecord.idempotency_key)}&select=${consentSelect}&limit=2`,
      fetchImpl,
    }),
    serviceGet({
      config,
      path: `/rest/v1/notification_outbox?idempotency_key=eq.${encodeURIComponent(records.outboxRecord.idempotency_key)}&select=${outboxSelect}&limit=2`,
      fetchImpl,
    }),
  ]);

  const consent = requireSingleRow(consentRows, 'Consent evidence');
  const outbox = requireSingleRow(outboxRows, 'Outbox evidence');
  assertConsentEvidence(consent, records.consentRecord);
  const providerMessageRef = assertOutboxEvidence(
    outbox,
    records.outboxRecord,
    normalizedExpectedState,
  );

  return Object.freeze({
    verified: true,
    projectRef,
    submissionId: normalizedSubmissionId,
    email: maskEmail(records.email),
    expectedState: normalizedExpectedState,
    observedState: outbox.status,
    consent: Object.freeze({
      status: consent.status,
      purpose: consent.purpose,
      capturedAt: consent.captured_at,
      consentTextVersion: consent.consent_text_version,
      privacyNoticeVersion: consent.privacy_notice_version,
    }),
    delivery: Object.freeze({
      status: outbox.status,
      attemptCount: outbox.attempt_count,
      providerReferenceFingerprint: providerReferenceFingerprint(providerMessageRef),
      acceptedAt: outbox.accepted_at,
      deliveredAt: outbox.delivered_at,
    }),
  });
}
