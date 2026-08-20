import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import accountHandler from '../api/account.js';
import {
  SUPPORT_CASE_EMAIL_BUSINESS_OBJECT_TYPE,
  SUPPORT_CASE_EMAIL_MESSAGE_ID,
  createSupportCaseReceivedEmailIntent,
  dispatchSupportCaseReceivedEmail,
  enqueueSupportCaseReceivedEmail,
  supportCaseStateVersion,
} from '../src/lib/support-case-email.js';
import {
  SUPPORT_REQUEST_CATEGORIES,
  createOwnSupportRequest,
} from '../src/lib/support-request.js';
import {
  LaunchEmailDispatchError,
  renderLaunchEmailDispatch,
} from '../src/lib/launch-email-dispatch.js';

const accountId = '46d8a4a1-e616-4d9d-8faf-d877a42af310';
const supportRequestId = '58977502-04d8-42a3-8e9d-2e37ae82d257';
const recipientEmail = 'reader@example.com';
const createdAt = '2026-08-20T20:05:00.000Z';
const subject = 'Audiobook access is unavailable';
const message = 'The protected audiobook page returns an access error after I sign in.';
const accessToken = 'access.token/value+that=is_long_enough_for_validation_12345';
const developmentEnvironment = Object.freeze({
  VERCEL_ENV: 'preview',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  LAUNCH_EMAIL_DISPATCH_ENABLED: 'true',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
});

function verifiedUser(overrides = {}) {
  return {
    id: accountId,
    email: recipientEmail,
    emailConfirmedAt: '2026-08-01T12:00:00.000Z',
    ...overrides,
  };
}

function providerUser(overrides = {}) {
  return {
    id: accountId,
    email: recipientEmail,
    email_confirmed_at: '2026-08-01T12:00:00.000Z',
    ...overrides,
  };
}

function persistedRequest(overrides = {}) {
  return {
    id: supportRequestId,
    account_id: accountId,
    email: recipientEmail,
    category: 'access',
    status: 'open',
    created_at: createdAt,
    updated_at: createdAt,
    ...overrides,
  };
}

function supportResult(overrides = {}) {
  return {
    user: verifiedUser(),
    request: persistedRequest(),
    ...overrides,
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
    created_at: intent.occurredAt,
    updated_at: intent.occurredAt,
    ...overrides,
  };
}

function createLedgerMock(initial) {
  let row = { ...initial };
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (options.method === 'POST') return response(201, [row]);
    if (options.method === 'PATCH') {
      row = { ...row, ...JSON.parse(options.body), updated_at: createdAt };
      return response(200, [row]);
    }
    if (String(url).includes('/notification_outbox?')) return response(200, [row]);
    throw new Error(`Unexpected URL: ${url}`);
  };
  return Object.freeze({ fetchImpl, calls, current: () => row });
}

function responseRecorder() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    end(value = '') { this.body = String(value); },
  };
}

function restoreEnvironment(snapshot) {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

assert.deepEqual(SUPPORT_REQUEST_CATEGORIES, [
  'access',
  'commerce',
  'privacy',
  'security',
  'product',
  'general',
]);

const intent = createSupportCaseReceivedEmailIntent({ supportResult: supportResult() });
assert.equal(intent.messageId, SUPPORT_CASE_EMAIL_MESSAGE_ID);
assert.equal(intent.outboxRecord.business_object_type, SUPPORT_CASE_EMAIL_BUSINESS_OBJECT_TYPE);
assert.equal(intent.outboxRecord.business_object_id, supportRequestId);
assert.equal(intent.outboxRecord.state_version, supportCaseStateVersion(createdAt));
assert.equal(intent.outboxRecord.recipient_email_normalized, recipientEmail);
assert.equal(intent.outboxRecord.classification, 'operational');
assert.equal(intent.outboxRecord.consent_required, false);
assert.deepEqual(intent.outboxRecord.payload, {});
assert.doesNotMatch(intent.customerReference, new RegExp(supportRequestId));
assert.doesNotMatch(JSON.stringify(intent), new RegExp(subject));
assert.doesNotMatch(JSON.stringify(intent), new RegExp(message));

const rendered = renderLaunchEmailDispatch({ intent });
assert.match(rendered.subject, /support request/i);
assert.match(rendered.text, /do not send passwords/i);
assert.doesNotMatch(rendered.text, new RegExp(supportRequestId));
assert.doesNotMatch(rendered.html, new RegExp(supportRequestId));
assert.doesNotMatch(rendered.text, new RegExp(subject));
assert.doesNotMatch(rendered.html, new RegExp(message));

const duplicate = createSupportCaseReceivedEmailIntent({ supportResult: supportResult() });
assert.equal(duplicate.outboxRecord.idempotency_key, intent.outboxRecord.idempotency_key);
assert.equal(duplicate.providerIdempotencyKey, intent.providerIdempotencyKey);

const sameMinute = createSupportCaseReceivedEmailIntent({
  supportResult: supportResult({
    request: persistedRequest({ created_at: '2026-08-20T20:05:59.999Z' }),
  }),
});
assert.equal(sameMinute.outboxRecord.idempotency_key, intent.outboxRecord.idempotency_key);

for (const invalid of [
  supportResult({ request: persistedRequest({ id: 'invalid' }) }),
  supportResult({ request: persistedRequest({ account_id: '31ab7b03-217b-4eac-b2d0-c17182a70dbb' }) }),
  supportResult({ request: persistedRequest({ email: 'different@example.com' }) }),
  supportResult({ request: persistedRequest({ category: 'billing-secret' }) }),
  supportResult({ request: persistedRequest({ status: 'in_progress' }) }),
  supportResult({ request: persistedRequest({ created_at: null }) }),
  supportResult({ user: verifiedUser({ emailConfirmedAt: '2026-08-21T00:00:00.000Z' }) }),
]) {
  assert.throws(
    () => createSupportCaseReceivedEmailIntent({ supportResult: invalid }),
    (error) => error instanceof Error,
  );
}

const requestCalls = [];
const persisted = await createOwnSupportRequest({
  accessToken,
  category: 'ACCESS',
  subject: `  ${subject}  `,
  message: `  ${message}\r\n  `,
  environment: developmentEnvironment,
  fetchImpl: async (url, options = {}) => {
    requestCalls.push({ url: String(url), options });
    if (String(url).endsWith('/auth/v1/user')) return response(200, providerUser());
    if (String(url).includes('/rest/v1/support_requests?')) {
      return response(201, [persistedRequest()]);
    }
    throw new Error(`Unexpected URL: ${url}`);
  },
});
assert.equal(persisted.user.id, accountId);
assert.equal(persisted.request.id, supportRequestId);
assert.equal(requestCalls.length, 2);
const supportInsert = JSON.parse(requestCalls[1].options.body);
assert.deepEqual(supportInsert, {
  account_id: accountId,
  email: recipientEmail,
  category: 'access',
  subject,
  message,
});
assert.equal(requestCalls[1].options.headers.Authorization, `Bearer ${accessToken}`);
assert.equal(requestCalls[1].options.headers.Prefer, 'return=representation');

for (const invalidInput of [
  { category: 'other', subject, message },
  { category: 'access', subject: 'x', message },
  { category: 'access', subject, message: 'short' },
  { category: 'access', subject: 'line one\nline two', message },
  { category: 'access', subject, message: 'x'.repeat(5_001) },
]) {
  await assert.rejects(
    () => createOwnSupportRequest({
      accessToken,
      ...invalidInput,
      environment: developmentEnvironment,
      fetchImpl: async (url) => {
        if (String(url).endsWith('/auth/v1/user')) return response(200, providerUser());
        throw new Error('Support insert must not run for invalid input.');
      },
    }),
    (error) => error?.status === 400,
  );
}

let disabledFetchCalled = false;
const disabled = await enqueueSupportCaseReceivedEmail({
  supportResult: supportResult(),
  environment: {},
  fetchImpl: async () => {
    disabledFetchCalled = true;
    throw new Error('should not run');
  },
});
assert.equal(disabled.enabled, false);
assert.equal(disabledFetchCalled, false);

const ledger = createLedgerMock(persistedOutbox(intent));
const state = await enqueueSupportCaseReceivedEmail({
  supportResult: supportResult(),
  environment: developmentEnvironment,
  fetchImpl: ledger.fetchImpl,
});
assert.equal(state.enabled, true);
assert.equal(state.projectRef, 'ycstrcvshdluovtuasjc');
const insertedOutbox = JSON.parse(ledger.calls[0].options.body);
assert.equal(insertedOutbox.message_id, SUPPORT_CASE_EMAIL_MESSAGE_ID);
assert.deepEqual(insertedOutbox.payload, {});
assert.doesNotMatch(JSON.stringify(insertedOutbox), new RegExp(subject));
assert.doesNotMatch(JSON.stringify(insertedOutbox), new RegExp(message));

const providerMessages = [];
const accepted = await dispatchSupportCaseReceivedEmail({
  state,
  environment: developmentEnvironment,
  fetchImpl: ledger.fetchImpl,
  providerAdapter: {
    id: 'resend',
    async send(providerMessage) {
      providerMessages.push(providerMessage);
      return { state: 'accepted', messageRef: 'email_support_case_123' };
    },
  },
  nowMs: Date.parse(createdAt),
});
assert.equal(accepted.action, 'accepted');
assert.equal(providerMessages.length, 1);
assert.equal(providerMessages[0].to[0], recipientEmail);
assert.match(providerMessages[0].subject, /support request/i);
assert.doesNotMatch(providerMessages[0].text, new RegExp(subject));
assert.doesNotMatch(providerMessages[0].html, new RegExp(message));
assert.equal(accepted.outbox.status, 'accepted');
assert.equal(accepted.outbox.attempt_count, 1);

let duplicateAdapterCalled = false;
const replay = await dispatchSupportCaseReceivedEmail({
  state: { ...state, outbox: ledger.current() },
  environment: developmentEnvironment,
  fetchImpl: ledger.fetchImpl,
  providerAdapter: {
    id: 'resend',
    async send() {
      duplicateAdapterCalled = true;
      return { state: 'accepted', messageRef: 'duplicate' };
    },
  },
  nowMs: Date.parse(createdAt) + 1_000,
});
assert.equal(replay.action, 'await_callback');
assert.equal(duplicateAdapterCalled, false);

await assert.rejects(
  () => dispatchSupportCaseReceivedEmail({
    state: {
      ...state,
      intent: createSupportCaseReceivedEmailIntent({
        supportResult: supportResult({ request: persistedRequest({ id: '31ab7b03-217b-4eac-b2d0-c17182a70dbb' }) }),
      }),
    },
    environment: developmentEnvironment,
    fetchImpl: ledger.fetchImpl,
    providerAdapter: { id: 'resend', async send() { return {}; } },
  }),
  (error) => error instanceof LaunchEmailDispatchError,
);

const envSnapshot = Object.fromEntries(
  Object.keys(developmentEnvironment).map((name) => [name, process.env[name]]),
);
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
try {
  Object.assign(process.env, developmentEnvironment);
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/auth/v1/user')) return response(200, providerUser());
    if (String(url).includes('/rest/v1/support_requests?')) {
      return response(201, [persistedRequest()]);
    }
    if (String(url).includes('/rest/v1/notification_outbox?on_conflict=')) {
      const body = JSON.parse(options.body);
      return response(201, [{
        id: '4ab3989b-efb5-4f8d-90f1-262aece8dd7b',
        ...body,
        status: 'queued',
        attempt_count: 0,
        provider_message_ref: null,
        error_code: null,
        accepted_at: null,
        delivered_at: null,
        failed_at: null,
        created_at: body.next_attempt_at,
        updated_at: body.next_attempt_at,
      }]);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const supportResponse = responseRecorder();
  await accountHandler({
    method: 'POST',
    url: '/api/account?action=support',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
    },
    body: { category: 'access', subject, message },
  }, supportResponse);

  assert.equal(supportResponse.statusCode, 202);
  const supportBody = JSON.parse(supportResponse.body);
  assert.equal(supportBody.ok, true);
  assert.equal(supportBody.status, 'open');
  assert.match(supportBody.caseReference, /^ui-[a-f0-9]{16}$/);
  const supportIndex = calls.findIndex(({ url }) => url.includes('/support_requests?'));
  const outboxIndex = calls.findIndex(({ url }) => url.includes('/notification_outbox?on_conflict='));
  assert.ok(supportIndex >= 0);
  assert.ok(outboxIndex > supportIndex);
  const outboxBody = JSON.parse(calls[outboxIndex].options.body);
  assert.equal(outboxBody.message_id, SUPPORT_CASE_EMAIL_MESSAGE_ID);
  assert.deepEqual(outboxBody.payload, {});
  assert.doesNotMatch(JSON.stringify(outboxBody), new RegExp(subject));
  assert.doesNotMatch(JSON.stringify(outboxBody), new RegExp(message));

  const loggedErrors = [];
  console.error = (...args) => loggedErrors.push(args);
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/auth/v1/user')) return response(200, providerUser());
    if (String(url).includes('/rest/v1/support_requests?')) {
      return response(201, [persistedRequest()]);
    }
    if (String(url).includes('/rest/v1/notification_outbox?on_conflict=')) {
      return response(503, { error: 'controlled ledger outage' });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const outageResponse = responseRecorder();
  await accountHandler({
    method: 'POST',
    url: '/api/account?action=support',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
    },
    body: { category: 'access', subject, message },
  }, outageResponse);
  assert.equal(outageResponse.statusCode, 202);
  const outageBody = JSON.parse(outageResponse.body);
  assert.equal(outageBody.ok, true);
  assert.match(outageBody.caseReference, /^ui-[a-f0-9]{16}$/);
  assert.equal(loggedErrors.length, 1);
  assert.match(loggedErrors[0][0], /Support acknowledgement email intent could not be recorded/);
  assert.doesNotMatch(JSON.stringify(loggedErrors), new RegExp(subject));
  assert.doesNotMatch(JSON.stringify(loggedErrors), new RegExp(message));
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
  restoreEnvironment(envSnapshot);
}

const accountSource = await readFile(new URL('../api/account.js', import.meta.url), 'utf8');
assert.match(accountSource, /createOwnSupportRequest/);
assert.match(accountSource, /enqueueSupportCaseReceivedEmail/);
assert.match(accountSource, /support: handleSupport/);
assert.match(
  accountSource,
  /const result = await createOwnSupportRequest\([\s\S]*const caseReference = await recordSupportCaseEmailIntent\(result\);[\s\S]*return sendJson\(response, 202/,
);
assert.doesNotMatch(accountSource, /dispatchSupportCaseReceivedEmail/);

const vercelConfig = await readFile(new URL('../vercel.json', import.meta.url), 'utf8');
assert.match(vercelConfig, /"source": "\/api\/account-support"/);
assert.match(vercelConfig, /"destination": "\/api\/account\?action=support"/);

console.log('Support case acknowledgement integration tests passed.');
