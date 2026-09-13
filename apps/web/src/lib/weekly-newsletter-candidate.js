const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PUBLICATION_AGE_DAYS = 7;
const WEEKLY_PURPOSE = 'weekly_newsletter';

export class WeeklyNewsletterCandidateError extends Error {
  constructor(message, code = 'WEEKLY_NEWSLETTER_CANDIDATE_INVALID') {
    super(message);
    this.name = 'WeeklyNewsletterCandidateError';
    this.code = code;
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function suppress(reason, details = {}) {
  return deepFreeze({ eligible: false, action: 'suppress', reason, ...details });
}

function requireDate(value, field) {
  const normalized = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new WeeklyNewsletterCandidateError(`${field} must use YYYY-MM-DD.`, 'INVALID_WEEKLY_NEWSLETTER_DATE');
  }
  const timestamp = Date.parse(`${normalized}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) {
    throw new WeeklyNewsletterCandidateError(`${field} is invalid.`, 'INVALID_WEEKLY_NEWSLETTER_DATE');
  }
  return { value: normalized, timestamp };
}

function requireTimestamp(value, field) {
  const timestamp = Date.parse(String(value ?? ''));
  if (!Number.isFinite(timestamp)) {
    throw new WeeklyNewsletterCandidateError(`${field} must be a valid timestamp.`, 'INVALID_WEEKLY_NEWSLETTER_TIMESTAMP');
  }
  return timestamp;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new WeeklyNewsletterCandidateError('A Weekly Newsletter payload is required.');
  }
  if (
    payload.messageId !== WEEKLY_PURPOSE
    || payload.consentPurpose !== WEEKLY_PURPOSE
    || payload.classification !== 'marketing'
    || payload.locale !== 'en'
    || payload.unsubscribeRequired !== true
    || typeof payload.subject !== 'string'
    || !payload.subject.trim()
    || !Array.isArray(payload.highlights)
    || payload.highlights.length !== 3
    || !Array.isArray(payload.links)
    || payload.links.length < 4
    || payload.score?.note?.toLowerCase().includes('not a forecast or trading signal') !== true
  ) {
    throw new WeeklyNewsletterCandidateError(
      'Weekly Newsletter payload is outside the approved contract.',
      'INVALID_WEEKLY_NEWSLETTER_PAYLOAD',
    );
  }
  return payload;
}

function validateGrant(grant) {
  if (
    !grant
    || typeof grant !== 'object'
    || grant.status !== 'granted'
    || grant.purpose !== WEEKLY_PURPOSE
    || typeof grant.id !== 'string'
    || !grant.id
    || typeof grant.idempotency_key !== 'string'
    || !/^consent:v1:[0-9a-f]{64}$/.test(grant.idempotency_key)
    || typeof grant.email_normalized !== 'string'
    || !grant.email_normalized
  ) {
    throw new WeeklyNewsletterCandidateError(
      'An active Weekly Newsletter consent grant is required.',
      'INVALID_WEEKLY_NEWSLETTER_CONSENT',
    );
  }
  return grant;
}

export function evaluateWeeklyNewsletterCandidate({
  payload,
  consentGrant,
  providerSuppressed = false,
  lastSentWeekEnding = null,
  now = new Date().toISOString(),
} = {}) {
  const newsletter = validatePayload(payload);
  const grant = validateGrant(consentGrant);
  const weekEnding = requireDate(newsletter.weekEnding, 'payload.weekEnding');
  const nowMs = requireTimestamp(now, 'now');
  const weekday = new Date(weekEnding.timestamp).getUTCDay();

  if (weekday !== 5) {
    return suppress('week_ending_not_friday', { weekEnding: weekEnding.value });
  }
  if (providerSuppressed) {
    return suppress('provider_suppressed', { weekEnding: weekEnding.value });
  }
  if (nowMs < weekEnding.timestamp) {
    return suppress('weekly_report_in_future', { weekEnding: weekEnding.value });
  }

  const publicationAgeDays = Math.floor((nowMs - weekEnding.timestamp) / DAY_MS);
  if (publicationAgeDays > MAX_PUBLICATION_AGE_DAYS) {
    return suppress('weekly_report_stale', {
      weekEnding: weekEnding.value,
      publicationAgeDays,
    });
  }

  if (lastSentWeekEnding != null) {
    const prior = requireDate(lastSentWeekEnding, 'lastSentWeekEnding');
    if (prior.value === weekEnding.value) {
      return suppress('weekly_edition_already_sent', { weekEnding: weekEnding.value });
    }
    if (prior.value > weekEnding.value) {
      return suppress('newer_weekly_edition_already_sent', {
        weekEnding: weekEnding.value,
        lastSentWeekEnding: prior.value,
      });
    }
  }

  return deepFreeze({
    eligible: true,
    action: 'queue_candidate',
    reason: 'eligible',
    weekEnding: weekEnding.value,
    publicationAgeDays,
    recipientEmail: grant.email_normalized,
    consentGrantId: grant.id,
    consentIdempotencyKey: grant.idempotency_key,
    payload: newsletter,
  });
}
