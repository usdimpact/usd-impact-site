import { handleResendWebhook } from '../src/lib/resend-webhook-handler.js';
import { handleDailyLearningEmailRequest } from '../src/lib/daily-card-email-handler.js';
import { requestOrigin } from '../src/lib/supabase-auth.js';
import { buildWaitlistConfirmationEmail } from '../src/lib/waitlist-email-template.js';
import {
  markWaitlistOutboxAccepted,
  markWaitlistOutboxRetry,
  markWaitlistOutboxSending,
  prepareWaitlistReadiness,
} from '../src/lib/waitlist-readiness.js';
import {
  createWaitlistUnsubscribeUrl,
  handleWaitlistUnsubscribe,
  verifyWaitlistUnsubscribeToken,
} from '../src/lib/waitlist-unsubscribe.js';

const RESEND_API = 'https://api.resend.com';
const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requestHeader(request, name) {
  const headers = request.headers ?? {};
  if (typeof headers.get === 'function') return headers.get(name) ?? '';

  const value = headers[name.toLowerCase()] ?? headers[name];
  return Array.isArray(value) ? value[0] ?? '' : String(value ?? '');
}

function sendJson(response, body, status = 200, extraHeaders = {}) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');

  for (const [name, value] of Object.entries(extraHeaders)) {
    response.setHeader(name, value);
  }

  response.end(JSON.stringify(body));
}

function sendUnsubscribeGuardError(request, response, { status, code }) {
  const acceptsHtml = requestHeader(request, 'accept').toLowerCase().includes('text/html');
  if (!acceptsHtml) {
    return sendJson(response, {
      error: status >= 500 ? 'Unsubscribe service unavailable.' : 'Invalid unsubscribe request.',
      code,
    }, status);
  }

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
  response.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Unsubscribe unavailable | USD Impact</title>
</head>
<body style="margin:0;background:#f5f6f8;color:#161a1f;font-family:Arial,Helvetica,sans-serif;">
  <main style="min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;">
    <section style="width:min(620px,100%);background:#ffffff;border:1px solid #e6e9ed;padding:36px;box-sizing:border-box;">
      <p style="margin:0 0 12px;color:#8a6b32;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">USD Impact</p>
      <h1 style="margin:0 0 18px;color:#071a33;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.15;">The request could not be completed.</h1>
      <p style="margin:0;color:#5a6472;font-size:17px;line-height:1.65;">${status >= 500
        ? 'The unsubscribe service is temporarily unavailable. Please try again later.'
        : 'This unsubscribe link is invalid, disabled, or no longer available.'}</p>
    </section>
  </main>
</body>
</html>`);
}

function requestBody(request) {
  const body = request.body;

  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
    return body;
  }

  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    return JSON.parse(body.toString());
  }

  throw new TypeError('Request body is missing or invalid.');
}

async function resendRequest(path, apiKey, options = {}) {
  return fetch(`${RESEND_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function requestAction(request) {
  try {
    const url = new URL(request.url || '/api/waitlist', 'https://usd-impact.invalid');
    return url.searchParams.get('action')?.trim().toLowerCase() || '';
  } catch {
    return '';
  }
}

function unsubscribeTokenFromRequest(request) {
  try {
    return new URL(request.url || '/unsubscribe', 'https://usd-impact.invalid')
      .searchParams.get('token') || '';
  } catch {
    return '';
  }
}

function handleUnsubscribeAction(request, response) {
  if (request.method === 'GET') {
    if (process.env.WAITLIST_UNSUBSCRIBE_ENABLED !== 'true') {
      return sendUnsubscribeGuardError(request, response, {
        status: 404,
        code: 'UNSUBSCRIBE_NOT_ENABLED',
      });
    }
    try {
      verifyWaitlistUnsubscribeToken({
        token: unsubscribeTokenFromRequest(request),
        secret: process.env.WAITLIST_UNSUBSCRIBE_SECRET,
      });
    } catch (error) {
      return sendUnsubscribeGuardError(request, response, {
        status: Number.isInteger(error?.status) ? error.status : 400,
        code: error?.code || 'INVALID_UNSUBSCRIBE_TOKEN',
      });
    }
  }
  return handleWaitlistUnsubscribe(request, response);
}

function createConfirmationEmail({ request, readinessState, email, submissionId }) {
  if (
    !readinessState.enabled
    || process.env.WAITLIST_UNSUBSCRIBE_ENABLED !== 'true'
  ) {
    return buildWaitlistConfirmationEmail();
  }

  const unsubscribeUrl = createWaitlistUnsubscribeUrl({
    email,
    submissionId,
    secret: process.env.WAITLIST_UNSUBSCRIBE_SECRET,
    baseUrl: requestOrigin(request),
  });
  return buildWaitlistConfirmationEmail({ unsubscribeUrl });
}

async function scheduleReadinessRetry(state, errorCode) {
  if (!state?.enabled) return;
  try {
    await markWaitlistOutboxRetry({ state, errorCode });
  } catch {
    console.error('Waitlist readiness retry state could not be recorded.');
  }
}

export default async function handler(request, response) {
  const action = requestAction(request);
  if (action === 'resend-webhook') {
    return handleResendWebhook(request, response);
  }
  if (action === 'unsubscribe') {
    return handleUnsubscribeAction(request, response);
  }
  if (action.startsWith('daily-learning')) {
    return handleDailyLearningEmailRequest(request, response, action);
  }

  if (request.method !== 'POST') {
    return sendJson(response, { error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  }

  if (requestHeader(request, 'sec-fetch-site') === 'cross-site') {
    return sendJson(response, { error: 'Cross-site submissions are not allowed.' }, 403);
  }

  const contentType = requestHeader(request, 'content-type');
  if (!contentType.includes('application/json')) {
    return sendJson(response, { error: 'Content type must be application/json.' }, 415);
  }

  let payload;
  try {
    payload = requestBody(request);
  } catch {
    return sendJson(response, { error: 'Invalid request body.' }, 400);
  }

  const email = normalizeEmail(payload.email);
  const consent = payload.consent === true;
  const company = String(payload.company ?? '').trim();
  const submissionId = String(payload.submissionId ?? '').trim();

  // Honeypot submissions receive a neutral success response and never reach a provider or ledger.
  if (company) {
    return sendJson(response, { ok: true });
  }

  if (!email || email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    return sendJson(response, { error: 'Enter a valid email address.' }, 400);
  }

  if (!consent) {
    return sendJson(response, { error: 'Consent is required to join the waitlist.' }, 400);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const segmentId = process.env.RESEND_WAITLIST_SEGMENT_ID;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const replyTo = process.env.RESEND_REPLY_TO;

  if (!apiKey || !segmentId || !fromEmail) {
    console.error('Waitlist configuration is incomplete.');
    return sendJson(response, { error: 'The waitlist is temporarily unavailable. Please try again later.' }, 503);
  }

  let readinessState;
  try {
    readinessState = await prepareWaitlistReadiness({ email, submissionId });
  } catch (error) {
    console.error('Waitlist readiness preparation failed.', {
      code: error?.code || 'WAITLIST_READINESS_FAILED',
    });
    return sendJson(response, { error: 'The waitlist is temporarily unavailable. Please try again later.' }, 503);
  }

  if (readinessState.enabled && readinessState.decision?.action !== 'send') {
    if (readinessState.decision?.action === 'complete') {
      return sendJson(response, { ok: true });
    }
    console.error('Waitlist confirmation is not safe to send automatically.', {
      action: readinessState.decision?.action || 'reconcile',
      reason: readinessState.decision?.reason || 'unknown',
    });
    return sendJson(response, {
      error: 'Your address was saved, but the confirmation email status is still being reconciled. Please try again later.',
    }, 503);
  }

  let confirmationEmail;
  try {
    confirmationEmail = createConfirmationEmail({
      request,
      readinessState,
      email,
      submissionId,
    });
  } catch (error) {
    console.error('Waitlist unsubscribe delivery configuration is invalid.', {
      code: error?.code || 'UNSUBSCRIBE_CONFIGURATION_ERROR',
    });
    return sendJson(response, { error: 'The waitlist is temporarily unavailable. Please try again later.' }, 503);
  }

  let contactResponse;
  try {
    contactResponse = await resendRequest('/contacts', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        email,
        unsubscribed: false,
        segments: [{ id: segmentId }],
      }),
    });
  } catch (error) {
    console.error(`Waitlist contact request failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    return sendJson(response, { error: 'The waitlist is temporarily unavailable. Please try again later.' }, 502);
  }

  if (contactResponse.status === 409) {
    let segmentResponse;
    try {
      segmentResponse = await resendRequest(
        `/contacts/${encodeURIComponent(email)}/segments/${encodeURIComponent(segmentId)}`,
        apiKey,
        { method: 'POST' },
      );
    } catch (error) {
      console.error(`Waitlist segment request failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      return sendJson(response, { error: 'The waitlist is temporarily unavailable. Please try again later.' }, 502);
    }

    if (!segmentResponse.ok && segmentResponse.status !== 409) {
      console.error(`Waitlist segment assignment failed with status ${segmentResponse.status}.`);
      return sendJson(response, { error: 'The waitlist is temporarily unavailable. Please try again later.' }, 502);
    }
  } else if (!contactResponse.ok) {
    console.error(`Waitlist contact creation failed with status ${contactResponse.status}.`);
    return sendJson(response, { error: 'The waitlist is temporarily unavailable. Please try again later.' }, 502);
  }

  if (readinessState.enabled) {
    try {
      await markWaitlistOutboxSending({ state: readinessState });
    } catch (error) {
      console.error('Waitlist outbox could not enter sending state.', {
        code: error?.code || 'WAITLIST_OUTBOX_UPDATE_FAILED',
      });
      return sendJson(response, { error: 'Your address was saved, but the confirmation email could not be sent. Please try again later.' }, 503);
    }
  }

  let confirmationResponse;
  try {
    confirmationResponse = await resendRequest('/emails', apiKey, {
      method: 'POST',
      headers: readinessState.enabled
        ? { 'Idempotency-Key': readinessState.providerIdempotencyKey }
        : {},
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: confirmationEmail.subject,
        text: confirmationEmail.text,
        html: confirmationEmail.html,
        ...(confirmationEmail.headers ? { headers: confirmationEmail.headers } : {}),
      }),
    });
  } catch (error) {
    console.error(`Waitlist confirmation request failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    await scheduleReadinessRetry(readinessState, 'RESEND_NETWORK_ERROR');
    return sendJson(response, { error: 'Your address was saved, but the confirmation email could not be sent. Please try again later.' }, 502);
  }

  const confirmationPayload = await readJsonSafely(confirmationResponse);
  if (!confirmationResponse.ok) {
    console.error(`Waitlist confirmation email failed with status ${confirmationResponse.status}.`);
    await scheduleReadinessRetry(
      readinessState,
      confirmationResponse.status === 409 ? 'RESEND_IDEMPOTENCY_CONFLICT' : 'RESEND_SEND_FAILED',
    );
    return sendJson(response, { error: 'Your address was saved, but the confirmation email could not be sent. Please try again later.' }, 502);
  }

  if (readinessState.enabled) {
    try {
      await markWaitlistOutboxAccepted({
        state: readinessState,
        providerMessageRef: confirmationPayload?.id,
      });
    } catch (error) {
      console.error('Waitlist confirmation provider state could not be persisted.', {
        code: error?.code || 'WAITLIST_OUTBOX_ACCEPT_FAILED',
      });
      await scheduleReadinessRetry(readinessState, 'OUTBOX_ACCEPT_FAILED');
      return sendJson(response, { error: 'Your address was saved, but the confirmation email could not be confirmed. Please try again later.' }, 502);
    }
  }

  return sendJson(response, { ok: true });
}
