import assert from 'node:assert/strict';
import {
  buildProgressEmailOutboxIntentDraft,
  createProgressEmailCycleKey,
  ProgressEmailOutboxIntentError,
} from '../src/lib/progress-email-outbox-intent.js';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const GRANT_ID = '22222222-2222-4222-8222-222222222222';
const EMAIL = 'qa@example.com';
const LAST_SIGN_IN = '2026-09-04T19:00:00.000Z';
const CHECKED_AT = '2026-09-12T00:30:00.000Z';

const candidate = {
  enabled: true,
  eligible: true,
  accountId: ACCOUNT_ID,
  email: EMAIL,
  lastSignInAt: LAST_SIGN_IN,
  consentGrant: {
    id: GRANT_ID,
    idempotency_key: `consent:v1:${'a'.repeat(64)}`,
    email_normalized: EMAIL,
    user_id: ACCOUNT_ID,
    purpose: 'learning_progress_updates',
    status: 'granted',
  },
  eligibility: {
    eligible: true,
    action: 'queue_candidate',
    reason: 'eligible',
    cohort: 'inactive_7d',
    daysInactive: 7,
    meaningfulChanges: [],
  },
  payload: {
    messageId: 'learning_progress_update',
    consentPurpose: 'learning_progress_updates',
    templateVersion: 'learning-progress-email-v1',
    classification: 'marketing',
  },
};

const cycleKey = createProgressEmailCycleKey({
  accountId: ACCOUNT_ID,
  lastSignInAt: LAST_SIGN_IN,
  cohort: 'inactive_7d',
});
assert.match(cycleKey, /^[0-9a-f]{64}$/);
assert.equal(
  cycleKey,
  createProgressEmailCycleKey({
    accountId: ACCOUNT_ID,
    lastSignInAt: LAST_SIGN_IN,
    cohort: 'inactive_7d',
  }),
);
assert.notEqual(
  cycleKey,
  createProgressEmailCycleKey({
    accountId: ACCOUNT_ID,
    lastSignInAt: LAST_SIGN_IN,
    cohort: 'inactive_14d',
  }),
);

const intent = buildProgressEmailOutboxIntentDraft({
  candidate,
  consentCheckedAt: CHECKED_AT,
});
assert.match(intent.idempotency_key, /^notification:v1:[0-9a-f]{64}$/);
assert.equal(intent.message_id, 'learning_progress_update');
assert.equal(intent.classification, 'marketing');
assert.equal(intent.business_object_type, 'learning_progress_cycle');
assert.equal(intent.business_object_id, `progress-cycle:${cycleKey}`);
assert.equal(intent.template_id, 'learning_progress_email');
assert.equal(intent.template_version, 'learning-progress-email-v1');
assert.equal(intent.consent_required, true);
assert.equal(intent.consent_record_id, GRANT_ID);
assert.equal(intent.consent_purpose, 'learning_progress_updates');
assert.equal(intent.consent_checked_at, CHECKED_AT);
assert.deepEqual(intent.payload, { cohort: 'inactive_7d', cycleKey });
assert.equal(intent.status, 'queued');
assert.equal(intent.attempt_count, 0);
assert.equal(intent.next_attempt_at, CHECKED_AT);

const serializedPayload = JSON.stringify(intent.payload);
assert(!serializedPayload.includes(ACCOUNT_ID));
assert(!serializedPayload.includes(LAST_SIGN_IN));
assert(!serializedPayload.includes(EMAIL));

const repeated = buildProgressEmailOutboxIntentDraft({
  candidate,
  consentCheckedAt: CHECKED_AT,
});
assert.equal(repeated.idempotency_key, intent.idempotency_key);
assert.equal(repeated.business_object_id, intent.business_object_id);

assert.throws(
  () => buildProgressEmailOutboxIntentDraft({
    candidate: { ...candidate, eligible: false },
    consentCheckedAt: CHECKED_AT,
  }),
  (error) => error instanceof ProgressEmailOutboxIntentError
    && error.code === 'PROGRESS_EMAIL_CANDIDATE_NOT_ELIGIBLE',
);

assert.throws(
  () => buildProgressEmailOutboxIntentDraft({
    candidate: {
      ...candidate,
      consentGrant: { ...candidate.consentGrant, user_id: '33333333-3333-4333-8333-333333333333' },
    },
    consentCheckedAt: CHECKED_AT,
  }),
  (error) => error instanceof ProgressEmailOutboxIntentError
    && error.code === 'PROGRESS_EMAIL_OUTBOX_CONSENT_INVALID',
);

console.log('progress email outbox intent tests passed');
