import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  ResendWebhookVerificationError,
  planResendOutboxTransition,
  verifyResendWebhook,
} from '../src/lib/resend-webhook.js';

const nowMs = Date.parse('2026-08-20T12:00:00.000Z');
const timestamp = String(Math.floor(nowMs / 1000));
const secretBytes = Buffer.from('usd-impact-resend-webhook-test-secret');
const secret = `whsec_${secretBytes.toString('base64')}`;
const svixId = 'msg_test_resend_delivery_001';
const emailId = '56761188-7520-42d8-8898-ff6fc54ce618';

function event(type, overrides = {}) {
  return {
    type,
    created_at: '2026-08-20T11:59:30.000Z',
    data: {
      email_id: emailId,
      from: 'USD Impact <no-reply@updates.usd-impact.com>',
      to: ['reader@example.com'],
      subject: 'Test message',
      ...overrides,
    },
  };
}

function sign(payload, id = svixId, timestampValue = timestamp) {
  return createHmac('sha256', secretBytes)
    .update(`${id}.${timestampValue}.${payload}`)
    .digest('base64');
}

function signedHeaders(payload, options = {}) {
  const id = options.id || svixId;
  const timestampValue = options.timestamp || timestamp;
  const signature = options.signature || sign(payload, id, timestampValue);
  return {
    'content-type': 'application/json',
    'svix-id': id,
    'svix-timestamp': timestampValue,
    'svix-signature': `v1,${signature}`,
  };
}

{
  const payload = JSON.stringify(event('email.delivered'));
  const verified = verifyResendWebhook({ payload, headers: signedHeaders(payload), secret, nowMs });
  assert.equal(verified.svixId, svixId);
  assert.equal(verified.event.type, 'email.delivered');
  assert.equal(verified.event.emailId, emailId);
  assert.equal(verified.event.trackedDeliveryEvent, true);
  assert.match(verified.payloadSha256, /^[0-9a-f]{64}$/);
}

{
  const payload = JSON.stringify(event('email.delivered'));
  const good = sign(payload);
  const headers = signedHeaders(payload, {
    signature: `invalid-signature`,
  });
  headers['svix-signature'] = `v0,ignored v1,${good}`;
  const verified = verifyResendWebhook({ payload, headers, secret, nowMs });
  assert.equal(verified.event.type, 'email.delivered');
}

{
  const payload = JSON.stringify(event('email.delivered'));
  assert.throws(
    () => verifyResendWebhook({
      payload,
      headers: signedHeaders(payload, { signature: 'not-valid' }),
      secret,
      nowMs,
    }),
    (error) => error instanceof ResendWebhookVerificationError && error.code === 'INVALID_WEBHOOK_SIGNATURE',
  );
}

{
  const payload = JSON.stringify(event('email.delivered'));
  const staleTimestamp = String(Math.floor(nowMs / 1000) - 301);
  assert.throws(
    () => verifyResendWebhook({
      payload,
      headers: signedHeaders(payload, { timestamp: staleTimestamp }),
      secret,
      nowMs,
    }),
    (error) => error instanceof ResendWebhookVerificationError && error.code === 'STALE_WEBHOOK',
  );
}

{
  const payload = JSON.stringify(event('email.delivered'));
  assert.throws(
    () => verifyResendWebhook({
      payload,
      headers: signedHeaders(payload),
      secret: 'not-a-webhook-secret',
      nowMs,
    }),
    (error) => error instanceof ResendWebhookVerificationError && error.code === 'INVALID_WEBHOOK_SECRET',
  );
}

{
  const payload = JSON.stringify({ type: 'domain.updated', created_at: '2026-08-20T11:59:30.000Z', data: {} });
  const verified = verifyResendWebhook({ payload, headers: signedHeaders(payload), secret, nowMs });
  assert.equal(verified.event.trackedDeliveryEvent, false);
  assert.equal(verified.event.emailId, null);
}

const createdAt = '2026-08-20T11:59:30.000Z';

assert.deepEqual(
  planResendOutboxTransition('sending', { type: 'email.sent', createdAt }),
  { apply: true, patch: { status: 'accepted', accepted_at: createdAt, error_code: null } },
);
assert.deepEqual(
  planResendOutboxTransition('accepted', { type: 'email.delivery_delayed', createdAt }),
  { apply: true, patch: { error_code: 'RESEND_DELIVERY_DELAYED' } },
);
assert.deepEqual(
  planResendOutboxTransition('accepted', { type: 'email.delivered', createdAt }),
  { apply: true, patch: { status: 'delivered', delivered_at: createdAt, error_code: null } },
);
assert.deepEqual(
  planResendOutboxTransition('delivered', { type: 'email.complained', createdAt }),
  { apply: true, patch: { status: 'complained', failed_at: createdAt, error_code: 'RESEND_COMPLAINT' } },
);
assert.deepEqual(
  planResendOutboxTransition('accepted', { type: 'email.bounced', createdAt }),
  { apply: true, patch: { status: 'hard_bounced', failed_at: createdAt, error_code: 'RESEND_HARD_BOUNCE' } },
);
assert.deepEqual(
  planResendOutboxTransition('accepted', { type: 'email.suppressed', createdAt }),
  { apply: true, patch: { status: 'suppressed', failed_at: createdAt, error_code: 'RESEND_SUPPRESSED' } },
);
assert.deepEqual(
  planResendOutboxTransition('accepted', { type: 'email.failed', createdAt }),
  { apply: true, patch: { status: 'terminal_failed', failed_at: createdAt, error_code: 'RESEND_SEND_FAILED' } },
);
assert.deepEqual(
  planResendOutboxTransition('delivered', { type: 'email.bounced', createdAt }),
  { apply: false, reason: 'terminal-or-delivered' },
);
assert.deepEqual(
  planResendOutboxTransition('complained', { type: 'email.sent', createdAt }),
  { apply: false, reason: 'would-regress' },
);

console.log('Resend webhook verification and transition contract tests passed.');
