import assert from 'node:assert/strict';
import { buildWeeklyNewsletterPayload } from '../src/lib/weekly-newsletter-contract.js';
import { evaluateWeeklyNewsletterCandidate } from '../src/lib/weekly-newsletter-candidate.js';
import {
  WeeklyNewsletterEmailError,
  buildWeeklyNewsletterEmail,
} from '../src/lib/weekly-newsletter-email.js';

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
    { title: 'One <verified>', summary: 'First verified theme & context.', editionDates: ['2026-08-31'] },
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
const grant = Object.freeze({
  id: '123e4567-e89b-42d3-a456-426614174501',
  idempotency_key: `consent:v1:${'d'.repeat(64)}`,
  email_normalized: 'reader@example.com',
  purpose: 'weekly_newsletter',
  status: 'granted',
});
const candidate = evaluateWeeklyNewsletterCandidate({
  payload,
  consentGrant: grant,
  now: '2026-09-05T08:00:00.000Z',
});
const secret = `moi_${'e'.repeat(43)}`;

const email = buildWeeklyNewsletterEmail({ candidate, unsubscribeSecret: secret });
assert.equal(email.to, 'reader@example.com');
assert.equal(email.classification, 'marketing');
assert.equal(email.purpose, 'weekly_newsletter');
assert.equal(email.weekEnding, '2026-09-04');
assert.equal(email.subject, 'USD Impact Weekly — -0.71 | Soft dollar regime');
assert.match(email.text, /USD Impact Weekly Score: -0\.71/);
assert.match(email.text, /not a forecast or trading signal/i);
assert.match(email.text, /HIGHLIGHTS/);
assert.match(email.text, /First verified theme & context/);
assert.match(email.text, /Read the Weekly Report: https:\/\/www\.usd-impact\.com\/reports\/weekly\/2026-09-04/);
assert.match(email.text, /Educational and informational only\. Not investment advice\./);
assert.match(email.text, /explicitly confirmed the Weekly USD Impact email/i);
assert.match(email.text, /Unsubscribe from this email purpose:/);
assert.match(email.text, /KELA LEADS S\.R\.L\./);
assert.match(email.html, /^<!DOCTYPE html>/);
assert.match(email.html, /USD IMPACT WEEKLY/);
assert.match(email.html, /One &lt;verified&gt;/);
assert.match(email.html, /First verified theme &amp; context/);
assert.match(email.html, /VERIFIED HIGHLIGHTS/);
assert.match(email.html, /USEFUL LINKS/);
assert.match(email.html, /Unsubscribe from this email purpose/);
assert.doesNotMatch(email.html, /reader@example\.com/);
assert.doesNotMatch(email.html, /<img\b/i);
assert.equal(email.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
assert.match(email.headers['List-Unsubscribe'], /^<https:\/\/www\.usd-impact\.com\/email\/unsubscribe\?token=mu1\./);

assert.throws(
  () => buildWeeklyNewsletterEmail({
    candidate: { ...candidate, eligible: false, action: 'suppress' },
    unsubscribeSecret: secret,
  }),
  (error) => error instanceof WeeklyNewsletterEmailError
    && error.code === 'WEEKLY_NEWSLETTER_CANDIDATE_REQUIRED',
);

const badPayload = {
  ...payload,
  links: payload.links.map((link, index) => index === 0
    ? { ...link, url: 'https://example.com/report' }
    : link),
  primaryCta: { ...payload.primaryCta, url: 'https://example.com/report' },
};
assert.throws(
  () => buildWeeklyNewsletterEmail({
    candidate: { ...candidate, payload: badPayload },
    unsubscribeSecret: secret,
  }),
  (error) => error instanceof WeeklyNewsletterEmailError
    && error.code === 'INVALID_WEEKLY_NEWSLETTER_URL',
);

console.log('Weekly Newsletter email renderer contract passed.');
