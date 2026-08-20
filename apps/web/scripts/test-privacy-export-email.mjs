import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import accountHandler from '../api/account.js';
import {
  PRIVACY_EXPORT_EMAIL_BUSINESS_OBJECT_TYPE,
  PRIVACY_EXPORT_EMAIL_MESSAGE_ID,
  createPrivacyExportAcknowledgementEmailIntent,
  dispatchPrivacyExportAcknowledgementEmail,
  enqueuePrivacyExportAcknowledgementEmail,
  privacyExportStateVersion,
} from '../src/lib/privacy-export-email.js';
import {
  LaunchEmailDispatchError,
  renderLaunchEmailDispatch,
} from '../src/lib/launch-email-dispatch.js';

const accountId = '46d8a4a1-e616-4d9d-8faf-d877a42af310';
const recipientEmail = 'reader@example.com';
const generatedAt = '2026-08-20T18:30:00.000Z';
const privateMarker = 'PRIVATE_EXPORT_PAYLOAD_MUST_NOT_ENTER_EMAIL';
const accessToken = 'access.token/value+that=is_long_enough_for_validation_12345';
const developmentEnvironment = Object.freeze({
  VERCEL_ENV: 'preview',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  LAUNCH_EMAIL_DISPATCH_ENABLED: 'true',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
});

function exportResult(overrides = {}) {
  return {
    generatedAt,
    accountId,
    data: {
      profile: { account_id: accountId },
      privateMarker,
    },
    ...overrides,
  };
}

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
    calls.push({ url, options });
    if (options.method === 'POST') return response(201, [row]);
    if (options.method === 'PATCH') {
      row = { ...row, ...JSON.parse(options.body), updated_at: generatedAt };
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

const intent = createPrivacyExportAcknowledgementEmailIntent({
  exportResult: exportResult(),
  verifiedUser: verifiedUser(),
});
assert.equal(intent.messageId, PRIVACY_EXPORT_EMAIL_MESSAGE_ID);
assert.equal(
  intent.outboxRecord.business_object_type,
  PRIVACY_EXPORT_EMAIL_BUSINESS_OBJECT_TYPE,
);
assert.equal(intent.outboxRecord.business_object_id, accountId);
assert.equal(intent.outboxRecord.state_version, privacyExportStateVersion(generatedAt));
assert.equal(intent.outboxRecord.recipient_email_normalized, recipientEmail);
assert.equal(intent.outboxRecord.classification, 'transactional_operational');
assert.equal(intent.outboxRecord.consent_required, false);
assert.equal(intent.spec.securePayloadForbidden, true);
assert.deepEqual(intent.outboxRecord.payload, {});
assert.doesNotMatch(intent.customerReference, new RegExp(accountId));
assert.doesNotMatch(JSON.stringify(intent), new RegExp(privateMarker));

const rendered = renderLaunchEmailDispatch({ intent });
assert.match(rendered.subject, /data export request/i);
assert.doesNotMatch(rendered.text, new RegExp(accountId));
assert.doesNotMatch(rendered.html, new RegExp(accountId));
assert.doesNotMatch(rendered.text, new RegExp(privateMarker));
assert.doesNotMatch(rendered.html, new RegExp(privateMarker));
assert.match(rendered.text, /No export payload/i);

const duplicate = createPrivacyExportAcknowledgementEmailIntent({
  exportResult: exportResult(),
  verifiedUser: verifiedUser(),
});
assert.equal(
  duplicate.outboxRecord.idempotency_key,
  intent.outboxRecord.idempotency_key,
);
assert.equal(duplicate.providerIdempotencyKey, intent.providerIdempotencyKey);

const sameMinute = createPrivacyExportAcknowledgementEmailIntent({
  exportResult: exportResult({ generatedAt: '2026-08-20T18:30:59.999Z' }),
  verifiedUser: verifiedUser(),
});
assert.equal(sameMinute.outboxRecord.idempotency_key, intent.outboxRecord.idempotency_key);

const laterIntent = createPrivacyExportAcknowledgementEmailIntent({
  exportResult: exportResult({ generatedAt: '2026-08-20T18:31:00.000Z' }),
  verifiedUser: verifiedUser(),
});
assert.notEqual(laterIntent.outboxRecord.state_version, intent.outboxRecord.state_version);
assert.notEqual(laterIntent.outboxRecord.idempotency_key, intent.outboxRecord.idempotency_key);

for (const invalid of [
  { exportResult: exportResult({ accountId: 'invalid' }), verifiedUser: verifiedUser() },
  {
    exportResult: exportResult(),
    verifiedUser: verifiedUser({ id: '31ab7b03-217b-4eac-b2d0-c17182a70dbb' }),
  },
  { exportResult: exportResult({ generatedAt: null }), verifiedUser: verifiedUser() },
  {
    exportResult: { generatedAt, accountId },
    verifiedUser: verifiedUser(),
  },
  {
    exportResult: exportResult(),
    verifiedUser: verifiedUser({ emailConfirmedAt: '2026-08-21T00:00:00.000Z' }),
  },
]) {
  assert.throws(
    () => createPrivacyExportAcknowledgementEmailIntent(invalid),
    (error) => error instanceof Error,
  );
}

let disabledFetchCalled = false;
const disabled = await enqueuePrivacyExportAcknowledgementEmail({
  exportResult: exportResult(),
  verifiedUser: verifiedUser(),
  environment: {},
  fetchImpl: async () => {
    disabledFetchCalled = true;
    throw new Error('should not run');
  },
});
assert.equal(disabled.enabled, false);
assert.equal(disabledFetchCalled, false);

const ledger = createLedgerMock(persistedOutbox(intent));
const state = await enqueuePrivacyExportAcknowledgementEmail({
  exportResult: exportResult(),
  verifiedUser: verifiedUser(),
  environment: developmentEnvironment,
  fetchImpl: ledger.fetchImpl,
});
assert.equal(state.enabled, true);
assert.equal(state.projectRef, 'ycstrcvshdluovtuasjc');
assert.equal(ledger.calls[0].options.method, 'POST');
const inserted = JSON.parse(ledger.calls[0].options.body);
assert.equal(inserted.status, undefined);
assert.equal(inserted.attempt_count, undefined);
assert.equal(inserted.message_id, PRIVACY_EXPORT_EMAIL_MESSAGE_ID);
assert.deepEqual(inserted.payload, {});
assert.doesNotMatch(JSON.stringify(inserted), new RegExp(privateMarker));

const sentMessages = [];
const accepted = await dispatchPrivacyExportAcknowledgementEmail({
  state,
  environment: developmentEnvironment,
  fetchImpl: ledger.fetchImpl,
  providerAdapter: {
    id: 'resend',
    async send(message) {
      sentMessages.push(message);
      return { state: 'accepted', messageRef: 'email_privacy_export_123' };
    },
  },
  nowMs: Date.parse(generatedAt),
});
assert.equal(accepted.action, 'accepted');
assert.equal(sentMessages.length, 1);
assert.equal(sentMessages[0].idempotencyKey, intent.providerIdempotencyKey);
assert.equal(sentMessages[0].to[0], recipientEmail);
assert.match(sentMessages[0].subject, /data export request/i);
assert.doesNotMatch(sentMessages[0].text, new RegExp(accountId));
assert.doesNotMatch(sentMessages[0].html, new RegExp(accountId));
assert.doesNotMatch(sentMessages[0].text, new RegExp(privateMarker));
assert.doesNotMatch(sentMessages[0].html, new RegExp(privateMarker));
assert.equal(accepted.outbox.status, 'accepted');
assert.equal(accepted.outbox.attempt_count, 1);
assert.equal(accepted.outbox.provider_message_ref, 'email_privacy_export_123');

let duplicateAdapterCalled = false;
const duplicateResult = await dispatchPrivacyExportAcknowledgementEmail({
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
  nowMs: Date.parse(generatedAt) + 1_000,
});
assert.equal(duplicateResult.action, 'await_callback');
assert.equal(duplicateAdapterCalled, false);

await assert.rejects(
  () => dispatchPrivacyExportAcknowledgementEmail({
    state: {
      ...state,
      intent: createPrivacyExportAcknowledgementEmailIntent({
        exportResult: exportResult({ accountId: '31ab7b03-217b-4eac-b2d0-c17182a70dbb' }),
        verifiedUser: verifiedUser({ id: '31ab7b03-217b-4eac-b2d0-c17182a70dbb' }),
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
    if (String(url).endsWith('/rest/v1/rpc/account_export')) {
      return response(200, { profile: { account_id: accountId }, privateMarker });
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

  const exportResponse = responseRecorder();
  await accountHandler({
    method: 'POST',
    url: '/api/account?action=export',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
    },
  }, exportResponse);

  assert.equal(exportResponse.statusCode, 200);
  assert.equal(
    exportResponse.getHeader('content-disposition'),
    'attachment; filename="usd-impact-account-export.json"',
  );
  const exportedBody = JSON.parse(exportResponse.body);
  assert.equal(exportedBody.accountId, accountId);
  assert.equal(exportedBody.data.privateMarker, privateMarker);
  const exportRpcIndex = calls.findIndex(({ url }) => url.endsWith('/rest/v1/rpc/account_export'));
  const outboxIndex = calls.findIndex(({ url }) => url.includes('/notification_outbox?on_conflict='));
  assert.ok(exportRpcIndex >= 0);
  assert.ok(outboxIndex > exportRpcIndex);
  const outboxBody = JSON.parse(calls[outboxIndex].options.body);
  assert.equal(outboxBody.message_id, PRIVACY_EXPORT_EMAIL_MESSAGE_ID);
  assert.deepEqual(outboxBody.payload, {});
  assert.doesNotMatch(JSON.stringify(outboxBody), new RegExp(privateMarker));

  const loggedErrors = [];
  console.error = (...args) => loggedErrors.push(args);
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/auth/v1/user')) return response(200, providerUser());
    if (String(url).endsWith('/rest/v1/rpc/account_export')) {
      return response(200, { profile: { account_id: accountId }, privateMarker });
    }
    if (String(url).includes('/rest/v1/notification_outbox?on_conflict=')) {
      return response(503, { error: 'controlled ledger outage' });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const failureResponse = responseRecorder();
  await accountHandler({
    method: 'POST',
    url: '/api/account?action=export',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
    },
  }, failureResponse);
  assert.equal(failureResponse.statusCode, 200);
  assert.equal(JSON.parse(failureResponse.body).data.privateMarker, privateMarker);
  assert.equal(loggedErrors.length, 1);
  assert.match(loggedErrors[0][0], /Privacy export acknowledgement email intent could not be recorded/);
  assert.doesNotMatch(JSON.stringify(loggedErrors), new RegExp(privateMarker));
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
  restoreEnvironment(envSnapshot);
}

const accountSource = await readFile(new URL('../api/account.js', import.meta.url), 'utf8');
assert.match(accountSource, /enqueuePrivacyExportAcknowledgementEmail/);
assert.match(accountSource, /getVerifiedSupabaseUser/);
assert.match(
  accountSource,
  /const exported = await exportOwnAccount\(\{ accessToken \}\);[\s\S]*await recordPrivacyExportEmailIntent\(\{ exportResult: exported, accessToken \}\);[\s\S]*return sendJson\(response, 200, exported\);/,
);
assert.match(accountSource, /Privacy export acknowledgement email intent could not be recorded\./);
assert.doesNotMatch(accountSource, /dispatchPrivacyExportAcknowledgementEmail/);

console.log('Privacy export acknowledgement email integration tests passed.');
