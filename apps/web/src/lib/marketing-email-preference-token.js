import { createHmac, timingSafeEqual } from 'node:crypto';

export const MARKETING_EMAIL_UNSUBSCRIBE_TOKEN_VERSION = 'mu1';
export const MARKETING_EMAIL_PURPOSES = Object.freeze([
  'weekly_newsletter',
  'learning_progress_updates',
]);

const PURPOSE_SET = new Set(MARKETING_EMAIL_PURPOSES);
const CONSENT_KEY_PATTERN = /^consent:v1:([0-9a-f]{64})$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SECRET_PATTERN = /^moi_[A-Za-z0-9_-]{43,}$/;
const TOKEN_MAX_LENGTH = 180;

export class MarketingEmailPreferenceTokenError extends Error {
  constructor(message, code = 'MARKETING_EMAIL_PREFERENCE_TOKEN_INVALID', status = 400) {
    super(message);
    this.name = 'MarketingEmailPreferenceTokenError';
    this.code = code;
    this.status = status;
  }
}

function requireSecret(value) {
  const secret = String(value ?? '').trim();
  if (!SECRET_PATTERN.test(secret)) {
    throw new MarketingEmailPreferenceTokenError(
      'Marketing email preference signing is not configured.',
      'MARKETING_EMAIL_PREFERENCE_CONFIGURATION_ERROR',
      503,
    );
  }
  return secret;
}

function requirePurpose(value) {
  const purpose = String(value ?? '').trim().toLowerCase();
  if (!PURPOSE_SET.has(purpose)) {
    throw new MarketingEmailPreferenceTokenError(
      'Marketing email purpose is not approved.',
      'INVALID_MARKETING_EMAIL_PURPOSE',
      400,
    );
  }
  return purpose;
}

function consentHash(value) {
  const match = String(value ?? '').trim().toLowerCase().match(CONSENT_KEY_PATTERN);
  if (!match) {
    throw new MarketingEmailPreferenceTokenError(
      'Consent identity is invalid.',
      'INVALID_CONSENT_IDENTITY',
      400,
    );
  }
  return match[1];
}

function signingPayload(hash, purpose) {
  return `${MARKETING_EMAIL_UNSUBSCRIBE_TOKEN_VERSION}.${hash}.${purpose}`;
}

function sign(hash, purpose, secret) {
  return createHmac('sha256', requireSecret(secret))
    .update(signingPayload(hash, purpose))
    .digest('base64url');
}

export function createMarketingEmailUnsubscribeToken({
  consentIdempotencyKey,
  purpose,
  secret,
} = {}) {
  const hash = consentHash(consentIdempotencyKey);
  const normalizedPurpose = requirePurpose(purpose);
  const token = `${signingPayload(hash, normalizedPurpose)}.${sign(hash, normalizedPurpose, secret)}`;
  if (token.length > TOKEN_MAX_LENGTH) {
    throw new MarketingEmailPreferenceTokenError(
      'Marketing email unsubscribe token exceeds its approved size.',
      'INVALID_MARKETING_EMAIL_UNSUBSCRIBE_TOKEN',
      400,
    );
  }
  return token;
}

export function verifyMarketingEmailUnsubscribeToken({ token, secret } = {}) {
  const normalized = String(token ?? '').trim();
  if (!normalized || normalized.length > TOKEN_MAX_LENGTH) {
    throw new MarketingEmailPreferenceTokenError(
      'Marketing email unsubscribe token is invalid.',
      'INVALID_MARKETING_EMAIL_UNSUBSCRIBE_TOKEN',
      400,
    );
  }

  const [version, hash, purposeRaw, signature, extra] = normalized.split('.');
  if (
    extra !== undefined
    || version !== MARKETING_EMAIL_UNSUBSCRIBE_TOKEN_VERSION
    || !HASH_PATTERN.test(hash || '')
    || !SIGNATURE_PATTERN.test(signature || '')
  ) {
    throw new MarketingEmailPreferenceTokenError(
      'Marketing email unsubscribe token is invalid.',
      'INVALID_MARKETING_EMAIL_UNSUBSCRIBE_TOKEN',
      400,
    );
  }
  const purpose = requirePurpose(purposeRaw);
  const expected = Buffer.from(sign(hash, purpose, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new MarketingEmailPreferenceTokenError(
      'Marketing email unsubscribe token is invalid.',
      'INVALID_MARKETING_EMAIL_UNSUBSCRIBE_TOKEN',
      400,
    );
  }

  return Object.freeze({
    consentIdempotencyKey: `consent:v1:${hash}`,
    purpose,
    token: normalized,
  });
}

export function createMarketingEmailUnsubscribeUrl({
  grant,
  secret,
  baseUrl = 'https://www.usd-impact.com',
} = {}) {
  if (!grant?.idempotency_key || !grant?.purpose) {
    throw new MarketingEmailPreferenceTokenError(
      'Consent grant is missing.',
      'CONSENT_GRANT_MISSING',
      500,
    );
  }
  const token = createMarketingEmailUnsubscribeToken({
    consentIdempotencyKey: grant.idempotency_key,
    purpose: grant.purpose,
    secret,
  });
  let url;
  try {
    url = new URL('/email/unsubscribe', String(baseUrl ?? '').trim());
  } catch {
    throw new MarketingEmailPreferenceTokenError(
      'Marketing email unsubscribe base URL is invalid.',
      'MARKETING_EMAIL_PREFERENCE_CONFIGURATION_ERROR',
      503,
    );
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if ((!local && url.protocol !== 'https:') || (local && !['http:', 'https:'].includes(url.protocol))) {
    throw new MarketingEmailPreferenceTokenError(
      'Marketing email unsubscribe base URL must use HTTPS outside localhost.',
      'MARKETING_EMAIL_PREFERENCE_CONFIGURATION_ERROR',
      503,
    );
  }
  url.search = '';
  url.hash = '';
  url.searchParams.set('token', token);
  return url.toString();
}

export function createMarketingEmailUnsubscribeHeaders({ grant, secret, baseUrl } = {}) {
  const url = createMarketingEmailUnsubscribeUrl({ grant, secret, baseUrl });
  return Object.freeze({
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  });
}
