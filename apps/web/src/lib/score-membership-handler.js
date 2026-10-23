// Server-side Research Membership check for the Score handoff (issue #147).
// This endpoint does not issue tickets, cookies or unlock the Score origin.
import { readAccountAccessState, safeSupabaseError, sendJson } from './supabase-server.js';
import { resolveSessionWithRefresh } from './supabase-auth.js';
import { RESEARCH_MEMBERSHIP_PRODUCT_ID } from './research-membership-runtime.js';

export async function handleScoreMembershipCheck(request, response, dependencies = {}) {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { allowed: false, code: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const resolveSession = dependencies.resolveSessionWithRefresh || resolveSessionWithRefresh;
    const readAccess = dependencies.readAccountAccessState || readAccountAccessState;
    const resolved = await resolveSession({
      request, response,
      verifyAccessToken: (accessToken) => readAccess({
        accessToken,
        productId: RESEARCH_MEMBERSHIP_PRODUCT_ID,
      }),
    });
    if (!resolved) return sendJson(response, 401, { allowed: false, code: 'AUTHENTICATION_REQUIRED' });
    if (!resolved.value?.allowed) return sendJson(response, 403, { allowed: false, code: 'RESEARCH_MEMBERSHIP_REQUIRED' });
    return sendJson(response, 200, { allowed: true, productId: RESEARCH_MEMBERSHIP_PRODUCT_ID });
  } catch (error) {
    const safe = safeSupabaseError(error);
    return sendJson(response, safe.status, { allowed: false, code: safe.payload.code || 'ACCESS_UNAVAILABLE' });
  }
}
