import assert from 'node:assert/strict';
import {
  WAITLIST_CONFIRMATION_TEMPLATE_VERSION,
  WAITLIST_CONSENT_PURPOSE,
  WAITLIST_CONSENT_TEXT_VERSION,
  WAITLIST_DEVELOPMENT_PROJECT_REF,
  WAITLIST_FORM_VERSION,
  WAITLIST_PRIVACY_NOTICE_VERSION,
  createWaitlistReadinessRecords,
} from '../src/lib/waitlist-readiness.js';
import {
  WaitlistDevelopmentVerificationError,
  verifyWaitlistDevelopmentLifecycle,
} from '../src/lib/waitlist-development-verifier.js';
import { runWaitlistDevelopmentVerification } from './verify-waitlist-development.mjs';

const email = 'reader@example.com';
const submissionId = '123e4567-e89b-42d3-a456-426614174000';
const capturedAt = '2026-08-20T12:00:00.000Z';
const deliveredAt = '2026-08-20T12:01:00.000Z';
const providerMessageRef = '56761188-7520-42d8-8898-ff6fc54ce618';
const records = createWaitlistReadinessRecords({ email, submissionId, capturedAt });
const environment = {
  SUPABASE_URL: `https://${WAITLIST_DEVELOPMENT_PROJECT_REF}.supabase.co`,
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_12345678901234567890',
  SUPABASE_SECRET_KEY: 'sb_secret_12345678901234567890',
  WAITLIST_TEST_EMAIL: email,
  WAITLIST_TEST_SUBMISSION_ID: submissionId,
  WAITLIST_EXPECTED_STATE: 'delivered',
};

function consentRow(overrides = {}) {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    idempotency_key: records.consentRecord.idempotency_key,
    source_event_id: records.consentRecord.source_event_id,
    email_normalized: email,
    purpose: WAITLIST_CONSENT_PURPOSE,
    status: 'granted',
    consent_text_version: WAITLIST_CONSENT_TEXT_VERSION,
    privacy_notice_version: WAITLIST_PRIVACY_NOTICE_VERSION,
    source: 'waitlist_form',
    captured_at: capturedAt,
    evidence: {
      purpose: WAITLIST_CONSENT_PURPOSE,
      status: 'granted',
      consent_text_version: WAITLIST_CONSENT_TEXT_VERSION,
      privacy_notice_version: WAITLIST_PRIVACY_NOTICE_VERSION,
      source: 'waitlist_form',
      source_event_id: records.consentRecord.source_event_id,
      captured_at: capturedAt,
      withdrawn_at: null,
      withdrawal_source: null,
      context: {
        consentCheckbox: true,
        formVersion: WAITLIST_FORM_VERSION,
      },
    },
    evidence_checksum: 'a'.repeat(64),
    created_at: capturedAt,
    ...overrides,
  };
}

function outboxRow(overrides = {}) {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    idempotency_key: records.outboxRecord.idempotency_key,
    event_id: records.outboxRecord.event_id,
    message_id: 'waitlist_confirmation',
    classification: 'operational',
    business_object_type: 'waitlist_submission',
    business_object_id: submissionId,
    state_version: 1,
    recipient_email_normalized: email,
    template_id: 'waitlist_confirmation',
    template_version: WAITLIST_CONFIRMATION_TEMPLATE_VERSION,
    provider: 'resend',
    consent_required: false,
    consent_record_id: null,
    consent_purpose: null,
    consent_checked_at: null,
    payload: {},
    status: 'delivered',
    attempt_count: 1,
    provider_message_ref: providerMessageRef,
    error_code: null,
    accepted_at: capturedAt,
    delivered_at: deliveredAt,
    failed_at: null,
    created_at: capturedAt,
    updated_at: deliveredAt,
    ...overrides,
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function verifierFetch(consentRows, outboxRows) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({
      url: String(url),
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body,
    });
    if (String(url).includes('/marketing_consent_events?')) {
      return jsonResponse(consentRows);
    }
    if (String(url).includes('/notification_outbox?')) {
      return jsonResponse(outboxRows);
    }
    throw new Error(`Unexpected verifier URL: ${String(url)}`);
  };
  return { calls, fetchImpl };
}

async function expectVerifierError(operation, expectedCode) {
  await assert.rejects(operation, (error) => {
    assert.ok(error instanceof WaitlistDevelopmentVerificationError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

{
  const { calls, fetchImpl } = verifierFetch([consentRow()], [outboxRow()]);
  const result = await verifyWaitlistDevelopmentLifecycle({
    email,
    submissionId,
    expectedState: 'delivered',
    environment,
    fetchImpl,
  });

  assert.equal(result.verified, true);
  assert.equal(result.projectRef, WAITLIST_DEVELOPMENT_PROJECT_REF);
  assert.equal(result.email, 're****@example.com');
  assert.equal(result.observedState, 'delivered');
  assert.equal(result.delivery.attemptCount, 1);
  assert.match(result.delivery.providerReferenceFingerprint, /^[0-9a-f]{16}$/);
  assert.equal(JSON.stringify(result).includes(providerMessageRef), false);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.method, 'GET');
    assert.equal(call.body, undefined);
    assert.equal(call.headers.apikey, environment.SUPABASE_SECRET_KEY);
    assert.equal(call.headers.Authorization, `Bearer ${environment.SUPABASE_SECRET_KEY}`);
  }
}

{
  const { fetchImpl } = verifierFetch(
    [consentRow()],
    [outboxRow({ status: 'accepted', delivered_at: null })],
  );
  const result = await verifyWaitlistDevelopmentLifecycle({
    email,
    submissionId,
    expectedState: 'accepted',
    environment,
    fetchImpl,
  });
  assert.equal(result.verified, true);
  assert.equal(result.observedState, 'accepted');
}

{
  let fetchCalls = 0;
  await expectVerifierError(
    () => verifyWaitlistDevelopmentLifecycle({
      email,
      submissionId,
      environment: {
        ...environment,
        SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
      },
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error('Fetch must not run for an invalid target.');
      },
    }),
    'UNEXPECTED_SUPABASE_PROJECT',
  );
  assert.equal(fetchCalls, 0);
}

{
  const { fetchImpl } = verifierFetch([consentRow(), consentRow()], [outboxRow()]);
  await expectVerifierError(
    () => verifyWaitlistDevelopmentLifecycle({
      email,
      submissionId,
      environment,
      fetchImpl,
    }),
    'DUPLICATE_CONSENT_EVIDENCE',
  );
}

{
  const { fetchImpl } = verifierFetch(
    [consentRow()],
    [outboxRow({ provider_message_ref: null })],
  );
  await expectVerifierError(
    () => verifyWaitlistDevelopmentLifecycle({
      email,
      submissionId,
      environment,
      fetchImpl,
    }),
    'PROVIDER_CORRELATION_MISSING',
  );
}

{
  const { fetchImpl } = verifierFetch(
    [consentRow()],
    [outboxRow({ status: 'retry_scheduled', delivered_at: null })],
  );
  await expectVerifierError(
    () => verifyWaitlistDevelopmentLifecycle({
      email,
      submissionId,
      environment,
      fetchImpl,
    }),
    'OUTBOX_STATE_NOT_VERIFIED',
  );
}

{
  const { fetchImpl } = verifierFetch(
    [consentRow({ purpose: 'different_purpose' })],
    [outboxRow()],
  );
  await expectVerifierError(
    () => verifyWaitlistDevelopmentLifecycle({
      email,
      submissionId,
      environment,
      fetchImpl,
    }),
    'CONSENT_EVIDENCE_MISMATCH',
  );
}

{
  const { fetchImpl } = verifierFetch([consentRow()], [outboxRow()]);
  const output = [];
  const result = await runWaitlistDevelopmentVerification({
    environment,
    fetchImpl,
    write: (value) => output.push(value),
  });
  assert.equal(result.verified, true);
  assert.equal(output.length, 1);
  assert.equal(output[0].includes(providerMessageRef), false);
  assert.equal(output[0].includes(environment.SUPABASE_SECRET_KEY), false);
}

console.log('Waitlist Development verifier tests passed.');
