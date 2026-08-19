import assert from 'node:assert/strict';
import {
  WAITLIST_DEVELOPMENT_PROJECT_REF,
  WAITLIST_PRODUCTION_PROJECT_REF,
  createWaitlistReadinessRecords,
} from '../src/lib/waitlist-readiness.js';
import {
  WAITLIST_UNSUBSCRIBE_FORM_VERSION,
  WaitlistUnsubscribeError,
  createWaitlistUnsubscribeToken,
  createWaitlistUnsubscribeUrl,
  processWaitlistUnsubscribe,
  verifyWaitlistUnsubscribeToken,
} from '../src/lib/waitlist-unsubscribe.js';
import { generateWaitlistUnsubscribeLink } from './generate-waitlist-unsubscribe-link.mjs';

const email = 'reader@example.com';
const submissionId = '123e4567-e89b-42d3-a456-426614174000';
const grantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const withdrawalId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const capturedAt = '2026-08-20T12:00:00.000Z';
const secret = `wus_${Buffer.from('0123456789abcdef0123456789abcdef').toString('base64url')}`;
const records = createWaitlistReadinessRecords({ email, submissionId, capturedAt });
const token = createWaitlistUnsubscribeToken({
  consentIdempotencyKey: records.consentRecord.idempotency_key,
  secret,
});
const baseEnvironment = {
  WAITLIST_UNSUBSCRIBE_ENABLED: 'true',
  WAITLIST_UNSUBSCRIBE_SECRET: secret,
  RESEND_API_KEY: 're_test',
  VERCEL_ENV: 'preview',
  SUPABASE_URL: `https://${WAITLIST_DEVELOPMENT_PROJECT_REF}.supabase.co`,
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_12345678901234567890',
  SUPABASE_SECRET_KEY: 'sb_secret_12345678901234567890',
};

function grantRow(overrides = {}) {
  return {
    id: grantId,
    idempotency_key: records.consentRecord.idempotency_key,
    email_normalized: email,
    purpose: 'book_availability',
    status: 'granted',
    consent_text_version: 'waitlist-purchase-link-v1',
    privacy_notice_version: 'privacy-2026-08-18',
    provider_contact_ref: null,
    captured_at: capturedAt,
    ...overrides,
  };
}

function withdrawalRow(overrides = {}) {
  return {
    id: withdrawalId,
    idempotency_key: `consent:v1:${'c'.repeat(64)}`,
    email_normalized: email,
    purpose: 'book_availability',
    status: 'withdrawn',
    related_grant_id: grantId,
    withdrawn_at: capturedAt,
    ...overrides,
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

async function expectUnsubscribeError(operation, code) {
  await assert.rejects(operation, (error) => {
    assert.ok(error instanceof WaitlistUnsubscribeError);
    assert.equal(error.code, code);
    return true;
  });
}

assert.match(token, /^u1\.[0-9a-f]{64}\.[A-Za-z0-9_-]{43}$/);
assert.deepEqual(
  verifyWaitlistUnsubscribeToken({ token, secret }).consentIdempotencyKey,
  records.consentRecord.idempotency_key,
);
await expectUnsubscribeError(
  () => Promise.resolve(verifyWaitlistUnsubscribeToken({
    token: `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`,
    secret,
  })),
  'INVALID_UNSUBSCRIBE_TOKEN',
);
await expectUnsubscribeError(
  () => Promise.resolve(verifyWaitlistUnsubscribeToken({
    token,
    secret: `wus_${Buffer.from('fedcba9876543210fedcba9876543210').toString('base64url')}`,
  })),
  'INVALID_UNSUBSCRIBE_TOKEN',
);

{
  const url = createWaitlistUnsubscribeUrl({
    email,
    submissionId,
    secret,
    baseUrl: 'https://preview.example.com/path/ignored',
  });
  const parsed = new URL(url);
  assert.equal(parsed.origin, 'https://preview.example.com');
  assert.equal(parsed.pathname, '/unsubscribe');
  assert.equal(parsed.searchParams.get('token'), token);
  assert.equal(url.includes(email), false);

  const generated = generateWaitlistUnsubscribeLink({
    WAITLIST_TEST_EMAIL: email,
    WAITLIST_TEST_SUBMISSION_ID: submissionId,
    WAITLIST_UNSUBSCRIBE_SECRET: secret,
    WAITLIST_UNSUBSCRIBE_BASE_URL: 'https://preview.example.com',
  });
  assert.equal(generated, url.replace('/path/ignored', ''));
}

{
  const withdrawal = withdrawalRow({ withdrawn_at: capturedAt });
  const { calls, fetchImpl } = queueFetch([
    jsonResponse([grantRow()]),
    jsonResponse([]),
    jsonResponse([withdrawal], 201),
    jsonResponse({ object: 'contact', id: 'contact-1' }),
  ]);

  const result = await processWaitlistUnsubscribe({
    token,
    environment: baseEnvironment,
    fetchImpl,
    now: new Date(capturedAt),
  });

  assert.equal(result.ok, true);
  assert.equal(result.projectRef, WAITLIST_DEVELOPMENT_PROJECT_REF);
  assert.equal(result.alreadyWithdrawn, false);
  assert.equal(calls.length, 4);
  assert.equal(calls[0].method, 'GET');
  assert.match(calls[0].url, /marketing_consent_events\?idempotency_key=/);
  assert.equal(calls[1].method, 'GET');
  assert.match(calls[1].url, /related_grant_id=/);
  assert.equal(calls[2].method, 'POST');
  assert.equal(calls[2].body.status, 'withdrawn');
  assert.equal(calls[2].body.related_grant_id, grantId);
  assert.equal(calls[2].body.email_normalized, email);
  assert.equal(calls[2].body.captured_at, capturedAt);
  assert.equal(calls[2].body.withdrawn_at, capturedAt);
  assert.equal(calls[2].body.withdrawal_source, 'unsubscribe_link');
  assert.deepEqual(calls[2].body.evidence.context, {
    formVersion: WAITLIST_UNSUBSCRIBE_FORM_VERSION,
  });
  assert.equal(calls[3].method, 'PATCH');
  assert.equal(calls[3].url, 'https://api.resend.com/contacts/reader%40example.com');
  assert.deepEqual(calls[3].body, { unsubscribed: true });
}

{
  const { calls, fetchImpl } = queueFetch([
    jsonResponse([grantRow()]),
    jsonResponse([withdrawalRow()]),
    jsonResponse({ object: 'contact', id: 'contact-1' }),
  ]);
  const result = await processWaitlistUnsubscribe({
    token,
    environment: baseEnvironment,
    fetchImpl,
    now: new Date(capturedAt),
  });
  assert.equal(result.ok, true);
  assert.equal(result.alreadyWithdrawn, true);
  assert.equal(calls.length, 3);
  assert.equal(calls.some((call) => call.method === 'POST'), false);
  assert.equal(calls.at(-1).method, 'PATCH');
}

{
  let fetchCount = 0;
  await expectUnsubscribeError(
    () => processWaitlistUnsubscribe({
      token,
      environment: {
        ...baseEnvironment,
        WAITLIST_UNSUBSCRIBE_ENABLED: 'false',
      },
      fetchImpl: async () => {
        fetchCount += 1;
        throw new Error('Fetch must not run.');
      },
    }),
    'UNSUBSCRIBE_NOT_ENABLED',
  );
  assert.equal(fetchCount, 0);
}

{
  let fetchCount = 0;
  await expectUnsubscribeError(
    () => processWaitlistUnsubscribe({
      token,
      environment: {
        ...baseEnvironment,
        SUPABASE_URL: `https://${WAITLIST_PRODUCTION_PROJECT_REF}.supabase.co`,
      },
      fetchImpl: async () => {
        fetchCount += 1;
        throw new Error('Fetch must not run.');
      },
    }),
    'UNEXPECTED_SUPABASE_PROJECT',
  );
  assert.equal(fetchCount, 0);
}

{
  let fetchCount = 0;
  await expectUnsubscribeError(
    () => processWaitlistUnsubscribe({
      token,
      environment: {
        ...baseEnvironment,
        VERCEL_ENV: 'production',
        SUPABASE_URL: `https://${WAITLIST_PRODUCTION_PROJECT_REF}.supabase.co`,
      },
      fetchImpl: async () => {
        fetchCount += 1;
        throw new Error('Fetch must not run.');
      },
    }),
    'PRODUCTION_UNSUBSCRIBE_NOT_APPROVED',
  );
  assert.equal(fetchCount, 0);
}

{
  const { calls, fetchImpl } = queueFetch([
    jsonResponse([grantRow()]),
    jsonResponse([]),
    jsonResponse([withdrawalRow()], 201),
    jsonResponse({ message: 'provider unavailable' }, 503),
  ]);
  await expectUnsubscribeError(
    () => processWaitlistUnsubscribe({
      token,
      environment: baseEnvironment,
      fetchImpl,
      now: new Date(capturedAt),
    }),
    'RESEND_UNSUBSCRIBE_FAILED',
  );
  assert.equal(calls[2].method, 'POST');
  assert.equal(calls[3].method, 'PATCH');
}

{
  const { fetchImpl } = queueFetch([
    jsonResponse([grantRow({ status: 'withdrawn' })]),
  ]);
  await expectUnsubscribeError(
    () => processWaitlistUnsubscribe({
      token,
      environment: baseEnvironment,
      fetchImpl,
    }),
    'INVALID_CONSENT_GRANT',
  );
}

console.log('Waitlist unsubscribe workflow tests passed.');
