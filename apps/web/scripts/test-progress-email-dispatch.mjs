import assert from 'node:assert/strict';
import {
  ProgressEmailDispatchError,
  dispatchProgressEmailOutbox,
  enqueueProgressEmailCandidate,
  resolveProgressEmailDispatchDecision,
} from '../src/lib/progress-email-dispatch.js';
import { createProgressEmailCycleKey } from '../src/lib/progress-email-outbox-intent.js';
import { ProgressEmailResendRequestError } from '../src/lib/progress-email-resend-adapter.js';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const GRANT_ID = '22222222-2222-4222-8222-222222222222';
const OUTBOX_ID = '33333333-3333-4333-8333-333333333333';
const EMAIL = 'reader@example.com';
const LAST_SIGN_IN = '2026-09-04T19:00:00.000Z';
const NOW = new Date('2026-09-12T00:30:00.000Z');
const CYCLE_KEY = createProgressEmailCycleKey({
  accountId: ACCOUNT_ID,
  lastSignInAt: LAST_SIGN_IN,
  cohort: 'inactive_7d',
});

const environment = Object.freeze({
  VERCEL_ENV: 'preview',
  PROGRESS_EMAIL_DISPATCH_ENABLED: 'true',
  PROGRESS_EMAIL_READINESS_ENABLED: 'true',
  PROGRESS_EMAIL_DELIVERY_ENABLED: 'true',
  PROGRESS_EMAIL_QA_RECIPIENTS: EMAIL,
  PROGRESS_EMAIL_BASE_URL: 'https://usd-impact-site-progress-test-usd-impact.vercel.app',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'p'.repeat(24)}`,
  SUPABASE_SECRET_KEY: `sb_secret_${'s'.repeat(24)}`,
  MARKETING_OPT_IN_SECRET: `moi_${'m'.repeat(43)}`,
  RESEND_API_KEY: `re_${'a'.repeat(32)}`,
  RESEND_FROM_EMAIL: 'USD Impact <updates@updates.usd-impact.com>',
  RESEND_REPLY_TO: 'support@usd-impact.com',
});

const consentGrant = Object.freeze({
  id: GRANT_ID,
  idempotency_key: `consent:v1:${'c'.repeat(64)}`,
  email_normalized: EMAIL,
  user_id: ACCOUNT_ID,
  purpose: 'learning_progress_updates',
  status: 'granted',
});

function candidate({ lastSignInAt = LAST_SIGN_IN, grant = consentGrant } = {}) {
  return Object.freeze({
    enabled: true,
    eligible: true,
    accountId: ACCOUNT_ID,
    email: EMAIL,
    lastSignInAt,
    consentGrant: grant,
    eligibility: Object.freeze({
      eligible: true,
      cohort: 'inactive_7d',
      reason: 'eligible',
    }),
    payload: Object.freeze({
      messageId: 'learning_progress_update',
      consentPurpose: 'learning_progress_updates',
      templateVersion: 'learning-progress-email-v1',
      classification: 'marketing',
    }),
  });
}

function outbox(overrides = {}) {
  return {
    id: OUTBOX_ID,
    idempotency_key: `notification:v1:${'a'.repeat(64)}`,
    event_id: `progress-email:${CYCLE_KEY}`,
    message_id: 'learning_progress_update',
    classification: 'marketing',
    business_object_type: 'learning_progress_cycle',
    business_object_id: `progress-cycle:${CYCLE_KEY}`,
    state_version: 1,
    recipient_email_normalized: EMAIL,
    template_id: 'learning_progress_email',
    template_version: 'learning-progress-email-v1',
    provider: 'resend',
    consent_required: true,
    consent_record_id: GRANT_ID,
    consent_purpose: 'learning_progress_updates',
    consent_checked_at: NOW.toISOString(),
    payload: { cohort: 'inactive_7d', cycleKey: CYCLE_KEY },
    status: 'queued',
    attempt_count: 0,
    next_attempt_at: NOW.toISOString(),
    provider_message_ref: null,
    error_code: null,
    accepted_at: null,
    delivered_at: null,
    failed_at: null,
    created_at: '2026-09-12T00:00:00.000Z',
    updated_at: '2026-09-12T00:00:00.000Z',
    ...overrides,
  };
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return body == null ? '' : JSON.stringify(body);
    },
  };
}

function ledgerFetch(initial = outbox()) {
  let state = { ...initial };
  const calls = [];
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(input);
    calls.push({ url, options });
    assert.equal(url.origin, 'https://ycstrcvshdluovtuasjc.supabase.co');
    if (url.pathname !== '/rest/v1/notification_outbox') {
      throw new Error(`Unexpected database path ${url.pathname}`);
    }
    if ((options.method || 'GET') === 'GET') {
      return response([state]);
    }
    if (options.method === 'PATCH') {
      const expectedStatus = url.searchParams.get('status')?.replace(/^eq\./, '');
      const expectedAttempts = Number(url.searchParams.get('attempt_count')?.replace(/^eq\./, ''));
      assert.equal(state.status, expectedStatus);
      assert.equal(state.attempt_count, expectedAttempts);
      state = {
        ...state,
        ...JSON.parse(options.body),
        updated_at: NOW.toISOString(),
      };
      return response([state]);
    }
    if (options.method === 'POST') {
      const record = JSON.parse(options.body);
      state = {
        id: OUTBOX_ID,
        provider_message_ref: null,
        error_code: null,
        accepted_at: null,
        delivered_at: null,
        failed_at: null,
        created_at: NOW.toISOString(),
        updated_at: NOW.toISOString(),
        ...record,
      };
      return response([state]);
    }
    throw new Error(`Unexpected method ${options.method}`);
  };
  return { fetchImpl, calls, state: () => state };
}

const rendered = Object.freeze({
  subject: 'USD Impact — your next learning step',
  text: 'Educational progress email.',
  html: '<!doctype html><html><body>Educational progress email.</body></html>',
  headers: Object.freeze({
    'List-Unsubscribe': '<https://usd-impact-site-progress-test-usd-impact.vercel.app/email/unsubscribe?token=mu1.test>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }),
});

assert.deepEqual(resolveProgressEmailDispatchDecision(outbox(), NOW.getTime()), {
  action: 'send',
  reason: 'queued',
});
assert.deepEqual(resolveProgressEmailDispatchDecision(outbox({
  status: 'retry_scheduled',
  attempt_count: 1,
  next_attempt_at: '2026-09-12T00:40:00.000Z',
}), NOW.getTime()), {
  action: 'wait',
  reason: 'retry-not-due',
});
assert.deepEqual(resolveProgressEmailDispatchDecision(outbox({
  status: 'accepted',
  attempt_count: 1,
  provider_message_ref: 'provider-1',
  accepted_at: NOW.toISOString(),
}), NOW.getTime()), {
  action: 'complete',
  reason: 'accepted',
});

{
  const ledger = ledgerFetch();
  let providerMessage = null;
  const result = await dispatchProgressEmailOutbox({
    outboxId: OUTBOX_ID,
    accountId: ACCOUNT_ID,
    weeklyReports: [],
    currentWeeklyReport: {},
    environment,
    fetchImpl: ledger.fetchImpl,
    now: NOW,
    resolveCandidate: async () => candidate(),
    renderEmail: () => rendered,
    createAdapter: () => ({
      async send(message) {
        providerMessage = message;
        return {
          state: 'accepted',
          messageRef: 'progress-provider-1',
          occurredAt: NOW.toISOString(),
        };
      },
    }),
  });
  assert.equal(result.status, 'accepted');
  assert.equal(result.providerMessageRef, 'progress-provider-1');
  assert.equal(providerMessage.idempotencyKey, `progress-email/${'a'.repeat(64)}`);
  assert.deepEqual(providerMessage.to, [EMAIL]);
  assert.equal(providerMessage.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.equal(ledger.state().status, 'accepted');
  assert.equal(ledger.state().attempt_count, 1);
}

{
  const ledger = ledgerFetch();
  const result = await dispatchProgressEmailOutbox({
    outboxId: OUTBOX_ID,
    accountId: ACCOUNT_ID,
    weeklyReports: [],
    currentWeeklyReport: {},
    environment,
    fetchImpl: ledger.fetchImpl,
    now: NOW,
    resolveCandidate: async () => ({ eligible: false, reason: 'weekly_newsletter_priority_window' }),
    renderEmail: () => assert.fail('Ineligible candidate must not render.'),
    createAdapter: () => assert.fail('Ineligible candidate must not create provider adapter.'),
  });
  assert.equal(result.status, 'cancelled');
  assert.equal(result.reason, 'weekly_newsletter_priority_window');
  assert.equal(ledger.state().status, 'cancelled');
}

{
  const ledger = ledgerFetch();
  const result = await dispatchProgressEmailOutbox({
    outboxId: OUTBOX_ID,
    accountId: ACCOUNT_ID,
    weeklyReports: [],
    currentWeeklyReport: {},
    environment,
    fetchImpl: ledger.fetchImpl,
    now: NOW,
    resolveCandidate: async () => candidate({ lastSignInAt: '2026-09-10T19:00:00.000Z' }),
    renderEmail: () => assert.fail('Changed cycle must not render.'),
    createAdapter: () => assert.fail('Changed cycle must not reach provider.'),
  });
  assert.equal(result.status, 'cancelled');
  assert.equal(result.reason, 'candidate_identity_changed');
  assert.equal(ledger.state().status, 'cancelled');
}

{
  const ledger = ledgerFetch();
  const result = await dispatchProgressEmailOutbox({
    outboxId: OUTBOX_ID,
    accountId: ACCOUNT_ID,
    weeklyReports: [],
    currentWeeklyReport: {},
    environment,
    fetchImpl: ledger.fetchImpl,
    now: NOW,
    resolveCandidate: async () => candidate(),
    renderEmail: () => rendered,
    createAdapter: () => ({
      async send() {
        throw new ProgressEmailResendRequestError('rate limited', {
          code: 'RESEND_RATE_LIMITED',
          retryable: true,
        });
      },
    }),
  });
  assert.equal(result.status, 'retry_scheduled');
  assert.equal(ledger.state().status, 'retry_scheduled');
  assert.equal(ledger.state().attempt_count, 1);
  assert.equal(ledger.state().next_attempt_at, '2026-09-12T00:35:00.000Z');
}

{
  const ledger = ledgerFetch();
  const queued = await enqueueProgressEmailCandidate({
    candidate: candidate(),
    environment,
    fetchImpl: ledger.fetchImpl,
    now: NOW,
  });
  assert.equal(queued.enqueued, true);
  assert.equal(queued.outbox.status, 'queued');
  assert.equal(queued.outbox.payload.cohort, 'inactive_7d');
  assert.equal(queued.outbox.payload.cycleKey, CYCLE_KEY);
  assert(!JSON.stringify(queued.outbox.payload).includes(ACCOUNT_ID));
  assert(!JSON.stringify(queued.outbox.payload).includes(LAST_SIGN_IN));
}

await assert.rejects(
  () => dispatchProgressEmailOutbox({
    outboxId: OUTBOX_ID,
    accountId: ACCOUNT_ID,
    environment: {
      ...environment,
      VERCEL_ENV: 'production',
      SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
    },
    fetchImpl: async () => assert.fail('Production block must precede any fetch.'),
    now: NOW,
  }),
  (error) => error instanceof ProgressEmailDispatchError
    && error.code === 'PRODUCTION_PROGRESS_EMAIL_DISPATCH_BLOCKED',
);

console.log('Learning Progress guarded dispatch worker contract passed.');
