import assert from 'node:assert/strict';
import {
  LaunchEmailDispatchError,
  createLaunchEmailDispatchIntent,
  dispatchEnqueuedLaunchEmail,
  enqueueLaunchEmailIntent,
} from '../src/lib/launch-email-dispatch.js';

const occurredAt = '2026-08-20T17:00:00.000Z';
const recipientEmail = 'reader@example.com';
const developmentEnvironment = Object.freeze({
  VERCEL_ENV: 'preview',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  LAUNCH_EMAIL_DISPATCH_ENABLED: 'true',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
});
const consent = Object.freeze({
  id: '784475ae-faf8-4ed3-95f7-e29d5cba3283',
  status: 'granted',
  purpose: 'book_availability',
  emailNormalized: recipientEmail,
});

function response(status, body) {
  return new Response(body == null ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function persistedOutbox(intent, overrides = {}) {
  return {
    id: '9ca40ee4-6477-4fcb-88cc-bf4488dd9adc',
    ...intent.outboxRecord,
    status: 'queued',
    attempt_count: 0,
    provider_message_ref: null,
    error_code: null,
    accepted_at: null,
    delivered_at: null,
    failed_at: null,
    created_at: occurredAt,
    updated_at: occurredAt,
    ...overrides,
  };
}

function createLedgerMock(initial) {
  let row = { ...initial };
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (options.method === 'POST') return response(201, [row]);
    if (options.method === 'PATCH') {
      row = { ...row, ...JSON.parse(options.body), updated_at: occurredAt };
      return response(200, [row]);
    }
    if (String(url).includes('/notification_outbox?')) return response(200, [row]);
    throw new Error(`Unexpected URL: ${url}`);
  };
  return Object.freeze({ fetchImpl, calls, current: () => row });
}

const accessIntent = createLaunchEmailDispatchIntent({
  messageId: 'purchase_access_ready',
  businessObjectType: 'purchase',
  businessObjectId: 'purchase_123',
  stateVersion: 1,
  recipientEmail,
  occurredAt,
});
const queued = persistedOutbox(accessIntent);

let disabledFetchCalled = false;
const disabled = await enqueueLaunchEmailIntent({
  intent: accessIntent,
  environment: {},
  fetchImpl: async () => {
    disabledFetchCalled = true;
    throw new Error('should not run');
  },
});
assert.equal(disabled.enabled, false);
assert.equal(disabledFetchCalled, false);

const ledger = createLedgerMock(queued);
const state = await enqueueLaunchEmailIntent({
  intent: accessIntent,
  environment: developmentEnvironment,
  fetchImpl: ledger.fetchImpl,
});
assert.equal(state.projectRef, 'ycstrcvshdluovtuasjc');
assert.equal(ledger.calls[0].options.method, 'POST');
const insertedBody = JSON.parse(ledger.calls[0].options.body);
assert.equal(insertedBody.status, undefined);
assert.equal(insertedBody.attempt_count, undefined);
assert.deepEqual(insertedBody.payload, {});

await assert.rejects(
  () => enqueueLaunchEmailIntent({
    intent: accessIntent,
    environment: {
      ...developmentEnvironment,
      VERCEL_ENV: 'production',
      SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
    },
    fetchImpl: ledger.fetchImpl,
  }),
  (error) => error instanceof LaunchEmailDispatchError
    && error.code === 'PRODUCTION_LEDGER_NOT_APPROVED',
);

let conflictRow = { ...queued };
let conflictAdapterCalled = false;
await assert.rejects(
  () => dispatchEnqueuedLaunchEmail({
    state: {
      ...state,
      outbox: queued,
    },
    environment: developmentEnvironment,
    fetchImpl: async (url, options = {}) => {
      if (options.method === 'PATCH') {
        conflictRow = { ...conflictRow, status: 'sending', attempt_count: 1 };
        return response(200, []);
      }
      if (String(url).includes('/notification_outbox?')) return response(200, [conflictRow]);
      throw new Error(`Unexpected URL: ${url}`);
    },
    providerAdapter: {
      id: 'resend',
      async send() {
        conflictAdapterCalled = true;
        return { state: 'accepted', messageRef: 'email_conflict_123' };
      },
    },
    nowMs: Date.parse(occurredAt),
  }),
  (error) => error instanceof LaunchEmailDispatchError && error.code === 'OUTBOX_STATE_CONFLICT',
);
assert.equal(conflictAdapterCalled, false);

const sendCalls = [];
const accepted = await dispatchEnqueuedLaunchEmail({
  state,
  environment: developmentEnvironment,
  fetchImpl: ledger.fetchImpl,
  providerAdapter: {
    id: 'resend',
    async send(message) {
      sendCalls.push(message);
      return { state: 'accepted', messageRef: 'email_accepted_123' };
    },
  },
  nowMs: Date.parse(occurredAt),
});
assert.equal(accepted.action, 'accepted');
assert.equal(sendCalls.length, 1);
assert.equal(sendCalls[0].idempotencyKey, accessIntent.providerIdempotencyKey);
assert.doesNotMatch(sendCalls[0].text, /purchase_123/);
assert.equal(accepted.outbox.status, 'accepted');
assert.equal(accepted.outbox.attempt_count, 1);
assert.equal(accepted.outbox.provider_message_ref, 'email_accepted_123');

const failedIntent = createLaunchEmailDispatchIntent({
  messageId: 'purchase_access_ready',
  businessObjectType: 'purchase',
  businessObjectId: 'purchase_456',
  stateVersion: 1,
  recipientEmail,
  occurredAt,
});
const failedLedger = createLedgerMock(persistedOutbox(failedIntent));
const failedState = await enqueueLaunchEmailIntent({
  intent: failedIntent,
  environment: developmentEnvironment,
  fetchImpl: failedLedger.fetchImpl,
});
const retry = await dispatchEnqueuedLaunchEmail({
  state: failedState,
  environment: developmentEnvironment,
  fetchImpl: failedLedger.fetchImpl,
  providerAdapter: {
    id: 'resend',
    async send() {
      const error = new Error('temporary provider failure');
      error.code = 'PROVIDER_TIMEOUT';
      error.providerState = 'failed';
      throw error;
    },
  },
  nowMs: Date.parse(occurredAt) + 1_000,
});
assert.equal(retry.action, 'retry_scheduled');
assert.equal(retry.delaySeconds, 60);
assert.equal(retry.outbox.status, 'retry_scheduled');
assert.equal(retry.outbox.error_code, 'PROVIDER_TIMEOUT');
assert.equal(retry.outbox.next_attempt_at, '2026-08-20T17:01:01.000Z');

const ambiguousIntent = createLaunchEmailDispatchIntent({
  messageId: 'support_case_received',
  businessObjectType: 'support_case',
  businessObjectId: 'case_123',
  stateVersion: 1,
  recipientEmail,
  occurredAt,
});
const ambiguousLedger = createLedgerMock(persistedOutbox(ambiguousIntent));
const ambiguousState = await enqueueLaunchEmailIntent({
  intent: ambiguousIntent,
  environment: developmentEnvironment,
  fetchImpl: ambiguousLedger.fetchImpl,
});
const ambiguous = await dispatchEnqueuedLaunchEmail({
  state: ambiguousState,
  environment: developmentEnvironment,
  fetchImpl: ambiguousLedger.fetchImpl,
  providerAdapter: { id: 'resend', async send() { return { state: 'unknown' }; } },
  nowMs: Date.parse(occurredAt),
});
assert.equal(ambiguous.action, 'manual_reconciliation');
assert.equal(ambiguous.outbox.status, 'sending');
assert.equal(ambiguous.outbox.error_code, 'PROVIDER_ACCEPTANCE_AMBIGUOUS');

const availabilityIntent = createLaunchEmailDispatchIntent({
  messageId: 'book_availability',
  businessObjectType: 'availability_notice',
  businessObjectId: 'launch_window_1',
  stateVersion: 1,
  recipientEmail,
  occurredAt,
  consent,
  consentCheckedAt: occurredAt,
});
const availabilityLedger = createLedgerMock(persistedOutbox(availabilityIntent));
const availabilityState = await enqueueLaunchEmailIntent({
  intent: availabilityIntent,
  environment: developmentEnvironment,
  fetchImpl: availabilityLedger.fetchImpl,
});
await assert.rejects(
  () => dispatchEnqueuedLaunchEmail({
    state: availabilityState,
    environment: developmentEnvironment,
    fetchImpl: availabilityLedger.fetchImpl,
    providerAdapter: { id: 'resend', async send() { return { messageRef: 'email_test_123' }; } },
    consentState: 'granted',
    nowMs: Date.parse(occurredAt),
  }),
  /unsubscribeUrl/i,
);
assert.equal(availabilityLedger.current().status, 'queued');

const withdrawn = await dispatchEnqueuedLaunchEmail({
  state: availabilityState,
  environment: developmentEnvironment,
  fetchImpl: availabilityLedger.fetchImpl,
  providerAdapter: { id: 'resend', async send() { throw new Error('must not send'); } },
  consentState: 'withdrawn',
  unsubscribeUrl: 'https://www.usd-impact.com/unsubscribe?token=test-token',
  nowMs: Date.parse(occurredAt),
});
assert.equal(withdrawn.action, 'cancelled_consent');
assert.equal(availabilityLedger.current().status, 'queued');

console.log('Launch email dispatch runtime tests passed.');
