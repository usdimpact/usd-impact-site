import assert from 'node:assert/strict';
import {
  MarketingOptInDeliveryError,
  deliverMarketingOptInConfirmation,
  resolveMarketingOptInDeliveryDecision,
} from '../src/lib/marketing-opt-in-delivery.js';
import { MarketingOptInResendRequestError } from '../src/lib/marketing-opt-in-resend-adapter.js';

const nowIso = '2026-09-11T21:00:00.000Z';
const nowMs = Date.parse(nowIso);
const requestedAt = '2026-09-11T20:55:00.000Z';
const environment = Object.freeze({
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  VERCEL_ENV: 'preview',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'p'.repeat(24)}`,
  SUPABASE_SECRET_KEY: `sb_secret_${'s'.repeat(24)}`,
  MARKETING_OPT_IN_SECRET: `moi_${'m'.repeat(43)}`,
});

const outbox = Object.freeze({
  id: '123e4567-e89b-42d3-a456-426614174010',
  idempotency_key: `notification:v1:${'a'.repeat(64)}`,
  event_id: 'marketing.opt_in.request:123e4567-e89b-42d3-a456-426614174000:weekly_newsletter',
  message_id: 'marketing_opt_in_confirmation',
  classification: 'operational',
  business_object_type: 'marketing_opt_in_request',
  business_object_id: '123e4567-e89b-42d3-a456-426614174000',
  state_version: 1,
  recipient_email_normalized: 'reader@example.com',
  template_id: 'marketing_opt_in_confirmation',
  template_version: 'marketing-opt-in-confirmation-v1',
  provider: 'resend',
  consent_required: false,
  consent_record_id: null,
  consent_purpose: null,
  consent_checked_at: null,
  payload: {
    purpose: 'weekly_newsletter',
    issuedAt: Math.floor(Date.parse(requestedAt) / 1000),
    locale: 'en',
  },
  status: 'queued',
  attempt_count: 0,
  next_attempt_at: requestedAt,
  provider_message_ref: null,
  accepted_at: null,
  created_at: requestedAt,
});

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return payload == null ? '' : JSON.stringify(payload);
    },
  };
}

function databaseHarness(initial) {
  let current = { ...initial };
  const patches = [];
  const fetchImpl = async (url, options = {}) => {
    assert.match(url, /^https:\/\/ycstrcvshdluovtuasjc\.supabase\.co\/rest\/v1\/notification_outbox\?id=eq\./);
    assert.equal(options.method, 'PATCH');
    const patch = JSON.parse(options.body);
    patches.push(patch);
    current = { ...current, ...patch };
    return response([current]);
  };
  return {
    fetchImpl,
    patches,
    current: () => current,
  };
}

assert.deepEqual(resolveMarketingOptInDeliveryDecision(outbox, nowMs), {
  action: 'send',
  reason: 'queued',
});

{
  const database = databaseHarness(outbox);
  let sentMessage = null;
  const result = await deliverMarketingOptInConfirmation({
    outbox,
    baseUrl: 'https://usd-impact-site-example.vercel.app',
    environment,
    databaseFetch: database.fetchImpl,
    now: () => new Date(nowIso),
    adapterFactory: () => ({
      async send(message) {
        sentMessage = message;
        return {
          state: 'accepted',
          messageRef: 'provider-message-1',
          occurredAt: nowIso,
        };
      },
    }),
  });

  assert.equal(result.sent, true);
  assert.equal(result.state, 'accepted');
  assert.equal(result.providerMessageRef, 'provider-message-1');
  assert.equal(sentMessage.to, outbox.recipient_email_normalized);
  assert.equal(sentMessage.idempotencyKey, `marketing-opt-in/${'a'.repeat(64)}`);
  assert.match(sentMessage.subject, /Confirm your Weekly USD Impact email/);
  assert.match(sentMessage.text, /Review and explicitly confirm|Confirm this request/i);
  assert.match(sentMessage.html, /\/email\/confirm\?token=/);
  assert.equal(database.patches.length, 2);
  assert.equal(database.patches[0].status, 'sending');
  assert.equal(database.patches[0].attempt_count, 1);
  assert.equal(database.patches[1].status, 'accepted');
  assert.equal(database.patches[1].provider_message_ref, 'provider-message-1');
}

{
  const accepted = {
    ...outbox,
    status: 'accepted',
    attempt_count: 1,
    provider_message_ref: 'provider-message-existing',
    accepted_at: nowIso,
  };
  let called = false;
  const result = await deliverMarketingOptInConfirmation({
    outbox: accepted,
    baseUrl: 'https://www.usd-impact.com',
    environment: {},
    databaseFetch: async () => {
      called = true;
      assert.fail('Completed delivery must not touch the database.');
    },
    adapterFactory: () => {
      called = true;
      assert.fail('Completed delivery must not touch Resend.');
    },
    now: () => new Date(nowIso),
  });
  assert.equal(result.sent, false);
  assert.equal(result.state, 'complete');
  assert.equal(called, false);
}

{
  await assert.rejects(
    () => deliverMarketingOptInConfirmation({
      outbox,
      baseUrl: 'https://www.usd-impact.com',
      environment: { ...environment, VERCEL_ENV: 'production' },
      databaseFetch: async () => assert.fail('Production guard must run before an outbox update.'),
      adapterFactory: () => assert.fail('Production guard must run before Resend adapter creation.'),
      now: () => new Date(nowIso),
    }),
    (error) => error instanceof MarketingOptInDeliveryError
      && error.code === 'PRODUCTION_OPT_IN_DELIVERY_BLOCKED',
  );
}

{
  const database = databaseHarness(outbox);
  await assert.rejects(
    () => deliverMarketingOptInConfirmation({
      outbox,
      baseUrl: 'https://www.usd-impact.com',
      environment,
      databaseFetch: database.fetchImpl,
      now: () => new Date(nowIso),
      adapterFactory: () => ({
        async send() {
          throw new MarketingOptInResendRequestError('rate limited', {
            code: 'RESEND_RATE_LIMITED',
            status: 429,
            providerState: 'failed',
            retryable: true,
          });
        },
      }),
    }),
    (error) => error instanceof MarketingOptInDeliveryError
      && error.code === 'RESEND_RATE_LIMITED'
      && error.status === 503,
  );
  assert.equal(database.patches.length, 2);
  assert.equal(database.patches[0].status, 'sending');
  assert.equal(database.patches[1].status, 'retry_scheduled');
  assert.equal(database.patches[1].error_code, 'RESEND_RATE_LIMITED');
}

{
  const database = databaseHarness(outbox);
  await assert.rejects(
    () => deliverMarketingOptInConfirmation({
      outbox,
      baseUrl: 'https://www.usd-impact.com',
      environment,
      databaseFetch: database.fetchImpl,
      now: () => new Date(nowIso),
      adapterFactory: () => ({
        async send() {
          throw new MarketingOptInResendRequestError('suppressed', {
            code: 'RESEND_PROVIDER_SUPPRESSED',
            status: 422,
            providerState: 'suppressed',
            retryable: false,
          });
        },
      }),
    }),
    (error) => error instanceof MarketingOptInDeliveryError
      && error.code === 'RESEND_PROVIDER_SUPPRESSED',
  );
  assert.equal(database.patches.length, 2);
  assert.equal(database.patches[1].status, 'suppressed');
}

{
  const retryFuture = {
    ...outbox,
    status: 'retry_scheduled',
    attempt_count: 1,
    next_attempt_at: new Date(nowMs + 60_000).toISOString(),
  };
  assert.deepEqual(resolveMarketingOptInDeliveryDecision(retryFuture, nowMs), {
    action: 'wait',
    reason: 'retry-not-due',
  });
}

{
  const expiredSending = {
    ...outbox,
    status: 'sending',
    attempt_count: 1,
    created_at: new Date(nowMs - (24 * 60 * 60 * 1000)).toISOString(),
  };
  assert.deepEqual(resolveMarketingOptInDeliveryDecision(expiredSending, nowMs), {
    action: 'reconcile',
    reason: 'expired-sending-window',
  });
}

console.log('Marketing opt-in delivery state-machine contract passed.');
