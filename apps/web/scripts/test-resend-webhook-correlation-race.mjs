import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { handleResendWebhook } from '../src/lib/resend-webhook-handler.js';

const nowMs = Date.parse('2026-08-20T12:00:00.000Z');
const timestamp = String(Math.floor(nowMs / 1000));
const secretBytes = Buffer.from('usd-impact-resend-correlation-race-secret');
const webhookSecret = `whsec_${secretBytes.toString('base64')}`;
const emailId = '56761188-7520-42d8-8898-ff6fc54ce618';
const svixId = 'msg_correlation_race_001';
const environment = {
  RESEND_WEBHOOK_ENABLED: 'true',
  RESEND_WEBHOOK_SECRET: webhookSecret,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_12345678901234567890',
  SUPABASE_SECRET_KEY: 'sb_secret_12345678901234567890',
};

const event = {
  type: 'email.delivered',
  created_at: '2026-08-20T11:59:30.000Z',
  data: {
    email_id: emailId,
    from: 'USD Impact <no-reply@updates.usd-impact.com>',
    to: ['reader@example.com'],
    subject: 'Correlation race test',
  },
};
const payload = JSON.stringify(event);
const payloadSha256 = createHash('sha256').update(payload).digest('hex');

function sign() {
  return createHmac('sha256', secretBytes)
    .update(`${svixId}.${timestamp}.${payload}`)
    .digest('base64');
}

function request() {
  const value = Readable.from([payload]);
  value.method = 'POST';
  value.headers = {
    'content-type': 'application/json',
    'svix-id': svixId,
    'svix-timestamp': timestamp,
    'svix-signature': `v1,${sign()}`,
  };
  return value;
}

function responseMock() {
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

function jsonResponse(body, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function queuedFetch(responses) {
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

{
  const { calls, fetchImpl } = queuedFetch([
    jsonResponse([{
      id: 'receipt-pending',
      provider: 'resend',
      provider_event_id: svixId,
      event_type: 'email.delivered',
      payload_sha256: payloadSha256,
      status: 'received',
      attempt_count: 1,
    }], 201),
    jsonResponse([]),
    jsonResponse(null, 204),
  ]);
  const response = responseMock();

  await handleResendWebhook(request(), response, { environment, fetchImpl, nowMs });

  assert.equal(response.statusCode, 503);
  assert.equal(response.headers['retry-after'], '5');
  assert.deepEqual(JSON.parse(response.body), {
    error: 'Webhook processing deferred.',
    code: 'OUTBOX_CORRELATION_PENDING',
  });
  assert.equal(calls.length, 3);
  assert.equal(calls[1].method, 'GET');
  assert.match(calls[1].url, /notification_outbox/);
  assert.deepEqual(calls[2].body, {
    status: 'failed',
    processed_at: null,
    last_error: 'OUTBOX_CORRELATION_PENDING',
  });
}

{
  const { calls, fetchImpl } = queuedFetch([
    jsonResponse([], 201),
    jsonResponse([{
      id: 'receipt-pending',
      provider: 'resend',
      provider_event_id: svixId,
      event_type: 'email.delivered',
      payload_sha256: payloadSha256,
      status: 'failed',
      attempt_count: 1,
    }]),
    jsonResponse([{
      id: 'receipt-pending',
      status: 'received',
      attempt_count: 2,
    }]),
    jsonResponse([{
      id: 'outbox-ready',
      status: 'accepted',
      provider_message_ref: emailId,
    }]),
    jsonResponse(null, 204),
    jsonResponse(null, 204),
  ]);
  const response = responseMock();

  await handleResendWebhook(request(), response, { environment, fetchImpl, nowMs });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true, duplicate: true });
  assert.equal(calls.length, 6);
  assert.deepEqual(calls[2].body, {
    status: 'received',
    attempt_count: 2,
    last_error: null,
  });
  assert.deepEqual(calls[4].body, {
    status: 'delivered',
    delivered_at: '2026-08-20T11:59:30.000Z',
    error_code: null,
  });
  assert.deepEqual(calls[5].body, {
    status: 'processed',
    processed_at: '2026-08-20T12:00:00.000Z',
    last_error: null,
  });
}

console.log('Resend webhook outbox-correlation retry tests passed.');
