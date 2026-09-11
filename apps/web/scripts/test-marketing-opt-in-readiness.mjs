import assert from 'node:assert/strict';
import {
  MARKETING_OPT_IN_MESSAGE_ID,
  MARKETING_OPT_IN_TEMPLATE_ID,
  MarketingOptInReadinessError,
  confirmMarketingOptIn,
  createMarketingOptInOutboxRecord,
  createMarketingOptInTokenForOutbox,
  prepareMarketingOptInRequest,
} from '../src/lib/marketing-opt-in-readiness.js';
import { verifyMarketingOptInToken } from '../src/lib/marketing-opt-in-token.js';

const requestId = '123e4567-e89b-42d3-a456-426614174000';
const userId = '123e4567-e89b-42d3-a456-426614174001';
const email = 'reader@example.com';
const requestedAt = '2026-09-11T20:00:00.000Z';
const secret = `moi_${'a'.repeat(43)}`;
const environment = Object.freeze({
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  VERCEL_ENV: 'preview',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'p'.repeat(24)}`,
  SUPABASE_SECRET_KEY: `sb_secret_${'s'.repeat(24)}`,
  MARKETING_OPT_IN_SECRET: secret,
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

function scriptedFetch(steps) {
  let index = 0;
  const fetchImpl = async (url, options = {}) => {
    const step = steps[index++];
    assert.ok(step, `Unexpected fetch call ${index}: ${url}`);
    if (step.method) assert.equal(options.method || 'GET', step.method);
    if (step.path) assert.match(url, step.path);
    if (step.assert) step.assert({ url, options });
    return response(step.payload, step.status || 200);
  };
  fetchImpl.assertDone = () => assert.equal(index, steps.length, 'All expected fetch calls should be consumed.');
  return fetchImpl;
}

const weeklyOutbox = createMarketingOptInOutboxRecord({
  email,
  requestId,
  purpose: 'weekly_newsletter',
  requestedAt,
});
assert.match(weeklyOutbox.idempotency_key, /^notification:v1:[0-9a-f]{64}$/);
assert.equal(weeklyOutbox.message_id, MARKETING_OPT_IN_MESSAGE_ID);
assert.equal(weeklyOutbox.template_id, MARKETING_OPT_IN_TEMPLATE_ID);
assert.equal(weeklyOutbox.classification, 'operational');
assert.equal(weeklyOutbox.consent_required, false);
assert.deepEqual(weeklyOutbox.payload, {
  purpose: 'weekly_newsletter',
  issuedAt: Math.floor(Date.parse(requestedAt) / 1000),
  locale: 'en',
});

assert.throws(
  () => createMarketingOptInOutboxRecord({
    email,
    requestId,
    purpose: 'learning_progress_updates',
    requestedAt,
  }),
  (error) => error instanceof MarketingOptInReadinessError && error.code === 'VERIFIED_ACCOUNT_REQUIRED',
);

const progressOutbox = createMarketingOptInOutboxRecord({
  email,
  requestId,
  purpose: 'learning_progress_updates',
  userId,
  requestedAt,
});
assert.equal(progressOutbox.payload.userId, userId);

const token = createMarketingOptInTokenForOutbox({ outbox: weeklyOutbox, secret });
const verified = verifyMarketingOptInToken({
  token,
  secret,
  now: weeklyOutbox.payload.issuedAt + 60,
});
assert.equal(verified.requestId, requestId);
assert.equal(verified.purpose, 'weekly_newsletter');
assert.equal(
  Date.parse(verified.expiresAt) / 1000,
  weeklyOutbox.payload.issuedAt + 48 * 60 * 60,
);

{
  const inserted = {
    id: '123e4567-e89b-42d3-a456-426614174010',
    ...weeklyOutbox,
  };
  const fetchImpl = scriptedFetch([
    {
      path: /marketing_consent_events\?email_normalized=/,
      payload: [],
    },
    {
      method: 'POST',
      path: /notification_outbox\?on_conflict=idempotency_key/,
      assert: ({ options }) => {
        const body = JSON.parse(options.body);
        assert.equal(body.recipient_email_normalized, email);
        assert.equal(body.payload.purpose, 'weekly_newsletter');
        assert.equal(Object.hasOwn(body, 'status'), false);
        assert.equal(Object.hasOwn(body, 'attempt_count'), false);
      },
      payload: [inserted],
    },
  ]);
  const result = await prepareMarketingOptInRequest({
    email,
    requestId,
    purpose: 'weekly_newsletter',
    requestedAt,
    environment,
    fetchImpl,
  });
  assert.equal(result.created, true);
  assert.equal(result.action, 'confirmation_queued');
  fetchImpl.assertDone();
}

{
  const grant = {
    id: '123e4567-e89b-42d3-a456-426614174020',
    idempotency_key: `consent:v1:${'b'.repeat(64)}`,
    email_normalized: email,
    user_id: null,
    purpose: 'weekly_newsletter',
    status: 'granted',
    consent_text_version: 'weekly-newsletter-v1',
    privacy_notice_version: 'privacy-2026-08-31',
    provider_contact_ref: null,
    captured_at: requestedAt,
    related_grant_id: null,
    withdrawn_at: null,
    created_at: requestedAt,
  };
  const fetchImpl = scriptedFetch([
    { path: /marketing_consent_events\?email_normalized=/, payload: [grant] },
  ]);
  const result = await prepareMarketingOptInRequest({
    email,
    requestId,
    purpose: 'weekly_newsletter',
    requestedAt,
    environment,
    fetchImpl,
  });
  assert.equal(result.action, 'already_subscribed');
  assert.equal(result.outbox, null);
  fetchImpl.assertDone();
}

{
  const deliveredOutbox = {
    id: '123e4567-e89b-42d3-a456-426614174030',
    ...weeklyOutbox,
    status: 'delivered',
    provider_message_ref: 'provider-message-1',
    created_at: requestedAt,
  };
  const grantId = '123e4567-e89b-42d3-a456-426614174031';
  const fetchImpl = scriptedFetch([
    {
      path: /notification_outbox\?message_id=eq\.marketing_opt_in_confirmation/,
      payload: [deliveredOutbox],
    },
    {
      path: /marketing_consent_events\?email_normalized=/,
      payload: [],
    },
    {
      method: 'POST',
      path: /marketing_consent_events\?on_conflict=idempotency_key/,
      assert: ({ options }) => {
        const body = JSON.parse(options.body);
        assert.equal(body.email_normalized, email);
        assert.equal(body.purpose, 'weekly_newsletter');
        assert.equal(body.status, 'granted');
        assert.equal(body.consent_text_version, 'weekly-newsletter-v1');
        assert.equal(body.privacy_notice_version, 'privacy-2026-08-31');
        assert.equal(body.source, 'email_double_opt_in');
        assert.equal(body.evidence.context.consentCheckbox, true);
        assert.equal(body.evidence.context.formVersion, 'email-opt-in-v1');
        assert.equal(body.evidence.context.request.locale, 'en');
      },
      payload: ({ options }) => options,
    },
  ]);
  // Replace the final scripted response with one based on the inserted body.
  fetchImpl.assertDone = fetchImpl.assertDone;
  let call = 0;
  const confirmationFetch = async (url, options = {}) => {
    call += 1;
    if (call === 1) return response([deliveredOutbox]);
    if (call === 2) return response([]);
    if (call === 3) {
      const body = JSON.parse(options.body);
      assert.equal(body.email_normalized, email);
      assert.equal(body.purpose, 'weekly_newsletter');
      assert.equal(body.status, 'granted');
      assert.equal(body.consent_text_version, 'weekly-newsletter-v1');
      assert.equal(body.privacy_notice_version, 'privacy-2026-08-31');
      assert.equal(body.source, 'email_double_opt_in');
      assert.equal(body.evidence.context.consentCheckbox, true);
      assert.equal(body.evidence.context.formVersion, 'email-opt-in-v1');
      assert.equal(body.evidence.context.request.locale, 'en');
      return response([{ id: grantId, ...body }]);
    }
    assert.fail(`Unexpected confirmation fetch call ${call}: ${url}`);
  };

  const result = await confirmMarketingOptIn({
    token,
    confirmedAt: '2026-09-11T20:05:00.000Z',
    nowSeconds: weeklyOutbox.payload.issuedAt + 300,
    environment,
    fetchImpl: confirmationFetch,
  });
  assert.equal(call, 3);
  assert.equal(result.created, true);
  assert.equal(result.grant.id, grantId);
}

{
  const blockedOutbox = {
    id: '123e4567-e89b-42d3-a456-426614174040',
    ...weeklyOutbox,
    status: 'hard_bounced',
    created_at: requestedAt,
  };
  const fetchImpl = scriptedFetch([
    {
      path: /notification_outbox\?message_id=eq\.marketing_opt_in_confirmation/,
      payload: [blockedOutbox],
    },
  ]);
  await assert.rejects(
    () => confirmMarketingOptIn({
      token,
      confirmedAt: '2026-09-11T20:05:00.000Z',
      nowSeconds: weeklyOutbox.payload.issuedAt + 300,
      environment,
      fetchImpl,
    }),
    (error) => error instanceof MarketingOptInReadinessError
      && error.code === 'OPT_IN_REQUEST_NOT_CONFIRMABLE'
      && error.status === 410,
  );
  fetchImpl.assertDone();
}

await assert.rejects(
  () => prepareMarketingOptInRequest({
    email,
    requestId,
    purpose: 'weekly_newsletter',
    requestedAt,
    environment: { ...environment, VERCEL_ENV: 'production' },
    fetchImpl: async () => assert.fail('Production guard must run before a database request.'),
  }),
  (error) => error instanceof MarketingOptInReadinessError && error.code === 'PRODUCTION_OPT_IN_NOT_APPROVED',
);

console.log('Marketing opt-in readiness contract passed.');
