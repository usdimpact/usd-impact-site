import {
  DailyLearningConsentError,
  subscribeDailyLearning,
  verifyDailyLearningUnsubscribeToken,
  withdrawDailyLearning,
} from './daily-card-email-consent.js';
import { runDailyCardEmailBatch } from './daily-card-email-dispatch.js';
import { validCronAuthorization } from './account-deletion-finalizer.js';
import { requestHeader } from './supabase-server.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;

function sendJson(response, status, body, extraHeaders = {}) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);
  response.end(JSON.stringify(body));
}

function requestUrl(request) {
  return new URL(request.url || '/api/waitlist', 'https://usd-impact.invalid');
}

function parseJsonBody(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string' || Buffer.isBuffer(request.body)) return JSON.parse(request.body.toString());
  return {};
}

function parseFormBody(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string' || Buffer.isBuffer(request.body)) {
    return Object.fromEntries(new URLSearchParams(request.body.toString()));
  }
  return {};
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function sendHtml(response, status, { heading, body, form = '' }) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(heading)} | USD Impact</title></head><body style="margin:0;background:#f5f6f8;color:#161a1f;font-family:Arial,Helvetica,sans-serif;"><main style="min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;"><section style="width:min(620px,100%);background:#fff;border:1px solid #e6e9ed;padding:36px;box-sizing:border-box;"><p style="margin:0 0 12px;color:#8a6b32;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">USD Impact Daily Learning</p><h1 style="margin:0 0 18px;color:#071a33;font-size:32px;line-height:1.2;">${escapeHtml(heading)}</h1><p style="margin:0 0 24px;color:#5a6472;font-size:17px;line-height:1.65;">${escapeHtml(body)}</p>${form}</section></main></body></html>`);
}

function tokenFromRequest(request) {
  const urlToken = requestUrl(request).searchParams.get('token');
  if (urlToken) return urlToken;
  const body = parseFormBody(request);
  return String(body.token || '').trim();
}

function explicitOneClick(request) {
  const body = parseFormBody(request);
  return body['List-Unsubscribe'] === 'One-Click' || body.confirm === true || body.confirm === 'true';
}

function consentErrorResponse(response, error) {
  const status = Number.isInteger(error?.status) ? error.status : 503;
  return sendJson(response, status, {
    error: status >= 500 ? 'Daily Learning email service is temporarily unavailable.' : error.message,
    code: error?.code || 'DAILY_LEARNING_CONSENT_FAILED',
  });
}

async function handleSubscribe(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
  if (requestHeader(request, 'sec-fetch-site') === 'cross-site') {
    return sendJson(response, 403, { error: 'Cross-site requests are not allowed.', code: 'CROSS_SITE_REQUEST' });
  }
  if (!requestHeader(request, 'content-type').includes('application/json')) {
    return sendJson(response, 415, { error: 'Content type must be application/json.', code: 'INVALID_CONTENT_TYPE' });
  }

  let payload;
  try {
    payload = parseJsonBody(request);
  } catch {
    return sendJson(response, 400, { error: 'Invalid request body.', code: 'INVALID_REQUEST_BODY' });
  }
  const company = String(payload.company || '').trim();
  if (company) return sendJson(response, 200, { ok: true });

  const email = normalizeEmail(payload.email);
  if (!email || email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    return sendJson(response, 400, { error: 'Enter a valid email address.', code: 'INVALID_EMAIL' });
  }
  if (payload.consent !== true) {
    return sendJson(response, 400, { error: 'Consent is required for Daily Learning email.', code: 'CONSENT_REQUIRED' });
  }

  try {
    const result = await subscribeDailyLearning({
      email,
      submissionId: payload.submissionId,
    });
    return sendJson(response, result.created ? 201 : 200, {
      ok: true,
      status: 'subscribed',
      alreadySubscribed: !result.created,
    });
  } catch (error) {
    return consentErrorResponse(response, error);
  }
}

async function handleUnsubscribe(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET, POST' });
  }
  const token = tokenFromRequest(request);

  if (request.method === 'GET') {
    try {
      verifyDailyLearningUnsubscribeToken({ token, secret: process.env.WAITLIST_UNSUBSCRIBE_SECRET });
    } catch (error) {
      return sendHtml(response, Number.isInteger(error?.status) ? error.status : 400, {
        heading: 'Unsubscribe link unavailable',
        body: 'This Daily Learning unsubscribe link is invalid or no longer usable.',
      });
    }
    const action = `/learn/email/unsubscribe?token=${encodeURIComponent(token)}`;
    return sendHtml(response, 200, {
      heading: 'Stop Daily Learning email?',
      body: 'This affects only the Daily Learning email series. Required account, purchase, privacy, security, and support messages remain separate.',
      form: `<form method="post" action="${escapeHtml(action)}"><input type="hidden" name="List-Unsubscribe" value="One-Click"><button type="submit" style="border:0;background:#071a33;color:#fff;font-size:16px;font-weight:700;padding:14px 22px;cursor:pointer;">Confirm unsubscribe</button></form>`,
    });
  }

  if (!explicitOneClick(request)) {
    return sendJson(response, 400, { error: 'Explicit unsubscribe confirmation is required.', code: 'UNSUBSCRIBE_CONFIRMATION_REQUIRED' });
  }
  try {
    await withdrawDailyLearning({ token });
    if (requestHeader(request, 'accept').toLowerCase().includes('text/html')) {
      return sendHtml(response, 200, {
        heading: 'Daily Learning email stopped',
        body: 'Your Daily Learning email consent has been withdrawn. Other requested or required USD Impact communications are unaffected.',
      });
    }
    response.statusCode = 200;
    response.setHeader('Cache-Control', 'no-store');
    response.end();
  } catch (error) {
    if (error instanceof DailyLearningConsentError) return consentErrorResponse(response, error);
    return consentErrorResponse(response, error);
  }
}

async function handleDispatch(request, response) {
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET' });
  if (!validCronAuthorization(request)) {
    return sendJson(response, 401, { error: 'Scheduler authorization is required.', code: 'SCHEDULER_AUTHORIZATION_REQUIRED' });
  }
  const publishDate = requestUrl(request).searchParams.get('date') || new Date().toISOString().slice(0, 10);
  try {
    const result = await runDailyCardEmailBatch({ publishDate });
    return sendJson(response, result.failed > 0 ? 503 : 200, { ok: result.failed === 0, ...result });
  } catch (error) {
    console.error('Daily Card email dispatch failed.', { code: error?.code || 'DAILY_CARD_EMAIL_DISPATCH_FAILED' });
    return sendJson(response, 503, {
      error: 'Daily Card email dispatch is temporarily unavailable.',
      code: error?.code || 'DAILY_CARD_EMAIL_DISPATCH_FAILED',
    });
  }
}

export async function handleDailyLearningEmailRequest(request, response, action) {
  if (action === 'daily-learning') return handleSubscribe(request, response);
  if (action === 'daily-learning-unsubscribe') return handleUnsubscribe(request, response);
  if (action === 'daily-learning-dispatch') return handleDispatch(request, response);
  return sendJson(response, 404, { error: 'Daily Learning action not found.', code: 'DAILY_LEARNING_ACTION_NOT_FOUND' });
}
