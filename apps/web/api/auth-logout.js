import { sendJson } from '../src/lib/supabase-server.js';
import {
  clearSessionCookies,
  readSessionAccessToken,
  revokePasswordlessSession,
} from '../src/lib/supabase-auth.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }

  const accessToken = readSessionAccessToken(request);
  clearSessionCookies(response, request);

  try {
    await revokePasswordlessSession({ accessToken });
  } catch (error) {
    console.error(error);
  }

  return sendJson(response, 200, { ok: true });
}
