import { createHash } from 'node:crypto';

// Deliberately a single, immutable edition, not a production campaign runner.
export const CANARY_WEEK = '2026-09-18';
export const CANARY_CHECKSUM = 'dedb7419e641c901a4e36d74a38b9928f45baf73d9d994df919ca3a07b1bd981';
export const CANARY_ORIGIN = 'https://www.usd-impact.com';
export const CANARY_DATABASE = 'https://gjzetjugmnwanvjkchux.supabase.co';
export const CANARY_TRUE_FLAGS = Object.freeze([
  'WEEKLY_NEWSLETTER_PRODUCTION_ENABLED',
  'WEEKLY_NEWSLETTER_DISPATCH_ENABLED',
  'WEEKLY_NEWSLETTER_DELIVERY_ENABLED',
  'EMAIL_READINESS_LEDGER_ENABLED',
  'EMAIL_OPT_IN_PRODUCTION_APPROVED',
  'EMAIL_OPT_IN_REQUEST_ENABLED',
  'EMAIL_OPT_IN_DELIVERY_ENABLED',
  'EMAIL_PREFERENCES_PRODUCTION_APPROVED',
  'RESEND_WEBHOOK_ENABLED',
]);
const PROGRESS_FLAGS = [
  'PROGRESS_EMAIL_PRODUCTION_ENABLED', 'PROGRESS_EMAIL_DISPATCH_ENABLED',
  'PROGRESS_EMAIL_DELIVERY_ENABLED', 'PROGRESS_EMAIL_READINESS_ENABLED',
  'PROGRESS_EMAIL_QA_BATCH_ENABLED',
];
const EMAIL = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class WeeklyCanaryError extends Error {
  constructor(code, status = 503) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function singleton(value) {
  if (typeof value !== 'string') throw new WeeklyCanaryError('CANARY_ALLOWLIST_INVALID');
  const parts = value.split(',').map((part) => part.trim().toLowerCase());
  if (parts.length !== 1 || parts[0].length > 254 || !EMAIL.test(parts[0])) {
    throw new WeeklyCanaryError('CANARY_ALLOWLIST_INVALID');
  }
  return parts[0];
}

export function canaryRecipient(environment) {
  if (environment.VERCEL_ENV !== 'production') throw new WeeklyCanaryError('CANARY_NOT_AVAILABLE', 404);
  const recipient = singleton(environment.WEEKLY_NEWSLETTER_QA_RECIPIENTS);
  if (recipient !== singleton(environment.EMAIL_OPT_IN_QA_RECIPIENTS)) {
    throw new WeeklyCanaryError('CANARY_ALLOWLIST_MISMATCH');
  }
  return recipient;
}

export function canaryConfigurationIssues(environment) {
  const issues = CANARY_TRUE_FLAGS.filter((key) => environment[key] !== 'true');
  for (const key of PROGRESS_FLAGS) {
    if (String(environment[key] ?? '').trim().toLowerCase() === 'true') issues.push(key);
  }
  if (String(environment.WEEKLY_NEWSLETTER_QA_BATCH_ENABLED ?? '').trim().toLowerCase() === 'true') {
    issues.push('WEEKLY_NEWSLETTER_QA_BATCH_ENABLED');
  }
  for (const key of ['WEEKLY_NEWSLETTER_ARTIFACT_BASE_URL', 'WEEKLY_NEWSLETTER_PUBLIC_BASE_URL']) {
    if (environment[key] !== CANARY_ORIGIN) issues.push(key);
  }
  if (environment.SUPABASE_URL !== CANARY_DATABASE) issues.push('SUPABASE_URL');
  if (!/^moi_[A-Za-z0-9_-]{43,}$/.test(String(environment.MARKETING_OPT_IN_SECRET ?? ''))) {
    issues.push('MARKETING_OPT_IN_SECRET');
  }
  if (!/^whsec_[A-Za-z0-9+/=_-]{16,}$/.test(String(environment.RESEND_WEBHOOK_SECRET ?? ''))) {
    issues.push('RESEND_WEBHOOK_SECRET');
  }
  return issues;
}

export function canaryRequestId(userId, email) {
  // This is an idempotency identifier, not a credential. Never store an address in source.
  const hex = createHash('sha256').update(`weekly-canary:${CANARY_WEEK}:${userId}:${email}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function validateState(state) {
  if (!state || !Array.isArray(state.weekly) || !Array.isArray(state.confirmations)) {
    throw new WeeklyCanaryError('CANARY_STATE_INVALID');
  }
  // Multiple rows or any previous attempt require human reconciliation, never a retry loop.
  for (const rows of [state.weekly, state.confirmations]) {
    if (rows.length > 1 || rows.some((row) => !row || typeof row.status !== 'string')) {
      throw new WeeklyCanaryError('CANARY_RECONCILIATION_REQUIRED', 409);
    }
  }
  return state;
}

function summary(context) {
  const { source, state, grant, candidate } = context;
  return {
    ready: true,
    weekEnding: CANARY_WEEK,
    checksum: CANARY_CHECKSUM,
    subject: source.payload.subject,
    consentActive: Boolean(grant),
    confirmationStatus: state.confirmations[0]?.status ?? null,
    weeklyStatus: state.weekly[0]?.status ?? null,
    canRequestConfirmation: !grant && state.confirmations.length === 0 && state.weekly.length === 0,
    canSend: Boolean(grant && candidate?.eligible && state.weekly.length === 0),
    suppressedReason: candidate && !candidate.eligible ? candidate.reason : null,
  };
}

/** Every port is supplied by the server binding. GET/readiness never calls a write port. */
export async function executeWeeklyCanary({ operation = 'inspect', confirmed = false, user, environment, ports, now = new Date() }) {
  const email = canaryRecipient(environment);
  if (!user || !UUID.test(String(user.id ?? '')) || String(user.email ?? '').toLowerCase() !== email) {
    throw new WeeklyCanaryError('CANARY_NOT_AUTHORIZED', 403);
  }
  if (!['inspect', 'request-confirmation', 'send-weekly'].includes(operation)) {
    throw new WeeklyCanaryError('CANARY_OPERATION_INVALID', 400);
  }
  if (operation !== 'inspect' && confirmed !== true) {
    throw new WeeklyCanaryError('CANARY_EXPLICIT_CONFIRMATION_REQUIRED', 400);
  }
  const issues = canaryConfigurationIssues(environment);
  if (issues.length) {
    if (operation !== 'inspect') throw new WeeklyCanaryError('CANARY_CONFIGURATION_INCOMPLETE');
    return { ready: false, issues, canRequestConfirmation: false, canSend: false };
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new WeeklyCanaryError('CANARY_CLOCK_INVALID');
  const age = now.getTime() - Date.parse(`${CANARY_WEEK}T00:00:00Z`);
  if (age < 0 || age >= 7 * 86400000) throw new WeeklyCanaryError('CANARY_EDITION_WINDOW_CLOSED', 409);

  // Instantiate both guarded adapters without sending, so configuration errors precede any intent.
  await ports.validateConfiguration(environment);
  const source = await ports.loadSource(environment);
  if (source?.checksum !== CANARY_CHECKSUM || source?.payload?.weekEnding !== CANARY_WEEK) {
    throw new WeeklyCanaryError('CANARY_SOURCE_CHANGED', 409);
  }
  const preferences = await ports.readPreferences({ email, environment });
  if (!preferences || typeof preferences.weeklyNewsletter?.active !== 'boolean') {
    throw new WeeklyCanaryError('CANARY_CONSENT_STATE_INVALID');
  }
  const grant = preferences.weeklyNewsletter.active ? preferences.weeklyNewsletter.grant : null;
  if (preferences.weeklyNewsletter.active && !grant) throw new WeeklyCanaryError('CANARY_CONSENT_STATE_INVALID');
  if (grant && (grant.purpose !== 'weekly_newsletter' || grant.status !== 'granted' || grant.email_normalized !== email)) {
    throw new WeeklyCanaryError('CANARY_CONSENT_MISMATCH', 409);
  }
  const state = validateState(await ports.readState({ email, environment }));
  const candidate = grant ? ports.evaluateCandidate({
    payload: source.payload, consentGrant: grant, providerSuppressed: false, now: now.toISOString(),
  }) : null;
  if (candidate?.eligible && candidate.recipientEmail !== email) throw new WeeklyCanaryError('CANARY_RECIPIENT_MISMATCH');
  if (grant) await ports.verifyUnsubscribe({ grant, environment });
  const context = { source, state, grant, candidate };
  if (operation === 'inspect') return summary(context);

  if (operation === 'request-confirmation') {
    if (!summary(context).canRequestConfirmation) return { ...summary(context), status: 'already_recorded', sent: false };
    const prepared = await ports.prepareOptIn({
      email, userId: user.id, requestId: canaryRequestId(user.id, email), purpose: 'weekly_newsletter',
      locale: 'en', requestedAt: now.toISOString(), environment,
    });
    // Only the winning durable insert is allowed to send, even for simultaneous requests.
    if (prepared?.created !== true) return { status: 'already_recorded', sent: false };
    if (prepared.outbox?.recipient_email_normalized !== email || prepared.outbox?.payload?.purpose !== 'weekly_newsletter') {
      throw new WeeklyCanaryError('CANARY_OUTBOX_MISMATCH');
    }
    const result = await ports.deliverOptIn({ outbox: prepared.outbox, baseUrl: CANARY_ORIGIN, environment, now: () => now });
    return { status: result.state, sent: result.sent === true, confirmationRequired: true };
  }

  if (state.weekly.length) return { ...summary(context), status: 'already_recorded', sent: false };
  if (!grant || !candidate?.eligible) throw new WeeklyCanaryError('CANARY_CONFIRMED_CONSENT_REQUIRED', 409);
  const queued = await ports.enqueue({ candidate, artifact: source, consentCheckedAt: now.toISOString(), environment });
  if (queued?.created !== true) return { status: 'already_recorded', sent: false };
  if (queued.outbox?.recipient_email_normalized !== email || queued.outbox?.payload?.editionChecksum !== CANARY_CHECKSUM) {
    throw new WeeklyCanaryError('CANARY_OUTBOX_MISMATCH');
  }
  // Existing worker rechecks consent, suppression, freshness and idempotency immediately before sending.
  const result = await ports.deliverWeekly({
    outbox: queued.outbox, artifactBaseUrl: CANARY_ORIGIN, unsubscribeBaseUrl: CANARY_ORIGIN,
    environment, now: () => now,
  });
  return { status: result.state, sent: result.sent === true };
}
