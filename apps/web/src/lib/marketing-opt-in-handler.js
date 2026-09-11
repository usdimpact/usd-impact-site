import { normalizeEmail } from './email-readiness-contracts.js';
import {
  MarketingOptInReadinessError,
  confirmMarketingOptIn,
  prepareMarketingOptInRequest,
} from './marketing-opt-in-readiness.js';
import { MARKETING_OPT_IN_PURPOSES } from './marketing-opt-in-token.js';
import {
  getVerifiedSupabaseUser,
  readBearerToken,
  requestHeader,
} from './supabase-server.js';

const EMAIL_MAX_LENGTH = 254;
const PURPOSE_SET = new Set(MARKETING_OPT_IN_PURPOSES);

function sendJson(response, status, body, extraHeaders = {}) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);
  response.end(JSON.stringify(body));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function sendHtml(response, status, { heading, body }) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
  );
  response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(heading)} | USD Impact</title></head><body style="margin:0;background:#f5f6f8;color:#161a1f;font-family:Arial,Helvetica,sans-serif;"><main style="min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;"><section style="width:min(620px,100%);background:#fff;border:1px solid #e6e9ed;padding:36px;box-sizing:border-box;"><p style="margin:0 0 12px;color:#8a6b32;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">USD Impact</p><h1 style="margin:0 0 18px;color:#071a33;font-size:32px;line-height:1.2;">${escapeHtml(heading)}</h1><p style="margin:0;color:#5a6472;font-size:17px;line-height:1.65;">${escapeHtml(body)}</p></section></main></body></html>`);
}

function parseJsonBody(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string' || Buffer.isBuffer(request.body)) return JSON.parse(request.body.toString());
  throw new TypeError('Request body is missing.');
}

function parseFormBody(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string' || Buffer.isBuffer(request.body)) {
    return Object.fromEntries(new URLSearchParams(request.body.toString()));
  }
  return {};
}

function normalizeRequestEmail(value) {
  const email = normalizeEmail(value);
  if (email.length > EMAIL_MAX_LENGTH) throw new TypeError('Email address is too long.');
  return email;
}

function optInErrorResponse(request, response, error) {
  const status = Number.isInteger(error?.status) ? error.status : 503;
  const code = error?.code || 'MARKETING_OPT_IN_FAILED';
  const acceptsHtml = requestHeader(request, 'accept').toLowerCase().includes('text/html');
  const safeMessage = status >= 500
    ? 'Email preferences are temporarily unavailable.'
    : 'This email preference request could not be completed.';

  if (acceptsHtml) {
    return sendHtml(response, status, {
      heading: status >= 500 ? 'Email preferences unavailable' : 'Confirmation unavailable',
      body: safeMessage,
    });
  }
  return sendJson(response, status, { error: safeMessage, code });
}

function ensureSameSite(request, response) {
  if (requestHeader(request, 'sec-fetch-site') === 'cross-site') {
    sendJson(response, 403, {
      error: 'Cross-site requests are not allowed.',
      code: 'CROSS_SITE_REQUEST',
    });
    return false;
  }
  return true;
}

export async function handleMarketingOptInRequest(
  request,
  response,
  {
    prepare = prepareMarketingOptInRequest,
    getVerifiedUser = getVerifiedSupabaseUser,
    environment = process.env,
  } = {},
) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
  }
  if (environment.EMAIL_OPT_IN_REQUEST_ENABLED !== 'true') {
    return sendJson(response, 404, { error: 'Email subscription requests are not enabled.', code: 'OPT_IN_REQUEST_DISABLED' });
  }
  if (!ensureSameSite(request, response)) return undefined;
  if (!requestHeader(request, 'content-type').includes('application/json')) {
    return sendJson(response, 415, { error: 'Content type must be application/json.', code: 'INVALID_CONTENT_TYPE' });
  }

  let payload;
  try {
    payload = parseJsonBody(request);
  } catch {
    return sendJson(response, 400, { error: 'Invalid request body.', code: 'INVALID_REQUEST_BODY' });
  }

  // Honeypot requests receive a neutral response and do not reach Auth or the ledger.
  if (String(payload.company ?? '').trim()) {
    return sendJson(response, 202, { ok: true, status: 'check_email' });
  }
  if (payload.consent !== true) {
    return sendJson(response, 400, { error: 'Explicit consent is required.', code: 'CONSENT_REQUIRED' });
  }

  const purpose = String(payload.purpose ?? '').trim().toLowerCase();
  if (!PURPOSE_SET.has(purpose)) {
    return sendJson(response, 400, { error: 'Email preference is not supported.', code: 'INVALID_OPT_IN_PURPOSE' });
  }
  if ((payload.locale ?? 'en') !== 'en') {
    return sendJson(response, 400, { error: 'This email language is not enabled yet.', code: 'UNAPPROVED_OPT_IN_LOCALE' });
  }

  let email;
  try {
    email = normalizeRequestEmail(payload.email);
  } catch {
    return sendJson(response, 400, { error: 'Enter a valid email address.', code: 'INVALID_EMAIL' });
  }

  let userId = null;
  if (purpose === 'learning_progress_updates') {
    const accessToken = readBearerToken(request);
    if (!accessToken) {
      return sendJson(response, 401, {
        error: 'A verified account is required for learning progress updates.',
        code: 'VERIFIED_ACCOUNT_REQUIRED',
      });
    }
    try {
      const user = await getVerifiedUser(accessToken, { environment });
      if (user.email !== email) {
        return sendJson(response, 403, {
          error: 'The subscription address must match the verified account.',
          code: 'ACCOUNT_EMAIL_MISMATCH',
        });
      }
      userId = user.id;
    } catch (error) {
      return optInErrorResponse(request, response, error);
    }
  }

  try {
    await prepare({
      email,
      requestId: payload.requestId,
      purpose,
      userId,
      locale: 'en',
      environment,
    });
    // Deliberately neutral: do not reveal whether an address was already subscribed.
    return sendJson(response, 202, { ok: true, status: 'check_email' });
  } catch (error) {
    if (error instanceof MarketingOptInReadinessError || Number.isInteger(error?.status)) {
      return optInErrorResponse(request, response, error);
    }
    console.error('Email opt-in request failed.', { code: error?.code || 'MARKETING_OPT_IN_FAILED' });
    return optInErrorResponse(request, response, error);
  }
}

function explicitConfirmation(body) {
  return body.confirm === true
    || body.confirm === 'true'
    || body['Email-Opt-In'] === 'Confirm';
}

export async function handleMarketingOptInConfirmation(
  request,
  response,
  {
    confirm = confirmMarketingOptIn,
    environment = process.env,
  } = {},
) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
  }
  if (!ensureSameSite(request, response)) return undefined;

  const contentType = requestHeader(request, 'content-type').toLowerCase();
  let body;
  try {
    if (contentType.includes('application/json')) body = parseJsonBody(request);
    else if (contentType.includes('application/x-www-form-urlencoded')) body = parseFormBody(request);
    else {
      return sendJson(response, 415, { error: 'Unsupported content type.', code: 'INVALID_CONTENT_TYPE' });
    }
  } catch {
    return sendJson(response, 400, { error: 'Invalid request body.', code: 'INVALID_REQUEST_BODY' });
  }

  if (!explicitConfirmation(body)) {
    return sendJson(response, 400, {
      error: 'Explicit subscription confirmation is required.',
      code: 'OPT_IN_CONFIRMATION_REQUIRED',
    });
  }

  const token = String(body.token ?? '').trim();
  if (!token) {
    return sendJson(response, 400, { error: 'Confirmation token is required.', code: 'INVALID_OPT_IN_TOKEN' });
  }

  try {
    await confirm({ token, environment });
    if (requestHeader(request, 'accept').toLowerCase().includes('text/html')) {
      return sendHtml(response, 200, {
        heading: 'Email preference confirmed',
        body: 'Your requested USD Impact email preference is now active. You can change it again from the applicable preference or unsubscribe control.',
      });
    }
    return sendJson(response, 200, { ok: true, status: 'confirmed' });
  } catch (error) {
    if (error instanceof MarketingOptInReadinessError || Number.isInteger(error?.status)) {
      return optInErrorResponse(request, response, error);
    }
    console.error('Email opt-in confirmation failed.', { code: error?.code || 'MARKETING_OPT_IN_FAILED' });
    return optInErrorResponse(request, response, error);
  }
}
