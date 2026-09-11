import { createHmac, timingSafeEqual } from 'node:crypto';

export const MARKETING_OPT_IN_TOKEN_VERSION = 'm1';
export const MARKETING_OPT_IN_DEFAULT_TTL_SECONDS = 48 * 60 * 60;
export const MARKETING_OPT_IN_MAX_TTL_SECONDS = 72 * 60 * 60;
export const MARKETING_OPT_IN_PURPOSES = Object.freeze([
  'weekly_newsletter',
  'learning_progress_updates',
]);

const PURPOSE_SET = new Set(MARKETING_OPT_IN_PURPOSES);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_PATTERN = /^moi_[A-Za-z0-9_-]{43,}$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TOKEN_MAX_LENGTH = 256;

export class MarketingOptInTokenError extends Error {
  constructor(message, code = 'MARKETING_OPT_IN_TOKEN_INVALID', status = 400) {
    super(message);
    this.name = 'MarketingOptInTokenError';
    this.code = code;
    this.status = status;
  }
}

function requireSecret(value) {
  const secret = String(value ?? '').trim();
  if (!SECRET_PATTERN.test(secret)) {
    throw new MarketingOptInTokenError(
      'Marketing opt-in token secret is missing or invalid.',
      'MARKETING_OPT_IN_CONFIGURATION_ERROR',
      503,
    );
  }
  return secret;
}

function requireRequestId(value) {
  const requestId = String(value ?? '').trim().toLowerCase();
  if (!UUID_PATTERN.test(requestId)) {
    throw new MarketingOptInTokenError('Opt-in request identity is invalid.', 'INVALID_OPT_IN_REQUEST_ID');
  }
  return requestId;
}

function requirePurpose(value) {
  const purpose = String(value ?? '').trim().toLowerCase();
  if (!PURPOSE_SET.has(purpose)) {
    throw new MarketingOptInTokenError('Opt-in purpose is not approved.', 'INVALID_OPT_IN_PURPOSE');
  }
  return purpose;
}

function requireEpochSeconds(value, field) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new MarketingOptInTokenError(`${field} is invalid.`, 'INVALID_OPT_IN_EXPIRY');
  }
  return number;
}

function requireTtlSeconds(value) {
  const ttl = Number(value);
  if (!Number.isSafeInteger(ttl) || ttl <= 0 || ttl > MARKETING_OPT_IN_MAX_TTL_SECONDS) {
    throw new MarketingOptInTokenError('Opt-in confirmation lifetime is invalid.', 'INVALID_OPT_IN_TTL');
  }
  return ttl;
}

function signingPayload({ requestId, purpose, expiresAt }) {
  return `${MARKETING_OPT_IN_TOKEN_VERSION}.${requestId}.${purpose}.${expiresAt}`;
}

function signatureFor(fields, secret) {
  return createHmac('sha256', requireSecret(secret))
    .update(signingPayload(fields))
    .digest('base64url');
}

export function createMarketingOptInToken({
  requestId,
  purpose,
  secret,
  issuedAt = Math.floor(Date.now() / 1000),
  ttlSeconds = MARKETING_OPT_IN_DEFAULT_TTL_SECONDS,
} = {}) {
  const normalizedRequestId = requireRequestId(requestId);
  const normalizedPurpose = requirePurpose(purpose);
  const normalizedIssuedAt = requireEpochSeconds(issuedAt, 'issuedAt');
  const normalizedTtl = requireTtlSeconds(ttlSeconds);
  const expiresAt = normalizedIssuedAt + normalizedTtl;
  const fields = {
    requestId: normalizedRequestId,
    purpose: normalizedPurpose,
    expiresAt,
  };
  const token = `${signingPayload(fields)}.${signatureFor(fields, secret)}`;
  if (token.length > TOKEN_MAX_LENGTH) {
    throw new MarketingOptInTokenError('Opt-in token exceeds its approved size.', 'INVALID_OPT_IN_TOKEN');
  }
  return token;
}

export function verifyMarketingOptInToken({
  token,
  secret,
  now = Math.floor(Date.now() / 1000),
} = {}) {
  const normalizedToken = String(token ?? '').trim();
  if (!normalizedToken || normalizedToken.length > TOKEN_MAX_LENGTH) {
    throw new MarketingOptInTokenError('Opt-in confirmation token is invalid.', 'INVALID_OPT_IN_TOKEN');
  }

  const [version, requestIdRaw, purposeRaw, expiresAtRaw, signature, extra] = normalizedToken.split('.');
  if (extra !== undefined || version !== MARKETING_OPT_IN_TOKEN_VERSION || !SIGNATURE_PATTERN.test(signature || '')) {
    throw new MarketingOptInTokenError('Opt-in confirmation token is invalid.', 'INVALID_OPT_IN_TOKEN');
  }

  const requestId = requireRequestId(requestIdRaw);
  const purpose = requirePurpose(purposeRaw);
  const expiresAt = requireEpochSeconds(expiresAtRaw, 'expiresAt');
  const nowSeconds = requireEpochSeconds(now, 'now');
  const fields = { requestId, purpose, expiresAt };
  const expected = Buffer.from(signatureFor(fields, secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new MarketingOptInTokenError('Opt-in confirmation token is invalid.', 'INVALID_OPT_IN_TOKEN');
  }
  if (nowSeconds > expiresAt) {
    throw new MarketingOptInTokenError('Opt-in confirmation token has expired.', 'OPT_IN_TOKEN_EXPIRED', 410);
  }

  return Object.freeze({
    requestId,
    purpose,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    token: normalizedToken,
  });
}

export function createMarketingOptInConfirmationUrl({ token, baseUrl } = {}) {
  const normalizedToken = String(token ?? '').trim();
  if (!normalizedToken || normalizedToken.length > TOKEN_MAX_LENGTH) {
    throw new MarketingOptInTokenError('Opt-in confirmation token is invalid.', 'INVALID_OPT_IN_TOKEN');
  }

  let url;
  try {
    url = new URL('/email/confirm', String(baseUrl ?? '').trim());
  } catch {
    throw new MarketingOptInTokenError(
      'Marketing opt-in confirmation base URL is invalid.',
      'MARKETING_OPT_IN_CONFIGURATION_ERROR',
      503,
    );
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new MarketingOptInTokenError(
      'Marketing opt-in confirmation base URL must use HTTPS outside localhost.',
      'MARKETING_OPT_IN_CONFIGURATION_ERROR',
      503,
    );
  }
  url.search = '';
  url.hash = '';
  url.searchParams.set('token', normalizedToken);
  return url.toString();
}
