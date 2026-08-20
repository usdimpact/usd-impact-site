import assert from 'node:assert/strict';
import {
  normalizeBundleDraft,
  safeValidationDiagnostic,
} from '../api/daily-news-validation.js';

const base = {
  sources: [
    { id: 'fed-source', title: 'Fed', url: 'https://www.federalreserve.gov/example', publishedAt: '2026-08-19' },
    { id: 'eia-source', title: 'EIA', url: 'https://www.eia.gov/example', publishedAt: '2026-08-19' },
    { id: 'bls-source', title: 'BLS', url: 'https://www.bls.gov/example', publishedAt: '2026-08-19' },
  ],
  highlights: [
    { sourceIds: ['fed-source'] },
    { sourceIds: ['eia-source'] },
    { sourceIds: ['bls-source'] },
  ],
};

const nullableCatalysts = normalizeBundleDraft({ ...base, catalysts: null });
assert.deepEqual(nullableCatalysts.catalysts, []);
assert.equal(nullableCatalysts.sources.length, 3);

const missingCatalysts = normalizeBundleDraft({ ...base });
assert.deepEqual(missingCatalysts.catalysts, []);

const malformedCatalysts = normalizeBundleDraft({ ...base, catalysts: { unexpected: true } });
assert.deepEqual(malformedCatalysts.catalysts, { unexpected: true });
assert.equal(
  safeValidationDiagnostic('catalysts must be an array when provided').code,
  'invalid-catalyst-collection',
);

console.log('daily news collection normalization tests pass');
