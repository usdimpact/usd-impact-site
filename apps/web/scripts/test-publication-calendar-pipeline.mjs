import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import handler from '../api/catalyst-brief-source.js';
import {
  CALENDAR_FIELDS, pipelineCalendarCandidate, verifyPipelineCalendar,
  assertPipelineCalendarLease, assertCurrentCpiClaims, archivedCpiIdentity,
} from '../src/lib/publication-calendar-pipeline.js';
import { candidate, scheduleHtml, monthlyHtml, releaseHtml } from './fixtures/publication-calendar.js';
import { selectImportantCatalyst } from '../src/lib/catalyst-briefs.js';

const canonical = Object.fromEntries(CALENDAR_FIELDS.map((key) => [key, candidate[key]]));
const sources = [
  { id: 'bls', title: 'BLS calendar', publisher: 'BLS', url: 'https://www.bls.gov/schedule/news_release/cpi.htm', publishedAt: '2026-09-09', sourceType: 'primary' },
  { id: 'bls-list', title: 'BLS list', publisher: 'BLS', url: 'https://www.bls.gov/schedule/2026/09_sched_list.htm', publishedAt: '2026-09-09', sourceType: 'primary' },
];
const brief = {
  publishable: true, event: candidate.event, calendar: canonical, phase: 'preview', statusLabel: 'scheduled-confirmed',
  eventDate: '2026-09-11', sourceEditionDate: '2026-09-09', asOf: '2026-09-09', lastReviewed: '2026-09-09',
  eventType: 'inflation', importance: 'high', impactScore: 5, whyItMatters: 'The release may change rates expectations.',
  title: `${candidate.event} - What to Watch`, metaTitle: 'CPI preview | USD Impact', metaDescription: 'A verified calendar preview.',
  eventKey: '2026-09-11-bls-consumer-price-index-cpi-for-august-2026',
  slug: '/news/catalysts/2026-09-11-bls-consumer-price-index-cpi-for-august-2026-preview',
  generatedAt: '2026-09-09T18:00:00Z', summary: 'CPI is scheduled for September 11, 2026 at 08:30 Eastern Time.',
  assets: ['DXY', 'U.S. rates'],
  verifiedFacts: [
    { statement: 'CPI is scheduled for September 11, 2026.', verification: 'verified-primary', sourceIds: ['bls'] },
    { statement: 'The reference period is August 2026.', verification: 'verified-primary', sourceIds: ['bls-list'] },
  ],
  transmissionChannels: [{ channel: 'Rates', conditionalImpact: 'Yields may change.' }, { channel: 'Dollar', conditionalImpact: 'DXY may react.' }],
  whatToWatch: ['Headline inflation', 'Core inflation', 'Component detail'], sources,
  complianceNote: 'Educational and informational only. This content is not investment advice.', body: '## Event\n\nRead the release with its component detail.',
};
const daily = {
  ...brief, date: '2026-09-09', title: 'Daily USD Impact', marketRegime: 'Test regime',
  catalysts: [{ date: brief.eventDate, event: brief.event, calendar: canonical, eventType: 'inflation',
    importance: 'high', impactScore: 5, extraBrief: true, assets: brief.assets, whyItMatters: brief.whyItMatters, sourceIds: ['bls'] }],
  highlights: [1, 2, 3].map((number) => ({ headline: `Verified development ${number}`, development: 'Source-backed development.',
    whyItMatters: 'Conditional interpretation.', importance: 'high', verification: 'verified-primary', assets: ['DXY'], sourceIds: ['bls'] })),
};
let count = 0;
const test = async (name, task) => { await task(); count++; };
let clock = Date.parse('2026-09-09T18:00:00Z');
let fetchCount = 0;
const officialFetch = async (url) => {
  fetchCount++;
  const text = String(url);
  const html = text.endsWith('/schedule/news_release/cpi.htm') ? scheduleHtml
    : text.endsWith('/09_sched_list.htm') ? monthlyHtml
    : text.endsWith('/news.release/cpi.nr0.htm') ? releaseHtml() : null;
  assert.notEqual(html, null, `Unexpected live request: ${text}`);
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
};
const options = (kind = 'brief') => ({ kind, boundary: 'test', now: () => clock, fetchImpl: officialFetch });
const expectHold = (task, code) => assert.rejects(task, (error) => error.code === code);
await test('canonical candidate', () => assert.equal(pipelineCalendarCandidate(brief).referencePeriod, '2026-08'));
await test('fresh brief reads three independent official endpoints', async () => {
  fetchCount = 0;
  const lease = await verifyPipelineCalendar(brief, options());
  assert.equal(lease.decision, 'PASS'); assert.equal(fetchCount, 3);
  assert.equal(lease.publicationAuthorized, false);
  assertPipelineCalendarLease(lease, brief, { now: () => clock });
});
await test('daily rows use the same validator', async () => assert.equal((await verifyPipelineCalendar(daily, options('daily'))).decision, 'PASS'));
for (const [name, change, code] of [
  ['missing canonical fields', { calendar: null }, 'HOLD_MISSING_CALENDAR_RECORD'],
  ['unsupported event', { event: 'FOMC decision', calendar: null }, 'HOLD_UNSUPPORTED_EVENT'],
  ['publisher mismatch', { calendar: { ...canonical, publisher: 'Other' } }, 'HOLD_UNSUPPORTED_EVENT'],
  ['reference month mismatch', { calendar: { ...canonical, referencePeriod: '2026-09' } }, 'HOLD_REFERENCE_PERIOD_MISMATCH'],
  ['original date mismatch', { eventDate: '2026-09-10' }, 'HOLD_RELEASE_TIME_MISMATCH'],
  ['clock mismatch', { calendar: { ...canonical, releaseTime: '09:30' } }, 'HOLD_RELEASE_TIME_MISMATCH'],
  ['unsupported release stage', { calendar: { ...canonical, releaseStage: 'revised' } }, 'HOLD_UNSUPPORTED_EVENT'],
  ['missing event label', { event: undefined }, 'HOLD_IDENTITY_MISMATCH'],
  ['fabricated verification field', { calendar: { ...canonical, verified: true } }, 'HOLD_INVALID_CANDIDATE'],
  ['prose wrong date', { summary: 'CPI is scheduled for September 10, 2026.' }, 'HOLD_RELEASE_TIME_MISMATCH'],
  ['prose wrong reference', { summary: 'CPI for September 2026 is scheduled.' }, 'HOLD_REFERENCE_PERIOD_MISMATCH'],
  ['prose wrong clock', { summary: 'CPI is scheduled at 09:30 ET.' }, 'HOLD_RELEASE_TIME_MISMATCH'],
  ['prose wrong offset', { summary: 'CPI is scheduled at 08:30 EST.' }, 'HOLD_RELEASE_TIME_MISMATCH'],
  ['prose ambiguous clock', { summary: 'CPI is scheduled at 08:30.' }, 'HOLD_CALENDAR_CLAIM'],
  ['reference period prose', { summary: 'The reference period is September 2026.' }, 'HOLD_REFERENCE_PERIOD_MISMATCH'],
  ['named CPI period prose', { summary: 'September CPI is scheduled.' }, 'HOLD_REFERENCE_PERIOD_MISMATCH'],
  ['false released preview', { summary: 'CPI was released with its component detail.' }, 'HOLD_CALENDAR_CLAIM'],
  ['watch item wrong date', { whatToWatch: ['Read CPI on September 10, 2026.'] }, 'HOLD_RELEASE_TIME_MISMATCH'],
  ['search description wrong time', { metaDescription: 'CPI at 09:30 ET.' }, 'HOLD_RELEASE_TIME_MISMATCH'],
  ['invalid meridiem clock', { summary: 'CPI at 20:30 a.m. ET.' }, 'HOLD_CALENDAR_CLAIM'],
  ['relative preview', { summary: 'CPI is due tomorrow.' }, 'HOLD_CALENDAR_CLAIM'],
]) await test(name, () => expectHold(() => verifyPipelineCalendar({ ...brief, ...change }, options()), code));
await test('unsupported detected before network', async () => { fetchCount = 0; await expectHold(() => verifyPipelineCalendar({ ...brief, event: 'PPI', calendar: null }, options()), 'HOLD_UNSUPPORTED_EVENT'); assert.equal(fetchCount, 0); });
await test('same identity twice held', () => expectHold(() => verifyPipelineCalendar({ ...daily, catalysts: [daily.catalysts[0], daily.catalysts[0]] }, options('daily')), 'HOLD_DUPLICATE_EVENT'));
await test('no calendar entries is not a PASS stamp', async () => {
  const data = { ...daily, catalysts: [], summary: 'Market review.', body: 'Risk conditions.' };
  assert.equal((await verifyPipelineCalendar(data, options('daily'))).decision, 'NO_CALENDAR_ENTRIES');
});
await test('unmodelled CPI forward mention held', () => expectHold(() => verifyPipelineCalendar({ ...daily, catalysts: [] }, options('daily')), 'HOLD_MISSING_CALENDAR_RECORD'));
await test('forged JSON lease held', async () => {
  const lease = await verifyPipelineCalendar(brief, options());
  assert.throws(() => assertPipelineCalendarLease(JSON.parse(JSON.stringify(lease)), brief), (error) => error.code === 'HOLD_UNTRUSTED_EVIDENCE');
});
await test('changed content invalidates lease', async () => {
  const lease = await verifyPipelineCalendar(brief, options());
  assert.throws(() => assertPipelineCalendarLease(lease, { ...brief, body: 'Changed' }), (error) => error.code === 'HOLD_REVISION_DRIFT');
});
await test('long run expires exactly at release', async () => {
  clock = Date.parse(canonical.releaseAt) - 1;
  const lease = await verifyPipelineCalendar(brief, options());
  assertPipelineCalendarLease(lease, brief, { now: () => clock });
  clock++;
  assert.throws(() => assertPipelineCalendarLease(lease, brief, { now: () => clock }), (error) => error.code === 'HOLD_PREVIEW_EXPIRED');
  await expectHold(() => verifyPipelineCalendar({ ...brief, asOf: '2026-01-01', generatedAt: '2026-01-01T00:00:00Z', calendarDecision: 'PASS' }, options()), 'HOLD_PREVIEW_EXPIRED');
});
await test('schedule time alone never permits an outcome', () => expectHold(() => verifyPipelineCalendar({ ...brief, phase: 'outcome', statusLabel: 'released' }, options()), 'HOLD_OUTCOME_NOT_RELEASED'));
await test('canonical duplicate suppresses date and title variants', () => {
  const row = { ...daily.catalysts[0], date: '2026-09-12', event: 'BLS Consumer Price Index for August 2026' };
  assert.equal(selectImportantCatalyst({ edition: { date: '2026-09-10', catalysts: [row] } }, {
    phase: 'preview', asOf: '2026-09-10', existingIdentities: ['BLS:CPI:2026-08:initial:preview'],
  }), null);
});
await test('duplicate archive identity is bound to month and phase, not a filename', () => {
  const raw = `---\nevent: ${JSON.stringify(brief.event)}\nphase: "preview"\n---\n`;
  assert.equal(archivedCpiIdentity(raw), 'BLS:CPI:2026-08:initial:preview');
  assert.throws(() => archivedCpiIdentity(raw.replace('phase: "preview"', 'phase: "preview"\nphase: "outcome"')), (error) => error.code === 'HOLD_SOURCE_SCHEMA');
});
await test('Daily copy contradiction outside the calendar row is held', () => expectHold(() => verifyPipelineCalendar({ ...daily, summary: 'CPI is scheduled for September 10, 2026.' }, options('daily')), 'HOLD_RELEASE_TIME_MISMATCH'));
const oldFetch = globalThis.fetch;
const oldNow = Date.now;
const oldEnv = Object.fromEntries(['NEWSFEED_BEARER_TOKEN', 'OPENAI_API_KEY', 'OPENAI_NEWS_MODEL'].map((key) => [key, process.env[key]]));
try {
  process.env.NEWSFEED_BEARER_TOKEN = 'calendar-test-only'; process.env.OPENAI_API_KEY = 'calendar-mock-only';
  let aiCalls = 0;
  let crossRelease = false;
  const result = () => ({ status: 'completed', output: [
    { type: 'web_search_call', action: { sources: sources.map(({ url }) => ({ type: 'url', url })) } },
    { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(brief), annotations: [] }] },
  ] });
  globalThis.fetch = async (url, init) => {
    if (String(url) !== 'https://api.openai.com/v1/responses') return officialFetch(url, init);
    aiCalls++; if (crossRelease) clock = Date.parse(canonical.releaseAt);
    return new Response(JSON.stringify(result()), { headers: { 'Content-Type': 'application/json' } });
  };
  Date.now = () => clock;
  const invoke = async (input = brief) => {
    const response = { statusCode: 0, setHeader() {}, end(body) { this.body = JSON.parse(body); } };
    await handler({ method: 'POST', headers: { authorization: 'Bearer calendar-test-only' }, body: { candidate: input } }, response);
    return response;
  };
  await test('API late preview uses zero AI calls', async () => { aiCalls = 0; const output = await invoke(); assert.equal(output.statusCode, 409); assert.equal(aiCalls, 0); assert.equal(output.body.calendarDecision, 'HOLD_PREVIEW_EXPIRED'); });
  await test('API correct preview passes independent pre and post checks', async () => {
    clock = Date.parse('2026-09-09T18:00:00Z'); aiCalls = 0;
    const output = await invoke(); assert.equal(output.statusCode, 200); assert.equal(aiCalls, 1); assert.deepEqual(output.body.calendar, canonical);
  });
  await test('API generation crossing release is held without paid repair', async () => {
    clock = Date.parse(canonical.releaseAt) - 1; aiCalls = 0; crossRelease = true;
    const output = await invoke(); assert.equal(output.statusCode, 409); assert.equal(output.body.calendarDecision, 'HOLD_PREVIEW_EXPIRED'); assert.equal(aiCalls, 1);
  });
} finally {
  globalThis.fetch = oldFetch; Date.now = oldNow;
  for (const [key, value] of Object.entries(oldEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
}
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'calendar558-ingress-'));
try {
  const bootstrap = path.join(temp, 'test-clock-and-sources.mjs');
  const fixtureUrl = new URL('./fixtures/publication-calendar.js', import.meta.url).href;
  const setup = async (at, deny = false) => fs.writeFile(bootstrap, `import { scheduleHtml, monthlyHtml, releaseHtml } from ${JSON.stringify(fixtureUrl)};\nDate.now = () => ${at};\nglobalThis.fetch = async (url) => { if (${deny}) throw new Error('Unexpected network'); const text=String(url); const html=text.endsWith('/schedule/news_release/cpi.htm')?scheduleHtml:text.endsWith('/09_sched_list.htm')?monthlyHtml:text.endsWith('/news.release/cpi.nr0.htm')?releaseHtml():null; if(html===null)throw new Error('Unexpected URL'); return new Response(html,{headers:{'Content-Type':'text/html'}}); };\n`);
  const run = async (kind, payload, at, flags = ['--publish'], deny = false) => {
    await setup(at, deny); const input = path.join(temp, 'bundle.json'); await fs.writeFile(input, JSON.stringify(payload));
    const importer = fileURLToPath(new URL(`./import-${kind === 'daily' ? 'daily-news' : 'catalyst-brief'}.mjs`, import.meta.url));
    return spawnSync(process.execPath, ['--import', bootstrap, importer, input, ...flags], { cwd: temp, encoding: 'utf8' });
  };
  for (const [kind, payload, target] of [
    ['brief', brief, `src/content/catalyst-briefs/${brief.slug.split('/').at(-1)}.md`],
    ['daily', daily, 'src/content/news/2026-09-09.md'],
  ]) {
    await test(`${kind} importer blocks new expired/backdated publication`, async () => {
      const output = await run(kind, { ...payload, generatedAt: '2020-01-01T00:00:00Z' }, Date.parse(canonical.releaseAt));
      assert.equal(output.status, 2, output.stderr); assert.match(output.stderr, /HOLD_PREVIEW_EXPIRED/);
      await assert.rejects(() => fs.readFile(path.join(temp, target)), /ENOENT/);
    });
    await test(`${kind} importer publishes valid guarded bytes in fixture only`, async () => {
      const output = await run(kind, payload, Date.parse('2026-09-09T18:00:00Z'));
      assert.equal(output.status, 0, output.stderr); const raw = await fs.readFile(path.join(temp, target), 'utf8');
      assert.match(raw, /calendar: \{"publisher":"BLS","series":"CPI"/); assert.match(raw, /^status: "published"$/m);
    });
    if (kind === 'brief') await test('direct importer cannot duplicate the same month/phase under a changed URL', async () => {
      const revisedKey = brief.eventKey + '-another-title';
      const output = await run(kind, { ...payload, eventKey: revisedKey, slug: `/news/catalysts/${revisedKey}-preview` }, Date.parse('2026-09-09T18:00:00Z'));
      assert.equal(output.status, 2, output.stderr); assert.match(output.stderr, /HOLD_DUPLICATE_EVENT/);
      await assert.rejects(() => fs.readFile(path.join(temp, `src/content/catalyst-briefs/${revisedKey}-preview.md`)), /ENOENT/);
    });
    await test(`${kind} unchanged archived skip avoids live revalidation`, async () => {
      const before = await fs.readFile(path.join(temp, target), 'utf8');
      const output = await run(kind, payload, Date.parse('2027-01-01T00:00:00Z'), ['--publish', '--skip-published'], true);
      assert.equal(output.status, 0, output.stderr); assert.equal(await fs.readFile(path.join(temp, target), 'utf8'), before);
    });
  }
} finally { await fs.rm(temp, { recursive: true, force: true }); }
console.log(`Publication calendar pipeline: ${count} regression groups passed (mocked network/clock; no live generation or publication).`);
