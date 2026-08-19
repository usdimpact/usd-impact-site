import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { handleResendWebhook } from '../api/resend-webhook.js';

const nowMs = Date.parse('2026-08-20T12:00:00.000Z');
const timestamp = String(Math.floor(nowMs / 1000));
const secretBytes = Buffer.from('usd-impact-resend-webhook-test-secret');
const webhookSecret = `whsec_${secretBytes.toString('base64')}`;
const emailId = '56761188-7520-42d8-8898-ff6fc54ce618';
const svixId = 'msg_test_handler_001';
const environment = {
  RESEND_WEBHOOK_ENABLED: 'true',
  RESEND_WEBHOOK_SECRET: webhookSecret,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_12345678901234567890',
  SUPABASE_SECRET_KEY: 'sb_secret_12345678901234567890',
};

function event(type = 'email.delivered') {
  return {
    type,
    created_at: '2026-08-20T11:59:30.000Z',
    data: {
      email_id: emailId,
      from: 'USD Impact <no-reply@updates.usd-impact.com>',
      to: ['reader@example.com'],
      subject: 'Test message',
    },
  };
}

function sign(payload, id = svixId, timestampValue = timestamp) {
  return createHmac('sha256', secretBytes)
    .update(`${id}.${timestampValue}.${payload}`)
    .digest('base64');
}

function requestFor(payload, options = {}) {
  const request = Readable.from([payload]);
  request.method = options.method || 'POST';
  const id = options.id || svixId;
  const timestampValue = options.timestamp || timestamp;
  request.headers = {
    'content-type': options.contentType || 'application/json',
    'svix-id': id,
    'svix-timestamp': timestampValue,
    'svix-signature': `v1,${options.signature || sign(payload, id, timestampValue)}`,
  };
  return request;
}

function responseMock() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
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
      headers: options.headers || {},
      body: options.body ? JSON.parse(options.body) : null,
    });
    if (!responses.length) throw new Error('Unexpected fetch call.');
    const next = responses.shift();
    return typeof next === 'function' ? next(calls.at(-1)) : next;
  };
  return { calls, fetchImpl };
}

{
  const payload = JSON.stringify(event('email.delivered'));
  const payloadSha256 = createHash('sha256').update(payload).digest('hex');
  const { calls, fetchImpl } = queuedFetch([
    jsonResponse([{
      id: 'receipt-1',
      provider: 'resend',
      provider_event_id: svixId,
      event_type: 'email.delivered',
      payload_sha256: payloadSha256,
      status: 'received',
      attempt_count: 1,
    }], 201),
    jsonResponse([{ id: 'outbox-1', status: 'accepted', provider_message_ref: emailId }]),
    jsonResponse(null, 204),
    jsonResponse(null, 204),
  ]);
  const response = responseMock();
  await handleResendWebhook(requestFor(payload), response, { environment, fetchImpl, nowMs });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true, duplicate: false });
  assert.equal(calls.length, 4);
  assert.match(calls[0].url, /webhook_receipts\?on_conflict=/);
  assert.equal(calls[0].body.provider, 'resend');
  assert.equal(calls[0].body.provider_event_id, svixId);
  assert.equal(calls[0].body.payload_sha256, payloadSha256);
  assert.equal(calls[1].method, 'GET');
  assert.match(calls[1].url, /notification_outbox/);
  assert.equal(calls[2].method, 'PATCH');
  assert.deepEqual(calls[2].body, {
    status: 'delivered',
    delivered_at: '2026-08-20T11:59:30.000Z',
    error_code: null,
  });
  assert.equal(calls[3].body.status, 'processed');
}

{
  const payload = JSON.stringify(event('email.delivered'));
  const payloadSha256 = createHash('sha256').update(payload).digest('hex');
  const { calls, fetchImpl } = queuedFetch([
    jsonResponse([], 201),
    jsonResponse([{
      id: 'receipt-duplicate',
      provider: 'resend',
      provider_event_id: svixId,
      event_type: 'email.delivered',
      payload_sha256: payloadSha256,
      status: 'processed',
      attempt_count: 1,
    }]),
  ]);
  const response = responseMock();
  await handleResendWebhook(requestFor(payload), response, { environment, fetchImpl, nowMs });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true, duplicate: true });
  assert.equal(calls.length, 2);
}

{
  const payload = JSON.stringify(event('email.delivered'));
  const { calls, fetchImpl } = queuedFetch([]);
  const response = responseMock();
  await handleResendWebhook(
    requestFor(payload, { signature: 'invalid' }),
    response,
    { environment, fetchImpl, nowMs },
  );

  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body).code, 'INVALID_WEBHOOK_SIGNATURE');
  assert.equal(calls.length, 0);
}

{
  const payload = JSON.stringify(event('email.delivered'));
  const { calls, fetchImpl } = queuedFetch([]);
  const response = responseMock();
  await handleResendWebhook(
    requestFor(payload),
    response,
    { environment: { ...environment, RESEND_WEBHOOK_ENABLED: 'false' }, fetchImpl, nowMs },
  );

  assert.equal(response.statusCode, 404);
  assert.equal(calls.length, 0);
}

{
  const untrackedPayload = JSON.stringify({
    type: 'contact.updated',
    created_at: '2026-08-20T11:59:30.000Z',
    data: { id: 'contact_123' },
  });
  const payloadSha256 = createHash('sha256').update(untrackedPayload).digest('hex');
  const { calls, fetchImpl } = queuedFetch([
    jsonResponse([{
      id: 'receipt-untracked',
      provider: 'resend',
      provider_event_id: svixId,
      event_type: 'contact.updated',
      payload_sha256: payloadSha256,
      status: 'received',
      attempt_count: 1,
    }], 201),
    jsonResponse(null, 204),
  ]);
  const response = responseMock();
  await handleResendWebhook(requestFor(untrackedPayload), response, { environment, fetchImpl, nowMs });

  assert.equal(response.statusCode, 200);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.status, 'ignored');
}

{
  const payload = JSON.stringify(event('email.bounced'));
  const payloadSha256 = createHash('sha256').update(payload).digest('hex');
  const { calls, fetchImpl } = queuedFetch([
    jsonResponse([{
      id: 'receipt-failure',
      provider: 'resend',
      provider_event_id: svixId,
      event_type: 'email.bounced',
      payload_sha256: payloadSha256,
      status: 'received',
      attempt_count: 1,
    }], 201),
    jsonResponse({ message: 'temporary database failure' }, 503),
    jsonResponse(null, 204),
  ]);
  const response = responseMock();
  await handleResendWebhook(requestFor(payload), response, { environment, fetchImpl, nowMs });

  assert.equal(response.statusCode, 500);
  assert.equal(JSON.parse(response.body).code, 'WEBHOOK_STATE_REQUEST_FAILED');
  assert.equal(calls.at(-1).body.status, 'failed');
  assert.equal(calls.at(-1).body.last_error, 'WEBHOOK_STATE_REQUEST_FAILED');
}

console.log('Resend webhook handler tests passed.');
