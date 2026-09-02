import { resolveSessionWithRefresh } from './supabase-auth.js';
import { getVerifiedSupabaseUser, safeSupabaseError, sendJson } from './supabase-server.js';
import {
  readDailyCardReviewQueue,
  submitDailyCardReview,
} from './daily-card-progress.js';

const MAX_BODY_BYTES = 4_096;

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

function queryLimit(request) {
  const url = new URL(request.url || '/api/account', 'https://usd-impact.invalid');
  return url.searchParams.get('limit') || 3;
}

export async function handleDailyCardReviewRequest(request, response, options = {}) {
  if (process.env.ADAPTIVE_LEARNING_ENABLED !== 'true') {
    return sendJson(response, 404, {
      error: 'Adaptive learning is not enabled.',
      code: 'ADAPTIVE_LEARNING_DISABLED',
    });
  }

  try {
    const resolved = await (options.resolveSession || resolveSessionWithRefresh)({
      request,
      response,
      environment: options.environment || process.env,
      verifyAccessToken: (accessToken) => (options.verifyAccessToken || getVerifiedSupabaseUser)(accessToken),
    });
    if (!resolved) {
      return sendJson(response, 401, {
        error: 'Authentication is required.',
        code: 'AUTHENTICATION_REQUIRED',
      });
    }
    const { accessToken } = resolved;
    if (request.method === 'GET') {
      const queue = await readDailyCardReviewQueue({
        accessToken,
        limit: queryLimit(request),
      });
      return sendJson(response, 200, { ok: true, queue });
    }

    if (request.method !== 'POST') {
      response.setHeader('Allow', 'GET, POST');
      return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
    }

    if (header(request, 'sec-fetch-site') === 'cross-site') {
      return sendJson(response, 403, { error: 'Cross-site requests are not allowed.', code: 'CROSS_SITE_REQUEST' });
    }
    if (!header(request, 'content-type').includes('application/json')) {
      return sendJson(response, 415, { error: 'Content type must be application/json.', code: 'INVALID_CONTENT_TYPE' });
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

    const result = await submitDailyCardReview({
      accessToken,
      cardId: payload.cardId,
      rating: payload.rating,
    });
    return sendJson(response, 200, result);
  } catch (error) {
    if (error instanceof TypeError) {
      return sendJson(response, 400, { error: error.message, code: 'INVALID_DAILY_CARD_REVIEW' });
    }
    const safe = safeSupabaseError(error);
    return sendJson(response, safe.status, safe.payload);
  }
}
