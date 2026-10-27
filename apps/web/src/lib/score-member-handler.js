import { requestHeader } from './supabase-server.js';
import { requestOrigin } from './supabase-auth.js';
import { readScorePrivateSupabaseConfig } from './score-private-supabase-config.js';
import { createSupabaseScoreTicketStore } from './score-supabase-ticket-store.js';
import { createScoreMembershipProviders } from './score-membership-providers.js';
import { redeemScoreHandoff, authorizeScoreSession } from './score-redemption.js';
import { createScoreMemberAssetStore, scoreMemberAssetPath } from './score-member-assets.js';
import { clearScoreSessionCookie, readScoreSessionCookie, scoreSessionCookie } from './score-session-cookie.js';

const MEMBER_ROUTE = Object.freeze({
  '/en/': '/score/member/en/',
  '/es/': '/score/member/es/',
  '/archive/en/': '/score/member/archive/en/',
  '/archive/es/': '/score/member/archive/es/',
});
const HTML_SECURITY = Object.freeze({
  'Cache-Control': 'private, no-store',
  'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; object-src 'none'; form-action 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-Robots-Tag': 'noindex, nofollow',
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
  return sendHtml(response, status,
    '<!doctype html><html lang="en"><meta charset="utf-8"><title>Research Membership required</title>' +
    '<body><main><h1>Research Membership required</h1><p><a href="/score/">Return to Score</a></p></main></body></html>');
}

function parseFormTicket(request) {
  if (request?.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    return typeof request.body.ticket === 'string' ? request.body.ticket : '';
  }
  const raw = Buffer.isBuffer(request?.body) ? request.body.toString('utf8') : String(request?.body || '');
  if (Buffer.byteLength(raw, 'utf8') > 512) return '';
  try { return new URLSearchParams(raw).get('ticket') || ''; } catch { return ''; }
}

function requestedAssetPath(request) {
  try {
    const raw = requestUrl(request).searchParams.get('path') || '';
    return scoreMemberAssetPath(raw);
  } catch { return null; }
}

function sameOriginForm(request) {
  const site = requestHeader(request, 'sec-fetch-site');
  if (site === 'cross-site') return false;
  const supplied = requestHeader(request, 'origin');
  return !supplied || supplied === requestOrigin(request);
}

export async function handleScoreMemberRedeem(request, response, dependencies = {}) {
  const environment = dependencies.environment || process.env;
  if (!enabled(environment)) return denial(response, 503);
  if (request?.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return denial(response, 405);
  }
  if (!sameOriginForm(request)) return denial(response, 403);
  const contentType = requestHeader(request, 'content-type').split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/x-www-form-urlencoded') return denial(response, 415);
  const ticket = parseFormTicket(request);
  if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) return denial(response, 400);

  try {
    const config = dependencies.config || readScorePrivateSupabaseConfig(environment);
    const fetchImpl = dependencies.fetchImpl || fetch;
    const ticketStore = dependencies.ticketStore || createSupabaseScoreTicketStore({ config, fetchImpl });
    const providers = dependencies.providers || createScoreMembershipProviders({ config, fetchImpl });
    const result = await (dependencies.redeemScoreHandoff || redeemScoreHandoff)({
      ticket, ticketStore, membership: providers.membership, sessions: providers.sessions,
    });
    if (!result?.allowed || !MEMBER_ROUTE[result.path]) return denial(response, 403);
    response.statusCode = 303;
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Set-Cookie', scoreSessionCookie(result.token, result.expiresAtMs));
    response.setHeader('Location', MEMBER_ROUTE[result.path]);
    response.end();
  } catch {
    return denial(response, 503);
  }
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
  const token = readScoreSessionCookie(requestHeader(request, 'cookie'));
  if (!token) return denial(response, 403);

  try {
    const config = dependencies.config || readScorePrivateSupabaseConfig(environment);
    const fetchImpl = dependencies.fetchImpl || fetch;
    const providers = dependencies.providers || createScoreMembershipProviders({ config, fetchImpl });
    const allowed = await (dependencies.authorizeScoreSession || authorizeScoreSession)({
      token, sessions: providers.sessions, membership: providers.membership,
    });
    if (allowed !== true) {
      response.setHeader('Set-Cookie', clearScoreSessionCookie());
      return denial(response, 403);
    }
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
  const selected = action(request);
  if (selected === 'redeem') return handleScoreMemberRedeem(request, response, dependencies);
  if (selected === 'content') return handleScoreMemberContent(request, response, dependencies);
  return denial(response, 404);
}
