import assert from 'node:assert/strict';
import handler from '../api/waitlist.js';
import {
  WAITLIST_CONSENT_PURPOSE,
  WAITLIST_DEVELOPMENT_PROJECT_REF,
  createWaitlistReadinessRecords,
} from '../src/lib/waitlist-readiness.js';

const originalFetch = globalThis.fetch;
const managedEnvironmentKeys = [
  'RESEND_API_KEY',
  'RESEND_WAITLIST_SEGMENT_ID',
  'RESEND_FROM_EMAIL',
  'RESEND_REPLY_TO',
  'EMAIL_READINESS_LEDGER_ENABLED',
  'EMAIL_READINESS_PRODUCTION_APPROVED',
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
const consentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const baseRecords = createWaitlistReadinessRecords({ email, submissionId, capturedAt });
const consentReference = Object.freeze({
  id: consentId,
  status: 'granted',
  purpose: WAITLIST_CONSENT_PURPOSE,
  emailNormalized: email,
});
const records = createWaitlistReadinessRecords({
  email,
  submissionId,
  capturedAt,
  consent: consentReference,
});

function configureDevelopment() {
  process.env.RESEND_API_KEY = 're_test';
  process.env.RESEND_WAITLIST_SEGMENT_ID = 'segment-test';
  process.env.RESEND_FROM_EMAIL = 'USD Impact <book@updates.example.com>';
  process.env.RESEND_REPLY_TO = 'support@example.com';
  process.env.EMAIL_READINESS_LEDGER_ENABLED = 'true';
  delete process.env.EMAIL_READINESS_PRODUCTION_APPROVED;
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
    const next = responses.shift();
    return typeof next === 'function' ? next(calls.at(-1)) : next;
  };
  return { calls, fetchImpl };
}

function consentRow(overrides = {}) {
  return {
    id: consentId,
    idempotency_key: baseRecords.consentRecord.idempotency_key,
    email_normalized: email,
    purpose: WAITLIST_CONSENT_PURPOSE,
    status: 'granted',
    captured_at: capturedAt,
    ...overrides,
  };
}

function outboxRow(overrides = {}) {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    idempotency_key: records.outboxRecord.idempotency_key,
    message_id: 'waitlist_confirmation',
    recipient_email_normalized: email,
    consent_required: true,
    consent_record_id: consentId,
    consent_purpose: WAITLIST_CONSENT_PURPOSE,
    consent_checked_at: capturedAt,
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
    const queued = queueFetch([
      jsonResponse([consentRow()], 201),
      jsonResponse([outboxRow()], 201),
      jsonResponse({ id: 'contact-1' }, 201),
      jsonResponse([outboxRow({ status: 'sending', attempt_count: 1 })]),
      jsonResponse({ id: 'resend-message-1' }, 200),
      jsonResponse([outboxRow({
        status: 'accepted',
        attempt_count: 1,
        provider_message_ref: 'resend-message-1',
        accepted_at: capturedAt,
      })]),
    ]);
    globalThis.fetch = queued.fetchImpl;

    const result = await invoke({
      email,
      consent: true,
      company: '',
      submissionId,
    });

    assert.equal(result.status, 200);
    assert.deepEqual(result.json, { ok: true });
    assert.equal(queued.calls.length, 6);
    assert.match(queued.calls[0].url, /marketing_consent_events\?on_conflict=/);
    assert.equal(queued.calls[0].body.status, 'granted');
    assert.match(queued.calls[1].url, /notification_outbox\?on_conflict=/);
    assert.equal(queued.calls[1].body.status, undefined);
    assert.equal(queued.calls[1].body.consent_required, true);
    assert.equal(queued.calls[1].body.consent_record_id, consentId);
    assert.equal(queued.calls[1].body.consent_purpose, WAITLIST_CONSENT_PURPOSE);
    assert.ok(Number.isFinite(Date.parse(queued.calls[1].body.consent_checked_at)));
    assert.equal(queued.calls[2].url, 'https://api.resend.com/contacts');
    assert.equal(queued.calls[3].body.status, 'sending');
    assert.equal(queued.calls[4].url, 'https://api.resend.com/emails');
    assert.equal(
      queued.calls[4].headers['Idempotency-Key'],
      `waitlist-confirmation/${submissionId}`,
    );
    assert.deepEqual(queued.calls[4].body.to, [email]);
    assert.deepEqual(queued.calls[5].body, {
      status: 'accepted',
      provider_message_ref: 'resend-message-1',
      accepted_at: queued.calls[5].body.accepted_at,
      error_code: null,
    });
    assert.ok(Number.isFinite(Date.parse(queued.calls[5].body.accepted_at)));
  }

  {
    const duplicate = queueFetch([
      jsonResponse([], 201),
      jsonResponse([consentRow()]),
      jsonResponse([], 201),
      jsonResponse([outboxRow({
        status: 'accepted',
        attempt_count: 1,
        provider_message_ref: 'resend-message-1',
        accepted_at: capturedAt,
      })]),
    ]);
    globalThis.fetch = duplicate.fetchImpl;

    const result = await invoke({
      email,
      consent: true,
      company: '',
      submissionId,
    });

    assert.equal(result.status, 200);
    assert.deepEqual(result.json, { ok: true });
    assert.equal(duplicate.calls.length, 4);
    assert.equal(duplicate.calls.some((call) => call.url.startsWith('https://api.resend.com/')), false);
  }

  {
    const staleSending = queueFetch([
      jsonResponse([], 201),
      jsonResponse([consentRow()]),
      jsonResponse([], 201),
      jsonResponse([outboxRow({
        status: 'sending',
        attempt_count: 1,
        created_at: '2026-08-18T00:00:00.000Z',
      })]),
    ]);
    globalThis.fetch = staleSending.fetchImpl;

    const result = await invoke({
      email,
      consent: true,
      company: '',
      submissionId,
    });

    assert.equal(result.status, 503);
    assert.match(result.json.error, /reconciled/i);
    assert.equal(staleSending.calls.length, 4);
    assert.equal(staleSending.calls.some((call) => call.url.startsWith('https://api.resend.com/')), false);
  }

  {
    const retrySubmissionId = '223e4567-e89b-42d3-a456-426614174000';
    const retryBaseRecords = createWaitlistReadinessRecords({
      email,
      submissionId: retrySubmissionId,
      capturedAt,
    });
    const retryRecords = createWaitlistReadinessRecords({
      email,
      submissionId: retrySubmissionId,
      capturedAt,
      consent: consentReference,
    });
    const failed = queueFetch([
      jsonResponse([{
        ...consentRow(),
        idempotency_key: retryBaseRecords.consentRecord.idempotency_key,
      }], 201),
      jsonResponse([{
        ...outboxRow(),
        idempotency_key: retryRecords.outboxRecord.idempotency_key,
      }], 201),
      jsonResponse({ id: 'contact-2' }, 201),
      jsonResponse([outboxRow({ status: 'sending', attempt_count: 1 })]),
      jsonResponse({ message: 'provider unavailable' }, 503),
      jsonResponse([outboxRow({
        status: 'retry_scheduled',
        attempt_count: 1,
        error_code: 'RESEND_SEND_FAILED',
      })]),
    ]);
    globalThis.fetch = failed.fetchImpl;

    const result = await invoke({
      email,
      consent: true,
      company: '',
      submissionId: retrySubmissionId,
    });

    assert.equal(result.status, 502);
    assert.equal(failed.calls[4].headers['Idempotency-Key'], `waitlist-confirmation/${retrySubmissionId}`);
    assert.equal(failed.calls[5].body.status, 'retry_scheduled');
    assert.equal(failed.calls[5].body.error_code, 'RESEND_SEND_FAILED');
  }

  console.log('Waitlist readiness handler tests passed.');
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
