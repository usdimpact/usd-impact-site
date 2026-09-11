import { evaluateWeeklyNewsletterCandidate } from './weekly-newsletter-candidate.js';
import { verifyWeeklyNewsletterEditionArtifact } from './weekly-newsletter-edition.js';
import { buildWeeklyNewsletterEmail } from './weekly-newsletter-email.js';
import { createWeeklyNewsletterOutboxRecord } from './weekly-newsletter-outbox.js';
import {
  WeeklyNewsletterResendConfigurationError,
  WeeklyNewsletterResendRequestError,
  createWeeklyNewsletterResendAdapter,
} from './weekly-newsletter-resend-adapter.js';
import { readSupabaseServerConfig } from './supabase-server.js';

const DEVELOPMENT_PROJECT_REF = 'ycstrcvshdluovtuasjc';
const PROVIDER_IDEMPOTENCY_PATTERN = /^notification:v1:([0-9a-f]{64})$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/;
const PROVIDER_RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;
const RETRY_DELAY_MS = 5 * 60 * 1000;
const TERMINAL_STATUSES = new Set([
  'hard_bounced',
  'complained',
  'suppressed',
  'terminal_failed',
  'cancelled',
]);

export class WeeklyNewsletterDispatchError extends Error {
  constructor(message, code = 'WEEKLY_NEWSLETTER_DISPATCH_FAILED', status = 503) {
    super(message);
    this.name = 'WeeklyNewsletterDispatchError';
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

function readDevelopmentConfig(environment) {
  const vercelEnvironment = String(environment.VERCEL_ENV ?? '').trim().toLowerCase();
  if (vercelEnvironment === 'production') {
    throw new WeeklyNewsletterDispatchError(
      'Weekly Newsletter dispatch is hard-disabled in Production for this implementation slice.',
      'PRODUCTION_WEEKLY_NEWSLETTER_DISPATCH_BLOCKED',
      503,
    );
  }
  if (!['preview', 'development'].includes(vercelEnvironment)) {
    throw new WeeklyNewsletterDispatchError(
      'Weekly Newsletter dispatch requires Development or Preview.',
      'UNAPPROVED_WEEKLY_NEWSLETTER_ENVIRONMENT',
      503,
    );
  }
  if (environment.WEEKLY_NEWSLETTER_DISPATCH_ENABLED !== 'true') {
    throw new WeeklyNewsletterDispatchError(
      'Weekly Newsletter dispatch is disabled.',
      'WEEKLY_NEWSLETTER_DISPATCH_DISABLED',
      503,
    );
  }
  if (environment.EMAIL_READINESS_LEDGER_ENABLED !== 'true') {
    throw new WeeklyNewsletterDispatchError(
      'Email readiness ledger is disabled.',
      'EMAIL_LEDGER_DISABLED',
      503,
    );
  }

  let config;
  try {
    config = readSupabaseServerConfig(environment, { requireSecret: true });
  } catch {
    throw new WeeklyNewsletterDispatchError(
      'Weekly Newsletter database configuration is unavailable.',
      'WEEKLY_NEWSLETTER_DATABASE_CONFIGURATION_ERROR',
      503,
    );
  }
  if (projectRefFromUrl(config.url) !== DEVELOPMENT_PROJECT_REF) {
    throw new WeeklyNewsletterDispatchError(
      'Non-production Weekly Newsletter dispatch must target the canonical Development database.',
      'UNEXPECTED_SUPABASE_PROJECT',
      503,
    );
  }
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
    throw new WeeklyNewsletterDispatchError(
      `Weekly Newsletter database request failed with status ${response.status}.`,
      'WEEKLY_NEWSLETTER_DATABASE_REQUEST_FAILED',
      503,
    );
  }
  return payload;
}

function requireOutbox(outbox) {
  if (
    !outbox
    || typeof outbox !== 'object'
    || !UUID_PATTERN.test(String(outbox.id ?? ''))
    || !PROVIDER_IDEMPOTENCY_PATTERN.test(String(outbox.idempotency_key ?? ''))
    || outbox.message_id !== 'weekly_newsletter'
    || outbox.classification !== 'marketing'
    || outbox.business_object_type !== 'weekly_newsletter_edition'
    || !/^20\d{2}-\d{2}-\d{2}$/.test(String(outbox.business_object_id ?? ''))
    || typeof outbox.recipient_email_normalized !== 'string'
    || !outbox.recipient_email_normalized
    || outbox.template_id !== 'weekly_newsletter'
    || outbox.template_version !== 'weekly-newsletter-v1'
    || outbox.provider !== 'resend'
    || outbox.consent_required !== true
    || !UUID_PATTERN.test(String(outbox.consent_record_id ?? ''))
    || outbox.consent_purpose !== 'weekly_newsletter'
    || !outbox.consent_checked_at
    || outbox.payload?.weekEnding !== outbox.business_object_id
    || !CHECKSUM_PATTERN.test(String(outbox.payload?.editionChecksum ?? ''))
  ) {
    throw new WeeklyNewsletterDispatchError(
      'Weekly Newsletter outbox evidence is outside the approved dispatch contract.',
      'INVALID_WEEKLY_NEWSLETTER_OUTBOX',
      503,
    );
  }
  return outbox;
}

function timestampMs(value) {
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function hasAcceptedProviderState(outbox) {
  return typeof outbox.provider_message_ref === 'string'
    && outbox.provider_message_ref.trim().length > 0
    && timestampMs(outbox.accepted_at) !== null;
}

export function resolveWeeklyNewsletterDispatchDecision(outbox, nowMs = Date.now()) {
  const state = requireOutbox(outbox);
  const status = String(state.status ?? '');

  if (status === 'accepted' || status === 'delivered') {
    return hasAcceptedProviderState(state)
      ? Object.freeze({ action: 'complete', reason: status })
      : Object.freeze({ action: 'reconcile', reason: 'incomplete-provider-state' });
  }
  if (TERMINAL_STATUSES.has(status)) {
    return Object.freeze({ action: 'blocked', reason: status });
  }
  if (status === 'queued') {
    const attempts = Number.isInteger(state.attempt_count) ? state.attempt_count : 0;
    return attempts === 0
      ? Object.freeze({ action: 'send', reason: 'queued' })
      : Object.freeze({ action: 'reconcile', reason: 'queued-after-attempt' });
  }
  if (status === 'sending') {
    if (hasAcceptedProviderState(state)) {
      return Object.freeze({ action: 'complete', reason: 'accepted-provider-state' });
    }
    const createdAt = timestampMs(state.created_at);
    const age = createdAt === null ? null : nowMs - createdAt;
    return age !== null && age >= 0 && age <= PROVIDER_RETRY_WINDOW_MS
      ? Object.freeze({ action: 'send', reason: 'idempotent-sending-retry' })
      : Object.freeze({ action: 'reconcile', reason: 'expired-sending-window' });
  }
  if (status === 'retry_scheduled') {
    if (hasAcceptedProviderState(state)) {
      return Object.freeze({ action: 'complete', reason: 'accepted-provider-state' });
    }
    const nextAttemptAt = timestampMs(state.next_attempt_at);
    if (nextAttemptAt === null) return Object.freeze({ action: 'reconcile', reason: 'invalid-next-attempt' });
    if (nextAttemptAt > nowMs) return Object.freeze({ action: 'wait', reason: 'retry-not-due' });
    const createdAt = timestampMs(state.created_at);
    const age = createdAt === null ? null : nowMs - createdAt;
    return age !== null && age >= 0 && age <= PROVIDER_RETRY_WINDOW_MS
      ? Object.freeze({ action: 'send', reason: 'idempotent-scheduled-retry' })
      : Object.freeze({ action: 'reconcile', reason: 'expired-retry-window' });
  }
  return Object.freeze({ action: 'reconcile', reason: 'unknown-status' });
}

function providerIdempotencyKey(outbox) {
  const match = String(outbox.idempotency_key ?? '').match(PROVIDER_IDEMPOTENCY_PATTERN);
  if (!match) {
    throw new WeeklyNewsletterDispatchError(
      'Weekly Newsletter provider idempotency identity is invalid.',
      'INVALID_PROVIDER_IDEMPOTENCY_KEY',
      503,
    );
  }
  return `weekly-newsletter/${match[1]}`;
}

function requireArtifactBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value ?? '').trim());
  } catch {
    throw new WeeklyNewsletterDispatchError(
      'Weekly Newsletter artifact base URL is invalid.',
      'INVALID_WEEKLY_NEWSLETTER_ARTIFACT_BASE_URL',
      503,
    );
  }
  const vercelPreview = url.protocol === 'https:'
    && url.hostname.startsWith('usd-impact-site')
    && url.hostname.endsWith('.vercel.app');
  const canonical = url.origin === 'https://www.usd-impact.com';
  if ((!vercelPreview && !canonical) || url.username || url.password) {
    throw new WeeklyNewsletterDispatchError(
      'Weekly Newsletter artifact base URL is outside the approved origin set.',
      'INVALID_WEEKLY_NEWSLETTER_ARTIFACT_BASE_URL',
      503,
    );
  }
  return url.origin;
}

export async function loadWeeklyNewsletterEditionArtifact({
  weekEnding,
  expectedChecksum,
  baseUrl,
  fetchImpl = fetch,
} = {}) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(String(weekEnding ?? '')) || !CHECKSUM_PATTERN.test(String(expectedChecksum ?? ''))) {
    throw new WeeklyNewsletterDispatchError(
      'Weekly Newsletter artifact identity is invalid.',
      'INVALID_WEEKLY_NEWSLETTER_ARTIFACT_IDENTITY',
      503,
    );
  }
  const origin = requireArtifactBaseUrl(baseUrl);
  const url = `${origin}/newsletter/weekly/${weekEnding}.json`;
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new WeeklyNewsletterDispatchError(
      `Weekly Newsletter artifact fetch failed with status ${response.status}.`,
      'WEEKLY_NEWSLETTER_ARTIFACT_FETCH_FAILED',
      503,
    );
  }
  const artifact = await readJsonSafely(response);
  let verified;
  try {
    verified = verifyWeeklyNewsletterEditionArtifact(artifact);
  } catch (error) {
    throw new WeeklyNewsletterDispatchError(
      `Weekly Newsletter artifact verification failed: ${error?.code || 'INVALID_ARTIFACT'}.`,
      'WEEKLY_NEWSLETTER_ARTIFACT_INVALID',
      503,
    );
  }
  if (verified.checksum !== expectedChecksum || verified.payload.weekEnding !== weekEnding) {
    throw new WeeklyNewsletterDispatchError(
      'Weekly Newsletter artifact does not match the durable outbox intent.',
      'WEEKLY_NEWSLETTER_ARTIFACT_MISMATCH',
      503,
    );
  }
  return verified;
}

async function loadActiveConsentGrant({ config, outbox, fetchImpl }) {
  const grants = await serviceRequest({
    config,
    path: `/rest/v1/marketing_consent_events?id=eq.${encodeURIComponent(outbox.consent_record_id)}&select=id,idempotency_key,email_normalized,user_id,purpose,status,consent_text_version,privacy_notice_version,provider_contact_ref,captured_at&limit=2`,
    fetchImpl,
  });
  if (!Array.isArray(grants) || grants.length !== 1) return null;
  const grant = grants[0];
  if (
    grant.id !== outbox.consent_record_id
    || grant.status !== 'granted'
    || grant.purpose !== 'weekly_newsletter'
    || grant.email_normalized !== outbox.recipient_email_normalized
  ) return null;

  const withdrawals = await serviceRequest({
    config,
    path: `/rest/v1/marketing_consent_events?status=eq.withdrawn&related_grant_id=eq.${encodeURIComponent(grant.id)}&select=id,related_grant_id,withdrawn_at&limit=1`,
    fetchImpl,
  });
  if (!Array.isArray(withdrawals) || withdrawals.length > 0) return null;
  return Object.freeze({ ...grant });
}

async function loadProviderBlock({ config, outbox, fetchImpl }) {
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/notification_outbox?recipient_email_normalized=eq.${encodeURIComponent(outbox.recipient_email_normalized)}&status=in.(hard_bounced,complained,suppressed)&select=id,status&order=created_at.desc&limit=1`,
    fetchImpl,
  });
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function loadLastCompletedWeek({ config, outbox, fetchImpl }) {
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/notification_outbox?recipient_email_normalized=eq.${encodeURIComponent(outbox.recipient_email_normalized)}&message_id=eq.weekly_newsletter&status=in.(accepted,delivered)&select=id,business_object_id&order=business_object_id.desc&limit=1`,
    fetchImpl,
  });
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return String(rows[0].business_object_id ?? '') || null;
}

async function patchOutbox({ config, outbox, body, fetchImpl }) {
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/notification_outbox?id=eq.${encodeURIComponent(outbox.id)}`,
    method: 'PATCH',
    body,
    prefer: 'return=representation',
    fetchImpl,
  });
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new WeeklyNewsletterDispatchError(
      'Weekly Newsletter outbox state could not be advanced.',
      'WEEKLY_NEWSLETTER_OUTBOX_UPDATE_FAILED',
      503,
    );
  }
  return Object.freeze({ ...rows[0] });
}

function safeErrorCode(value, fallback = 'WEEKLY_NEWSLETTER_SEND_FAILED') {
  const code = String(value ?? '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9_]{1,79}$/.test(code) ? code : fallback;
}

async function cancelOutbox({ config, outbox, errorCode, fetchImpl }) {
  return patchOutbox({
    config,
    outbox,
    body: { status: 'cancelled', error_code: safeErrorCode(errorCode, 'WEEKLY_NEWSLETTER_CANCELLED') },
    fetchImpl,
  });
}

async function markSuppressed({ config, outbox, errorCode, nowIso, fetchImpl }) {
  return patchOutbox({
    config,
    outbox,
    body: { status: 'suppressed', failed_at: nowIso, error_code: safeErrorCode(errorCode, 'RECIPIENT_PROVIDER_BLOCKED') },
    fetchImpl,
  });
}

async function markSending({ config, outbox, nowIso, fetchImpl }) {
  const attempts = Number.isInteger(outbox.attempt_count) ? outbox.attempt_count : 0;
  return patchOutbox({
    config,
    outbox,
    body: {
      status: 'sending',
      attempt_count: attempts + 1,
      next_attempt_at: nowIso,
      error_code: null,
    },
    fetchImpl,
  });
}

async function markAccepted({ config, outbox, result, fetchImpl }) {
  return patchOutbox({
    config,
    outbox,
    body: {
      status: 'accepted',
      provider_message_ref: result.messageRef,
      accepted_at: result.occurredAt,
      error_code: null,
    },
    fetchImpl,
  });
}

async function markRetry({ config, outbox, error, nowMs, fetchImpl }) {
  return patchOutbox({
    config,
    outbox,
    body: {
      status: 'retry_scheduled',
      next_attempt_at: new Date(nowMs + RETRY_DELAY_MS).toISOString(),
      error_code: safeErrorCode(error?.code),
    },
    fetchImpl,
  });
}

async function markTerminal({ config, outbox, error, nowIso, fetchImpl }) {
  const status = error?.providerState === 'suppressed' ? 'suppressed' : 'terminal_failed';
  return patchOutbox({
    config,
    outbox,
    body: {
      status,
      failed_at: nowIso,
      error_code: safeErrorCode(error?.code),
    },
    fetchImpl,
  });
}

export async function enqueueWeeklyNewsletterOutbox({
  candidate,
  artifact,
  consentCheckedAt = new Date().toISOString(),
  environment = process.env,
  fetchImpl = fetch,
} = {}) {
  const config = readDevelopmentConfig(environment);
  const verified = verifyWeeklyNewsletterEditionArtifact(artifact);
  if (
    verified.payload.weekEnding !== candidate?.weekEnding
    || JSON.stringify(verified.payload) !== JSON.stringify(candidate?.payload)
  ) {
    throw new WeeklyNewsletterDispatchError(
      'Weekly Newsletter candidate does not match its verified edition artifact.',
      'WEEKLY_NEWSLETTER_CANDIDATE_ARTIFACT_MISMATCH',
      503,
    );
  }
  const record = createWeeklyNewsletterOutboxRecord({
    candidate,
    editionChecksum: verified.checksum,
    consentCheckedAt,
  });
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
  const existing = await serviceRequest({
    config,
    path: `/rest/v1/notification_outbox?idempotency_key=eq.${encodeURIComponent(record.idempotency_key)}&select=*&limit=2`,
    fetchImpl,
  });
  if (!Array.isArray(existing) || existing.length !== 1) {
    throw new WeeklyNewsletterDispatchError(
      'Weekly Newsletter outbox could not be loaded after an idempotency conflict.',
      'WEEKLY_NEWSLETTER_OUTBOX_MISSING',
      503,
    );
  }
  const loaded = requireOutbox(existing[0]);
  if (
    loaded.recipient_email_normalized !== record.recipient_email_normalized
    || loaded.business_object_id !== record.business_object_id
    || loaded.consent_record_id !== record.consent_record_id
    || loaded.payload?.editionChecksum !== record.payload.editionChecksum
  ) {
    throw new WeeklyNewsletterDispatchError(
      'Existing Weekly Newsletter outbox identity conflicts with the requested edition.',
      'WEEKLY_NEWSLETTER_OUTBOX_CONFLICT',
      503,
    );
  }
  return Object.freeze({ created: false, outbox: Object.freeze({ ...loaded }) });
}

export async function deliverWeeklyNewsletterOutbox({
  outbox,
  artifactBaseUrl,
  unsubscribeBaseUrl,
  environment = process.env,
  databaseFetch = fetch,
  artifactFetch = fetch,
  providerFetch = fetch,
  now = () => new Date(),
  artifactLoader = loadWeeklyNewsletterEditionArtifact,
  adapterFactory = createWeeklyNewsletterResendAdapter,
} = {}) {
  const evidence = requireOutbox(outbox);
  const currentTime = now();
  if (!(currentTime instanceof Date) || !Number.isFinite(currentTime.getTime())) {
    throw new WeeklyNewsletterDispatchError('Weekly Newsletter dispatch clock is invalid.', 'INVALID_DISPATCH_CLOCK', 503);
  }
  const nowMs = currentTime.getTime();
  const decision = resolveWeeklyNewsletterDispatchDecision(evidence, nowMs);
  if (decision.action === 'complete') {
    return Object.freeze({ sent: false, state: 'complete', reason: decision.reason, outbox: evidence });
  }
  if (decision.action === 'blocked') {
    return Object.freeze({ sent: false, state: 'blocked', reason: decision.reason, outbox: evidence });
  }
  if (decision.action === 'wait') {
    return Object.freeze({ sent: false, state: 'waiting', reason: decision.reason, outbox: evidence });
  }
  if (decision.action !== 'send') {
    throw new WeeklyNewsletterDispatchError(
      'Weekly Newsletter delivery state requires reconciliation before another provider request.',
      'WEEKLY_NEWSLETTER_RECONCILE_REQUIRED',
      503,
    );
  }

  const config = readDevelopmentConfig(environment);
  const artifact = await artifactLoader({
    weekEnding: evidence.payload.weekEnding,
    expectedChecksum: evidence.payload.editionChecksum,
    baseUrl: artifactBaseUrl || environment.WEEKLY_NEWSLETTER_ARTIFACT_BASE_URL,
    fetchImpl: artifactFetch,
  });

  const grant = await loadActiveConsentGrant({ config, outbox: evidence, fetchImpl: databaseFetch });
  if (!grant) {
    const cancelled = await cancelOutbox({
      config,
      outbox: evidence,
      errorCode: 'CONSENT_WITHDRAWN',
      fetchImpl: databaseFetch,
    });
    return Object.freeze({ sent: false, state: 'cancelled', reason: 'consent_not_active', outbox: cancelled });
  }

  const providerBlock = await loadProviderBlock({ config, outbox: evidence, fetchImpl: databaseFetch });
  if (providerBlock) {
    const suppressed = await markSuppressed({
      config,
      outbox: evidence,
      errorCode: 'RECIPIENT_PROVIDER_BLOCKED',
      nowIso: currentTime.toISOString(),
      fetchImpl: databaseFetch,
    });
    return Object.freeze({ sent: false, state: 'suppressed', reason: providerBlock.status, outbox: suppressed });
  }

  const lastSentWeekEnding = await loadLastCompletedWeek({ config, outbox: evidence, fetchImpl: databaseFetch });
  const candidate = evaluateWeeklyNewsletterCandidate({
    payload: artifact.payload,
    consentGrant: grant,
    providerSuppressed: false,
    lastSentWeekEnding,
    now: currentTime.toISOString(),
  });
  if (!candidate.eligible) {
    const cancelled = await cancelOutbox({
      config,
      outbox: evidence,
      errorCode: candidate.reason === 'weekly_report_stale' ? 'WEEKLY_EDITION_STALE' : 'WEEKLY_EDITION_SUPPRESSED',
      fetchImpl: databaseFetch,
    });
    return Object.freeze({ sent: false, state: 'cancelled', reason: candidate.reason, outbox: cancelled });
  }

  const email = buildWeeklyNewsletterEmail({
    candidate,
    unsubscribeSecret: environment.MARKETING_OPT_IN_SECRET,
    baseUrl: unsubscribeBaseUrl || environment.WEEKLY_NEWSLETTER_PUBLIC_BASE_URL,
  });
  const adapter = adapterFactory({ environment, fetchImpl: providerFetch, now });
  const sending = await markSending({
    config,
    outbox: evidence,
    nowIso: currentTime.toISOString(),
    fetchImpl: databaseFetch,
  });

  try {
    const result = await adapter.send({
      provider: 'resend',
      to: [email.to],
      idempotencyKey: providerIdempotencyKey(evidence),
      subject: email.subject,
      text: email.text,
      html: email.html,
      headers: email.headers,
    });
    const accepted = await markAccepted({ config, outbox: sending, result, fetchImpl: databaseFetch });
    return Object.freeze({
      sent: true,
      state: 'accepted',
      reason: decision.reason,
      providerMessageRef: result.messageRef,
      outbox: accepted,
    });
  } catch (error) {
    if (error instanceof WeeklyNewsletterResendRequestError && error.retryable) {
      await markRetry({ config, outbox: sending, error, nowMs, fetchImpl: databaseFetch });
      throw new WeeklyNewsletterDispatchError(
        'Weekly Newsletter provider delivery is scheduled for a safe retry.',
        safeErrorCode(error.code),
        503,
      );
    }
    if (
      error instanceof WeeklyNewsletterResendRequestError
      || error instanceof WeeklyNewsletterResendConfigurationError
    ) {
      if (error instanceof WeeklyNewsletterResendRequestError) {
        await markTerminal({
          config,
          outbox: sending,
          error,
          nowIso: currentTime.toISOString(),
          fetchImpl: databaseFetch,
        });
      }
      throw new WeeklyNewsletterDispatchError(
        'Weekly Newsletter provider delivery failed safely.',
        safeErrorCode(error.code, 'WEEKLY_NEWSLETTER_DELIVERY_CONFIGURATION_ERROR'),
        503,
      );
    }
    throw error;
  }
}
