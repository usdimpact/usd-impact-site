// Private per-request Score session validation. Disabled by default.
// The caller is Cloudflare edge, never a browser. No session token is logged.
import { timingSafeEqual } from 'node:crypto';
import { readSupabaseServerConfig, sendJson } from '../src/lib/supabase-server.js';
import { createScoreMembershipProviders } from '../src/lib/score-membership-providers.js';
import { authorizeScoreSession } from '../src/lib/score-redemption.js';

export async function handleScoreEdgeValidate(request, response, deps = {}) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return sendJson(response, 405, { allowed: false });
  const env = deps.environment || process.env;
  if (env.SCORE_EDGE_VALIDATION_ENABLED !== 'true') {
    return sendJson(response, 503, { allowed: false });
  }
  const expected = env.SCORE_EDGE_SHARED_SECRET;
  const supplied = request.headers?.['x-score-edge-secret'];
  if (typeof expected !== 'string' || expected.length < 32 ||
      typeof supplied !== 'string' || supplied.length !== expected.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
    return sendJson(response, 403, { allowed: false });
  }
  if (typeof request.body?.token !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(request.body.token)) {
    return sendJson(response, 400, { allowed: false });
  }
  try {
    const providers = deps.providers || createScoreMembershipProviders({
      config: readSupabaseServerConfig(env, { requireSecret: true }),
    });
    const allowed = await authorizeScoreSession({
      token: request.body.token, sessions: providers.sessions,
      membership: providers.membership,
    });
    return sendJson(response, allowed ? 200 : 403, { allowed });
  } catch {
    return sendJson(response, 503, { allowed: false });
  }
}
export default function handler(request, response) {
  return handleScoreEdgeValidate(request, response);
}
