import { createHmac, timingSafeEqual } from 'node:crypto';
import { createConsentEventRecord } from './email-readiness-contracts.js';
import { readSupabaseServerConfig, requestHeader } from './supabase-server.js';
import {
  WAITLIST_CONSENT_PURPOSE,
  WAITLIST_DEVELOPMENT_PROJECT_REF,
  WAITLIST_PRODUCTION_PROJECT_REF,
  createWaitlistReadinessRecords,
} from './waitlist-readiness.js';

export const WAITLIST_UNSUBSCRIBE_TOKEN_VERSION = 'u1';
export const WAITLIST_UNSUBSCRIBE_FORM_VERSION = 'waitlist-unsubscribe-v1';

const CONSENT_KEY_PATTERN = /^consent:v1:([0-9a-f]{64})$/;
const TOKEN_HASH_PATTERN = /^[0-9a-f]{64}$/;
const TOKEN_SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SECRET_PATTERN = /^wus_[A-Za-z0-9_-]{43,}$/;
const TOKEN_MAX_LENGTH = 160;
const RESEND_API = 'https://api.resend.com';

export class WaitlistUnsubscribeError extends Error {
  constructor(message, code = 'WAITLIST_UNSUBSCRIBE_FAILED', status = 400) {
    super(message);
    this.name = 'WaitlistUnsubscribeError';
    this.code = code;
    this.status = status;
  }
}

function requireSecret(value) {
  const secret = String(value ?? '').trim();
  if (!SECRET_PATTERN.test(secret)) {
    throw new WaitlistUnsubscribeError(
      'WAITLIST_UNSUBSCRIBE_SECRET is missing or invalid.',
      'UNSUBSCRIBE_CONFIGURATION_ERROR',
      503,
    );
  }
  return secret;
}

function requireConsentIdempotencyKey(value) {
  const key = String(value ?? '').trim().toLowerCase();
  const match = key.match(CONSENT_KEY_PATTERN);
  if (!match) {
    throw new WaitlistUnsubscribeError(
      'Consent identity is invalid.',
      'INVALID_CONSENT_IDENTITY',
      400,
    );
  }
  return Object.freeze({ key, hash: match[1] });
}

function signingPayload(hash) {
  return `${WAITLIST_UNSUBSCRIBE_TOKEN_VERSION}.${hash}.${WAITLIST_CONSENT_PURPOSE}`;
}

function signTokenHash(hash, secret) {
  return createHmac('sha256', requireSecret(secret))
    .update(signingPayload(hash))
    .digest('base64url');
}

export function createWaitlistUnsubscribeToken({ consentIdempotencyKey, secret }) {
  const identity = requireConsentIdempotencyKey(consentIdempotencyKey);
  return `${WAITLIST_UNSUBSCRIBE_TOKEN_VERSION}.${identity.hash}.${signTokenHash(identity.hash, secret)}`;
}

export function verifyWaitlistUnsubscribeToken({ token, secret }) {
  const normalizedToken = String(token ?? '').trim();
  if (!normalizedToken || normalizedToken.length > TOKEN_MAX_LENGTH) {
    throw new WaitlistUnsubscribeError('Unsubscribe token is invalid.', 'INVALID_UNSUBSCRIBE_TOKEN', 400);
  }

  const [version, hash, signature, extra] = normalizedToken.split('.');
  if (
    extra !== undefined
    || version !== WAITLIST_UNSUBSCRIBE_TOKEN_VERSION
    || !TOKEN_HASH_PATTERN.test(hash || '')
    || !TOKEN_SIGNATURE_PATTERN.test(signature || '')
  ) {
    throw new WaitlistUnsubscribeError('Unsubscribe token is invalid.', 'INVALID_UNSUBSCRIBE_TOKEN', 400);
  }

  const expected = Buffer.from(signTokenHash(hash, secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new WaitlistUnsubscribeError('Unsubscribe token is invalid.', 'INVALID_UNSUBSCRIBE_TOKEN', 400);
  }

  return Object.freeze({
    consentIdempotencyKey: `consent:v1:${hash}`,
    token: normalizedToken,
  });
}

export function createWaitlistUnsubscribeUrl({
  email,
  submissionId,
  secret,
  baseUrl,
}) {
  const records = createWaitlistReadinessRecords({
    email,
    submissionId,
    capturedAt: '2000-01-01T00:00:00.000Z',
  });
  const token = createWaitlistUnsubscribeToken({
    consentIdempotencyKey: records.consentRecord.idempotency_key,
    secret,
  });

  let url;
  try {
    url = new URL('/unsubscribe', String(baseUrl ?? '').trim());
  } catch {
    throw new WaitlistUnsubscribeError(
      'WAITLIST_UNSUBSCRIBE_BASE_URL is invalid.',
      'UNSUBSCRIBE_CONFIGURATION_ERROR',
      503,
    );
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new WaitlistUnsubscribeError(
      'WAITLIST_UNSUBSCRIBE_BASE_URL must use HTTPS outside localhost.',
      'UNSUBSCRIBE_CONFIGURATION_ERROR',
      503,
    );
  }
  url.search = '';
  url.hash = '';
  url.searchParams.set('token', token);
  return url.toString();
}

function projectRefFromUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const suffix = '.supabase.co';
    if (!hostname.endsWith(suffix)) return null;
    return hostname.slice(0, -suffix.length) || null;
  } catch {
    return null;
  }
}

function assertWriteTarget(config, environment) {
  const projectRef = projectRefFromUrl(config.url);
  const vercelEnvironment = String(environment.VERCEL_ENV || '').trim().toLowerCase();

  if (vercelEnvironment === 'production') {
    if (environment.WAITLIST_UNSUBSCRIBE_PRODUCTION_APPROVED !== 'true') {
      throw new WaitlistUnsubscribeError(
        'Production unsubscribe writes are not approved.',
        'PRODUCTION_UNSUBSCRIBE_NOT_APPROVED',
        503,
      );
    }
    if (projectRef !== WAITLIST_PRODUCTION_PROJECT_REF) {
      throw new WaitlistUnsubscribeError(
        'Production unsubscribe target does not match the canonical Production project.',
        'UNEXPECTED_SUPABASE_PROJECT',
        503,
      );
    }
    return projectRef;
  }

  if (projectRef !== WAITLIST_DEVELOPMENT_PROJECT_REF) {
    throw new WaitlistUnsubscribeError(
      'Non-production unsubscribe writes must target the canonical Development project.',
      'UNEXPECTED_SUPABASE_PROJECT',
      503,
    );
  }
  return projectRef;
}

function requestUrl(request) {
  return new URL(request.url || '/unsubscribe', 'https://usd-impact.invalid');
}

function tokenFromRequest(request) {
  const urlToken = requestUrl(request).searchParams.get('token');
  if (urlToken) return urlToken;
  const body = request.body;
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
    return String(body.token ?? '').trim();
  }
  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    return new URLSearchParams(body.toString()).get('token') || '';
  }
  return '';
}

function hasExplicitConfirmation(request) {
  const body = request.body;
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
    return body.confirm === true || body['List-Unsubscribe'] === 'One-Click';
  }
  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    const fields = new URLSearchParams(body.toString());
    return fields.get('List-Unsubscribe') === 'One-Click'
      || fields.get('confirm') === 'true';
  }
  return false;
}

function acceptsHtml(request) {
  return requestHeader(request, 'accept').toLowerCase().includes('text/html');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function pageDocument({ title, heading, body, form = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="referrer" content="no-referrer">
  <title>${escapeHtml(title)} | USD Impact</title>
</head>
<body style="margin:0;background:#f5f6f8;color:#161a1f;font-family:Inter,Arial,Helvetica,sans-serif;">
  <main style="min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;">
    <section style="width:min(620px,100%);background:#ffffff;border:1px solid #e6e9ed;border-radius:16px;padding:36px;box-sizing:border-box;box-shadow:0 12px 40px rgba(7,26,51,.08);">
      <p style="margin:0 0 12px;color:#8a6b32;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">USD Impact</p>
      <h1 style="margin:0 0 18px;color:#071a33;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.15;">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 24px;color:#5a6472;font-size:17px;line-height:1.65;">${escapeHtml(body)}</p>
      ${form}
      <p style="margin:28px 0 0;color:#5a6472;font-size:13px;line-height:1.55;">This preference affects book availability and related marketing messages. Required account, security, purchase, refund, privacy, and support communications remain separate.</p>
    </section>
  </main>
</body>
</html>`;
}

function unsubscribeForm(token) {
  const action = `/unsubscribe?token=${encodeURIComponent(token)}`;
  return `<form method="post" action="${escapeHtml(action)}">
    <input type="hidden" name="List-Unsubscribe" value="One-Click">
    <button type="submit" style="appearance:none;border:0;border-radius:10px;background:#071a33;color:#ffffff;cursor:pointer;font-size:16px;font-weight:700;padding:14px 22px;">Confirm unsubscribe</button>
  </form>`;
}

function responseHeaders(response, contentType) {
  response.setHeader('Content-Type', contentType);
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  );
}

function sendHtml(response, status, html) {
  response.statusCode = status;
  responseHeaders(response, 'text/html; charset=utf-8');
  response.end(html);
}

function sendEmpty(response, status = 200) {
  response.statusCode = status;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end();
}

function sendError(request, response, error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  if (acceptsHtml(request)) {
    return sendHtml(response, status, pageDocument({
      title: 'Unsubscribe unavailable',
      heading: 'The request could not be completed.',
      body: status >= 500
        ? 'The unsubscribe service is temporarily unavailable. Please try again later.'
        : 'This unsubscribe link is invalid or no longer matches an active consent record.',
    }));
  }
  response.statusCode = status;
  responseHeaders(response, 'application/json; charset=utf-8');
  response.end(JSON.stringify({
    error: status >= 500 ? 'Unsubscribe service unavailable.' : 'Invalid unsubscribe request.',
    code: error?.code || 'WAITLIST_UNSUBSCRIBE_FAILED',
  }));
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

async function serviceRequest({ config, path, method = 'GET', body, prefer, fetchImpl = fetch }) {
  const response = await fetchImpl(`${config.url}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: config.secretKey,
      Authorization: `Bearer ${config.secretKey}`,
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await readJsonSafely(response);
  if (!response.ok) {
    throw new WaitlistUnsubscribeError(
      `Supabase unsubscribe request failed with status ${response.status}.`,
      'UNSUBSCRIBE_DATABASE_REQUEST_FAILED',
      503,
    );
  }
  return payload;
}

async function loadGrant(config, consentIdempotencyKey, fetchImpl) {
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/marketing_consent_events?idempotency_key=eq.${encodeURIComponent(consentIdempotencyKey)}&select=id,idempotency_key,email_normalized,purpose,status,consent_text_version,privacy_notice_version,provider_contact_ref,captured_at&limit=2`,
    fetchImpl,
  });
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new WaitlistUnsubscribeError(
      'Active consent grant was not found.',
      rows?.length > 1 ? 'DUPLICATE_CONSENT_GRANT' : 'CONSENT_GRANT_NOT_FOUND',
      400,
    );
  }
  const grant = rows[0];
  if (
    grant.status !== 'granted'
    || grant.purpose !== WAITLIST_CONSENT_PURPOSE
    || grant.idempotency_key !== consentIdempotencyKey
  ) {
    throw new WaitlistUnsubscribeError('Consent grant is not eligible for withdrawal.', 'INVALID_CONSENT_GRANT', 400);
  }
  return grant;
}

async function loadExistingWithdrawal(config, grantId, fetchImpl) {
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/marketing_consent_events?status=eq.withdrawn&related_grant_id=eq.${encodeURIComponent(grantId)}&select=id,idempotency_key,email_normalized,purpose,status,related_grant_id,withdrawn_at&limit=2`,
    fetchImpl,
  });
  if (!Array.isArray(rows)) {
    throw new WaitlistUnsubscribeError('Withdrawal lookup returned an invalid response.', 'INVALID_WITHDRAWAL_RESPONSE', 503);
  }
  if (rows.length > 1) {
    throw new WaitlistUnsubscribeError('Duplicate withdrawal evidence exists.', 'DUPLICATE_WITHDRAWAL_EVIDENCE', 503);
  }
  return rows[0] || null;
}

async function insertOrLoadWithdrawal({ config, grant, withdrawnAt, fetchImpl }) {
  const record = createConsentEventRecord({
    sourceEventId: `waitlist.unsubscribe:${grant.id}`,
    email: grant.email_normalized,
    purpose: grant.purpose,
    status: 'withdrawn',
    consentTextVersion: grant.consent_text_version,
    privacyNoticeVersion: grant.privacy_notice_version,
    source: 'unsubscribe_link',
    capturedAt: withdrawnAt,
    withdrawnAt,
    withdrawalSource: 'unsubscribe_link',
    relatedGrantId: grant.id,
    providerContactRef: grant.provider_contact_ref,
    evidenceContext: {
      formVersion: WAITLIST_UNSUBSCRIBE_FORM_VERSION,
    },
  });

  const inserted = await serviceRequest({
    config,
    path: '/rest/v1/marketing_consent_events?on_conflict=idempotency_key',
    method: 'POST',
    body: record,
    prefer: 'resolution=ignore-duplicates,return=representation',
    fetchImpl,
  });
  if (Array.isArray(inserted) && inserted.length === 1) return inserted[0];

  const rows = await serviceRequest({
    config,
    path: `/rest/v1/marketing_consent_events?idempotency_key=eq.${encodeURIComponent(record.idempotency_key)}&select=id,idempotency_key,email_normalized,purpose,status,related_grant_id,withdrawn_at&limit=2`,
    fetchImpl,
  });
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new WaitlistUnsubscribeError('Withdrawal evidence could not be recovered.', 'WITHDRAWAL_EVIDENCE_MISSING', 503);
  }
  const existing = rows[0];
  if (
    existing.email_normalized !== grant.email_normalized
    || existing.purpose !== grant.purpose
    || existing.status !== 'withdrawn'
    || existing.related_grant_id !== grant.id
  ) {
    throw new WaitlistUnsubscribeError('Withdrawal evidence conflicts with the consent grant.', 'WITHDRAWAL_EVIDENCE_CONFLICT', 503);
  }
  return existing;
}

async function unsubscribeResendContact({ email, apiKey, fetchImpl = fetch }) {
  const response = await fetchImpl(`${RESEND_API}/contacts/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ unsubscribed: true }),
  });
  if (!response.ok) {
    throw new WaitlistUnsubscribeError(
      `Resend contact update failed with status ${response.status}.`,
      'RESEND_UNSUBSCRIBE_FAILED',
      503,
    );
  }
}

export async function processWaitlistUnsubscribe({
  token,
  environment = process.env,
  fetchImpl = fetch,
  now = new Date(),
}) {
  if (environment.WAITLIST_UNSUBSCRIBE_ENABLED !== 'true') {
    throw new WaitlistUnsubscribeError('Unsubscribe route is disabled.', 'UNSUBSCRIBE_NOT_ENABLED', 404);
  }

  let config;
  try {
    config = readSupabaseServerConfig(environment, { requireSecret: true });
  } catch (error) {
    throw new WaitlistUnsubscribeError(
      `Unsubscribe database configuration is invalid: ${error?.code || 'CONFIGURATION_ERROR'}.`,
      'UNSUBSCRIBE_CONFIGURATION_ERROR',
      503,
    );
  }
  const projectRef = assertWriteTarget(config, environment);
  const apiKey = String(environment.RESEND_API_KEY ?? '').trim();
  if (!apiKey) {
    throw new WaitlistUnsubscribeError('RESEND_API_KEY is missing.', 'UNSUBSCRIBE_CONFIGURATION_ERROR', 503);
  }

  const verified = verifyWaitlistUnsubscribeToken({
    token,
    secret: environment.WAITLIST_UNSUBSCRIBE_SECRET,
  });
  const grant = await loadGrant(config, verified.consentIdempotencyKey, fetchImpl);
  const existingWithdrawal = await loadExistingWithdrawal(config, grant.id, fetchImpl);
  const withdrawnAt = now.toISOString();
  const withdrawal = existingWithdrawal || await insertOrLoadWithdrawal({
    config,
    grant,
    withdrawnAt,
    fetchImpl,
  });

  await unsubscribeResendContact({
    email: grant.email_normalized,
    apiKey,
    fetchImpl,
  });

  return Object.freeze({
    ok: true,
    projectRef,
    alreadyWithdrawn: Boolean(existingWithdrawal),
    withdrawalId: withdrawal.id,
    withdrawnAt: withdrawal.withdrawn_at || withdrawnAt,
  });
}

export async function handleWaitlistUnsubscribe(request, response, options = {}) {
  if (request.method === 'GET') {
    const token = tokenFromRequest(request);
    try {
      const [version, hash, signature, extra] = String(token || '').split('.');
      if (
        extra !== undefined
        || version !== WAITLIST_UNSUBSCRIBE_TOKEN_VERSION
        || !TOKEN_HASH_PATTERN.test(hash || '')
        || !TOKEN_SIGNATURE_PATTERN.test(signature || '')
      ) {
        throw new WaitlistUnsubscribeError('Unsubscribe token is invalid.', 'INVALID_UNSUBSCRIBE_TOKEN', 400);
      }
      return sendHtml(response, 200, pageDocument({
        title: 'Unsubscribe',
        heading: 'Stop book availability emails?',
        body: 'Confirm below to stop future Read the Dollar First purchase-link and availability messages.',
        form: unsubscribeForm(token),
      }));
    } catch (error) {
      return sendError(request, response, error);
    }
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return sendError(
      request,
      response,
      new WaitlistUnsubscribeError('Method not allowed.', 'METHOD_NOT_ALLOWED', 405),
    );
  }

  const contentType = requestHeader(request, 'content-type').toLowerCase();
  if (
    !contentType.includes('application/x-www-form-urlencoded')
    && !contentType.includes('application/json')
  ) {
    return sendError(
      request,
      response,
      new WaitlistUnsubscribeError('Unsupported content type.', 'INVALID_CONTENT_TYPE', 415),
    );
  }
  if (!hasExplicitConfirmation(request)) {
    return sendError(
      request,
      response,
      new WaitlistUnsubscribeError('Explicit unsubscribe confirmation is required.', 'CONFIRMATION_REQUIRED', 400),
    );
  }

  try {
    const result = await processWaitlistUnsubscribe({
      token: tokenFromRequest(request),
      environment: options.environment || process.env,
      fetchImpl: options.fetchImpl || fetch,
      now: options.now || new Date(),
    });
    if (acceptsHtml(request)) {
      return sendHtml(response, 200, pageDocument({
        title: 'Unsubscribed',
        heading: 'You are unsubscribed.',
        body: 'Future Read the Dollar First purchase-link and availability messages have been stopped.',
      }));
    }
    return sendEmpty(response, 200);
  } catch (error) {
    console.error('Waitlist unsubscribe failed.', {
      code: error?.code || 'WAITLIST_UNSUBSCRIBE_FAILED',
    });
    return sendError(request, response, error);
  }
}
