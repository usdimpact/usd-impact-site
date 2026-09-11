import assert from 'node:assert/strict';
import {
  buildProgressEmailPayload,
  evaluateProgressEmailEligibility,
} from '../src/lib/progress-email-contract.js';
import {
  ProgressEmailRendererError,
  buildProgressEmail,
} from '../src/lib/progress-email-email.js';

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
const learningJourney = {
  available: true,
  activityCount: 5,
  completedCount: 2,
  inProgressCount: 3,
  nextStep: {
    kind: 'continue',
    title: 'Continue Chapter 4',
    description: 'Resume the next educational section in Read the Dollar First.',
    ctaLabel: 'Continue learning',
    href: '/guided-edition/book/chapter-4',
  },
};
const lastSignInAt = '2026-08-21T08:00:00.000Z';
const eligibility = evaluateProgressEmailEligibility({
  now: '2026-09-04T09:00:00.000Z',
  lastSignInAt,
  accountEligible: true,
  consentActive: true,
  providerSuppressed: false,
  meaningfulChanges: [
    {
      kind: 'learning_content',
      priority: 'P2',
      title: 'New dollar-and-gold learning note',
      occurredAt: '2026-09-02T12:00:00.000Z',
      url: '/learn/dollar-gold-context',
    },
    {
      kind: 'weekly_report',
      priority: 'P3',
      title: 'Weekly USD Impact Brief — September 4, 2026',
      occurredAt: '2026-09-04T07:00:00.000Z',
      url: '/reports/weekly/2026-09-04',
    },
  ],
});
assert.equal(eligibility.eligible, true);

const payload = buildProgressEmailPayload({ eligibility, learningJourney, weeklyReport });
const grant = Object.freeze({
  id: '123e4567-e89b-42d3-a456-426614175001',
  idempotency_key: `consent:v1:${'a'.repeat(64)}`,
  email_normalized: 'reader@example.com',
  purpose: 'learning_progress_updates',
  status: 'granted',
});
const secret = ['moi', 'x'.repeat(43)].join('_');

const email = buildProgressEmail({ payload, consentGrant: grant, unsubscribeSecret: secret });
assert.equal(email.to, 'reader@example.com');
assert.equal(email.classification, 'marketing');
assert.equal(email.purpose, 'learning_progress_updates');
assert.equal(email.cohort, eligibility.cohort);
assert.equal(email.subject, 'Pick up where you left off at USD Impact');
assert.match(email.text, /Saved learning progress: 2 completed · 3 in progress/);
assert.match(email.text, /Continue Chapter 4/);
assert.match(email.text, /Continue learning: https:\/\/www\.usd-impact\.com\/guided-edition\/book\/chapter-4/);
assert.match(email.text, /NEW SINCE YOUR LAST VISIT/);
assert.match(email.text, /New dollar-and-gold learning note/);
assert.match(email.text, /LATEST WEEKLY CONTEXT/);
assert.match(email.text, /USD Impact Weekly Score: -0\.71/);
assert.match(email.text, /not a forecast or trading signal/i);
assert.match(email.text, /Educational and informational only\. Not investment advice\./);
assert.match(email.text, /explicitly confirmed USD Impact learning progress updates/i);
assert.match(email.text, /KELA LEADS S\.R\.L\./);
assert.doesNotMatch(email.text, /2026-08-21T08:00:00/);
assert.doesNotMatch(email.text, /14 days|days inactive|last sign-in|last login/i);
assert.doesNotMatch(email.html, /reader@example\.com/);
assert.doesNotMatch(email.html, /123e4567-e89b-42d3-a456-426614175001/);
assert.doesNotMatch(email.html, /<img\b/i);
assert.match(email.html, /YOUR NEXT STEP/);
assert.match(email.html, /LATEST WEEKLY CONTEXT/);
assert.equal(email.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
assert.match(
  email.headers['List-Unsubscribe'],
  /^<https:\/\/www\.usd-impact\.com\/email\/unsubscribe\?token=mu1\./,
);

assert.throws(
  () => buildProgressEmail({
    payload,
    consentGrant: { ...grant, purpose: 'weekly_newsletter' },
    unsubscribeSecret: secret,
  }),
  (error) => error instanceof ProgressEmailRendererError
    && error.code === 'INVALID_PROGRESS_EMAIL_CONSENT',
);

const badNextStep = {
  ...payload,
  nextStep: { ...payload.nextStep, url: 'https://example.com/private' },
};
assert.throws(
  () => buildProgressEmail({
    payload: badNextStep,
    consentGrant: grant,
    unsubscribeSecret: secret,
  }),
  (error) => error instanceof ProgressEmailRendererError
    && error.code === 'INVALID_PROGRESS_EMAIL_URL',
);

const badScore = {
  ...payload,
  latestContext: {
    ...payload.latestContext,
    score: { ...payload.latestContext.score, note: 'Trading signal.' },
  },
};
assert.throws(
  () => buildProgressEmail({
    payload: badScore,
    consentGrant: grant,
    unsubscribeSecret: secret,
  }),
  (error) => error instanceof ProgressEmailRendererError
    && error.code === 'INVALID_PROGRESS_EMAIL_SCORE_NOTE',
);

console.log('Learning Progress email renderer contract passed.');
