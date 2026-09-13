import assert from 'node:assert/strict';
import { handleMarketingOptInRequest } from '../src/lib/marketing-opt-in-handler.js';

const requestId = '123e4567-e89b-42d3-a456-426614174000';
const outbox = Object.freeze({ id: '123e4567-e89b-42d3-a456-426614174010' });

function responseRecorder() {
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

let prepareInput = null;
let deliveryInput = null;
let originCalls = 0;
const response = responseRecorder();
await handleMarketingOptInRequest(
  {
    method: 'POST',
    url: '/api/email-subscribe',
    headers: {
      host: 'usd-impact-site-example.vercel.app',
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
    },
    body: {
      email: 'reader@example.com',
      consent: true,
      purpose: 'weekly_newsletter',
      requestId,
      locale: 'en',
    },
  },
  response,
  {
    environment: { EMAIL_OPT_IN_REQUEST_ENABLED: 'true' },
    prepare: async (input) => {
      prepareInput = input;
      return { action: 'confirmation_queued', outbox };
    },
    resolveOrigin: () => {
      originCalls += 1;
      return 'https://usd-impact-site-example.vercel.app';
    },
    deliver: async (input) => {
      deliveryInput = input;
      return { sent: true, state: 'accepted' };
    },
  },
);

assert.equal(response.statusCode, 202);
assert.deepEqual(JSON.parse(response.body), { ok: true, status: 'check_email' });
assert.equal(prepareInput.email, 'reader@example.com');
assert.equal(prepareInput.purpose, 'weekly_newsletter');
assert.equal(originCalls, 1);
assert.equal(deliveryInput.outbox, outbox);
assert.equal(deliveryInput.baseUrl, 'https://usd-impact-site-example.vercel.app');

{
  let deliverCalled = false;
  let resolveCalled = false;
  const existingResponse = responseRecorder();
  await handleMarketingOptInRequest(
    {
      method: 'POST',
      url: '/api/email-subscribe',
      headers: {
        'content-type': 'application/json',
        'sec-fetch-site': 'same-origin',
      },
      body: {
        email: 'reader@example.com',
        consent: true,
        purpose: 'weekly_newsletter',
        requestId,
      },
    },
    existingResponse,
    {
      environment: { EMAIL_OPT_IN_REQUEST_ENABLED: 'true' },
      prepare: async () => ({ action: 'already_subscribed', outbox: null }),
      resolveOrigin: () => {
        resolveCalled = true;
        return 'https://should-not-be-used.invalid';
      },
      deliver: async () => {
        deliverCalled = true;
      },
    },
  );
  assert.equal(existingResponse.statusCode, 202);
  assert.equal(resolveCalled, false);
  assert.equal(deliverCalled, false);
}

console.log('Marketing opt-in request delivery integration contract passed.');
