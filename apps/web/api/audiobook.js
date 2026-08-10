import { readTheDollarFirstAudiobookChapter } from '../src/data/read-the-dollar-first-audiobook.js';
import { createPrivateAudiobookUrl } from '../src/lib/audiobook-access.js';
import { normalizePaidAccessReason } from '../src/lib/paid-route.js';
import {
  readAccountAccessState,
  safeSupabaseError,
} from '../src/lib/supabase-server.js';
import { readSessionAccessToken } from '../src/lib/supabase-auth.js';

function sendJson(response, status, payload, extraHeaders = {}) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);
  response.end(JSON.stringify(payload));
}

function methodNotAllowed(response) {
  return sendJson(
    response,
    405,
    { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' },
    { Allow: 'GET, HEAD' },
  );
}

function requestUrl(request) {
  return new URL(request.url || '/api/audiobook', 'https://usd-impact.invalid');
}

export async function handleAudiobookRequest(
  request,
  response,
  {
    readAccessState = readAccountAccessState,
    createSignedUrl = createPrivateAudiobookUrl,
  } = {},
) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('Vary', 'Cookie, Authorization');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed(response);

  const chapter = readTheDollarFirstAudiobookChapter(requestUrl(request).searchParams.get('chapter'));
  if (!chapter) {
    return sendJson(response, 404, { error: 'Audiobook chapter not found.', code: 'AUDIOBOOK_CHAPTER_NOT_FOUND' });
  }

  const accessToken = readSessionAccessToken(request);
  if (!accessToken) {
    return sendJson(response, 401, { error: 'Authentication is required.', code: 'AUTHENTICATION_REQUIRED' });
  }

  let state;
  try {
    state = await readAccessState({ accessToken });
  } catch (error) {
    const safe = safeSupabaseError(error);
    if (safe.status === 401) return sendJson(response, 401, safe.payload);
    return sendJson(response, 503, {
      error: 'Audiobook access could not be verified.',
      code: 'AUDIOBOOK_ACCESS_UNAVAILABLE',
    });
  }

  if (state?.allowed !== true) {
    const reason = normalizePaidAccessReason(state?.reason);
    return sendJson(response, 403, {
      error: 'An active Library Pass is required.',
      code: 'LIBRARY_PASS_REQUIRED',
      reason,
    });
  }

  let signed;
  try {
    signed = await createSignedUrl({
      pathname: chapter.pathname,
      method: request.method,
    });
  } catch (error) {
    console.error('Private audiobook delivery failed.', error?.code || error?.name || 'unknown');
    return sendJson(response, 503, {
      error: 'This audiobook chapter is temporarily unavailable.',
      code: 'AUDIOBOOK_DELIVERY_UNAVAILABLE',
    });
  }

  response.statusCode = 307;
  response.setHeader('Location', signed.url);
  response.setHeader('Content-Length', '0');
  return response.end();
}

export default async function handler(request, response) {
  return handleAudiobookRequest(request, response);
}
