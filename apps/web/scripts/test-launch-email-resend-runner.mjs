import assert from 'node:assert/strict';
import {
  LAUNCH_EMAIL_DEVELOPMENT_PROJECT_REF,
  LAUNCH_EMAIL_PRODUCTION_PROJECT_REF,
  ResendLaunchEmailConfigurationError,
  createLaunchEmailDispatchIntent,
  createResendLaunchEmailAdapter,
  renderLaunchEmailDispatch,
  runLaunchEmailDispatchBatch,
} from '../src/lib/launch-email-dispatch.js';

const occurredAt = '2026-08-21T14:30:00.000Z';
const laterAt = '2026-08-21T14:30:01.000Z';
const recipientEmail = 'reader@example.com';
const fakeSecret = 're_test_abcdefghijklmnopqrstuvwxyz';
const dedicatedSender = 'USD Impact <no-reply@updates.usd-impact.com>';
const waitlistSender = 'USD Impact Waitlist <waitlist@updates.usd-impact.com>';

const developmentEnvironment = Object.freeze({
  VERCEL_ENV: 'preview',
  LAUNCH_EMAIL_DISPATCH_ENABLED: 'true',
  RESEND_API_KEY: fakeSecret,
  LAUNCH_EMAIL_FROM_EMAIL: dedicatedSender,
  LAUNCH_EMAIL_REPLY_TO: 'support@usd-impact.com',
  RESEND_FROM_EMAIL: waitlistSender,
});

function response(status, body) {
  return new Response(body == null ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function intentFor(messageId, suffix = '1') {
  const businessObjectType = messageId === 'privacy_export_acknowledgement'
    ? 'privacy_export_request'
    : 'support_case';
  return createLaunchEmailDispatchIntent({
    messageId,
    businessObjectType,
    businessObjectId: `${businessObjectType}_${suffix}`,
    stateVersion: Number(suffix) || 1,
    recipientEmail,
    occurredAt,
  });
}

function persistedOutbox(intent, overrides = {}) {
  return {
    id: `9ca40ee4-6477-4fcb-88cc-bf4488dd9ad${String(intent.outboxRecord.state_version % 10)}`,
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

function stateFor(intent, overrides = {}) {
  const outbox = overrides.outbox || persistedOutbox(intent);
  return {
    enabled: true,
    projectRef: LAUNCH_EMAIL_DEVELOPMENT_PROJECT_REF,
    config: {
      url: `https://${LAUNCH_EMAIL_DEVELOPMENT_PROJECT_REF}.supabase.co`,
      publishableKey: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
      secretKey: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
    },
    intent,
    outbox,
    ...overrides,
  };
}

function createLedgerMock(initial) {
  let row = { ...initial };
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (options.method === 'PATCH') {
      row = { ...row, ...JSON.parse(options.body), updated_at: laterAt };
      return response(200, [row]);
    }
    if (String(url).includes('/notification_outbox?')) return response(200, [row]);
    throw new Error(`Unexpected ledger URL: ${url}`);
  };
  return Object.freeze({ fetchImpl, calls, current: () => row });
}

function providerRecorder(resultFactory) {
  const calls = [];
  return Object.freeze({
    calls,
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      return resultFactory({ url: String(url), options, callNo: calls.length });
    },
  });
}

const privacyIntent = intentFor('privacy_export_acknowledgement');
const privacyMessage = renderLaunchEmailDispatch({ intent: privacyIntent });
let standaloneCalls = 0;
const standaloneAdapter = createResendLaunchEmailAdapter({
  environment: developmentEnvironment,
  fetchImpl: async (url, options) => {
    standaloneCalls += 1;
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Idempotency-Key'], privacyIntent.providerIdempotencyKey);
    const body = JSON.parse(options.body);
    assert.equal(body.from, dedicatedSender);
    assert.notEqual(body.from, waitlistSender);
    assert.equal(body.reply_to, 'support@usd-impact.com');
    assert.deepEqual(body.to, [recipientEmail]);
    return response(200, { id: 'email_adapter_accepted_1' });
  },
  now: () => new Date(occurredAt),
});
const standaloneAccepted = await standaloneAdapter.send(privacyMessage);
assert.equal(standaloneCalls, 1);
assert.equal(standaloneAccepted.state, 'accepted');
assert.equal(standaloneAccepted.messageRef, 'email_adapter_accepted_1');
assert.equal(standaloneAccepted.occurredAt, occurredAt);

await assert.rejects(
  () => standaloneAdapter.send({ ...privacyMessage, to: [recipientEmail, 'second@example.com'] }),
  /exactly one recipient/i,
);
assert.equal(standaloneCalls, 1);

assert.throws(
  () => createResendLaunchEmailAdapter({
    environment: {
      RESEND_API_KEY: fakeSecret,
      RESEND_FROM_EMAIL: waitlistSender,
    },
    fetchImpl: async () => response(200, { id: 'must_not_send' }),
  }),
  (error) => error instanceof ResendLaunchEmailConfigurationError
    && error.code === 'RESEND_SENDER_INVALID',
);

let disabledProviderCalled = false;
let disabledLedgerCalled = false;
const disabledResult = await runLaunchEmailDispatchBatch({
  tasks: [{ state: stateFor(privacyIntent) }],
  environment: {},
  ledgerFetchImpl: async () => {
    disabledLedgerCalled = true;
    throw new Error('must not reach ledger');
  },
  providerFetchImpl: async () => {
    disabledProviderCalled = true;
    throw new Error('must not reach provider');
  },
});
assert.equal(disabledResult.enabled, false);
assert.equal(disabledResult.processed, 0);
assert.equal(disabledResult.deferred, 1);
assert.equal(disabledLedgerCalled, false);
assert.equal(disabledProviderCalled, false);

const acceptedLedger = createLedgerMock(persistedOutbox(privacyIntent));
const acceptedProvider = providerRecorder(() => response(200, { id: 'email_privacy_accepted_1' }));
const acceptedResult = await runLaunchEmailDispatchBatch({
  tasks: [{ state: stateFor(privacyIntent, { outbox: acceptedLedger.current() }) }],
  environment: developmentEnvironment,
  ledgerFetchImpl: acceptedLedger.fetchImpl,
  providerFetchImpl: acceptedProvider.fetchImpl,
  providerClock: () => new Date(laterAt),
  nowMs: Date.parse(occurredAt),
});
assert.equal(acceptedResult.enabled, true);
assert.equal(acceptedResult.processed, 1);
assert.equal(acceptedResult.halted, false);
assert.equal(acceptedResult.results[0].messageId, 'privacy_export_acknowledgement');
assert.equal(acceptedResult.results[0].action, 'accepted');
assert.equal(acceptedProvider.calls.length, 1);
const acceptedBody = JSON.parse(acceptedProvider.calls[0].options.body);
assert.equal(acceptedBody.from, dedicatedSender);
assert.notEqual(acceptedBody.from, developmentEnvironment.RESEND_FROM_EMAIL);
assert.equal(acceptedLedger.current().status, 'accepted');
assert.equal(acceptedLedger.current().attempt_count, 1);
assert.equal(acceptedLedger.current().provider_message_ref, 'email_privacy_accepted_1');

let duplicateProviderCalled = false;
const duplicateResult = await runLaunchEmailDispatchBatch({
  tasks: [{
    state: stateFor(privacyIntent, { outbox: acceptedLedger.current() }),
  }],
  environment: developmentEnvironment,
  ledgerFetchImpl: acceptedLedger.fetchImpl,
  providerFetchImpl: async () => {
    duplicateProviderCalled = true;
    throw new Error('accepted outbox must not send again');
  },
  nowMs: Date.parse(laterAt),
});
assert.equal(duplicateResult.results[0].action, 'await_callback');
assert.equal(duplicateProviderCalled, false);
assert.equal(acceptedLedger.current().attempt_count, 1);

const supportIntent = intentFor('support_case_received');
const retryLedger = createLedgerMock(persistedOutbox(supportIntent));
const retryProvider = providerRecorder(() => response(429, { name: 'rate_limit_exceeded' }));
const retryResult = await runLaunchEmailDispatchBatch({
  tasks: [{ state: stateFor(supportIntent, { outbox: retryLedger.current() }) }],
  environment: developmentEnvironment,
  ledgerFetchImpl: retryLedger.fetchImpl,
  providerFetchImpl: retryProvider.fetchImpl,
  nowMs: Date.parse(occurredAt),
});
assert.equal(retryResult.results[0].action, 'retry_scheduled');
assert.equal(retryResult.halted, true);
assert.equal(retryLedger.current().status, 'retry_scheduled');
assert.equal(retryLedger.current().error_code, 'RESEND_RATE_LIMITED');
assert.equal(retryLedger.current().attempt_count, 1);

const permanentIntent = intentFor('support_case_received', '2');
const permanentLedger = createLedgerMock(persistedOutbox(permanentIntent));
const permanentProvider = providerRecorder(() => response(422, { name: 'validation_error' }));
const permanentResult = await runLaunchEmailDispatchBatch({
  tasks: [{ state: stateFor(permanentIntent, { outbox: permanentLedger.current() }) }],
  environment: developmentEnvironment,
  ledgerFetchImpl: permanentLedger.fetchImpl,
  providerFetchImpl: permanentProvider.fetchImpl,
  nowMs: Date.parse(occurredAt),
});
assert.equal(permanentResult.results[0].action, 'manual_escalation');
assert.equal(permanentResult.results[0].reason, 'provider_permanent_failure');
assert.equal(permanentLedger.current().status, 'terminal_failed');
assert.equal(permanentLedger.current().error_code, 'RESEND_VALIDATION_ERROR');
assert.equal(permanentLedger.current().attempt_count, 1);

const conflictIntent = intentFor('support_case_received', '3');
const conflictLedger = createLedgerMock(persistedOutbox(conflictIntent));
const conflictProvider = providerRecorder(() => response(409, { name: 'invalid_idempotent_request' }));
const conflictResult = await runLaunchEmailDispatchBatch({
  tasks: [{ state: stateFor(conflictIntent, { outbox: conflictLedger.current() }) }],
  environment: developmentEnvironment,
  ledgerFetchImpl: conflictLedger.fetchImpl,
  providerFetchImpl: conflictProvider.fetchImpl,
  nowMs: Date.parse(occurredAt),
});
assert.equal(conflictResult.results[0].action, 'manual_reconciliation');
assert.equal(conflictLedger.current().status, 'sending');
assert.equal(conflictLedger.current().error_code, 'PROVIDER_ACCEPTANCE_AMBIGUOUS');

const concurrentIntent = intentFor('support_case_received', '4');
const concurrentLedger = createLedgerMock(persistedOutbox(concurrentIntent));
const concurrentProvider = providerRecorder(() => response(409, { name: 'concurrent_idempotent_requests' }));
const concurrentResult = await runLaunchEmailDispatchBatch({
  tasks: [{ state: stateFor(concurrentIntent, { outbox: concurrentLedger.current() }) }],
  environment: developmentEnvironment,
  ledgerFetchImpl: concurrentLedger.fetchImpl,
  providerFetchImpl: concurrentProvider.fetchImpl,
  nowMs: Date.parse(occurredAt),
});
assert.equal(concurrentResult.results[0].action, 'retry_scheduled');
assert.equal(concurrentLedger.current().status, 'retry_scheduled');
assert.equal(concurrentLedger.current().error_code, 'RESEND_IDEMPOTENCY_IN_PROGRESS');

const suppressedIntent = intentFor('support_case_received', '5');
const suppressedLedger = createLedgerMock(persistedOutbox(suppressedIntent));
const suppressedProvider = providerRecorder(() => response(403, { name: 'provider_suppressed' }));
const suppressedResult = await runLaunchEmailDispatchBatch({
  tasks: [{ state: stateFor(suppressedIntent, { outbox: suppressedLedger.current() }) }],
  environment: developmentEnvironment,
  ledgerFetchImpl: suppressedLedger.fetchImpl,
  providerFetchImpl: suppressedProvider.fetchImpl,
  nowMs: Date.parse(occurredAt),
});
assert.equal(suppressedResult.results[0].action, 'manual_escalation');
assert.equal(suppressedLedger.current().status, 'suppressed');
assert.equal(suppressedLedger.current().error_code, 'PROVIDER_SUPPRESSED');

const ambiguousIntent = intentFor('support_case_received', '6');
const ambiguousLedger = createLedgerMock(persistedOutbox(ambiguousIntent));
const ambiguousResult = await runLaunchEmailDispatchBatch({
  tasks: [{ state: stateFor(ambiguousIntent, { outbox: ambiguousLedger.current() }) }],
  environment: developmentEnvironment,
  ledgerFetchImpl: ambiguousLedger.fetchImpl,
  providerFetchImpl: async () => {
    throw new Error('controlled network ambiguity');
  },
  nowMs: Date.parse(occurredAt),
});
assert.equal(ambiguousResult.results[0].action, 'manual_reconciliation');
assert.equal(ambiguousLedger.current().status, 'sending');
assert.equal(ambiguousLedger.current().error_code, 'PROVIDER_ACCEPTANCE_AMBIGUOUS');

const firstBoundIntent = intentFor('privacy_export_acknowledgement', '7');
const secondBoundIntent = intentFor('privacy_export_acknowledgement', '8');
const boundedLedger = createLedgerMock(persistedOutbox(firstBoundIntent));
let boundedProviderCalls = 0;
const bounded = await runLaunchEmailDispatchBatch({
  tasks: [
    { state: stateFor(firstBoundIntent, { outbox: boundedLedger.current() }) },
    { state: stateFor(secondBoundIntent) },
  ],
  maxItems: 1,
  environment: developmentEnvironment,
  ledgerFetchImpl: boundedLedger.fetchImpl,
  providerFetchImpl: async () => {
    boundedProviderCalls += 1;
    return response(200, { id: 'email_bounded_1' });
  },
  nowMs: Date.parse(occurredAt),
});
assert.equal(bounded.processed, 1);
assert.equal(bounded.deferred, 1);
assert.equal(boundedProviderCalls, 1);

await assert.rejects(
  () => runLaunchEmailDispatchBatch({
    tasks: [{
      state: {
        ...stateFor(privacyIntent),
        projectRef: LAUNCH_EMAIL_PRODUCTION_PROJECT_REF,
        config: {
          ...stateFor(privacyIntent).config,
          url: `https://${LAUNCH_EMAIL_PRODUCTION_PROJECT_REF}.supabase.co`,
        },
      },
    }],
    environment: {
      ...developmentEnvironment,
      VERCEL_ENV: 'production',
    },
    ledgerFetchImpl: async () => {
      throw new Error('Production ledger must remain untouched.');
    },
    providerFetchImpl: async () => {
      throw new Error('Production provider must remain untouched.');
    },
  }),
  (error) => error?.code === 'PRODUCTION_DISPATCH_NOT_APPROVED',
);

await assert.rejects(
  () => runLaunchEmailDispatchBatch({
    tasks: [{ state: stateFor(privacyIntent) }],
    maxItems: 6,
    environment: developmentEnvironment,
  }),
  (error) => error?.code === 'INVALID_DISPATCH_BATCH_SIZE',
);

console.log('Lifecycle Resend adapter and bounded dispatch runner tests passed.');
