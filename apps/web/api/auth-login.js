import { safeSupabaseError, sendJson } from '../src/lib/supabase-server.js';
import { sendPasswordlessEmail } from '../src/lib/supabase-auth.js';

function header(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? '' : String(value ?? '');
}

function body(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string' || Buffer.isBuffer(request.body)) return JSON.parse(request.body.toString());
  throw new TypeError('Invalid request body.');
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
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
    payload = body(request);
  } catch {
    return sendJson(response, 400, { error: 'Invalid request body.', code: 'INVALID_REQUEST_BODY' });
  }

  try {
    await sendPasswordlessEmail({
      email: payload.email,
      next: payload.next,
      request,
      response,
    });
    return sendJson(response, 202, {
      ok: true,
      message: 'If the address can receive a sign-in email, a link has been sent.',
    });
  } catch (error) {
    const safe = safeSupabaseError(error);
    if (safe.status === 400 && safe.payload.code === 'INVALID_EMAIL') {
      return sendJson(response, 400, safe.payload);
    }
    if (safe.status < 500) {
      return sendJson(response, 202, {
        ok: true,
        message: 'If the address can receive a sign-in email, a link has been sent.',
      });
    }
    return sendJson(response, safe.status, safe.payload);
  }
}
