import { createHash } from 'node:crypto';
import { createNotificationIdempotencyKey, normalizeEmail } from './email-readiness-contracts.js';
import {
  PROGRESS_EMAIL_CONSENT_PURPOSE,
  PROGRESS_EMAIL_MESSAGE_ID,
  PROGRESS_EMAIL_TEMPLATE_VERSION,
} from './progress-email-contract.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COHORTS = new Set(['inactive_7d', 'inactive_14d', 'inactive_30d']);
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/;

export const PROGRESS_EMAIL_OUTBOX_TEMPLATE_ID = 'learning_progress_email';
export const PROGRESS_EMAIL_OUTBOX_STATE_VERSION = 1;

export class ProgressEmailOutboxIntentError extends Error {
  constructor(message, code = 'PROGRESS_EMAIL_OUTBOX_INTENT_INVALID') {
    super(message);
    this.name = 'ProgressEmailOutboxIntentError';
    this.code = code;
  }
}

function requireTimestamp(value, field) {
  const parsed = Date.parse(String(value ?? ''));
  if (!Number.isFinite(parsed)) {
    throw new ProgressEmailOutboxIntentError(`${field} must be a valid timestamp.`);
  }
  return new Date(parsed).toISOString();
}

function requireAccountId(value) {
  const accountId = String(value ?? '').trim().toLowerCase();
  if (!UUID_PATTERN.test(accountId)) {
    throw new ProgressEmailOutboxIntentError('accountId must be a valid UUID.');
  }
  return accountId;
}

function requireConsentGrant(grant, accountId, email) {
  if (
    !grant
    || typeof grant !== 'object'
    || !UUID_PATTERN.test(String(grant.id ?? ''))
    || grant.status !== 'granted'
    || grant.purpose !== PROGRESS_EMAIL_CONSENT_PURPOSE
    || normalizeEmail(grant.email_normalized) !== email
    || String(grant.user_id ?? '').toLowerCase() !== accountId
  ) {
    throw new ProgressEmailOutboxIntentError(
      'A matching active Learning Progress consent grant is required.',
      'PROGRESS_EMAIL_OUTBOX_CONSENT_INVALID',
    );
  }
  return grant;
}

function requireCohort(value) {
  const cohort = String(value ?? '').trim();
  if (!COHORTS.has(cohort)) {
    throw new ProgressEmailOutboxIntentError('Progress email cohort is invalid.');
  }
  return cohort;
}

export function createProgressEmailCycleKey({ accountId, lastSignInAt, cohort } = {}) {
  const identity = JSON.stringify({
    version: 1,
    accountId: requireAccountId(accountId),
    lastSignInAt: requireTimestamp(lastSignInAt, 'lastSignInAt'),
    cohort: requireCohort(cohort),
  });
  return createHash('sha256').update(identity).digest('hex');
}

export function buildProgressEmailOutboxIntentDraft({
  candidate,
  consentCheckedAt,
} = {}) {
  if (!candidate?.eligible || candidate.enabled !== true) {
    throw new ProgressEmailOutboxIntentError(
      'An eligible Progress email candidate is required.',
      'PROGRESS_EMAIL_CANDIDATE_NOT_ELIGIBLE',
    );
  }
  if (
    candidate.payload?.messageId !== PROGRESS_EMAIL_MESSAGE_ID
    || candidate.payload?.consentPurpose !== PROGRESS_EMAIL_CONSENT_PURPOSE
    || candidate.payload?.classification !== 'marketing'
  ) {
    throw new ProgressEmailOutboxIntentError('Progress email payload is outside the approved contract.');
  }

  const accountId = requireAccountId(candidate.accountId);
  const email = normalizeEmail(candidate.email);
  const cohort = requireCohort(candidate.eligibility?.cohort);
  const checkedAt = requireTimestamp(consentCheckedAt, 'consentCheckedAt');
  const lastSignInAt = requireTimestamp(candidate.lastSignInAt, 'lastSignInAt');
  const grant = requireConsentGrant(candidate.consentGrant, accountId, email);
  const cycleKey = createProgressEmailCycleKey({ accountId, lastSignInAt, cohort });
  if (!CHECKSUM_PATTERN.test(cycleKey)) {
    throw new ProgressEmailOutboxIntentError('Progress email cycle key is invalid.');
  }
  const businessObjectId = `progress-cycle:${cycleKey}`;
  const idempotencyKey = createNotificationIdempotencyKey({
    messageId: PROGRESS_EMAIL_MESSAGE_ID,
    businessObjectType: 'learning_progress_cycle',
    businessObjectId,
    stateVersion: PROGRESS_EMAIL_OUTBOX_STATE_VERSION,
    recipientEmail: email,
  });

  return Object.freeze({
    idempotency_key: idempotencyKey,
    event_id: `progress-email:${cycleKey}`,
    message_id: PROGRESS_EMAIL_MESSAGE_ID,
    classification: 'marketing',
    business_object_type: 'learning_progress_cycle',
    business_object_id: businessObjectId,
    state_version: PROGRESS_EMAIL_OUTBOX_STATE_VERSION,
    recipient_email_normalized: email,
    template_id: PROGRESS_EMAIL_OUTBOX_TEMPLATE_ID,
    template_version: PROGRESS_EMAIL_TEMPLATE_VERSION,
    provider: 'resend',
    consent_required: true,
    consent_record_id: grant.id,
    consent_purpose: PROGRESS_EMAIL_CONSENT_PURPOSE,
    consent_checked_at: checkedAt,
    payload: Object.freeze({
      cohort,
      cycleKey,
    }),
    status: 'queued',
    attempt_count: 0,
    next_attempt_at: checkedAt,
  });
}
