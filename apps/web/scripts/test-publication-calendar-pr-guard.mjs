import assert from 'node:assert/strict';
import {
  classifyPublicationCalendarChanges,
  parseGuardedCatalystSource,
  shouldAutoClosePublicationPr,
} from '../src/lib/publication-calendar-pr-guard.js';

const source = ({ event = 'BLS Consumer Price Index (CPI) — August 2026', releaseAt = '2026-09-11T12:30:00.000Z', calendar = true } = {}) => `---
event: ${JSON.stringify(event)}
phase: "preview"
status: "published"
statusLabel: "scheduled-confirmed"
${calendar ? `calendar: ${JSON.stringify({
  publisher: 'BLS',
  series: 'CPI',
  referencePeriod: '2026-08',
  releaseStage: 'initial',
  eventDate: '2026-09-11',
  releaseTime: '08:30',
  timeZone: 'America/New_York',
  releaseAt,
})}` : ''}
---

Body
`;

const parsed = parseGuardedCatalystSource(source());
assert.equal(parsed.phase, 'preview');
assert.equal(parsed.calendar.series, 'CPI');

const change = (content = source()) => ({
  path: 'apps/web/src/content/catalyst-briefs/2026-09-11-cpi-preview.md',
  status: 'added',
  content,
});

const fresh = classifyPublicationCalendarChanges([change()], {
  nowMs: Date.parse('2026-09-11T11:29:59Z'),
  guardWindowMs: 60 * 60 * 1000,
});
assert.equal(fresh.decision, 'PASS');
assert.equal(fresh.reason, 'PASS_PREVIEW_FRESH');
assert.equal(fresh.blockAt, '2026-09-11T11:30:00.000Z');

const safety = classifyPublicationCalendarChanges([change()], {
  nowMs: Date.parse('2026-09-11T11:30:00Z'),
  guardWindowMs: 60 * 60 * 1000,
});
assert.equal(safety.decision, 'BLOCK');
assert.equal(safety.reason, 'HOLD_FRESHNESS_SAFETY_WINDOW');

const expired = classifyPublicationCalendarChanges([change()], {
  nowMs: Date.parse('2026-09-11T12:30:00Z'),
  guardWindowMs: 60 * 60 * 1000,
});
assert.equal(expired.decision, 'BLOCK');
assert.equal(expired.reason, 'HOLD_PREVIEW_EXPIRED');
assert.equal(shouldAutoClosePublicationPr(
  { headRef: 'automation/catalyst-brief-cpi-123' }, expired
), true);
assert.equal(shouldAutoClosePublicationPr(
  { headRef: 'editorial/manual-cpi' }, expired
), false);

const missing = classifyPublicationCalendarChanges([change(source({ calendar: false }))], {
  nowMs: Date.parse('2026-09-10T12:00:00Z'),
});
assert.equal(missing.decision, 'BLOCK');
assert.equal(missing.reason, 'HOLD_MISSING_CALENDAR_RECORD');

const unrelated = classifyPublicationCalendarChanges([change(source({
  event: 'Federal Reserve press conference — September 2026',
  calendar: false,
}))], { nowMs: Date.parse('2026-09-10T12:00:00Z') });
assert.deepEqual(unrelated, {
  decision: 'PASS',
  reason: 'PASS_NOT_APPLICABLE',
  path: null,
  relevantCount: 0,
  blockAt: null,
  releaseAt: null,
});

assert.equal(
  classifyPublicationCalendarChanges([{ path: 'README.md', status: 'modified', content: 'x' }]).decision,
  'PASS'
);
assert.throws(
  () => parseGuardedCatalystSource('---\nevent: "BLS CPI"\nphase: "preview"\ncalendar: {bad}\n---\n'),
  /HOLD_CALENDAR_SCHEMA/
);

console.log('publication calendar PR guard tests pass');
