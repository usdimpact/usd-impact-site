import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  independentCalendarMonth,
  assessIndependentMonthlyCoverage,
} from '../src/lib/independent-calendar-month.js';

const october = independentCalendarMonth(2026, 10);
const november = independentCalendarMonth(2026, 11);
assert.equal(october.periodStart, '2026-10-01');
assert.equal(october.periodEnd, '2026-10-31');
assert.deepEqual(october.fridayEnds, [
  '2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30',
]);
assert.equal(october.expectedFridayCount, 5, 'October 2026 has FIVE Fridays; no fixed-four rule.');
assert.deepEqual(november.fridayEnds, [
  '2026-11-06', '2026-11-13', '2026-11-20', '2026-11-27',
]);
assert.equal(november.periodEnd, '2026-11-30');
assert.equal(november.expectedFridayCount, 4);
assert.equal(independentCalendarMonth(2027, 2).periodEnd, '2027-02-28');
assert.equal(independentCalendarMonth(2028, 2).periodEnd, '2028-02-29');
for (const [year, month] of [[2026, 0], [2026, 13], [2026, 1.5], [1999, 12]]) {
  assert.throws(() => independentCalendarMonth(year, month), RangeError);
}
const octoberPreview = assessIndependentMonthlyCoverage({
  year: 2026, month: 10, asOfDate: '2026-11-02',
  publishedIndependentFridayEnds: ['2026-10-30'],
});
assert.equal(octoberPreview.calendarClosed, true);
assert.equal(octoberPreview.mayPrepareEditorialPreview, true);
assert.equal(octoberPreview.releaseAuthorized, false);
assert.equal(octoberPreview.observedWeeklyCount, 1);
assert.deepEqual(octoberPreview.missingIndependentFridays, [
  '2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23',
]);
// A claimed publication later than the explicit evidence checkpoint is invalid,
// even when the Friday belongs to the intended calendar month.
assert.throws(() => assessIndependentMonthlyCoverage({
  year: 2026, month: 11, asOfDate: '2026-11-02',
  publishedIndependentFridayEnds: ['2026-11-27'],
}), /cannot be after asOfDate/);
assert.throws(() => assessIndependentMonthlyCoverage({
  year: 2026, month: 10, asOfDate: '2026-10-20',
  publishedIndependentFridayEnds: ['2026-10-30'],
}), /cannot be after asOfDate/);
assert.equal(assessIndependentMonthlyCoverage({
  year: 2026, month: 10, asOfDate: '2026-10-31',
  publishedIndependentFridayEnds: ['2026-10-30'],
}).mayPrepareEditorialPreview, false, 'Month-end must elapse before the Monthly preview is prepared.');
const novemberStillOpen = assessIndependentMonthlyCoverage({
  year: 2026, month: 11, asOfDate: '2026-11-02',
  publishedIndependentFridayEnds: [],
});
assert.equal(novemberStillOpen.mayPrepareEditorialPreview, false);
assert.equal(novemberStillOpen.releaseAuthorized, false);
assert.equal(novemberStillOpen.observedWeeklyCount, 0);
assert.equal(assessIndependentMonthlyCoverage({
  year: 2026, month: 11, asOfDate: '2026-12-01',
  publishedIndependentFridayEnds: [],
}).mayPrepareEditorialPreview, true, 'Missing Weeklies may be disclosed, not fabricated.');
assert.throws(() => assessIndependentMonthlyCoverage({
  year: 2026, month: 10, asOfDate: '2026-11-02',
  publishedIndependentFridayEnds: ['2026-10-30', '2026-10-30'],
}), /duplicated/);
assert.throws(() => assessIndependentMonthlyCoverage({
  year: 2026, month: 10, asOfDate: '2026-11-02',
  publishedIndependentFridayEnds: ['2026-11-06'],
}), /outside/);
assert.throws(() => assessIndependentMonthlyCoverage({
  year: 2026, month: 10, asOfDate: '2026-11-31',
  publishedIndependentFridayEnds: [],
}), /valid ISO/);

const sourcePath = fileURLToPath(new URL('../src/pages/macro-reviews/monthly/2026-10/index.astro', import.meta.url));
const builtPath = fileURLToPath(new URL('../dist/macro-reviews/monthly/2026-10/index.html', import.meta.url));
const source = readFileSync(sourcePath, 'utf8');
const originalSources = [
  'https://www.bls.gov/news.release/archives/empsit_10022026.htm',
  'https://www.bls.gov/news.release/archives/cpi_10142026.htm',
  'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm',
  'https://www.bea.gov/news/2026/gdp-advance-estimate-3rd-quarter-2026',
  'https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026',
  'https://www.bls.gov/news.release/archives/eci_10302026.htm',
];
const sections = ['summary', 'chronology', 'transmission', 'mistakes', 'watch', 'sources', 'compliance'];
assert.match(source, /<!doctype html>/i);
assert.match(source, /<html lang="en">/);
assert.match(source, /name="robots" content="noindex,nofollow,noarchive,nosnippet"/);
assert.match(source, /name="googlebot" content="noindex,nofollow,noarchive,nosnippet"/);
assert.match(source, /data-report="calendar_monthly_preview"/);
assert.match(source, /data-period-start="2026-10-01" data-period-end="2026-10-31"/);
assert.match(source, /data-friday-count="5"/);
assert.match(source, /data-published-independent-weekly-count="1"/);
assert.match(source, /data-original-score-excluded="true"/);
assert.match(source, /data-market-price-data-excluded="true"/);
assert.match(source, /<title>October 2026 Macro Monthly Preview \| USD Impact<\/title>/);
assert.equal((source.match(/<section aria-labelledby="/g) || []).length, 7);
assert.equal((source.match(/<main\b/g) || []).length, 1);
assert.equal((source.match(/<article class="body">/g) || []).length, 1);
for (const section of sections) {
  assert.ok(source.includes('<section aria-labelledby="' + section + '">'), 'section ' + section);
}
for (const url of originalSources) {
  assert.equal(source.split('href="' + url + '"').length - 1, 2, 'one chronology source and one source list entry: ' + url);
}
for (const day of ['02', '14', '28', '29', '30']) {
  assert.ok(source.includes('https://www.usd-impact.com/news/2026-10-' + day + '/'), 'published Daily ' + day);
}
assert.match(source, /October 26–30 free independent Weekly/i);
assert.match(source, /Five Fridays occurred in October/);
assert.match(source, /November 1–30, 2026/);
assert.match(source, /6, 13, 20 and 27/);
assert.match(source, /AI-assisted preparation/);
assert.match(source, /KELA LEADS S\.R\.L\./);
assert.match(source, /neither affiliated with nor endorsed by BLS/i);
assert.match(source, /not the first-publication date/);
for (const link of ['/', '/news', '/privacy/', '/terms/', '/compliance', '/contact']) {
  assert.ok(source.includes('href="' + link + '"'), 'safe website navigation ' + link);
}
assert.doesNotMatch(source, /<script\b|<iframe\b|<form\b|<img\b|<link\b[^>]+rel="stylesheet"/i);
assert.doesNotMatch(source, /yfinance|Yahoo Finance|TradingView|FRED API|scorePath|score\.value|<meta[^>]+name="twitter"/i);
assert.doesNotMatch(source, /datePublished|dateModified|schema\.org\/Article/);
assert.doesNotMatch(source, /<link\b[^>]+rel="canonical"/);
const allPublishedIndependent = [...source.matchAll(/href="(\/macro-reviews\/weekly\/[^"]+)"/g)].map(m => m[1]);
assert.ok(allPublishedIndependent.every(x => x === '/macro-reviews/weekly/2026-10-30/'));
if (process.argv.includes('--built')) {
  assert.ok(existsSync(builtPath), 'Astro must build the isolated independent October preview route');
  const built = readFileSync(builtPath, 'utf8');
  assert.match(built, /http-equiv="content-security-policy"/i, 'Astro CSP remains enforced');
  assert.match(built, /name="robots"[^>]+noindex/);
  assert.match(built, /data-report="calendar_monthly_preview"/);
  assert.match(built, /AI-assisted preparation/);
  assert.doesNotMatch(built, /<script\b|<iframe\b|<form\b/i);
  for (const url of originalSources) assert.ok(built.includes('href="' + url + '"'));
  assert.ok(!existsSync(fileURLToPath(new URL('../dist/macro-reviews/monthly/2026-11/index.html', import.meta.url))), 'future November remains ungenerated');
  const sitemap = readFileSync(fileURLToPath(new URL('../dist/sitemap-0.xml', import.meta.url)), 'utf8');
  assert.ok(!sitemap.includes('/macro-reviews/monthly/2026-10'), 'preview remains noindex and out of sitemap');
}
console.log('Independent October calendar Monthly Preview coverage/source/privacy checks pass' +
  (process.argv.includes('--built') ? ' (built route verified)' : ''));
