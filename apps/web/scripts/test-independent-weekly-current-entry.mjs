// Safeguard: a newly published, static independent Weekly must not leave Reports pointing at an older edition.
// Deliberately does not create/approve reports, change the Score rights gate, or enable indexing.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const reportsFile = fileURLToPath(new URL('../src/pages/reports/index.astro', import.meta.url));
const newsIndexFile = fileURLToPath(new URL('../src/pages/news/index.astro', import.meta.url));
const independentRoot = fileURLToPath(new URL('../src/pages/macro-reviews/weekly/', import.meta.url));
const rightsGateFile = fileURLToPath(new URL('../../../governance/score-derived-publication-rights-gate.json', import.meta.url));
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function assertFriday(date) {
  assert.match(date, datePattern, 'independent Weekly route directory must be ISO YYYY-MM-DD');
  const parsed = new Date(date + 'T00:00:00Z');
  assert.equal(Number.isNaN(parsed.getTime()), false, 'invalid independent Weekly date');
  assert.equal(parsed.toISOString().slice(0, 10), date, 'invalid calendar date');
  assert.equal(parsed.getUTCDay(), 5, 'independent Weekly route date must end on a Friday');
}

function validateCurrentCard(reportsSource, publishedStaticWeeks, rightsState) {
  assert.ok(publishedStaticWeeks.length > 0, 'Reports has no published static independent Weekly route');
  const ordered = [...new Set(publishedStaticWeeks)].sort();
  for (const date of ordered) assertFriday(date);
  const expectedLatest = ordered.at(-1);

  const card = reportsSource.match(/<section class="independent-weekly-entry"[\s\S]*?<\/section>/)?.[0];
  assert.ok(card, 'Reports lacks the latest independent Weekly card');
  assert.match(card, /Latest published Weekly\s*·\s*Free independent Macro Weekly/, 'current Weekly card must be clearly distinguished from Score history');

  const links = [...card.matchAll(/href="\/macro-reviews\/weekly\/(\d{4}-\d{2}-\d{2})\/"/g)];
  assert.equal(links.length, 1, 'current Weekly card must link to exactly one dated independent edition');
  assert.equal(links[0][1], expectedLatest, 'Reports currently links to ' + links[0][1] + ', but newest static independent Weekly is ' + expectedLatest);

  if (rightsState === 'hold') {
    assert.match(reportsSource, /Historical Score-based Weekly\s*·\s*Publication on hold/, 'Score-derived history must remain labelled on hold');
    assert.match(reportsSource, /Publication status\s*—\s*on hold/, 'explicit rights hold notice must remain visible');
  }
  return expectedLatest;
}

const reportsSource = readFileSync(reportsFile, 'utf8');
const rights = JSON.parse(readFileSync(rightsGateFile, 'utf8'));
const dates = readdirSync(independentRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && datePattern.test(entry.name))
  .filter((entry) => existsSync(join(independentRoot, entry.name, 'index.astro')))
  .map((entry) => entry.name);
const latest = validateCurrentCard(reportsSource, dates, rights.state);
const latestSource = readFileSync(join(independentRoot, latest, 'index.astro'), 'utf8');
assert.match(latestSource, /name="robots" content="noindex,nofollow,noarchive,nosnippet"/, 'current independent Weekly must retain its noindex-first policy');
assert.match(latestSource, /AI-assisted preparation/, 'published independent Weekly must have its disclosure');
assert.doesNotMatch(latestSource, /<script\b|<iframe\b|<form\b|<img\b|<link\b[^>]*rel="stylesheet"/i, 'independent Weekly must retain its scriptless/image-free presentation');

// Negative tests prove that an unlinked new Friday edition and a regression to the Score archive fail closed.
const futureDate = new Date(latest + 'T00:00:00Z');
futureDate.setUTCDate(futureDate.getUTCDate() + 7);
const nextFriday = futureDate.toISOString().slice(0, 10);
assert.throws(
  () => validateCurrentCard(reportsSource, [...dates, nextFriday], rights.state),
  /newest static independent Weekly/,
  'adding another released independent Friday must force an updated Reports entry',
);
const currentHref = '/macro-reviews/weekly/' + latest + '/';
assert.equal(reportsSource.split('href="' + currentHref + '"').length - 1, 1, 'expected exactly one current independent Weekly route link in Reports');
assert.throws(
  () => validateCurrentCard(reportsSource.replace('href="' + currentHref + '"', 'href="/reports/weekly/2026-10-23/"'), dates, rights.state),
  /exactly one dated independent edition/,
  'a historical Score-based Weekly cannot be presented as the latest independent edition',
);
assert.throws(
  () => validateCurrentCard(reportsSource.replace('Latest published Weekly', 'Archived Weekly'), dates, rights.state),
  /clearly distinguished/,
  'the latest independent Weekly designation cannot silently disappear',
);
if (rights.state === 'hold') {
  assert.throws(
    () => validateCurrentCard(reportsSource.replace('Historical Score-based Weekly · Publication on hold', 'Historical Score-based Weekly'), dates, rights.state),
    /labelled on hold/,
    'rights-HOLD history label cannot silently disappear',
  );
}
const newsSource = readFileSync(newsIndexFile, 'utf8');
assert.match(newsSource, /Latest independent Macro Weekly/, 'Daily news index must promote the current independent Weekly');
const newsDate = newsSource.match(/const latestIndependentWeek = '([0-9]{4}-[0-9]{2}-[0-9]{2})';/);
assert.equal(newsDate?.[1], latest, 'Daily news must point to the same latest static independent Weekly as Reports');
assert.notEqual('2026-10-23', latest, 'historical Score Friday cannot stand in for the current independent Weekly');
const staleNewsSource = newsSource.replace(
  `const latestIndependentWeek = '${latest}';`,
  "const latestIndependentWeek = '2026-10-23';",
);
assert.equal(staleNewsSource.match(/const latestIndependentWeek = '([0-9]{4}-[0-9]{2}-[0-9]{2})';/)?.[1], '2026-10-23', 'negative fixture must target historical Score date');
assert.notEqual(staleNewsSource.match(/const latestIndependentWeek = '([0-9]{4}-[0-9]{2}-[0-9]{2})';/)?.[1], latest,
  'the freshness contract must detect and reject a stale Daily Weekly link');
assert.match(newsSource, /href=\{`\/macro-reviews\/weekly\/\$\{latestIndependentWeek\}\/`\}/, 'Daily news promo must link to the latest independent static page');
assert.match(newsSource, /historical Score-based Weekly series remains on rights hold/, 'Daily news must preserve the legacy Score rights warning');
assert.doesNotMatch(newsSource, /getCollection\('weeklyReports'\)|Connect the news to the score|latestWeeklyReport\.data/, 'Daily news must not display a stale Score-linked Weekly as the current one');
assert.ok(existsSync(join(independentRoot, latest, 'index.astro')), 'independent Weekly linked by Daily must exist');

console.log('independent Weekly Reports/News current-entry contract PASS: ' + latest + ' (' + dates.length + ' published static route(s)); stale-link negatives PASS');
