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

assert.equal(SOURCE_DATE_SCHEMA_PATTERN, '^\\d{4}-\\d{2}-\\d{2}$');
assert.equal(SOURCE_ID_SCHEMA_PATTERN, '^[a-z0-9][a-z0-9-]{1,63}$');
assert.match(SOURCE_DATE_RULES, /YYYY-MM-DD/);
assert.match(SOURCE_DATE_RULES, /omit that source/i);
assert.match(SOURCE_ID_RULES, /never place a URL/i);
assert.match(SOURCE_ID_RULES, /same normalized source id/i);

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
assert.equal(
  safeValidationDiagnostic('unexpected provider detail with a secret-looking value').code,
  'generation-validation-failed',
);

console.log('daily news validation helper tests pass');
