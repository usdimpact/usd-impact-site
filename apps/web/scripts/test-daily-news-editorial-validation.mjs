import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildMetaDescription,
  validateEditorialBundle,
} from '../src/lib/daily-news-editorial-validation.js';

const currentTreasuryUrl = 'https://home.treasury.gov/news/press-releases/sb0590';
const staleTreasuryUrl = 'https://home.treasury.gov/news/press-releases/sb0489';

function source(id, publishedAt, url = 'https://www.bls.gov/news.release/prod2.nr0.htm') {
  return { id, publishedAt, url, sourceType: 'primary' };
}

function bundle(overrides = {}) {
  return {
    editionDate: '2026-08-06',
    sources: [
      source('bls-current', '2026-08-06'),
      source('treasury-current', '2026-08-05', currentTreasuryUrl),
      source('bls-calendar', '2026-06-10', 'https://www.bls.gov/schedule/2026/08_sched_list.htm'),
    ],
    highlights: [
      {
        headline: 'Productivity and labor costs provide a current macro signal.',
        development: 'BLS published the current productivity release.',
        whyItMatters: 'The release may affect rate expectations.',
        sourceIds: ['bls-current'],
      },
      {
        headline: 'Payrolls and CPI are the next scheduled tests.',
        development: 'The official calendar schedules both releases.',
        whyItMatters: 'They may reprice rates and the dollar.',
        sourceIds: ['bls-calendar'],
      },
      {
        headline: 'Treasury refunding auctions remain a funding catalyst.',
        development: 'The current refunding source confirms 10-year note and 30-year bond auctions.',
        whyItMatters: 'Auction demand may influence yields and liquidity.',
        sourceIds: ['treasury-current'],
      },
    ],
    catalysts: [
      { event: 'BLS Employment Situation', sourceIds: ['bls-calendar'] },
      { event: 'BLS Consumer Price Index (CPI)', sourceIds: ['bls-calendar'] },
      { event: 'Treasury 10-year note auction', sourceIds: ['treasury-current'] },
    ],
    summary: 'Payrolls and CPI are the next scheduled systemic catalysts.',
    ...overrides,
  };
}

assert.doesNotThrow(() => validateEditorialBundle(bundle()));

assert.throws(
  () => validateEditorialBundle(bundle({
    sources: [source('future', '2026-08-07')],
    highlights: [{ headline: 'Current release', sourceIds: ['future'] }],
    catalysts: [],
    summary: 'Current release.',
  })),
  /dated after the edition/,
);

assert.throws(
  () => validateEditorialBundle(bundle({
    sources: [source('stale', '2026-05-06')],
    highlights: [{ headline: 'Old material presented as a daily development', sourceIds: ['stale'] }],
    catalysts: [],
    summary: 'Old material.',
  })),
  /only stale daily-development sources/,
);

assert.throws(
  () => validateEditorialBundle(bundle({
    sources: [source('fed-calendar', '2026-07-01', 'https://www.federalreserve.gov/newsevents/2026-july.htm')],
    highlights: [{
      headline: 'No new Federal Reserve policy decision was identified.',
      development: 'The calendar did not show a new policy decision.',
      sourceIds: ['fed-calendar'],
    }],
    catalysts: [],
    summary: 'Treasury remained the only identified driver.',
  })),
  /unsupported absence claim/,
);

assert.throws(
  () => validateEditorialBundle(bundle({
    sources: [source('treasury-stale', '2026-05-06', staleTreasuryUrl)],
    highlights: [{
      headline: 'Treasury confirmed the quarterly refunding announcement occurred yesterday.',
      sourceIds: ['treasury-stale'],
    }],
    catalysts: [],
    summary: 'Treasury refunding is the dominant driver.',
  })),
  /requires a current Treasury refunding or auction source/,
);

assert.throws(
  () => validateEditorialBundle(bundle({ catalysts: [
    { event: 'BLS Employment Situation', sourceIds: ['bls-calendar'] },
    { event: 'Treasury 10-year note auction', sourceIds: ['treasury-current'] },
  ] })),
  /missing from catalysts: inflation/,
);

const longSummary = 'Treasury supply remains important for rates and dollar liquidity. Payrolls and CPI are the next scheduled tests for the policy path, gold, Bitcoin, and U.S. equities. Additional conditional interpretation should not force a search description to end inside a word even when the complete summary is much longer than the metadata field.';
const metaDescription = buildMetaDescription(longSummary, 170);
assert.equal(metaDescription, 'Treasury supply remains important for rates and dollar liquidity. Payrolls and CPI are the next scheduled tests for the policy path, gold, Bitcoin, and U.S. equities.');
assert.ok(metaDescription.length <= 170);
assert.doesNotMatch(metaDescription, /\bAddit$/);

const sourceHandler = await readFile(new URL('../api/daily-news-source.js', import.meta.url), 'utf8');
assert.match(sourceHandler, /check the official current-date release pages/i);
assert.match(sourceHandler, /current quarterly refunding release/i);
assert.match(sourceHandler, /Never retain the claim merely to satisfy the 3-highlight minimum/i);
assert.match(sourceHandler, /confirm the summary is at most 700 characters/i);
assert.match(sourceHandler, /include every Employment Situation, CPI, PCE, and FOMC event/i);

const repairHandler = await readFile(new URL('../api/daily-news-background.js', import.meta.url), 'utf8');
assert.match(repairHandler, /stale daily-development source/i);
assert.match(repairHandler, /unsupported absence claim/i);
assert.match(repairHandler, /current Treasury refunding or auction source/i);
assert.match(repairHandler, /Never retain an unsupported claim merely to satisfy the highlight minimum/i);
assert.match(repairHandler, /fail closed rather than inventing a replacement/i);
assert.match(repairHandler, /fewer than three grounded URLs/i);
assert.match(repairHandler, /Keep at least three distinct permitted sources/i);
assert.match(repairHandler, /Remove every non-matching source/i);
assert.match(repairHandler, /Never reconstruct, replace, or preserve an ungrounded URL/i);
assert.match(repairHandler, /minItems: 3/);

const groundedHandler = await readFile(new URL('../api/daily-news-grounded-background.js', import.meta.url), 'utf8');
assert.match(groundedHandler, /at least three distinct source URLs/i);
assert.match(groundedHandler, /fewer than three grounded URLs/i);
assert.doesNotMatch(groundedHandler, /at least two distinct source URLs/i);

console.log('daily news editorial validation tests pass');
