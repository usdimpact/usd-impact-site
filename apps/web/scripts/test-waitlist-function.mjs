import assert from 'node:assert/strict';
import handler from '../api/waitlist.js';

const originalFetch = globalThis.fetch;
const originalEnv = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_WAITLIST_SEGMENT_ID: process.env.RESEND_WAITLIST_SEGMENT_ID,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  RESEND_REPLY_TO: process.env.RESEND_REPLY_TO,
  EMAIL_READINESS_LEDGER_ENABLED: process.env.EMAIL_READINESS_LEDGER_ENABLED,
};

function request(body, headers = {}, method = 'POST') {
  return {
    method,
    headers: {
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
      ...headers,
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
      this.headers[name.toLowerCase()] = String(value);
    },
    end(body = '') {
      this.body = String(body);
    },
  };
}

async function invoke(req) {
  const res = responseRecorder();
  await handler(req, res);
  return {
    status: res.statusCode,
    headers: res.headers,
    json: res.body ? JSON.parse(res.body) : null,
  };
}

function resendResponse(body, status = 200) {
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
  process.env.EMAIL_READINESS_LEDGER_ENABLED = 'false';

  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return resendResponse({ id: `result-${calls.length}` });
  };

  const success = await invoke(request({
    email: ' Reader@Example.com ',
    consent: true,
    company: '',
  }));
  assert.equal(success.status, 200);
  assert.deepEqual(success.json, { ok: true });
  assert.equal(success.headers['cache-control'], 'no-store');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://api.resend.com/contacts');
  assert.equal(calls[1].url, 'https://api.resend.com/emails');

  const contactBody = JSON.parse(calls[0].options.body);
  assert.equal(contactBody.email, 'reader@example.com');
  assert.deepEqual(contactBody.segments, [{ id: 'segment-test' }]);

  const emailBody = JSON.parse(calls[1].options.body);
  assert.deepEqual(emailBody.to, ['reader@example.com']);
  assert.match(emailBody.subject, /waitlist/i);

  const stringBodySuccess = await invoke(request(JSON.stringify({
    email: 'string-body@example.com',
    consent: true,
    company: '',
  })));
  assert.equal(stringBodySuccess.status, 200);

  const callsBeforeValidation = calls.length;
  const invalidEmail = await invoke(request({ email: 'not-an-email', consent: true }));
  assert.equal(invalidEmail.status, 400);
  assert.equal(calls.length, callsBeforeValidation);

  const missingConsent = await invoke(request({ email: 'reader@example.com', consent: false }));
  assert.equal(missingConsent.status, 400);
  assert.equal(calls.length, callsBeforeValidation);

  const honeypot = await invoke(request({
    email: 'bot@example.com',
    consent: true,
    company: 'Spam Incorporated',
  }));
  assert.equal(honeypot.status, 200);
  assert.equal(calls.length, callsBeforeValidation);

  const crossSite = await invoke(request(
    { email: 'reader@example.com', consent: true },
    { 'sec-fetch-site': 'cross-site' },
  ));
  assert.equal(crossSite.status, 403);

  const wrongMethod = await invoke(request(null, {}, 'GET'));
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.allow, 'POST');

  const duplicateCalls = [];
  globalThis.fetch = async (url, options = {}) => {
    duplicateCalls.push({ url: String(url), options });
    if (duplicateCalls.length === 1) return resendResponse({ message: 'Contact exists' }, 409);
    return resendResponse({ id: `duplicate-${duplicateCalls.length}` });
  };

  const duplicate = await invoke(request({
    email: 'reader@example.com',
    consent: true,
    company: '',
  }));
  assert.equal(duplicate.status, 200);
  assert.equal(duplicateCalls.length, 3);
  assert.equal(
    duplicateCalls[1].url,
    'https://api.resend.com/contacts/reader%40example.com/segments/segment-test',
  );
  assert.equal(duplicateCalls[2].url, 'https://api.resend.com/emails');

  delete process.env.RESEND_API_KEY;
  const unavailable = await invoke(request({
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
