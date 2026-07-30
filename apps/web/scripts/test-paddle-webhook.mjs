import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createPaddleWebhookHandler } from '../api/paddle-webhook.js';
import { storePaddleWebhookReceipt } from '../src/lib/paddle-supabase.js';
import {
  parsePaddleSignatureHeader,
  verifyPaddleWebhookSignature,
} from '../src/lib/paddle-webhook.js';

const secret = 'pdl_test_webhook_secret_1234567890';
const nowMs = Date.parse('2026-07-30T20:00:00.000Z');
const timestamp = Math.floor(nowMs / 1000);
const rawBody = JSON.stringify({
  event_id: 'evt_01kytwebhook00000000000001',
  event_type: 'transaction.completed',
  occurred_at: '2026-07-30T20:00:00.000Z',
  data: { id: 'txn_01kyttransaction00000000001' },
});

function signature(body = rawBody, ts = timestamp, key = secret) {
  const h1 = createHmac('sha256', key).update(`${ts}:${body}`, 'utf8').digest('hex');
  return `ts=${ts};h1=${h1}`;
}

const parsed = parsePaddleSignatureHeader(`${signature()};h1=${'0'.repeat(64)}`);
assert.equal(parsed.timestamp, timestamp);
assert.equal(parsed.signatures.length, 2);
assert.equal(
  verifyPaddleWebhookSignature({
    rawBody,
    signatureHeader: signature(),
    secret,
    nowMs,
  }).ageSeconds,
  0,
);

assert.throws(
  () => verifyPaddleWebhookSignature({
    rawBody,
    signatureHeader: signature(rawBody, timestamp, `${secret}-forged`),
    secret,
    nowMs,
  }),
  /does not match/,
);
assert.throws(
  () => verifyPaddleWebhookSignature({
    rawBody,
    signatureHeader: signature(rawBody, timestamp - 10),
    secret,
    nowMs,
  }),
  /outside the accepted tolerance/,
);

const storedEvents = [];
const handler = createPaddleWebhookHandler({
  environment: { PADDLE_WEBHOOK_SECRET: secret },
  now: () => nowMs,
  storeReceipt: async ({ event, rawBody: receivedBody }) => {
    storedEvents.push({ event, receivedBody });
    return { inserted: true, duplicate: false };
  },
});

let response = await handler(new Request('https://example.test/api/paddle-webhook', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'paddle-signature': signature(),
  },
  body: rawBody,
}));
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), {
  ok: true,
  accepted: true,
  duplicate: false,
  eventId: 'evt_01kytwebhook00000000000001',
});
assert.equal(storedEvents.length, 1);
assert.equal(storedEvents[0].receivedBody, rawBody);

response = await handler(new Request('https://example.test/api/paddle-webhook', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'paddle-signature': signature(rawBody, timestamp, `${secret}-forged`),
  },
  body: rawBody,
}));
assert.equal(response.status, 401);
assert.equal(storedEvents.length, 1);

const invalidBody = '{"event_id":';
response = await handler(new Request('https://example.test/api/paddle-webhook', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'paddle-signature': signature(invalidBody),
  },
  body: invalidBody,
}));
assert.equal(response.status, 400);
assert.equal(storedEvents.length, 1);

response = await handler(new Request('https://example.test/api/paddle-webhook'));
assert.equal(response.status, 405);
assert.equal(response.headers.get('allow'), 'POST');

const duplicateHandler = createPaddleWebhookHandler({
  environment: { PADDLE_WEBHOOK_SECRET: secret },
  now: () => nowMs,
  storeReceipt: async () => ({ inserted: false, duplicate: true }),
});
response = await duplicateHandler(new Request('https://example.test/api/paddle-webhook', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'paddle-signature': signature(),
  },
  body: rawBody,
}));
assert.equal(response.status, 200);
assert.equal((await response.json()).duplicate, true);

let receiptRequest = null;
const stored = await storePaddleWebhookReceipt({
  event: {
    eventId: 'evt_01kytwebhook00000000000001',
    eventType: 'transaction.completed',
  },
  rawBody,
  config: {
    url: 'https://project.supabase.co',
    publishableKey: 'sb_publishable_test',
    secretKey: 'sb_secret_test',
  },
  fetchImpl: async (url, options) => {
    receiptRequest = { url, options };
    return new Response(JSON.stringify([{ id: 'receipt-1' }]), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  },
});
assert.equal(stored.inserted, true);
assert.equal(stored.duplicate, false);
assert.equal(stored.receiptId, 'receipt-1');
assert.match(stored.payloadSha256, /^[a-f0-9]{64}$/);
assert.match(receiptRequest.url, /webhook_receipts\?on_conflict=provider%2Cprovider_event_id$/);
assert.equal(receiptRequest.options.headers.apikey, 'sb_secret_test');
assert.equal(receiptRequest.options.headers.Prefer, 'resolution=ignore-duplicates,return=representation');
assert.deepEqual(JSON.parse(receiptRequest.options.body), {
  provider: 'paddle',
  provider_event_id: 'evt_01kytwebhook00000000000001',
  event_type: 'transaction.completed',
  payload_sha256: stored.payloadSha256,
  status: 'received',
});

const duplicate = await storePaddleWebhookReceipt({
  event: {
    eventId: 'evt_01kytwebhook00000000000001',
    eventType: 'transaction.completed',
  },
  rawBody,
  config: {
    url: 'https://project.supabase.co',
    publishableKey: 'sb_publishable_test',
    secretKey: 'sb_secret_test',
  },
  fetchImpl: async () => new Response('[]', {
    status: 201,
    headers: { 'content-type': 'application/json' },
  }),
});
assert.equal(duplicate.inserted, false);
assert.equal(duplicate.duplicate, true);

console.log('Paddle webhook verification tests passed.');
