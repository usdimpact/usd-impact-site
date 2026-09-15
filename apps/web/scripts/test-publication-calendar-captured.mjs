import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { digest, verifyPublicationCalendar } from '../src/lib/publication-calendar.js';
import { BLS_CPI_SCHEDULE, BLS_CPI_RELEASE, parseBlsCpiSchedule, confirmBlsMonthlySchedule, parseBlsCpiRelease } from '../src/lib/bls-cpi-calendar.js';
import { candidate, scheduleHtml } from './fixtures/publication-calendar.js';

const capture = JSON.parse(await readFile(new URL('./fixtures/publication-calendar-captured.json', import.meta.url), 'utf8'));
const byFile = Object.fromEntries(capture.sources.map((source) => [source.file, source]));
const schedule = byFile['schedule.html'].html;
const monthly = byFile['monthly.html'].html;
const release = byFile['release.html'].html;
// Synthetic wrappers reproduce the layout nesting observed in the full capture.
const wrap = (html) => `<table id="main-content-table"><tr><td>Navigation</td><td><div>${html}</div></td></tr></table>`;
const source = (html) => `<h2>Schedule of Releases for the Consumer Price Index</h2>${html}`;
const monthSource = (html) => `${html}<p>All times on calendar are Eastern Time.</p>`;
const parse = (html) => parseBlsCpiSchedule(source(html), '2026-08');
const reject = (html, code = 'HOLD_SOURCE_SCHEMA') => assert.throws(() => parse(html), (error) => error.code === code);
let tests = 0;
const test = async (name, fn) => { await fn(); tests += 1; };
for (const item of capture.sources) {
  await test(`captured fragment digest retained: ${item.file}`, () => {
    assert.equal(digest(item.html), item.fragmentSha256);
    assert.equal(item.html.length, item.fragmentLength);
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
    assert.match(item.fetchedAt, /^2026-09-09T18:34:/);
  });
}
await test('captured release table inside layout table', () => assert.equal(parse(wrap(schedule)).releaseAt, '2026-09-11T12:30:00.000Z'));
await test('multiple nested layout tables do not flatten cells', () => assert.equal(parse(wrap(wrap(schedule))).referencePeriod, '2026-08'));
await test('captured monthly table confirms CPI, not co-timed Real Earnings', () => confirmBlsMonthlySchedule(monthSource(wrap(monthly)), parse(wrap(schedule))));
await test('captured monthly holiday with blank time is not a CPI release', () => confirmBlsMonthlySchedule(monthSource(wrap(monthly)), parse(schedule)));
await test('captured July results are independent of August schedule', () => assert.deepEqual(parseBlsCpiRelease(release), { referencePeriod: '2026-07', releaseAt: '2026-08-12T12:30:00.000Z' }));
await test('all official reference months survive nested layout isolation', () => {
  const parsed = parseBlsCpiSchedule(source(wrap(schedule)), '2025-11');
  assert.equal(parsed.eventDate, '2025-12-18');
});
await test('two genuine release tables remain ambiguous even in different wrappers', () => reject(wrap(schedule) + wrap(schedule)));
await test('missing header is not repaired by layout text', () => reject(wrap(schedule.replace('Reference Month', 'Month'))));
await test('headers cannot be assembled from unrelated tables', () => reject('<table><tr><th>Reference Month</th></tr></table><table><tr><th>Release Date</th><th>Release Time</th></tr></table>'));
await test('missing layout table end is rejected', () => reject(wrap(schedule).replace(/<\/table>$/, '')));
await test('unmatched closing table is rejected', () => reject(wrap(schedule) + '</table>'));
await test('nested table in release data cannot change cell ownership', () => reject(schedule.replace('<td>August 2026</td>', '<td><table><tr><td>August 2026</td></tr></table></td>')));
await test('extra release data cell is rejected', () => reject(schedule.replace('<td>August 2026</td>', '<td>August 2026</td><td>extra</td>')));
await test('missing cell end does not combine values', () => reject(schedule.replace('<td>August 2026</td>', '<td>August 2026')));
await test('wrong cell end type is rejected', () => reject(schedule.replace('<td>August 2026</td>', '<td>August 2026</th>')));
await test('rowspan in selected release table is rejected', () => reject(schedule.replace('<td>August 2026</td>', '<td rowspan="2">August 2026</td>')));
await test('colspan in selected release table is rejected', () => reject(schedule.replace('<td>August 2026</td>', '<td colspan="2">August 2026</td>')));
await test('self-closing table syntax is rejected', () => reject(schedule.replace('<table class="release-list">', '<table class="release-list"/>')));
await test('attribute-bearing closing table is rejected', () => reject(schedule.replace('</table>', '</table data-extra="1">')));
await test('quoted greater-than attribute does not split a structural tag', () => assert.equal(parse(wrap(schedule.replace('<table class="release-list">', '<table class="release-list" data-note="x > y">'))).eventDate, '2026-09-11'));
await test('script, template and commented pseudo-tables remain inert', () => assert.equal(parse(`<!--${schedule}--><script>${schedule}</script><template>${schedule}</template>${wrap(schedule)}`).referencePeriod, '2026-08'));
await test('malformed source row cannot be rescued by an otherwise correct wrapper', () => reject(wrap(schedule.replace('<tr class="release-list-odd-row">', '<tr class="release-list-odd-row"><tr>'))));
await test('layout nesting is bounded', () => {
  let value = schedule;
  for (let depth = 0; depth < 11; depth += 1) value = wrap(value);
  reject(value);
});
await test('old simple fixtures remain supported without layout assumptions', () => assert.equal(parseBlsCpiSchedule(scheduleHtml, '2026-08').eventDate, '2026-09-11'));
await test('captured monthly wrong-date CPI remains a conflict', () => assert.throws(() => confirmBlsMonthlySchedule(monthSource(wrap(monthly.replaceAll('Friday, September 11, 2026', 'Thursday, September 10, 2026'))), parse(schedule)), (error) => error.code === 'HOLD_SCHEDULE_CONFLICT'));
await test('captured-page replay distinguishes preview from unavailable outcome', async () => {
  const fetchImpl = async (url) => new Response(url === BLS_CPI_SCHEDULE ? source(wrap(schedule)) : url === BLS_CPI_RELEASE ? release : monthSource(wrap(monthly)), { headers: { 'Content-Type': 'text/html' } });
  const before = await verifyPublicationCalendar(candidate, { now: () => Date.parse('2026-09-09T18:35:00Z'), fetchImpl });
  assert.equal(before.decision, 'PASS');
  const outcome = await verifyPublicationCalendar({ ...candidate, phase: 'outcome', statusLabel: 'released' }, { now: () => Date.parse('2026-09-11T12:30:00Z'), fetchImpl });
  assert.equal(outcome.decision, 'HOLD_OUTCOME_NOT_RELEASED');
  assert.equal(before.publicationAuthorized, false);
  assert.equal(outcome.publicationAuthorized, false);
});
console.log(`Publication calendar captured-markup: ${tests} regression groups passed (dated fragments and synthetic wrappers; not fresh publication evidence).`);
