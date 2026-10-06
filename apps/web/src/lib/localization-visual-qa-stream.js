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

export async function handleLocalizationVisualQaStream(request, response, overrides = {}) {
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
    || request.method !== 'GET'
  ) return notFound(response);

  const slug = String(requestUrl(request).searchParams.get('slug') || '').trim();
  const uid = resolveUid(slug);
  if (!uid) return notFound(response);

  try {
    const token = await createToken({ videoUid: uid, environment });
    const player = new URL(`https://customer-${customerCode}.cloudflarestream.com/${encodeURIComponent(token)}/iframe`);
    player.searchParams.set('preload', 'metadata');
    player.searchParams.set('letterboxColor', '#020A14');
    player.searchParams.set('primaryColor', '#C9A35B');

    const mode = String(requestUrl(request).searchParams.get('mode') || 'player').trim().toLowerCase();
    if (mode === 'thumbnail') {
      const rawTime = Number(requestUrl(request).searchParams.get('time'));
      const time = Number.isFinite(rawTime) && rawTime >= 0 ? Math.min(rawTime, 3600) : 0;
      const thumbnail = new URL(`https://customer-${customerCode}.cloudflarestream.com/${encodeURIComponent(token)}/thumbnails/thumbnail.jpg`);
      thumbnail.searchParams.set('time', `${time}s`);
      thumbnail.searchParams.set('height', '720');
      thumbnail.searchParams.set('fit', 'crop');

      const imageResponse = await fetch(thumbnail, { method: 'GET', cache: 'no-store' });
      if (!imageResponse.ok) throw new Error('Thumbnail fetch failed.');
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) throw new Error('Invalid thumbnail type.');
      const bytes = Buffer.from(await imageResponse.arrayBuffer());
      if (bytes.length > 3 * 1024 * 1024) throw new Error('Thumbnail too large.');

      const body = JSON.stringify({
        slug,
        time,
        dataUrl: `data:${contentType};base64,${bytes.toString('base64')}`,
      });
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Content-Length', Buffer.byteLength(body));
      return response.end(body);
    }

    const body = JSON.stringify({ slug, playerUrl: player.toString() });
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Content-Length', Buffer.byteLength(body));
    return response.end(body);
  } catch {
    response.statusCode = 502;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    return response.end(JSON.stringify({ error: 'Visual QA playback is unavailable.' }));
  }
}

export const LOCALIZATION_VISUAL_QA_BRANCH = QA_BRANCH;
