import assert from 'node:assert/strict';
import { validateEditorialBundle } from '../src/lib/daily-news-editorial-validation.js';

const treasuryBuybackSource = {
  id: 'treasury-buyback',
  title: 'Treasury Announces Increased Sizes of Nominal Long-End Liquidity Support Buybacks Beginning September 9',
  publisher: 'U.S. Department of the Treasury',
  url: 'https://home.treasury.gov/news/press-releases/sb0607',
  publishedAt: '2026-08-19',
  sourceType: 'primary',
};

const base = {
  editionDate: '2026-08-20',
  sources: [treasuryBuybackSource],
  highlights: [{
    headline: 'Treasury increased long-end liquidity-support buyback sizes.',
    development: 'Treasury announced larger operations for longer-dated nominal sectors.',
    whyItMatters: 'The change is intended to support secondary-market liquidity and market functioning.',
    sourceIds: ['treasury-buyback'],
  }],
  catalysts: [],
  summary: 'Treasury increased long-end liquidity-support buyback sizes to support market functioning.',
  body: 'Treasury buybacks may support liquidity in less-liquid off-the-run securities.',
};

assert.doesNotThrow(() => validateEditorialBundle(base));
assert.throws(
  () => validateEditorialBundle({
    ...base,
    body: 'Treasury buybacks reduce net Treasury supply.',
  }),
  /mechanically reducing or offsetting Treasury supply/i,
);
assert.throws(
  () => validateEditorialBundle({
    ...base,
    body: 'Sources (ledger)\n- duplicate source payload',
  }),
  /duplicates the structured source ledger/i,
);
assert.throws(
  () => validateEditorialBundle({
    ...base,
    body: 'Publication date: 2026-08-??.',
  }),
  /unresolved date placeholder/i,
);

console.log('daily news guard fixture tests pass');
