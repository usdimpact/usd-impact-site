const UID = 'dadcee426a7d47159e9714602f741b62';

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.end(JSON.stringify(payload));
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  if (process.env.VERCEL_ENV !== 'preview') {
    return sendJson(response, 404, { ok: false, code: 'PREVIEW_ONLY' });
  }

  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiToken = String(process.env.CLOUDFLARE_STREAM_API_TOKEN || '').trim();
  if (!/^[a-f0-9]{32}$/i.test(accountId) || apiToken.length < 20) {
    return sendJson(response, 503, { ok: false, code: 'STREAM_CONFIGURATION_UNAVAILABLE' });
  }

  let upstream;
  try {
    upstream = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${UID}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        cache: 'no-store',
      },
    );
  } catch {
    return sendJson(response, 502, { ok: false, code: 'STREAM_METADATA_UNAVAILABLE' });
  }

  let payload = null;
  try {
    payload = await upstream.json();
  } catch {}

  if (!upstream.ok || payload?.success !== true || !payload?.result) {
    return sendJson(response, 502, {
      ok: false,
      code: 'STREAM_METADATA_FAILED',
      upstreamStatus: upstream.status,
    });
  }

  const video = payload.result;
  return sendJson(response, 200, {
    ok: true,
    uidMatched: video.uid === UID,
    readyToStream: video.readyToStream === true,
    statusState: video.status?.state || null,
    requireSignedURLs: video.requireSignedURLs === true,
    allowedOrigins: Array.isArray(video.allowedOrigins) ? video.allowedOrigins : null,
    duration: Number.isFinite(video.duration) ? video.duration : null,
    uploaded: typeof video.uploaded === 'string' ? video.uploaded : null,
  });
}
