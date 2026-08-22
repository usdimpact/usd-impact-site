import { readSessionAccessToken } from '../src/lib/supabase-auth.js';
import { safeSupabaseError, sendJson } from '../src/lib/supabase-server.js';
import {
  disableOwnPushSubscription,
  upsertOwnPushSubscription,
} from '../src/lib/push-subscription.js';

const MAX_BODY_BYTES = 16_384;

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

function sameSiteJson(request, response) {
  if (header(request, 'sec-fetch-site') === 'cross-site') {
    sendJson(response, 403, { error: 'Cross-site requests are not allowed.', code: 'CROSS_SITE_REQUEST' });
    return false;
  }
  if (!header(request, 'content-type').includes('application/json')) {
    sendJson(response, 415, { error: 'Content type must be application/json.', code: 'INVALID_CONTENT_TYPE' });
    return false;
  }
  return true;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (process.env.WEB_PUSH_SUBSCRIPTIONS_ENABLED !== 'true') {
    return sendJson(response, 404, {
      error: 'Web Push subscriptions are not enabled.',
      code: 'WEB_PUSH_SUBSCRIPTIONS_DISABLED',
    });
  }

  if (!['POST', 'DELETE'].includes(request.method)) {
    response.setHeader('Allow', 'POST, DELETE');
    return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }
  if (!sameSiteJson(request, response)) return;

  const accessToken = readSessionAccessToken(request);
  if (!accessToken) {
    return sendJson(response, 401, {
      error: 'Authentication is required.',
      code: 'AUTHENTICATION_REQUIRED',
    });
  }

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
