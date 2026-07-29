import {
  readBearerToken,
  requestOwnAccountDeletion,
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
    const result = await requestOwnAccountDeletion({ accessToken });
    return sendJson(response, 202, {
      ok: true,
      status: result.profile?.status ?? 'deletion_pending',
      deletionRequestedAt: result.profile?.deletion_requested_at ?? null,
      deletionDueAt: result.profile?.deletion_due_at ?? null,
    });
  } catch (error) {
    const safe = safeSupabaseError(error);
    return sendJson(response, safe.status, safe.payload);
  }
}
