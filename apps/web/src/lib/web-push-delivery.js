import { normalizePushSubscription } from './push-subscription.js';
import { readSupabaseServerConfig } from './supabase-server.js';
import { supabaseSecretRest } from './supabase-secret-rest.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TAG_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;
const MAX_BATCH_SIZE = 50;
const VAPID_PUBLIC_KEY_PATTERN = /^[A-Za-z0-9_-]{80,128}$/;
const VAPID_PRIVATE_KEY_PATTERN = /^[A-Za-z0-9_-]{40,64}$/;

export class WebPushDeliveryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'WebPushDeliveryError';
    this.code = code;
  }
}

function decodeBase64Url(value, pattern, expectedBytes, name) {
  const normalized = String(value || '').trim();
  if (!pattern.test(normalized)) throw new WebPushDeliveryError(`${name} is missing or invalid.`, 'WEB_PUSH_VAPID_CONFIG_INVALID');
  let decoded;
  try {
    decoded = Buffer.from(normalized, 'base64url');
  } catch {
    throw new WebPushDeliveryError(`${name} is missing or invalid.`, 'WEB_PUSH_VAPID_CONFIG_INVALID');
  }
  if (decoded.length !== expectedBytes) throw new WebPushDeliveryError(`${name} is missing or invalid.`, 'WEB_PUSH_VAPID_CONFIG_INVALID');
  return normalized;
}

export function readWebPushTransportConfig(environment = process.env) {
  const publicKey = decodeBase64Url(
    environment.WEB_PUSH_VAPID_PUBLIC_KEY,
    VAPID_PUBLIC_KEY_PATTERN,
    65,
    'WEB_PUSH_VAPID_PUBLIC_KEY',
  );
  const publicBytes = Buffer.from(publicKey, 'base64url');
  if (publicBytes[0] !== 4) {
    throw new WebPushDeliveryError('WEB_PUSH_VAPID_PUBLIC_KEY is missing or invalid.', 'WEB_PUSH_VAPID_CONFIG_INVALID');
  }
  const privateKey = decodeBase64Url(
    environment.WEB_PUSH_VAPID_PRIVATE_KEY,
    VAPID_PRIVATE_KEY_PATTERN,
    32,
    'WEB_PUSH_VAPID_PRIVATE_KEY',
  );
  const subject = String(environment.WEB_PUSH_VAPID_SUBJECT || '').trim();
  let subjectUrl;
  try {
    subjectUrl = new URL(subject);
  } catch {
    throw new WebPushDeliveryError('WEB_PUSH_VAPID_SUBJECT is missing or invalid.', 'WEB_PUSH_VAPID_CONFIG_INVALID');
  }
  if (!['mailto:', 'https:'].includes(subjectUrl.protocol) || subject.length > 320) {
    throw new WebPushDeliveryError('WEB_PUSH_VAPID_SUBJECT is missing or invalid.', 'WEB_PUSH_VAPID_CONFIG_INVALID');
  }
  return Object.freeze({ subject, publicKey, privateKey });
}

function boundedText(value, fallback, maximumLength, name) {
  const text = String(value ?? fallback).trim();
  if (!text || text.length > maximumLength || /[\u0000-\u001F\u007F]/.test(text)) {
    throw new TypeError(`${name} is invalid.`);
  }
  return text;
}

function safeRelativePath(value) {
  const path = String(value ?? '/').trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.length > 2048 || /[\u0000-\u001F\u007F]/.test(path)) {
    throw new TypeError('Push destination URL must be a same-origin relative path.');
  }
  return path;
}

export function normalizeWebPushPayload(payload = {}) {
  const tag = payload.tag === undefined || payload.tag === null || payload.tag === ''
    ? null
    : String(payload.tag).trim();
  if (tag !== null && !TAG_PATTERN.test(tag)) throw new TypeError('Push tag is invalid.');
  return Object.freeze({
    title: boundedText(payload.title, 'USD Impact', 80, 'Push title'),
    body: boundedText(payload.body, 'A new USD Impact update is available.', 240, 'Push body'),
    url: safeRelativePath(payload.url),
    tag,
  });
}

function requireBatchSize(value) {
  const size = Number(value ?? MAX_BATCH_SIZE);
  if (!Number.isInteger(size) || size < 1 || size > MAX_BATCH_SIZE) {
    throw new TypeError(`Web Push batch size must be between 1 and ${MAX_BATCH_SIZE}.`);
  }
  return size;
}

function subscriptionPath(limit) {
  const select = 'id,endpoint,p256dh,auth_secret,expiration_time';
  return `/rest/v1/push_subscriptions?enabled=eq.true&select=${encodeURIComponent(select)}&order=created_at.asc&limit=${limit}`;
}

function statusCode(error) {
  const value = Number(error?.statusCode ?? error?.status);
  return Number.isInteger(value) ? value : null;
}

function normalizedRow(row) {
  if (!UUID_PATTERN.test(String(row?.id || ''))) throw new TypeError('Stored push subscription ID is invalid.');
  const subscription = normalizePushSubscription({
    endpoint: row.endpoint,
    expirationTime: row.expiration_time,
    keys: { p256dh: row.p256dh, auth: row.auth_secret },
  });
  return Object.freeze({ id: row.id, subscription });
}

async function markSubscription({ config, id, body, fetchImpl }) {
  await supabaseSecretRest({
    config,
    path: `/rest/v1/push_subscriptions?id=eq.${encodeURIComponent(id)}`,
    method: 'PATCH',
    body,
    prefer: 'return=minimal',
    fetchImpl,
    errorCode: 'PUSH_SUBSCRIPTION_UPDATE_FAILED',
    errorMessage: 'Web Push subscription update failed.',
  });
}

export async function deliverWebPushBatch({
  payload,
  sendNotification,
  environment = process.env,
  config,
  fetchImpl,
  now = new Date(),
  limit = MAX_BATCH_SIZE,
}) {
  if (environment.WEB_PUSH_DELIVERY_ENABLED !== 'true') {
    throw new WebPushDeliveryError('Web Push delivery is disabled.', 'WEB_PUSH_DELIVERY_DISABLED');
  }
  if (typeof sendNotification !== 'function') {
    throw new TypeError('A Web Push transport is required.');
  }
  const normalizedPayload = normalizeWebPushPayload(payload);
  const transportConfig = readWebPushTransportConfig(environment);
  const batchSize = requireBatchSize(limit);
  const resolvedConfig = config || readSupabaseServerConfig(environment, { requireSecret: true });
  const rows = await supabaseSecretRest({
    config: resolvedConfig,
    path: subscriptionPath(batchSize),
    fetchImpl,
    errorCode: 'PUSH_SUBSCRIPTION_READ_FAILED',
    errorMessage: 'Web Push subscriptions could not be loaded.',
  });
  if (!Array.isArray(rows)) throw new WebPushDeliveryError('Web Push subscription response is invalid.', 'PUSH_SUBSCRIPTION_READ_INVALID');

  const result = { attempted: 0, sent: 0, staleDisabled: 0, failed: 0 };
  const timestamp = now.toISOString();
  for (const row of rows) {
    const stored = normalizedRow(row);
    result.attempted += 1;
    try {
      await sendNotification({
        subscription: {
          endpoint: stored.subscription.endpoint,
          expirationTime: stored.subscription.expirationTime,
          keys: {
            p256dh: stored.subscription.p256dh,
            auth: stored.subscription.authSecret,
          },
        },
        payload: JSON.stringify(normalizedPayload),
        vapid: transportConfig,
      });
      await markSubscription({
        config: resolvedConfig,
        id: stored.id,
        body: { last_used_at: timestamp },
        fetchImpl,
      });
      result.sent += 1;
    } catch (error) {
      if ([404, 410].includes(statusCode(error))) {
        try {
          await markSubscription({
            config: resolvedConfig,
            id: stored.id,
            body: { enabled: false, updated_at: timestamp },
            fetchImpl,
          });
          result.staleDisabled += 1;
        } catch {
          result.failed += 1;
        }
      } else {
        result.failed += 1;
      }
    }
  }
  return Object.freeze(result);
}
