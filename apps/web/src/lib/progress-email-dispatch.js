import { buildProgressEmail } from './progress-email-email.js';
import { resolveGovernedProgressEmailCandidate } from './progress-email-governed-candidate.js';
import {
  buildProgressEmailOutboxIntentDraft,
  createProgressEmailCycleKey,
} from './progress-email-outbox-intent.js';
import {
  ProgressEmailResendRequestError,
  createProgressEmailResendAdapter,
} from './progress-email-resend-adapter.js';
import { readSupabaseServerConfig } from './supabase-server.js';

const DEVELOPMENT_PROJECT_REF = 'ycstrcvshdluovtuasjc';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NOTIFICATION_KEY_PATTERN = /^notification:v1:([0-9a-f]{64})$/;
const CYCLE_KEY_PATTERN = /^[0-9a-f]{64}$/;
const PROVIDER_RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;
const RETRY_DELAY_MS = 5 * 60 * 1000;
const MAX_PROVIDER_ATTEMPTS = 3;
const TERMINAL_STATUSES = new Set([
  'hard_bounced',
  'complained',
  'suppressed',
  'terminal_failed',
  'cancelled',
]);
const OUTBOX_SELECT = [
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

export class ProgressEmailDispatchError extends Error {
  constructor(message, code = 'PROGRESS_EMAIL_DISPATCH_FAILED', status = 503) {
    super(message);
    this.name = 'ProgressEmailDispatchError';
    this.code = code;
    this.status = status;
  }
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

function enabled(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function readDevelopmentConfig(environment) {
  const vercelEnvironment = String(environment.VERCEL_ENV ?? '').trim().toLowerCase();
  if (vercelEnvironment === 'production') {
    throw new ProgressEmailDispatchError(
      'Learning Progress dispatch is hard-disabled in Production for this implementation slice.',
      'PRODUCTION_PROGRESS_EMAIL_DISPATCH_BLOCKED',
    );
  }
  if (!['preview', 'development'].includes(vercelEnvironment)) {
    throw new ProgressEmailDispatchError(
      'Learning Progress dispatch requires Development or Preview.',
      'UNAPPROVED_PROGRESS_EMAIL_ENVIRONMENT',
    );
  }
  if (!enabled(environment.PROGRESS_EMAIL_DISPATCH_ENABLED)) {
    throw new ProgressEmailDispatchError(
      'Learning Progress dispatch is disabled.',
      'PROGRESS_EMAIL_DISPATCH_DISABLED',
    );
  }
  if (!enabled(environment.PROGRESS_EMAIL_READINESS_ENABLED)) {
    throw new ProgressEmailDispatchError(
      'Learning Progress readiness is disabled.',
      'PROGRESS_EMAIL_READINESS_DISABLED',
    );
  }
  if (!enabled(environment.EMAIL_READINESS_LEDGER_ENABLED)) {
    throw new ProgressEmailDispatchError(
      'Email readiness ledger is disabled.',
      'EMAIL_LEDGER_DISABLED',
    );
  }
  let config;
  try {
    config = readSupabaseServerConfig(environment, { requireSecret: true });
  } catch {
    throw new ProgressEmailDispatchError(
      'Learning Progress database configuration is unavailable.',
      'PROGRESS_EMAIL_DATABASE_CONFIGURATION_ERROR',
    );
  }
  if (projectRefFromUrl(config.url) !== DEVELOPMENT_PROJECT_REF) {
    throw new ProgressEmailDispatchError(
      'Non-production Learning Progress dispatch must target canonical Development.',
      'UNEXPECTED_SUPABASE_PROJECT',
    );
  }
  return Object.freeze({ config, vercelEnvironment });
}

function requireBaseUrl(environment, vercelEnvironment) {
  let url;
  try {
    url = new URL(String(environment.PROGRESS_EMAIL_BASE_URL ?? '').trim());
  } catch {
    throw new ProgressEmailDispatchError(
      'PROGRESS_EMAIL_BASE_URL is invalid.',
      'INVALID_PROGRESS_EMAIL_BASE_URL',
    );
  }
  if (url.username || url.password) {
    throw new ProgressEmailDispatchError(
      'PROGRESS_EMAIL_BASE_URL is outside the approved origin set.',
      'INVALID_PROGRESS_EMAIL_BASE_URL',
    );
  }
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  const preview = url.protocol === 'https:'
    && url.hostname.startsWith('usd-impact-site')
    && url.hostname.endsWith('.vercel.app');
  if (vercelEnvironment === 'preview' && !preview) {
    throw new ProgressEmailDispatchError(
      'Preview Learning Progress unsubscribe URLs must remain on the active Vercel Preview origin.',
      'INVALID_PROGRESS_EMAIL_BASE_URL',
    );
  }
  if (vercelEnvironment === 'development' && !local && !preview) {
    throw new ProgressEmailDispatchError(
      'Development Learning Progress base URL is outside the approved origin set.',
      'INVALID_PROGRESS_EMAIL_BASE_URL',
    );
  }
  return url.origin;
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
    throw new ProgressEmailDispatchError(
      `Learning Progress database request failed with status ${response.status}.`,
      'PROGRESS_EMAIL_DATABASE_REQUEST_FAILED',
    );
  }
  return payload;
}

function requireOutbox(row) {
  const cycleKey = String(row?.payload?.cycleKey ?? '');
  const cohort = String(row?.payload?.cohort ?? '');
  if (
    !row
    || typeof row !== 'object'
    || !UUID_PATTERN.test(String(row.id ?? ''))
    || !NOTIFICATION_KEY_PATTERN.test(String(row.idempotency_key ?? ''))
    || row.message_id !== 'learning_progress_update'
    || row.classification !== 'marketing'
    || row.business_object_type !== 'learning_progress_cycle'
    || row.business_object_id !== `progress-cycle:${cycleKey}`
    || row.state_version !== 1
    || typeof row.recipient_email_normalized !== 'string'
    || !row.recipient_email_normalized
    || row.template_id !== 'learning_progress_email'
    || row.template_version !== 'learning-progress-email-v1'
    || row.provider !== 'resend'
    || row.consent_required !== true
    || !UUID_PATTERN.test(String(row.consent_record_id ?? ''))
    || row.consent_purpose !== 'learning_progress_updates'
    || !row.consent_checked_at
    || !['inactive_7d', 'inactive_14d', 'inactive_30d'].includes(cohort)
    || !CYCLE_KEY_PATTERN.test(cycleKey)
  ) {
    throw new ProgressEmailDispatchError(
      'Learning Progress outbox evidence is outside the approved dispatch contract.',
      'INVALID_PROGRESS_EMAIL_OUTBOX',
    );
  }
  return row;
}

function timestampMs(value) {
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function acceptedProviderState(outbox) {
  return typeof outbox.provider_message_ref === 'string'
    && outbox.provider_message_ref.trim().length > 0
    && timestampMs(outbox.accepted_at) !== null;
}

export function resolveProgressEmailDispatchDecision(outbox, nowMs = Date.now()) {
  const state = requireOutbox(outbox);
  const status = String(state.status ?? '');
  if (status === 'accepted' || status === 'delivered') {
    return acceptedProviderState(state)
      ? Object.freeze({ action: 'complete', reason: status })
      : Object.freeze({ action: 'reconcile', reason: 'incomplete-provider-state' });
  }
  if (TERMINAL_STATUSES.has(status)) {
    return Object.freeze({ action: 'blocked', reason: status });
  }
  if (status === 'queued') {
    return Number(state.attempt_count || 0) === 0
      ? Object.freeze({ action: 'send', reason: 'queued' })
      : Object.freeze({ action: 'reconcile', reason: 'queued-after-attempt' });
  }
  if (status === 'sending' || status === 'retry_scheduled') {
    if (acceptedProviderState(state)) {
      return Object.freeze({ action: 'complete', reason: 'accepted-provider-state' });
    }
    if (status === 'retry_scheduled') {
      const dueAt = timestampMs(state.next_attempt_at);
      if (dueAt === null) return Object.freeze({ action: 'reconcile', reason: 'invalid-next-attempt' });
      if (dueAt > nowMs) return Object.freeze({ action: 'wait', reason: 'retry-not-due' });
    }
    const createdAt = timestampMs(state.created_at);
    const age = createdAt === null ? null : nowMs - createdAt;
    if (age === null || age < 0 || age > PROVIDER_RETRY_WINDOW_MS) {
      return Object.freeze({ action: 'reconcile', reason: 'expired-provider-retry-window' });
    }
    return Object.freeze({ action: 'send', reason: 'idempotent-provider-retry' });
  }
  return Object.freeze({ action: 'reconcile', reason: 'unknown-status' });
}

function providerIdempotencyKey(outbox) {
  const match = String(outbox.idempotency_key ?? '').match(NOTIFICATION_KEY_PATTERN);
  if (!match) {
    throw new ProgressEmailDispatchError(
      'Learning Progress provider idempotency identity is invalid.',
      'INVALID_PROVIDER_IDEMPOTENCY_KEY',
    );
  }
  return `progress-email/${match[1]}`;
}

async function loadOutbox({ config, id = null, idempotencyKey = null, fetchImpl }) {
  const filter = id
    ? `id=eq.${encodeURIComponent(id)}`
    : `idempotency_key=eq.${encodeURIComponent(idempotencyKey)}`;
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/notification_outbox?${filter}&select=${OUTBOX_SELECT}&limit=1`,
    fetchImpl,
  });
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new ProgressEmailDispatchError(
      'Learning Progress outbox row could not be loaded.',
      'PROGRESS_EMAIL_OUTBOX_MISSING',
    );
  }
  return Object.freeze({ ...requireOutbox(rows[0]) });
}

async function patchOutbox({ config, outbox, body, fetchImpl }) {
  const expectedStatus = String(outbox.status ?? '');
  const expectedAttempts = Number.isInteger(outbox.attempt_count) ? outbox.attempt_count : 0;
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/notification_outbox?id=eq.${encodeURIComponent(outbox.id)}&status=eq.${encodeURIComponent(expectedStatus)}&attempt_count=eq.${expectedAttempts}`,
    method: 'PATCH',
    body,
    prefer: 'return=representation',
    fetchImpl,
  });
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new ProgressEmailDispatchError(
      'Learning Progress outbox state changed concurrently.',
      'PROGRESS_EMAIL_OUTBOX_STATE_CONFLICT',
    );
  }
  return Object.freeze({ ...requireOutbox(rows[0]) });
}

export async function enqueueProgressEmailCandidate({
  candidate,
  environment = process.env,
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  const { config } = readDevelopmentConfig(environment);
  if (!candidate?.eligible) {
    return Object.freeze({ enabled: true, enqueued: false, reason: candidate?.reason || 'not_eligible' });
  }
  const checkedAt = new Date(now).toISOString();
  const intent = buildProgressEmailOutboxIntentDraft({ candidate, consentCheckedAt: checkedAt });
  const insertable = { ...intent };
  const inserted = await serviceRequest({
    config,
    path: '/rest/v1/notification_outbox?on_conflict=idempotency_key',
    method: 'POST',
    body: insertable,
    prefer: 'resolution=ignore-duplicates,return=representation',
    fetchImpl,
  });
  const outbox = Array.isArray(inserted) && inserted.length === 1
    ? Object.freeze({ ...requireOutbox(inserted[0]) })
    : await loadOutbox({ config, idempotencyKey: intent.idempotency_key, fetchImpl });
  return Object.freeze({ enabled: true, enqueued: true, intent, outbox });
}

function safeErrorCode(value, fallback = 'PROGRESS_EMAIL_SEND_FAILED') {
  const code = String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return /^[A-Z][A-Z0-9_]{1,79}$/.test(code) ? code : fallback;
}

async function cancelOutbox({ config, outbox, reason, fetchImpl }) {
  return patchOutbox({
    config,
    outbox,
    body: {
      status: 'cancelled',
      error_code: safeErrorCode(`PROGRESS_${reason}`, 'PROGRESS_EMAIL_NO_LONGER_ELIGIBLE'),
      failed_at: new Date().toISOString(),
    },
    fetchImpl,
  });
}

function verifyFreshCandidateMatchesOutbox(candidate, outbox) {
  if (!candidate?.eligible || !candidate.consentGrant) return false;
  const expectedCycleKey = createProgressEmailCycleKey({
    accountId: candidate.accountId,
    lastSignInAt: candidate.lastSignInAt,
    cohort: candidate.eligibility?.cohort,
  });
  return candidate.email === outbox.recipient_email_normalized
    && candidate.consentGrant.id === outbox.consent_record_id
    && candidate.eligibility?.cohort === outbox.payload.cohort
    && expectedCycleKey === outbox.payload.cycleKey;
}

async function markProviderFailure({ config, outbox, error, now, fetchImpl }) {
  const attempts = Number(outbox.attempt_count || 0);
  if (error instanceof ProgressEmailResendRequestError && error.providerState === 'suppressed') {
    return patchOutbox({
      config,
      outbox,
      body: {
        status: 'suppressed',
        error_code: safeErrorCode(error.code, 'RESEND_PROVIDER_SUPPRESSED'),
        failed_at: now.toISOString(),
      },
      fetchImpl,
    });
  }
  const retryable = error instanceof ProgressEmailResendRequestError
    && error.retryable === true
    && attempts < MAX_PROVIDER_ATTEMPTS;
  return patchOutbox({
    config,
    outbox,
    body: retryable
      ? {
        status: 'retry_scheduled',
        error_code: safeErrorCode(error.code),
        next_attempt_at: new Date(now.getTime() + RETRY_DELAY_MS).toISOString(),
      }
      : {
        status: 'terminal_failed',
        error_code: safeErrorCode(error?.code),
        failed_at: now.toISOString(),
      },
    fetchImpl,
  });
}

export async function dispatchProgressEmailOutbox({
  outboxId,
  accountId,
  weeklyReports,
  currentWeeklyReport,
  registry,
  environment = process.env,
  fetchImpl = fetch,
  now = new Date(),
  resolveCandidate = resolveGovernedProgressEmailCandidate,
  renderEmail = buildProgressEmail,
  createAdapter = createProgressEmailResendAdapter,
} = {}) {
  const nowDate = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(nowDate.getTime())) {
    throw new ProgressEmailDispatchError('Learning Progress dispatch clock is invalid.', 'INVALID_PROGRESS_EMAIL_CLOCK');
  }
  const { config, vercelEnvironment } = readDevelopmentConfig(environment);
  const baseUrl = requireBaseUrl(environment, vercelEnvironment);
  let outbox = await loadOutbox({ config, id: outboxId, fetchImpl });
  const decision = resolveProgressEmailDispatchDecision(outbox, nowDate.getTime());
  if (decision.action !== 'send') {
    return Object.freeze({
      enabled: true,
      status: decision.action,
      reason: decision.reason,
      outboxId: outbox.id,
      outboxStatus: outbox.status,
    });
  }

  const candidate = await resolveCandidate({
    accountId,
    weeklyReports,
    currentWeeklyReport,
    ...(registry === undefined ? {} : { registry }),
    environment,
    fetchImpl,
    now: nowDate,
  });
  if (!candidate?.eligible) {
    const cancelled = await cancelOutbox({
      config,
      outbox,
      reason: candidate?.reason || 'not_eligible',
      fetchImpl,
    });
    return Object.freeze({
      enabled: true,
      status: 'cancelled',
      reason: candidate?.reason || 'not_eligible',
      outboxId: cancelled.id,
      outboxStatus: cancelled.status,
    });
  }
  if (!verifyFreshCandidateMatchesOutbox(candidate, outbox)) {
    const cancelled = await cancelOutbox({
      config,
      outbox,
      reason: 'candidate_identity_changed',
      fetchImpl,
    });
    return Object.freeze({
      enabled: true,
      status: 'cancelled',
      reason: 'candidate_identity_changed',
      outboxId: cancelled.id,
      outboxStatus: cancelled.status,
    });
  }

  const rendered = renderEmail({
    payload: candidate.payload,
    consentGrant: candidate.consentGrant,
    unsubscribeSecret: environment.MARKETING_OPT_IN_SECRET,
    baseUrl,
  });
  outbox = await patchOutbox({
    config,
    outbox,
    body: {
      status: 'sending',
      attempt_count: Number(outbox.attempt_count || 0) + 1,
      error_code: null,
    },
    fetchImpl,
  });

  const adapter = createAdapter({
    environment,
    fetchImpl,
    now: () => nowDate,
  });
  try {
    const accepted = await adapter.send({
      provider: 'resend',
      to: [outbox.recipient_email_normalized],
      idempotencyKey: providerIdempotencyKey(outbox),
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      headers: rendered.headers,
    });
    const acceptedRow = await patchOutbox({
      config,
      outbox,
      body: {
        status: 'accepted',
        provider_message_ref: accepted.messageRef,
        accepted_at: accepted.occurredAt,
        error_code: null,
      },
      fetchImpl,
    });
    return Object.freeze({
      enabled: true,
      status: 'accepted',
      outboxId: acceptedRow.id,
      outboxStatus: acceptedRow.status,
      providerMessageRef: acceptedRow.provider_message_ref,
    });
  } catch (error) {
    const failedRow = await markProviderFailure({
      config,
      outbox,
      error,
      now: nowDate,
      fetchImpl,
    });
    return Object.freeze({
      enabled: true,
      status: failedRow.status === 'retry_scheduled' ? 'retry_scheduled' : 'failed',
      outboxId: failedRow.id,
      outboxStatus: failedRow.status,
      errorCode: failedRow.error_code,
    });
  }
}

export async function enqueueAndDispatchProgressEmail({
  accountId,
  weeklyReports,
  currentWeeklyReport,
  registry,
  environment = process.env,
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  const candidate = await resolveGovernedProgressEmailCandidate({
    accountId,
    weeklyReports,
    currentWeeklyReport,
    ...(registry === undefined ? {} : { registry }),
    environment,
    fetchImpl,
    now,
  });
  if (!candidate?.eligible) {
    return Object.freeze({
      enabled: true,
      enqueued: false,
      status: 'suppressed',
      reason: candidate?.reason || 'not_eligible',
    });
  }
  const queued = await enqueueProgressEmailCandidate({ candidate, environment, fetchImpl, now });
  return dispatchProgressEmailOutbox({
    outboxId: queued.outbox.id,
    accountId,
    weeklyReports,
    currentWeeklyReport,
    ...(registry === undefined ? {} : { registry }),
    environment,
    fetchImpl,
    now,
  });
}
