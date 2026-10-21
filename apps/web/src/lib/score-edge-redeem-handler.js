// Private Cloudflare-to-Vercel Score redemption endpoint. Disabled by default.
// The shared secret MUST be independent of the Supabase service key and never
// exposed to browser code. Cloudflare calls this endpoint server-to-server.
import { timingSafeEqual } from 'node:crypto';
import { sendJson } from './supabase-server.js';
import { readScorePrivateSupabaseConfig } from './score-private-supabase-config.js';
import { createSupabaseScoreTicketStore } from './score-supabase-ticket-store.js';
import { createScoreMembershipProviders } from './score-membership-providers.js';
import { redeemScoreHandoff } from './score-redemption.js';

function authorized(request, secret) {
  if (typeof secret !== 'string' || secret.length < 32) return false;
  const supplied = request.headers?.['x-score-edge-secret'];
  if (typeof supplied !== 'string' || supplied.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
}
export async function handleScoreEdgeRedeem(request, response, deps = {}) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { allowed: false, code: 'METHOD_NOT_ALLOWED' });
  }
  const env = deps.environment || process.env;
  if (env.SCORE_EDGE_REDEMPTION_ENABLED !== 'true') {
    return sendJson(response, 503, { allowed: false, code: 'SCORE_REDEMPTION_DISABLED' });
  }
  if (!authorized(request, env.SCORE_EDGE_SHARED_SECRET)) {
    return sendJson(response, 403, { allowed: false, code: 'FORBIDDEN' });
  }
  if (!request.body || typeof request.body.ticket !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(request.body.ticket)) {
    return sendJson(response, 400, { allowed: false, code: 'INVALID_TICKET' });
  }
  try {
    const config = deps.config || readScorePrivateSupabaseConfig(env);
    const providers = deps.providers || createScoreMembershipProviders({ config });
    const ticketStore = deps.ticketStore || createSupabaseScoreTicketStore({ config });
    const result = await redeemScoreHandoff({
      ticket: request.body.ticket, ticketStore,
      membership: providers.membership, sessions: providers.sessions,
    });
    if (!result.allowed) return sendJson(response, 403, result);
    return sendJson(response, 200, result);
  } catch {
    return sendJson(response, 503, { allowed: false, code: 'SCORE_REDEMPTION_UNAVAILABLE' });
  }
}