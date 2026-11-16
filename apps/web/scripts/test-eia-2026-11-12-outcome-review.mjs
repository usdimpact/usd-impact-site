// Exact archived EIA release and published-state regression for the
// 12 Nov WPSR outcome; source/IndexNow selection only, no external requests.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { sourceDateAttributionIssue } from '../src/lib/source-date-basis.js';
import { catalystFirstPublicationIssue, catalystArticleDatePublished, catalystArticleDateModified, LEGACY_CATALYST_PUBLICATION_PINS } from '../src/lib/catalyst-first-publication-policy.js';
import { selectIndexNowUrls } from '../../../scripts/submit-indexnow-after-production.mjs';
import { createHash } from 'node:crypto';
const APPROVED_D = '2026-11-16';
const BASELINE_GIT_BLOB = '1c6dd65c20efbee5493f1249b1e81f18cb77eed9';

const filename = fileURLToPath(new URL(
  '../src/content/catalyst-briefs/2026-11-12-eia-wpsr-crude-inventories-outcome.md',
  import.meta.url,
));
const retiredFile = fileURLToPath(new URL('../src/content/catalyst-briefs/2026-11-12-eia-weekly-petroleum-status-report-veterans-day-adjusted-publication-outcome.md', import.meta.url));
assert.equal(existsSync(retiredFile), false, 'The old filename must not remain, or the prospective IndexNow candidate could map to an obsolete URL');
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
  assert.equal(data.status, 'published', 'Owner-authorized publication Draft status must be published');
  assert.equal(data.firstPublishedDate, APPROVED_D, 'Date must match exact owner-confirmed UTC publication day; refuse backdating');
  assert.equal(catalystFirstPublicationIssue(data, { todayUtc: APPROVED_D }), null, 'Date and preparation policy must pass');
  assert.equal(catalystArticleDatePublished(data, { todayUtc: APPROVED_D }), APPROVED_D);
  assert.equal(catalystArticleDateModified(data, { todayUtc: APPROVED_D }), undefined, 'Pre-publication editorial review must not claim a post-publication edit');
  assert.equal(data.phase, 'outcome', 'This is a post-release outcome, not a stale pre-event preview');
  assert.equal(data.statusLabel, 'released');
  assert.equal(data.eventDate, '2026-11-12');
  assert.equal(data.sourceEditionDate, '2026-11-12', 'Data week 2026-11-06 must not replace government release date');
  assert.equal(data.lastReviewed, '2026-11-14', 'Editorial verification actually renewed on 14 November');
  assert.equal(data.eventKey, '2026-11-12-eia-wpsr-crude-inventories', 'Event identity and neutral filename must satisfy the strict Catalyst path validator');
  assert.equal(data.slug, '/news/catalysts/2026-11-12-eia-wpsr-crude-inventories-outcome', 'Public-facing slug must be neutral and match the changed event identity');
  assert.equal(data.slug.split('/').at(-1) + '.md', '2026-11-12-eia-wpsr-crude-inventories-outcome.md', 'IndexNow filename and publication slug must match when separately approved for release');
  assert.equal(data.slug, '/news/catalysts/' + data.eventKey + '-' + data.phase, 'The strict Catalyst validator requires eventKey-phase to match the filename');
  assert.ok(!data.metaDescription.includes('pending release'), 'Future public meta description must never retain review-status copy');
  assert.deepEqual(data.assets, ['WTI', 'Brent'], 'Unobserved DXY must not be presented as an affected asset');
  assert.match(raw, /DXY is included only as a \*\*conditional cross-asset transmission watch item\*\*/);
  assert.match(raw, /\*\*Government-data attribution\.\*\* Source: U\.S\. Energy Information Administration/);
  assert.match(raw, /Weekly Petroleum Status Report \(released 12 November 2026; data week ending 6 November 2026\)/);
  assert.match(data.complianceNote, /not investment.*not a recommendation/i);
  assert.match(raw, /## AI-assisted preparation and source attribution\s+\*\*AI-assisted preparation\.\*\* AI tools assisted in preparing this educational analysis\./);
  assert.match(raw, /USD Impact is operated by KELA LEADS S\.R\.L\./);
  assert.match(raw, /The EIA does not endorse this analysis\./);
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
  assert.equal(data.title, 'EIA WPSR (12 November 2026): U.S. crude stocks rise 4.7 million barrels', 'Public headline must state the reported fact without internal verification-state or publication claims');
  assert.equal(data.metaTitle, 'EIA 12 Nov 2026 WPSR Outcome: Crude +4.7m Barrels | USD Impact', 'Approved SEO title remains unchanged');
  assert.ok(!raw.includes('must be recorded accurately when it is first made public'), 'Internal publication workflow instructions must not enter public editorial copy');
  assert.match(raw, /The underlying government report was released on \*\*12 November 2026\*\* for the week ending \*\*6 November 2026\*\*\. The historical inventory results do not establish a same-day market-price response\./);
  assert.ok(!raw.includes('The article remains an **unpublished review candidate**'), 'No internal draft-only wording may leak into later approved copy');
  assert.ok(!raw.includes('This educational outcome was assembled for review'), 'Release copy cannot imply draft preparation is a publication date');
  assert.match(data.generatedAt, /^2026-11-13T17:08:00Z$/, 'Keep the original drafting timestamp distinct from future publication metadata');
  assert.equal(data.status, 'published', 'This regression applies to the publication-state Draft only');
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
  // Byte-for-byte preserved historical evidence: reconstruct the reviewed original
  // frontmatter and compare the exact Git blob digest of the original brief.
  const original = raw.replace('status: "published"\nfirstPublishedDate: "' + APPROVED_D + '"\n', 'status: "review"\n');
  assert.notEqual(original, raw, 'Publication status/date anchors must be uniquely reversible');
  const gitBlobSha = createHash('sha1').update('blob ' + Buffer.byteLength(original) + '\0').update(original).digest('hex');
  assert.equal(gitBlobSha, BASELINE_GIT_BLOB, 'All original EIA facts, dated issuer sources, statements and disclaimers must remain byte-identical to #1266');
  return true;
}

// The formerly unpublished noindex EIA Preview route must be retired.
const formerReviewRoute = fileURLToPath(new URL('../src/pages/internal/review-catalysts/[review].astro', import.meta.url));
const sitemapPath = fileURLToPath(new URL('../astro.config.mjs', import.meta.url));
const sitemapSource = readFileSync(sitemapPath, 'utf8');
const layoutSource = readFileSync(fileURLToPath(new URL('../src/layouts/BaseLayout.astro', import.meta.url)), 'utf8');
function verifyPublishedSurfaces({ reviewExists = existsSync(formerReviewRoute), config = sitemapSource, publicRoute = route, layout = layoutSource } = {}) {
  assert.equal(reviewExists, false, 'The former EIA owner-only review page must be deleted');
  assert.ok(!config.includes("'/internal/review-catalysts/eia-2026-11-12-wpsr-outcome'"), 'Obsolete sitemap hold must be removed');
  assert.ok(!config.includes('review-catalysts'), 'No EIA review-only route may survive in sitemap configuration');
  assert.ok(layout.includes('suppressReviewMeasurement = false'), 'Public routes retain standard consent-gated analytics default');
  assert.ok(layout.includes('const measurementClientsEnabled = analyticsEnabled && !suppressReviewMeasurement;'), 'Measurement opt-out must stay fail-closed for any future review surfaces');
  assert.ok(layout.includes('{measurementClientsEnabled && <GoogleAnalyticsClient />}'));
  assert.ok(layout.includes('{measurementClientsEnabled && <TelemetryClient />}'));
  assert.ok(layout.includes('analyticsEnabled={analyticsEnabled}'));
  assert.ok(publicRoute.includes('datePublished: catalystArticleDatePublished(entry.data)'), 'Structured Article must use truthful first-publication date');
  assert.ok(publicRoute.includes('dateModified: catalystArticleDateModified(entry.data)'), 'Structured Article must retain genuine date-modified policy');
  assert.ok(publicRoute.includes('articleStructuredData({'), 'Public route must emit Article structured data');
  assert.ok(publicRoute.includes('structuredData={structuredData}'), 'Public route must pass structured data to BaseLayout');
  assert.ok(!publicRoute.includes('noindex={true}'), 'Public article cannot be forced noindex');
  assert.ok(!publicRoute.includes('suppressReviewMeasurement={true}'), 'Public article must use normal consent-gated analytics');
  assert.match(publicRoute, /\.filter\(\(entry\) => entry\.data\.status === 'published'\)/, 'Public route selects published records only');
  return true;
}
assert.equal(verifyPublishedSurfaces(), true);
const surfaceMutants = [
  ['N6: reintroduce review Astro route', { reviewExists: true }],
  ['N7: restore the private sitemap entry', { config: sitemapSource.replace("  '/macro-reviews/weekly/2026-10-30',", "  '/internal/review-catalysts/eia-2026-11-12-wpsr-outcome',\n  '/macro-reviews/weekly/2026-10-30',") }],
  ['N13: suppress public consent-gated measurement', { publicRoute: route.replace('structuredData={structuredData}', 'structuredData={structuredData} suppressReviewMeasurement={true}') }],
  ['force public article noindex', { publicRoute: route.replace('structuredData={structuredData}', 'structuredData={structuredData} noindex={true}') }],
  ['discard datePublished structured data', { publicRoute: route.replace('datePublished: catalystArticleDatePublished(entry.data)', 'datePublished: entry.data.generatedAt') }],
  ['allow review records as public pages', { publicRoute: route.replace("entry.data.status === 'published'", "entry.data.status === 'review'") }],
  ['reverse measurement privacy guard', { layout: layoutSource.replace('analyticsEnabled && !suppressReviewMeasurement', 'analyticsEnabled && suppressReviewMeasurement') }],
];
for (const [label, changes] of surfaceMutants) {
  const input = changes.publicRoute ?? changes.config ?? changes.layout ?? (changes.reviewExists === true ? 'true' : '');
  const originalSource = changes.publicRoute ? route : changes.config ? sitemapSource : changes.layout ? layoutSource : 'false';
  assert.notEqual(input, originalSource, 'Mutation fixture failed to change source: ' + label);
  assert.throws(() => verifyPublishedSurfaces(changes), { name: 'AssertionError' }, 'Fail closed: ' + label);
}

assert.equal(verify(content), true);
const mutants = [
  ['N1: revert to review state', content.replace('status: "published"', 'status: "review"')],
  ['N2: first-publication date removed', content.replace(/^firstPublishedDate:.*\n/m, '')],
  ['N3a: backdate to previous UTC day', content.replace('firstPublishedDate: "2026-11-16"', 'firstPublishedDate: "2026-11-15"')],
  ['N3b: backdate to original draft date', content.replace('firstPublishedDate: "2026-11-16"', 'firstPublishedDate: "2026-11-13"')],
  ['N4: future first-publication date', content.replace('firstPublishedDate: "2026-11-16"', 'firstPublishedDate: "2099-12-31"')],
  ['N5: post-publication editorial review fabricated', content.replace('lastReviewed: "2026-11-14"', 'lastReviewed: "2099-12-31"')],
  ['pre-event relabel', content.replace('phase: "outcome"', 'phase: "preview"')],
  ['event date confusion', content.replace('eventDate: "2026-11-12"', 'eventDate: "2026-11-06"')],
  ['incorrect source date', content.replace('publishedAt: "2026-11-12"', 'publishedAt: "2026-11-06"')],
  ['mutable rolling report', content.replace(urls.get('eia-wpsr-20261112-table1'), 'https://www.eia.gov/petroleum/supply/weekly/pdf/wpsrall.pdf')],
  ['missing fact source', content.replace('      - "eia-wpsr-20261112-archive"', '      - "invented-fact-source-id"')],
  ['altered crude stock change', content.replace('increased 4.7 million barrels to', 'increased 5.7 million barrels to')],
  ['altered refinery utilization', content.replace('at 95.2% capacity utilization', 'at 96.2% capacity utilization')],
  ['misstate historical date separation', content.replace('The underlying government report was released on **12 November 2026** for the week ending **6 November 2026**.', 'This page was first published on the original EIA release date.')],
  ['reintroduce unapproved Verified Outcome title', content.replace('title: "EIA WPSR (12 November 2026): U.S. crude stocks rise 4.7 million barrels"', 'title: "EIA 12 November WPSR: Crude inventories rise 4.7 million barrels — Verified Outcome"')],
  ['reintroduce internal publication process sentence', content.replace('The historical inventory results do not establish a same-day market-price response.', 'The timing of this USD Impact analysis must be recorded accurately when it is first made public. The historical inventory results do not establish a same-day market-price response.')],
  ['remove AI-assistance disclosure', content.replace('**AI-assisted preparation.** AI tools assisted', '**Manual preparation.** Editors assisted')],
  ['remove operator attribution', content.replace('USD Impact is operated by KELA LEADS S.R.L.', 'USD Impact has no named operator.')],
  ['remove EIA nonendorsement', content.replace('The EIA does not endorse this analysis.', 'The EIA endorses this analysis.')],
  ['reintroduce unobserved DXY asset', content.replace('  - "Brent"\nverifiedFacts:', '  - "Brent"\n  - "DXY"\nverifiedFacts:')],
  ['restore obsolete public slug', content.replace('slug: "/news/catalysts/2026-11-12-eia-wpsr-crude-inventories-outcome"', 'slug: "/news/catalysts/2026-11-12-eia-weekly-petroleum-status-report-veterans-day-adjusted-publication-outcome"')],
  ['remove dated EIA acknowledgment', content.replace('**Government-data attribution.** Source:', '**Unattributed government data.**')],
];
let rejected = 0;
for (const [label, mutant] of mutants) {
  assert.notEqual(mutant, content, 'Mutation fixture failed to modify source: ' + label);
  assert.throws(() => verify(mutant), { name: 'AssertionError' }, 'Must reject ' + label);
  rejected += 1;
}
assert.equal(LEGACY_CATALYST_PUBLICATION_PINS.length, 15, 'Preserve 15 historical Catalyst first-publication exceptions');
const indexNowCandidates = [
  'apps/web/src/content/catalyst-briefs/2026-11-12-eia-wpsr-crude-inventories-outcome.md',
];
// Selection-only test, never call notifyChangedPublicationUrls or dispatch.
// Trap global network attempts for this offline test as a separate safety net.
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('EIA selection-only test forbids all network requests'); };
try {
  const urls = await selectIndexNowUrls(indexNowCandidates, { readSource: async () => content });
  assert.deepEqual(urls, ['https://www.usd-impact.com/news/catalysts/2026-11-12-eia-wpsr-crude-inventories-outcome'], 'Only owner-approved neutral EIA URL is eligible for automatic IndexNow after a separately authorized Production release');
} finally {
  globalThis.fetch = originalFetch;
}
console.log('EIA WPSR publication-state source/SEO/IndexNow offline contract PASS: 1 source-positive, ' + rejected + ' source-negative mutations, ' + surfaceMutants.length + ' page/SEO/consent-negative mutations');
