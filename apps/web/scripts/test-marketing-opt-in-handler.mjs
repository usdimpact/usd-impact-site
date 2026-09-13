import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  handleMarketingOptInConfirmation,
  handleMarketingOptInRequest,
} from '../src/lib/marketing-opt-in-handler.js';

const requestId = '123e4567-e89b-42d3-a456-426614174000';
const userId = '123e4567-e89b-42d3-a456-426614174001';
const email = 'reader@example.com';
const enabledEnvironment = { EMAIL_OPT_IN_REQUEST_ENABLED: 'true' };

function mockResponse() {
  const headers = new Map();
  return {
    statusCode: 0,
    body: '',
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    end(value = '') {
      this.body = String(value);
    },
  };
}

function jsonRequest(body, overrides = {}) {
  return {
    method: 'POST',
    url: '/api/email-subscribe',
    headers: {
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
      ...(overrides.headers || {}),
    },
    body,
    ...overrides,
  };
}

{
  const response = mockResponse();
  await handleMarketingOptInRequest(jsonRequest({}), response, { environment: {} });
  assert.equal(response.statusCode, 404);
  assert.match(response.body, /OPT_IN_REQUEST_DISABLED/);
}

{
  const response = mockResponse();
  await handleMarketingOptInRequest(
    jsonRequest({ email, consent: true, purpose: 'weekly_newsletter', requestId }, {
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' },
    }),
    response,
    { environment: enabledEnvironment },
  );
  assert.equal(response.statusCode, 403);
  assert.match(response.body, /CROSS_SITE_REQUEST/);
}

{
  const response = mockResponse();
  await handleMarketingOptInRequest(
    jsonRequest({ email, consent: false, purpose: 'weekly_newsletter', requestId }),
    response,
    { environment: enabledEnvironment },
  );
  assert.equal(response.statusCode, 400);
  assert.match(response.body, /CONSENT_REQUIRED/);
}

{
  let captured = null;
  const response = mockResponse();
  await handleMarketingOptInRequest(
    jsonRequest({
      email,
      consent: true,
      purpose: 'weekly_newsletter',
      requestId,
      locale: 'en',
      company: '',
    }),
    response,
    {
      environment: enabledEnvironment,
      prepare: async (input) => {
        captured = input;
        return { action: 'confirmation_queued' };
      },
    },
  );
  assert.equal(response.statusCode, 202);
  assert.deepEqual(JSON.parse(response.body), { ok: true, status: 'check_email' });
  assert.equal(captured.email, email);
  assert.equal(captured.purpose, 'weekly_newsletter');
  assert.equal(captured.userId, null);
}

{
  let called = false;
  const response = mockResponse();
  await handleMarketingOptInRequest(
    jsonRequest({
      email,
      consent: true,
      purpose: 'weekly_newsletter',
      requestId,
      company: 'bot-value',
    }),
    response,
    {
      environment: enabledEnvironment,
      prepare: async () => {
        called = true;
      },
    },
  );
  assert.equal(response.statusCode, 202);
  assert.equal(called, false);
}

{
  const response = mockResponse();
  await handleMarketingOptInRequest(
    jsonRequest({ email, consent: true, purpose: 'learning_progress_updates', requestId }),
    response,
    { environment: enabledEnvironment },
  );
  assert.equal(response.statusCode, 401);
  assert.match(response.body, /VERIFIED_ACCOUNT_REQUIRED/);
}

{
  let captured = null;
  const response = mockResponse();
  await handleMarketingOptInRequest(
    jsonRequest(
      { email, consent: true, purpose: 'learning_progress_updates', requestId },
      { headers: {
        'content-type': 'application/json',
        'sec-fetch-site': 'same-origin',
        authorization: 'Bearer abcdefghijklmnopqrstuvwxyz123456',
      } },
    ),
    response,
    {
      environment: enabledEnvironment,
      getVerifiedUser: async () => ({ id: userId, email }),
      prepare: async (input) => {
        captured = input;
        return { action: 'confirmation_queued' };
      },
    },
  );
  assert.equal(response.statusCode, 202);
  assert.equal(captured.userId, userId);
}

{
  const response = mockResponse();
  await handleMarketingOptInRequest(
    jsonRequest(
      { email, consent: true, purpose: 'learning_progress_updates', requestId },
      { headers: {
        'content-type': 'application/json',
        'sec-fetch-site': 'same-origin',
        authorization: 'Bearer abcdefghijklmnopqrstuvwxyz123456',
      } },
    ),
    response,
    {
      environment: enabledEnvironment,
      getVerifiedUser: async () => ({ id: userId, email: 'different@example.com' }),
    },
  );
  assert.equal(response.statusCode, 403);
  assert.match(response.body, /ACCOUNT_EMAIL_MISMATCH/);
}

{
  const response = mockResponse();
  await handleMarketingOptInConfirmation(
    { method: 'GET', headers: {} },
    response,
  );
  assert.equal(response.statusCode, 405);
  assert.equal(response.getHeader('allow'), 'POST');
}

{
  const response = mockResponse();
  await handleMarketingOptInConfirmation(
    {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'sec-fetch-site': 'same-origin',
      },
      body: 'token=abc',
    },
    response,
    { confirm: async () => assert.fail('Confirmation must require an explicit user action.') },
  );
  assert.equal(response.statusCode, 400);
  assert.match(response.body, /OPT_IN_CONFIRMATION_REQUIRED/);
}

{
  let receivedToken = null;
  const response = mockResponse();
  await handleMarketingOptInConfirmation(
    {
      method: 'POST',
      headers: {
        accept: 'text/html',
        'content-type': 'application/x-www-form-urlencoded',
        'sec-fetch-site': 'same-origin',
      },
      body: 'token=m1.test&Email-Opt-In=Confirm',
    },
    response,
    {
      environment: {},
      confirm: async ({ token }) => {
        receivedToken = token;
        return { created: true };
      },
    },
  );
  assert.equal(receivedToken, 'm1.test');
  assert.equal(response.statusCode, 200);
  assert.match(response.getHeader('content-type'), /text\/html/);
  assert.match(response.body, /Email preference confirmed/);
  assert.doesNotMatch(response.body, new RegExp(email.replace('.', '\\.')));
}

{
  const response = mockResponse();
  await handleMarketingOptInConfirmation(
    {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'sec-fetch-site': 'cross-site',
      },
      body: 'token=m1.test&Email-Opt-In=Confirm',
    },
    response,
    { confirm: async () => assert.fail('Cross-site confirmation must not reach the consent writer.') },
  );
  assert.equal(response.statusCode, 403);
}

const confirmationPage = readFileSync(new URL('../src/pages/email/confirm.astro', import.meta.url), 'utf8');
assert.match(confirmationPage, /method="post"/i);
assert.match(confirmationPage, /action="\/api\/email-confirm"/i);
assert.match(confirmationPage, /Opening this page does not subscribe you/i);
assert.match(confirmationPage, /button type="submit"[^>]*disabled/i);
assert.doesNotMatch(confirmationPage, /\.submit\s*\(/i);
assert.doesNotMatch(confirmationPage, /email=/i);

console.log('Marketing opt-in HTTP handler contract passed.');
