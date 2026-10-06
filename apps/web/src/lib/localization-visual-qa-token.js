import { createCloudflareStreamToken } from './cloudflare-stream.js';
import { getStreamCustomerCode, getStreamUid } from './video-stream-map.js';

const QA_BRANCH = 'feature/spanish-localization-foundation';

function requestUrl(request) {
  return new URL(request?.url || '/api/guided-edition', 'https://usd-impact.invalid');
}

function notFound(response) {
  response.statusCode = 404;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  return response.end(JSON.stringify({ error: 'Not found.' }));
}

export async function handleLocalizationVisualQaToken(request, response, overrides = {}) {
  const environment = overrides.environment || process.env;
  const createToken = overrides.createToken || createCloudflareStreamToken;
  const resolveUid = overrides.resolveUid || getStreamUid;
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

  const slug = String(requestUrl(request).searchParams.get('slug') || '').trim();
  const uid = resolveUid(slug);
  if (!uid) return notFound(response);

  let token;
  try {
    token = await createToken({ videoUid: uid, environment });
  } catch {
    response.statusCode = 503;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    return response.end(JSON.stringify({ error: 'Visual QA token unavailable.' }));
  }

  const payload = JSON.stringify({ slug, customerCode, token });
  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Content-Length', Buffer.byteLength(payload));
  return response.end(payload);
}
