import { createHash, timingSafeEqual } from 'node:crypto';
import {
  dispatchPrivacyExportAcknowledgementEmail,
  enqueuePrivacyExportAcknowledgementEmail,
} from './privacy-export-email.js';
import {
  dispatchSupportCaseReceivedEmail,
  enqueueSupportCaseReceivedEmail,
} from './support-case-email.js';

const RESEND_API = 'https://api.resend.com';
const PROOF_TOKEN_SHA256 = '6366861ffa58b5177b79fb466b446bae56d3b750e01f491cceb162c34db11837';
const PROOF_EXPIRES_AT = Date.parse('2026-08-21T02:30:00.000Z');
const FIXTURE_OCCURRED_AT = '2026-08-20T22:05:00.000Z';
const FIXTURE_EMAIL_CONFIRMED_AT = '2026-08-01T12:00:00.000Z';

const PRIVACY_ACCOUNT_ID = 'bcd29e7d-8ae7-4fd0-bfe3-73ecc8f8c93e';
const PRIVACY_EMAIL = 'delivered+issue130-privacy-export-20260820@resend.dev';

const SUPPORT_ACCOUNT_ID = 'e92768cb-9394-4fc9-a27f-fa31c6fa7cab';
const SUPPORT_REQUEST_ID = '0ed7ec0a-b04c-49c7-a01c-21490d1307a0';
const SUPPORT_EMAIL = 'delivered+issue130-support-case-20260820@resend.dev';

const KINDS = new Set(['privacy-export', 'support-case']);

function sendProofJson(response, status, body, extraHeaders = {}) {
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
  const supplied = Buffer.from(createHash('sha256').update(value).digest('hex'), 'utf8');
  const expected = Buffer.from(PROOF_TOKEN_SHA256, 'utf8');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function boundedErrorCode(error) {
  const code = String(error?.code || 'CONTROLLED_PROOF_FAILED')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .slice(0, 80);
  return /^[A-Z][A-Z0-9_]{1,79}$/.test(code) ? code : 'CONTROLLED_PROOF_FAILED';
}

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function controlledEnvironment() {
  return {
    ...process.env,
    VERCEL_ENV: 'preview',
    EMAIL_READINESS_LEDGER_ENABLED: 'true',
    LAUNCH_EMAIL_DISPATCH_ENABLED: 'true',
    EMAIL_READINESS_PRODUCTION_APPROVED: 'false',
    LAUNCH_EMAIL_PRODUCTION_APPROVED: 'false',
  };
}

function privacyFixture() {
  return Object.freeze({
    exportResult: Object.freeze({
      generatedAt: FIXTURE_OCCURRED_AT,
      accountId: PRIVACY_ACCOUNT_ID,
      data: Object.freeze({ fixture: 'controlled-development-proof' }),
    }),
    verifiedUser: Object.freeze({
      id: PRIVACY_ACCOUNT_ID,
      email: PRIVACY_EMAIL,
      emailConfirmedAt: FIXTURE_EMAIL_CONFIRMED_AT,
    }),
  });
}

function supportFixture() {
  return Object.freeze({
    user: Object.freeze({
      id: SUPPORT_ACCOUNT_ID,
      email: SUPPORT_EMAIL,
      emailConfirmedAt: FIXTURE_EMAIL_CONFIRMED_AT,
    }),
    request: Object.freeze({
      id: SUPPORT_REQUEST_ID,
      account_id: SUPPORT_ACCOUNT_ID,
      email: SUPPORT_EMAIL,
      category: 'access',
      status: 'open',
      created_at: FIXTURE_OCCURRED_AT,
      updated_at: FIXTURE_OCCURRED_AT,
    }),
  });
}

function resendAdapter() {
  return Object.freeze({
    id: 'resend',
    async send(message) {
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.RESEND_FROM_EMAIL;
      const replyTo = process.env.RESEND_REPLY_TO;
      if (!apiKey || !from) {
        const error = new Error('Controlled Resend configuration is incomplete.');
        error.code = 'CONTROLLED_RESEND_CONFIGURATION_ERROR';
        error.providerState = 'failed';
        throw error;
      }

      const providerResponse = await fetch(`${RESEND_API}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': message.idempotencyKey,
        },
        body: JSON.stringify({
          from,
          to: message.to,
          ...(replyTo ? { reply_to: replyTo } : {}),
          subject: message.subject,
          text: message.text,
          html: message.html,
          ...(message.headers ? { headers: message.headers } : {}),
        }),
      });
      const providerPayload = await readJsonSafely(providerResponse);
      if (!providerResponse.ok) {
        const error = new Error(`Controlled Resend request failed with status ${providerResponse.status}.`);
        error.code = `RESEND_HTTP_${providerResponse.status}`;
        error.providerState = providerResponse.status >= 500 ? 'failed' : 'accepted_ambiguous';
        throw error;
      }
      if (typeof providerPayload?.id !== 'string' || !providerPayload.id) {
        const error = new Error('Controlled Resend response did not include a message identifier.');
        error.code = 'RESEND_MESSAGE_ID_MISSING';
        error.providerState = 'accepted_ambiguous';
        throw error;
      }
      return Object.freeze({
        state: 'accepted',
        messageRef: providerPayload.id,
        occurredAt: new Date().toISOString(),
      });
    },
  });
}

async function runPrivacyProof(environment) {
  const fixture = privacyFixture();
  const state = await enqueuePrivacyExportAcknowledgementEmail({
    exportResult: fixture.exportResult,
    verifiedUser: fixture.verifiedUser,
    environment,
  });
  const result = await dispatchPrivacyExportAcknowledgementEmail({
    state,
    providerAdapter: resendAdapter(),
    environment,
    nowMs: Date.now(),
  });
  return { state, result };
}

async function runSupportProof(environment) {
  const supportResult = supportFixture();
  const state = await enqueueSupportCaseReceivedEmail({
    supportResult,
    environment,
  });
  const result = await dispatchSupportCaseReceivedEmail({
    state,
    providerAdapter: resendAdapter(),
    environment,
    nowMs: Date.now(),
  });
  return { state, result };
}

function publicResult(kind, state, result) {
  return {
    ok: true,
    environment: 'development',
    kind,
    action: result.action,
    customerReference: state.intent?.customerReference || null,
    outbox: {
      id: result.outbox?.id || state.outbox?.id || null,
      status: result.outbox?.status || state.outbox?.status || null,
      attemptCount: result.outbox?.attempt_count ?? state.outbox?.attempt_count ?? null,
      providerCorrelated: Boolean(
        result.outbox?.provider_message_ref || state.outbox?.provider_message_ref,
      ),
    },
    providerMessageRef: result.providerMessageRef || result.outbox?.provider_message_ref || null,
    expiresAt: new Date(PROOF_EXPIRES_AT).toISOString(),
  };
}

export function controlledLifecycleProofRequested(request) {
  const url = requestUrl(request);
  return url.searchParams.has('proof') || url.searchParams.has('kind');
}

export async function handleControlledLifecycleEmailProof(request, response) {
  if (request.method !== 'GET') {
    return sendProofJson(
      response,
      405,
      { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' },
      { Allow: 'GET' },
    );
  }
  if (String(process.env.VERCEL_ENV || '').toLowerCase() === 'production') {
    return sendProofJson(response, 404, { error: 'Not found.', code: 'NOT_FOUND' });
  }
  if (Date.now() > PROOF_EXPIRES_AT) {
    return sendProofJson(response, 410, {
      error: 'Controlled proof expired.',
      code: 'CONTROLLED_PROOF_EXPIRED',
    });
  }

  const url = requestUrl(request);
  const keys = [...new Set(url.searchParams.keys())].sort();
  const kind = url.searchParams.get('kind');
  if (
    keys.length !== 3
    || keys[0] !== 'action'
    || keys[1] !== 'kind'
    || keys[2] !== 'proof'
    || url.searchParams.get('action') !== 'commerce-readiness'
    || !KINDS.has(kind)
    || !validProofToken(url.searchParams.get('proof'))
  ) {
    return sendProofJson(response, 404, { error: 'Not found.', code: 'NOT_FOUND' });
  }

  try {
    const environment = controlledEnvironment();
    const { state, result } = kind === 'privacy-export'
      ? await runPrivacyProof(environment)
      : await runSupportProof(environment);
    return sendProofJson(response, 200, publicResult(kind, state, result));
  } catch (error) {
    const code = boundedErrorCode(error);
    console.error('Controlled lifecycle email proof failed.', { kind, code });
    return sendProofJson(response, 500, {
      ok: false,
      error: 'Controlled Development proof failed.',
      code,
    });
  }
}
