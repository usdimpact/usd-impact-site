import { readAccountAccessState } from './supabase-server.js';
import { resolveSessionWithRefresh } from './supabase-auth.js';
import { readScorePrivateSupabaseConfig } from './score-private-supabase-config.js';
import { RESEARCH_MEMBERSHIP_PRODUCT_ID } from './research-membership-runtime.js';
import { createScoreMemberAssetStore, scoreMemberAssetPath } from './score-member-assets.js';

const HTML_SECURITY = Object.freeze({
  'Cache-Control': 'private, no-store',
  'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; object-src 'none'; form-action 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-Robots-Tag': 'noindex, nofollow',
  'Vary': 'Cookie',
});

function requestUrl(request) {
  return new URL(request?.url || '/api/score-member', 'https://www.usd-impact.com');
}

function action(request) {
  try { return requestUrl(request).searchParams.get('action') || ''; } catch { return ''; }
}

function enabled(environment) {
  return environment?.SCORE_VERCEL_MEMBER_GATE_ENABLED === 'true';
}

function sendHtml(response, status, body = '') {
  response.statusCode = status;
  for (const [key, value] of Object.entries(HTML_SECURITY)) response.setHeader(key, value);
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(body);
}

function denial(response, status = 403) {
  const signIn = status === 401
    ? '<p><a href="/account/sign-in/?next=%2Fscore%2F">Sign in to USD Impact</a></p>'
    : '';
  return sendHtml(response, status,
    '<!doctype html><html lang="en"><meta charset="utf-8"><title>Research Membership required</title>' +
    '<body><main><h1>Research Membership required</h1>' + signIn +
    '<p><a href="/score/">Return to Score</a></p></main></body></html>');
}

function requestedAssetPath(request) {
  try {
    const raw = requestUrl(request).searchParams.get('path') || '';
    return scoreMemberAssetPath(raw);
  } catch { return null; }
}

export async function handleScoreMemberContent(request, response, dependencies = {}) {
  const environment = dependencies.environment || process.env;
  if (!enabled(environment)) return denial(response, 503);
  if (!['GET', 'HEAD'].includes(request?.method)) {
    response.setHeader('Allow', 'GET, HEAD');
    return denial(response, 405);
  }

  const assetPath = requestedAssetPath(request);
  if (!assetPath) return denial(response, 404);

  try {
    const resolveSession = dependencies.resolveSessionWithRefresh || resolveSessionWithRefresh;
    const readAccess = dependencies.readAccountAccessState || readAccountAccessState;
    const resolved = await resolveSession({
      request,
      response,
      environment,
      verifyAccessToken: (accessToken) => readAccess({
        accessToken,
        productId: RESEARCH_MEMBERSHIP_PRODUCT_ID,
        environment,
      }),
    });

    if (!resolved) return denial(response, 401);
    if (!resolved.value?.allowed) return denial(response, 403);

    const config = dependencies.config || readScorePrivateSupabaseConfig(environment);
    const fetchImpl = dependencies.fetchImpl || fetch;
    const store = dependencies.assetStore || createScoreMemberAssetStore({ config, fetchImpl });
    const asset = await store.read(assetPath);
    if (!asset) return denial(response, 404);

    response.statusCode = 200;
    for (const [key, value] of Object.entries(HTML_SECURITY)) response.setHeader(key, value);
    response.setHeader('Content-Type', asset.contentType);
    response.setHeader('X-Score-Source-Commit', asset.sourceCommit);
    response.end(request.method === 'HEAD' ? '' : asset.body);
  } catch {
    return denial(response, 503);
  }
}

export default async function handleScoreMemberRequest(request, response, dependencies = {}) {
  if (action(request) === 'content') return handleScoreMemberContent(request, response, dependencies);
  return denial(response, 404);
}
