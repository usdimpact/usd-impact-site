import assert from 'node:assert/strict';
import handler from '../api/waitlist.js';
import {
  WAITLIST_CONSENT_PURPOSE,
  WAITLIST_DEVELOPMENT_PROJECT_REF,
  createWaitlistReadinessRecords,
} from '../src/lib/waitlist-readiness.js';
import { verifyWaitlistUnsubscribeToken } from '../src/lib/waitlist-unsubscribe.js';

const originalFetch = globalThis.fetch;
const managedEnvironmentKeys = [
  'RESEND_API_KEY',
  'RESEND_WAITLIST_SEGMENT_ID',
  'RESEND_FROM_EMAIL',
  'RESEND_REPLY_TO',
  'EMAIL_READINESS_LEDGER_ENABLED',
  'EMAIL_READINESS_PRODUCTION_APPROVED',
  'WAITLIST_UNSUBSCRIBE_ENABLED',
  'WAITLIST_UNSUBSCRIBE_SECRET',
  'WAITLIST_UNSUBSCRIBE_PRODUCTION_APPROVED',
  'VERCEL_ENV',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
];
const originalEnvironment = Object.fromEntries(
  managedEnvironmentKeys.map((key) => [key, process.env[key]]),
);

const email = 'reader@example.com';
const submissionId = '123e4567-e89b-42d3-a456-426614174000';
const capturedAt = '2026-08-20T12:00:00.000Z';
const unsubscribeSecret = `wus_${Buffer.from('0123456789abcdef0123456789abcdef').toString('base64url')}`;
const previewHost = 'usd-impact-site-email-qa-usd-impact.vercel.app';

function configureDevelopment() {
  process.env.RESEND_API_KEY = 're_test';
  process.env.RESEND_WAITLIST_SEGMENT_ID = 'segment-test';
  process.env.RESEND_FROM_EMAIL = 'USD Impact <book@updates.example.com>';
  process.env.RESEND_REPLY_TO = 'support@example.com';
  process.env.EMAIL_READINESS_LEDGER_ENABLED = 'true';
  delete process.env.EMAIL_READINESS_PRODUCTION_APPROVED;
  process.env.WAITLIST_UNSUBSCRIBE_ENABLED = 'true';
  process.env.WAITLIST_UNSUBSCRIBE_SECRET = unsubscribeSecret;
  delete process.env.WAITLIST_UNSUBSCRIBE_PRODUCTION_APPROVED;
  process.env.VERCEL_ENV = 'preview';
  process.env.SUPABASE_URL = `https://${WAITLIST_DEVELOPMENT_PROJECT_REF}.supabase.co`;
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_12345678901234567890';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_12345678901234567890';
}

function request(body) {
  return {
    method: 'POST',
    url: '/api/waitlist',
    headers: {
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
      host: previewHost,
      'x-forwarded-host': previewHost,
      'x-forwarded-proto': 'https',
    },
    body,
  };
}

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    },
    end(value = '') {
      this.body = String(value);
    },
  };
}

async function invoke(body) {
  const response = responseRecorder();
  await handler(request(body), response);
  return {
    status: response.statusCode,
    json: response.body ? JSON.parse(response.body) : null,
  };
}

function jsonResponse(body, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function queueFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({
      url: String(url),
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body ? JSON.parse(options.body) : null,
    });
    if (!responses.length) throw new Error('Unexpected fetch call.');
    return responses.shift();
  };
  return { calls, fetchImpl };
}

function recordsFor(id) {
  return createWaitlistReadinessRecords({
    email,
    submissionId: id,
    capturedAt,
  });
}

function consentRow(records) {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    idempotency_key: records.consentRecord.idempotency_key,
    email_normalized: email,
    purpose: WAITLIST_CONSENT_PURPOSE,
    status: 'granted',
    captured_at: capturedAt,
  };
}

function outboxRow(records, overrides = {}) {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    idempotency_key: records.outboxRecord.idempotency_key,
    message_id: 'waitlist_confirmation',
    recipient_email_normalized: email,
    status: 'queued',
    attempt_count: 0,
    next_attempt_at: capturedAt,
    provider_message_ref: null,
    error_code: null,
    accepted_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

try {
  configureDevelopment();

  {
    const records = recordsFor(submissionId);
    const flow = queueFetch([
      jsonResponse([consentRow(records)], 201),
      jsonResponse([outboxRow(records)], 201),
      jsonResponse({ id: 'contact-1' }, 201),
      jsonResponse([outboxRow(records, { status: 'sending', attempt_count: 1 })]),
      jsonResponse({ id: 'resend-message-1' }),
      jsonResponse([outboxRow(records, {
        status: 'accepted',
        attempt_count: 1,
        provider_message_ref: 'resend-message-1',
        accepted_at: capturedAt,
      })]),
    ]);
    globalThis.fetch = flow.fetchImpl;

    const result = await invoke({
      email,
      consent: true,
      company: '',
      submissionId,
    });

    assert.equal(result.status, 200);
    assert.deepEqual(result.json, { ok: true });
    assert.equal(flow.calls.length, 6);

    const sendCall = flow.calls[4];
    assert.equal(sendCall.url, 'https://api.resend.com/emails');
    assert.equal(sendCall.headers['Idempotency-Key'], `waitlist-confirmation/${submissionId}`);
    assert.deepEqual(sendCall.body.to, [email]);
    assert.equal(sendCall.body.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');

    const headerValue = sendCall.body.headers['List-Unsubscribe'];
    assert.match(headerValue, /^<https:\/\/.+>$/);
    const unsubscribeUrl = headerValue.slice(1, -1);
    const parsed = new URL(unsubscribeUrl);
    assert.equal(parsed.origin, `https://${previewHost}`);
    assert.equal(parsed.pathname, '/unsubscribe');
    assert.deepEqual([...parsed.searchParams.keys()], ['token']);

    const token = parsed.searchParams.get('token');
    assert.match(token, /^u1\.[0-9a-f]{64}\.[A-Za-z0-9_-]{43}$/);
    assert.equal(
      verifyWaitlistUnsubscribeToken({ token, secret: unsubscribeSecret }).consentIdempotencyKey,
      records.consentRecord.idempotency_key,
    );
    assert.ok(sendCall.body.text.includes(unsubscribeUrl));
    assert.match(sendCall.body.html, /unsubscribe from book availability emails/i);
    assert.doesNotMatch(sendCall.body.html, /List-Unsubscribe/i);
  }

  {
    const missingSecretSubmissionId = '223e4567-e89b-42d3-a456-426614174000';
    const records = recordsFor(missingSecretSubmissionId);
    delete process.env.WAITLIST_UNSUBSCRIBE_SECRET;
    const blocked = queueFetch([
      jsonResponse([consentRow(records)], 201),
      jsonResponse([outboxRow(records)], 201),
    ]);
    globalThis.fetch = blocked.fetchImpl;

    const result = await invoke({
      email,
      consent: true,
      company: '',
      submissionId: missingSecretSubmissionId,
    });

    assert.equal(result.status, 503);
    assert.match(result.json.error, /temporarily unavailable/i);
    assert.equal(blocked.calls.length, 2);
    assert.equal(blocked.calls.some((call) => call.url.startsWith('https://api.resend.com/')), false);
    process.env.WAITLIST_UNSUBSCRIBE_SECRET = unsubscribeSecret;
  }

  console.log('Waitlist unsubscribe email integration tests passed.');
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
