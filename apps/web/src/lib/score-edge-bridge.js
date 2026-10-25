import { timingSafeEqual } from 'node:crypto';
import { requestHeader, sendJson } from './supabase-server.js';
import { createSupabaseScoreTicketStore } from './score-supabase-ticket-store.js';
import { createScoreMembershipProviders } from './score-membership-providers.js';
import { redeemScoreHandoff, authorizeScoreSession } from './score-redemption.js';

const SHARED_SECRET_RE = /^[A-Za-z0-9_-]{43,128}$/;
const OPAQUE_RE = /^[A-Za-z0-9_-]{43}$/;
const MAX_BODY_BYTES = 512;
export const SCORE_PRODUCTION_SUPABASE_ORIGIN = 'https://gjzetjugmnwanvjkchux.supabase.co';
const EXACT_PATH = '/api/account';
const EXACT_ACTION = 'score-edge';

function readPrivateConfig(environment) {
  let url;
  try {
    url = new URL(String(environment?.SUPABASE_URL || ''));
  } catch {
    throw new Error('Score edge configuration unavailable');
  }
  const secretKey = String(environment?.SUPABASE_SECRET_KEY || '');
  if (url.origin !== SCORE_PRODUCTION_SUPABASE_ORIGIN ||
      !/^sb_secret_[A-Za-z0-9_-]{16,}$/.test(secretKey)) {
    throw new Error('Score edge configuration unavailable');
  }
  return Object.freeze({ url: url.origin, secretKey });
}

function secretEqual(supplied, expected) {
  if (!SHARED_SECRET_RE.test(supplied || '') || !SHARED_SECRET_RE.test(expected || '')) return false;
  const left = Buffer.from(supplied, 'utf8');
  const right = Buffer.from(expected, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

function requestUrl(request) {
  return new URL(request?.url || EXACT_PATH, 'https://www.usd-impact.com');
}

function boundedJsonBody(request) {
  const announced = requestHeader(request, 'content-length').trim();
  if (announced && (!/^\d+$/.test(announced) || Number(announced) > MAX_BODY_BYTES)) {
    return { error: 'too-large' };
  }
  let raw;
  if (Buffer.isBuffer(request?.body)) raw = request.body.toString('utf8');
  else if (typeof request?.body === 'string') raw = request.body;
  else raw = JSON.stringify(request?.body ?? {});
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return { error: 'too-large' };
  try {
    return { value: JSON.parse(raw) };
  } catch {
    return { error: 'invalid-json' };
  }
}

function validSchema(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (!['redeem', 'validate'].includes(payload.action)) return false;
  const keys = Object.keys(payload);
  if (keys.some((key) => !['action', 'ticket', 'token'].includes(key))) return false;
  if (payload.action === 'redeem') {
    return OPAQUE_RE.test(payload.ticket || '') && payload.token === undefined;
  }
  return OPAQUE_RE.test(payload.token || '') && payload.ticket === undefined;
}

function deny(response, status, code) {
  return sendJson(response, status, { allowed: false, code });
}

export async function handleScoreEdgeBridge(request, response, dependencies = {}) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (request?.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return deny(response, 405, 'METHOD_NOT_ALLOWED');
  }

  const environment = dependencies.environment || process.env;
  if (environment.VERCEL_ENV !== 'production' ||
      environment.SCORE_EDGE_BRIDGE_ENABLED !== 'true') {
    return deny(response, 503, 'SCORE_EDGE_DISABLED');
  }

  let url;
  try {
    url = requestUrl(request);
  } catch {
    return deny(response, 400, 'INVALID_REQUEST');
  }
  if (url.pathname !== EXACT_PATH || url.hash ||
      url.searchParams.size !== 1 || url.searchParams.get('action') !== EXACT_ACTION) {
    return deny(response, 404, 'SCORE_EDGE_ROUTE_NOT_FOUND');
  }

  const expectedSecret = String(environment.SCORE_EDGE_SHARED_SECRET || '');
  const suppliedSecret = requestHeader(request, 'x-score-edge-secret');
  if (!secretEqual(suppliedSecret, expectedSecret)) {
    return deny(response, 403, 'SCORE_EDGE_DENIED');
  }

  const mediaType = requestHeader(request, 'content-type').trim();
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(mediaType)) {
    return deny(response, 415, 'UNSUPPORTED_MEDIA_TYPE');
  }

  const parsed = boundedJsonBody(request);
  if (parsed.error) {
    return deny(response, parsed.error === 'too-large' ? 413 : 400, 'INVALID_REQUEST');
  }
  if (!validSchema(parsed.value)) return deny(response, 400, 'INVALID_REQUEST');

  try {
    const config = dependencies.config || readPrivateConfig(environment);
    const fetchImpl = dependencies.fetchImpl || fetch;
    const ticketStore = dependencies.ticketStore || createSupabaseScoreTicketStore({ config, fetchImpl });
    const providers = dependencies.providers || createScoreMembershipProviders({ config, fetchImpl });
    const redeem = dependencies.redeemScoreHandoff || redeemScoreHandoff;
    const authorize = dependencies.authorizeScoreSession || authorizeScoreSession;

    if (parsed.value.action === 'redeem') {
      const result = await redeem({
        ticket: parsed.value.ticket,
        ticketStore,
        membership: providers.membership,
        sessions: providers.sessions,
      });
      if (!result?.allowed) return deny(response, 403, 'SCORE_EDGE_DENIED');
      return sendJson(response, 200, {
        allowed: true,
        token: result.token,
        path: result.path,
        expiresAt: new Date(result.expiresAtMs).toISOString(),
      });
    }

    const allowed = await authorize({
      token: parsed.value.token,
      sessions: providers.sessions,
      membership: providers.membership,
    });
    return allowed
      ? sendJson(response, 200, { allowed: true })
      : deny(response, 403, 'SCORE_EDGE_DENIED');
  } catch {
    return deny(response, 503, 'SCORE_EDGE_UNAVAILABLE');
  }
}
