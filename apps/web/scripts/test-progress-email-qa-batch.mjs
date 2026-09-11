import assert from 'node:assert/strict';
import {
  ProgressEmailQaBatchError,
  runProgressEmailQaBatch,
} from '../src/lib/progress-email-qa-batch.js';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const GRANT_ID = '22222222-2222-4222-8222-222222222222';
const ACCEPTED_EMAIL = 'accepted@example.com';
const SKIPPED_EMAIL = 'skipped@example.com';
const environment = Object.freeze({
  VERCEL_ENV: 'preview',
  PROGRESS_EMAIL_QA_BATCH_ENABLED: 'true',
  PROGRESS_EMAIL_QA_RECIPIENTS: `${SKIPPED_EMAIL},${ACCEPTED_EMAIL}`,
  PROGRESS_EMAIL_QA_BATCH_LIMIT: '2',
});
const weeklyReports = [{ periodEnd: '2026-09-04' }];
const currentWeeklyReport = { periodEnd: '2026-09-04' };
const now = new Date('2026-09-12T00:30:00.000Z');

const acceptedGrant = Object.freeze({
  id: GRANT_ID,
  user_id: ACCOUNT_ID,
  email_normalized: ACCEPTED_EMAIL,
  purpose: 'learning_progress_updates',
  status: 'granted',
});

const preferencesByEmail = new Map([
  [ACCEPTED_EMAIL, {
    learningProgressUpdates: { active: true, grant: acceptedGrant },
  }],
  [SKIPPED_EMAIL, {
    learningProgressUpdates: { active: false, grant: null },
  }],
]);

let resolvedAccounts = [];
let enqueuedCandidates = 0;
let dispatches = 0;
const result = await runProgressEmailQaBatch({
  weeklyReports,
  currentWeeklyReport,
  environment,
  now,
  databaseFetch: async () => assert.fail('Injected preferences/candidate stubs should avoid database fetch.'),
  providerFetch: async () => assert.fail('Injected dispatch stub should avoid provider fetch.'),
  readPreferences: async ({ email }) => preferencesByEmail.get(email),
  resolveCandidate: async ({ accountId }) => {
    resolvedAccounts.push(accountId);
    return {
      enabled: true,
      eligible: true,
      accountId,
      email: ACCEPTED_EMAIL,
      consentGrant: acceptedGrant,
      eligibility: { cohort: 'inactive_7d' },
    };
  },
  enqueue: async ({ candidate }) => {
    enqueuedCandidates += 1;
    assert.equal(candidate.accountId, ACCOUNT_ID);
    return { outbox: { id: '33333333-3333-4333-8333-333333333333' } };
  },
  dispatch: async ({ accountId, outboxId }) => {
    dispatches += 1;
    assert.equal(accountId, ACCOUNT_ID);
    assert.equal(outboxId, '33333333-3333-4333-8333-333333333333');
    return { status: 'accepted', outboxStatus: 'accepted' };
  },
});

assert.equal(result.enabled, true);
assert.equal(result.selected, 2);
assert.equal(result.accepted, 1);
assert.equal(result.skipped, 1);
assert.equal(result.failed, 0);
assert.equal(result.retryScheduled, 0);
assert.deepEqual(resolvedAccounts, [ACCOUNT_ID]);
assert.equal(enqueuedCandidates, 1);
assert.equal(dispatches, 1);
assert.equal(result.results.length, 2);
assert(result.results.every((item) => /^[0-9a-f]{12}$/.test(item.recipientRef)));
const serialized = JSON.stringify(result);
assert(!serialized.includes(ACCEPTED_EMAIL));
assert(!serialized.includes(SKIPPED_EMAIL));
assert(!serialized.includes(ACCOUNT_ID));
assert(!serialized.includes(GRANT_ID));

{
  const mismatch = await runProgressEmailQaBatch({
    weeklyReports,
    currentWeeklyReport,
    environment: { ...environment, PROGRESS_EMAIL_QA_RECIPIENTS: ACCEPTED_EMAIL, PROGRESS_EMAIL_QA_BATCH_LIMIT: '1' },
    now,
    readPreferences: async () => ({
      learningProgressUpdates: { active: true, grant: acceptedGrant },
    }),
    resolveCandidate: async () => ({
      eligible: true,
      email: 'different@example.com',
      consentGrant: acceptedGrant,
    }),
    enqueue: async () => assert.fail('Mismatched candidate must not enqueue.'),
    dispatch: async () => assert.fail('Mismatched candidate must not dispatch.'),
  });
  assert.equal(mismatch.accepted, 0);
  assert.equal(mismatch.skipped, 1);
  assert.equal(mismatch.results[0].reason, 'qa_candidate_identity_mismatch');
}

await assert.rejects(
  () => runProgressEmailQaBatch({
    weeklyReports,
    currentWeeklyReport,
    environment: { ...environment, VERCEL_ENV: 'production' },
    now,
  }),
  (error) => error instanceof ProgressEmailQaBatchError
    && error.code === 'PRODUCTION_PROGRESS_EMAIL_QA_BLOCKED',
);

await assert.rejects(
  () => runProgressEmailQaBatch({
    weeklyReports,
    currentWeeklyReport,
    environment: { ...environment, PROGRESS_EMAIL_QA_BATCH_LIMIT: '6' },
    now,
  }),
  (error) => error instanceof ProgressEmailQaBatchError
    && error.code === 'PROGRESS_EMAIL_QA_BATCH_LIMIT_INVALID',
);

await assert.rejects(
  () => runProgressEmailQaBatch({
    weeklyReports: [],
    currentWeeklyReport,
    environment,
    now,
  }),
  (error) => error instanceof ProgressEmailQaBatchError
    && error.code === 'PROGRESS_EMAIL_QA_SOURCES_MISSING',
);

console.log('Learning Progress QA batch contract passed.');
