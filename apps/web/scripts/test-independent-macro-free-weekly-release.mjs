import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const articleFile = fileURLToPath(new URL('../src/pages/macro-reviews/weekly/2026-10-30/index.astro', import.meta.url));
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
  const built = readFileSync(buildFile, 'utf8');
  assert.match(built, /http-equiv="content-security-policy"/i, 'Astro must supply page CSP');
  assert.match(built, /name="robots"[^>]+noindex/i, 'public page stays noindex');
  assert.match(built, /AI-assisted preparation/, 'visible AI disclosure');
  assert.match(built, /two voting dissenters, Lisa D\. Cook and Beth M\. Hammack/, 'verified FOMC wording');
  assert.doesNotMatch(built, /<script\b|<iframe\b|<form\b/i, 'no page scripts, tracking or embeds');
  const builtSources = [...built.matchAll(/href="(https:\/\/(?:www\.)?(?:federalreserve|bea|bls)\.gov[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(builtSources)].sort(), expectedSources.slice().sort(), 'official-source parity in built page');
  assert.ok(!existsSync(fileURLToPath(new URL('../dist/macro-reviews/weekly/2026-10-23/index.html', import.meta.url))));
  assert.ok(!existsSync(fileURLToPath(new URL('../dist/macro-reviews/weekly/2026-11-06/index.html', import.meta.url))));
  const sitemap = readFileSync(fileURLToPath(new URL('../dist/sitemap-0.xml', import.meta.url)), 'utf8');
  assert.ok(!sitemap.includes('/macro-reviews/weekly/2026-10-30'), 'no indexing before separate authorization');
}
console.log('independent free Weekly factual/source/privacy/isolation checks pass' +
  (process.argv.includes('--built') ? ' (built route verified)' : ''));

// Independent calendar Monthly is a distinct educational series, not the legacy Score validator.
await import('./test-independent-macro-monthly-preview.mjs');
