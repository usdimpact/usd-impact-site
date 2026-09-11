import assert from 'node:assert/strict';
import {
  buildProgressEmailPayload,
  evaluateProgressEmailEligibility,
  ProgressEmailContractError,
} from '../src/lib/progress-email-contract.js';

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

const change = {
  kind: 'weekly_report',
  priority: 'P2',
  title: 'Weekly USD Impact Brief — September 4, 2026',
  occurredAt: '2026-09-04T18:00:00.000Z',
  url: '/reports/weekly/2026-09-04',
};

const eligible = evaluateProgressEmailEligibility({
  now: '2026-09-11T20:00:00.000Z',
  lastSignInAt: '2026-09-04T19:00:00.000Z',
  accountEligible: true,
  consentActive: true,
  meaningfulChanges: [change],
});
assert.equal(eligible.eligible, true);
assert.equal(eligible.action, 'queue_candidate');
assert.equal(eligible.cohort, 'inactive_7d');
assert.equal(eligible.daysInactive, 7);
assert.equal(eligible.meaningfulChanges.length, 1);

const noConsent = evaluateProgressEmailEligibility({
  now: '2026-09-11T20:00:00.000Z',
  lastSignInAt: '2026-09-04T19:00:00.000Z',
  accountEligible: true,
  consentActive: false,
  meaningfulChanges: [change],
});
assert.equal(noConsent.reason, 'consent_not_granted');

const noChange = evaluateProgressEmailEligibility({
  now: '2026-09-11T20:00:00.000Z',
  lastSignInAt: '2026-09-04T19:00:00.000Z',
  accountEligible: true,
  consentActive: true,
  meaningfulChanges: [{ ...change, occurredAt: '2026-09-04T18:00:00.000Z' }],
});
assert.equal(noChange.reason, 'no_meaningful_change');

const weeklyCollision = evaluateProgressEmailEligibility({
  now: '2026-09-15T20:00:00.000Z',
  lastSignInAt: '2026-09-01T19:00:00.000Z',
  lastWeeklyNewsletterAt: '2026-09-14T20:00:00.000Z',
  accountEligible: true,
  consentActive: true,
  meaningfulChanges: [{ ...change, occurredAt: '2026-09-12T18:00:00.000Z' }],
});
assert.equal(weeklyCollision.reason, 'weekly_newsletter_priority_window');

const frequencyCap = evaluateProgressEmailEligibility({
  now: '2026-09-15T20:00:00.000Z',
  lastSignInAt: '2026-09-01T19:00:00.000Z',
  lastProgressEmailAt: '2026-09-10T20:00:00.000Z',
  accountEligible: true,
  consentActive: true,
  meaningfulChanges: [{ ...change, occurredAt: '2026-09-12T18:00:00.000Z' }],
});
assert.equal(frequencyCap.reason, 'progress_email_frequency_cap');

const expired = evaluateProgressEmailEligibility({
  now: '2026-09-11T20:00:00.000Z',
  lastSignInAt: '2026-07-01T19:00:00.000Z',
  accountEligible: true,
  consentActive: true,
  meaningfulChanges: [change],
});
assert.equal(expired.reason, 'inactive_window_expired');

const learningJourney = {
  available: true,
  activityCount: 3,
  completedCount: 1,
  inProgressCount: 2,
  nextStep: {
    kind: 'resume-guided-edition',
    title: 'Resume your Guided Edition chapter',
    description: 'Continue where you left off and complete the mastery check when you are ready.',
    href: '/guided-edition/chapter-3/#lesson-2',
    ctaLabel: 'Resume chapter',
  },
};

const payload = buildProgressEmailPayload({ eligibility: eligible, learningJourney, weeklyReport });
assert.equal(payload.messageId, 'learning_progress_update');
assert.equal(payload.consentPurpose, 'learning_progress_updates');
assert.equal(payload.classification, 'marketing');
assert.equal(payload.cohort, 'inactive_7d');
assert.equal(payload.nextStep.url, 'https://www.usd-impact.com/guided-edition/chapter-3/');
assert.equal(payload.latestContext.weekEnding, '2026-09-04');
assert.equal(payload.latestContext.score.displayValue, '-0.71');
assert.equal(payload.unsubscribeRequired, true);
assert.equal(payload.sourceBoundaries.lastLogin, 'supabase_auth_last_sign_in_at');
assert(Object.isFrozen(payload));

assert.throws(
  () => buildProgressEmailPayload({ eligibility: noConsent, learningJourney, weeklyReport }),
  (error) => error instanceof ProgressEmailContractError && error.code === 'PROGRESS_EMAIL_NOT_ELIGIBLE',
);
assert.throws(
  () => buildProgressEmailPayload({ eligibility: eligible, learningJourney, weeklyReport, locale: 'es' }),
  (error) => error instanceof ProgressEmailContractError && error.code === 'UNAPPROVED_PROGRESS_EMAIL_LOCALE',
);

console.log('progress email contract tests passed');
