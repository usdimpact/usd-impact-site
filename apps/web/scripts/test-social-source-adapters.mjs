import assert from 'node:assert/strict';
import {
  adaptCatalystPublication,
  adaptDailyPublication,
  adaptPublicationForSocial,
  adaptReportPublication,
  adaptWeeklyPublication,
} from '../src/lib/social-source-adapters.js';
import { generateSocialCandidate } from '../src/lib/social-candidate-generator.js';

const dailyEntry = {
  data: {
    title: 'Daily USD Impact — September 17, 2026',
    date: '2026-09-17',
    status: 'published',
    summary: 'A verified daily summary.',
    marketRegime: 'Mixed regime',
    highlights: [{ headline: 'Dollar', whyItMatters: 'Dollar pressure mattered.' }],
    sources: [{ title: 'Federal Reserve', url: 'https://www.federalreserve.gov/' }],
    complianceNote: 'Educational only.',
  },
};

const daily = adaptDailyPublication(dailyEntry);
assert.equal(daily.url, 'https://www.usd-impact.com/news/2026-09-17');
assert.equal(daily.sources[0].url, 'https://www.federalreserve.gov/');
assert.equal(generateSocialCandidate(daily, 'daily').state, 'draft');

const weeklyEntry = {
  data: {
    title: 'Weekly USD Impact Brief — September 11, 2026',
    slug: '/reports/weekly/2026-09-11',
    periodStart: '2026-09-07',
    periodEnd: '2026-09-11',
    status: 'published',
    summary: 'Verified weekly synthesis.',
    score: { value: -0.68, regime: 'Soft dollar regime', sourceUrl: 'https://score.usd-impact.com/archive/2026-09-11/weekly_input.json' },
    themes: [
      { title: 'Opening week', summary: 'Verified evidence one.' },
      { title: 'Midweek', summary: 'Verified evidence two.' },
      { title: 'Friday', summary: 'Verified evidence three.' },
    ],
    sourceEditions: [{ date: '2026-09-11', title: 'Daily USD Impact', url: '/news/2026-09-11' }],
    complianceNote: 'Educational only.',
  },
};

const weekly = adaptWeeklyPublication(weeklyEntry);
assert.equal(weekly.url, 'https://www.usd-impact.com/reports/weekly/2026-09-11');
assert.equal(weekly.sourceEditions[0].url, 'https://www.usd-impact.com/news/2026-09-11');
assert.equal(generateSocialCandidate(weekly, 'weekly').state, 'draft');

const catalystEntry = {
  data: {
    title: 'USD Impact Catalyst Brief — Test',
    eventKey: 'test-event',
    event: 'Test event',
    eventDate: '2026-09-17',
    phase: 'preview',
    status: 'published',
    statusLabel: 'scheduled-confirmed',
    verifiedFacts: [{ statement: 'Fact one.' }, { statement: 'Fact two.' }],
    transmissionChannels: [
      { channel: 'Dollar', conditionalImpact: 'Conditional dollar impact.' },
      { channel: 'Rates', conditionalImpact: 'Conditional rates impact.' },
    ],
    whatToWatch: ['Official release.'],
    sources: [{ title: 'Official source', url: 'https://www.federalreserve.gov/' }],
  },
};

const catalyst = adaptCatalystPublication(catalystEntry);
assert.equal(catalyst.url, 'https://www.usd-impact.com/news/catalysts/test-event');
assert.equal(generateSocialCandidate(catalyst, 'catalyst').state, 'draft');

const report = adaptReportPublication(weeklyEntry);
assert.equal(report.url, 'https://www.usd-impact.com/reports/weekly/2026-09-11');
assert.ok(report.evidence.some((item) => item.url.includes('score.usd-impact.com')));
assert.ok(report.evidence.some((item) => item.url.includes('/news/2026-09-11')));
assert.equal(generateSocialCandidate(report, 'report').state, 'draft');

assert.deepEqual(adaptPublicationForSocial('daily', dailyEntry), daily);
assert.throws(() => adaptPublicationForSocial('unknown', dailyEntry), /Unsupported social source type/);

console.log('Social source adapter contract tests passed.');
