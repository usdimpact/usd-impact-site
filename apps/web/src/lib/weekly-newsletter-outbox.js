import {
  createNotificationIdempotencyKey,
  normalizeEmail,
} from './email-readiness-contracts.js';

export const WEEKLY_NEWSLETTER_OUTBOX_TEMPLATE_ID = 'weekly_newsletter';
export const WEEKLY_NEWSLETTER_OUTBOX_TEMPLATE_VERSION = 'weekly-newsletter-v1';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/;

export class WeeklyNewsletterOutboxError extends Error {
  constructor(message, code = 'WEEKLY_NEWSLETTER_OUTBOX_INVALID') {
    super(message);
    this.name = 'WeeklyNewsletterOutboxError';
    this.code = code;
  }
}

function requireTimestamp(value, field) {
  const parsed = Date.parse(String(value ?? ''));
  if (!Number.isFinite(parsed)) {
    throw new WeeklyNewsletterOutboxError(`${field} must be a valid timestamp.`);
  }
  return new Date(parsed).toISOString();
}

function validateCandidate(candidate) {
  if (
    !candidate
    || typeof candidate !== 'object'
    || candidate.eligible !== true
    || candidate.action !== 'queue_candidate'
    || candidate.reason !== 'eligible'
    || !/^\d{4}-\d{2}-\d{2}$/.test(String(candidate.weekEnding ?? ''))
    || typeof candidate.recipientEmail !== 'string'
    || !candidate.recipientEmail
    || !UUID_PATTERN.test(String(candidate.consentGrantId ?? ''))
    || !/^consent:v1:[0-9a-f]{64}$/.test(String(candidate.consentIdempotencyKey ?? ''))
    || candidate.payload?.messageId !== 'weekly_newsletter'
    || candidate.payload?.consentPurpose !== 'weekly_newsletter'
    || candidate.payload?.classification !== 'marketing'
    || candidate.payload?.templateVersion !== WEEKLY_NEWSLETTER_OUTBOX_TEMPLATE_VERSION
  ) {
    throw new WeeklyNewsletterOutboxError(
      'An eligible Weekly Newsletter candidate is required.',
      'WEEKLY_NEWSLETTER_CANDIDATE_REQUIRED',
    );
  }
  return candidate;
}

export function createWeeklyNewsletterOutboxRecord({
  candidate,
  editionChecksum,
  consentCheckedAt = new Date().toISOString(),
} = {}) {
  const approved = validateCandidate(candidate);
  const checksum = String(editionChecksum ?? '').trim().toLowerCase();
  if (!CHECKSUM_PATTERN.test(checksum)) {
    throw new WeeklyNewsletterOutboxError(
      'Weekly Newsletter edition checksum is invalid.',
      'INVALID_WEEKLY_NEWSLETTER_CHECKSUM',
    );
  }
  const checkedAt = requireTimestamp(consentCheckedAt, 'consentCheckedAt');
  const recipientEmail = normalizeEmail(approved.recipientEmail);
  const businessObjectId = approved.weekEnding;
  const messageId = 'weekly_newsletter';
  const businessObjectType = 'weekly_newsletter_edition';
  const stateVersion = 1;

  return Object.freeze({
    idempotency_key: createNotificationIdempotencyKey({
      messageId,
      businessObjectType,
      businessObjectId,
      stateVersion,
      recipientEmail,
    }),
    event_id: `weekly.newsletter:${approved.weekEnding}:${approved.consentGrantId}`,
    message_id: messageId,
    classification: 'marketing',
    business_object_type: businessObjectType,
    business_object_id: businessObjectId,
    state_version: stateVersion,
    recipient_email_normalized: recipientEmail,
    template_id: WEEKLY_NEWSLETTER_OUTBOX_TEMPLATE_ID,
    template_version: WEEKLY_NEWSLETTER_OUTBOX_TEMPLATE_VERSION,
    provider: 'resend',
    consent_required: true,
    consent_record_id: approved.consentGrantId.toLowerCase(),
    consent_purpose: 'weekly_newsletter',
    consent_checked_at: checkedAt,
    payload: Object.freeze({
      weekEnding: approved.weekEnding,
      editionChecksum: checksum,
    }),
    status: 'queued',
    attempt_count: 0,
    next_attempt_at: checkedAt,
  });
}
