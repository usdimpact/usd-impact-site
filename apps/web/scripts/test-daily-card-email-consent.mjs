import assert from 'node:assert/strict';
import {
  DAILY_LEARNING_CONSENT_PURPOSE,
  createDailyLearningConsentRecord,
  createDailyLearningUnsubscribeToken,
  listActiveDailyLearningGrants,
  subscribeDailyLearning,
  verifyDailyLearningUnsubscribeToken,
} from '../src/lib/daily-card-email-consent.js';

const email = 'learner@example.com';
const submissionId = '11111111-1111-4111-8111-111111111111';
const capturedAt = '2026-08-23T06:00:00.000Z';
const secret = `wus_${'a'.repeat(43)}`;
const configEnv = {
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  VERCEL_ENV: 'preview',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'p'.repeat(24)}`,
  SUPABASE_SECRET_KEY: `sb_secret_${'s'.repeat(24)}`,
};

const record = createDailyLearningConsentRecord({ email, submissionId, capturedAt });
assert.equal(record.email_normalized, email);
assert.equal(record.purpose, DAILY_LEARNING_CONSENT_PURPOSE);
assert.equal(record.status, 'granted');
assert.equal(record.evidence.context.consentCheckbox, true);
assert.equal(record.evidence.context.formVersion, 'daily-learning-form-v1');

const token = createDailyLearningUnsubscribeToken({
  consentIdempotencyKey: record.idempotency_key,
  secret,
});
const verified = verifyDailyLearningUnsubscribeToken({ token, secret });
assert.equal(verified.consentIdempotencyKey, record.idempotency_key);
assert.throws(
  () => verifyDailyLearningUnsubscribeToken({ token: `${token}x`, secret }),
  /invalid/i,
);

const grantRow = {
  id: '22222222-2222-4222-8222-222222222222',
  ...record,
  related_grant_id: null,
  withdrawn_at: null,
};
let call = 0;
const subscribeFetch = async (url, options = {}) => {
  call += 1;
  if (call === 1) {
    assert.match(String(url), /marketing_consent_events/);
    assert.match(String(url), /purpose=eq.daily_learning/);
    return new Response(JSON.stringify([]), { status: 200 });
  }
  assert.equal(options.method, 'POST');
  const body = JSON.parse(options.body);
  assert.equal(body.purpose, DAILY_LEARNING_CONSENT_PURPOSE);
  assert.equal(body.email_normalized, email);
  return new Response(JSON.stringify([grantRow]), { status: 201 });
};

const subscribed = await subscribeDailyLearning({
  email,
  submissionId,
  capturedAt,
  environment: configEnv,
  fetchImpl: subscribeFetch,
});
assert.equal(subscribed.created, true);
assert.equal(subscribed.grant.id, grantRow.id);
assert.equal(call, 2);

const activeGrant = {
  id: '33333333-3333-4333-8333-333333333333',
  idempotency_key: `consent:v1:${'1'.repeat(64)}`,
  email_normalized: 'active@example.com',
  purpose: DAILY_LEARNING_CONSENT_PURPOSE,
  status: 'granted',
  consent_text_version: 'daily-learning-email-v1',
  privacy_notice_version: 'privacy-2026-08-23',
  provider_contact_ref: null,
  captured_at: capturedAt,
  related_grant_id: null,
  withdrawn_at: null,
};
const withdrawnGrant = {
  ...activeGrant,
  id: '44444444-4444-4444-8444-444444444444',
  email_normalized: 'withdrawn@example.com',
  idempotency_key: `consent:v1:${'2'.repeat(64)}`,
};
const withdrawal = {
  id: '55555555-5555-4555-8555-555555555555',
  idempotency_key: `consent:v1:${'3'.repeat(64)}`,
  email_normalized: withdrawnGrant.email_normalized,
  purpose: DAILY_LEARNING_CONSENT_PURPOSE,
  status: 'withdrawn',
  consent_text_version: 'daily-learning-email-v1',
  privacy_notice_version: 'privacy-2026-08-23',
  provider_contact_ref: null,
  captured_at: '2026-08-23T07:00:00.000Z',
  related_grant_id: withdrawnGrant.id,
  withdrawn_at: '2026-08-23T07:00:00.000Z',
};
const listFetch = async () => new Response(
  JSON.stringify([activeGrant, withdrawnGrant, withdrawal]),
  { status: 200 },
);
const active = await listActiveDailyLearningGrants({ environment: configEnv, fetchImpl: listFetch });
assert.equal(active.length, 1);
assert.equal(active[0].email_normalized, 'active@example.com');

await assert.rejects(
  () => subscribeDailyLearning({
    email,
    submissionId,
    capturedAt,
    environment: {
      ...configEnv,
      VERCEL_ENV: 'production',
      SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
      EMAIL_READINESS_PRODUCTION_APPROVED: 'true',
    },
    fetchImpl: subscribeFetch,
  }),
  /canonical Production project/i,
);

console.log('Daily Learning email consent contract: PASS');
