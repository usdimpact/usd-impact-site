import assert from 'node:assert/strict';
import handler from '../api/waitlist.js';

const originalFetch = globalThis.fetch;
const originalEnv = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_WAITLIST_SEGMENT_ID: process.env.RESEND_WAITLIST_SEGMENT_ID,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  RESEND_REPLY_TO: process.env.RESEND_REPLY_TO,
};

function request(body, headers = {}) {
  return new Request('https://example.com/api/waitlist', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Sec-Fetch-Site': 'same-origin',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

try {
  process.env.RESEND_API_KEY = 're_test';
  process.env.RESEND_WAITLIST_SEGMENT_ID = 'segment-test';
  process.env.RESEND_FROM_EMAIL = 'USD Impact <book@updates.example.com>';
  process.env.RESEND_REPLY_TO = 'support@example.com';

  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return response({ id: `result-${calls.length}` });
  };

  const success = await handler(request({
    email: ' Reader@Example.com ',
    consent: true,
    company: '',
    source: 'book-waitlist',
  }));
  assert.equal(success.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://api.resend.com/contacts');
  assert.equal(calls[1].url, 'https://api.resend.com/emails');

  const contactBody = JSON.parse(calls[0].options.body);
  assert.equal(contactBody.email, 'reader@example.com');
  assert.deepEqual(contactBody.segments, [{ id: 'segment-test' }]);

  const emailBody = JSON.parse(calls[1].options.body);
  assert.deepEqual(emailBody.to, ['reader@example.com']);
  assert.match(emailBody.subject, /waitlist/i);

  const callsBeforeValidation = calls.length;
  const invalidEmail = await handler(request({ email: 'not-an-email', consent: true }));
  assert.equal(invalidEmail.status, 400);
  assert.equal(calls.length, callsBeforeValidation);

  const missingConsent = await handler(request({ email: 'reader@example.com', consent: false }));
  assert.equal(missingConsent.status, 400);
  assert.equal(calls.length, callsBeforeValidation);

  const honeypot = await handler(request({
    email: 'bot@example.com',
    consent: true,
    company: 'Spam Incorporated',
  }));
  assert.equal(honeypot.status, 200);
  assert.equal(calls.length, callsBeforeValidation);

  const duplicateCalls = [];
  globalThis.fetch = async (url, options = {}) => {
    duplicateCalls.push({ url: String(url), options });
    if (duplicateCalls.length === 1) return response({ message: 'Contact exists' }, 409);
    return response({ id: `duplicate-${duplicateCalls.length}` });
  };

  const duplicate = await handler(request({
    email: 'reader@example.com',
    consent: true,
    company: '',
    source: 'book-waitlist',
  }));
  assert.equal(duplicate.status, 200);
  assert.equal(duplicateCalls.length, 3);
  assert.equal(
    duplicateCalls[1].url,
    'https://api.resend.com/contacts/reader%40example.com/segments/segment-test',
  );
  assert.equal(duplicateCalls[2].url, 'https://api.resend.com/emails');

  delete process.env.RESEND_API_KEY;
  const unavailable = await handler(request({
    email: 'reader@example.com',
    consent: true,
    company: '',
  }));
  assert.equal(unavailable.status, 503);

  console.log('waitlist function tests pass');
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
