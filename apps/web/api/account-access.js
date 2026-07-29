import {
  readAccountAccessState,
  readBearerToken,
  safeSupabaseError,
  sendJson,
} from '../src/lib/supabase-server.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }

  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return sendJson(response, 401, { error: 'Authentication is required.', code: 'AUTHENTICATION_REQUIRED' });
  }

  try {
    const state = await readAccountAccessState({ accessToken });
    return sendJson(response, 200, {
      account: {
        id: state.user.id,
        email: state.user.email,
        status: state.profile?.status ?? 'missing',
      },
      paidAccess: {
        allowed: state.allowed,
        reason: state.reason,
        productId: state.entitlement?.productId ?? null,
        state: state.entitlement?.state ?? null,
      },
    });
  } catch (error) {
    const safe = safeSupabaseError(error);
    return sendJson(response, safe.status, safe.payload);
  }
}
