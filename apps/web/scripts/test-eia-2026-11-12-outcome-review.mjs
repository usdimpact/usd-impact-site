// Exact archived EIA release and unpublished-route regression for the
// review-only November 12 WPSR outcome. No provider calls or network access.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { sourceDateAttributionIssue } from '../src/lib/source-date-basis.js';

const filename = fileURLToPath(new URL(
  '../src/content/catalyst-briefs/2026-11-12-eia-weekly-petroleum-status-report-veterans-day-adjusted-publication-outcome.md',
  import.meta.url,
));
const routeFile = fileURLToPath(new URL('../src/pages/news/catalysts/[slug].astro', import.meta.url));
const content = readFileSync(filename, 'utf8');
const route = readFileSync(routeFile, 'utf8');
const prefix = 'https://www.eia.gov/petroleum/supply/weekly/archive/2026/2026_11_12/';
const urls = new Map([
  ['eia-wpsr-20261112-archive', prefix + 'wpsr_2026_11_12.php'],
  ['eia-wpsr-20261112-summary', prefix + 'download/summary.txt'],
  ['eia-wpsr-20261112-table1', prefix + 'download/table1.csv'],
]);

function verify(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert.ok(match, 'Catalyst outcome must have YAML frontmatter');
  const data = yaml.load(match[1]);
  assert.equal(data.status, 'review', 'No public publication until owner exact-head release');
  assert.equal(data.phase, 'outcome', 'This is a post-release outcome, not a stale pre-event preview');
  assert.equal(data.statusLabel, 'released');
  assert.equal(data.eventDate, '2026-11-12');
  assert.equal(data.sourceEditionDate, '2026-11-12', 'Data week 2026-11-06 must not replace government release date');
  assert.equal(data.lastReviewed, '2026-11-13');
  assert.equal(data.eventKey, '2026-11-12-eia-weekly-petroleum-status-report-veterans-day-adjusted-publication');
  assert.equal(data.slug, '/news/catalysts/' + data.eventKey + '-outcome');
  assert.match(data.complianceNote, /not investment.*not a recommendation/i);
  assert.equal(data.sources.length, 3, 'Use exactly the 3 archived originals, not schedule/rolling pointers');

  const ids = new Set();
  for (const source of data.sources) {
    assert.equal(source.sourceType, 'primary');
    assert.ok(!ids.has(source.id), 'Duplicate source ID');
    ids.add(source.id);
    assert.equal(source.url, urls.get(source.id), 'Source must match the verified release-specific original');
    assert.equal(source.publishedAt, '2026-11-12', 'Do not assign the week-ending date or access date');
    assert.equal(sourceDateAttributionIssue(source.url), null, 'No rolling or living source pointer');
  }
  assert.deepEqual(ids, new Set(urls.keys()));

  assert.equal(data.verifiedFacts.length, 5);
  for (const fact of data.verifiedFacts) {
    assert.equal(fact.verification, 'verified-primary');
    assert.ok(fact.sourceIds.length > 0 && fact.sourceIds.every((id) => ids.has(id)), 'All fact-to-original mappings must resolve');
  }
  const facts = data.verifiedFacts.map((fact) => fact.statement).join('\n');
  for (const exact of [
    'November 12, 2026', 'week ending November 6, 2026',
    '4.7 million barrels', '414.4 million barrels', '414.417 million',
    '409.760 million', '4.657 million',
    '1.8 million barrels', '210.757 million', '208.958 million',
    '4.1 million barrels', '103.330 million', '99.259 million',
    '322,000 barrels', '95.2%',
  ]) assert.ok(facts.includes(exact), 'Missing or modified verified fact ' + exact);
  assert.match(data.summary, /No observed market reaction is asserted/i);
  assert.match(raw, /Data week|week ending/i);
  assert.ok(!/\b(?:guaranteed return|risk-free profit|must buy|must sell)\b/i.test(raw));
  // Exact, explicit forbidden pointers avoid a host-unanchored URL regex.
  for (const pointer of [
    'https://www.eia.gov/petroleum/supply/weekly/schedule.php',
    'https://www.eia.gov/petroleum/supply/weekly/pdf/wpsrall.pdf',
  ]) {
    assert.ok(!raw.toLowerCase().includes(pointer), 'Rolling source pointer must not appear: ' + pointer);
  }
  assert.match(route, /\.filter\(\(entry\) => entry\.data\.status === 'published'\)/,
    'Live Catalyst route must exclude review candidates');
  return true;
}

const previewPath = fileURLToPath(new URL(
  '../src/pages/internal/review-catalysts/[review].astro', import.meta.url,
));
const sitemapPath = fileURLToPath(new URL('../astro.config.mjs', import.meta.url));
const reviewPageSource = readFileSync(previewPath, 'utf8');
const sitemapSource = readFileSync(sitemapPath, 'utf8');
function verifyPreviewGate(page, config) {
  assert.ok(page.includes("if (process.env.VERCEL_ENV !== 'preview') return [];"),
    'Only Vercel Preview may create the review route');
  assert.ok(page.includes("entry.data.status === 'review'"),
    'The preview must render only review-state content, never an already released article');
  assert.ok(page.includes("entry.data.phase === 'outcome'"));
  assert.ok(page.includes("entry.data.eventKey === '2026-11-12-eia-weekly-petroleum-status-report-veterans-day-adjusted-publication'"));
  assert.ok(page.includes("review: 'eia-2026-11-12-wpsr-outcome'"));
  assert.ok(page.includes("noindex={true}"), 'Brand layout must force robots noindex and omit canonical/JSON-LD');
  assert.ok(page.includes('data-review-only="true"'));
  assert.ok(page.includes('UNPUBLISHED REVIEW PREVIEW — NOT APPROVED FOR PUBLICATION'));
  assert.ok(!page.includes('structuredData={structuredData}'));
  assert.ok(config.includes("'/internal/review-catalysts/eia-2026-11-12-wpsr-outcome'"),
    'Sitemap must omit the review page in all environments');
  return true;
}
assert.equal(verifyPreviewGate(reviewPageSource, sitemapSource), true);
const previewMutants = [
  ['production build route leak', reviewPageSource.replace("VERCEL_ENV !== 'preview'", "VERCEL_ENV !== 'production'"), sitemapSource],
  ['published article in preview', reviewPageSource.replace("entry.data.status === 'review'", "entry.data.status === 'published'"), sitemapSource],
  ['indexed review preview', reviewPageSource.replace('noindex={true}', 'noindex={false}'), sitemapSource],
  ['missing release warning', reviewPageSource.replace('UNPUBLISHED REVIEW PREVIEW — NOT APPROVED FOR PUBLICATION', 'Ready for publication'), sitemapSource],
  ['missing sitemap hold', reviewPageSource, sitemapSource.replace("'/internal/review-catalysts/eia-2026-11-12-wpsr-outcome'", "'/internal/review-catalysts/some-other-page'")],
];
for (const [label, badPage, badConfig] of previewMutants) {
  assert.ok(badPage !== reviewPageSource || badConfig !== sitemapSource, 'Bad fixture: ' + label);
  assert.throws(() => verifyPreviewGate(badPage, badConfig), { name: 'AssertionError' }, 'Fail closed: ' + label);
}

assert.equal(verify(content), true);
const mutants = [
  ['premature release', content.replace('status: "review"', 'status: "published"')],
  ['pre-event relabel', content.replace('phase: "outcome"', 'phase: "preview"')],
  ['event date confusion', content.replace('eventDate: "2026-11-12"', 'eventDate: "2026-11-06"')],
  ['incorrect source date', content.replace('publishedAt: "2026-11-12"', 'publishedAt: "2026-11-06"')],
  ['mutable rolling report', content.replace(urls.get('eia-wpsr-20261112-table1'), 'https://www.eia.gov/petroleum/supply/weekly/pdf/wpsrall.pdf')],
  ['missing fact source', content.replace('      - "eia-wpsr-20261112-archive"', '      - "invented-fact-source-id"')],
  ['altered crude stock change', content.replace('increased 4.7 million barrels to', 'increased 5.7 million barrels to')],
  ['altered refinery utilization', content.replace('at 95.2% capacity utilization', 'at 96.2% capacity utilization')],
];
let rejected = 0;
for (const [label, mutant] of mutants) {
  assert.notEqual(mutant, content, 'Mutation fixture failed to modify source: ' + label);
  assert.throws(() => verify(mutant), { name: 'AssertionError' }, 'Must reject ' + label);
  rejected += 1;
}
console.log('EIA WPSR review-only archived-source contract PASS: 1 positive, ' + rejected + ' negative mutations');
