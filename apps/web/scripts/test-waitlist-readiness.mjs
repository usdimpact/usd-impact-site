import assert from 'node:assert/strict';
import {
  WAITLIST_CONSENT_PURPOSE,
  WAITLIST_CONSENT_TEXT_VERSION,
  WAITLIST_DEVELOPMENT_PROJECT_REF,
  WAITLIST_FORM_VERSION,
  WAITLIST_PRIVACY_NOTICE_VERSION,
  WaitlistReadinessError,
  createWaitlistReadinessRecords,
  markWaitlistOutboxAccepted,
  markWaitlistOutboxRetry,
  markWaitlistOutboxSending,
  prepareWaitlistReadiness,
} from '../src/lib/waitlist-readiness.js';

const submissionId = '123e4567-e89b-42d3-a456-426614174000';
const capturedAt = '2026-08-20T12:00:00.000Z';
const email = 'Reader@Example.com';
const consentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const outboxId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const consentReference = Object.freeze({
  id: consentId,
  status: 'granted',
  purpose: WAITLIST_CONSENT_PURPOSE,
  emailNormalized: 'reader@example.com',
});

function jsonResponse(body, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function queueFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({
      url: String(url),
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : null,
      headers: options.headers || {},
    });
    if (!responses.length) throw new Error('Unexpected fetch call.');
    const next = responses.shift();
    return typeof next === 'function' ? next(calls.at(-1)) : next;
  };
  return { calls, fetchImpl };
}

const baseRecords = createWaitlistReadinessRecords({ email, submissionId, capturedAt });
assert.equal(baseRecords.submissionId, submissionId);
assert.equal(baseRecords.email, 'reader@example.com');
assert.equal(baseRecords.consentRecord.purpose, WAITLIST_CONSENT_PURPOSE);
assert.equal(baseRecords.consentRecord.status, 'granted');
assert.equal(baseRecords.consentRecord.consent_text_version, WAITLIST_CONSENT_TEXT_VERSION);
assert.equal(baseRecords.consentRecord.privacy_notice_version, WAITLIST_PRIVACY_NOTICE_VERSION);
assert.equal(baseRecords.consentRecord.evidence.context.consentCheckbox, true);
assert.equal(baseRecords.consentRecord.evidence.context.formVersion, WAITLIST_FORM_VERSION);
assert.equal(baseRecords.outboxRecord, null);
assert.equal(baseRecords.providerIdempotencyKey, `waitlist-confirmation/${submissionId}`);

const records = createWaitlistReadinessRecords({
  email,
  submissionId,
  capturedAt,
  consent: consentReference,
});
assert.equal(records.outboxRecord.message_id, 'waitlist_confirmation');
assert.equal(records.outboxRecord.classification, 'operational');
assert.equal(records.outboxRecord.consent_required, true);
assert.equal(records.outboxRecord.consent_record_id, consentId);
assert.equal(records.outboxRecord.consent_purpose, WAITLIST_CONSENT_PURPOSE);
assert.equal(records.outboxRecord.consent_checked_at, capturedAt);
assert.equal(records.outboxRecord.recipient_email_normalized, 'reader@example.com');

const retriedRecords = createWaitlistReadinessRecords({
  email,
  submissionId,
  capturedAt: '2026-08-20T12:05:00.000Z',
  consent: consentReference,
});
assert.equal(retriedRecords.consentRecord.idempotency_key, records.consentRecord.idempotency_key);
assert.equal(retriedRecords.outboxRecord.idempotency_key, records.outboxRecord.idempotency_key);
assert.equal(retriedRecords.providerIdempotencyKey, records.providerIdempotencyKey);

assert.throws(
  () => createWaitlistReadinessRecords({ email, submissionId: 'not-a-uuid', capturedAt }),
  (error) => error instanceof WaitlistReadinessError && error.code === 'INVALID_SUBMISSION_ID',
);
assert.throws(
  () => createWaitlistReadinessRecords({
    email,
    submissionId,
    capturedAt,
    consent: { ...consentReference, purpose: 'other_purpose' },
  }),
  /consent purpose is not approved/i,
);

{
  let fetchCount = 0;
  const disabled = await prepareWaitlistReadiness({
    email,
    submissionId,
    capturedAt,
    environment: {},
    fetchImpl: async () => {
      fetchCount += 1;
      return jsonResponse({});
    },
  });
  assert.deepEqual(disabled, { enabled: false });
  assert.equal(fetchCount, 0);
}

const developmentEnvironment = {
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  VERCEL_ENV: 'preview',
  SUPABASE_URL: `https://${WAITLIST_DEVELOPMENT_PROJECT_REF}.supabase.co`,
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_12345678901234567890',
  SUPABASE_SECRET_KEY: 'sb_secret_12345678901234567890',
};

{
  await assert.rejects(
    () => prepareWaitlistReadiness({
      email,
      submissionId,
      capturedAt,
      environment: {
        ...developmentEnvironment,
        SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
      },
      fetchImpl: async () => jsonResponse({}),
    }),
    (error) => error instanceof WaitlistReadinessError && error.code === 'UNEXPECTED_SUPABASE_PROJECT',
  );
}

{
  await assert.rejects(
    () => prepareWaitlistReadiness({
      email,
      submissionId,
      capturedAt,
      environment: {
        ...developmentEnvironment,
        VERCEL_ENV: 'production',
        SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
      },
      fetchImpl: async () => jsonResponse({}),
    }),
    (error) => error instanceof WaitlistReadinessError && error.code === 'PRODUCTION_LEDGER_NOT_APPROVED',
  );
}

{
  const { calls, fetchImpl } = queueFetch([
    jsonResponse([{
      id: consentId,
      idempotency_key: records.consentRecord.idempotency_key,
      email_normalized: 'reader@example.com',
      purpose: WAITLIST_CONSENT_PURPOSE,
      status: 'granted',
      captured_at: capturedAt,
    }], 201),
    jsonResponse([{
      id: outboxId,
      idempotency_key: records.outboxRecord.idempotency_key,
      message_id: 'waitlist_confirmation',
      recipient_email_normalized: 'reader@example.com',
      consent_required: true,
      consent_record_id: consentId,
      consent_purpose: WAITLIST_CONSENT_PURPOSE,
      consent_checked_at: capturedAt,
      status: 'queued',
      attempt_count: 0,
      provider_message_ref: null,
      created_at: capturedAt,
    }], 201),
  ]);

  const state = await prepareWaitlistReadiness({
    email,
    submissionId,
    capturedAt,
    environment: developmentEnvironment,
    fetchImpl,
    nowMs: Date.parse(capturedAt),
  });

  assert.equal(state.enabled, true);
  assert.equal(state.projectRef, WAITLIST_DEVELOPMENT_PROJECT_REF);
  assert.equal(state.shouldSend, true);
  assert.equal(state.consentId, consentId);
  assert.equal(state.outbox.id, outboxId);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /marketing_consent_events/);
  assert.match(calls[1].url, /notification_outbox/);
  assert.equal(calls[1].body.status, undefined);
  assert.equal(calls[1].body.attempt_count, undefined);
  assert.equal(calls[1].body.consent_required, true);
  assert.equal(calls[1].body.consent_record_id, consentId);
  assert.equal(calls[1].body.consent_purpose, WAITLIST_CONSENT_PURPOSE);
  assert.equal(calls[1].body.consent_checked_at, capturedAt);
  assert.equal(calls[0].headers.Authorization, `Bearer ${developmentEnvironment.SUPABASE_SECRET_KEY}`);

  const updates = queueFetch([
    jsonResponse([{ id: state.outbox.id, status: 'sending', attempt_count: 1 }]),
    jsonResponse([{ id: state.outbox.id, status: 'accepted', provider_message_ref: 'resend-message-id' }]),
    jsonResponse([{ id: state.outbox.id, status: 'retry_scheduled', error_code: 'RESEND_SEND_FAILED' }]),
  ]);

  await markWaitlistOutboxSending({ state, attemptedAt: capturedAt, fetchImpl: updates.fetchImpl });
  await markWaitlistOutboxAccepted({
    state,
    providerMessageRef: 'resend-message-id',
    acceptedAt: capturedAt,
    fetchImpl: updates.fetchImpl,
  });
  await markWaitlistOutboxRetry({
    state,
    retryAt: '2026-08-20T12:05:00.000Z',
    fetchImpl: updates.fetchImpl,
  });

  assert.deepEqual(updates.calls[0].body, {
    status: 'sending',
    attempt_count: 1,
    next_attempt_at: capturedAt,
    error_code: null,
  });
  assert.deepEqual(updates.calls[1].body, {
    status: 'accepted',
    provider_message_ref: 'resend-message-id',
    accepted_at: capturedAt,
    error_code: null,
  });
  assert.equal(updates.calls[2].body.status, 'retry_scheduled');
}

{
  const duplicate = queueFetch([
    jsonResponse([], 201),
    jsonResponse([{
      id: consentId,
      idempotency_key: records.consentRecord.idempotency_key,
      email_normalized: 'reader@example.com',
      purpose: WAITLIST_CONSENT_PURPOSE,
      status: 'granted',
      captured_at: capturedAt,
    }]),
    jsonResponse([], 201),
    jsonResponse([{
      id: outboxId,
      idempotency_key: records.outboxRecord.idempotency_key,
      message_id: 'waitlist_confirmation',
      recipient_email_normalized: 'reader@example.com',
      consent_required: true,
      consent_record_id: consentId,
      consent_purpose: WAITLIST_CONSENT_PURPOSE,
      consent_checked_at: capturedAt,
      status: 'accepted',
      attempt_count: 1,
      provider_message_ref: 'resend-message-id',
      accepted_at: capturedAt,
      created_at: capturedAt,
    }]),
  ]);

  const state = await prepareWaitlistReadiness({
    email,
    submissionId,
    capturedAt,
    environment: developmentEnvironment,
    fetchImpl: duplicate.fetchImpl,
    nowMs: Date.parse(capturedAt),
  });

  assert.equal(state.shouldSend, false);
  assert.equal(state.decision.action, 'complete');
  assert.equal(duplicate.calls.length, 4);
}

{
  const conflict = queueFetch([
    jsonResponse([], 201),
    jsonResponse([{
      id: consentId,
      idempotency_key: records.consentRecord.idempotency_key,
      email_normalized: 'reader@example.com',
      purpose: WAITLIST_CONSENT_PURPOSE,
      status: 'granted',
      captured_at: capturedAt,
    }]),
    jsonResponse([], 201),
    jsonResponse([{
      id: outboxId,
      idempotency_key: records.outboxRecord.idempotency_key,
      message_id: 'waitlist_confirmation',
      recipient_email_normalized: 'reader@example.com',
      consent_required: false,
      consent_record_id: null,
      consent_purpose: null,
      consent_checked_at: null,
      status: 'accepted',
      attempt_count: 1,
      provider_message_ref: 'resend-message-id',
      accepted_at: capturedAt,
      created_at: capturedAt,
    }]),
  ]);

  await assert.rejects(
    () => prepareWaitlistReadiness({
      email,
      submissionId,
      capturedAt,
      environment: developmentEnvironment,
      fetchImpl: conflict.fetchImpl,
      nowMs: Date.parse(capturedAt),
    }),
    (error) => error instanceof WaitlistReadinessError && error.code === 'OUTBOX_EVENT_CONFLICT',
  );
}

console.log('Waitlist readiness persistence tests passed.');
