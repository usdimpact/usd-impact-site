import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DRAFT_DIR, SERIES, validateWeeklyDraft, validateMonthlyDraft,
  inspectIndependentMonthlyWindow, runOfflineDraftValidation
} from './independent-editorial-draft.mjs';

const weekly = JSON.parse(fs.readFileSync(path.join(DRAFT_DIR, 'weekly-2026-10-30.draft.json'), 'utf8'));
const monthly = JSON.parse(fs.readFileSync(path.join(DRAFT_DIR, 'monthly-template.draft.json'), 'utf8'));
const clone = (v) => structuredClone(v);
let tests = 0;
function rejects(change, matching) {
  assert.throws(() => change(), matching);
  tests += 1;
}
const accepted = validateWeeklyDraft(weekly);
assert.equal(accepted.sourceEdtions, 5);
assert.equal(accepted.publishReady, false);
assert.equal(accepted.sourceRightsCleared, false);
assert.equal(validateMonthlyDraft(monthly).sourceCount, 0);
assert.equal(validateMonthlyDraft(monthly).publishReady, false);
assert.equal(runOfflineDraftValidation().monthly.publishReady, false);
tests += 5;

rejects(() => validateWeeklyDraft({ ...weekly, status: 'published' }), /published or ready/);
rejects(() => validateWeeklyDraft({ ...weekly, releaseAuthorized: true }), /never authorizes release/);
rejects(() => validateWeeklyDraft({ ...weekly, rightsStatus: 'approved' }), /source rights remain pending/);
rejects(() => validateWeeklyDraft({ ...weekly, score: 0 }), /unexpected fields/);
rejects(() => validateWeeklyDraft({ ...weekly, periodStart: '2026-10-27' }), /Monday/);
rejects(() => validateWeeklyDraft({ ...weekly, periodEnd: '2026-11-06' }), /one Monday-Friday/);
rejects(() => validateWeeklyDraft({ ...weekly, sourceEditions: weekly.sourceEditions.slice(0, 4) }), /five weekday/);
{
  const candidate = clone(weekly);
  candidate.sourceEditions[1].date = '2026-10-26';
  rejects(() => validateWeeklyDraft(candidate), /complete and chronological/);
}
{
  const candidate = clone(weekly);
  candidate.sourceEditions[4].gitBlobSha = '0'.repeat(40);
  rejects(() => validateWeeklyDraft(candidate), /hash changed/);
}
{
  const candidate = clone(weekly);
  candidate.claims[0].sourceId = 'invented-id';
  rejects(() => validateWeeklyDraft(candidate), /primary source ID/);
}
{
  const candidate = clone(weekly);
  candidate.claims[0].sourceUrl = 'https://example.com/other';
  rejects(() => validateWeeklyDraft(candidate), /citation URL/);
}
{
  const candidate = clone(weekly);
  candidate.claims[0].marketReactionAsserted = true;
  rejects(() => validateWeeklyDraft(candidate), /market reaction/);
}
{
  const candidate = clone(weekly);
  candidate.claims[0].rightsStatus = 'cleared';
  rejects(() => validateWeeklyDraft(candidate), /reuse license/);
}
{
  const candidate = clone(weekly);
  candidate.claims[0].claimCategory = 'official_outcome';
  candidate.claims[0].eventDate = '2026-10-30';
  rejects(() => validateWeeklyDraft(candidate), /future events are not outcomes/);
}
{
  const candidate = clone(weekly);
  const eci = candidate.claims.find((c) => c.id === 'eci-oct30');
  assert.ok(eci, 'ECI claim missing from the pilot');
  eci.postReleaseEditorialReceipt = null;
  rejects(() => validateWeeklyDraft(candidate), /post-release claim needs/);
}
{
  const candidate = clone(weekly);
  const eci = candidate.claims.find((c) => c.id === 'eci-oct30');
  eci.sourceReleaseAt = '2026-11-30T12:30:00Z';
  rejects(() => validateWeeklyDraft(candidate), /release date must agree/);
}
rejects(() => validateMonthlyDraft({ ...monthly, status: 'published' }), /published or ready/);
rejects(() => validateMonthlyDraft({ ...monthly, releaseAuthorized: true }), /never authorizes release/);
rejects(() => validateMonthlyDraft({ ...monthly, scorePath: [] }), /unexpected fields/);
rejects(() => validateMonthlyDraft({ ...monthly, sourceRule: 'legacy_score_reports' }), /four_consecutive/);

let first = new Date('2099-01-01T12:00:00Z');
while (first.getUTCDay() !== 5) first.setUTCDate(first.getUTCDate() + 1);
function friday(offsetWeeks) {
  const value = new Date(first);
  value.setUTCDate(value.getUTCDate() + offsetWeeks * 7);
  return value.toISOString().slice(0, 10);
}
const sources = [0, 1, 2, 3].map((i) => ({
  series: SERIES, kind: 'independent_weekly', periodEnd: friday(i),
  publicationStatus: 'published',
  publicationReceipt: 'https://github.com/usdimpact/usd-impact-site/pull/99999#issuecomment-99999'
}));
assert.equal(inspectIndependentMonthlyWindow(sources).fourConsecutive, true);
assert.equal(inspectIndependentMonthlyWindow(sources).publishReady, false);
tests += 2;
{
  const candidate = clone(sources);
  candidate[1].kind = 'legacy_score_weekly';
  rejects(() => inspectIndependentMonthlyWindow(candidate), /legacy Score Weeklies/);
}
{
  const candidate = clone(sources);
  candidate[2].periodEnd = friday(4);
  assert.equal(inspectIndependentMonthlyWindow(candidate).fourConsecutive, false);
  tests += 1;
}
{
  const candidate = clone(sources);
  candidate[2].periodEnd = candidate[1].periodEnd;
  rejects(() => inspectIndependentMonthlyWindow(candidate), /duplicate independent Weekly/);
}
{
  const candidate = clone(sources);
  candidate[0].publicationStatus = 'draft';
  rejects(() => inspectIndependentMonthlyWindow(candidate), /actually published/);
}
{
  const candidate = clone(monthly);
  candidate.sourceWeeklyReports = sources;
  assert.equal(validateMonthlyDraft(candidate).fourConsecutive, true);
  assert.equal(validateMonthlyDraft(candidate).publishReady, false);
  tests += 2;
}
console.log('Independent editorial offline draft contract: ' + tests + ' assertions passed (never release-ready).');
