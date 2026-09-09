import assert from 'node:assert/strict';
import { runCalendarCheck } from './check-publication-calendar.mjs';
import {
  CALENDAR_MAX_AGE_MS, calendarIdentity, checkCalendarDecisionFreshness, classifyPublicationSnapshots, localReleaseInstant,
  normalizeCalendarCandidate, verifyPublicationCalendar,
} from '../src/lib/publication-calendar.js';
import {
  BLS_CPI_RELEASE, BLS_CPI_SCHEDULE, confirmBlsMonthlySchedule, parseBlsCpiRelease,
  parseBlsCpiSchedule, readOfficialBlsHtml,
} from '../src/lib/bls-cpi-calendar.js';
import { binding, candidate, monthlyHtml, releaseHtml, scheduleHtml } from './fixtures/publication-calendar.js';

const BEFORE = Date.parse('2026-09-11T12:29:59.999Z');
const AT = Date.parse('2026-09-11T12:30:00Z');
const EARLIER = Date.parse('2026-09-09T18:00:00Z');
let tests = 0;
const test = async (name, fn) => { await fn(); tests += 1; };
function fakeFetch({ schedule = scheduleHtml, monthly = monthlyHtml, release = releaseHtml(), status = 200, headers = {}, onFetch } = {}) {
  return async (url, options) => {
    onFetch?.(url, options);
    const body = url === BLS_CPI_SCHEDULE ? schedule : url === BLS_CPI_RELEASE ? release : monthly;
    return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers } });
  };
}
const verify = (value = candidate, time = EARLIER, responses = {}, extra = {}) => verifyPublicationCalendar(value, {
  now: () => time, fetchImpl: fakeFetch(responses), binding, ...extra,
});
const expectHold = async (code, value = candidate, time = EARLIER, responses = {}, extra = {}) => {
  const result = await verify(value, time, responses, extra);
  assert.equal(result.decision, code);
  assert.equal(result.publicationAttempted, false);
  assert.equal(result.publicationAuthorized, false);
};
const throwsHold = (fn, code) => assert.throws(fn, (error) => error.code === code);

await test('correct August CPI before release', async () => {
  const result = await verify();
  assert.equal(result.decision, 'PASS');
  assert.equal(result.eventIdentity, 'BLS:CPI:2026-08:initial');
  assert.equal(result.sources.length, 3);
  assert.ok(result.sources.every((source) => /^[a-f0-9]{64}$/.test(source.sha256)));
  assert.equal(result.validUntil, new Date(EARLIER + CALENDAR_MAX_AGE_MS).toISOString());
  assert.equal(result.publicationAuthorized, false);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.event) && Object.isFrozen(result.sources[0]));
});
await test('wrong CPI date', () => expectHold('HOLD_RELEASE_TIME_MISMATCH', { ...candidate, eventDate: '2026-09-10', releaseAt: '2026-09-10T12:30:00Z' }));
await test('PPI cannot satisfy CPI', () => expectHold('HOLD_UNSUPPORTED_EVENT', { ...candidate, series: 'PPI' }));
await test('Real Earnings cannot satisfy CPI', () => expectHold('HOLD_UNSUPPORTED_EVENT', { ...candidate, series: 'Real Earnings' }));
await test('wrong issuing organization', () => expectHold('HOLD_UNSUPPORTED_EVENT', { ...candidate, publisher: 'Eurostat' }));
await test('conflicting label and structured period', () => expectHold('HOLD_REFERENCE_PERIOD_MISMATCH', { ...candidate, referencePeriod: '2026-09' }));
await test('missing reference month/year', () => expectHold('HOLD_REFERENCE_PERIOD_MISMATCH', { ...candidate, referencePeriod: 'August' }));
await test('missing release stage', () => expectHold('HOLD_UNSUPPORTED_EVENT', { ...candidate, releaseStage: undefined }));
await test('wrong estimate/revision stage', () => expectHold('HOLD_UNSUPPORTED_EVENT', { ...candidate, releaseStage: 'revised' }));
await test('conflicting editorial identity', () => expectHold('HOLD_IDENTITY_MISMATCH', { ...candidate, event: 'BLS Producer Price Index for August 2026' }));
await test('foreign/regional CPI title', () => expectHold('HOLD_IDENTITY_MISMATCH', { ...candidate, event: 'Germany Consumer Price Index for August 2026' }));
await test('one millisecond before release', async () => assert.equal((await verify(candidate, BEFORE)).decision, 'PASS'));
await test('exactly at release', () => expectHold('HOLD_PREVIEW_EXPIRED', candidate, AT));
await test('one millisecond after release', () => expectHold('HOLD_PREVIEW_EXPIRED', candidate, AT + 1));
await test('summer timezone conversion', () => assert.equal(localReleaseInstant('2026-09-11', '08:30'), '2026-09-11T12:30:00.000Z'));
await test('winter timezone conversion', () => assert.equal(localReleaseInstant('2026-11-10', '08:30'), '2026-11-10T13:30:00.000Z'));
await test('local/UTC date rollover', () => assert.equal(localReleaseInstant('2026-09-11', '23:30'), '2026-09-12T03:30:00.000Z'));
await test('nonexistent DST clock rejected', () => throwsHold(() => localReleaseInstant('2026-03-08', '02:30'), 'HOLD_RELEASE_TIME_MISMATCH'));
await test('ambiguous DST clock rejected', () => throwsHold(() => localReleaseInstant('2026-11-01', '01:30'), 'HOLD_RELEASE_TIME_MISMATCH'));
await test('invalid calendar date rejected', () => expectHold('HOLD_RELEASE_TIME_MISMATCH', { ...candidate, eventDate: '2026-02-30' }));
await test('invalid clock rejected', () => expectHold('HOLD_RELEASE_TIME_MISMATCH', { ...candidate, releaseTime: '24:30' }));
await test('fixed EST offset rejected in summer', () => expectHold('HOLD_RELEASE_TIME_MISMATCH', { ...candidate, releaseAt: '2026-09-11T13:30:00Z' }));
await test('timezone abbreviation rejected', () => expectHold('HOLD_RELEASE_TIME_MISMATCH', { ...candidate, timeZone: 'EST' }));
await test('missing official reference period', () => expectHold('HOLD_REFERENCE_PERIOD_MISMATCH', { ...candidate, referencePeriod: '2027-01', event: 'BLS Consumer Price Index for January 2027' }));
await test('December/January year rollover', () => assert.equal(parseBlsCpiSchedule(scheduleHtml, '2025-12').eventDate, '2026-01-13'));
await test('changed source headers', () => expectHold('HOLD_SOURCE_SCHEMA', candidate, EARLIER, { schedule: scheduleHtml.replace('Reference Month', 'Month') }));
await test('wrong official series heading', () => expectHold('HOLD_IDENTITY_MISMATCH', candidate, EARLIER, { schedule: scheduleHtml.replace('Consumer Price Index', 'Producer Price Index') }));
await test('duplicate official period', () => expectHold('HOLD_SCHEDULE_CONFLICT', candidate, EARLIER, { schedule: scheduleHtml.replace('</tbody>', '<tr><td>August 2026</td><td>Sep. 11, 2026</td><td>08:30 AM</td></tr></tbody>') }));
await test('two matching official tables', () => expectHold('HOLD_SOURCE_SCHEMA', candidate, EARLIER, { schedule: scheduleHtml + scheduleHtml }));
await test('monthly calendar timing conflict', () => expectHold('HOLD_SCHEDULE_CONFLICT', candidate, EARLIER, { monthly: monthlyHtml.replace('08:30 AM</td><td><a', '09:30 AM</td><td><a') }));
await test('monthly calendar missing CPI', () => expectHold('HOLD_SCHEDULE_CONFLICT', candidate, EARLIER, { monthly: monthlyHtml.replace('Consumer Price Index</a>', 'Real Earnings</a>') }));
await test('monthly timezone absent', () => expectHold('HOLD_SOURCE_SCHEMA', candidate, EARLIER, { monthly: monthlyHtml.replace('Eastern Time', 'Local Time') }));
await test('wrong weekday', () => expectHold('HOLD_SCHEDULE_CONFLICT', candidate, EARLIER, { monthly: monthlyHtml.replaceAll('Friday, September 11', 'Thursday, September 11') }));
await test('rescheduled source record', () => expectHold('HOLD_SCHEDULE_CONFLICT', candidate, EARLIER, { schedule: scheduleHtml.replace('Sep. 11, 2026', 'Rescheduled') }));
await test('cancelled metadata is not an ordinary preview', () => expectHold('HOLD_SCHEDULE_CONFLICT', { ...candidate, statusLabel: 'cancelled' }));
await test('rescheduled metadata is not released results', () => expectHold('HOLD_SCHEDULE_CONFLICT', { ...candidate, phase: 'outcome', statusLabel: 'rescheduled' }));
await test('date/title changes retain stable identity', () => assert.equal(calendarIdentity(candidate), calendarIdentity({ ...candidate, eventDate: '2026-09-12', event: 'renamed' })));
const outcome = { ...candidate, phase: 'outcome', statusLabel: 'released' };
await test('clock passed without matching official results', () => expectHold('HOLD_OUTCOME_NOT_RELEASED', outcome, AT + 1));
await test('schedule page is not results evidence', () => expectHold('HOLD_OUTCOME_NOT_RELEASED', outcome, AT + 1, { release: scheduleHtml }));
await test('matching released result', async () => assert.equal((await verify(outcome, AT + 1, { release: releaseHtml('AUGUST 2026', 'Friday, September 11, 2026') })).decision, 'PASS'));
await test('embargoed result cannot publish outcome', () => expectHold('HOLD_OUTCOME_NOT_RELEASED', outcome, BEFORE, { release: releaseHtml('AUGUST 2026', 'Friday, September 11, 2026') }));
await test('different release stage/title cannot prove outcome', () => expectHold('HOLD_OUTCOME_NOT_RELEASED', outcome, AT + 1, { release: releaseHtml('AUGUST 2026', 'Friday, September 11, 2026').replace('CONSUMER PRICE INDEX -', 'CONSUMER PRICE INDEX REVISED -') }));
await test('PPI artifact is not CPI evidence', () => expectHold('HOLD_OUTCOME_NOT_RELEASED', outcome, AT + 1, { release: releaseHtml().replace('CONSUMER PRICE INDEX -', 'PRODUCER PRICE INDEX -') }));
await test('schedule/release disagreement', () => expectHold('HOLD_SCHEDULE_CONFLICT', outcome, AT + 1, { release: releaseHtml('AUGUST 2026', 'Thursday, September 10, 2026') }));
await test('fake verified flag and candidate clock ignored', () => expectHold('HOLD_PREVIEW_EXPIRED', { ...candidate, verified: true, publishable: true, asOf: '2026-09-09', generatedAt: '2026-09-09T01:00:00Z', now: EARLIER, calendarEvidence: { decision: 'PASS' } }, AT + 1));
await test('long verification crosses release boundary', async () => {
  let clock = BEFORE;
  const result = await verifyPublicationCalendar(candidate, { now: () => clock, binding,
    fetchImpl: fakeFetch({ onFetch: (url) => { if (url === BLS_CPI_RELEASE) clock = AT; } }) });
  assert.equal(result.decision, 'HOLD_PREVIEW_EXPIRED');
});
await test('delayed PR invalidates its once-valid decision', async () => {
  const decision = await verify(candidate, BEFORE);
  assert.equal(checkCalendarDecisionFreshness(decision, { now: () => BEFORE, binding }), 'PASS');
  assert.equal(checkCalendarDecisionFreshness(decision, { now: () => AT, binding }), 'HOLD_PREVIEW_EXPIRED');
});
await test('serialized receipt is never trusted', async () => {
  const decision = JSON.parse(JSON.stringify(await verify()));
  assert.equal(checkCalendarDecisionFreshness(decision, { now: () => EARLIER, binding }), 'HOLD_UNTRUSTED_EVIDENCE');
});
await test('expired evidence invalidates earlier PASS', async () => {
  const decision = await verify();
  assert.equal(checkCalendarDecisionFreshness(decision, { now: () => EARLIER + CALENDAR_MAX_AGE_MS, binding }), 'HOLD_EVIDENCE_STALE');
});
for (const field of ['base', 'head', 'contentSha256']) {
  await test(`changed ${field} invalidates evidence`, async () => {
    const decision = await verify();
    assert.equal(checkCalendarDecisionFreshness(decision, { now: () => EARLIER, binding: { ...binding, [field]: 'd'.repeat(field === 'contentSha256' ? 64 : 40) } }), 'HOLD_REVISION_DRIFT');
  });
}
await test('unbound candidate PASS is not a release decision', async () => {
  const decision = await verifyPublicationCalendar(candidate, { now: () => EARLIER, fetchImpl: fakeFetch() });
  assert.equal(decision.decision, 'PASS');
  assert.equal(checkCalendarDecisionFreshness(decision, { now: () => EARLIER, binding }), 'HOLD_REVISION_DRIFT');
});
await test('backward clock fails closed', async () => {
  const decision = await verify();
  assert.equal(checkCalendarDecisionFreshness(decision, { now: () => EARLIER - 1, binding }), 'HOLD_INVALID_CLOCK');
});
await test('HTTP error', () => expectHold('HOLD_SOURCE_UNAVAILABLE', candidate, EARLIER, { status: 503 }));
await test('HTML required', () => expectHold('HOLD_SOURCE_SCHEMA', candidate, EARLIER, { headers: { 'Content-Type': 'application/json' } }));
await test('declared oversized response', () => expectHold('HOLD_SOURCE_UNAVAILABLE', candidate, EARLIER, { headers: { 'Content-Length': '512001' } }));
await test('streamed oversized response', () => expectHold('HOLD_SOURCE_UNAVAILABLE', candidate, EARLIER, { schedule: ' '.repeat(512001) }));
await test('stale cache Age', () => expectHold('HOLD_EVIDENCE_STALE', candidate, EARLIER, { headers: { Age: '900' } }));
await test('invalid cache Age', () => expectHold('HOLD_EVIDENCE_STALE', candidate, EARLIER, { headers: { Age: 'NaN' } }));
await test('stale HTTP Date', () => expectHold('HOLD_EVIDENCE_STALE', candidate, EARLIER, { headers: { Date: new Date(EARLIER - CALENDAR_MAX_AGE_MS).toUTCString() } }));
await test('redirect is not followed', async () => {
  const result = await verifyPublicationCalendar(candidate, { now: () => EARLIER, fetchImpl: async (_, options) => {
    assert.equal(options.redirect, 'manual');
    return new Response(null, { status: 302, headers: { Location: 'https://example.com/' } });
  } });
  assert.equal(result.decision, 'HOLD_SOURCE_UNAVAILABLE');
});
await test('off-allowlist URL makes no request', async () => {
  let called = false;
  await assert.rejects(() => readOfficialBlsHtml('https://evil.example/cpi.htm', { fetchImpl: async () => { called = true; } }), (error) => error.code === 'HOLD_SOURCE_UNAVAILABLE');
  assert.equal(called, false);
});
await test('network failure discloses no raw error', async () => {
  const result = await verifyPublicationCalendar(candidate, { now: () => EARLIER, fetchImpl: async () => { throw new Error('private-token-must-not-appear'); } });
  assert.equal(result.decision, 'HOLD_SOURCE_UNAVAILABLE');
  assert.ok(!JSON.stringify(result).includes('private-token'));
});
await test('bounded timeout', async () => {
  await assert.rejects(() => readOfficialBlsHtml(BLS_CPI_SCHEDULE, { timeoutMs: 5,
    fetchImpl: async (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })),
  }), (error) => error.code === 'HOLD_SOURCE_UNAVAILABLE');
});
await test('HTML comments/scripts do not contribute schedule rows', () => {
  const injected = `<!--${scheduleHtml}--><script>${scheduleHtml}</script>${scheduleHtml}`;
  assert.equal(parseBlsCpiSchedule(injected, '2026-08').eventDate, '2026-09-11');
});
await test('primary results parsing is independent of next-release mention', () => {
  const release = parseBlsCpiRelease(releaseHtml() + '<p>August 2026 CPI will be released on September 11, 2026.</p>');
  assert.equal(release.referencePeriod, '2026-07');
});
await test('daily metadata can use the same canonical contract', () => assert.equal(normalizeCalendarCandidate({ ...candidate, event: undefined }).referencePeriod, '2026-08'));
await test('current official cross-check cannot confuse Real Earnings', () => {
  confirmBlsMonthlySchedule(monthlyHtml, parseBlsCpiSchedule(scheduleHtml, '2026-08'));
});
const archivePath = 'apps/web/src/content/catalyst-briefs/2026-08-12-cpi-preview.md';
const archivedSource = '---\nphase: "preview"\ngeneratedAt: "2026-08-10T10:00:00Z"\n---\nHistorical preview.';
await test('unchanged archive is not a new publication', () => {
  const [entry] = classifyPublicationSnapshots({ [archivePath]: archivedSource }, { [archivePath]: archivedSource });
  assert.equal(entry.change, 'unchanged');
  assert.equal(entry.requiresCalendarValidation, false);
});
await test('backdated new preview is not an archive exemption', () => {
  const [entry] = classifyPublicationSnapshots({}, { [archivePath]: archivedSource });
  assert.equal(entry.change, 'added');
  assert.equal(entry.requiresCalendarValidation, true);
});
await test('modified historical preview requires review', () => {
  const [entry] = classifyPublicationSnapshots({ [archivePath]: archivedSource }, { [archivePath]: archivedSource + ' New claim.' });
  assert.equal(entry.change, 'modified');
  assert.equal(entry.requiresCalendarValidation, true);
});
await test('empty/no-op snapshot does not claim recovery', () => assert.deepEqual(classifyPublicationSnapshots({}, {}), []));
await test('untrusted snapshot paths rejected', () => throwsHold(() => classifyPublicationSnapshots({}, { '../secret': 'x' }), 'HOLD_REVISION_DRIFT'));
await test('failed cross-check preserves earlier source provenance', async () => {
  const result = await verify(candidate, EARLIER, { monthly: monthlyHtml.replace('Eastern Time', 'Local Time') });
  assert.equal(result.decision, 'HOLD_SOURCE_SCHEMA');
  assert.equal(result.sources.length, 2);
  assert.equal(result.checkedAt, new Date(EARLIER).toISOString());
});
await test('external reschedule notice cannot be ignored', () => expectHold('HOLD_SCHEDULE_CONFLICT', candidate, EARLIER, { schedule: scheduleHtml + '<p>CPI is postponed.</p>' }));
await test('parser complexity bound', () => expectHold('HOLD_SOURCE_SCHEMA', candidate, EARLIER, { schedule: '<h2>Schedule of Releases for the Consumer Price Index</h2>' + '<table>'.repeat(31) }));
await test('CLI refuses clock/publish/bypass switches', async () => {
  for (const flag of ['--now=2020-01-01', '--publish', '--evidence=pass.json', '--bypass']) {
    let invoked = false;
    assert.equal(await runCalendarCheck(['candidate.json', flag], { write: () => {}, verify: async () => { invoked = true; } }), 2);
    assert.equal(invoked, false);
  }
});
await test('CLI checks byte bounds before validation', async () => {
  let invoked = false;
  const code = await runCalendarCheck(['candidate.json'], { write: () => {}, fileStat: async () => ({ isFile: () => true, size: 65537 }), verify: async () => { invoked = true; } });
  assert.equal(code, 2);
  assert.equal(invoked, false);
});
await test('CLI holds fail closed with exit code 2', async () => {
  let output = '';
  const code = await runCalendarCheck(['candidate.json'], {
    write: (text) => { output += text; }, fileStat: async () => ({ isFile: () => true, size: 2 }), read: async () => '{}',
    verify: async () => ({ decision: 'HOLD_SOURCE_UNAVAILABLE', publicationAttempted: false, publicationAuthorized: false }),
  });
  assert.equal(code, 2);
  assert.equal(JSON.parse(output).publicationAuthorized, false);
});
await test('CLI success still confers no publication authorization', async () => {
  let output = '';
  const code = await runCalendarCheck(['candidate.json'], { write: (text) => { output += text; },
    fileStat: async () => ({ isFile: () => true, size: 500 }), read: async () => JSON.stringify(candidate),
    verify: (value) => verifyPublicationCalendar(value, { now: () => EARLIER, fetchImpl: fakeFetch() }),
  });
  assert.equal(code, 0);
  assert.equal(JSON.parse(output).decision, 'PASS');
  assert.equal(JSON.parse(output).publicationAuthorized, false);
  assert.match(JSON.parse(output).inputSha256, /^[a-f0-9]{64}$/);
});
console.log(`Publication calendar: ${tests} deterministic regression groups passed (synthetic fixtures; no publication or live-source certification).`);
