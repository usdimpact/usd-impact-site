// Disabled-by-default issuance endpoint for Score handoff (#147).
// Must not be enabled until Score origin atomically redeems tickets and gates ALL
// premium HTML on both custom and legacy hostnames.
import { requestHeader, readSupabaseServerConfig, readAccountAccessState, safeSupabaseError, sendJson } from '../src/lib/supabase-server.js';
import { requestOrigin, resolveSessionWithRefresh } from '../src/lib/supabase-auth.js';
import { RESEARCH_MEMBERSHIP_PRODUCT_ID } from '../src/lib/research-membership-runtime.js';
import { issueScoreTicket, scoreTicketPath } from '../src/lib/score-handoff-ticket.js';
import { createSupabaseScoreTicketStore } from '../src/lib/score-supabase-ticket-store.js';

export async function handleScoreHandoff(request, response, dependencies = {}) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { allowed: false, code: 'METHOD_NOT_ALLOWED' });
  }
  // Feature flag must be absent/false in Production until complete edge protection.
  const environment = dependencies.environment || process.env;
  if (environment.SCORE_HANDOFF_ISSUANCE_ENABLED !== 'true') {
    return sendJson(response, 503, { allowed: false, code: 'SCORE_HANDOFF_DISABLED' });
  }
  try {
    const origin = requestOrigin(request);
    const suppliedOrigin = requestHeader(request, 'origin');
    if (suppliedOrigin !== origin || requestHeader(request, 'sec-fetch-site') === 'cross-site') {
      return sendJson(response, 403, { allowed: false, code: 'INVALID_ORIGIN' });
    }
    const contentType = requestHeader(request, 'content-type').split(';')[0].trim().toLowerCase();
    if (contentType !== 'application/json') {
      return sendJson(response, 415, { allowed: false, code: 'UNSUPPORTED_MEDIA_TYPE' });
    }
    const path = scoreTicketPath(request.body?.path);
    if (!path) return sendJson(response, 400, { allowed: false, code: 'INVALID_SCORE_PATH' });
    const resolveSession = dependencies.resolveSessionWithRefresh || resolveSessionWithRefresh;
    const readAccess = dependencies.readAccountAccessState || readAccountAccessState;
    const resolved = await resolveSession({
      request, response,
      verifyAccessToken: (accessToken) => readAccess({
        accessToken, productId: RESEARCH_MEMBERSHIP_PRODUCT_ID,
      }),
    });
    if (!resolved) return sendJson(response, 401, { allowed: false, code: 'AUTHENTICATION_REQUIRED' });
    if (!resolved.value?.allowed || !resolved.value?.user?.id) {
      return sendJson(response, 403, { allowed: false, code: 'RESEARCH_MEMBERSHIP_REQUIRED' });
    }
    const store = dependencies.store || createSupabaseScoreTicketStore({
      config: readSupabaseServerConfig(environment, { requireSecret: true }),
    });
    const issued = await issueScoreTicket({
      accountId: resolved.value.user.id, path, store,
    });
    return sendJson(response, 200, {
      allowed: true, ticket: issued.ticket, path: issued.path,
      expiresAt: new Date(issued.expiresAtMs).toISOString(),
    });
  } catch (error) {
    const safe = safeSupabaseError(error);
    return sendJson(response, safe.status, { allowed: false, code: safe.payload.code || 'ACCESS_UNAVAILABLE' });
  }
}

export default function handler(request, response) {
  return handleScoreHandoff(request, response);
}
