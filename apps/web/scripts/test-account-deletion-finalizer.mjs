import assert from 'node:assert/strict';
import {
  readAccountDeletionFinalizerConfig,
  runDueAccountDeletionFinalizer,
  validCronAuthorization,
} from '../src/lib/account-deletion-finalizer.js';

const accountId = '46d8a4a1-e616-4d9d-8faf-d877a42af310';
const recipientEmail = 'reader@example.com';
const deletionRequestedAt = '2026-08-20T18:00:00.000Z';
const deletionDueAt = '2026-08-27T18:00:00.000Z';
const deletedAt = '2026-08-27T18:05:00.000Z';
const environment = Object.freeze({
  VERCEL_ENV: 'preview',
  ACCOUNT_DELETION_FINALIZER_ENABLED: 'true',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
  CRON_SECRET: 'abcdefghijklmnopqrstuvwxyz0123456789',
});

function response(status, body) {
  return new Response(body == null ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

assert.deepEqual(readAccountDeletionFinalizerConfig({}), { enabled: false });
assert.throws(
  () => readAccountDeletionFinalizerConfig({
    ...environment,
    SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
  }),
  /canonical Development/,
);
assert.throws(
  () => readAccountDeletionFinalizerConfig({
    ...environment,
    VERCEL_ENV: 'production',
    SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
  }),
  /not approved/,
);

assert.equal(validCronAuthorization({ headers: {} }, environment), false);
assert.equal(
  validCronAuthorization(
    { headers: { authorization: `Bearer ${environment.CRON_SECRET}` } },
    environment,
  ),
  true,
);
assert.equal(
  validCronAuthorization({ headers: { authorization: 'Bearer wrong-secret' } }, environment),
  false,
);

const calls = [];
let outbox = null;
const fetchImpl = async (url, options = {}) => {
  const href = String(url);
  calls.push({ href, options });

  if (href.includes('/rest/v1/profiles?') && options.method === 'GET') {
    return response(200, [{
      account_id: accountId,
      email: recipientEmail,
      status: 'deletion_pending',
      deletion_requested_at: deletionRequestedAt,
      deletion_due_at: deletionDueAt,
    }]);
  }

  if (href.includes(`/auth/v1/admin/users/${accountId}`) && options.method === 'DELETE') {
    assert.match(href, /should_soft_delete=true/);
    return response(200, { id: accountId });
  }

  if (href.endsWith('/rest/v1/rpc/finalize_account_deletion') && options.method === 'POST') {
    assert.deepEqual(JSON.parse(options.body), { finalize_account_id: accountId });
    return response(200, [{
      account_id: accountId,
      recipient_email: recipientEmail,
      deletion_requested_at: deletionRequestedAt,
      deleted_at: deletedAt,
    }]);
  }

  if (href.includes('/rest/v1/notification_outbox') && options.method === 'POST') {
    const inserted = JSON.parse(options.body);
    assert.equal(inserted.message_id, 'account_deletion_completed');
    assert.equal(inserted.recipient_email_normalized, recipientEmail);
    assert.deepEqual(inserted.payload, {});
    outbox = {
      id: '9ca40ee4-6477-4fcb-88cc-bf4488dd9adc',
      ...inserted,
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
    return response(201, [outbox]);
  }

  if (href.includes('/rest/v1/notification_outbox?') && options.method === 'GET') {
    return response(200, outbox ? [outbox] : []);
  }

  if (href.includes('/rest/v1/support_requests')) {
    throw new Error('Escalation should not be created on a successful finalization.');
  }

  throw new Error(`Unexpected request: ${options.method || 'GET'} ${href}`);
};

const result = await runDueAccountDeletionFinalizer({
  environment,
  fetchImpl,
  now: new Date('2026-08-27T18:10:00.000Z'),
});
assert.deepEqual(result, {
  enabled: true,
  scanned: 1,
  finalized: 1,
  alreadyFinalized: 0,
  failed: 0,
});
assert.equal(calls.filter((call) => call.href.includes('/auth/v1/admin/users/')).length, 1);
assert.equal(calls.filter((call) => call.href.endsWith('/rpc/finalize_account_deletion')).length, 1);
assert.equal(calls.filter((call) => call.href.includes('/notification_outbox')).length >= 1, true);

const concurrentCalls = [];
const concurrentFetch = async (url, options = {}) => {
  const href = String(url);
  concurrentCalls.push({ href, options });
  if (href.includes('/rest/v1/profiles?status=eq.deletion_pending') && options.method === 'GET') {
    return response(200, [{
      account_id: accountId,
      email: recipientEmail,
      status: 'deletion_pending',
      deletion_requested_at: deletionRequestedAt,
      deletion_due_at: deletionDueAt,
    }]);
  }
  if (href.includes(`/auth/v1/admin/users/${accountId}`) && options.method === 'DELETE') {
    return response(404, { message: 'already removed' });
  }
  if (href.endsWith('/rest/v1/rpc/finalize_account_deletion') && options.method === 'POST') {
    return response(200, []);
  }
  if (href.includes(`/rest/v1/profiles?account_id=eq.${accountId}`) && options.method === 'GET') {
    return response(200, [{ account_id: accountId, status: 'deleted', deleted_at: deletedAt }]);
  }
  if (href.includes('/notification_outbox') || href.includes('/support_requests')) {
    throw new Error('Concurrent already-finalized path must not write another outbox or escalation.');
  }
  throw new Error(`Unexpected concurrent request: ${options.method || 'GET'} ${href}`);
};
const concurrent = await runDueAccountDeletionFinalizer({
  environment,
  fetchImpl: concurrentFetch,
  now: new Date('2026-08-27T18:10:00.000Z'),
});
assert.deepEqual(concurrent, {
  enabled: true,
  scanned: 1,
  finalized: 0,
  alreadyFinalized: 1,
  failed: 0,
});
assert.equal(concurrentCalls.filter((call) => call.href.includes('/support_requests')).length, 0);

let disabledFetchCalled = false;
const disabled = await runDueAccountDeletionFinalizer({
  environment: {},
  fetchImpl: async () => {
    disabledFetchCalled = true;
    throw new Error('should not run');
  },
});
assert.deepEqual(disabled, {
  enabled: false,
  scanned: 0,
  finalized: 0,
  alreadyFinalized: 0,
  failed: 0,
});
assert.equal(disabledFetchCalled, false);

console.log('Account deletion finalizer tests passed.');
