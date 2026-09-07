import {
  readAccountAccessState,
  safeSupabaseError,
  sendJson,
} from '../src/lib/supabase-server.js';
import { resolveSessionWithRefresh } from '../src/lib/supabase-auth.js';
import { RESEARCH_MEMBERSHIP_PRODUCT_ID } from '../src/lib/research-membership-runtime.js';

function methodNotAllowed(response, allowed) {
  response.setHeader('Allow', allowed);
  return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
}

export async function handleResearchAccount(request, response, dependencies = {}) {
  if (request.method !== 'GET') return methodNotAllowed(response, 'GET');

  const readAccessState = dependencies.readAccountAccessState || readAccountAccessState;
  const resolveSession = dependencies.resolveSessionWithRefresh || resolveSessionWithRefresh;

  try {
    const resolved = await resolveSession({
      request,
      response,
      verifyAccessToken: (accessToken) => readAccessState({
        accessToken,
        productId: RESEARCH_MEMBERSHIP_PRODUCT_ID,
      }),
    });
    if (!resolved) {
      return sendJson(response, 401, {
        error: 'Authentication is required.',
        code: 'AUTHENTICATION_REQUIRED',
      });
    }

    const state = resolved.value;
    return sendJson(response, 200, {
      account: {
        id: state.user.id,
        email: state.user.email,
        status: state.profile?.status ?? 'missing',
      },
      researchAccess: {
        allowed: state.allowed,
        reason: state.reason,
        productId: state.entitlement?.productId ?? RESEARCH_MEMBERSHIP_PRODUCT_ID,
        state: state.entitlement?.state ?? null,
        startsAt: state.entitlement?.startsAt ?? null,
        endsAt: state.entitlement?.endsAt ?? null,
      },
    });
  } catch (error) {
    const safe = safeSupabaseError(error);
    return sendJson(response, safe.status, safe.payload);
  }
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return handleResearchAccount(request, response);
}
