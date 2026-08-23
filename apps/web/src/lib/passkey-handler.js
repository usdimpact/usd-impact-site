import { safeSupabaseError, sendJson } from './supabase-server.js';
import {
  clearPkceCookie,
  readSessionAccessToken,
  safeNextPath,
  setSessionCookies,
} from './supabase-auth.js';
import {
  emailOtpRecoveryEnabled,
  verifyEmailOtpRecovery,
} from './email-otp-recovery.js';
import {
  deletePasskey,
  listPasskeys,
  passkeyAuthEnabled,
  renamePasskey,
  startPasskeyAuthentication,
  startPasskeyRegistration,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration,
} from './supabase-passkey.js';

function header(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? '' : String(value ?? '');
}

function requestUrl(request) {
  return new URL(request.url || '/api/account', 'https://usd-impact.invalid');
}

function operation(request) {
  return requestUrl(request).searchParams.get('op')?.trim().toLowerCase() || 'status';
}

function parseBody(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string' || Buffer.isBuffer(request.body)) return JSON.parse(request.body.toString());
  return {};
}

function methodNotAllowed(response, allowed) {
  response.setHeader('Allow', allowed);
  return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
}

function requireSameSiteJson(request, response) {
  if (header(request, 'sec-fetch-site') === 'cross-site') {
    sendJson(response, 403, { error: 'Cross-site requests are not allowed.', code: 'CROSS_SITE_REQUEST' });
    return false;
  }
  if (!header(request, 'content-type').includes('application/json')) {
    sendJson(response, 415, { error: 'Content type must be application/json.', code: 'INVALID_CONTENT_TYPE' });
    return false;
  }
  return true;
}

function requireAccessToken(request, response) {
  const accessToken = readSessionAccessToken(request);
  if (!accessToken) {
    sendJson(response, 401, { error: 'Authentication is required.', code: 'AUTHENTICATION_REQUIRED' });
    return null;
  }
  return accessToken;
}

function safeError(response, error) {
  const safe = safeSupabaseError(error);
  return sendJson(response, safe.status, safe.payload);
}

function safeRecoveryError(response, error) {
  const safe = safeSupabaseError(error);
  if (safe.status < 500 && safe.payload?.code !== 'EMAIL_OTP_FALLBACK_DISABLED') {
    return sendJson(response, 400, {
      error: 'The email code is invalid or expired.',
      code: 'INVALID_EMAIL_OTP',
    });
  }
  return sendJson(response, safe.status, safe.payload);
}

async function status(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, 'GET');
  return sendJson(response, 200, { enabled: passkeyAuthEnabled() });
}

async function recoveryStatus(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, 'GET');
  return sendJson(response, 200, { enabled: emailOtpRecoveryEnabled() });
}

async function recoveryVerify(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  if (!requireSameSiteJson(request, response)) return;
  let payload;
  try {
    payload = parseBody(request);
  } catch {
    return sendJson(response, 400, { error: 'Invalid request body.', code: 'INVALID_REQUEST_BODY' });
  }
  try {
    const session = await verifyEmailOtpRecovery({
      email: payload.email,
      token: payload.token,
    });
    clearPkceCookie(response, request);
    setSessionCookies(response, request, session);
    return sendJson(response, 200, {
      ok: true,
      redirect: safeNextPath(payload.next),
    });
  } catch (error) {
    return safeRecoveryError(response, error);
  }
}

async function authenticationOptions(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  if (!requireSameSiteJson(request, response)) return;
  try {
    const result = await startPasskeyAuthentication({ request });
    return sendJson(response, 200, result);
  } catch (error) {
    return safeError(response, error);
  }
}

async function authenticationVerify(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  if (!requireSameSiteJson(request, response)) return;
  let payload;
  try {
    payload = parseBody(request);
  } catch {
    return sendJson(response, 400, { error: 'Invalid request body.', code: 'INVALID_REQUEST_BODY' });
  }
  try {
    const session = await verifyPasskeyAuthentication({
      challengeId: payload.challengeId,
      credential: payload.credential,
    });
    setSessionCookies(response, request, session);
    return sendJson(response, 200, {
      ok: true,
      redirect: safeNextPath(payload.next),
    });
  } catch (error) {
    return safeError(response, error);
  }
}

async function list(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, 'GET');
  const accessToken = requireAccessToken(request, response);
  if (!accessToken) return;
  try {
    const passkeys = await listPasskeys({ accessToken });
    return sendJson(response, 200, { passkeys });
  } catch (error) {
    return safeError(response, error);
  }
}

async function registrationOptions(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  if (!requireSameSiteJson(request, response)) return;
  const accessToken = requireAccessToken(request, response);
  if (!accessToken) return;
  try {
    const result = await startPasskeyRegistration({ accessToken });
    return sendJson(response, 200, result);
  } catch (error) {
    return safeError(response, error);
  }
}

async function registrationVerify(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  if (!requireSameSiteJson(request, response)) return;
  const accessToken = requireAccessToken(request, response);
  if (!accessToken) return;
  let payload;
  try {
    payload = parseBody(request);
  } catch {
    return sendJson(response, 400, { error: 'Invalid request body.', code: 'INVALID_REQUEST_BODY' });
  }
  try {
    const passkey = await verifyPasskeyRegistration({
      accessToken,
      challengeId: payload.challengeId,
      credential: payload.credential,
    });
    return sendJson(response, 201, { passkey });
  } catch (error) {
    return safeError(response, error);
  }
}

async function rename(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  if (!requireSameSiteJson(request, response)) return;
  const accessToken = requireAccessToken(request, response);
  if (!accessToken) return;
  let payload;
  try {
    payload = parseBody(request);
  } catch {
    return sendJson(response, 400, { error: 'Invalid request body.', code: 'INVALID_REQUEST_BODY' });
  }
  try {
    const passkey = await renamePasskey({
      accessToken,
      passkeyId: payload.passkeyId,
      friendlyName: payload.friendlyName,
    });
    return sendJson(response, 200, { passkey });
  } catch (error) {
    return safeError(response, error);
  }
}

async function remove(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  if (!requireSameSiteJson(request, response)) return;
  const accessToken = requireAccessToken(request, response);
  if (!accessToken) return;
  let payload;
  try {
    payload = parseBody(request);
  } catch {
    return sendJson(response, 400, { error: 'Invalid request body.', code: 'INVALID_REQUEST_BODY' });
  }
  try {
    const result = await deletePasskey({
      accessToken,
      passkeyId: payload.passkeyId,
    });
    return sendJson(response, 200, { ok: true, ...result });
  } catch (error) {
    return safeError(response, error);
  }
}

const operations = Object.freeze({
  status,
  'recovery-status': recoveryStatus,
  'recovery-verify': recoveryVerify,
  'authentication-options': authenticationOptions,
  'authentication-verify': authenticationVerify,
  list,
  'registration-options': registrationOptions,
  'registration-verify': registrationVerify,
  rename,
  delete: remove,
});

export async function handlePasskeyRequest(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const selected = operations[operation(request)];
  if (!selected) {
    return sendJson(response, 404, { error: 'Passkey action not found.', code: 'PASSKEY_ACTION_NOT_FOUND' });
  }
  return selected(request, response);
}
