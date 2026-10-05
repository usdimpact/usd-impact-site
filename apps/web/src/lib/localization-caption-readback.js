import { getStreamUid } from './video-stream-map.js';

const LOCALIZATION_BRANCH = 'feature/spanish-localization-foundation';
const MAX_VTT_BYTES = 2 * 1024 * 1024;

function requestUrl(request) {
  return new URL(request?.url || '/api/guided-edition', 'https://usd-impact.invalid');
}

function methodNotAllowed(response) {
  response.statusCode = 405;
  response.setHeader('Allow', 'GET');
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return response.end('Method not allowed.');
}

function notFound(response) {
  response.statusCode = 404;
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return response.end('Not found.');
}

function safeVttFromCloudflareBody(raw, contentType = '') {
  const text = String(raw ?? '');
  if (text.trimStart().startsWith('WEBVTT')) return text;

  if (String(contentType).toLowerCase().includes('application/json')) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed?.result === 'string' && parsed.result.trimStart().startsWith('WEBVTT')) {
        return parsed.result;
      }
    } catch {
      // Fail closed below.
    }
  }

  return null;
}

export async function handleLocalizationCaptionReadback(request, response, overrides = {}) {
  const environment = overrides.environment || process.env;
  const fetchImpl = overrides.fetchImpl || fetch;
  const resolveUid = overrides.resolveUid || getStreamUid;

  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (
    environment.VERCEL_ENV !== 'preview'
    || environment.VERCEL_GIT_COMMIT_REF !== LOCALIZATION_BRANCH
  ) {
    return notFound(response);
  }

  if (request.method !== 'GET') return methodNotAllowed(response);

  const url = requestUrl(request);
  const slug = String(url.searchParams.get('slug') || '').trim();
  const language = String(url.searchParams.get('language') || 'en').trim().toLowerCase();

  if (language !== 'en') return notFound(response);

  const streamUid = resolveUid(slug);
  if (!streamUid) return notFound(response);

  const accountId = String(environment.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiToken = String(environment.CLOUDFLARE_STREAM_API_TOKEN || '').trim();
  if (!accountId || !apiToken) {
    response.statusCode = 503;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return response.end('Caption source readback is unavailable.');
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/${encodeURIComponent(streamUid)}/captions/en/vtt`;

  let upstream;
  try {
    upstream = await fetchImpl(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: 'text/vtt, application/json;q=0.9, text/plain;q=0.8',
      },
      redirect: 'error',
    });
  } catch {
    response.statusCode = 502;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return response.end('Caption source readback failed.');
  }

  if (!upstream.ok) {
    response.statusCode = 502;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return response.end('Caption source readback failed.');
  }

  const declaredLength = Number(upstream.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_VTT_BYTES) {
    response.statusCode = 502;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return response.end('Caption source exceeds the diagnostic limit.');
  }

  const raw = await upstream.text();
  if (Buffer.byteLength(raw) > MAX_VTT_BYTES) {
    response.statusCode = 502;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return response.end('Caption source exceeds the diagnostic limit.');
  }

  const vtt = safeVttFromCloudflareBody(raw, upstream.headers.get('content-type') || '');
  if (!vtt) {
    response.statusCode = 502;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return response.end('Caption source response was invalid.');
  }

  response.statusCode = 200;
  response.setHeader('Content-Type', 'text/vtt; charset=utf-8');
  response.setHeader('Content-Length', Buffer.byteLength(vtt));
  return response.end(vtt);
}

export const LOCALIZATION_CAPTION_READBACK_BRANCH = LOCALIZATION_BRANCH;
