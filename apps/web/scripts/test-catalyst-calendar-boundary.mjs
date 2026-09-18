import assert from 'node:assert/strict';
import { verifyCandidateCalendar } from '../api/catalyst-brief-source.js';
import { catalystCalendarAssertion } from '../src/lib/catalyst-briefs.js';
import { BLS_CPI_RELEASE, BLS_CPI_SCHEDULE } from '../src/lib/bls-cpi-calendar.js';
import { monthlyHtml, releaseHtml, scheduleHtml } from './fixtures/publication-calendar.js';

const event = 'BLS Consumer Price Index (CPI) — August 2026';
const calendar = catalystCalendarAssertion(event, '2026-09-11');
assert.deepEqual(calendar, {
  publisher: 'BLS',
  series: 'CPI',
  referencePeriod: '2026-08',
  releaseStage: 'initial',
  eventDate: '2026-09-11',
  releaseTime: '08:30',
  timeZone: 'America/New_York',
  releaseAt: '2026-09-11T12:30:00.000Z',
});

const candidate = { event, phase: 'preview', calendar };
const fakeFetch = async (url) => new Response(
  url === BLS_CPI_SCHEDULE ? scheduleHtml : url === BLS_CPI_RELEASE ? releaseHtml() : monthlyHtml,
  { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
);

const pass = await verifyCandidateCalendar(candidate, 'synthetic-before-research', {
  now: () => Date.parse('2026-09-11T12:29:59Z'),
  fetchImpl: fakeFetch,
});
assert.equal(pass.decision, 'PASS');
assert.equal(pass.event.releaseAt, '2026-09-11T12:30:00.000Z');

await assert.rejects(
  () => verifyCandidateCalendar(candidate, 'synthetic-before-research', {
    now: () => Date.parse('2026-09-11T12:30:01Z'),
    fetchImpl: fakeFetch,
  }),
  (error) => (
    error?.code === 'HOLD_PREVIEW_EXPIRED'
    && error?.calendarAudit?.boundary === 'synthetic-before-research'
    && error?.calendarAudit?.publicationAuthorized === false
  ),
);

console.log('catalyst calendar boundary tests pass');
