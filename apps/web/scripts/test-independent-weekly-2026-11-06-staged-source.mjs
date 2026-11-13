// Offline hold-contract for the separately staged November 2-6 Independent Weekly.
// This validates source structure, citations and negative publication boundaries.
// It does NOT provide human editorial, rights, AI-law, privacy or release approval.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const articlePath = fileURLToPath(new URL(
  '../../../docs/operations/independent-macro-weekly-2026-11-06-dated-route-candidate.astro',
  import.meta.url,
));
const datedRoute = fileURLToPath(new URL(
  '../src/pages/macro-reviews/weekly/2026-11-06/index.astro',
  import.meta.url,
));
const parentReviewRoute = fileURLToPath(new URL(
  '../src/pages/macro-reviews/weekly/review-2026-11-06/index.astro',
  import.meta.url,
));
const configFile = fileURLToPath(new URL('../astro.config.mjs', import.meta.url));
const reportsFile = fileURLToPath(new URL('../src/pages/reports/index.astro', import.meta.url));
const newsFile = fileURLToPath(new URL('../src/pages/news/index.astro', import.meta.url));

const expectedIssuerURLs = [
  'https://www.bls.gov/news.release/archives/jolts_11032026.htm',
  'https://home.treasury.gov/news/press-releases/sb0678',
  'https://www.bea.gov/news/2026/us-international-trade-goods-and-services-september-2026',
  'https://www.bls.gov/news.release/archives/prod2_11052026.htm',
  'https://www.bls.gov/news.release/archives/empsit_11062026.htm',
];
const expectedTimeline = [
  '2026-11-03',
  '2026-11-04',
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
];
const expectedSections = [
  'summary', 'timeline', 'transmission', 'mistakes', 'watch', 'sources', 'compliance',
];
const expectedDailyLinks = [
  '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06',
];

function failuresForCandidate(source, { routeExists = false } = {}) {
  const failures = [];
  const requireSource = (ok, reason) => {
    if (!ok) failures.push(reason);
  };
  requireSource(typeof source === 'string' && source.includes('<!-- DRAFT ONLY:') && source.indexOf('<!-- DRAFT ONLY:') < 200,
    'Staged source must identify its Draft-only provenance.');
  if (typeof source !== 'string') return failures;
  requireSource(/<!doctype html>/i.test(source) && source.includes('<html lang="en">'),
    'Staged English article must have a complete HTML document.');
  requireSource(source.includes('data-publication-state="draft-source-not-served"'),
    'Staged source must preserve non-served status.');
  requireSource(source.includes('data-period-end="2026-11-06"'),
    'Coverage date must be November 6, not the actual first-publication date.');
  requireSource(source.includes('name="robots" content="noindex,nofollow,noarchive,nosnippet"'),
    'Robots noindex boundary must remain.');
  requireSource(source.includes('name="googlebot" content="noindex,nofollow,noarchive,nosnippet"'),
    'Googlebot noindex boundary must remain.');
  requireSource(source.includes('name="referrer" content="no-referrer"'),
    'Referrer-privacy boundary must remain.');
  requireSource((source.match(/<h1\b/g) ?? []).length === 1,
    'Source must have exactly one headline.');
  requireSource((source.match(/<main\b/g) ?? []).length === 1,
    'Source must have exactly one main landmark.');
  const sections = [...source.matchAll(/<section\s+aria-labelledby="([^"]+)"/g)].map(x => x[1]);
  requireSource(JSON.stringify(sections) === JSON.stringify(expectedSections),
    'Seven accessible section identifiers must remain complete and ordered.');
  const timeline = [...source.matchAll(/<time datetime="([^"]+)"/g)].map(x => x[1]);
  requireSource(JSON.stringify(timeline) === JSON.stringify(expectedTimeline),
    'Five official release dates must remain complete and separate from their data periods.');
  const issuerLinks = [...source.matchAll(/href="(https:\/\/(?:www\.)?(?:bls|bea|home\.treasury)\.gov\/[^"]+)"/g)]
    .map(x => x[1]);
  requireSource(
    issuerLinks.length === 10
      && JSON.stringify([...new Set(issuerLinks)].sort()) === JSON.stringify([...expectedIssuerURLs].sort()),
    'All five direct issuer links must appear exactly twice and no others may be substituted.',
  );
  for (const day of expectedDailyLinks) {
    requireSource(source.includes('href="/news/' + day + '/"'),
      'Missing original in-period Daily link ' + day);
  }
  requireSource(source.includes('AI-assisted preparation.')
    && source.includes('KELA LEADS S.R.L.')
    && source.includes('educational and informational purposes'),
    'AI attribution, operator and educational disclosures must remain.');
  requireSource(source.includes('November 9 has passed')
    && source.includes('not verified auction outcomes')
    && source.includes('November 10 CPI'),
    'After-period auction/CPI chronology safeguards must remain.');
  for (const link of ['/privacy/', '/terms/', '/compliance', '/contact']) {
    requireSource(source.includes('href="' + link + '"'), 'Missing site disclosure link: ' + link);
  }
  requireSource(!/<(?:script|iframe|img|video|audio)\b/i.test(source)
    && !/\bon(?:click|load|error|submit)\s*=/i.test(source)
    && !/\bsrc="https?:\/\//i.test(source),
    'Staged page must not add scripts, embedded media, event handlers or third-party requests.');
  requireSource(!routeExists,
    'No dated public Weekly route may exist while the staged source remains Draft-only.');
  return failures;
}

const article = readFileSync(articlePath, 'utf8');
const failures = failuresForCandidate(article, { routeExists: existsSync(datedRoute) });
assert.deepEqual(failures, [], 'Staged Weekly source contract failed:\n' + failures.join('\n'));
assert.equal(existsSync(parentReviewRoute), false,
  'The separate review-only route belongs to PR #1226; do not introduce it in this source-only PR.');
const config = readFileSync(configFile, 'utf8');
const reports = readFileSync(reportsFile, 'utf8');
const news = readFileSync(newsFile, 'utf8');
assert.doesNotMatch(config, /['"]\/macro-reviews\/weekly\/2026-11-06['"]/,
  'No sitemap setting for an unapproved new public date route.');
assert.match(reports, /href="\/macro-reviews\/weekly\/2026-10-30\/"/,
  'Reports must retain the current published October 30 independent Weekly.');
assert.match(news, /const latestIndependentWeek = '2026-10-30';/,
  'News must retain the current published October 30 independent Weekly.');

function rejectMutation(name, before, after) {
  assert.ok(article.includes(before), name + ': source fixture must exist.');
  const changed = article.replace(before, after);
  assert.notDeepEqual(failuresForCandidate(changed), [],
    name + ': altered source must fail closed.');
}
rejectMutation('unexpected publish state',
  'data-publication-state="draft-source-not-served"', 'data-publication-state="published"');
rejectMutation('indexing change',
  'name="robots" content="noindex,nofollow,noarchive,nosnippet"',
  'name="robots" content="index,follow"');
rejectMutation('missing source',
  expectedIssuerURLs[0], 'https://example.com/unsupported-source');
rejectMutation('misdated BLS release',
  '<time datetime="2026-11-06">', '<time datetime="2026-11-10">');
rejectMutation('removed AI notice',
  'AI-assisted preparation.', 'Editorial preparation.');
rejectMutation('removed auction chronology',
  'November 9 has passed', 'November 9 is upcoming');
rejectMutation('injected external script',
  '</body>', '<script src="https://example.com/tracker.js"></script></body>');
assert.notDeepEqual(failuresForCandidate(article, { routeExists: true }), [],
  'Any premature new public Weekly route must fail the source-only contract.');

console.log('Nov 6 Independent Weekly staged-source HOLD: five sources, five dates, seven sections, private route and 8 negative fixtures PASS.');
