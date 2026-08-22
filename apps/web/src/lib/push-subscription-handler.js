import { readSessionAccessToken } from './supabase-auth.js';
import { getVerifiedSupabaseUser, safeSupabaseError, sendJson } from './supabase-server.js';
import {
  disableOwnPushSubscription,
  upsertOwnPushSubscription,
} from './push-subscription.js';

const MAX_BODY_BYTES = 16_384;
const VAPID_PUBLIC_KEY_PATTERN = /^[A-Za-z0-9_-]{80,128}$/;

function header(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? '' : String(value ?? '');
}

function parseBody(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    const encoded = JSON.stringify(request.body);
    if (Buffer.byteLength(encoded, 'utf8') > MAX_BODY_BYTES) throw new Error('Request body is too large.');
    return request.body;
  }
  if (typeof request.body === 'string' || Buffer.isBuffer(request.body)) {
    const text = request.body.toString();
    if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) throw new Error('Request body is too large.');
    return JSON.parse(text);
  }
  return {};
}

function sameSite(request, response) {
  if (header(request, 'sec-fetch-site') === 'cross-site') {
    sendJson(response, 403, { error: 'Cross-site requests are not allowed.', code: 'CROSS_SITE_REQUEST' });
    return false;
  }
  return true;
}

function sameSiteJson(request, response) {
  if (!sameSite(request, response)) return false;
  if (!header(request, 'content-type').includes('application/json')) {
    sendJson(response, 415, { error: 'Content type must be application/json.', code: 'INVALID_CONTENT_TYPE' });
    return false;
  }
  return true;
}

export function readWebPushPublicConfig(environment = process.env) {
  const applicationServerKey = String(environment.WEB_PUSH_VAPID_PUBLIC_KEY || '').trim();
  if (!VAPID_PUBLIC_KEY_PATTERN.test(applicationServerKey)) {
    throw new Error('WEB_PUSH_VAPID_PUBLIC_KEY is missing or invalid.');
  }
  let decoded;
  try {
    decoded = Buffer.from(applicationServerKey, 'base64url');
  } catch {
    throw new Error('WEB_PUSH_VAPID_PUBLIC_KEY is missing or invalid.');
  }
  if (decoded.length !== 65 || decoded[0] !== 4) {
    throw new Error('WEB_PUSH_VAPID_PUBLIC_KEY is missing or invalid.');
  }
  return Object.freeze({ applicationServerKey });
}

export async function handlePushSubscriptionRequest(request, response) {
  if (process.env.WEB_PUSH_SUBSCRIPTIONS_ENABLED !== 'true') {
    return sendJson(response, 404, {
      error: 'Web Push subscriptions are not enabled.',
      code: 'WEB_PUSH_SUBSCRIPTIONS_DISABLED',
    });
  }

  if (!['GET', 'POST', 'DELETE'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST, DELETE');
    return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }
  if (!sameSite(request, response)) return;

  const accessToken = readSessionAccessToken(request);
  if (!accessToken) {
    return sendJson(response, 401, {
      error: 'Authentication is required.',
      code: 'AUTHENTICATION_REQUIRED',
    });
  }

  if (request.method === 'GET') {
    try {
      await getVerifiedSupabaseUser(accessToken);
    } catch (error) {
      const safe = safeSupabaseError(error);
      return sendJson(response, safe.status, safe.payload);
    }
    try {
      return sendJson(response, 200, {
        enabled: true,
        ...readWebPushPublicConfig(),
      });
    } catch {
      console.error('Web Push public configuration is invalid.', {
        code: 'WEB_PUSH_PUBLIC_CONFIG_INVALID',
      });
      return sendJson(response, 503, {
        error: 'Browser notifications are temporarily unavailable.',
        code: 'WEB_PUSH_PUBLIC_CONFIG_INVALID',
      });
    }
  }

  if (!sameSiteJson(request, response)) return;

  let payload;
  try {
    payload = parseBody(request);
  } catch (error) {
    return sendJson(response, 400, {
      error: error instanceof Error ? error.message : 'Invalid request body.',
      code: 'INVALID_REQUEST_BODY',
    });
  }

  try {
    const result = request.method === 'POST'
      ? await upsertOwnPushSubscription({ accessToken, subscription: payload.subscription })
      : await disableOwnPushSubscription({ accessToken, endpoint: payload.endpoint });
    return sendJson(response, 200, result);
  } catch (error) {
    if (error instanceof TypeError) {
      return sendJson(response, 400, { error: error.message, code: 'INVALID_PUSH_SUBSCRIPTION' });
    }
    const safe = safeSupabaseError(error);
    return sendJson(response, safe.status, safe.payload);
  }
}
