import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_HEX_PATTERN = /^[a-f0-9]{64}$/i;
const EVENT_ID_PATTERN = /^[a-zA-Z0-9_:-]{4,128}$/;
const EVENT_TYPE_PATTERN = /^[a-z0-9_.:-]{3,128}$/i;

export class PaddleWebhookVerificationError extends Error {
  constructor(message, code = 'PADDLE_WEBHOOK_INVALID_SIGNATURE') {
    super(message);
    this.name = 'PaddleWebhookVerificationError';
    this.code = code;
  }
}

function requireRawBody(rawBody) {
  if (typeof rawBody !== 'string' || rawBody.length === 0) {
    throw new PaddleWebhookVerificationError(
      'Paddle webhook body is missing.',
      'PADDLE_WEBHOOK_BODY_REQUIRED',
    );
  }
  return rawBody;
}

function requireSecret(secret) {
  if (typeof secret !== 'string' || secret.length < 16 || secret.length > 512) {
    throw new PaddleWebhookVerificationError(
      'Paddle webhook secret is missing or invalid.',
      'PADDLE_WEBHOOK_CONFIGURATION_ERROR',
    );
  }
  return secret;
}

export function parsePaddleSignatureHeader(signatureHeader) {
  if (typeof signatureHeader !== 'string' || !signatureHeader.trim()) {
    throw new PaddleWebhookVerificationError('Paddle-Signature header is missing.');
  }

  let timestamp = null;
  const signatures = [];
  for (const segment of signatureHeader.split(';')) {
    const separator = segment.indexOf('=');
    if (separator <= 0) continue;
    const key = segment.slice(0, separator).trim();
    const value = segment.slice(separator + 1).trim();
    if (key === 'ts' && /^\d{1,16}$/.test(value)) timestamp = Number(value);
    if (key === 'h1' && SIGNATURE_HEX_PATTERN.test(value)) signatures.push(value.toLowerCase());
  }

  if (!Number.isSafeInteger(timestamp) || timestamp <= 0 || signatures.length === 0) {
    throw new PaddleWebhookVerificationError('Paddle-Signature header is malformed.');
  }

  return Object.freeze({ timestamp, signatures: Object.freeze(signatures) });
}

function signaturesMatch(expectedHex, candidateHex) {
  const expected = Buffer.from(expectedHex, 'hex');
  const candidate = Buffer.from(candidateHex, 'hex');
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

export function verifyPaddleWebhookSignature({
  rawBody,
  signatureHeader,
  secret,
  nowMs = Date.now(),
  toleranceSeconds = 5,
}) {
  const body = requireRawBody(rawBody);
  const key = requireSecret(secret);
  if (!Number.isFinite(nowMs)) {
    throw new TypeError('nowMs must be a finite timestamp.');
  }
  if (!Number.isSafeInteger(toleranceSeconds) || toleranceSeconds < 1 || toleranceSeconds > 300) {
    throw new TypeError('toleranceSeconds must be an integer between 1 and 300.');
  }

  const parsed = parsePaddleSignatureHeader(signatureHeader);
  const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - parsed.timestamp);
  if (ageSeconds > toleranceSeconds) {
    throw new PaddleWebhookVerificationError(
      'Paddle webhook timestamp is outside the accepted tolerance.',
      'PADDLE_WEBHOOK_EXPIRED',
    );
  }

  const expected = createHmac('sha256', key)
    .update(`${parsed.timestamp}:${body}`, 'utf8')
    .digest('hex');
  if (!parsed.signatures.some((candidate) => signaturesMatch(expected, candidate))) {
    throw new PaddleWebhookVerificationError('Paddle webhook signature does not match.');
  }

  return Object.freeze({ timestamp: parsed.timestamp, ageSeconds });
}

export function parseVerifiedPaddleEvent(rawBody) {
  let payload;
  try {
    payload = JSON.parse(requireRawBody(rawBody));
  } catch {
    throw new TypeError('Paddle webhook body must contain valid JSON.');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Paddle webhook event must be an object.');
  }
  if (typeof payload.event_id !== 'string' || !EVENT_ID_PATTERN.test(payload.event_id)) {
    throw new TypeError('Paddle webhook event_id is missing or invalid.');
  }
  if (typeof payload.event_type !== 'string' || !EVENT_TYPE_PATTERN.test(payload.event_type)) {
    throw new TypeError('Paddle webhook event_type is missing or invalid.');
  }

  return Object.freeze({
    eventId: payload.event_id,
    eventType: payload.event_type,
    occurredAt: typeof payload.occurred_at === 'string' ? payload.occurred_at : null,
    data: payload.data ?? null,
    payload,
  });
}
