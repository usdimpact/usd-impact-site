import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const articleFile = fileURLToPath(new URL('../public/macro-reviews/weekly/2026-10-30/index.html', import.meta.url));
const buildFile = fileURLToPath(new URL('../dist/macro-reviews/weekly/2026-10-30/index.html', import.meta.url));
const article = readFileSync(articleFile, 'utf8');
const expectedSources = [
  'https://www.federalreserve.gov/newsevents/2026-october.htm',
  'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm',
  'https://www.bea.gov/news/2026/gdp-advance-estimate-3rd-quarter-2026',
  'https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026',
  'https://www.bls.gov/news.release/archives/eci_10302026.htm',
];
const sections = ['summary', 'timeline', 'transmission', 'mistakes', 'watch', 'sources', 'compliance'];
assert.match(article, /<!doctype html>/i);
assert.match(article, /<html lang="en">/);
assert.match(article, /name="robots" content="noindex,nofollow,noarchive,nosnippet"/);
assert.match(article, /<title>USD Impact Macro Weekly Review \| October 26–30, 2026<\/title>/);
assert.equal((article.match(/<main\b/g) || []).length, 1);
assert.equal((article.match(/<section aria-labelledby="/g) || []).length, 7);
for (const section of sections) {
  assert.equal((article.match(new RegExp('<section aria-labelledby="' + section + '">', 'g')) || []).length, 1, section);
}
const govUrls = [...article.matchAll(/href="(https:\/\/(?:www\.)?(?:federalreserve|bea|bls)\.gov[^"]+)"/g)].map((m) => m[1]);
assert.deepEqual([...new Set(govUrls)].sort(), expectedSources.slice().sort(), 'all five official issuer URLs preserved');
assert.equal(govUrls.length, 10, 'five chronology links and five cited-source links');
for (const day of ['26', '27', '28', '29', '30']) {
  assert.ok(article.includes('https://www.usd-impact.com/news/2026-10-' + day + '/'), 'Daily ' + day);
}
assert.match(article, /AI-assisted preparation/);
assert.match(article, /KELA LEADS S\.R\.L\./);
assert.match(article, /two voting dissenters, Lisa D\. Cook and Beth M\. Hammack/);
assert.match(article, /3\.75%–4\.00%/);
assert.match(article, /3\.4%/);
assert.match(article, /3\.6%/);
assert.match(article, /3\.1%/);
assert.match(article, /0\.8%/);
assert.match(article, /no agency endorses the page/i);
assert.match(article, /coverage period, not the first-publication date/i);
for (const href of ['/', '/news', '/privacy/', '/terms/', '/compliance', '/contact']) {
  assert.ok(article.includes('href="' + href + '"'), 'site navigation/legal link ' + href);
}
assert.doesNotMatch(article, /<script\b|<iframe\b|<form\b|<img\b|<link\b[^>]*rel="stylesheet"/i);
assert.doesNotMatch(article, /Draft candidate|unpublished|all rights HOLD|not published|release control|this preview|release-authorized="false"/i);
assert.doesNotMatch(article, /score\.usd-impact\.com|yfinance|Yahoo Finance|TradingView|FRED API|<meta[^>]+name="twitter"/i);
assert.doesNotMatch(article, /datePublished|dateModified|schema\.org\/Article/);
assert.doesNotMatch(article, /<link\b[^>]+rel="canonical"/);
assert.equal((article.match(/<article class="content">/g) || []).length, 1);
if (process.argv.includes('--built')) {
  assert.ok(existsSync(buildFile), 'Astro must copy the standalone free Weekly to the public route');
  assert.equal(readFileSync(buildFile, 'utf8'), article, 'built public page must match reviewed source exactly');
}
console.log('independent free Weekly factual/source/privacy/isolation checks pass' +
  (process.argv.includes('--built') ? ' (built route verified)' : ''));
