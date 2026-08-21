const TARGET = 'https://ycstrcvshdluovtuasjc.supabase.co/functions/v1/qa-account-deletion-proof-20260821';

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(payload));
}

export default async function handler(request, response) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return sendJson(response, 404, { ok: false, code: 'QA_PREVIEW_ONLY' });
  }
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const upstream = await fetch(TARGET, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const text = await upstream.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { ok: false, code: 'QA_UPSTREAM_NON_JSON' };
    }
    return sendJson(response, upstream.status, payload);
  } catch {
    return sendJson(response, 502, { ok: false, code: 'QA_UPSTREAM_UNAVAILABLE' });
  }
}
