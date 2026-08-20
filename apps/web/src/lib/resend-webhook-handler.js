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
      apikey: config.secretKey,
      Authorization: `Bearer ${config.secretKey}`,
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

  const attemptCount = Number.isInteger(existing.attempt_count) ? existing.attempt_count + 1 : 2;
  const updated = await serviceRequest({
    config,
    path: `/rest/v1/webhook_receipts?id=eq.${encodeURIComponent(existing.id)}`,
    method: 'PATCH',
    body: { status: 'received', attempt_count: attemptCount, last_error: null },
    prefer: 'return=representation',
    fetchImpl,
  });
  return Object.freeze({
    receipt: Array.isArray(updated) && updated.length ? updated[0] : { ...existing, attempt_count: attemptCount, status: 'received' },
    duplicate: true,
    complete: false,
  });
}

async function finishReceipt({ config, receiptId, status, lastError = null, fetchImpl, now = new Date() }) {
  await serviceRequest({
    config,
    path: `/rest/v1/webhook_receipts?id=eq.${encodeURIComponent(receiptId)}`,
    method: 'PATCH',
    body: {
      status,
      processed_at: status === 'processed' || status === 'ignored' ? now.toISOString() : null,
      last_error: lastError,
    },
    prefer: 'return=minimal',
    fetchImpl,
  });
}

async function readOutboxMatch(config, emailId, fetchImpl) {
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/notification_outbox?provider=eq.resend&provider_message_ref=eq.${encodeURIComponent(emailId)}&select=id,status,provider_message_ref&limit=2`,
    fetchImpl,
  });
  return Array.isArray(rows) ? rows : [];
}

async function applyDeliveryEvent({ config, verified, fetchImpl }) {
  if (!verified.event.trackedDeliveryEvent || !verified.event.emailId) {
    return Object.freeze({ outcome: 'ignored', reason: 'untracked-event' });
  }

  const matches = await readOutboxMatch(config, verified.event.emailId, fetchImpl);
  if (matches.length === 0) {
    throw new WebhookProcessingError(
      'Resend outbox correlation is not ready.',
      'OUTBOX_CORRELATION_PENDING',
    );
  }
  if (matches.length > 1) {
    throw new WebhookProcessingError('Resend email identifier matches multiple outbox rows.', 'AMBIGUOUS_OUTBOX_MATCH');
  }

  const row = matches[0];
  const transition = planResendOutboxTransition(row.status, verified.event);
  if (!transition.apply) {
    return Object.freeze({ outcome: 'processed', reason: transition.reason || 'no-state-change' });
  }

  await serviceRequest({
    config,
    path: `/rest/v1/notification_outbox?id=eq.${encodeURIComponent(row.id)}`,
    method: 'PATCH',
    body: transition.patch,
    prefer: 'return=minimal',
    fetchImpl,
  });
  return Object.freeze({ outcome: 'processed', reason: 'state-updated' });
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

    const result = await applyDeliveryEvent({ config, verified, fetchImpl });
    await finishReceipt({
      config,
      receiptId: receiptState.receipt.id,
      status: result.outcome,
      fetchImpl,
      now: new Date(nowMs),
    });
    return sendJson(response, 200, { ok: true, duplicate: receiptState.duplicate });
  } catch (error) {
    console.error('Resend webhook processing failed.', {
      code: error?.code || 'WEBHOOK_PROCESSING_FAILED',
    });
    if (receiptState?.receipt?.id) {
      try {
        await finishReceipt({
          config,
          receiptId: receiptState.receipt.id,
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
      : error?.code === 'OUTBOX_CORRELATION_PENDING'
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
