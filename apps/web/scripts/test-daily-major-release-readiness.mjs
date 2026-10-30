import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessDailyMajorReleaseCoverage } from '../src/lib/daily-major-release-readiness.js';


// Catch operational clock errors near the Europe/Tirane daylight-saving cutover.
// This is test-only: publisher event instants remain the UTC strings from issuer calendars.
function clockInTirane(utcInstant) {
  const fields = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Tirane', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(utcInstant));
  const p = Object.fromEntries(fields.map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
assert.equal(clockInTirane('2026-10-23T09:17:00Z'), '2026-10-23 11:17');
assert.equal(clockInTirane('2026-10-30T09:17:00Z'), '2026-10-30 10:17');
assert.equal(clockInTirane('2026-10-30T12:17:00Z'), '2026-10-30 13:17');
assert.equal(clockInTirane('2026-10-30T12:30:00Z'), '2026-10-30 13:30');
assert.equal(clockInTirane('2026-10-30T13:00:00Z'), '2026-10-30 14:00');
assert.equal(clockInTirane('2026-10-30T15:47:00Z'), '2026-10-30 16:47');
assert.equal(clockInTirane('2026-10-30T18:45:00Z'), '2026-10-30 19:45');

const GDP = 'https://www.bea.gov/index.php/news/2026/gdp-advance-estimate-3rd-quarter-2026';
const PCE = 'https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026';
const SCHEDULE = 'https://www.bea.gov/news/schedule/full';
const date = '2026-10-29';
const at = '2026-10-29T14:00:00Z';
const event = { id: 'BEA_GDP_Q3_ADVANCE', name: 'Q3 GDP advance estimate', releaseAtUtc: '2026-10-29T12:30:00Z',
  calendarUrl: SCHEDULE, outcomeUrl: GDP };
const eventPce = { ...event, id: 'BEA_PCE_SEPTEMBER', name: 'September PCE', outcomeUrl: PCE };
const calendar = { schemaVersion: 1, editionDate: date, events: [event] };
const source = { id: 'gdp-primary', url: GDP, publishedAt: date, sourceType: 'primary' };
const edition = { date, generatedAt: '2026-10-29T13:00:00Z', status: 'published',
  sources: [source], highlights: [{ sourceIds: ['gdp-primary'] }] };
const audit = (o = {}) => assessDailyMajorReleaseCoverage({
  edition: o.edition ?? edition, calendar: o.calendar ?? calendar, asOfUtc: o.at ?? at,
});
const ready = audit();
assert.equal(ready.decision, 'READY_FOR_HUMAN_EDITORIAL_REVIEW');
assert.equal(ready.releaseAuthorized, false);
assert.equal(ready.humanEditorialApprovalRequired, true);
assert.equal(ready.events[0].sourceId, 'gdp-primary');

const before = audit({ at: '2026-10-29T12:29:59Z' });
assert.equal(before.events[0].decision, 'HOLD_RELEASE_NOT_YET_DUE');
assert.equal(before.releaseAuthorized, false);

const priorGeneration = audit({ edition: { ...edition, generatedAt: '2026-10-29T09:33:31Z' } });
assert.equal(priorGeneration.events[0].decision, 'HOLD_POST_RELEASE_EDITORIAL_RECEIPT_REQUIRED');
assert.equal(priorGeneration.releaseAuthorized, false);

assert.equal(audit({ edition: { ...edition, sources: [] } }).events[0].decision,
  'HOLD_OFFICIAL_OUTCOME_NOT_IN_HIGHLIGHTS');
assert.equal(audit({ edition: { ...edition, highlights: [] } }).events[0].decision,
  'HOLD_OFFICIAL_OUTCOME_NOT_IN_HIGHLIGHTS');
assert.equal(audit({ edition: { ...edition, generatedAt: 'not-a-timestamp' } }).events[0].decision,
  'HOLD_CUTOFF_UNTRUSTED');
assert.equal(audit({ edition: { ...edition, generatedAt: '2026-10-30T01:00:00Z' } }).events[0].decision,
  'HOLD_CUTOFF_UNTRUSTED');
assert.equal(audit({ edition: { ...edition, sources: [{ ...source, sourceType: 'reporting' }] } }).events[0].decision,
  'HOLD_OFFICIAL_OUTCOME_NOT_IN_HIGHLIGHTS');
assert.equal(audit({ edition: { ...edition, sources: [{ ...source, url: 'https://apnews.com/article/fake-primary' }] } }).events[0].decision,
  'HOLD_OFFICIAL_OUTCOME_NOT_IN_HIGHLIGHTS');

const missingOutcome = audit({ calendar: { ...calendar, events: [{ ...event, outcomeUrl: null }] } });
assert.equal(missingOutcome.events[0].decision, 'HOLD_OUTCOME_DOCUMENT_NOT_VERIFIED');
assert.equal(audit({ calendar: { ...calendar, events: [] } }).decision, 'HOLD_CALENDAR_COVERAGE_UNVERIFIED');

const twoEvents = audit({ calendar: { ...calendar, events: [event, eventPce] } });
assert.equal(twoEvents.events[0].decision, 'READY_FOR_HUMAN_EDITORIAL_REVIEW');
assert.equal(twoEvents.events[1].decision, 'HOLD_OFFICIAL_OUTCOME_NOT_IN_HIGHLIGHTS');
assert.equal(twoEvents.decision, 'HOLD_RELEASE_REVIEW_REQUIRED');

assert.throws(() => audit({ calendar: { ...calendar, events: [event, event] } }), /event id missing or duplicated/);
assert.throws(() => audit({ calendar: { ...calendar, events: [{ ...event, releaseAtUtc: '2026-10-30T12:30:00Z' }] } }),
  /invalid schedule identity/);
assert.throws(() => audit({ calendar: { ...calendar, events: [{ ...event, calendarUrl: 'https://example.com/not-official' }] } }),
  /invalid schedule identity/);
assert.throws(() => audit({ calendar: { ...calendar, editionDate: '2026-10-30' } }), /calendar version, date or event list/);
assert.throws(() => audit({ at: '2026-10-29T14:00:00+02:00' }), /date or as-of timestamp/);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-release-readiness-'));
try {
  const newsDir = path.join(root, 'src/content/news');
  fs.mkdirSync(newsDir, { recursive: true });
  fs.writeFileSync(path.join(newsDir, '2026-10-29.md'), `---
date: "2026-10-29"
generatedAt: "2026-10-29T09:33:00Z"
sources:
  - id: "gdp-primary"
    url: "${GDP}"
    publishedAt: "2026-10-29"
    sourceType: "primary"
highlights:
  - sourceIds:
      - "gdp-primary"
---
Fixture body.
`);
  const manifestPath = path.join(root, 'review-calendar.json');
  fs.writeFileSync(manifestPath, JSON.stringify(calendar));
  const script = fileURLToPath(new URL('./check-daily-major-release-coverage.mjs', import.meta.url));
  const checked = spawnSync(process.execPath,
    [script, '--date', date, '--calendar', manifestPath, '--at', at],
    { cwd: root, encoding: 'utf8', timeout: 5000 });
  assert.ifError(checked.error);
  assert.equal(checked.status, 1, `CLI should emit HOLD for stale generation: ${checked.stderr}`);
  const receipt = JSON.parse(checked.stdout);
  assert.equal(receipt.events[0].decision, 'HOLD_POST_RELEASE_EDITORIAL_RECEIPT_REQUIRED');
  assert.equal(receipt.releaseAuthorized, false);
  const invalid = spawnSync(process.execPath,
    [script, '--date', date, '--calendar', path.join(root, 'missing.json')],
    { cwd: root, encoding: 'utf8', timeout: 5000 });
  assert.equal(invalid.status, 2, 'unavailable reviewed manifest must not be treated as PASS');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
console.log('Daily major-release readiness: pure checks and one-shot CLI fail-closed regression passed.');
