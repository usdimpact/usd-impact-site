import { createHash, timingSafeEqual } from 'node:crypto';
import {
  exchangePasswordlessCode,
  revokePasswordlessSession,
} from './supabase-auth.js';
import { getVerifiedSupabaseUser } from './supabase-server.js';

const PROOF_TOKEN_SHA256 = 'a909a683b81c3b77930e3485bf071f9f1df63c49e335e45dbc47cc3c18da42d9';
const PROOF_EXPIRES_AT = Date.parse('2026-08-20T21:30:00.000Z');
const PRODUCTION_AUTH_URL = 'https://gjzetjugmnwanvjkchux.supabase.co';
const PRODUCTION_PUBLISHABLE_KEY = 'sb_publishable__BQuvq2JXRm-vhkq08M8dA_A-JUBRQN';
const PUBLIC_ORIGIN = 'https://www.usd-impact.com';
const CANONICAL_CALLBACK = 'https://www.usd-impact.com/auth/confirm/?next=%2Faccount%2F';
const APP_PROBE_EMAIL = 'mircea.management@gmail.com';
const PKCE_PROBE_EMAIL = 'mircea.management+usd-impact-eligible@gmail.com';
const MAGIC_TOKEN_PATTERN = /^pkce_[A-Za-z0-9_-]{40,200}$/;

const PRODUCTION_CONFIG = Object.freeze({
  url: PRODUCTION_AUTH_URL,
  publishableKey: PRODUCTION_PUBLISHABLE_KEY,
  secretKey: null,
});

class ControlledAuthProofError extends Error {
  constructor(message, code = 'CONTROLLED_AUTH_PROOF_FAILED') {
    super(message);
    this.name = 'ControlledAuthProofError';
    this.code = code;
  }
}

function sendJson(response, status, body, extraHeaders = {}) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);
  response.end(JSON.stringify(body));
}

function requestUrl(request) {
  return new URL(request.url || '/', 'https://usd-impact.invalid');
}

function validProofToken(value) {
  if (typeof value !== 'string' || value.length < 32 || value.length > 128) return false;
  const actual = Buffer.from(createHash('sha256').update(value).digest('hex'), 'utf8');
  const expected = Buffer.from(PROOF_TOKEN_SHA256, 'utf8');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function boundedCode(error) {
  const normalized = String(error?.code || 'CONTROLLED_AUTH_PROOF_FAILED')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .slice(0, 80);
  return /^[A-Z][A-Z0-9_]{1,79}$/.test(normalized)
    ? normalized
    : 'CONTROLLED_AUTH_PROOF_FAILED';
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function authHeaders(accessToken = null) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    apikey: PRODUCTION_PUBLISHABLE_KEY,
    Authorization: `Bearer ${accessToken || PRODUCTION_PUBLISHABLE_KEY}`,
  };
}

function rateLimitEvidence(headers) {
  const result = {};
  for (const name of [
    'retry-after',
    'ratelimit-limit',
    'ratelimit-remaining',
    'ratelimit-reset',
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'x-ratelimit-reset',
  ]) {
    const value = headers.get(name);
    if (value && value.length <= 120) result[name] = value;
  }
  return result;
}

function safeSettings(payload) {
  const external = payload?.external && typeof payload.external === 'object'
    ? Object.fromEntries(
        Object.entries(payload.external)
          .filter(([, value]) => typeof value === 'boolean')
          .sort(([left], [right]) => left.localeCompare(right)),
      )
    : {};
  const safe = { external };
  for (const key of [
    'disable_signup',
    'mailer_autoconfirm',
    'phone_autoconfirm',
    'sms_autoconfirm',
  ]) {
    if (typeof payload?.[key] === 'boolean') safe[key] = payload[key];
  }
  return safe;
}

function derivePkce(proofToken) {
  const verifier = createHash('sha256')
    .update(`usd-impact-production-auth-proof:${proofToken}`)
    .digest('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return Object.freeze({ verifier, challenge });
}

async function handleSettings(response) {
  const providerResponse = await fetch(`${PRODUCTION_AUTH_URL}/auth/v1/settings`, {
    method: 'GET',
    headers: authHeaders(),
    redirect: 'manual',
  });
  const payload = await readJsonSafely(providerResponse);
  if (!providerResponse.ok) {
    throw new ControlledAuthProofError(
      `Production Auth settings returned ${providerResponse.status}.`,
      `AUTH_SETTINGS_HTTP_${providerResponse.status}`,
    );
  }
  return sendJson(response, 200, {
    ok: true,
    mode: 'settings',
    projectRef: 'gjzetjugmnwanvjkchux',
    settings: safeSettings(payload),
    rateLimitHeaders: rateLimitEvidence(providerResponse.headers),
  });
}

async function handleAppRequest(response) {
  const providerResponse = await fetch(`${PUBLIC_ORIGIN}/api/auth-login`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Origin: PUBLIC_ORIGIN,
      Referer: `${PUBLIC_ORIGIN}/account/sign-in/`,
      'Sec-Fetch-Site': 'same-origin',
    },
    body: JSON.stringify({ email: APP_PROBE_EMAIL, next: '/account/' }),
  });
  const payload = await readJsonSafely(providerResponse);
  const neutralMessage = 'If the address can receive a sign-in email, a link has been sent.';
  return sendJson(response, providerResponse.ok ? 200 : 502, {
    ok: providerResponse.ok,
    mode: 'app-request',
    applicationStatus: providerResponse.status,
    neutralResponse: payload?.message === neutralMessage,
    pkceCookieIssued: /(?:^|[,;]\s*)usd_impact_pkce=/.test(
      providerResponse.headers.get('set-cookie') || '',
    ),
    locationPresent: Boolean(providerResponse.headers.get('location')),
  });
}

async function handlePkceRequest(response, proofToken) {
  const pkce = derivePkce(proofToken);
  const endpoint = new URL('/auth/v1/otp', PRODUCTION_AUTH_URL);
  endpoint.searchParams.set('redirect_to', CANONICAL_CALLBACK);
  const providerResponse = await fetch(endpoint, {
    method: 'POST',
    headers: authHeaders(),
    redirect: 'manual',
    body: JSON.stringify({
      email: PKCE_PROBE_EMAIL,
      create_user: false,
      code_challenge: pkce.challenge,
      code_challenge_method: 's256',
    }),
  });
  await readJsonSafely(providerResponse);
  if (!providerResponse.ok) {
    throw new ControlledAuthProofError(
      `Production Auth OTP request returned ${providerResponse.status}.`,
      `AUTH_OTP_HTTP_${providerResponse.status}`,
    );
  }
  return sendJson(response, 200, {
    ok: true,
    mode: 'pkce-request',
    authStatus: providerResponse.status,
    requestedRedirect: {
      origin: new URL(CANONICAL_CALLBACK).origin,
      pathname: new URL(CANONICAL_CALLBACK).pathname,
    },
    rateLimitHeaders: rateLimitEvidence(providerResponse.headers),
  });
}

async function handleExchange(response, proofToken, magicToken) {
  if (!MAGIC_TOKEN_PATTERN.test(magicToken || '')) {
    throw new ControlledAuthProofError('The controlled magic token is invalid.', 'INVALID_MAGIC_TOKEN');
  }
  const pkce = derivePkce(proofToken);
  const verifyUrl = new URL('/auth/v1/verify', PRODUCTION_AUTH_URL);
  verifyUrl.searchParams.set('token', magicToken);
  verifyUrl.searchParams.set('type', 'magiclink');
  verifyUrl.searchParams.set('redirect_to', CANONICAL_CALLBACK);

  const verifyResponse = await fetch(verifyUrl, {
    method: 'GET',
    headers: authHeaders(),
    redirect: 'manual',
  });
  const location = verifyResponse.headers.get('location');
  if (![301, 302, 303, 307, 308].includes(verifyResponse.status) || !location) {
    throw new ControlledAuthProofError(
      `Production Auth verification returned ${verifyResponse.status}.`,
      'AUTH_VERIFY_REDIRECT_MISSING',
    );
  }

  const redirect = new URL(location, PRODUCTION_AUTH_URL);
  const allowedOrigins = new Set([
    'https://www.usd-impact.com',
    'https://usd-impact.com',
    'https://usd-impact-site-usd-impact.vercel.app',
  ]);
  if (!allowedOrigins.has(redirect.origin)) {
    throw new ControlledAuthProofError(
      'Production Auth redirected to an unexpected origin.',
      'UNEXPECTED_AUTH_REDIRECT',
    );
  }
  const authCode = redirect.searchParams.get('code');
  if (!authCode) {
    throw new ControlledAuthProofError(
      'Production Auth redirect did not contain a PKCE code.',
      'AUTH_CODE_MISSING',
    );
  }

  const session = await exchangePasswordlessCode({
    authCode,
    codeVerifier: pkce.verifier,
    config: PRODUCTION_CONFIG,
  });
  const user = await getVerifiedSupabaseUser(session.accessToken, {
    config: PRODUCTION_CONFIG,
  });
  const emailMatches = user.email === PKCE_PROBE_EMAIL;
  if (!emailMatches) {
    throw new ControlledAuthProofError(
      'The Production Auth session belongs to an unexpected account.',
      'AUTH_ACCOUNT_MISMATCH',
    );
  }
  await revokePasswordlessSession({
    accessToken: session.accessToken,
    config: PRODUCTION_CONFIG,
  });

  return sendJson(response, 200, {
    ok: true,
    mode: 'exchange',
    verifyStatus: verifyResponse.status,
    redirect: {
      origin: redirect.origin,
      pathname: redirect.pathname,
      canonicalCallback: redirect.origin === 'https://www.usd-impact.com'
        && redirect.pathname === '/auth/confirm/',
    },
    pkceExchangeSucceeded: true,
    verifiedEmailMatched: emailMatches,
    logoutRequestCompleted: true,
  });
}

async function handleInvalidLink(response) {
  const invalidUrl = new URL('/api/account', PUBLIC_ORIGIN);
  invalidUrl.searchParams.set('action', 'confirm');
  invalidUrl.searchParams.set('code', 'invalid-production-link-20260820-abcdef');
  invalidUrl.searchParams.set('next', '/account/');
  const applicationResponse = await fetch(invalidUrl, {
    method: 'GET',
    redirect: 'manual',
    headers: { Accept: 'text/html' },
  });
  const location = applicationResponse.headers.get('location');
  const redirect = location ? new URL(location, PUBLIC_ORIGIN) : null;
  return sendJson(response, 200, {
    ok: true,
    mode: 'invalid-link',
    applicationStatus: applicationResponse.status,
    safeFailure: applicationResponse.status === 303
      && redirect?.pathname === '/account/sign-in/'
      && redirect.searchParams.get('error') === 'invalid_link',
    redirectPath: redirect ? `${redirect.pathname}${redirect.search}` : null,
  });
}

export async function handleControlledProductionAuthProof(request, response) {
  if (request.method !== 'GET') {
    return sendJson(
      response,
      405,
      { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' },
      { Allow: 'GET' },
    );
  }
  if (String(process.env.VERCEL_ENV || '').toLowerCase() === 'production') {
    return sendJson(response, 404, { error: 'Not found.', code: 'NOT_FOUND' });
  }
  if (Date.now() > PROOF_EXPIRES_AT) {
    return sendJson(
      response,
      410,
      { error: 'Controlled proof expired.', code: 'CONTROLLED_PROOF_EXPIRED' },
    );
  }

  const url = requestUrl(request);
  const proofToken = url.searchParams.get('proof') || '';
  if (!validProofToken(proofToken)) {
    return sendJson(response, 404, { error: 'Not found.', code: 'NOT_FOUND' });
  }

  try {
    const mode = url.searchParams.get('mode') || '';
    if (mode === 'settings') return await handleSettings(response);
    if (mode === 'app-request') return await handleAppRequest(response);
    if (mode === 'pkce-request') return await handlePkceRequest(response, proofToken);
    if (mode === 'exchange') {
      return await handleExchange(response, proofToken, url.searchParams.get('token') || '');
    }
    if (mode === 'invalid-link') return await handleInvalidLink(response);
    return sendJson(response, 400, { error: 'Invalid mode.', code: 'INVALID_MODE' });
  } catch (error) {
    const code = boundedCode(error);
    console.error('Controlled Production Auth proof failed.', { code });
    return sendJson(response, 502, {
      ok: false,
      error: 'Controlled Production Auth proof failed.',
      code,
    });
  }
}
