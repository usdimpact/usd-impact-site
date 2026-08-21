import assert from 'node:assert/strict';
import {
  ACCOUNT_DELETION_COMPLETED_BUSINESS_OBJECT_TYPE,
  ACCOUNT_DELETION_COMPLETED_MESSAGE_ID,
  accountDeletionCompletedStateVersion,
  createAccountDeletionCompletedEmailIntent,
  dispatchAccountDeletionCompletedEmail,
  enqueueAccountDeletionCompletedEmail,
} from '../src/lib/account-deletion-completed-email.js';

const accountId = '46d8a4a1-e616-4d9d-8faf-d877a42af310';
const email = 'reader@example.com';
const requestedAt = '2026-08-20T18:00:00.000Z';
const deletedAt = '2026-08-27T18:05:00.000Z';
const environment = Object.freeze({
  VERCEL_ENV: 'preview',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  LAUNCH_EMAIL_DISPATCH_ENABLED: 'true',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
});

function finalizationResult(overrides = {}) {
  return {
    account_id: accountId,
    recipient_email: email,
    deletion_requested_at: requestedAt,
    deleted_at: deletedAt,
    ...overrides,
  };
}

function response(status, body) {
  return new Response(body == null ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const intent = createAccountDeletionCompletedEmailIntent({
  finalizationResult: finalizationResult(),
});
assert.equal(intent.messageId, ACCOUNT_DELETION_COMPLETED_MESSAGE_ID);
assert.equal(intent.outboxRecord.business_object_type, ACCOUNT_DELETION_COMPLETED_BUSINESS_OBJECT_TYPE);
assert.equal(intent.outboxRecord.business_object_id, accountId);
assert.equal(intent.outboxRecord.state_version, accountDeletionCompletedStateVersion(deletedAt));
assert.equal(intent.outboxRecord.recipient_email_normalized, email);
assert.equal(intent.outboxRecord.classification, 'transactional_operational');
assert.equal(intent.outboxRecord.consent_required, false);
assert.deepEqual(intent.outboxRecord.payload, {});
assert.doesNotMatch(intent.customerReference, new RegExp(accountId));

const duplicate = createAccountDeletionCompletedEmailIntent({
  finalizationResult: finalizationResult(),
});
assert.equal(duplicate.outboxRecord.idempotency_key, intent.outboxRecord.idempotency_key);
assert.equal(duplicate.providerIdempotencyKey, intent.providerIdempotencyKey);

for (const invalid of [
  finalizationResult({ account_id: 'invalid' }),
  finalizationResult({ recipient_email: 'invalid' }),
  finalizationResult({ deletion_requested_at: null }),
  finalizationResult({ deleted_at: '2026-08-19T18:00:00.000Z' }),
]) {
  assert.throws(
    () => createAccountDeletionCompletedEmailIntent({ finalizationResult: invalid }),
    (error) => error instanceof Error,
  );
}

let disabledFetchCalled = false;
const disabled = await enqueueAccountDeletionCompletedEmail({
  finalizationResult: finalizationResult(),
  environment: {},
  fetchImpl: async () => {
    disabledFetchCalled = true;
    throw new Error('should not run');
  },
});
assert.equal(disabled.enabled, false);
assert.equal(disabledFetchCalled, false);

let row = {
  id: '9ca40ee4-6477-4fcb-88cc-bf4488dd9adc',
  ...intent.outboxRecord,
  status: 'queued',
  attempt_count: 0,
  provider_message_ref: null,
  error_code: null,
  accepted_at: null,
  delivered_at: null,
  failed_at: null,
  created_at: deletedAt,
  updated_at: deletedAt,
};
const calls = [];
const fetchImpl = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  if (options.method === 'POST') return response(201, [row]);
  if (options.method === 'PATCH') {
    row = { ...row, ...JSON.parse(options.body), updated_at: deletedAt };
    return response(200, [row]);
  }
  if (String(url).includes('/notification_outbox?')) return response(200, [row]);
  throw new Error(`Unexpected URL: ${url}`);
};

const state = await enqueueAccountDeletionCompletedEmail({
  finalizationResult: finalizationResult(),
  environment,
  fetchImpl,
});
assert.equal(state.enabled, true);
assert.equal(calls[0].options.method, 'POST');
assert.equal(JSON.parse(calls[0].options.body).message_id, ACCOUNT_DELETION_COMPLETED_MESSAGE_ID);

const messages = [];
const accepted = await dispatchAccountDeletionCompletedEmail({
  state,
  environment,
  fetchImpl,
  providerAdapter: {
    id: 'resend',
    async send(message) {
      messages.push(message);
      return { state: 'accepted', messageRef: 'email_deletion_completed_123' };
    },
  },
  nowMs: Date.parse(deletedAt),
});
assert.equal(accepted.action, 'accepted');
assert.equal(messages.length, 1);
assert.match(messages[0].subject, /deletion is complete/i);
assert.doesNotMatch(messages[0].text, new RegExp(accountId));
assert.doesNotMatch(messages[0].html, new RegExp(accountId));
assert.equal(accepted.outbox.provider_message_ref, 'email_deletion_completed_123');

console.log('Account deletion completed email tests passed.');
