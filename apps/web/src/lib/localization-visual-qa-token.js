import { createCloudflareStreamToken } from './cloudflare-stream.js';
import { getVideo } from '../data/video-library.js';
import { getStreamCustomerCode, getStreamUid } from './video-stream-map.js';

const QA_BRANCH = 'feature/spanish-localization-foundation';
const MAX_FRAME_BYTES = 700 * 1024;

function requestUrl(request) {
  return new URL(request?.url || '/api/guided-edition', 'https://usd-impact.invalid');
}

function notFound(response) {
  response.statusCode = 404;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  return response.end(JSON.stringify({ error: 'Not found.' }));
}

function reject(response, status, error) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  return response.end(JSON.stringify({ error }));
}

export async function handleLocalizationVisualQaFrame(request, response, overrides = {}) {
  const environment = overrides.environment || process.env;
  const createToken = overrides.createToken || createCloudflareStreamToken;
  const resolveUid = overrides.resolveUid || getStreamUid;
  const resolveVideo = overrides.resolveVideo || getVideo;
  const fetchImpl = overrides.fetchImpl || fetch;
  const customerCode = overrides.customerCode || getStreamCustomerCode(environment);

  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (
    environment.VERCEL_ENV !== 'preview'
    || environment.VERCEL_GIT_COMMIT_REF !== QA_BRANCH
  ) return notFound(response);

  if (request.method !== 'GET') {
    response.statusCode = 405;
    response.setHeader('Allow', 'GET');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    return response.end(JSON.stringify({ error: 'Method not allowed.' }));
  }

  const url = requestUrl(request);
  const slug = String(url.searchParams.get('slug') || '').trim();
  const time = Number(url.searchParams.get('time'));
  const uid = resolveUid(slug);
  const video = resolveVideo(slug);

  if (!uid || !video) return notFound(response);
  if (!Number.isFinite(time) || time < 0 || time > Number(video.durationSeconds || 0)) {
    return reject(response, 400, 'Invalid frame time.');
  }

  let token;
  try {
    token = await createToken({ videoUid: uid, environment });
  } catch {
    return reject(response, 503, 'Visual QA frame unavailable.');
  }

  const endpoint =
    `https://customer-${customerCode}.cloudflarestream.com/${token}/thumbnails/thumbnail.jpg?time=${encodeURIComponent(time)}s&width=640&height=360&fit=crop`;

  let upstream;
  try {
    upstream = await fetchImpl(endpoint, {
      method: 'GET',
      headers: { Accept: 'image/jpeg,image/*;q=0.8' },
      redirect: 'error',
      cache: 'no-store',
    });
  } catch {
    return reject(response, 502, 'Visual QA frame unavailable.');
  }

  if (!upstream.ok) return reject(response, 502, 'Visual QA frame unavailable.');

  const declaredLength = Number(upstream.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_FRAME_BYTES) {
    return reject(response, 502, 'Visual QA frame exceeds limit.');
  }

  const bytes = Buffer.from(await upstream.arrayBuffer());
  if (bytes.length > MAX_FRAME_BYTES) return reject(response, 502, 'Visual QA frame exceeds limit.');

  const contentType = String(upstream.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  if (!contentType.startsWith('image/')) return reject(response, 502, 'Visual QA frame response was invalid.');

  const payload = JSON.stringify({
    slug,
    time,
    contentType,
    dataBase64: bytes.toString('base64'),
  });

  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Content-Length', Buffer.byteLength(payload));
  return response.end(payload);
}
