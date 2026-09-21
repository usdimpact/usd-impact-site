import assert from 'node:assert/strict';
import {
  SOURCE_DATE_RULES,
  SOURCE_DATE_SCHEMA_PATTERN,
  SOURCE_ID_RULES,
  SOURCE_ID_SCHEMA_PATTERN,
  normalizeBundleDraft,
  normalizePublishedAt,
  safeValidationDiagnostic,
} from '../api/daily-news-validation.js';
import {
  SOURCE_DATE_BASIS,
  isLivingSourceUrl,
  sourceDateBasisForUrl,
  sourceDateAttributionIssue,
} from '../src/lib/source-date-basis.js';

import { validateEditorialBundle } from '../src/lib/daily-news-editorial-validation.js';

assert.equal(SOURCE_DATE_SCHEMA_PATTERN, '^\\d{4}-\\d{2}-\\d{2}$');
assert.equal(SOURCE_ID_SCHEMA_PATTERN, '^[a-z0-9][a-z0-9-]{1,63}$');
assert.match(SOURCE_DATE_RULES, /YYYY-MM-DD/);
assert.match(SOURCE_DATE_RULES, /Last Update/i);
assert.match(SOURCE_DATE_RULES, /current release/i);
assert.match(SOURCE_DATE_RULES, /data-update date/i);
assert.match(SOURCE_DATE_RULES, /access date/i);
assert.match(SOURCE_DATE_RULES, /effective date/i);
assert.match(SOURCE_DATE_RULES, /event date/i);
assert.match(SOURCE_DATE_RULES, /auction date/i);
assert.match(SOURCE_DATE_RULES, /omit that source/i);
assert.match(SOURCE_ID_RULES, /never place a URL/i);
assert.match(SOURCE_ID_RULES, /same normalized source id/i);

assert.equal(
  sourceDateBasisForUrl('https://www.federalreserve.gov/newsevents/2026-september.htm'),
  SOURCE_DATE_BASIS.LAST_UPDATED,
);
assert.equal(
  sourceDateBasisForUrl('https://www.federalreserve.gov/newsevents/calendar.htm'),
  SOURCE_DATE_BASIS.LAST_UPDATED,
);
assert.equal(
  sourceDateBasisForUrl('https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'),
  SOURCE_DATE_BASIS.LAST_UPDATED,
);
assert.equal(
  sourceDateBasisForUrl('https://www.federalreserve.gov/monetarypolicy.htm'),
  SOURCE_DATE_BASIS.LAST_UPDATED,
);
assert.equal(
  sourceDateBasisForUrl('https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm'),
  SOURCE_DATE_BASIS.PUBLISHED,
);
assert.equal(
  sourceDateBasisForUrl('https://home.treasury.gov/news/press-releases/sb0607'),
  SOURCE_DATE_BASIS.PUBLISHED,
  'Treasury press releases must remain immutable publication-date sources',
);
assert.equal(
  sourceDateBasisForUrl('https://www.bls.gov/cpi'),
  SOURCE_DATE_BASIS.CURRENT_RELEASE,
  'BLS CPI program homepage rolls forward with the current release',
);
assert.equal(
  sourceDateBasisForUrl('https://www.bls.gov/cpi/'),
  SOURCE_DATE_BASIS.CURRENT_RELEASE,
  'BLS CPI program homepage trailing slash must preserve living-source semantics',
);
assert.equal(
  sourceDateBasisForUrl('https://www.bls.gov/news.release/cpi.nr0.htm'),
  SOURCE_DATE_BASIS.PUBLISHED,
  'BLS current-release alias remains outside the narrow CPI-homepage exception',
);
assert.equal(
  sourceDateBasisForUrl('https://www.bls.gov/schedule/2026/09_sched_list.htm'),
  SOURCE_DATE_BASIS.PUBLISHED,
);
assert.equal(
  sourceDateBasisForUrl('https://www.eia.gov/petroleum/supply/weekly/index.php'),
  SOURCE_DATE_BASIS.CURRENT_RELEASE,
  'EIA Weekly Petroleum Status Report landing page rolls forward with each weekly release',
);
assert.equal(
  sourceDateBasisForUrl('https://www.eia.gov/petroleum/supply/weekly/index.php?trk=organization_guest_main-feed-card_feed-article-content'),
  SOURCE_DATE_BASIS.CURRENT_RELEASE,
  'Tracking-query variants must not change EIA WPSR living-source semantics',
);
assert.equal(
  sourceDateBasisForUrl('https://www.eia.gov/petroleum/supply/weekly/archive/2026/2026_09_10/'),
  SOURCE_DATE_BASIS.PUBLISHED,
  'Archived EIA weekly release paths must remain immutable publication-date sources',
);
assert.equal(sourceDateBasisForUrl('not-a-url'), SOURCE_DATE_BASIS.PUBLISHED);
assert.equal(isLivingSourceUrl('https://www.federalreserve.gov/newsevents/2026-july.htm'), true);
assert.equal(isLivingSourceUrl('https://www.bls.gov/cpi'), true);
assert.equal(isLivingSourceUrl('https://www.bls.gov/news.release/cpi.nr0.htm'), false);
assert.equal(isLivingSourceUrl('https://www.eia.gov/petroleum/supply/weekly/index.php?trk=example'), true);

assert.equal(normalizePublishedAt('2026-07-23', 'dated-source'), '2026-07-23');
assert.equal(normalizePublishedAt('2026-07-23T09:30:00Z', 'timestamp-source'), '2026-07-23');
assert.equal(normalizePublishedAt('2026-07-23T09:30:00+02:00', 'offset-source'), '2026-07-23');

assert.throws(
  () => normalizePublishedAt('July 23, 2026', 'human-date'),
  /invalid publishedAt value/,
);
assert.throws(
  () => normalizePublishedAt('2026-07', 'month-only'),
  /invalid publishedAt value/,
);
assert.throws(
  () => normalizePublishedAt('', 'undated-page'),
  /invalid publishedAt value/,
);
assert.throws(
  () => normalizePublishedAt('2026-02-31', 'impossible-date'),
  /invalid publishedAt date/,
);

const normalized = normalizeBundleDraft({
  sources: [
    { id: 'date-only', publishedAt: '2026-07-23' },
    { id: 'timestamp', publishedAt: '2026-07-23T09:30:00Z' },
    { id: 'invalid', publishedAt: 'July 2026' },
  ],
});
assert.equal(normalized.sources[0].publishedAt, '2026-07-23');
assert.equal(normalized.sources[1].publishedAt, '2026-07-23');
assert.equal(normalized.sources[2].publishedAt, 'July 2026');

const sourceIdNormalized = normalizeBundleDraft({
  sources: [
    {
      id: 'https://www.federalreserve.gov/newsevents/2026-july.htm',
      title: 'Federal Reserve July 2026 events',
      url: 'https://www.federalreserve.gov/newsevents/2026-july.htm',
      publishedAt: '2026-07-30',
    },
    {
      id: 'Reuters Markets',
      title: 'Reuters markets update',
      url: 'https://www.reuters.com/markets/example',
      publishedAt: '2026-07-30T09:30:00Z',
    },
  ],
  highlights: [{ sourceIds: ['https://www.federalreserve.gov/newsevents/2026-july.htm', 'Reuters Markets'] }],
  catalysts: [{ sourceIds: ['Reuters Markets'] }],
});
assert.equal(sourceIdNormalized.sources[0].id, 'www-federalreserve-gov-newsevents-2026-july-htm');
assert.equal(sourceIdNormalized.sources[1].id, 'reuters-markets');
assert.deepEqual(sourceIdNormalized.highlights[0].sourceIds, [
  'www-federalreserve-gov-newsevents-2026-july-htm',
  'reuters-markets',
]);
assert.deepEqual(sourceIdNormalized.catalysts[0].sourceIds, ['reuters-markets']);
assert.equal(sourceIdNormalized.sources[1].publishedAt, '2026-07-30');

const run33RepairNormalized = normalizeBundleDraft({
  sources: [
    {
      id: 'bls-current',
      title: 'Current BLS release',
      url: 'https://www.bls.gov/news.release/cpi.nr0.htm',
      publishedAt: '2026-08-12',
    },
    {
      id: 'fed-calendar',
      title: 'Federal Reserve calendar',
      url: 'https://www.federalreserve.gov/newsevents/2026-august.htm',
      publishedAt: '2026-08-01',
    },
    {
      id: 'reuters-market',
      title: 'Current market reaction',
      url: 'https://www.reuters.com/markets/example',
      publishedAt: '2026-08-12',
    },
    {
      id: 'eia-weekly-historical-prices',
      title: 'Historical energy prices',
      url: 'https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm',
      publishedAt: '2026-08-06',
    },
  ],
  highlights: [
    { sourceIds: ['bls-current'] },
    { sourceIds: ['reuters-market'] },
    { sourceIds: ['fed-calendar'] },
  ],
  catalysts: [{ sourceIds: ['fed-calendar'] }],
});
assert.deepEqual(
  run33RepairNormalized.sources.map(({ id }) => id),
  ['bls-current', 'fed-calendar', 'reuters-market'],
);
assert.ok(run33RepairNormalized.sources.length >= 3);

const belowMinimumAfterPruning = normalizeBundleDraft({
  sources: run33RepairNormalized.sources,
  highlights: [{ sourceIds: ['bls-current'] }],
  catalysts: [{ sourceIds: ['fed-calendar'] }],
});
assert.deepEqual(
  belowMinimumAfterPruning.sources.map(({ id }) => id),
  ['bls-current', 'fed-calendar'],
);

const duplicateIds = normalizeBundleDraft({
  sources: [
    { id: 'Reuters Markets', publishedAt: '2026-07-30' },
    { id: 'Reuters Markets', publishedAt: '2026-07-30' },
  ],
});
assert.equal(duplicateIds.sources[0].id, 'reuters-markets');
assert.equal(duplicateIds.sources[1].id, 'reuters-markets-2');

assert.deepEqual(
  safeValidationDiagnostic('Source fed-calendar has an invalid publishedAt value'),
  {
    code: 'invalid-source-date',
    reason: 'One or more source publication dates are invalid. Use a verified YYYY-MM-DD value or omit the undated source.',
  },
);
assert.equal(
  safeValidationDiagnostic('Invalid source id: https://www.federalreserve.gov/newsevents/2026-july.htm').code,
  'invalid-source-id',
);
assert.equal(
  safeValidationDiagnostic('Source example was not returned by OpenAI web search').code,
  'ungrounded-source',
);
assert.deepEqual(
  safeValidationDiagnostic('The bundle must contain 3-7 highlights'),
  {
    code: 'invalid-highlight-count',
    reason: 'The generated bundle must contain between three and seven complete highlights.',
  },
);
assert.equal(
  safeValidationDiagnostic("Catalyst 1 must fall within the edition's next seven calendar days").code,
  'invalid-catalyst-window',
);
assert.equal(
  safeValidationDiagnostic('Catalysts must be an array').code,
  'invalid-catalyst-collection',
);
assert.equal(
  safeValidationDiagnostic('Daily news source generation failed validation after two bounded repair attempts.').code,
  'repair-exhausted',
);
assert.equal(
  safeValidationDiagnostic('unexpected provider detail with a secret-looking value').code,
  'generation-validation-failed',
);

// #634: synthetic source fixtures test attribution, not official market facts.
const treasuryIndex = 'https://home.treasury.gov/policy-issues/financing-the-government/quarterly-refunding/most-recent-quarterly-refunding-documents';
const treasuryIndexVariants = [
  treasuryIndex,
  `${treasuryIndex}/`,
  `${treasuryIndex}//`,
  `${treasuryIndex}?utm_source=fixture`,
  `${treasuryIndex}/?e=48669#documents`,
  treasuryIndex.replace('home.treasury.gov', 'HOME.TREASURY.GOV'),
  treasuryIndex.replace('home.treasury.gov', 'home.treasury.gov.'),
  treasuryIndex.replace('/most-recent-', '/%6dost-recent-'),
];
for (const url of treasuryIndexVariants) {
  assert.equal(sourceDateBasisForUrl(url), SOURCE_DATE_BASIS.DOCUMENT_INDEX, url);
  assert.equal(isLivingSourceUrl(url), false, 'An index is not a date-check exemption');
  assert.match(sourceDateAttributionIssue(url), /directly linked dated document/);
}

const treasuryDocument = 'https://home.treasury.gov/system/files/221/synthetic-refunding-document-20260909.pdf';
for (const url of [
  treasuryDocument,
  'https://home.treasury.gov/news/press-releases/sb0607',
  `${treasuryIndex}/archive/2026`,
  treasuryIndex.replace('most-recent-quarterly-refunding-documents', 'quarterly-refunding-archives'),
  treasuryIndex.replace('home.treasury.gov', 'home.treasury.gov.example.org'),
  'https://example.org/?url=' + encodeURIComponent(treasuryIndex),
  'not-a-url',
]) {
  assert.equal(sourceDateBasisForUrl(url), SOURCE_DATE_BASIS.PUBLISHED, url);
  assert.equal(isLivingSourceUrl(url), false, url);
  assert.equal(sourceDateAttributionIssue(url), null, url);
}
assert.equal(sourceDateAttributionIssue(null), null);
assert.match(SOURCE_DATE_RULES, /multi-document index for discovery only/i);
assert.match(SOURCE_DATE_RULES, /directly linked dated document/i);
assert.match(SOURCE_DATE_RULES, /never borrow a date from a sibling document/i);
assert.match(SOURCE_DATE_RULES, /Do not replace a conflicting date with an older date/i);

function treasuryAttributionBundle(url, publishedAt) {
  return {
    editionDate: '2026-09-16',
    sources: [{ id: 'treasury-item', url, publishedAt, title: 'Synthetic Treasury document', sourceType: 'primary' }],
    highlights: [{ headline: 'Treasury document update.', sourceIds: ['treasury-item'] }],
    catalysts: [],
    summary: 'Synthetic source-attribution fixture.',
  };
}
// Prior history, a sibling update, an arbitrary date, and the access date all
// remain unsuitable for assigning a single publication date to this index.
for (const date of ['2026-08-03', '2026-08-05', '2026-09-09', '2026-09-16']) {
  const candidate = treasuryAttributionBundle(treasuryIndex, date);
  const original = structuredClone(candidate);
  assert.throws(() => validateEditorialBundle(candidate), /directly linked dated document/);
  assert.deepEqual(candidate, original, 'Validation must not silently rewrite dates');
}
const fabricated = treasuryAttributionBundle(treasuryIndex, '2026-09-09');
Object.assign(fabricated.sources[0], {
  verified: true, dateBasis: 'current-release', documentUrl: treasuryDocument,
});
assert.throws(() => validateEditorialBundle(fabricated), /directly linked dated document/);
const catalystOnly = treasuryAttributionBundle(treasuryIndex, '2026-09-09');
catalystOnly.highlights = [];
catalystOnly.catalysts = [{ event: 'Treasury document review', sourceIds: ['treasury-item'] }];
assert.throws(() => validateEditorialBundle(catalystOnly), /directly linked dated document/);
const normalizedIndex = normalizeBundleDraft({ ...fabricated, date: '2026-09-16' });
assert.throws(() => validateEditorialBundle(normalizedIndex), /directly linked dated document/);
assert.equal(normalizedIndex.sources[0].publishedAt, '2026-09-09');

assert.doesNotThrow(() => validateEditorialBundle(treasuryAttributionBundle(treasuryDocument, '2026-09-09')));
assert.throws(() => validateEditorialBundle(treasuryAttributionBundle(treasuryDocument, '2026-09-17')), /dated after the edition/);
assert.throws(() => validateEditorialBundle(treasuryAttributionBundle(treasuryDocument, '2026-08-03')), /only stale daily-development sources/);
const diagnostic = safeValidationDiagnostic(`${sourceDateAttributionIssue(treasuryIndex)} secret-looking-fixture-value`);
assert.equal(diagnostic.code, 'invalid-source-date', 'Keep the existing diagnostic/retry category');
assert.match(diagnostic.reason, /directly linked Treasury document/);
assert.doesNotMatch(diagnostic.reason, /secret-looking-fixture-value|https?:/);

// #676: synthetic attribution fixtures, not a live-source or market-fact audit.
const fedIndex = 'https://www.federalreserve.gov/recentpostings.htm';
const fedDocument = 'https://www.federalreserve.gov/newsevents/pressreleases/synthetic20260918a.htm';
const fedIndexVariants = [
  fedIndex,
  `${fedIndex}/`,
  `${fedIndex}//`,
  `${fedIndex}?utm_source=fixture#postings`,
  fedIndex.replace('www.', ''),
  fedIndex.replace('www.federalreserve.gov', 'WWW.FEDERALRESERVE.GOV.'),
  fedIndex.replace('recentpostings.htm', 'RECENTPOSTINGS.HTM'),
  fedIndex.replace('recentpostings', '%72ecentpostings'),
];
for (const url of fedIndexVariants) {
  assert.equal(sourceDateBasisForUrl(url), SOURCE_DATE_BASIS.DOCUMENT_INDEX, url);
  assert.equal(isLivingSourceUrl(url), false, 'The Fed index must not bypass date checks');
  assert.match(sourceDateAttributionIssue(url), /^Federal Reserve Recent Postings index requires a directly linked dated document/);
}
for (const url of [
  fedDocument,
  fedIndex.replace('recentpostings.htm', 'recentpostings.htm/archive/2026'),
  fedIndex.replace('recentpostings.htm', 'recentpostings-archive.htm'),
  fedIndex.replace('recentpostings.htm', '%ZZrecentpostings.htm'),
  fedIndex.replace('federalreserve.gov', 'federalreserve.gov.example.org'),
  'https://example.org/?url=' + encodeURIComponent(fedIndex),
]) {
  assert.equal(sourceDateBasisForUrl(url), SOURCE_DATE_BASIS.PUBLISHED, url);
  assert.equal(sourceDateAttributionIssue(url), null, url);
  assert.equal(isLivingSourceUrl(url), false, url);
}
assert.match(SOURCE_DATE_RULES, /Federal Reserve Recent Postings.*multi-document index for discovery only/i);
assert.match(SOURCE_DATE_RULES, /index.*Last Update.*not.*document.*publication date/i);

const fedAttributionBundle = (url, publishedAt) => ({
  editionDate: '2026-09-21',
  sources: [{ id: 'fed-item', url, publishedAt, title: 'Synthetic Fed document', sourceType: 'primary' }],
  highlights: [{ headline: 'Synthetic document update.', sourceIds: ['fed-item'] }],
  catalysts: [],
  summary: 'Synthetic attribution fixture.',
});
for (const date of ['2026-07-21', '2026-09-03', '2026-09-18', '2026-09-21']) {
  const candidate = fedAttributionBundle(fedIndex, date);
  const original = structuredClone(candidate);
  assert.throws(() => validateEditorialBundle(candidate), /Federal Reserve Recent Postings index requires/);
  assert.deepEqual(candidate, original, 'Never silently rewrite a source date');
}
const fedFabricated = fedAttributionBundle(fedIndex, '2026-09-18');
Object.assign(fedFabricated.sources[0], {
  verified: true, dateBasis: 'last-updated', documentUrl: fedDocument,
});
assert.throws(() => validateEditorialBundle(fedFabricated), /directly linked dated document/);
const fedNormalized = normalizeBundleDraft({ ...fedFabricated, date: '2026-09-21' });
assert.equal(fedNormalized.sources[0].publishedAt, '2026-09-18');
assert.throws(() => validateEditorialBundle({ ...fedNormalized, editionDate: fedNormalized.date }), /directly linked dated document/);
const fedCatalystOnly = fedAttributionBundle(fedIndex, '2026-09-18');
fedCatalystOnly.highlights = [];
fedCatalystOnly.catalysts = [{ event: 'Synthetic document review', sourceIds: ['fed-item'] }];
assert.throws(() => validateEditorialBundle(fedCatalystOnly), /directly linked dated document/);
assert.doesNotThrow(() => validateEditorialBundle(fedAttributionBundle(fedDocument, '2026-09-18')));
assert.throws(() => validateEditorialBundle(fedAttributionBundle(fedDocument, '2026-09-22')), /dated after the edition/);
assert.throws(() => validateEditorialBundle(fedAttributionBundle(fedDocument, '2026-09-03')), /only stale daily-development sources/);
const fedDiagnostic = safeValidationDiagnostic(`${sourceDateAttributionIssue(fedIndex)} https://example.org/private secret-looking-fixture-value`);
assert.equal(fedDiagnostic.code, 'invalid-source-date', 'Preserve the existing bounded-repair category');
assert.match(fedDiagnostic.reason, /directly linked Federal Reserve document/);
assert.doesNotMatch(fedDiagnostic.reason, /secret-looking-fixture-value|https?:/);

// Run the real importer only in a disposable local directory, without network.
const { mkdir, mkdtemp, readFile, rm, writeFile } = await import('node:fs/promises');
const { tmpdir } = await import('node:os');
const { join } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const { spawnSync } = await import('node:child_process');
const fedRoot = await mkdtemp(join(tmpdir(), 'usd-impact-fed-index-'));
const fedInput = join(fedRoot, 'bundle.json');
const fedOutput = join(fedRoot, 'src/content/news/2026-09-21.md');
const fedArchive = join(fedRoot, 'src/content/news/2026-09-03.md');
const fedOldCatalyst = join(fedRoot, 'src/content/catalyst-briefs/fed-index.md');
const fedArchiveRecord = (url, date) => `---\nstatus: "published"\nsources:\n  - id: "fed-item"\n    url: "${url}"\n    publishedAt: "${date}"\n---\n`;
const fedImportBundle = (url, publishedAt) => ({
  date: '2026-09-21', title: 'Synthetic Fed attribution test',
  generatedAt: '2026-09-21T12:00:00Z', metaDescription: 'Synthetic importer fixture.',
  marketRegime: 'fixture', summary: 'Synthetic source attribution.', catalysts: [],
  highlights: [0, 1, 2].map((index) => ({
    headline: `Synthetic document ${index + 1}`, development: 'Synthetic development.',
    whyItMatters: 'Conditional fixture.', assets: ['DXY'], importance: 'low',
    verification: 'verified-primary', sourceIds: index === 2 ? ['other-item'] : ['fed-item'],
  })),
  sources: [
    { id: 'fed-item', title: 'Synthetic Fed document', publisher: 'Federal Reserve', url, publishedAt, sourceType: 'primary' },
    { id: 'other-item', title: 'Synthetic other document', publisher: 'Fixture', url: 'https://example.org/fixture', publishedAt: '2026-09-18', sourceType: 'primary' },
  ],
});
const fedRunImport = async (candidate, ...flags) => {
  await writeFile(fedInput, JSON.stringify(candidate), 'utf8');
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./import-daily-news.mjs', import.meta.url)), fedInput, ...flags], {
    cwd: fedRoot, encoding: 'utf8', timeout: 10_000,
  });
  assert.equal(result.error, undefined, result.error?.message);
  return result;
};
try {
  await mkdir(join(fedRoot, 'src/content/news'), { recursive: true });
  await mkdir(join(fedRoot, 'src/content/catalyst-briefs'), { recursive: true });
  const savedArchive = fedArchiveRecord(fedIndex, '2026-07-21');
  const savedCatalyst = fedArchiveRecord(fedIndex, '2026-09-03');
  await writeFile(fedArchive, savedArchive);
  await writeFile(fedOldCatalyst, savedCatalyst);
  for (const url of fedIndexVariants) {
    const rejected = await fedRunImport(fedImportBundle(url, '2026-09-18'), '--replace', '--publish');
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /Federal Reserve Recent Postings index requires a directly linked dated document/);
    assert.equal(await readFile(fedArchive, 'utf8'), savedArchive);
    assert.equal(await readFile(fedOldCatalyst, 'utf8'), savedCatalyst);
    await assert.rejects(readFile(fedOutput), { code: 'ENOENT' });
  }
  const direct = await fedRunImport(fedImportBundle(fedDocument, '2026-09-18'), '--replace', '--publish');
  assert.equal(direct.status, 0, direct.stderr);
  const published = await readFile(fedOutput, 'utf8');
  assert.match(published, /^status: "published"$/m);
  assert.equal(await readFile(fedArchive, 'utf8'), savedArchive);
  assert.equal(await readFile(fedOldCatalyst, 'utf8'), savedCatalyst);
  const protectedResult = await fedRunImport(fedImportBundle(fedDocument, '2026-09-18'), '--replace', '--publish');
  assert.notEqual(protectedResult.status, 0);
  assert.match(protectedResult.stderr, /already published and cannot be replaced/);
  const noop = await fedRunImport(fedImportBundle(fedDocument, '2026-09-18'), '--replace', '--skip-published', '--publish');
  assert.equal(noop.status, 0, noop.stderr);
  assert.equal(await readFile(fedOutput, 'utf8'), published);
  await rm(fedOutput);
  await rm(fedArchive);
  await rm(fedOldCatalyst);
  const noHistoryResult = await fedRunImport(fedImportBundle(fedIndex, '2026-09-18'), '--replace');
  assert.notEqual(noHistoryResult.status, 0);
  assert.match(noHistoryResult.stderr, /directly linked dated document/);
  await assert.rejects(readFile(fedOutput), { code: 'ENOENT' });
  const fixedArchive = fedArchiveRecord(fedDocument, '2026-09-17');
  await writeFile(fedArchive, fixedArchive);
  const fixedConflict = await fedRunImport(fedImportBundle(fedDocument, '2026-09-18'), '--replace');
  assert.notEqual(fixedConflict.status, 0);
  assert.match(fixedConflict.stderr, /publishedAt 2026-09-18 conflicts with previously verified 2026-09-17/);
  await writeFile(fedOldCatalyst, fedArchiveRecord(fedDocument, '2026-09-16'));
  const multipleFixedDates = await fedRunImport(fedImportBundle(fedDocument, '2026-09-18'), '--replace');
  assert.notEqual(multipleFixedDates.status, 0);
  assert.match(multipleFixedDates.stderr, /conflicting historical publication dates/);
  assert.equal(await readFile(fedArchive, 'utf8'), fixedArchive);
  await assert.rejects(readFile(fedOutput), { code: 'ENOENT' });
} finally {
  await rm(fedRoot, { recursive: true, force: true });
}

console.log('daily news validation helper tests pass');
