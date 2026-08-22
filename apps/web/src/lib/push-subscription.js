import { createHash } from 'node:crypto';
import {
  getVerifiedSupabaseUser,
  readSupabaseServerConfig,
  SupabaseConfigurationError,
  SupabaseRequestError,
} from './supabase-server.js';

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_ENDPOINT_LENGTH = 4096;

function requirePushEndpoint(value) {
  const endpoint = String(value || '').trim();
  if (!endpoint || endpoint.length > MAX_ENDPOINT_LENGTH) {
    throw new TypeError('A valid push endpoint is required.');
  }
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new TypeError('A valid push endpoint is required.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new TypeError('Push endpoint must be an HTTPS URL without credentials or fragments.');
  }
  return url.href;
}

function requirePushKey(value, name, maximumLength = 512) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > maximumLength || !BASE64URL_PATTERN.test(normalized)) {
    throw new TypeError(`${name} is invalid.`);
  }
  return normalized;
}

function endpointHash(endpoint) {
  return createHash('sha256').update(endpoint, 'utf8').digest('hex');
}

function normalizeExpirationTime(value) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < 0) {
    throw new TypeError('Push expiration time is invalid.');
  }
  return numeric;
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

async function serviceRoleFetch({ config, path, method, body, fetchImpl = fetch }) {
  if (!config?.secretKey) {
    throw new SupabaseConfigurationError('SUPABASE_SECRET_KEY is required for Web Push subscriptions.');
  }
  const response = await fetchImpl(`${config.url}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: config.secretKey,
      Authorization: `Bearer ${config.secretKey}`,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const payload = await readJsonSafely(response);
    throw new SupabaseRequestError(
      payload?.message || payload?.error || 'Web Push subscription storage failed.',
      {
        status: response.status,
        code: payload?.code || 'PUSH_SUBSCRIPTION_STORAGE_FAILED',
        details: payload,
      },
    );
  }
}

export function normalizePushSubscription(payload) {
  const endpoint = requirePushEndpoint(payload?.endpoint);
  const keys = payload?.keys && typeof payload.keys === 'object' && !Array.isArray(payload.keys)
    ? payload.keys
    : {};
  return Object.freeze({
    endpoint,
    endpointHash: endpointHash(endpoint),
    p256dh: requirePushKey(keys.p256dh, 'Push p256dh key'),
    authSecret: requirePushKey(keys.auth, 'Push auth key'),
    expirationTime: normalizeExpirationTime(payload?.expirationTime),
  });
}

export async function upsertOwnPushSubscription({
  accessToken,
  subscription,
  environment,
  config,
  fetchImpl,
  now = new Date(),
}) {
  const resolvedConfig = config || readSupabaseServerConfig(environment, { requireSecret: true });
  const user = await getVerifiedSupabaseUser(accessToken, { config: resolvedConfig, fetchImpl });
  const normalized = normalizePushSubscription(subscription);
  const timestamp = now.toISOString();

  await serviceRoleFetch({
    config: resolvedConfig,
    path: '/rest/v1/push_subscriptions?on_conflict=account_id,endpoint_hash',
    method: 'POST',
    body: {
      account_id: user.id,
      endpoint_hash: normalized.endpointHash,
      endpoint: normalized.endpoint,
      p256dh: normalized.p256dh,
      auth_secret: normalized.authSecret,
      expiration_time: normalized.expirationTime,
      enabled: true,
      updated_at: timestamp,
    },
    fetchImpl,
  });

  return Object.freeze({
    ok: true,
    endpointHash: normalized.endpointHash,
    enabled: true,
  });
}

export async function disableOwnPushSubscription({
  accessToken,
  endpoint,
  environment,
  config,
  fetchImpl,
  now = new Date(),
}) {
  const resolvedConfig = config || readSupabaseServerConfig(environment, { requireSecret: true });
  const user = await getVerifiedSupabaseUser(accessToken, { config: resolvedConfig, fetchImpl });
  const normalizedEndpoint = requirePushEndpoint(endpoint);
  const hash = endpointHash(normalizedEndpoint);

  await serviceRoleFetch({
    config: resolvedConfig,
    path: `/rest/v1/push_subscriptions?account_id=eq.${encodeURIComponent(user.id)}&endpoint_hash=eq.${hash}`,
    method: 'PATCH',
    body: {
      enabled: false,
      updated_at: now.toISOString(),
    },
    fetchImpl,
  });

  return Object.freeze({ ok: true, endpointHash: hash, enabled: false });
}
