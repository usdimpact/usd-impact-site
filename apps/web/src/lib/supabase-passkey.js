import {
  SupabaseRequestError,
  readSupabaseServerConfig,
  requestHeader,
} from './supabase-server.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCESS_TOKEN_PATTERN = /^[\x21-\x7E]{20,16384}$/;
const CAPTCHA_TOKEN_MAX_LENGTH = 2048;
const CREDENTIAL_MAX_BYTES = 64 * 1024;
const FRIENDLY_NAME_MAX_LENGTH = 120;

export function passkeyAuthEnabled(environment = process.env) {
  return String(environment.PASSKEY_AUTH_ENABLED ?? '').trim().toLowerCase() === 'true';
}

function requirePasskeyAuthEnabled(environment) {
  if (!passkeyAuthEnabled(environment)) {
    throw new SupabaseRequestError('Passkey authentication is not enabled.', {
      status: 404,
      code: 'PASSKEY_AUTH_DISABLED',
    });
  }
}

function normalizeAccessToken(accessToken) {
  const token = String(accessToken ?? '').trim();
  if (!ACCESS_TOKEN_PATTERN.test(token)) {
    throw new SupabaseRequestError('Authentication is required.', {
      status: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });
  }
  return token;
}

function normalizeUuid(value, fieldName) {
  const normalized = String(value ?? '').trim();
  if (!UUID_PATTERN.test(normalized)) {
    throw new SupabaseRequestError(`${fieldName} is invalid.`, {
      status: 400,
      code: 'INVALID_PASSKEY_REQUEST',
    });
  }
  return normalized;
}

function normalizeFriendlyName(value) {
  const name = String(value ?? '').trim();
  if (!name || name.length > FRIENDLY_NAME_MAX_LENGTH || /[\x00-\x1F\x7F]/.test(name)) {
    throw new SupabaseRequestError('Passkey name is invalid.', {
      status: 400,
      code: 'INVALID_PASSKEY_NAME',
    });
  }
  return name;
}

function normalizeCredential(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SupabaseRequestError('Passkey credential is invalid.', {
      status: 400,
      code: 'INVALID_PASSKEY_CREDENTIAL',
    });
  }
  let encoded;
  try {
    encoded = JSON.stringify(value);
  } catch {
    encoded = '';
  }
  if (!encoded || Buffer.byteLength(encoded, 'utf8') > CREDENTIAL_MAX_BYTES) {
    throw new SupabaseRequestError('Passkey credential is invalid.', {
      status: 400,
      code: 'INVALID_PASSKEY_CREDENTIAL',
    });
  }
  return value;
}

function readCaptchaToken(request) {
  const token = requestHeader(request, 'x-turnstile-token').trim();
  if (!token) return null;
  if (token.length > CAPTCHA_TOKEN_MAX_LENGTH || /[\x00-\x1F\x7F]/.test(token)) {
    throw new SupabaseRequestError('The security check was invalid.', {
      status: 400,
      code: 'INVALID_CAPTCHA_TOKEN',
    });
  }
  return token;
}

async function readJsonBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

async function passkeyRequest({
  path,
  method = 'POST',
  accessToken = null,
  body,
  environment,
  config,
  fetchImpl = fetch,
}) {
  requirePasskeyAuthEnabled(environment || process.env);
  const resolvedConfig = config || readSupabaseServerConfig(environment);
  const response = await fetchImpl(`${resolvedConfig.url}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: resolvedConfig.publishableKey,
      Authorization: `Bearer ${accessToken || resolvedConfig.publishableKey}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await readJsonBody(response);
  if (!response.ok) {
    throw new SupabaseRequestError(
      payload?.msg || payload?.message || payload?.error_description || payload?.error || 'Passkey request failed.',
      {
        status: response.status,
        code: payload?.code || payload?.error_code || 'PASSKEY_REQUEST_FAILED',
        details: payload,
      },
    );
  }
  return payload;
}

function normalizeCeremonyOptions(payload) {
  const challengeId = normalizeUuid(payload?.challenge_id, 'Passkey challenge');
  const options = payload?.options;
  const expiresAt = Number(payload?.expires_at);
  if (!options || typeof options !== 'object' || Array.isArray(options) || !Number.isFinite(expiresAt)) {
    throw new SupabaseRequestError('Passkey ceremony options were invalid.', {
      status: 502,
      code: 'INVALID_PASSKEY_OPTIONS',
    });
  }
  return Object.freeze({ challengeId, options, expiresAt });
}

function normalizePasskeyMetadata(payload) {
  const id = normalizeUuid(payload?.id, 'Passkey');
  const friendlyName = typeof payload?.friendly_name === 'string' ? payload.friendly_name.slice(0, 120) : '';
  const createdAt = typeof payload?.created_at === 'string' ? payload.created_at : null;
  const lastUsedAt = typeof payload?.last_used_at === 'string' ? payload.last_used_at : null;
  return Object.freeze({ id, friendlyName, createdAt, lastUsedAt });
}

export async function startPasskeyAuthentication({
  request,
  environment,
  config,
  fetchImpl,
} = {}) {
  const captchaToken = readCaptchaToken(request);
  const payload = await passkeyRequest({
    path: '/auth/v1/passkeys/authentication/options',
    body: {
      gotrue_meta_security: {
        ...(captchaToken ? { captcha_token: captchaToken } : {}),
      },
    },
    environment,
    config,
    fetchImpl,
  });
  return normalizeCeremonyOptions(payload);
}

export async function verifyPasskeyAuthentication({
  challengeId,
  credential,
  environment,
  config,
  fetchImpl,
}) {
  return passkeyRequest({
    path: '/auth/v1/passkeys/authentication/verify',
    body: {
      challenge_id: normalizeUuid(challengeId, 'Passkey challenge'),
      credential: normalizeCredential(credential),
    },
    environment,
    config,
    fetchImpl,
  });
}

export async function startPasskeyRegistration({
  accessToken,
  environment,
  config,
  fetchImpl,
}) {
  const payload = await passkeyRequest({
    path: '/auth/v1/passkeys/registration/options',
    accessToken: normalizeAccessToken(accessToken),
    body: {},
    environment,
    config,
    fetchImpl,
  });
  return normalizeCeremonyOptions(payload);
}

export async function verifyPasskeyRegistration({
  accessToken,
  challengeId,
  credential,
  environment,
  config,
  fetchImpl,
}) {
  const payload = await passkeyRequest({
    path: '/auth/v1/passkeys/registration/verify',
    accessToken: normalizeAccessToken(accessToken),
    body: {
      challenge_id: normalizeUuid(challengeId, 'Passkey challenge'),
      credential: normalizeCredential(credential),
    },
    environment,
    config,
    fetchImpl,
  });
  return normalizePasskeyMetadata(payload);
}

export async function listPasskeys({
  accessToken,
  environment,
  config,
  fetchImpl,
}) {
  const payload = await passkeyRequest({
    path: '/auth/v1/passkeys',
    method: 'GET',
    accessToken: normalizeAccessToken(accessToken),
    environment,
    config,
    fetchImpl,
  });
  if (!Array.isArray(payload)) {
    throw new SupabaseRequestError('Passkey list response was invalid.', {
      status: 502,
      code: 'INVALID_PASSKEY_LIST',
    });
  }
  return Object.freeze(payload.map(normalizePasskeyMetadata));
}

export async function renamePasskey({
  accessToken,
  passkeyId,
  friendlyName,
  environment,
  config,
  fetchImpl,
}) {
  const id = normalizeUuid(passkeyId, 'Passkey');
  const payload = await passkeyRequest({
    path: `/auth/v1/passkeys/${encodeURIComponent(id)}`,
    method: 'PATCH',
    accessToken: normalizeAccessToken(accessToken),
    body: { friendly_name: normalizeFriendlyName(friendlyName) },
    environment,
    config,
    fetchImpl,
  });
  return normalizePasskeyMetadata(payload);
}

export async function deletePasskey({
  accessToken,
  passkeyId,
  environment,
  config,
  fetchImpl,
}) {
  const id = normalizeUuid(passkeyId, 'Passkey');
  await passkeyRequest({
    path: `/auth/v1/passkeys/${encodeURIComponent(id)}`,
    method: 'DELETE',
    accessToken: normalizeAccessToken(accessToken),
    environment,
    config,
    fetchImpl,
  });
  return Object.freeze({ id });
}
