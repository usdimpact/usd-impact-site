import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ACCOUNT_DELETION_EMAIL_BUSINESS_OBJECT_TYPE,
  ACCOUNT_DELETION_EMAIL_MESSAGE_ID,
  accountDeletionStateVersion,
  createAccountDeletionRequestedEmailIntent,
  dispatchAccountDeletionRequestedEmail,
  enqueueAccountDeletionRequestedEmail,
} from '../src/lib/account-deletion-email.js';
import { LaunchEmailDispatchError } from '../src/lib/launch-email-dispatch.js';

const accountId = '46d8a4a1-e616-4d9d-8faf-d877a42af310';
const recipientEmail = 'reader@example.com';
const occurredAt = '2026-08-20T18:00:00.000Z';
const deletionDueAt = '2026-08-27T18:00:00.000Z';
const developmentEnvironment = Object.freeze({
  VERCEL_ENV: 'preview',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  LAUNCH_EMAIL_DISPATCH_ENABLED: 'true',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
});

function deletionResult(overrides = {}) {
  return {
    user: {
      id: accountId,
      email: recipientEmail,
      emailConfirmedAt: '2026-08-01T12:00:00.000Z',
      ...(overrides.user || {}),
    },
    profile: {
      account_id: accountId,
      email: recipientEmail,
      status: 'deletion_pending',
      deletion_requested_at: occurredAt,
      deletion_due_at: deletionDueAt,
      ...(overrides.profile || {}),
    },
  };
}

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

const intent = createAccountDeletionRequestedEmailIntent({
  deletionResult: deletionResult(),
});
assert.equal(intent.messageId, ACCOUNT_DELETION_EMAIL_MESSAGE_ID);
assert.equal(
  intent.outboxRecord.business_object_type,
  ACCOUNT_DELETION_EMAIL_BUSINESS_OBJECT_TYPE,
);
assert.equal(intent.outboxRecord.business_object_id, accountId);
assert.equal(intent.outboxRecord.state_version, accountDeletionStateVersion(occurredAt));
assert.equal(intent.outboxRecord.recipient_email_normalized, recipientEmail);
assert.equal(intent.outboxRecord.classification, 'transactional_operational');
assert.equal(intent.outboxRecord.consent_required, false);
assert.deepEqual(intent.outboxRecord.payload, {});
assert.doesNotMatch(intent.customerReference, new RegExp(accountId));

const duplicate = createAccountDeletionRequestedEmailIntent({
  deletionResult: deletionResult(),
});
assert.equal(
  duplicate.outboxRecord.idempotency_key,
  intent.outboxRecord.idempotency_key,
);
assert.equal(duplicate.providerIdempotencyKey, intent.providerIdempotencyKey);

const laterIntent = createAccountDeletionRequestedEmailIntent({
  deletionResult: deletionResult({
    profile: {
      deletion_requested_at: '2026-08-20T18:02:00.000Z',
      deletion_due_at: '2026-08-27T18:02:00.000Z',
    },
  }),
});
assert.notEqual(laterIntent.outboxRecord.state_version, intent.outboxRecord.state_version);
assert.notEqual(laterIntent.outboxRecord.idempotency_key, intent.outboxRecord.idempotency_key);

for (const invalid of [
  deletionResult({ user: { id: 'invalid' } }),
  deletionResult({ profile: { account_id: '31ab7b03-217b-4eac-b2d0-c17182a70dbb' } }),
  deletionResult({ profile: { email: 'other@example.com' } }),
  deletionResult({ profile: { status: 'active' } }),
  deletionResult({ profile: { deletion_requested_at: null } }),
  deletionResult({ profile: { deletion_due_at: occurredAt } }),
]) {
  assert.throws(
    () => createAccountDeletionRequestedEmailIntent({ deletionResult: invalid }),
    (error) => error instanceof Error,
  );
}

let disabledFetchCalled = false;
const disabled = await enqueueAccountDeletionRequestedEmail({
  deletionResult: deletionResult(),
  environment: {},
  fetchImpl: async () => {
    disabledFetchCalled = true;
    throw new Error('should not run');
  },
});
assert.equal(disabled.enabled, false);
assert.equal(disabledFetchCalled, false);

const ledger = createLedgerMock(persistedOutbox(intent));
const state = await enqueueAccountDeletionRequestedEmail({
  deletionResult: deletionResult(),
  environment: developmentEnvironment,
  fetchImpl: ledger.fetchImpl,
});
assert.equal(state.enabled, true);
assert.equal(state.projectRef, 'ycstrcvshdluovtuasjc');
assert.equal(ledger.calls[0].options.method, 'POST');
const inserted = JSON.parse(ledger.calls[0].options.body);
assert.equal(inserted.status, undefined);
assert.equal(inserted.attempt_count, undefined);
assert.equal(inserted.message_id, ACCOUNT_DELETION_EMAIL_MESSAGE_ID);
assert.deepEqual(inserted.payload, {});

const sentMessages = [];
const accepted = await dispatchAccountDeletionRequestedEmail({
  state,
  environment: developmentEnvironment,
  fetchImpl: ledger.fetchImpl,
  providerAdapter: {
    id: 'resend',
    async send(message) {
      sentMessages.push(message);
      return { state: 'accepted', messageRef: 'email_deletion_123' };
    },
  },
  nowMs: Date.parse(occurredAt),
});
assert.equal(accepted.action, 'accepted');
assert.equal(sentMessages.length, 1);
assert.equal(sentMessages[0].idempotencyKey, intent.providerIdempotencyKey);
assert.equal(sentMessages[0].to[0], recipientEmail);
assert.match(sentMessages[0].subject, /account deletion request/i);
assert.doesNotMatch(sentMessages[0].text, new RegExp(accountId));
assert.doesNotMatch(sentMessages[0].html, new RegExp(accountId));
assert.equal(accepted.outbox.status, 'accepted');
assert.equal(accepted.outbox.attempt_count, 1);
assert.equal(accepted.outbox.provider_message_ref, 'email_deletion_123');

let duplicateAdapterCalled = false;
const duplicateResult = await dispatchAccountDeletionRequestedEmail({
  state: { ...state, outbox: ledger.current() },
  environment: developmentEnvironment,
  fetchImpl: ledger.fetchImpl,
  providerAdapter: {
    id: 'resend',
    async send() {
      duplicateAdapterCalled = true;
      return { state: 'accepted', messageRef: 'email_duplicate_123' };
    },
  },
  nowMs: Date.parse(occurredAt) + 1_000,
});
assert.equal(duplicateResult.action, 'await_callback');
assert.equal(duplicateAdapterCalled, false);

await assert.rejects(
  () => dispatchAccountDeletionRequestedEmail({
    state: {
      ...state,
      intent: createAccountDeletionRequestedEmailIntent({
        deletionResult: deletionResult({
          user: { id: '31ab7b03-217b-4eac-b2d0-c17182a70dbb' },
          profile: { account_id: '31ab7b03-217b-4eac-b2d0-c17182a70dbb' },
        }),
      }),
    },
    environment: developmentEnvironment,
    fetchImpl: ledger.fetchImpl,
    providerAdapter: { id: 'resend', async send() { return {}; } },
  }),
  (error) => error instanceof LaunchEmailDispatchError,
);

const accountSource = await readFile(new URL('../api/account.js', import.meta.url), 'utf8');
assert.match(accountSource, /enqueueAccountDeletionRequestedEmail/);
assert.match(
  accountSource,
  /const result = await requestOwnAccountDeletion\(\{ accessToken \}\);[\s\S]*await recordAccountDeletionEmailIntent\(result\);/,
);
assert.match(accountSource, /Account deletion email intent could not be recorded\./);
assert.doesNotMatch(accountSource, /dispatchAccountDeletionRequestedEmail/);

console.log('Account deletion email integration tests passed.');
