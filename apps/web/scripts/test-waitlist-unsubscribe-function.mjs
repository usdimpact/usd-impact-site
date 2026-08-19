import assert from 'node:assert/strict';
import handler from '../api/waitlist.js';
import {
  WAITLIST_DEVELOPMENT_PROJECT_REF,
  createWaitlistReadinessRecords,
} from '../src/lib/waitlist-readiness.js';
import { createWaitlistUnsubscribeToken } from '../src/lib/waitlist-unsubscribe.js';

const originalFetch = globalThis.fetch;
const managedEnvironmentKeys = [
  'WAITLIST_UNSUBSCRIBE_ENABLED',
  'WAITLIST_UNSUBSCRIBE_SECRET',
  'WAITLIST_UNSUBSCRIBE_PRODUCTION_APPROVED',
  'RESEND_API_KEY',
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
const grantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const capturedAt = '2026-08-20T12:00:00.000Z';
const secret = `wus_${Buffer.from('0123456789abcdef0123456789abcdef').toString('base64url')}`;
const records = createWaitlistReadinessRecords({ email, submissionId, capturedAt });
const token = createWaitlistUnsubscribeToken({
  consentIdempotencyKey: records.consentRecord.idempotency_key,
  secret,
});

function configure() {
  process.env.WAITLIST_UNSUBSCRIBE_ENABLED = 'true';
  process.env.WAITLIST_UNSUBSCRIBE_SECRET = secret;
  delete process.env.WAITLIST_UNSUBSCRIBE_PRODUCTION_APPROVED;
  process.env.RESEND_API_KEY = 're_test';
  process.env.VERCEL_ENV = 'preview';
  process.env.SUPABASE_URL = `https://${WAITLIST_DEVELOPMENT_PROJECT_REF}.supabase.co`;
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_12345678901234567890';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_12345678901234567890';
}

function request({
  method = 'GET',
  url = `/api/waitlist?action=unsubscribe&token=${encodeURIComponent(token)}`,
  contentType = '',
  accept = 'text/html',
  body,
} = {}) {
  return {
    method,
    url,
    headers: {
      ...(contentType ? { 'content-type': contentType } : {}),
      accept,
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

async function invoke(req) {
  const response = responseRecorder();
  await handler(req, response);
  return response;
}

function jsonResponse(body, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function successfulFetch() {
  const responses = [
    jsonResponse([{
      id: grantId,
      idempotency_key: records.consentRecord.idempotency_key,
      email_normalized: email,
      purpose: 'book_availability',
      status: 'granted',
      consent_text_version: 'waitlist-purchase-link-v1',
      privacy_notice_version: 'privacy-2026-08-18',
      provider_contact_ref: null,
      captured_at: capturedAt,
    }]),
    jsonResponse([]),
    jsonResponse([{
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      idempotency_key: `consent:v1:${'c'.repeat(64)}`,
      email_normalized: email,
      purpose: 'book_availability',
      status: 'withdrawn',
      related_grant_id: grantId,
      withdrawn_at: capturedAt,
    }], 201),
    jsonResponse({ object: 'contact', id: 'contact-1' }),
  ];
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({
      url: String(url),
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : null,
    });
    if (!responses.length) throw new Error('Unexpected fetch call.');
    return responses.shift();
  };
  return { calls, fetchImpl };
}

try {
  configure();

  {
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount += 1;
      throw new Error('GET must not mutate or query providers.');
    };
    const response = await invoke(request());
    assert.equal(response.statusCode, 200);
    assert.match(response.headers['content-type'], /text\/html/);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['x-robots-tag'], 'noindex, nofollow');
    assert.equal(response.headers['referrer-policy'], 'no-referrer');
    assert.match(response.body, /Confirm unsubscribe/);
    assert.match(response.body, /name="List-Unsubscribe" value="One-Click"/);
    assert.equal(response.body.includes(email), false);
    assert.equal(fetchCount, 0);
  }

  {
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount += 1;
      throw new Error('Malformed GET must not query providers.');
    };
    const response = await invoke(request({
      url: '/api/waitlist?action=unsubscribe&token=invalid',
    }));
    assert.equal(response.statusCode, 400);
    assert.match(response.body, /could not be completed/i);
    assert.equal(fetchCount, 0);
  }

  {
    const { calls, fetchImpl } = successfulFetch();
    globalThis.fetch = fetchImpl;
    const response = await invoke(request({
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
      body: 'List-Unsubscribe=One-Click',
    }));
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /You are unsubscribed/);
    assert.equal(calls.length, 4);
    assert.equal(calls[2].method, 'POST');
    assert.equal(calls[2].body.status, 'withdrawn');
    assert.equal(calls[3].method, 'PATCH');
    assert.deepEqual(calls[3].body, { unsubscribed: true });
  }

  {
    const { calls, fetchImpl } = successfulFetch();
    globalThis.fetch = fetchImpl;
    const response = await invoke(request({
      method: 'POST',
      url: '/api/waitlist?action=unsubscribe',
      contentType: 'application/json',
      accept: 'application/json',
      body: { token, confirm: true },
    }));
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, '');
    assert.equal(calls.length, 4);
  }

  {
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount += 1;
      throw new Error('Unconfirmed POST must not query providers.');
    };
    const response = await invoke(request({
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
      accept: 'application/json',
      body: 'List-Unsubscribe=No',
    }));
    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.body).code, 'CONFIRMATION_REQUIRED');
    assert.equal(fetchCount, 0);
  }

  {
    process.env.WAITLIST_UNSUBSCRIBE_ENABLED = 'false';
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount += 1;
      throw new Error('Disabled POST must not query providers.');
    };
    const response = await invoke(request({
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
      accept: 'application/json',
      body: 'List-Unsubscribe=One-Click',
    }));
    assert.equal(response.statusCode, 404);
    assert.equal(JSON.parse(response.body).code, 'UNSUBSCRIBE_NOT_ENABLED');
    assert.equal(fetchCount, 0);
    process.env.WAITLIST_UNSUBSCRIBE_ENABLED = 'true';
  }

  {
    const response = await invoke(request({ method: 'DELETE' }));
    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.allow, 'GET, POST');
  }

  console.log('Waitlist unsubscribe route tests passed.');
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
