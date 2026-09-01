import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildMetaDescription,
  validateEditorialBundle,
} from '../src/lib/daily-news-editorial-validation.js';
import { buildRepairOutputSchema } from '../api/daily-news-background.js';

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

function yieldDiscussionBundle() {
  return {
    editionDate: '2026-08-06',
    sources: [
      source('bls-current', '2026-08-06'),
      source('eia-current', '2026-08-06', 'https://www.eia.gov/petroleum/supply/weekly/'),
      source('reuters-current', '2026-08-06', 'https://www.reuters.com/markets/us/'),
    ],
    highlights: [
      {
        headline: 'Productivity and labor costs provide a current macro signal.',
        development: 'BLS published the current productivity release.',
        whyItMatters: 'The release may affect rate expectations.',
        sourceIds: ['bls-current'],
      },
      {
        headline: 'Energy inventory data supplied a current physical-market signal.',
        development: 'EIA published its current weekly petroleum data.',
        whyItMatters: 'Inventory changes can affect oil pricing and inflation expectations.',
        sourceIds: ['eia-current'],
      },
      {
        headline: 'The 10-year Treasury note yield moved with rate expectations.',
        development: 'The 30-year Treasury bond yield also shifted during the session.',
        whyItMatters: 'Maturity yields transmit policy expectations into financing conditions.',
        sourceIds: ['reuters-current'],
      },
    ],
    catalysts: [],
    summary: 'The 10-year Treasury note yield and 30-year Treasury bond yield moved with rate expectations.',
    body: 'The 10-year note yield and 30-year bond yield changed during the session. These are secondary-market yield observations, not claims about a new auction or quarterly refunding announcement.',
  };
}

assert.doesNotThrow(() => validateEditorialBundle(bundle()));

assert.doesNotThrow(
  () => validateEditorialBundle(yieldDiscussionBundle()),
  'ordinary Treasury maturity-yield discussion must not require a current auction or refunding source',
);

const auctionWithoutTreasurySource = yieldDiscussionBundle();
auctionWithoutTreasurySource.highlights[2] = {
  headline: 'Treasury’s 10-year note auction is the next duration test.',
  development: 'The 30-year Treasury bond auction is also in focus.',
  whyItMatters: 'Auction demand may influence yields and liquidity.',
  sourceIds: ['reuters-current'],
};
auctionWithoutTreasurySource.summary = 'The 10-year Treasury note auction is the next supply test.';
auctionWithoutTreasurySource.body = 'The 30-year Treasury bond auction remains in focus.';
assert.throws(
  () => validateEditorialBundle(auctionWithoutTreasurySource),
  /requires a current Treasury refunding or auction source/,
  'explicit note and bond auction claims must still require a current Treasury source',
);

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

for (const treasuryHeadline of [
  'Treasury’s 3‑year and 10‑year auction windows settle next week.',
  'Treasury’s 30–year bond auction remains the duration test.',
]) {
  assert.throws(
    () => validateEditorialBundle(bundle({
      sources: [source('treasury-stale', '2026-05-06', staleTreasuryUrl)],
      highlights: [{
        headline: treasuryHeadline,
        sourceIds: ['treasury-stale'],
      }],
      catalysts: [],
      summary: 'Treasury supply remains in focus.',
    })),
    /requires a current Treasury refunding or auction source/,
  );
}

assert.throws(
  () => validateEditorialBundle(bundle({ catalysts: [
    { event: 'BLS Employment Situation', sourceIds: ['bls-calendar'] },
    { event: 'Treasury 10-year note auction', sourceIds: ['treasury-current'] },
  ] })),
  /missing from catalysts: inflation/,
);

assert.throws(
  () => validateEditorialBundle(bundle({
    sources: [source('treasury-stale', '2026-05-06', staleTreasuryUrl)],
    highlights: [{
      headline: 'Treasury refunding auctions remain a funding catalyst.',
      development: 'The next central-bank decision is also on the watchlist.',
      sourceIds: ['treasury-stale'],
    }],
    catalysts: [],
    summary: 'The next central-bank decision is on the schedule.',
  })),
  (error) => {
    assert.match(error.message, /Highlight 1 requires a current Treasury refunding or auction source/);
    assert.match(error.message, /missing from catalysts: central-bank/);
    return true;
  },
);

assert.throws(
  () => validateEditorialBundle(bundle({
    sources: [
      source('bls-current', '2026-08-06'),
      source('bls-calendar', '2026-06-10', 'https://www.bls.gov/schedule/2026/08_sched_list.htm'),
      source('treasury-stale', '2026-05-06', staleTreasuryUrl),
    ],
    highlights: [
      { headline: 'Current release', sourceIds: ['bls-current'] },
      { headline: 'Payrolls are scheduled next', sourceIds: ['bls-calendar'] },
      { headline: 'CPI is scheduled next', sourceIds: ['bls-calendar'] },
    ],
    catalysts: [
      { event: 'BLS Employment Situation', sourceIds: ['bls-calendar'] },
      { event: 'BLS Consumer Price Index (CPI)', sourceIds: ['bls-calendar'] },
    ],
    body: 'Quarterly refunding remains current. I did not identify another release.\n\nIf you want, I can rerun the search.',
  })),
  (error) => {
    assert.match(error.message, /Source treasury-stale is not referenced by any highlight or catalyst/);
    assert.match(error.message, /Body makes an unsupported absence claim/);
    assert.match(error.message, /Body contains conversational assistant residue/);
    assert.match(error.message, /Body requires a current Treasury refunding or auction source/);
    return true;
  },
);

const longSummary = 'Treasury supply remains important for rates and dollar liquidity. Payrolls and CPI are the next scheduled tests for the policy path, gold, Bitcoin, and U.S. equities. Additional conditional interpretation should not force a search description to end inside a word even when the complete summary is much longer than the metadata field.';
const metaDescription = buildMetaDescription(longSummary, 170);
assert.equal(metaDescription, 'Treasury supply remains important for rates and dollar liquidity. Payrolls and CPI are the next scheduled tests for the policy path, gold, Bitcoin, and U.S. equities.');
assert.ok(metaDescription.length <= 170);
assert.doesNotMatch(metaDescription, /\bAddit$/);

const august13RepairSchema = buildRepairOutputSchema('2026-08-13');
const august13CatalystDates = [
  '2026-08-13',
  '2026-08-14',
  '2026-08-15',
  '2026-08-16',
  '2026-08-17',
  '2026-08-18',
  '2026-08-19',
  '2026-08-20',
];
assert.deepEqual(
  august13RepairSchema.properties.catalysts.items.properties.date,
  { type: 'string', enum: august13CatalystDates },
);
assert.deepEqual(
  buildRepairOutputSchema('2026-08-12').properties.catalysts.items.properties.date.enum,
  [
    '2026-08-12',
    '2026-08-13',
    '2026-08-14',
    '2026-08-15',
    '2026-08-16',
    '2026-08-17',
    '2026-08-18',
    '2026-08-19',
  ],
);
assert.deepEqual(
  august13RepairSchema.properties.catalysts.items.properties.date.enum,
  august13CatalystDates,
);

const sourceHandler = await readFile(new URL('../api/daily-news-source.js', import.meta.url), 'utf8');
assert.match(sourceHandler, /check the official current-date release pages/i);
assert.match(sourceHandler, /current quarterly refunding release/i);
assert.match(sourceHandler, /Never retain the claim merely to satisfy the 3-highlight minimum/i);
assert.match(sourceHandler, /confirm the summary is at most 700 characters/i);
assert.match(sourceHandler, /include every Employment Situation, CPI, PCE, and FOMC event/i);
assert.match(sourceHandler, /central-bank decision language as central-bank catalyst mentions/i);
assert.match(sourceHandler, /Otherwise remove the forward-looking mention/i);
assert.match(sourceHandler, /Never pad the ledger with an unused source/i);
assert.match(sourceHandler, /Do not claim that a release, decision, or source was not found/i);
assert.match(sourceHandler, /Do not include assistant conversation/i);

const repairHandler = await readFile(new URL('../api/daily-news-background.js', import.meta.url), 'utf8');
assert.match(repairHandler, /stale daily-development source/i);
assert.match(repairHandler, /unsupported absence claim/i);
assert.match(repairHandler, /current Treasury refunding or auction source/i);
assert.match(repairHandler, /Never retain an unsupported claim or unused source merely to satisfy a minimum/i);
assert.match(repairHandler, /fail closed rather than inventing a replacement/i);
assert.match(repairHandler, /fewer than three grounded URLs/i);
assert.match(repairHandler, /Keep at least three distinct permitted sources/i);
assert.match(repairHandler, /Remove every non-matching source/i);
assert.match(repairHandler, /Never reconstruct, replace, or preserve an ungrounded URL/i);
assert.match(repairHandler, /complete validation sweep/i);
assert.match(repairHandler, /named error may be only the first defect/i);
assert.match(repairHandler, /After pruning any source or source id, re-evaluate every retained highlight/i);
assert.match(repairHandler, /never leave it supported by only one reporting domain/i);
assert.match(repairHandler, /central-bank decision language as central-bank catalyst mentions/i);
assert.match(repairHandler, /If no supported matching catalyst can be retained, remove the forward-looking mention/i);
assert.match(repairHandler, /exact inclusive window/i);
assert.match(repairHandler, /repair schema rejects every other date/i);
assert.match(repairHandler, /Never move, shorten, or invent an event date/i);
assert.match(repairHandler, /buildRepairOutputSchema\(date\)/);
assert.match(repairHandler, /Re-scan the complete bundle/i);
assert.match(repairHandler, /remove unused ledger padding/i);
assert.match(repairHandler, /Remove every unsupported absence claim from highlights, summary, and body/i);
assert.match(repairHandler, /Remove first-person offers/i);
assert.match(repairHandler, /minItems: 3/);
assert.match(repairHandler, /MAX_REPAIR_ATTEMPTS = 2/);
assert.match(repairHandler, /REPAIR_TOTAL_TIMEOUT_MS = 225_000/);
assert.match(repairHandler, /failed validation after two bounded repair attempts/i);
assert.match(repairHandler, /X-USD-Impact-Repair-Count/);

const groundedHandler = await readFile(new URL('../api/daily-news-grounded-background.js', import.meta.url), 'utf8');
assert.match(groundedHandler, /at least three distinct source URLs/i);
assert.match(groundedHandler, /fewer than three grounded URLs/i);
assert.doesNotMatch(groundedHandler, /at least two distinct source URLs/i);

console.log('daily news editorial validation tests pass');
