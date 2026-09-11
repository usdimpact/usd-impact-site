import assert from 'node:assert/strict';
import {
  MarketingEmailPreferencesError,
  readMarketingEmailPreferences,
  withdrawMarketingEmailPurpose,
} from '../src/lib/marketing-email-preferences.js';
import { createMarketingEmailUnsubscribeToken } from '../src/lib/marketing-email-preference-token.js';

const email = 'reader@example.com';
const secret = `moi_${'a'.repeat(43)}`;
const environment = Object.freeze({
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  VERCEL_ENV: 'preview',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'p'.repeat(24)}`,
  SUPABASE_SECRET_KEY: `sb_secret_${'s'.repeat(24)}`,
  MARKETING_OPT_IN_SECRET: secret,
});
const weeklyGrant = Object.freeze({
  id: '123e4567-e89b-42d3-a456-426614174201',
  idempotency_key: `consent:v1:${'b'.repeat(64)}`,
  email_normalized: email,
  user_id: null,
  purpose: 'weekly_newsletter',
  status: 'granted',
  consent_text_version: 'weekly-newsletter-v1',
  privacy_notice_version: 'privacy-2026-08-31',
  source: 'email_double_opt_in',
  provider_contact_ref: null,
  captured_at: '2026-09-11T20:00:00.000Z',
  related_grant_id: null,
  withdrawn_at: null,
});
const progressGrant = Object.freeze({
  ...weeklyGrant,
  id: '123e4567-e89b-42d3-a456-426614174202',
  idempotency_key: `consent:v1:${'c'.repeat(64)}`,
  user_id: '123e4567-e89b-42d3-a456-426614174299',
  purpose: 'learning_progress_updates',
  consent_text_version: 'learning-progress-updates-v1',
});
const progressWithdrawal = Object.freeze({
  id: '123e4567-e89b-42d3-a456-426614174203',
  idempotency_key: `consent:v1:${'d'.repeat(64)}`,
  email_normalized: email,
  user_id: progressGrant.user_id,
  purpose: 'learning_progress_updates',
  status: 'withdrawn',
  consent_text_version: 'learning-progress-updates-v1',
  privacy_notice_version: 'privacy-2026-08-31',
  source: 'email_unsubscribe',
  provider_contact_ref: null,
  captured_at: '2026-09-11T21:00:00.000Z',
  related_grant_id: progressGrant.id,
  withdrawn_at: '2026-09-11T21:00:00.000Z',
});

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return payload == null ? '' : JSON.stringify(payload);
    },
  };
}

{
  const calls = [];
  const result = await readMarketingEmailPreferences({
    email,
    environment,
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.includes('purpose=eq.weekly_newsletter')) return response([weeklyGrant]);
      if (url.includes('purpose=eq.learning_progress_updates')) {
        return response([progressWithdrawal, progressGrant]);
      }
      assert.fail(`Unexpected preference lookup: ${url}`);
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(result.weeklyNewsletter.active, true);
  assert.equal(result.weeklyNewsletter.grant.id, weeklyGrant.id);
  assert.equal(result.learningProgressUpdates.active, false);
  assert.equal(result.learningProgressUpdates.grant, null);
}

const unsubscribeToken = createMarketingEmailUnsubscribeToken({
  consentIdempotencyKey: weeklyGrant.idempotency_key,
  purpose: 'weekly_newsletter',
  secret,
});

{
  let call = 0;
  const result = await withdrawMarketingEmailPurpose({
    token: unsubscribeToken,
    withdrawnAt: '2026-09-12T08:00:00.000Z',
    environment,
    fetchImpl: async (url, options = {}) => {
      call += 1;
      if (call === 1) {
        assert.match(url, /idempotency_key=eq\.consent%3Av1%3A/);
        return response([weeklyGrant]);
      }
      if (call === 2) {
        assert.match(url, /status=eq\.withdrawn/);
        return response([]);
      }
      if (call === 3) {
        assert.equal(options.method, 'POST');
        assert.match(url, /marketing_consent_events\?on_conflict=idempotency_key/);
        const body = JSON.parse(options.body);
        assert.equal(body.email_normalized, email);
        assert.equal(body.purpose, 'weekly_newsletter');
        assert.equal(body.status, 'withdrawn');
        assert.equal(body.source, 'email_unsubscribe');
        assert.equal(body.withdrawal_source, 'email_unsubscribe');
        assert.equal(body.related_grant_id, weeklyGrant.id);
        assert.equal(body.evidence.context.formVersion, 'email-preferences-v1');
        assert.equal(body.evidence.context.consentCheckbox, undefined);
        return response([{ id: '123e4567-e89b-42d3-a456-426614174204', ...body }]);
      }
      assert.fail(`Unexpected withdrawal request ${call}: ${url}`);
    },
  });
  assert.equal(call, 3);
  assert.equal(result.created, true);
  assert.equal(result.purpose, 'weekly_newsletter');
}

{
  const existingWithdrawal = {
    id: '123e4567-e89b-42d3-a456-426614174205',
    status: 'withdrawn',
    related_grant_id: weeklyGrant.id,
    withdrawn_at: '2026-09-12T07:00:00.000Z',
  };
  let call = 0;
  const result = await withdrawMarketingEmailPurpose({
    token: unsubscribeToken,
    environment,
    fetchImpl: async () => {
      call += 1;
      if (call === 1) return response([weeklyGrant]);
      if (call === 2) return response([existingWithdrawal]);
      assert.fail('Idempotent unsubscribe must not append a second withdrawal.');
    },
  });
  assert.equal(call, 2);
  assert.equal(result.created, false);
  assert.equal(result.withdrawal.id, existingWithdrawal.id);
}

await assert.rejects(
  () => withdrawMarketingEmailPurpose({
    token: unsubscribeToken,
    environment: {
      ...environment,
      VERCEL_ENV: 'production',
      SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
    },
    fetchImpl: async () => assert.fail('Production guard must run before database access.'),
  }),
  (error) => error instanceof MarketingEmailPreferencesError
    && error.code === 'PRODUCTION_EMAIL_PREFERENCES_NOT_APPROVED',
);

console.log('Marketing email preference ledger contract passed.');
