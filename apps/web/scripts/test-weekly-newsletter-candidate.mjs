import assert from 'node:assert/strict';
import { buildWeeklyNewsletterPayload } from '../src/lib/weekly-newsletter-contract.js';
import {
  WeeklyNewsletterCandidateError,
  evaluateWeeklyNewsletterCandidate,
} from '../src/lib/weekly-newsletter-candidate.js';

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
const payload = buildWeeklyNewsletterPayload({ weeklyReport });
const consentGrant = Object.freeze({
  id: '123e4567-e89b-42d3-a456-426614174401',
  idempotency_key: `consent:v1:${'a'.repeat(64)}`,
  email_normalized: 'reader@example.com',
  purpose: 'weekly_newsletter',
  status: 'granted',
});

const candidate = evaluateWeeklyNewsletterCandidate({
  payload,
  consentGrant,
  now: '2026-09-05T08:00:00.000Z',
});
assert.equal(candidate.eligible, true);
assert.equal(candidate.action, 'queue_candidate');
assert.equal(candidate.weekEnding, '2026-09-04');
assert.equal(candidate.publicationAgeDays, 1);
assert.equal(candidate.recipientEmail, 'reader@example.com');
assert.equal(candidate.consentGrantId, consentGrant.id);
assert.equal(candidate.payload, payload);
assert(Object.isFrozen(candidate));

assert.deepEqual(
  evaluateWeeklyNewsletterCandidate({
    payload,
    consentGrant,
    now: '2026-09-05T08:00:00.000Z',
    providerSuppressed: true,
  }),
  {
    eligible: false,
    action: 'suppress',
    reason: 'provider_suppressed',
    weekEnding: '2026-09-04',
  },
);

assert.deepEqual(
  evaluateWeeklyNewsletterCandidate({
    payload,
    consentGrant,
    lastSentWeekEnding: '2026-09-04',
    now: '2026-09-05T08:00:00.000Z',
  }),
  {
    eligible: false,
    action: 'suppress',
    reason: 'weekly_edition_already_sent',
    weekEnding: '2026-09-04',
  },
);

const stale = evaluateWeeklyNewsletterCandidate({
  payload,
  consentGrant,
  now: '2026-09-12T08:00:00.000Z',
});
assert.equal(stale.eligible, false);
assert.equal(stale.reason, 'weekly_report_stale');
assert.equal(stale.publicationAgeDays, 8);

const future = evaluateWeeklyNewsletterCandidate({
  payload,
  consentGrant,
  now: '2026-09-03T23:59:59.000Z',
});
assert.equal(future.eligible, false);
assert.equal(future.reason, 'weekly_report_in_future');

assert.throws(
  () => evaluateWeeklyNewsletterCandidate({
    payload,
    consentGrant: { ...consentGrant, purpose: 'book_availability' },
    now: '2026-09-05T08:00:00.000Z',
  }),
  (error) => error instanceof WeeklyNewsletterCandidateError
    && error.code === 'INVALID_WEEKLY_NEWSLETTER_CONSENT',
);

const nonFridayPayload = { ...payload, weekEnding: '2026-09-03' };
const nonFriday = evaluateWeeklyNewsletterCandidate({
  payload: nonFridayPayload,
  consentGrant,
  now: '2026-09-04T08:00:00.000Z',
});
assert.equal(nonFriday.eligible, false);
assert.equal(nonFriday.reason, 'week_ending_not_friday');

console.log('Weekly Newsletter candidate contract passed.');
