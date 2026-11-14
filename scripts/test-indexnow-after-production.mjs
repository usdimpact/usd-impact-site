import assert from 'node:assert/strict';
import { LEGACY_CATALYST_PUBLICATION_PINS } from '../apps/web/src/lib/catalyst-first-publication-policy.js';
import { notifyChangedPublicationUrls, selectIndexNowUrls } from './submit-indexnow-after-production.mjs';

const catalystPath = (slug) => 'apps/web/src/content/catalyst-briefs/' + slug + '.md';
const slug = (file) => file.slice(file.lastIndexOf('/') + 1, -3);
const published = catalystPath('2026-11-14-fixture-verified-outcome');
const review = catalystPath('2026-11-12-eia-weekly-petroleum-status-report-veterans-day-adjusted-publication-outcome');
const draft = catalystPath('2026-11-14-fixture-draft-outcome');
const ready = catalystPath('2026-11-14-fixture-ready-outcome');
const noDate = catalystPath('2026-11-14-fixture-missing-first-date-outcome');
const invalidDate = catalystPath('2026-11-14-fixture-invalid-date-outcome');
const wrongSlug = catalystPath('2026-11-14-fixture-wrong-slug-outcome');
const backdated = catalystPath('2026-11-14-fixture-backdated-outcome');
const futureDate = catalystPath('2026-11-14-fixture-future-date-outcome');
const preparedAfter = catalystPath('2026-11-14-fixture-prepared-after-publication-outcome');
const duplicated = catalystPath('2026-11-14-fixture-duplicated-status-outcome');
const news = 'apps/web/src/content/news/2026-11-13.md';
const unpublishedNews = 'apps/web/src/content/news/2026-11-14.md';
const pin = LEGACY_CATALYST_PUBLICATION_PINS[0];
const legacy = catalystPath(pin.slug.split('/').at(-1));
const alteredLegacy = catalystPath('2026-08-12-fixture-unpinned-legacy-preview');
const allLegacy = LEGACY_CATALYST_PUBLICATION_PINS.map((record) => catalystPath(record.slug.split('/').at(-1)));
const weekly = 'apps/web/src/content/weekly-reports/2026-11-13.md';
const monthly = 'apps/web/src/content/monthly-reports/2026-11-13.md';
const unpublishedWeekly = 'apps/web/src/content/weekly-reports/2026-11-14.md';
const unpublishedMonthly = 'apps/web/src/content/monthly-reports/2026-11-14.md';
assert.equal(allLegacy.length, 15, 'All 15 pinned Catalyst exceptions must be tested');

const fixture = (metadata) => '---\n' + Object.entries(metadata)
  .map(([name, value]) => name + ': ' + JSON.stringify(value)).join('\n') + '\n---\n\nFixture body.\n';
const prospective = (file) => ({
  slug: '/news/catalysts/' + slug(file),
  eventKey: '2026-11-14-fixture-event',
  phase: 'outcome',
  eventDate: '2026-11-12',
  generatedAt: '2026-11-13T17:08:00Z',
  lastReviewed: '2026-11-14',
  status: 'published',
  firstPublishedDate: '2026-11-14',
});
const sources = new Map([
  [published, fixture(prospective(published))],
  [review, fixture({ ...prospective(review), status: 'review' })],
  [draft, fixture({ ...prospective(draft), status: 'draft' })],
  [ready, fixture({ ...prospective(ready), status: 'ready-for-build' })],
  [noDate, fixture({ ...prospective(noDate), firstPublishedDate: undefined }).replace(/^firstPublishedDate:.*\n/m, '')],
  [invalidDate, fixture({ ...prospective(invalidDate), firstPublishedDate: '2026-11-31' })],
  [wrongSlug, fixture({ ...prospective(wrongSlug), slug: '/news/catalysts/other' })],
  [backdated, fixture({ ...prospective(backdated), firstPublishedDate: '2026-11-12' })],
  [futureDate, fixture({ ...prospective(futureDate), firstPublishedDate: '2099-01-01' })],
  [preparedAfter, fixture({ ...prospective(preparedAfter), generatedAt: '2026-11-15T00:00:00Z' })],
  [duplicated, fixture(prospective(duplicated)).replace(/status: "published"/, 'status: "published"\nstatus: "review"')],
  ...LEGACY_CATALYST_PUBLICATION_PINS.map((record) => [catalystPath(record.slug.split('/').at(-1)), fixture({ ...record, status: 'published' })]),
  [alteredLegacy, fixture({ ...pin, status: 'published', slug: '/news/catalysts/' + slug(alteredLegacy), generatedAt: '2026-11-14T00:00:00Z' })],
  [news, fixture({ status: 'published', slug: '/news/2026-11-13' })],
  [unpublishedNews, fixture({ status: 'review', slug: '/news/2026-11-14' })],
  [weekly, fixture({ status: 'published', slug: '/reports/weekly/2026-11-13' })],
  [monthly, fixture({ status: 'published', slug: '/reports/monthly/2026-11-13' })],
  [unpublishedWeekly, fixture({ status: 'review', slug: '/reports/weekly/2026-11-14' })],
  [unpublishedMonthly, fixture({ status: 'draft', slug: '/reports/monthly/2026-11-14' })],
]);
const readSource = async (file) => {
  if (!sources.has(file)) throw new Error('Fixture missing: ' + file);
  return sources.get(file);
};

const withheld = [review, draft, ready, noDate, invalidDate, wrongSlug, duplicated, alteredLegacy, backdated, futureDate, preparedAfter, unpublishedNews, unpublishedWeekly, unpublishedMonthly];
assert.deepEqual(await selectIndexNowUrls(withheld, { readSource }), [], 'No unpublished/malformed URL may be notified');
let requests = 0;
assert.equal(await notifyChangedPublicationUrls(withheld, {
  readSource,
  send: async () => { requests += 1; throw new Error('UNEXPECTED INDEXNOW REQUEST'); },
}), 0);
assert.equal(requests, 0, 'IndexNow must not be contacted when only unpublished files changed');

const allow = [published, ...allLegacy, news, weekly, monthly];
const expected = allow.map((file) => {
  if (file === news) return 'https://www.usd-impact.com/news/2026-11-13';
  if (file === weekly) return 'https://www.usd-impact.com/reports/weekly/2026-11-13';
  if (file === monthly) return 'https://www.usd-impact.com/reports/monthly/2026-11-13';
  return 'https://www.usd-impact.com/news/catalysts/' + slug(file);
});
assert.deepEqual(await selectIndexNowUrls(allow, { readSource }), expected, 'Only new-dated, pinned-legacy and published Daily URLs are eligible');
const sent = [];
assert.equal(await notifyChangedPublicationUrls([...withheld, ...allow], {
  readSource,
  send: async (endpoint, options) => {
    assert.equal(endpoint, 'https://api.indexnow.org/indexnow');
    assert.equal(options.method, 'POST');
    sent.push(JSON.parse(options.body));
    return { status: 202 };
  },
}), allow.length);
assert.equal(sent.length, 1, 'Only one mocked IndexNow call may occur');
assert.deepEqual(sent[0].urlList, expected, 'The mock receives published-only URLs');
assert.equal(sent[0].host, 'www.usd-impact.com');
assert.deepEqual(await selectIndexNowUrls([published, published, legacy], { readSource }), expected.slice(0, 2), 'URLs are deduplicated');
assert.deepEqual(await selectIndexNowUrls(['unknown/file.md', review], { readSource }), [], 'Unknown or review routes remain ineligible');
console.log('IndexNow published-only offline fixtures PASS; all 15 legacy pins plus Daily, Weekly, Monthly and date failures; zero real network requests.');
