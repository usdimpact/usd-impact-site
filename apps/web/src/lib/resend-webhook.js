import {
  createHash,
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

export const RESEND_WEBHOOK_TOLERANCE_SECONDS = 300;
export const RESEND_WEBHOOK_MAX_BYTES = 256 * 1024;

export const RESEND_DELIVERY_EVENTS = Object.freeze([
  'email.sent',
  'email.delivered',
  'email.delivery_delayed',
  'email.bounced',
  'email.complained',
  'email.failed',
  'email.suppressed',
]);

const DELIVERY_EVENT_SET = new Set(RESEND_DELIVERY_EVENTS);
const EMAIL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;
const SVIX_ID_PATTERN = /^[\x21-\x7E]{3,255}$/;
const TERMINAL_STATUSES = new Set([
  'hard_bounced',
  'complained',
  'suppressed',
  'terminal_failed',
  'cancelled',
]);

export class ResendWebhookVerificationError extends Error {
  constructor(message, code = 'INVALID_WEBHOOK') {
    super(message);
    this.name = 'ResendWebhookVerificationError';
    this.code = code;
  }
}

function normalizedHeader(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return String(headers.get(name) ?? '');
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return String(value[0] ?? '');
  return String(value ?? '');
}

function decodeWebhookSecret(secret) {
  if (typeof secret !== 'string' || !secret.startsWith('whsec_')) {
    throw new ResendWebhookVerificationError('Webhook secret is missing or invalid.', 'INVALID_WEBHOOK_SECRET');
  }

  const encoded = secret.slice('whsec_'.length);
  if (!/^[A-Za-z0-9+/_=-]+$/.test(encoded)) {
    throw new ResendWebhookVerificationError('Webhook secret is invalid.', 'INVALID_WEBHOOK_SECRET');
  }

  const key = Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (key.length < 16) {
    throw new ResendWebhookVerificationError('Webhook secret is invalid.', 'INVALID_WEBHOOK_SECRET');
  }
  return key;
}

function verifyTimestamp(timestampHeader, nowMs, toleranceSeconds) {
  if (!/^\d{1,12}$/.test(timestampHeader)) {
    throw new ResendWebhookVerificationError('Webhook timestamp is invalid.', 'INVALID_WEBHOOK_TIMESTAMP');
  }

  const timestampSeconds = Number.parseInt(timestampHeader, 10);
  const nowSeconds = Math.floor(nowMs / 1000);
  if (!Number.isSafeInteger(timestampSeconds)) {
    throw new ResendWebhookVerificationError('Webhook timestamp is invalid.', 'INVALID_WEBHOOK_TIMESTAMP');
  }
  if (nowSeconds - timestampSeconds > toleranceSeconds) {
    throw new ResendWebhookVerificationError('Webhook timestamp is too old.', 'STALE_WEBHOOK');
  }
  if (timestampSeconds - nowSeconds > toleranceSeconds) {
    throw new ResendWebhookVerificationError('Webhook timestamp is too new.', 'FUTURE_WEBHOOK');
  }
  return timestampSeconds;
}

function verifySignature({ payload, svixId, timestampSeconds, signatureHeader, secret }) {
  const key = decodeWebhookSecret(secret);
  const signedContent = `${svixId}.${timestampSeconds}.${payload}`;
  const expected = createHmac('sha256', key).update(signedContent).digest('base64');
  const expectedBytes = Buffer.from(expected, 'utf8');

  const candidates = signatureHeader.trim().split(/\s+/).filter(Boolean);
  for (const candidate of candidates) {
    const separator = candidate.indexOf(',');
    if (separator < 0 || candidate.slice(0, separator) !== 'v1') continue;
    const signature = candidate.slice(separator + 1);
    const candidateBytes = Buffer.from(signature, 'utf8');
    if (candidateBytes.length !== expectedBytes.length) continue;
    if (timingSafeEqual(candidateBytes, expectedBytes)) return;
  }

  throw new ResendWebhookVerificationError('Webhook signature is invalid.', 'INVALID_WEBHOOK_SIGNATURE');
}

function parseEvent(payload) {
  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    throw new ResendWebhookVerificationError('Webhook payload is not valid JSON.', 'INVALID_WEBHOOK_PAYLOAD');
  }

  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new ResendWebhookVerificationError('Webhook payload is invalid.', 'INVALID_WEBHOOK_PAYLOAD');
  }

  const type = typeof event.type === 'string' ? event.type.trim() : '';
  const createdAt = typeof event.created_at === 'string' ? event.created_at.trim() : '';
  const emailId = typeof event.data?.email_id === 'string' ? event.data.email_id.trim() : '';

  if (!type || !createdAt || Number.isNaN(Date.parse(createdAt))) {
    throw new ResendWebhookVerificationError('Webhook event metadata is invalid.', 'INVALID_WEBHOOK_EVENT');
  }
  if (type.startsWith('email.') && (!emailId || !EMAIL_ID_PATTERN.test(emailId))) {
    throw new ResendWebhookVerificationError('Webhook email identifier is invalid.', 'INVALID_WEBHOOK_EVENT');
  }

  return Object.freeze({
    raw: event,
    type,
    createdAt: new Date(createdAt).toISOString(),
    emailId: emailId || null,
    trackedDeliveryEvent: DELIVERY_EVENT_SET.has(type),
  });
}

export function verifyResendWebhook({
  payload,
  headers,
  secret,
  nowMs = Date.now(),
  toleranceSeconds = RESEND_WEBHOOK_TOLERANCE_SECONDS,
}) {
  if (typeof payload !== 'string') {
    throw new ResendWebhookVerificationError('Webhook payload must be the raw string body.', 'INVALID_WEBHOOK_PAYLOAD');
  }
  if (!Number.isInteger(toleranceSeconds) || toleranceSeconds < 1 || toleranceSeconds > 3600) {
    throw new TypeError('Webhook tolerance must be between 1 and 3600 seconds.');
  }

  const svixId = normalizedHeader(headers, 'svix-id').trim();
  const timestampHeader = normalizedHeader(headers, 'svix-timestamp').trim();
  const signatureHeader = normalizedHeader(headers, 'svix-signature').trim();

  if (!SVIX_ID_PATTERN.test(svixId) || !timestampHeader || !signatureHeader) {
    throw new ResendWebhookVerificationError('Required webhook signature headers are missing.', 'MISSING_WEBHOOK_HEADERS');
  }

  const timestampSeconds = verifyTimestamp(timestampHeader, nowMs, toleranceSeconds);
  verifySignature({ payload, svixId, timestampSeconds, signatureHeader, secret });

  return Object.freeze({
    svixId,
    timestampSeconds,
    payloadSha256: createHash('sha256').update(payload).digest('hex'),
    event: parseEvent(payload),
  });
}

export function planResendOutboxTransition(currentStatus, event) {
  const status = String(currentStatus ?? '').trim();
  const type = event?.type;
  const createdAt = event?.createdAt;

  if (!status || !type || !createdAt || !DELIVERY_EVENT_SET.has(type)) {
    return Object.freeze({ apply: false, reason: 'untracked' });
  }

  if (status === 'cancelled') {
    return Object.freeze({ apply: false, reason: 'cancelled' });
  }

  if (type === 'email.sent') {
    if (!['queued', 'sending', 'retry_scheduled', 'soft_bounced'].includes(status)) {
      return Object.freeze({ apply: false, reason: 'would-regress' });
    }
    return Object.freeze({
      apply: true,
      patch: { status: 'accepted', accepted_at: createdAt, error_code: null },
    });
  }

  if (type === 'email.delivery_delayed') {
    if (TERMINAL_STATUSES.has(status) || status === 'delivered') {
      return Object.freeze({ apply: false, reason: 'terminal-or-delivered' });
    }
    return Object.freeze({
      apply: true,
      patch: { error_code: 'RESEND_DELIVERY_DELAYED' },
    });
  }

  if (type === 'email.delivered') {
    if (TERMINAL_STATUSES.has(status)) {
      return Object.freeze({ apply: false, reason: 'terminal' });
    }
    return Object.freeze({
      apply: true,
      patch: { status: 'delivered', delivered_at: createdAt, error_code: null },
    });
  }

  if (type === 'email.complained') {
    if (status === 'complained' || ['hard_bounced', 'suppressed', 'terminal_failed'].includes(status)) {
      return Object.freeze({ apply: false, reason: 'terminal' });
    }
    return Object.freeze({
      apply: true,
      patch: { status: 'complained', failed_at: createdAt, error_code: 'RESEND_COMPLAINT' },
    });
  }

  if (type === 'email.bounced') {
    if (TERMINAL_STATUSES.has(status) || status === 'delivered') {
      return Object.freeze({ apply: false, reason: 'terminal-or-delivered' });
    }
    return Object.freeze({
      apply: true,
      patch: { status: 'hard_bounced', failed_at: createdAt, error_code: 'RESEND_HARD_BOUNCE' },
    });
  }

  if (type === 'email.suppressed') {
    if (TERMINAL_STATUSES.has(status) || status === 'delivered') {
      return Object.freeze({ apply: false, reason: 'terminal-or-delivered' });
    }
    return Object.freeze({
      apply: true,
      patch: { status: 'suppressed', failed_at: createdAt, error_code: 'RESEND_SUPPRESSED' },
    });
  }

  if (type === 'email.failed') {
    if (TERMINAL_STATUSES.has(status) || status === 'delivered') {
      return Object.freeze({ apply: false, reason: 'terminal-or-delivered' });
    }
    return Object.freeze({
      apply: true,
      patch: { status: 'terminal_failed', failed_at: createdAt, error_code: 'RESEND_SEND_FAILED' },
    });
  }

  return Object.freeze({ apply: false, reason: 'untracked' });
}
