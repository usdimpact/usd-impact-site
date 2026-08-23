import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import accountHandler from '../api/account.js';
import {
  readAccountDeletionFinalizerConfig,
  recoverOneDeletionCompletionAcknowledgement,
  runDueAccountDeletionFinalizer,
  validCronAuthorization,
} from '../src/lib/account-deletion-finalizer.js';

const accountId = '46d8a4a1-e616-4d9d-8faf-d877a42af310';
const recipientEmail = 'reader@example.com';
const deletionRequestedAt = '2026-08-20T18:00:00.000Z';
const deletionDueAt = '2026-08-27T18:00:00.000Z';
const deletedAt = '2026-08-27T18:05:00.000Z';
const vercelConfig = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const finalizerRewrite = vercelConfig.rewrites.find((entry) => entry.source === '/api/account-deletion-finalizer');
assert.deepEqual(finalizerRewrite, {
  source: '/api/account-deletion-finalizer',
  destination: '/api/account?action=deletion-finalizer',
});
const configuredCrons = Array.isArray(vercelConfig.crons) ? vercelConfig.crons : [];
assert.equal(
  configuredCrons.some((entry) => entry.path === '/api/account-deletion-finalizer'),
  false,
  'Account deletion finalizer must not be scheduled by vercel.json.',
);

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

function emptyRunResult(overrides = {}) {
  return {
    enabled: true,
    recoveryScanned: 0,
    recovered: 0,
    recoveryFailed: 0,
    scanned: 0,
    finalized: 0,
    alreadyFinalized: 0,
    failed: 0,
    ...overrides,
  };
}

function queuedOutbox(inserted, createdAt = deletedAt) {
  return {
    id: '9ca40ee4-6477-4fcb-88cc-bf4488dd9adc',
    ...inserted,
    status: 'queued',
    attempt_count: 0,
    provider_message_ref: null,
    error_code: null,
    accepted_at: null,
    delivered_at: null,
    failed_at: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
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
assert.throws(
  () => readAccountDeletionFinalizerConfig({
    ...environment,
    VERCEL_ENV: 'production',
    SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
    ACCOUNT_DELETION_FINALIZER_PRODUCTION_APPROVED: 'true',
  }),
  /durable email ledger/,
);
assert.equal(
  readAccountDeletionFinalizerConfig({
    ...environment,
    VERCEL_ENV: 'production',
    SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
    ACCOUNT_DELETION_FINALIZER_PRODUCTION_APPROVED: 'true',
    EMAIL_READINESS_PRODUCTION_APPROVED: 'true',
  }).production,
  true,
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
const fetchImpl = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  const parsed = new URL(url);

  if (parsed.pathname === '/rest/v1/profiles') {
    assert.equal(options.method, undefined);
    assert.equal(parsed.searchParams.get('status'), 'eq.deletion_pending');
    return response(200, [{
      account_id: accountId,
      email: recipientEmail,
      status: 'deletion_pending',
      deletion_requested_at: deletionRequestedAt,
      deletion_due_at: deletionDueAt,
      deleted_at: null,
    }]);
  }

  if (parsed.pathname === '/rest/v1/rpc/prepare_account_deletion_auth_removal') {
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { target_account_id: accountId });
    return response(200, [{
      account_id: accountId,
      auth_user_id: accountId,
      email: recipientEmail,
      status: 'deletion_pending',
      deletion_requested_at: deletionRequestedAt,
      deletion_due_at: deletionDueAt,
      deleted_at: null,
    }]);
  }

  if (parsed.pathname === `/auth/v1/admin/users/${accountId}`) {
    assert.equal(options.method, 'DELETE');
    return response(200, { id: accountId });
  }

  if (parsed.pathname === '/rest/v1/rpc/finalize_account_deletion') {
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { target_account_id: accountId });
    return response(200, [{
      account_id: accountId,
      email: recipientEmail,
      status: 'deleted',
      deletion_requested_at: deletionRequestedAt,
      deletion_due_at: deletionDueAt,
      deleted_at: deletedAt,
    }]);
  }

  if (parsed.pathname === '/rest/v1/notification_outbox' && options.method === 'POST') {
    const inserted = JSON.parse(options.body);
    assert.equal(inserted.message_id, 'account_deletion_completed');
    assert.equal(inserted.recipient_email_normalized, recipientEmail);
    return response(201, [queuedOutbox(inserted)]);
  }

  throw new Error(`Unexpected request: ${options.method || 'GET'} ${url}`);
};

const result = await runDueAccountDeletionFinalizer({
  environment,
  fetchImpl,
  now: new Date('2026-08-28T12:00:00.000Z'),
});
assert.deepEqual(result, emptyRunResult({ scanned: 1, finalized: 1 }));
assert.equal(calls.filter((entry) => entry.url.includes('/auth/v1/admin/users/')).length, 1);

const emptyFetchImpl = async (url, options = {}) => {
  const parsed = new URL(url);
  if (parsed.pathname === '/rest/v1/profiles' && !options.method) return response(200, []);
  throw new Error(`Unexpected request in empty finalizer run: ${options.method || 'GET'} ${url}`);
};
assert.deepEqual(
  await runDueAccountDeletionFinalizer({ environment, fetchImpl: emptyFetchImpl }),
  emptyRunResult(),
);

const recoveryFetchImpl = async (url, options = {}) => {
  const parsed = new URL(url);
  if (parsed.pathname === '/rest/v1/profiles') {
    return response(200, [{
      account_id: accountId,
      email: recipientEmail,
      status: 'deleted',
      deletion_requested_at: deletionRequestedAt,
      deletion_due_at: deletionDueAt,
      deleted_at: deletedAt,
    }]);
  }
  if (parsed.pathname === '/rest/v1/notification_outbox' && options.method === 'POST') {
    const inserted = JSON.parse(options.body);
    return response(201, [queuedOutbox(inserted)]);
  }
  throw new Error(`Unexpected recovery request: ${options.method || 'GET'} ${url}`);
};
const recovery = await recoverOneDeletionCompletionAcknowledgement({
  accountId,
  environment,
  fetchImpl: recoveryFetchImpl,
});
assert.equal(recovery.status, 'queued');
assert.equal(recovery.message_id, 'account_deletion_completed');

function createMockResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body = '') {
      this.body = body;
    },
  };
}

const previousEnvironment = {
  route: process.env.ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED,
  enabled: process.env.ACCOUNT_DELETION_FINALIZER_ENABLED,
};
try {
  delete process.env.ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED;
  delete process.env.ACCOUNT_DELETION_FINALIZER_ENABLED;
  const disabledResponse = createMockResponse();
  await accountHandler({
    method: 'GET',
    url: '/api/account?action=deletion-finalizer',
    headers: {},
  }, disabledResponse);
  assert.equal(disabledResponse.statusCode, 404);
  assert.equal(JSON.parse(disabledResponse.body).code, 'ACCOUNT_DELETION_FINALIZER_ROUTE_DISABLED');
} finally {
  if (previousEnvironment.route == null) delete process.env.ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED;
  else process.env.ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED = previousEnvironment.route;
  if (previousEnvironment.enabled == null) delete process.env.ACCOUNT_DELETION_FINALIZER_ENABLED;
  else process.env.ACCOUNT_DELETION_FINALIZER_ENABLED = previousEnvironment.enabled;
}

console.log('Account deletion finalizer tests passed.');
