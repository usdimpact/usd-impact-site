import assert from 'node:assert/strict';
import {
  SOURCE_DATE_RULES,
  SOURCE_DATE_SCHEMA_PATTERN,
  normalizeBundleDraft,
  normalizePublishedAt,
  safeValidationDiagnostic,
} from '../api/daily-news-validation.js';

assert.equal(SOURCE_DATE_SCHEMA_PATTERN, '^\\d{4}-\\d{2}-\\d{2}$');
assert.match(SOURCE_DATE_RULES, /YYYY-MM-DD/);
assert.match(SOURCE_DATE_RULES, /omit that source/i);

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

assert.deepEqual(
  safeValidationDiagnostic('Source fed-calendar has an invalid publishedAt value'),
  {
    code: 'invalid-source-date',
    reason: 'One or more source publication dates are invalid. Use a verified YYYY-MM-DD value or omit the undated source.',
  },
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
