import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { buildCarryForward } from './create-daily-carry-forward.mjs';
import { validateEditorialBundle } from '../src/lib/daily-news-editorial-validation.js';

const editionDate = '2026-11-09';
const archiveDate = '2026-11-06';
const sources = [
  { id: 'bls-employment', title: 'Employment Situation, October 2026',
    publisher: 'U.S. Bureau of Labor Statistics', url: 'https://www.bls.gov/news.release/archives/empsit_11062026.htm',
    publishedAt: '2026-11-06', sourceType: 'primary' },
  { id: 'treasury-refunding', title: 'Quarterly Refunding Statement',
    publisher: 'U.S. Department of the Treasury', url: 'https://home.treasury.gov/news/press-releases/sb0678',
    publishedAt: '2026-11-04', sourceType: 'primary' },
  { id: 'bls-productivity', title: 'Productivity and Costs, Preliminary Third Quarter 2026',
    publisher: 'U.S. Bureau of Labor Statistics', url: 'https://www.bls.gov/news.release/archives/prod2_11052026.htm',
    publishedAt: '2026-11-05', sourceType: 'primary' },
  { id: 'bea-trade', title: 'U.S. International Trade in Goods and Services, September 2026',
    publisher: 'U.S. Bureau of Economic Analysis', url: 'https://www.bea.gov/news/2026/us-international-trade-goods-and-services-september-2026',
    publishedAt: '2026-11-04', sourceType: 'primary' },
];
const archive = { date: archiveDate, status: 'published', sources,
  highlights: [{ headline: 'Synthetic historical article for offline testing' }] };
const generate = (obj = archive, seenDates = new Map(), date = editionDate, prior = archiveDate) =>
  buildCarryForward({ editionDate: date, archive: obj, archiveDate: prior, seenDates,
    generatedAt: '2026-11-09T16:47:00.000Z' });
const page = generate();
const match = page.match(/^---\n([\s\S]*?)\n---\n/);
assert.ok(match);
const front = yaml.load(match[1]);
assert.equal(front.date, editionDate);
assert.equal(front.lastReviewed, editionDate);
assert.equal(front.status, 'published');
assert.equal(front.highlights.length, 4);
assert.equal(front.sources.length, 4);
assert.deepEqual(front.catalysts, []);
assert.equal(front.generatedAt, '2026-11-09T16:47:00.000Z');
assert.match(front.summary, /Carry-forward context/);
assert.match(page, /not a newly reported government release/i);
assert.match(page, /not a new 2026-11-09 release/);
assert.ok(!page.includes('https://www.bls.gov/schedule/2026/11_sched_list.htm'));
validateEditorialBundle({
  editionDate, sources: front.sources, highlights: front.highlights, catalysts: [],
  summary: front.summary, body: page.slice(match[0].length),
});

// Mutable schedules, pointers and unsupported hosts must never count as evidence.
for (const invalidUrl of [
  'https://www.bls.gov/schedule/2026/11_sched_list.htm',
  'https://www.eia.gov/petroleum/supply/weekly/pdf/wpsrall.pdf',
  'https://www.bls.gov.example.org/news.release/archives/empsit_11062026.htm',
]) {
  const modified = { ...archive, sources: sources.slice(0, 2).concat({ ...sources[2], url: invalidUrl }) };
  assert.throws(() => generate(modified), /fewer-than-three-eligible-dated-primary-sources/);
}
assert.throws(() => generate({ ...archive, sources: sources.slice(0, 2) }),
  /fewer-than-three-eligible-dated-primary-sources/);
assert.throws(() => generate({ ...archive, date: '2026-11-09' }),
  /missing-eligible-prior-edition/);
assert.throws(() => generate(archive, new Map(), '2026-11-20'),
  /missing-eligible-prior-edition/);
assert.throws(() => generate({ ...archive, sources: sources.map((x) => ({ ...x, publishedAt: '2026-10-01' })) }),
  /fewer-than-three-eligible-dated-primary-sources/);
assert.throws(() => generate(archive, new Map([[sources[0].url, new Set(['2026-11-06', '2026-11-07'])],
  [sources[1].url, new Set(['2026-11-04', '2026-11-05'])]])),
  /fewer-than-three-eligible-dated-primary-sources/);

// The generated fallback PR body must not accidentally contain GitHub's
// auto-issue-closure syntax. The 2026-11-09 manual-late merge inadvertently
// affected the still-open Daily incident because its PR body used such wording.
const carryforwardWorkflow = readFileSync(
  new URL('../../../.github/workflows/daily-news-late-carryforward.yml', import.meta.url),
  'utf8',
);
const generatedPrBodyLine = carryforwardWorkflow.split('\n')
  .find((line) => /^\s*--body\s+"/.test(line));
assert.ok(generatedPrBodyLine, 'late carry-forward must keep its explicit PR body');
assert.match(generatedPrBodyLine, /Keep Issue #840 OPEN/,
  'the incident remains open until genuine unattended acceptance');
assert.doesNotMatch(generatedPrBodyLine,
  /\b(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+#840\b/i,
  'a negated GitHub closing keyword would still automatically close Issue #840');
console.log('Carry-forward generated PR incident keyword safety PASS.');

console.log('Daily no-paid carry-forward regression PASS: complete content and fail-closed source gates.');
