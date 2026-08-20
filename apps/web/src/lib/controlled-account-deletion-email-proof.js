import { createHash, timingSafeEqual } from 'node:crypto';
import {
  dispatchAccountDeletionRequestedEmail,
  enqueueAccountDeletionRequestedEmail,
} from './account-deletion-email.js';

const RESEND_API = 'https://api.resend.com';
const PROOF_TOKEN_SHA256 = '4790935393112139d697b98301c652a852224e22b1f29b225e0ed8946739acdc';
const PROOF_EXPIRES_AT = Date.parse('2026-08-20T20:30:00.000Z');
const FIXTURE_ACCOUNT_ID = '7b14a3d1-00f7-4f4e-8a31-b5884af7e65f';
const FIXTURE_EMAIL = 'delivered+issue130-account-deletion-20260820@resend.dev';
const FIXTURE_OCCURRED_AT = '2026-08-20T18:40:00.000Z';
const FIXTURE_DUE_AT = '2026-08-27T18:40:00.000Z';

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

function deletionResultFixture() {
  return Object.freeze({
    user: Object.freeze({ id: FIXTURE_ACCOUNT_ID, email: FIXTURE_EMAIL }),
    profile: Object.freeze({
      account_id: FIXTURE_ACCOUNT_ID,
      email: FIXTURE_EMAIL,
      status: 'deletion_pending',
      deletion_requested_at: FIXTURE_OCCURRED_AT,
      deletion_due_at: FIXTURE_DUE_AT,
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

export async function handleControlledAccountDeletionEmailProof(request, response) {
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
  if (
    keys.length !== 2
    || keys[0] !== 'action'
    || keys[1] !== 'proof'
    || url.searchParams.get('action') !== 'controlled-email-proof'
    || !validProofToken(url.searchParams.get('proof'))
  ) {
    return sendProofJson(response, 404, { error: 'Not found.', code: 'NOT_FOUND' });
  }

  try {
    const environment = controlledEnvironment();
    const state = await enqueueAccountDeletionRequestedEmail({
      deletionResult: deletionResultFixture(),
      environment,
    });
    const result = await dispatchAccountDeletionRequestedEmail({
      state,
      providerAdapter: resendAdapter(),
      environment,
      nowMs: Date.now(),
    });
    return sendProofJson(response, 200, {
      ok: true,
      environment: 'development',
      action: result.action,
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
    });
  } catch (error) {
    const code = boundedErrorCode(error);
    console.error('Controlled account-deletion email proof failed.', { code });
    return sendProofJson(response, 500, {
      ok: false,
      error: 'Controlled Development proof failed.',
      code,
    });
  }
}
