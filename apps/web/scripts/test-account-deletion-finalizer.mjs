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
const recoveryId = '9a25b9ae-95c0-46ee-8cc6-93ed174d23cb';
const vercelConfig = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const finalizerRewrite = vercelConfig.rewrites.find((entry) => entry.source === '/api/account-deletion-finalizer');
assert.deepEqual(finalizerRewrite, {
  source: '/api/account-deletion-finalizer',
  destination: '/api/account?action=deletion-finalizer',
});
assert.equal(Object.hasOwn(vercelConfig, 'crons'), false);

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
let outbox = null;
const fetchImpl = async (url, options = {}) => {
  const href = String(url);
  calls.push({ href, options });

  if (href.includes('/rest/v1/support_requests?category=eq.privacy') && options.method === 'GET') {
    return response(200, []);
  }

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
    outbox = queuedOutbox(inserted);
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
assert.deepEqual(result, emptyRunResult({ scanned: 1, finalized: 1 }));
assert.equal(calls.filter((call) => call.href.includes('/auth/v1/admin/users/')).length, 1);
assert.equal(calls.filter((call) => call.href.endsWith('/rpc/finalize_account_deletion')).length, 1);
assert.equal(calls.filter((call) => call.href.includes('/notification_outbox')).length >= 1, true);

const concurrentCalls = [];
const concurrentFetch = async (url, options = {}) => {
  const href = String(url);
  concurrentCalls.push({ href, options });
  if (href.includes('/rest/v1/support_requests?category=eq.privacy') && options.method === 'GET') {
    return response(200, []);
  }
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
    return response(200, [{
      account_id: accountId,
      status: 'deleted',
      deletion_requested_at: deletionRequestedAt,
      deleted_at: deletedAt,
    }]);
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
assert.deepEqual(concurrent, emptyRunResult({ scanned: 1, alreadyFinalized: 1 }));

const manualEscalations = [];
const authFailureFetch = async (url, options = {}) => {
  const href = String(url);
  if (href.includes('/rest/v1/support_requests?category=eq.privacy') && options.method === 'GET') return response(200, []);
  if (href.includes('/rest/v1/profiles?status=eq.deletion_pending') && options.method === 'GET') {
    return response(200, [{
      account_id: accountId,
      email: recipientEmail,
      status: 'deletion_pending',
      deletion_requested_at: deletionRequestedAt,
      deletion_due_at: deletionDueAt,
    }]);
  }
  if (href.includes(`/auth/v1/admin/users/${accountId}`) && options.method === 'DELETE') return response(500, { error: 'auth down' });
  if (href.includes(`/rest/v1/profiles?account_id=eq.${accountId}`) && options.method === 'GET') {
    return response(200, [{ account_id: accountId, status: 'deletion_pending', deletion_requested_at: deletionRequestedAt, deleted_at: null }]);
  }
  if (href.endsWith('/rest/v1/support_requests') && options.method === 'POST') {
    const body = JSON.parse(options.body);
    manualEscalations.push(body);
    return response(201, null);
  }
  throw new Error(`Unexpected auth-failure request: ${options.method || 'GET'} ${href}`);
};
const authFailure = await runDueAccountDeletionFinalizer({
  environment,
  fetchImpl: authFailureFetch,
  now: new Date('2026-08-27T18:10:00.000Z'),
});
assert.deepEqual(authFailure, emptyRunResult({ scanned: 1, failed: 1 }));
assert.equal(manualEscalations.length, 1);
assert.equal(manualEscalations[0].account_id, null);
assert.match(manualEscalations[0].subject, /manual review/i);

const recoverableEscalations = [];
const ambiguousFinalizeFetch = async (url, options = {}) => {
  const href = String(url);
  if (href.includes('/rest/v1/support_requests?category=eq.privacy') && options.method === 'GET') return response(200, []);
  if (href.includes('/rest/v1/profiles?status=eq.deletion_pending') && options.method === 'GET') {
    return response(200, [{ account_id: accountId, email: recipientEmail, status: 'deletion_pending', deletion_requested_at: deletionRequestedAt, deletion_due_at: deletionDueAt }]);
  }
  if (href.includes(`/auth/v1/admin/users/${accountId}`) && options.method === 'DELETE') return response(200, { id: accountId });
  if (href.endsWith('/rest/v1/rpc/finalize_account_deletion') && options.method === 'POST') return response(500, { error: 'ambiguous' });
  if (href.includes(`/rest/v1/profiles?account_id=eq.${accountId}`) && options.method === 'GET') {
    return response(200, [{ account_id: accountId, status: 'deleted', deletion_requested_at: deletionRequestedAt, deleted_at: deletedAt }]);
  }
  if (href.endsWith('/rest/v1/support_requests') && options.method === 'POST') {
    const body = JSON.parse(options.body);
    recoverableEscalations.push(body);
    return response(201, null);
  }
  throw new Error(`Unexpected ambiguous-finalize request: ${options.method || 'GET'} ${href}`);
};
const ambiguousFinalize = await runDueAccountDeletionFinalizer({
  environment,
  fetchImpl: ambiguousFinalizeFetch,
  now: new Date('2026-08-27T18:10:00.000Z'),
});
assert.deepEqual(ambiguousFinalize, emptyRunResult({ scanned: 1, failed: 1 }));
assert.equal(recoverableEscalations.length, 1);
assert.equal(recoverableEscalations[0].account_id, accountId);
assert.equal(recoverableEscalations[0].email, recipientEmail);
assert.match(recoverableEscalations[0].subject, /acknowledgement requires recovery/i);

const completionFailureEscalations = [];
const completionFailureFetch = async (url, options = {}) => {
  const href = String(url);
  if (href.includes('/rest/v1/support_requests?category=eq.privacy') && options.method === 'GET') return response(200, []);
  if (href.includes('/rest/v1/profiles?status=eq.deletion_pending') && options.method === 'GET') {
    return response(200, [{ account_id: accountId, email: recipientEmail, status: 'deletion_pending', deletion_requested_at: deletionRequestedAt, deletion_due_at: deletionDueAt }]);
  }
  if (href.includes(`/auth/v1/admin/users/${accountId}`) && options.method === 'DELETE') return response(200, { id: accountId });
  if (href.endsWith('/rest/v1/rpc/finalize_account_deletion') && options.method === 'POST') {
    return response(200, [{ account_id: accountId, recipient_email: recipientEmail, deletion_requested_at: deletionRequestedAt, deleted_at: deletedAt }]);
  }
  if (href.includes('/rest/v1/notification_outbox') && options.method === 'POST') return response(500, { error: 'ledger down' });
  if (href.endsWith('/rest/v1/support_requests') && options.method === 'POST') {
    const body = JSON.parse(options.body);
    completionFailureEscalations.push(body);
    return response(201, null);
  }
  throw new Error(`Unexpected completion-failure request: ${options.method || 'GET'} ${href}`);
};
const completionFailure = await runDueAccountDeletionFinalizer({
  environment,
  fetchImpl: completionFailureFetch,
  now: new Date('2026-08-27T18:10:00.000Z'),
});
assert.deepEqual(completionFailure, emptyRunResult({ scanned: 1, failed: 1 }));
assert.equal(completionFailureEscalations[0].account_id, accountId);

let recoveryOutbox = null;
const recoveryPatches = [];
const recoveryFetch = async (url, options = {}) => {
  const href = String(url);
  if (href.includes('/rest/v1/support_requests?category=eq.privacy') && options.method === 'GET') {
    return response(200, [{ id: recoveryId, account_id: accountId, email: recipientEmail, status: 'open', created_at: deletedAt }]);
  }
  if (href.includes(`/rest/v1/profiles?account_id=eq.${accountId}`) && options.method === 'GET') {
    return response(200, [{ account_id: accountId, status: 'deleted', deletion_requested_at: deletionRequestedAt, deletion_due_at: deletionDueAt, deleted_at: deletedAt }]);
  }
  if (href.includes('/rest/v1/notification_outbox') && options.method === 'POST') {
    const inserted = JSON.parse(options.body);
    recoveryOutbox = queuedOutbox(inserted);
    return response(201, [recoveryOutbox]);
  }
  if (href.includes('/rest/v1/notification_outbox?') && options.method === 'GET') return response(200, [recoveryOutbox]);
  if (href.includes(`/rest/v1/support_requests?id=eq.${recoveryId}`) && options.method === 'PATCH') {
    const body = JSON.parse(options.body);
    recoveryPatches.push(body);
    return response(200, [{ id: recoveryId, ...body }]);
  }
  if (href.includes('/rest/v1/profiles?status=eq.deletion_pending') && options.method === 'GET') return response(200, []);
  throw new Error(`Unexpected recovery request: ${options.method || 'GET'} ${href}`);
};
const recoveryRun = await runDueAccountDeletionFinalizer({
  environment,
  fetchImpl: recoveryFetch,
  now: new Date('2026-08-27T18:10:00.000Z'),
  batchSize: 3,
});
assert.deepEqual(recoveryRun, emptyRunResult({ recoveryScanned: 1, recovered: 1 }));
assert.equal(recoveryPatches.length, 1);
assert.equal(recoveryPatches[0].account_id, null);
assert.equal(recoveryPatches[0].status, 'completed');
assert.match(recoveryPatches[0].email, /^deleted\+[0-9a-f]{32}@support\.invalid$/);

const duplicateCalls = [];
const duplicateRecovery = { id: recoveryId, account_id: accountId, email: recipientEmail, status: 'open' };
let duplicateOutbox = null;
const duplicateRecoveryFetch = async (url, options = {}) => {
  const href = String(url);
  duplicateCalls.push({ href, options });
  if (href.includes(`/rest/v1/profiles?account_id=eq.${accountId}`) && options.method === 'GET') {
    return response(200, [{ account_id: accountId, status: 'deleted', deletion_requested_at: deletionRequestedAt, deleted_at: deletedAt }]);
  }
  if (href.includes('/rest/v1/notification_outbox') && options.method === 'POST') {
    const inserted = JSON.parse(options.body);
    if (!duplicateOutbox) {
      duplicateOutbox = queuedOutbox(inserted);
      return response(201, [duplicateOutbox]);
    }
    return response(201, []);
  }
  if (href.includes('/rest/v1/notification_outbox?') && options.method === 'GET') return response(200, [duplicateOutbox]);
  if (href.includes(`/rest/v1/support_requests?id=eq.${recoveryId}`) && options.method === 'PATCH') {
    return response(200, [{ id: recoveryId, ...JSON.parse(options.body) }]);
  }
  throw new Error(`Unexpected duplicate-recovery request: ${options.method || 'GET'} ${href}`);
};
const recoveredOnce = await recoverOneDeletionCompletionAcknowledgement({
  recovery: duplicateRecovery,
  config: readAccountDeletionFinalizerConfig(environment),
  environment,
  fetchImpl: duplicateRecoveryFetch,
  now: new Date(deletedAt),
});
const recoveredTwice = await recoverOneDeletionCompletionAcknowledgement({
  recovery: duplicateRecovery,
  config: readAccountDeletionFinalizerConfig(environment),
  environment,
  fetchImpl: duplicateRecoveryFetch,
  now: new Date(deletedAt),
});
assert.equal(recoveredOnce.outboxId, recoveredTwice.outboxId);
assert.equal(duplicateCalls.filter((call) => call.href.includes('/notification_outbox?') && call.options.method === 'GET').length, 1);

const escalationFailureFetch = async (url, options = {}) => {
  const href = String(url);
  if (href.includes('/rest/v1/support_requests?category=eq.privacy') && options.method === 'GET') return response(200, []);
  if (href.includes('/rest/v1/profiles?status=eq.deletion_pending') && options.method === 'GET') {
    return response(200, [{ account_id: accountId, email: recipientEmail, status: 'deletion_pending', deletion_requested_at: deletionRequestedAt, deletion_due_at: deletionDueAt }]);
  }
  if (href.includes(`/auth/v1/admin/users/${accountId}`) && options.method === 'DELETE') return response(500, { error: 'auth down' });
  if (href.includes(`/rest/v1/profiles?account_id=eq.${accountId}`) && options.method === 'GET') return response(200, [{ account_id: accountId, status: 'deletion_pending' }]);
  if (href.endsWith('/rest/v1/support_requests') && options.method === 'POST') return response(500, { error: 'support down' });
  throw new Error(`Unexpected escalation-failure request: ${options.method || 'GET'} ${href}`);
};
const escalationFailure = await runDueAccountDeletionFinalizer({
  environment,
  fetchImpl: escalationFailureFetch,
  now: new Date('2026-08-27T18:10:00.000Z'),
});
assert.deepEqual(escalationFailure, emptyRunResult({ scanned: 1, failed: 1 }));

const limitUrls = [];
const limitFetch = async (url, options = {}) => {
  const href = String(url);
  limitUrls.push(href);
  if (options.method === 'GET') return response(200, []);
  throw new Error(`Unexpected limit request: ${options.method || 'GET'} ${href}`);
};
assert.deepEqual(
  await runDueAccountDeletionFinalizer({ environment, fetchImpl: limitFetch, batchSize: 999 }),
  emptyRunResult(),
);
assert.equal(limitUrls.some((href) => href.includes('/support_requests?') && href.includes('limit=25')), true);
assert.equal(limitUrls.some((href) => href.includes('/profiles?') && href.includes('limit=25')), true);

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
  recoveryScanned: 0,
  recovered: 0,
  recoveryFailed: 0,
  scanned: 0,
  finalized: 0,
  alreadyFinalized: 0,
  failed: 0,
});
assert.equal(disabledFetchCalled, false);

function apiResponse() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    end(body = '') {
      this.body = body ? JSON.parse(body) : null;
    },
  };
}

const envKeys = [
  'ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED',
  'ACCOUNT_DELETION_FINALIZER_ENABLED',
  'EMAIL_READINESS_LEDGER_ENABLED',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'CRON_SECRET',
  'VERCEL_ENV',
];
const priorEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const priorFetch = globalThis.fetch;
try {
  for (const key of envKeys) delete process.env[key];
  let routeFetchCalled = false;
  globalThis.fetch = async () => {
    routeFetchCalled = true;
    throw new Error('disabled route must not fetch');
  };
  const disabledRouteResponse = apiResponse();
  await accountHandler(
    { method: 'GET', url: '/api/account?action=deletion-finalizer', headers: {} },
    disabledRouteResponse,
  );
  assert.equal(disabledRouteResponse.statusCode, 404);
  assert.equal(routeFetchCalled, false);

  Object.assign(process.env, environment, { ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED: 'true' });
  const unauthorizedResponse = apiResponse();
  await accountHandler(
    { method: 'GET', url: '/api/account?action=deletion-finalizer', headers: { authorization: 'Bearer wrong' } },
    unauthorizedResponse,
  );
  assert.equal(unauthorizedResponse.statusCode, 401);
  assert.equal(routeFetchCalled, false);

  const methodResponse = apiResponse();
  await accountHandler(
    { method: 'POST', url: '/api/account?action=deletion-finalizer', headers: { authorization: `Bearer ${environment.CRON_SECRET}` } },
    methodResponse,
  );
  assert.equal(methodResponse.statusCode, 405);
  assert.equal(methodResponse.headers.allow, 'GET');
  assert.equal(routeFetchCalled, false);

  globalThis.fetch = async (url, options = {}) => {
    routeFetchCalled = true;
    const href = String(url);
    if (options.method === 'GET' && (href.includes('/support_requests?') || href.includes('/profiles?'))) {
      return response(200, []);
    }
    throw new Error(`Unexpected route request: ${options.method || 'GET'} ${href}`);
  };
  const routeResponse = apiResponse();
  await accountHandler(
    { method: 'GET', url: '/api/account?action=deletion-finalizer', headers: { authorization: `Bearer ${environment.CRON_SECRET}` } },
    routeResponse,
  );
  assert.equal(routeResponse.statusCode, 200);
  assert.equal(routeResponse.body.ok, true);
  assert.deepEqual(
    Object.fromEntries(Object.entries(routeResponse.body).filter(([key]) => key !== 'ok')),
    emptyRunResult(),
  );
  assert.equal(routeFetchCalled, true);
} finally {
  globalThis.fetch = priorFetch;
  for (const key of envKeys) {
    if (priorEnv[key] === undefined) delete process.env[key];
    else process.env[key] = priorEnv[key];
  }
}

console.log('Account deletion finalizer hardening tests passed.');
