import assert from 'node:assert/strict';
import { BLS_MONTHLY_SERIES, blsMonthlyDefinition, explicitBlsMonthlyLabel } from '../src/lib/publication-calendar-series.js';
import { parseBlsMonthlyRelease, parseBlsMonthlyReleaseSchedule, confirmBlsMonthlySchedule, loadBlsCpiCalendar, readOfficialBlsHtml } from '../src/lib/bls-cpi-calendar.js';
import { verifyPublicationCalendar } from '../src/lib/publication-calendar.js';
import { CALENDAR_FIELDS, explicitCpiIdentity, archivedCpiIdentity, pipelineCalendarCandidate, verifyPipelineCalendar } from '../src/lib/publication-calendar-pipeline.js';
import { runCalendarProbe } from './probe-publication-calendar.mjs';
import { multiCandidate, multiSchedule, multiMonthly, multiRelease, multiFetch, releaseDates } from './fixtures/publication-calendar-multiseries.js';
let tests = 0;
const test = async (name, task) => { try { await task(); tests++; } catch (error) { error.message = `${name}: ${error.message}`; throw error; } };
const rejected = (task, code) => assert.rejects(task, (error) => error.code === code);
const record = (candidate) => Object.fromEntries(CALENDAR_FIELDS.map((key) => [key, candidate[key]]));
const before = Date.parse('2026-09-01T10:00:00Z');
const seriesNames = Object.keys(BLS_MONTHLY_SERIES);
for (const series of seriesNames) {
  const candidate = multiCandidate(series), instant = Date.parse(candidate.releaseAt);
  const verify = (input = candidate, now = before, options = {}) => verifyPublicationCalendar(input, { now: () => now, fetchImpl: multiFetch(options) });
  await test(`${series}: explicit canonical identity`, () => assert.equal(explicitCpiIdentity(candidate.event), `BLS:${series}:2026-08:initial`));
  await test(`${series}: national schedule nested layout`, () => assert.equal(parseBlsMonthlyReleaseSchedule(multiSchedule(series), '2026-08', series).eventDate, releaseDates[series]));
  await test(`${series}: independent monthly confirmation`, () => confirmBlsMonthlySchedule(multiMonthly(), candidate));
  await test(`${series}: separately matching results`, () => assert.equal(parseBlsMonthlyRelease(multiRelease(series), series).releaseAt, candidate.releaseAt));
  await test(`${series}: no fabricated missing year`, () => assert.equal(explicitBlsMonthlyLabel(candidate.event.replace(' 2026', '')), null));
  await test(`${series}: old results allow only a future preview`, async () => assert.equal((await verify()).decision, 'PASS'));
  await test(`${series}: one millisecond before release`, async () => assert.equal((await verify(candidate, instant - 1)).decision, 'PASS'));
  await test(`${series}: exact release boundary`, async () => assert.equal((await verify(candidate, instant)).decision, 'HOLD_PREVIEW_EXPIRED'));
  await test(`${series}: after release boundary`, async () => assert.equal((await verify(candidate, instant + 1)).decision, 'HOLD_PREVIEW_EXPIRED'));
  await test(`${series}: scheduled time is not results`, async () => assert.equal((await verify({ ...candidate, phase: 'outcome', statusLabel: 'released' }, instant, {})).decision, 'HOLD_OUTCOME_NOT_RELEASED'));
  await test(`${series}: matching outcome after release`, async () => assert.equal((await verify({ ...candidate, phase: 'outcome', statusLabel: 'released' }, instant, { released: true })).decision, 'PASS'));
  await test(`${series}: embargoed artifact cannot authorize outcome`, async () => assert.equal((await verify({ ...candidate, phase: 'outcome', statusLabel: 'released' }, instant - 1, { released: true })).decision, 'HOLD_OUTCOME_NOT_RELEASED'));
  await test(`${series}: inconsistent original period`, async () => assert.equal((await verify({ ...candidate, referencePeriod: '2026-09' })).decision, 'HOLD_REFERENCE_PERIOD_MISMATCH'));
  await test(`${series}: original date cannot be changed to official date silently`, () => assert.throws(() => pipelineCalendarCandidate({ ...candidate, calendar: record(candidate), eventDate: '2026-09-02' }), (error) => error.code === 'HOLD_RELEASE_TIME_MISMATCH'));
  await test(`${series}: archive identity deduplicates by month and phase`, () => assert.equal(archivedCpiIdentity(`---\nevent: ${JSON.stringify(candidate.event)}\nphase: "preview"\n---\n`), `BLS:${series}:2026-08:initial:preview`));
  await test(`${series}: trace source paths and bounded transport`, async () => {
    const requests = [];
    const result = await verify(candidate, before, { observe: (url, options) => {
      assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'manual'); assert.equal(options.headers.Authorization, undefined); requests.push(url);
    } });
    assert.equal(result.decision, 'PASS'); assert.equal(requests.length, 3);
    assert.equal(requests[0], `https://www.bls.gov/schedule/news_release/${BLS_MONTHLY_SERIES[series].slug}.htm`);
    assert.equal(requests[2], `https://www.bls.gov/news.release/${BLS_MONTHLY_SERIES[series].slug}.nr0.htm`);
  });
  await test(`${series}: standalone probe works with synthetic direct reads`, async () => {
    const output = [];
    const result = await runCalendarProbe(['2026-08', series], { write: (value) => output.push(value), read: (url) => readOfficialBlsHtml(url, { now: () => before, fetchImpl: multiFetch() }) });
    assert.equal(result, 0); assert.equal(JSON.parse(output[0]).event.series, series);
    assert.equal(JSON.parse(output[0]).publicationAuthorized, false);
  });
  for (const number of ['', 'USDL 26-1234', 'USDL-26-1234']) {
    await test(`${series}: recognized official release-number syntax ${number}`, () => assert.equal(parseBlsMonthlyRelease(multiRelease(series, { number }), series).referencePeriod, '2026-08'));
  }
  await test(`${series}: malformed extra timestamp-prefix text held`, () => assert.throws(() => parseBlsMonthlyRelease(multiRelease(series, { number: 'ignore this arbitrary text' }), series), (error) => error.code === 'HOLD_OUTCOME_NOT_RELEASED'));
  await test(`${series}: ambiguous doubled artifact held`, () => assert.throws(() => parseBlsMonthlyRelease(multiRelease(series) + multiRelease(series), series), (error) => error.code === 'HOLD_OUTCOME_NOT_RELEASED'));
  await test(`${series}: monthly identity cannot be replaced with Real Earnings`, () => assert.throws(() => confirmBlsMonthlySchedule(multiMonthly().replace(`${BLS_MONTHLY_SERIES[series].name} for August`, 'Real Earnings for August'), candidate), (error) => error.code === 'HOLD_SCHEDULE_CONFLICT'));
  for (const other of seriesNames.filter((value) => value !== series)) {
    await test(`${series}: ${other} schedule cannot satisfy it`, async () => assert.equal((await verify(candidate, before, { scheduleSeries: other })).decision, 'HOLD_IDENTITY_MISMATCH'));
    await test(`${series}: ${other} results cannot satisfy it`, async () => assert.equal((await verify(candidate, before, { releaseSeries: other })).decision, 'HOLD_OUTCOME_NOT_RELEASED'));
    await test(`${series}: ${other} label cannot satisfy it`, async () => assert.equal((await verify({ ...candidate, event: multiCandidate(other).event })).decision, 'HOLD_IDENTITY_MISMATCH'));
  }
}
await test('all three series in one Daily retain their separate source decisions', async () => {
  const catalysts = seriesNames.map((series) => { const candidate = multiCandidate(series); return { event: candidate.event, date: candidate.eventDate, calendar: record(candidate) }; });
  const result = await verifyPipelineCalendar({ catalysts }, { kind: 'daily', boundary: 'test', now: () => before, fetchImpl: multiFetch() });
  assert.equal(result.decision, 'PASS'); assert.equal(result.decisions.length, 3);
  assert.equal(new Set(result.decisions.map((entry) => entry.eventIdentity)).size, 3);
});
for (const series of ['PPI', 'EMPSIT']) {
  await test(`a CPI row does not authorize missing ${series} forward-looking prose`, async () => {
    const cpi = multiCandidate('CPI');
    await rejected(() => verifyPipelineCalendar({ catalysts: [{ event: cpi.event, date: cpi.eventDate, calendar: record(cpi) }], body: `${BLS_MONTHLY_SERIES[series].name} is scheduled next week.` }, { kind: 'daily', now: () => before, fetchImpl: multiFetch() }), 'HOLD_MISSING_CALENDAR_RECORD');
  });
}
await test('unsupported BEA record stays held rather than disappearing', async () => {
  await rejected(() => verifyPipelineCalendar({ catalysts: [{ event: 'BEA Personal Income and Outlays', date: '2026-09-25', calendar: null }] }, { kind: 'daily', now: () => before, fetchImpl: multiFetch() }), 'HOLD_UNSUPPORTED_EVENT');
});
for (const value of ['__proto__', 'constructor', 'Real Earnings', 'PCE', null, {}]) await test('unregistered identifiers cannot become adapters', () => assert.equal(blsMonthlyDefinition(value), null));
await test('CPI-only compatibility loader rejects another series', () => rejected(() => loadBlsCpiCalendar(multiCandidate('PPI'), { fetchImpl: multiFetch() }), 'HOLD_IDENTITY_MISMATCH'));
console.log(`Publication calendar multi-series: ${tests} regression groups passed (synthetic CPI/PPI/Employment fixtures; no live-source or release certification).`);
