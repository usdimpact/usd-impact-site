import { isProviderManagedAuthSuccess } from './resend-auth-notification-boundary.js';
import { isExternallyManagedSpanishNewsletterEvent } from './resend-shared-account-boundary.js';
import { isForeignUsdImpactResendEvent } from './resend-routing-tags.js';
import {
  RESEND_WEBHOOK_MAX_BYTES,
  ResendWebhookVerificationError,
  planResendOutboxTransition,
  verifyResendWebhook,
} from './resend-webhook.js';
import {
  SupabaseConfigurationError,
  readSupabaseServerConfig,
  requestHeader,
} from './supabase-server.js';
import {
  LAUNCH_EMAIL_DEVELOPMENT_PROJECT_REF,
  LAUNCH_EMAIL_PRODUCTION_PROJECT_REF,
  projectRefFromUrl,
} from './launch-email-dispatch-common.js';

const MAX_OUTBOX_UPDATE_ATTEMPTS = 3;

const JSON_HEADERS = Object.freeze({
  Accept: 'application/json',
  'Content-Type': 'application/json',
});

class WebhookProcessingError extends Error {
  constructor(message, code = 'WEBHOOK_PROCESSING_FAILED') {
    super(message);
    this.name = 'WebhookProcessingError';
    this.code = code;
  }
}

function assertExpectedWebhookProject(config, environment) {
  const vercelEnvironment = String(environment.VERCEL_ENV || '').trim().toLowerCase();
  const expectedRef = vercelEnvironment === 'production'
    ? LAUNCH_EMAIL_PRODUCTION_PROJECT_REF
    : vercelEnvironment === 'preview' || vercelEnvironment === 'development'
      ? LAUNCH_EMAIL_DEVELOPMENT_PROJECT_REF
      : null;

  if (!expectedRef) {
    throw new WebhookProcessingError(
      'Resend webhook requires an explicit Production, Preview, or Development environment.',
      'UNAPPROVED_WEBHOOK_ENVIRONMENT',
    );
  }

  if (projectRefFromUrl(config.url) !== expectedRef) {
    throw new WebhookProcessingError(
      'Resend webhook Supabase target does not match the canonical environment project.',
      'UNEXPECTED_SUPABASE_PROJECT',
    );
  }
  return expectedRef;
}

function sendJson(response, status, body, extraHeaders = {}) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);
  response.end(JSON.stringify(body));
}

async function readRawBody(request, maxBytes = RESEND_WEBHOOK_MAX_BYTES) {
  if (request && typeof request[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    let total = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > maxBytes) throw new WebhookProcessingError('Webhook body is too large.', 'WEBHOOK_TOO_LARGE');
      chunks.push(buffer);
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  if (request && typeof request.text === 'function') {
    const text = await request.text();
    if (Buffer.byteLength(text) > maxBytes) {
      throw new WebhookProcessingError('Webhook body is too large.', 'WEBHOOK_TOO_LARGE');
    }
    return text;
  }

  if (Buffer.isBuffer(request?.rawBody) || typeof request?.rawBody === 'string') {
    const buffer = Buffer.isBuffer(request.rawBody) ? request.rawBody : Buffer.from(request.rawBody);
    if (buffer.length > maxBytes) throw new WebhookProcessingError('Webhook body is too large.', 'WEBHOOK_TOO_LARGE');
    return buffer.toString('utf8');
  }

  if (Buffer.isBuffer(request?.body) || typeof request?.body === 'string') {
    const buffer = Buffer.isBuffer(request.body) ? request.body : Buffer.from(request.body);
    if (buffer.length > maxBytes) throw new WebhookProcessingError('Webhook body is too large.', 'WEBHOOK_TOO_LARGE');
    return buffer.toString('utf8');
  }

  throw new WebhookProcessingError('Raw webhook body is unavailable.', 'RAW_BODY_UNAVAILABLE');
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
      ...JSON_HEADERS,
      // The server config requires an opaque sb_secret_ API key, not a JWT.
      // Supabase accepts this on apikey; Bearer sb_secret_ is not a JWT and
      // can be rejected by PostgREST. Never emit it as Authorization.
      apikey: config.secretKey,
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await readJsonSafely(response);
  if (!response.ok) {
    throw new WebhookProcessingError(
      `Supabase webhook state request failed with status ${response.status}.`,
      'WEBHOOK_STATE_REQUEST_FAILED',
    );
  }
  return payload;
}

async function loadReceipt(config, svixId, fetchImpl) {
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/webhook_receipts?provider=eq.resend&provider_event_id=eq.${encodeURIComponent(svixId)}&select=id,provider,provider_event_id,event_type,payload_sha256,status,attempt_count&limit=1`,
    fetchImpl,
  });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function beginReceipt({ config, verified, fetchImpl }) {
  const inserted = await serviceRequest({
    config,
    path: '/rest/v1/webhook_receipts?on_conflict=provider,provider_event_id',
    method: 'POST',
    body: {
      provider: 'resend',
      provider_event_id: verified.svixId,
      event_type: verified.event.type,
      payload_sha256: verified.payloadSha256,
      status: 'received',
      attempt_count: 1,
    },
    prefer: 'resolution=ignore-duplicates,return=representation',
    fetchImpl,
  });

  if (Array.isArray(inserted) && inserted.length) {
    return Object.freeze({ receipt: inserted[0], duplicate: false, complete: false });
  }

  const existing = await loadReceipt(config, verified.svixId, fetchImpl);
  if (!existing) throw new WebhookProcessingError('Webhook receipt conflict could not be resolved.', 'WEBHOOK_RECEIPT_MISSING');
  if (existing.payload_sha256 !== verified.payloadSha256 || existing.event_type !== verified.event.type) {
    throw new WebhookProcessingError('Webhook event identity conflicts with an existing receipt.', 'WEBHOOK_RECEIPT_CONFLICT');
  }
  if (existing.status === 'processed' || existing.status === 'ignored') {
    return Object.freeze({ receipt: existing, duplicate: true, complete: true });
  }

  const observedAttempt = existing.attempt_count;
  if (!Number.isSafeInteger(observedAttempt) || observedAttempt < 1
      || !['received', 'failed'].includes(existing.status)) {
    throw new WebhookProcessingError(
      'Webhook receipt retry state is invalid.',
      'INVALID_WEBHOOK_RECEIPT_STATE',
    );
  }
  const attemptCount = observedAttempt + 1;
  // Reclaim an incomplete receipt only if status AND attempt count are still
  // the values read above. A concurrent completion must never become received.
  const updated = await serviceRequest({
    config,
    path: `/rest/v1/webhook_receipts?id=eq.${encodeURIComponent(existing.id)}&status=eq.${existing.status}&attempt_count=eq.${observedAttempt}&select=id,status,attempt_count`,
    method: 'PATCH',
    body: { status: 'received', attempt_count: attemptCount, last_error: null },
    prefer: 'return=representation',
    fetchImpl,
  });
  if (!Array.isArray(updated) || updated.length > 1
      || updated.some((row) => row?.id !== existing.id
        || row.status !== 'received' || row.attempt_count !== attemptCount)) {
    throw new WebhookProcessingError('Webhook receipt compare-and-set returned invalid evidence.',
      'INVALID_WEBHOOK_RECEIPT_UPDATE');
  }
  if (updated.length === 0) {
    const latest = await loadReceipt(config, verified.svixId, fetchImpl);
    if (!latest || latest.payload_sha256 !== verified.payloadSha256
        || latest.event_type !== verified.event.type) {
      throw new WebhookProcessingError('Webhook receipt identity changed during retry.',
        'WEBHOOK_RECEIPT_CONFLICT');
    }
    if (latest.status === 'processed' || latest.status === 'ignored') {
      return Object.freeze({ receipt: latest, duplicate: true, complete: true });
    }
    throw new WebhookProcessingError('Webhook receipt changed during retry.',
      'WEBHOOK_RECEIPT_CONTENDED');
  }
  return Object.freeze({ receipt: updated[0], duplicate: true, complete: false });
}

async function finishReceipt({ config, receipt, status, lastError = null, fetchImpl, now = new Date() }) {
  if (!receipt || typeof receipt.id !== 'string'
      || !Number.isSafeInteger(receipt.attempt_count) || receipt.attempt_count < 1) {
    throw new WebhookProcessingError('Webhook receipt identity is invalid.',
      'INVALID_WEBHOOK_RECEIPT_STATE');
  }
  // Only the attempt that owns the observed receipt version can finish it.
  // A stale success or failure must not overwrite a later terminal result.
  const updated = await serviceRequest({
    config,
    path: `/rest/v1/webhook_receipts?id=eq.${encodeURIComponent(receipt.id)}&status=eq.received&attempt_count=eq.${receipt.attempt_count}&select=id,status,attempt_count`,
    method: 'PATCH',
    body: {
      status,
      processed_at: status === 'processed' || status === 'ignored' ? now.toISOString() : null,
      last_error: lastError,
    },
    prefer: 'return=representation',
    fetchImpl,
  });
  if (!Array.isArray(updated) || updated.length > 1
      || updated.some((row) => row?.id !== receipt.id
        || row.status !== status || row.attempt_count !== receipt.attempt_count)) {
    throw new WebhookProcessingError('Webhook receipt completion returned invalid evidence.',
      'INVALID_WEBHOOK_RECEIPT_UPDATE');
  }
  if (updated.length === 0) {
    throw new WebhookProcessingError('Webhook receipt changed before completion.',
      'WEBHOOK_RECEIPT_CONTENDED');
  }
}

async function readOutboxMatch(config, emailId, fetchImpl) {
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/notification_outbox?provider=eq.resend&provider_message_ref=eq.${encodeURIComponent(emailId)}&select=id,status,provider_message_ref&limit=2`,
    fetchImpl,
  });
  if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== 'object'
      || Array.isArray(row) || typeof row.id !== 'string' || !row.id
      || typeof row.status !== 'string' || !row.status
      || row.provider_message_ref !== emailId)) {
    throw new WebhookProcessingError('Resend outbox lookup returned invalid evidence.', 'INVALID_OUTBOX_RESPONSE');
  }
  return rows;
}

async function applyDeliveryEvent({ config, verified, fetchImpl, environment }) {
  if (!verified.event.trackedDeliveryEvent || !verified.event.emailId) {
    return Object.freeze({ outcome: 'ignored', reason: 'untracked-event' });
  }

  const matches = await readOutboxMatch(config, verified.event.emailId, fetchImpl);
  if (matches.length === 0) {
    // Do not create foreign/provider-managed outbox rows or weaken the
    // application correlation race contract. Only explicit provider-signed
    // namespaces may finish without a match; every unknown event still retries.
    // A matched USD Impact application row always wins before these boundaries.
    if (isProviderManagedAuthSuccess(verified.event)) {
      return Object.freeze({ outcome: 'ignored', reason: 'provider-managed-auth-success' });
    }
    if (isExternallyManagedSpanishNewsletterEvent(verified.event)) {
      return Object.freeze({ outcome: 'ignored', reason: 'externally-managed-spanish-newsletter' });
    }
    if (isForeignUsdImpactResendEvent(verified.event, environment)) {
      return Object.freeze({ outcome: 'ignored', reason: 'foreign-usd-impact-data-scope' });
    }
    throw new WebhookProcessingError(
      'Resend outbox correlation is not ready.',
      'OUTBOX_CORRELATION_PENDING',
    );
  }
  if (matches.length > 1) {
    throw new WebhookProcessingError('Resend email identifier matches multiple outbox rows.', 'AMBIGUOUS_OUTBOX_MATCH');
  }

  let row = matches[0];
  const matchedId = row.id;
  for (let attempt = 0; ; attempt += 1) {
    const transition = planResendOutboxTransition(row.status, verified.event);
    if (!transition.apply) {
      return Object.freeze({ outcome: 'processed', reason: transition.reason || 'no-state-change' });
    }
    if (attempt >= MAX_OUTBOX_UPDATE_ATTEMPTS) {
      throw new WebhookProcessingError(
        'Resend outbox state changed during callback processing.',
        'OUTBOX_UPDATE_CONTENDED',
      );
    }

    // Compare-and-set on the exact state used by the transition planner.
    // PostgreSQL rechecks this predicate after a concurrent row update, so a
    // stale callback can never overwrite a newer terminal state.
    const updated = await serviceRequest({
      config,
      path: `/rest/v1/notification_outbox?id=eq.${encodeURIComponent(matchedId)}&provider=eq.resend&provider_message_ref=eq.${encodeURIComponent(verified.event.emailId)}&status=eq.${encodeURIComponent(row.status)}&select=id,status,provider_message_ref`,
      method: 'PATCH',
      body: transition.patch,
      prefer: 'return=representation',
      fetchImpl,
    });
    const expectedStatus = transition.patch.status || row.status;
    if (!Array.isArray(updated) || updated.length > 1
        || updated.some((item) => !item || typeof item !== 'object' || Array.isArray(item)
          || item.id !== matchedId || item.provider_message_ref !== verified.event.emailId
          || item.status !== expectedStatus)) {
      throw new WebhookProcessingError(
        'Resend outbox update returned invalid evidence.',
        'INVALID_OUTBOX_UPDATE_RESPONSE',
      );
    }
    if (updated.length === 1) {
      return Object.freeze({ outcome: 'processed', reason: 'state-updated' });
    }

    // A zero-row compare means another writer won. Re-read and re-plan from
    // authoritative state instead of replaying the stale transition.
    const current = await readOutboxMatch(config, verified.event.emailId, fetchImpl);
    if (current.length === 0) {
      // A message that already matched the application outbox cannot later
      // fall through to any provider-managed namespace exception.
      throw new WebhookProcessingError(
        'Resend outbox correlation is not ready.',
        'OUTBOX_CORRELATION_PENDING',
      );
    }
    if (current.length > 1) {
      throw new WebhookProcessingError(
        'Resend email identifier matches multiple outbox rows.',
        'AMBIGUOUS_OUTBOX_MATCH',
      );
    }
    if (current[0].id !== matchedId) {
      throw new WebhookProcessingError(
        'Resend outbox identity changed during callback processing.',
        'OUTBOX_IDENTITY_CHANGED',
      );
    }
    row = current[0];
  }
}

export async function handleResendWebhook(request, response, options = {}) {
  const environment = options.environment || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const nowMs = options.nowMs ?? Date.now();

  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
  }

  if (environment.RESEND_WEBHOOK_ENABLED !== 'true') {
    return sendJson(response, 404, { error: 'Not found.', code: 'NOT_FOUND' });
  }

  const contentType = requestHeader(request, 'content-type');
  if (!contentType.toLowerCase().includes('application/json')) {
    return sendJson(response, 415, { error: 'Content type must be application/json.', code: 'INVALID_CONTENT_TYPE' });
  }

  let config;
  const secret = environment.RESEND_WEBHOOK_SECRET;
  try {
    config = readSupabaseServerConfig(environment, { requireSecret: true });
    assertExpectedWebhookProject(config, environment);
    if (typeof secret !== 'string' || !secret.startsWith('whsec_')) {
      throw new SupabaseConfigurationError('RESEND_WEBHOOK_SECRET is missing or invalid.');
    }
  } catch (error) {
    console.error('Resend webhook configuration is incomplete.', {
      code: error?.code || 'CONFIGURATION_ERROR',
    });
    return sendJson(response, 503, { error: 'Webhook service is unavailable.', code: 'WEBHOOK_UNAVAILABLE' });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(request);
  } catch (error) {
    if (error?.code === 'WEBHOOK_TOO_LARGE') {
      return sendJson(response, 413, { error: 'Webhook body is too large.', code: 'WEBHOOK_TOO_LARGE' });
    }
    return sendJson(response, 400, { error: 'Raw webhook body is required.', code: 'RAW_BODY_REQUIRED' });
  }

  let verified;
  try {
    verified = verifyResendWebhook({
      payload: rawBody,
      headers: request.headers,
      secret,
      nowMs,
    });
  } catch (error) {
    const code = error instanceof ResendWebhookVerificationError ? error.code : 'INVALID_WEBHOOK';
    return sendJson(response, 400, { error: 'Invalid webhook.', code });
  }

  let receiptState;
  try {
    receiptState = await beginReceipt({ config, verified, fetchImpl });
    if (receiptState.complete) {
      return sendJson(response, 200, { ok: true, duplicate: true });
    }

    const result = await applyDeliveryEvent({ config, verified, fetchImpl, environment });
    await finishReceipt({
      config,
      receipt: receiptState.receipt,
      status: result.outcome,
      fetchImpl,
      now: new Date(nowMs),
    });
    if (result.reason === 'provider-managed-auth-success') {
      console.info('Resend provider-managed authentication notification acknowledged.', {
        code: 'PROVIDER_MANAGED_AUTH_SUCCESS', eventType: verified.event.type,
      });
    } else if (result.reason === 'externally-managed-spanish-newsletter') {
      console.info('Resend externally managed Spanish newsletter notification acknowledged.', {
        code: 'EXTERNALLY_MANAGED_SPANISH_NEWSLETTER', eventType: verified.event.type,
      });
    } else if (result.reason === 'foreign-usd-impact-data-scope') {
      console.info('Resend lifecycle event for another USD Impact data scope acknowledged.', {
        code: 'FOREIGN_USD_IMPACT_DATA_SCOPE', eventType: verified.event.type,
      });
    }
    return sendJson(response, 200, { ok: true, duplicate: receiptState.duplicate });
  } catch (error) {
    console.error('Resend webhook processing failed.', {
      code: error?.code || 'WEBHOOK_PROCESSING_FAILED',
    });
    if (receiptState?.receipt?.id) {
      try {
        await finishReceipt({
          config,
          receipt: receiptState.receipt,
          status: 'failed',
          lastError: error?.code || 'WEBHOOK_PROCESSING_FAILED',
          fetchImpl,
          now: new Date(nowMs),
        });
      } catch {
        console.error('Resend webhook receipt failure state could not be recorded.');
      }
    }
    const status = error?.code === 'WEBHOOK_RECEIPT_CONFLICT'
      ? 409
      : ['OUTBOX_CORRELATION_PENDING', 'OUTBOX_UPDATE_CONTENDED', 'WEBHOOK_RECEIPT_CONTENDED'].includes(error?.code)
        ? 503
        : 500;
    return sendJson(
      response,
      status,
      {
        error: status === 409
          ? 'Webhook conflict.'
          : status === 503
            ? 'Webhook processing deferred.'
            : 'Webhook processing failed.',
        code: error?.code || 'WEBHOOK_PROCESSING_FAILED',
      },
      status === 503 ? { 'Retry-After': '5' } : {},
    );
  }
}
