import assert from 'node:assert/strict';
import accountHandler from '../api/account.js';
import waitlistHandler from '../api/waitlist.js';

function response() {
  return {
    statusCode: 0,
    headers: new Map(),
    body: null,
    setHeader(name, value) {
      this.headers.set(String(name).toLowerCase(), value);
    },
    end(value = '') {
      const text = String(value || '');
      this.body = text ? JSON.parse(text) : null;
    },
  };
}

function accountRequest(body, extraHeaders = {}) {
  return {
    method: 'POST',
    url: '/api/account?action=login',
    headers: {
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      ...extraHeaders,
    },
    body,
  };
}

function waitlistRequest(body, extraHeaders = {}) {
  return {
    method: 'POST',
    url: '/api/waitlist',
    headers: {
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      ...extraHeaders,
    },
    body,
  };
}

{
  const res = response();
  await accountHandler(
    accountRequest({
      email: 'oversize-account@example.test',
      padding: 'x'.repeat(40 * 1024),
    }),
    res,
  );
  assert.equal(res.statusCode, 413);
  assert.equal(res.body?.code, 'REQUEST_BODY_TOO_LARGE');
}

{
  const res = response();
  await accountHandler(
    accountRequest(
      { email: 'declared-oversize@example.test' },
      { 'content-length': String(64 * 1024) },
    ),
    res,
  );
  assert.equal(res.statusCode, 413);
  assert.equal(res.body?.code, 'REQUEST_BODY_TOO_LARGE');
}

{
  const res = response();
  await waitlistHandler(
    waitlistRequest({
      email: 'oversize-waitlist@example.test',
      consent: true,
      company: '',
      submissionId: '123e4567-e89b-42d3-a456-426614174000',
      padding: 'x'.repeat(12 * 1024),
    }),
    res,
  );
  assert.equal(res.statusCode, 413);
  assert.equal(res.body?.code, 'REQUEST_BODY_TOO_LARGE');
}

{
  const res = response();
  await waitlistHandler(
    waitlistRequest(
      {
        email: 'declared-oversize@example.test',
        consent: true,
        company: '',
        submissionId: '123e4567-e89b-42d3-a456-426614174000',
      },
      { 'content-length': String(16 * 1024) },
    ),
    res,
  );
  assert.equal(res.statusCode, 413);
  assert.equal(res.body?.code, 'REQUEST_BODY_TOO_LARGE');
}

{
  const res = response();
  await waitlistHandler(
    waitlistRequest({
      email: 'honeypot@example.test',
      consent: true,
      company: 'automated-submission',
      submissionId: '123e4567-e89b-42d3-a456-426614174000',
    }),
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
}

console.log('API request body bound regression tests passed.');
