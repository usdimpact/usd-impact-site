import {
  readAccountAccessState,
  readOwnVideoProgress,
  safeSupabaseError,
  sendJson,
  upsertOwnVideoProgress,
} from './supabase-server.js';
import { readSessionAccessToken } from './supabase-auth.js';
import { getVideo, videoSlugs } from '../data/video-library.js';

const MAX_BODY_BYTES = 4_096;
const VIDEO_SLUG_SET = new Set(videoSlugs);

function header(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? '' : String(value ?? '');
}

function parseBody(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    const text = JSON.stringify(request.body);
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new Error('Request body is too large.');
    return request.body;
  }
  if (typeof request.body === 'string' || Buffer.isBuffer(request.body)) {
    const text = request.body.toString();
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new Error('Request body is too large.');
    return JSON.parse(text);
  }
  throw new Error('A JSON request body is required.');
}

function requestUrl(request) {
  return new URL(request.url || '/api/video-progress', 'https://usd-impact.invalid');
}

function requireSameSiteJson(request, response) {
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

function requestedSlug(request) {
  const slug = String(requestUrl(request).searchParams.get('slug') || '').trim();
  if (!slug) return null;
  return VIDEO_SLUG_SET.has(slug) ? slug : false;
}

function progressPercent(position, duration, completed) {
  if (completed) return 100;
  return Math.max(0, Math.min(99, Math.round((position / duration) * 100) || 0));
}

export async function handleVideoProgressRequest(
  request,
  response,
  {
    readAccessState = readAccountAccessState,
    readProgress = readOwnVideoProgress,
    upsertProgress = upsertOwnVideoProgress,
  } = {},
) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('Vary', 'Cookie, Authorization');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }

  const accessToken = readSessionAccessToken(request);
  if (!accessToken) return sendJson(response, 401, { error: 'Authentication is required.', code: 'AUTHENTICATION_REQUIRED' });

  let state;
  try {
    state = await readAccessState({ accessToken });
  } catch (error) {
    const safe = safeSupabaseError(error);
    return sendJson(response, safe.status, safe.payload);
  }
  if (state?.allowed !== true || !state?.user?.id) {
    return sendJson(response, 403, { error: 'Active access is required.', code: 'PAID_ACCESS_REQUIRED' });
  }

  if (request.method === 'GET') {
    const slug = requestedSlug(request);
    if (slug === false) return sendJson(response, 404, { error: 'Video not found.', code: 'VIDEO_NOT_FOUND' });
    try {
      const rows = await readProgress({
        accessToken,
        accountId: state.user.id,
        contentId: slug ? `video:${slug}` : null,
      });
      const filtered = rows.filter((row) => VIDEO_SLUG_SET.has(String(row.content_id || '').replace(/^video:/, '')));
      return sendJson(response, 200, { progress: slug ? (filtered[0] || null) : filtered });
    } catch (error) {
      const safe = safeSupabaseError(error);
      return sendJson(response, safe.status, safe.payload);
    }
  }

  if (!requireSameSiteJson(request, response)) return;
  let payload;
  try {
    payload = parseBody(request);
  } catch (error) {
    return sendJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid JSON.', code: 'INVALID_REQUEST_BODY' });
  }

  const slug = typeof payload.slug === 'string' ? payload.slug.trim() : '';
  const video = getVideo(slug);
  if (!video) return sendJson(response, 404, { error: 'Video not found.', code: 'VIDEO_NOT_FOUND' });
  const rawPosition = Number(payload.positionSeconds);
  if (!Number.isFinite(rawPosition) || rawPosition < 0) {
    return sendJson(response, 400, { error: 'Playback position is invalid.', code: 'INVALID_PLAYBACK_POSITION' });
  }
  const durationSeconds = Number(video.durationSeconds);
  const positionSeconds = Math.min(rawPosition, durationSeconds);
  const requestedStatus = ['started', 'in_progress', 'completed'].includes(payload.status)
    ? payload.status
    : 'in_progress';
  const completed = requestedStatus === 'completed' || positionSeconds >= durationSeconds - 1.5;
  const status = completed ? 'completed' : positionSeconds > 0 ? 'in_progress' : 'started';

  try {
    const row = await upsertProgress({
      accessToken,
      accountId: state.user.id,
      contentId: `video:${slug}`,
      status,
      progressPercent: progressPercent(positionSeconds, durationSeconds, completed),
      resumePositionSeconds: positionSeconds,
      durationSeconds,
    });
    return sendJson(response, 200, { progress: row });
  } catch (error) {
    const safe = safeSupabaseError(error);
    return sendJson(response, safe.status, safe.payload);
  }
}
