import {
  exportOwnAccount,
  readBearerToken,
  safeSupabaseError,
  sendJson,
} from '../src/lib/supabase-server.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }

  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return sendJson(response, 401, { error: 'Authentication is required.', code: 'AUTHENTICATION_REQUIRED' });
  }

  try {
    const exported = await exportOwnAccount({ accessToken });
    response.setHeader('Content-Disposition', 'attachment; filename="usd-impact-account-export.json"');
    return sendJson(response, 200, exported);
  } catch (error) {
    const safe = safeSupabaseError(error);
    return sendJson(response, safe.status, safe.payload);
  }
}
