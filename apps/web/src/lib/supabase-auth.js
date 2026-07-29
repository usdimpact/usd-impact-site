import {
  SupabaseConfigurationError,
  SupabaseRequestError,
  readBearerToken,
  readSupabaseServerConfig,
  requestHeader,
} from './supabase-server.js';

export const SESSION_COOKIE_NAMES = Object.freeze({
  ACCESS: 'usd_impact_access',
  REFRESH: 'usd_impact_refresh',
});

const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_PATTERN = /^[A-Za-z0-9._~-]{20,12000}$/;
const TOKEN_HASH_PATTERN = /^[A-Za-z0-9_-]{20,512}$/;
const ALLOWED_EMAIL_TYPES = new Set(['email', 'magiclink', 'signup']);
const ACCESS_COOKIE_MAX_AGE = 60 * 60;
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function normalizeEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw new SupabaseRequestError('Enter a valid email address.', {
      status: 400,
      code: 'INVALID_EMAIL',
    });
  }
  return email;
}

function readJsonBody(response) {
  return response.text().then((text) => {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { message: text.slice(0, 500) };
    }
  });
}

async function authRequest({
  config,
  path,
  method = 'POST',
  accessToken = null,
  body,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl(`${config.url}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: config.publishableKey,
      Authorization: `Bearer ${accessToken || config.publishableKey}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await readJsonBody(response);
  if (!response.ok) {
    throw new SupabaseRequestError(
      payload?.msg || payload?.message || payload?.error_description || payload?.error || 'Authentication request failed.',
      {
        status: response.status,
        code: payload?.code || payload?.error_code || 'AUTH_REQUEST_FAILED',
        details: payload,
      },
    );
  }
  return payload;
}

function normalizeSession(payload) {
  const session = payload?.session || payload;
  const accessToken = session?.access_token;
  const refreshToken = session?.refresh_token;
  const expiresIn = Number(session?.expires_in || ACCESS_COOKIE_MAX_AGE);
  if (!TOKEN_PATTERN.test(accessToken || '') || !TOKEN_PATTERN.test(refreshToken || '')) {
    throw new SupabaseRequestError('The authentication session was invalid.', {
      status: 502,
      code: 'INVALID_AUTH_SESSION',
    });
  }
  return Object.freeze({
    accessToken,
    refreshToken,
    expiresIn: Number.isFinite(expiresIn) && expiresIn > 0
      ? Math.min(Math.floor(expiresIn), ACCESS_COOKIE_MAX_AGE)
      : ACCESS_COOKIE_MAX_AGE,
  });
}

function cookieMap(request) {
  const map = new Map();
  const header = requestHeader(request, 'cookie');
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    const rawValue = part.slice(index + 1).trim();
    try {
      map.set(name, decodeURIComponent(rawValue));
    } catch {
      map.set(name, rawValue);
    }
  }
  return map;
}

function forwardedValue(request, name) {
  return requestHeader(request, name).split(',')[0].trim();
}

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function isUsdImpactPreviewHost(hostname) {
  return hostname.startsWith('usd-impact-site-') && hostname.endsWith('-usd-impact.vercel.app');
}

function isAllowedHost(hostname) {
  return isLocalHost(hostname)
    || hostname === 'usd-impact.com'
    || hostname === 'www.usd-impact.com'
    || isUsdImpactPreviewHost(hostname);
}

export function requestOrigin(request) {
  const host = forwardedValue(request, 'x-forwarded-host') || requestHeader(request, 'host').trim();
  if (!host || /[\s\\/]/.test(host)) {
    throw new SupabaseRequestError('The request host is invalid.', {
      status: 400,
      code: 'INVALID_REQUEST_HOST',
    });
  }
  const protocol = forwardedValue(request, 'x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  if (protocol !== 'https' && protocol !== 'http') {
    throw new SupabaseRequestError('The request protocol is invalid.', {
      status: 400,
      code: 'INVALID_REQUEST_PROTOCOL',
    });
  }
  const url = new URL(`${protocol}://${host}`);
  if (!isAllowedHost(url.hostname) || (protocol !== 'https' && !isLocalHost(url.hostname))) {
    throw new SupabaseRequestError('The request host is not allowed.', {
      status: 400,
      code: 'UNTRUSTED_REQUEST_HOST',
    });
  }
  return url.origin;
}

export function safeNextPath(value, fallback = '/account/') {
  const next = String(value ?? '').trim();
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\') || next.length > 512) {
    return fallback;
  }
  try {
    const parsed = new URL(next, 'https://usd-impact.invalid');
    if (parsed.origin !== 'https://usd-impact.invalid') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function shouldUseSecureCookie(request) {
  const protocol = forwardedValue(request, 'x-forwarded-proto');
  if (protocol) return protocol === 'https';
  const host = requestHeader(request, 'host').split(':')[0];
  return !isLocalHost(host);
}

function serializeCookie(name, value, { maxAge, request }) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
  ];
  if (shouldUseSecureCookie(request)) parts.push('Secure');
  return parts.join('; ');
}

function appendSetCookies(response, cookies) {
  const existing = typeof response.getHeader === 'function' ? response.getHeader('Set-Cookie') : null;
  const current = Array.isArray(existing) ? existing : existing ? [existing] : [];
  response.setHeader('Set-Cookie', [...current, ...cookies]);
}

export function setSessionCookies(response, request, sessionPayload) {
  const session = normalizeSession(sessionPayload);
  appendSetCookies(response, [
    serializeCookie(SESSION_COOKIE_NAMES.ACCESS, session.accessToken, {
      maxAge: session.expiresIn,
      request,
    }),
    serializeCookie(SESSION_COOKIE_NAMES.REFRESH, session.refreshToken, {
      maxAge: REFRESH_COOKIE_MAX_AGE,
      request,
    }),
  ]);
  return session;
}

export function clearSessionCookies(response, request) {
  appendSetCookies(response, [
    serializeCookie(SESSION_COOKIE_NAMES.ACCESS, '', { maxAge: 0, request }),
    serializeCookie(SESSION_COOKIE_NAMES.REFRESH, '', { maxAge: 0, request }),
  ]);
}

export function readSessionAccessToken(request) {
  const bearer = readBearerToken(request);
  if (bearer) return bearer;
  const token = cookieMap(request).get(SESSION_COOKIE_NAMES.ACCESS) || '';
  return TOKEN_PATTERN.test(token) ? token : null;
}

export function readSessionRefreshToken(request) {
  const token = cookieMap(request).get(SESSION_COOKIE_NAMES.REFRESH) || '';
  return TOKEN_PATTERN.test(token) ? token : null;
}

export async function sendPasswordlessEmail({
  email,
  next,
  request,
  environment,
  config,
  fetchImpl,
  shouldCreateUser = true,
}) {
  const resolvedConfig = config || readSupabaseServerConfig(environment);
  const normalizedEmail = normalizeEmail(email);
  const redirectUrl = new URL('/auth/confirm/', requestOrigin(request));
  redirectUrl.searchParams.set('next', safeNextPath(next));
  const redirectTo = redirectUrl.toString();
  await authRequest({
    config: resolvedConfig,
    path: `/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`,
    body: {
      email: normalizedEmail,
      create_user: shouldCreateUser === true,
    },
    fetchImpl,
  });
  return Object.freeze({ email: normalizedEmail, redirectTo });
}

export async function verifyPasswordlessToken({
  tokenHash,
  type,
  environment,
  config,
  fetchImpl,
}) {
  const normalizedHash = String(tokenHash ?? '').trim();
  const normalizedType = String(type ?? '').trim().toLowerCase();
  if (!TOKEN_HASH_PATTERN.test(normalizedHash) || !ALLOWED_EMAIL_TYPES.has(normalizedType)) {
    throw new SupabaseRequestError('The sign-in link is invalid or expired.', {
      status: 400,
      code: 'INVALID_SIGN_IN_LINK',
    });
  }
  const resolvedConfig = config || readSupabaseServerConfig(environment);
  const payload = await authRequest({
    config: resolvedConfig,
    path: '/auth/v1/verify',
    body: { token_hash: normalizedHash, type: normalizedType },
    fetchImpl,
  });
  return normalizeSession(payload);
}

export async function refreshPasswordlessSession({
  refreshToken,
  environment,
  config,
  fetchImpl,
}) {
  if (!TOKEN_PATTERN.test(refreshToken || '')) {
    throw new SupabaseRequestError('Authentication is required.', {
      status: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });
  }
  const resolvedConfig = config || readSupabaseServerConfig(environment);
  const payload = await authRequest({
    config: resolvedConfig,
    path: '/auth/v1/token?grant_type=refresh_token',
    body: { refresh_token: refreshToken },
    fetchImpl,
  });
  return normalizeSession(payload);
}

export async function revokePasswordlessSession({
  accessToken,
  environment,
  config,
  fetchImpl,
}) {
  if (!TOKEN_PATTERN.test(accessToken || '')) return;
  const resolvedConfig = config || readSupabaseServerConfig(environment);
  try {
    await authRequest({
      config: resolvedConfig,
      path: '/auth/v1/logout',
      accessToken,
      body: {},
      fetchImpl,
    });
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) throw error;
    if (!(error instanceof SupabaseRequestError) || error.status >= 500) throw error;
  }
}
