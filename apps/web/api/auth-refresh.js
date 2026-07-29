import { safeSupabaseError, sendJson } from '../src/lib/supabase-server.js';
import {
  clearSessionCookies,
  readSessionRefreshToken,
  refreshPasswordlessSession,
  setSessionCookies,
} from '../src/lib/supabase-auth.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }

  const refreshToken = readSessionRefreshToken(request);
  if (!refreshToken) {
    clearSessionCookies(response, request);
    return sendJson(response, 401, { error: 'Authentication is required.', code: 'AUTHENTICATION_REQUIRED' });
  }

  try {
    const session = await refreshPasswordlessSession({ refreshToken });
    setSessionCookies(response, request, session);
    return sendJson(response, 200, { ok: true });
  } catch (error) {
    clearSessionCookies(response, request);
    const safe = safeSupabaseError(error);
    return sendJson(response, safe.status, safe.payload);
  }
}
