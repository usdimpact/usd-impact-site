import { buildMarketingOptInConfirmationEmail } from './marketing-opt-in-email-template.js';
import {
  MARKETING_OPT_IN_DEVELOPMENT_PROJECT_REF,
  MARKETING_OPT_IN_MESSAGE_ID,
  MARKETING_OPT_IN_TEMPLATE_ID,
  MarketingOptInReadinessError,
  createMarketingOptInTokenForOutbox,
} from './marketing-opt-in-readiness.js';
import { createMarketingOptInConfirmationUrl } from './marketing-opt-in-token.js';
import {
  MarketingOptInResendConfigurationError,
  MarketingOptInResendRequestError,
  createMarketingOptInResendAdapter,
} from './marketing-opt-in-resend-adapter.js';
import { readSupabaseServerConfig } from './supabase-server.js';

const PROVIDER_IDEMPOTENCY_PATTERN = /^notification:v1:([0-9a-f]{64})$/;
const PROVIDER_RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;
const RETRY_DELAY_MS = 5 * 60 * 1000;
const COMPLETE_STATUSES = new Set(['accepted', 'delivered']);
const BLOCKED_STATUSES = new Set([
  'soft_bounced',
  'hard_bounced',
  'complained',
  'suppressed',
  'terminal_failed',
  'cancelled',
]);

export class MarketingOptInDeliveryError extends Error {
  constructor(message, code = 'MARKETING_OPT_IN_DELIVERY_FAILED', status = 503) {
    super(message);
    this.name = 'MarketingOptInDeliveryError';
    this.code = code;
    this.status = status;
  }
}

function timestampMs(value) {
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
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

function requireDevelopmentConfig(environment) {
  if (environment.EMAIL_READINESS_LEDGER_ENABLED !== 'true') {
    throw new MarketingOptInDeliveryError('Email ledger is not enabled.', 'EMAIL_LEDGER_DISABLED', 503);
  }
  const vercelEnvironment = String(environment.VERCEL_ENV ?? '').trim().toLowerCase();
  if (vercelEnvironment === 'production') {
    throw new MarketingOptInDeliveryError(
      'Marketing opt-in delivery is hard-disabled in Production for this implementation slice.',
      'PRODUCTION_OPT_IN_DELIVERY_BLOCKED',
      503,
    );
  }
  if (!['preview', 'development'].includes(vercelEnvironment)) {
    throw new MarketingOptInDeliveryError(
      'Marketing opt-in delivery requires Development or Preview.',
      'UNAPPROVED_DELIVERY_ENVIRONMENT',
      503,
    );
  }

  let config;
  try {
    config = readSupabaseServerConfig(environment, { requireSecret: true });
  } catch {
    throw new MarketingOptInDeliveryError(
      'Email opt-in database configuration is unavailable.',
      'EMAIL_OPT_IN_DATABASE_CONFIGURATION_ERROR',
      503,
    );
  }
  if (projectRefFromUrl(config.url) !== MARKETING_OPT_IN_DEVELOPMENT_PROJECT_REF) {
    throw new MarketingOptInDeliveryError(
      'Non-production marketing opt-in delivery must target the canonical Development database.',
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

async function databaseRequest({ config, path, method = 'GET', body, prefer, fetchImpl = fetch }) {
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
    throw new MarketingOptInDeliveryError(
      `Email opt-in delivery database request failed with status ${response.status}.`,
      'EMAIL_OPT_IN_DATABASE_REQUEST_FAILED',
      503,
    );
  }
  return payload;
}

function validateOutbox(outbox) {
  if (
    !outbox
    || typeof outbox !== 'object'
    || typeof outbox.id !== 'string'
    || !outbox.id
    || outbox.message_id !== MARKETING_OPT_IN_MESSAGE_ID
    || outbox.template_id !== MARKETING_OPT_IN_TEMPLATE_ID
    || outbox.classification !== 'operational'
    || outbox.business_object_type !== 'marketing_opt_in_request'
    || typeof outbox.business_object_id !== 'string'
    || !outbox.business_object_id
    || typeof outbox.recipient_email_normalized !== 'string'
    || !outbox.recipient_email_normalized
    || outbox.provider !== 'resend'
    || outbox.consent_required !== false
    || outbox.consent_record_id != null
    || outbox.consent_purpose != null
    || outbox.consent_checked_at != null
    || !['weekly_newsletter', 'learning_progress_updates'].includes(outbox.payload?.purpose)
    || outbox.payload?.locale !== 'en'
    || !Number.isSafeInteger(outbox.payload?.issuedAt)
  ) {
    throw new MarketingOptInDeliveryError(
      'Marketing opt-in outbox evidence is outside the approved delivery contract.',
      'INVALID_OPT_IN_DELIVERY_EVIDENCE',
      503,
    );
  }
  return outbox;
}

function hasAcceptedProviderState(outbox) {
  return typeof outbox?.provider_message_ref === 'string'
    && outbox.provider_message_ref.trim().length > 0
    && timestampMs(outbox.accepted_at) !== null;
}

export function resolveMarketingOptInDeliveryDecision(outbox, nowMs = Date.now()) {
  validateOutbox(outbox);
  const status = String(outbox.status ?? '');

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
    const createdAt = timestampMs(outbox.created_at);
    const age = createdAt === null ? null : nowMs - createdAt;
    return age !== null && age >= 0 && age <= PROVIDER_RETRY_WINDOW_MS
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
    const createdAt = timestampMs(outbox.created_at);
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
    throw new MarketingOptInDeliveryError(
      'Marketing opt-in provider idempotency identity is invalid.',
      'INVALID_PROVIDER_IDEMPOTENCY_KEY',
      503,
    );
  }
  return `marketing-opt-in/${match[1]}`;
}

async function patchOutbox({ config, outbox, body, fetchImpl }) {
  const rows = await databaseRequest({
    config,
    path: `/rest/v1/notification_outbox?id=eq.${encodeURIComponent(outbox.id)}`,
    method: 'PATCH',
    body,
    prefer: 'return=representation',
    fetchImpl,
  });
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new MarketingOptInDeliveryError(
      'Marketing opt-in outbox state could not be advanced.',
      'OPT_IN_OUTBOX_UPDATE_FAILED',
      503,
    );
  }
  return Object.freeze({ ...rows[0] });
}

async function markSending({ config, outbox, attemptedAt, fetchImpl }) {
  const attempts = Number.isInteger(outbox.attempt_count) ? outbox.attempt_count : 0;
  return patchOutbox({
    config,
    outbox,
    body: {
      status: 'sending',
      attempt_count: attempts + 1,
      next_attempt_at: attemptedAt,
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

function safeErrorCode(value, fallback = 'RESEND_SEND_FAILED') {
  const code = String(value ?? '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9_]{1,79}$/.test(code) ? code : fallback;
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
  const providerState = error?.providerState === 'suppressed' ? 'suppressed' : 'terminal_failed';
  return patchOutbox({
    config,
    outbox,
    body: {
      status: providerState,
      failed_at: nowIso,
      error_code: safeErrorCode(error?.code),
    },
    fetchImpl,
  });
}

export async function deliverMarketingOptInConfirmation({
  outbox,
  baseUrl,
  environment = process.env,
  databaseFetch = fetch,
  providerFetch = fetch,
  now = () => new Date(),
  adapterFactory = createMarketingOptInResendAdapter,
} = {}) {
  const evidence = validateOutbox(outbox);
  const currentTime = now();
  if (!(currentTime instanceof Date) || !Number.isFinite(currentTime.getTime())) {
    throw new MarketingOptInDeliveryError('Delivery clock is invalid.', 'INVALID_DELIVERY_CLOCK', 503);
  }
  const nowMs = currentTime.getTime();
  const decision = resolveMarketingOptInDeliveryDecision(evidence, nowMs);
  if (decision.action === 'complete') {
    return Object.freeze({ sent: false, state: 'complete', reason: decision.reason, outbox: evidence });
  }
  if (decision.action === 'blocked') {
    throw new MarketingOptInDeliveryError(
      'This opt-in confirmation can no longer be delivered.',
      'OPT_IN_DELIVERY_BLOCKED',
      410,
    );
  }
  if (decision.action === 'wait') {
    return Object.freeze({ sent: false, state: 'waiting', reason: decision.reason, outbox: evidence });
  }
  if (decision.action !== 'send') {
    throw new MarketingOptInDeliveryError(
      'Opt-in delivery state requires reconciliation before another provider request.',
      'OPT_IN_DELIVERY_RECONCILE_REQUIRED',
      503,
    );
  }

  const config = requireDevelopmentConfig(environment);
  const token = createMarketingOptInTokenForOutbox({
    outbox: evidence,
    secret: environment.MARKETING_OPT_IN_SECRET,
  });
  const confirmationUrl = createMarketingOptInConfirmationUrl({ token, baseUrl });
  const email = buildMarketingOptInConfirmationEmail({
    purpose: evidence.payload.purpose,
    confirmationUrl,
  });
  const adapter = adapterFactory({
    environment,
    fetchImpl: providerFetch,
    now,
  });

  const sending = await markSending({
    config,
    outbox: evidence,
    attemptedAt: currentTime.toISOString(),
    fetchImpl: databaseFetch,
  });

  try {
    const result = await adapter.send({
      to: evidence.recipient_email_normalized,
      idempotencyKey: providerIdempotencyKey(evidence),
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    const accepted = await markAccepted({
      config,
      outbox: sending,
      result,
      fetchImpl: databaseFetch,
    });
    return Object.freeze({
      sent: true,
      state: 'accepted',
      reason: decision.reason,
      providerMessageRef: result.messageRef,
      outbox: accepted,
    });
  } catch (error) {
    if (error instanceof MarketingOptInResendRequestError && error.retryable) {
      await markRetry({ config, outbox: sending, error, nowMs, fetchImpl: databaseFetch });
      throw new MarketingOptInDeliveryError(
        'The confirmation email was not accepted yet and is scheduled for a safe retry.',
        safeErrorCode(error.code),
        503,
      );
    }
    if (
      error instanceof MarketingOptInResendRequestError
      || error instanceof MarketingOptInResendConfigurationError
    ) {
      if (error instanceof MarketingOptInResendRequestError) {
        await markTerminal({
          config,
          outbox: sending,
          error,
          nowIso: currentTime.toISOString(),
          fetchImpl: databaseFetch,
        });
      }
      throw new MarketingOptInDeliveryError(
        'The confirmation email could not be delivered safely.',
        safeErrorCode(error.code, 'OPT_IN_DELIVERY_CONFIGURATION_ERROR'),
        503,
      );
    }
    throw error;
  }
}

export function isMarketingOptInDeliveryError(error) {
  return error instanceof MarketingOptInDeliveryError
    || error instanceof MarketingOptInReadinessError
    || error instanceof MarketingOptInResendRequestError
    || error instanceof MarketingOptInResendConfigurationError;
}
