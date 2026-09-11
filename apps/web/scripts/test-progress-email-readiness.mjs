import assert from 'node:assert/strict';
import {
  ProgressEmailReadinessError,
  readProgressEmailAccountState,
  resolveProgressEmailCandidate,
} from '../src/lib/progress-email-readiness.js';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const GRANT_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ACCOUNT_ID = '33333333-3333-4333-8333-333333333333';
const EMAIL = 'qa@example.com';

const weeklyReport = {
  title: 'Weekly USD Impact Brief — September 4, 2026',
  slug: '/reports/weekly/2026-09-04',
  periodStart: '2026-08-31',
  periodEnd: '2026-09-04',
  status: 'published',
  category: 'Weekly USD Impact Brief',
  summary: 'Verified weekly context.',
  score: {
    value: -0.712292630238848,
    regime: 'Soft dollar regime',
    weekOverWeekChange: -0.07064819933592303,
    fourWeekChange: -0.15751160487657456,
    nearestRegimeBoundary: -1,
    sourceUrl: 'https://score.usd-impact.com/archive/2026-09-04/weekly_input.json',
  },
  themes: [
    { title: 'One', summary: 'First verified theme.', editionDates: ['2026-08-31'] },
    { title: 'Two', summary: 'Second verified theme.', editionDates: ['2026-09-02'] },
    { title: 'Three', summary: 'Third verified theme.', editionDates: ['2026-09-04'] },
  ],
  sourceEditions: [
    { date: '2026-08-31', title: 'Daily USD Impact — August 31, 2026', url: '/news/2026-08-31' },
    { date: '2026-09-02', title: 'Daily USD Impact — September 2, 2026', url: '/news/2026-09-02' },
    { date: '2026-09-04', title: 'Daily USD Impact — September 4, 2026', url: '/news/2026-09-04' },
  ],
  complianceNote: 'Educational and informational only. Not investment advice.',
};

const meaningfulChanges = [{
  kind: 'weekly_report',
  priority: 'P2',
  title: 'Weekly USD Impact Brief — September 4, 2026',
  occurredAt: '2026-09-05T18:00:00.000Z',
  url: '/reports/weekly/2026-09-04',
}];

const environment = {
  PROGRESS_EMAIL_READINESS_ENABLED: 'true',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  VERCEL_ENV: 'preview',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'p'.repeat(24)}`,
  SUPABASE_SECRET_KEY: `sb_secret_${'s'.repeat(24)}`,
};

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return body == null ? '' : JSON.stringify(body);
    },
  };
}

function eqFilter(url, key) {
  const raw = url.searchParams.get(key);
  return raw?.startsWith('eq.') ? raw.slice(3) : raw;
}

function createFetch({
  grantUserId = ACCOUNT_ID,
  weeklyHistory = [],
  progressHistory = [],
  suppressionHistory = [],
} = {}) {
  return async (input) => {
    const url = new URL(input);
    if (url.pathname === `/auth/v1/admin/users/${ACCOUNT_ID}`) {
      return jsonResponse({
        id: ACCOUNT_ID,
        email: EMAIL,
        email_confirmed_at: '2026-08-01T10:00:00.000Z',
        last_sign_in_at: '2026-09-04T19:00:00.000Z',
        is_anonymous: false,
      });
    }
    if (url.pathname === '/rest/v1/profiles') {
      return jsonResponse([{ account_id: ACCOUNT_ID, email: EMAIL, status: 'active' }]);
    }
    if (url.pathname === '/rest/v1/entitlements') {
      return jsonResponse([{
        id: '44444444-4444-4444-8444-444444444444',
        account_id: ACCOUNT_ID,
        product_id: 'read-the-dollar-first-guided-interactive-edition',
        state: 'active',
        starts_at: '2026-08-01T00:00:00.000Z',
        ends_at: null,
        version: 1,
        updated_at: '2026-08-01T00:00:00.000Z',
      }]);
    }
    if (url.pathname === '/rest/v1/learning_progress') {
      return jsonResponse([{
        content_id: 'guided-edition:chapter-3',
        status: 'in_progress',
        progress_percent: 42,
        resume_position: 'lesson-2',
        completed_at: null,
        updated_at: '2026-09-04T18:30:00.000Z',
      }]);
    }
    if (url.pathname === '/rest/v1/marketing_consent_events') {
      const purpose = eqFilter(url, 'purpose');
      if (purpose === 'weekly_newsletter') return jsonResponse([]);
      if (purpose === 'learning_progress_updates') {
        return jsonResponse([{
          id: GRANT_ID,
          idempotency_key: `consent:v1:${'a'.repeat(64)}`,
          email_normalized: EMAIL,
          user_id: grantUserId,
          purpose: 'learning_progress_updates',
          status: 'granted',
          consent_text_version: 'learning-progress-v1',
          privacy_notice_version: 'privacy-v1',
          source: 'email_opt_in_confirmation',
          provider_contact_ref: null,
          captured_at: '2026-09-01T10:00:00.000Z',
          related_grant_id: null,
          withdrawn_at: null,
        }]);
      }
    }
    if (url.pathname === '/rest/v1/notification_outbox') {
      const messageId = eqFilter(url, 'message_id');
      const status = url.searchParams.get('status');
      if (messageId === 'learning_progress_update') return jsonResponse(progressHistory);
      if (messageId === 'weekly_newsletter') return jsonResponse(weeklyHistory);
      if (status === 'in.(hard_bounced,complained,suppressed)') return jsonResponse(suppressionHistory);
    }
    throw new Error(`Unexpected request: ${url.pathname}${url.search}`);
  };
}

const now = new Date('2026-09-12T00:30:00.000Z');
const state = await readProgressEmailAccountState({
  accountId: ACCOUNT_ID,
  environment,
  fetchImpl: createFetch(),
  now,
});
assert.equal(state.enabled, true);
assert.equal(state.accountEligible, true);
assert.equal(state.consentActive, true);
assert.equal(state.providerSuppressed, false);
assert.equal(state.lastSignInAt, '2026-09-04T19:00:00.000Z');
assert.equal(state.learningJourney.available, true);
assert.equal(state.learningJourney.activityCount, 1);
assert.equal(state.learningJourney.nextStep.kind, 'resume-guided-edition');
assert.equal(state.learningJourney.nextStep.href, '/guided-edition/chapter-3/#lesson-2');

const candidate = await resolveProgressEmailCandidate({
  accountId: ACCOUNT_ID,
  meaningfulChanges,
  weeklyReport,
  environment,
  fetchImpl: createFetch(),
  now,
});
assert.equal(candidate.eligible, true);
assert.equal(candidate.eligibility.cohort, 'inactive_7d');
assert.equal(candidate.payload.messageId, 'learning_progress_update');
assert.equal(candidate.payload.progress.activityCount, 1);
assert.equal(candidate.payload.nextStep.kind, 'resume-guided-edition');
assert.equal(candidate.payload.latestContext.weekEnding, '2026-09-04');
assert.equal(candidate.consentGrant.id, GRANT_ID);

const mismatchedConsent = await resolveProgressEmailCandidate({
  accountId: ACCOUNT_ID,
  meaningfulChanges,
  weeklyReport,
  environment,
  fetchImpl: createFetch({ grantUserId: OTHER_ACCOUNT_ID }),
  now,
});
assert.equal(mismatchedConsent.eligible, false);
assert.equal(mismatchedConsent.reason, 'consent_not_granted');

const weeklyCollision = await resolveProgressEmailCandidate({
  accountId: ACCOUNT_ID,
  meaningfulChanges,
  weeklyReport,
  environment,
  fetchImpl: createFetch({
    weeklyHistory: [{
      status: 'accepted',
      accepted_at: '2026-09-11T12:00:00.000Z',
      delivered_at: null,
      updated_at: '2026-09-11T12:00:00.000Z',
    }],
  }),
  now,
});
assert.equal(weeklyCollision.eligible, false);
assert.equal(weeklyCollision.reason, 'weekly_newsletter_priority_window');

const providerBlocked = await resolveProgressEmailCandidate({
  accountId: ACCOUNT_ID,
  meaningfulChanges,
  weeklyReport,
  environment,
  fetchImpl: createFetch({
    suppressionHistory: [{ status: 'complained', updated_at: '2026-09-10T12:00:00.000Z' }],
  }),
  now,
});
assert.equal(providerBlocked.eligible, false);
assert.equal(providerBlocked.reason, 'provider_suppressed');

const disabled = await readProgressEmailAccountState({
  accountId: ACCOUNT_ID,
  environment: { ...environment, PROGRESS_EMAIL_READINESS_ENABLED: 'false' },
  fetchImpl: async () => { throw new Error('disabled readiness must not fetch'); },
  now,
});
assert.deepEqual(disabled, { enabled: false });

await assert.rejects(
  () => readProgressEmailAccountState({
    accountId: ACCOUNT_ID,
    environment: {
      ...environment,
      VERCEL_ENV: 'production',
      SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
    },
    fetchImpl: async () => { throw new Error('production block must precede fetch'); },
    now,
  }),
  (error) => error instanceof ProgressEmailReadinessError && error.code === 'PROGRESS_EMAIL_PRODUCTION_BLOCKED',
);

console.log('progress email readiness tests passed');
