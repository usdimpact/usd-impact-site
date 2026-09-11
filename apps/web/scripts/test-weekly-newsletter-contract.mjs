import assert from 'node:assert/strict';
import { buildWeeklyNewsletterPayload, WeeklyNewsletterContractError } from '../src/lib/weekly-newsletter-contract.js';

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
assert.equal(payload.messageId, 'weekly_newsletter');
assert.equal(payload.consentPurpose, 'weekly_newsletter');
assert.equal(payload.classification, 'marketing');
assert.equal(payload.weekEnding, '2026-09-04');
assert.equal(payload.score.displayValue, '-0.71');
assert.equal(payload.score.displayWeekOverWeekChange, '-0.07');
assert.equal(payload.highlights.length, 3);
assert.equal(payload.primaryCta.url, 'https://www.usd-impact.com/reports/weekly/2026-09-04');
assert.equal(payload.links.at(-1).url, 'https://www.usd-impact.com/news/2026-09-04');
assert.match(payload.score.note, /not a forecast or trading signal/i);
assert.equal(payload.unsubscribeRequired, true);
assert(Object.isFrozen(payload));

assert.throws(
  () => buildWeeklyNewsletterPayload({ weeklyReport: { ...weeklyReport, status: 'draft' } }),
  (error) => error instanceof WeeklyNewsletterContractError && error.code === 'WEEKLY_REPORT_NOT_PUBLISHED',
);
assert.throws(
  () => buildWeeklyNewsletterPayload({ weeklyReport: { ...weeklyReport, slug: '/reports/weekly/2026-08-28' } }),
  (error) => error instanceof WeeklyNewsletterContractError && error.code === 'WEEKLY_REPORT_PERIOD_MISMATCH',
);
assert.throws(
  () => buildWeeklyNewsletterPayload({
    weeklyReport: {
      ...weeklyReport,
      themes: [
        ...weeklyReport.themes.slice(0, 2),
        { title: 'Three', summary: 'Third verified theme.', editionDates: ['2026-09-03'] },
      ],
    },
  }),
  (error) => error instanceof WeeklyNewsletterContractError && error.code === 'WEEKLY_HIGHLIGHT_SOURCE_MISMATCH',
);
assert.throws(
  () => buildWeeklyNewsletterPayload({ weeklyReport, locale: 'es' }),
  (error) => error instanceof WeeklyNewsletterContractError && error.code === 'UNAPPROVED_NEWSLETTER_LOCALE',
);

console.log('weekly newsletter contract tests passed');
