import assert from 'node:assert/strict';
import { monthlyEligibility } from '../src/lib/report-periods.js';

const reports = (items) => items.map(([periodEnd, status = 'published']) => ({
  data: { periodEnd, status },
}));
const weekly = reports([
  ['2026-08-14'], ['2026-07-31'], ['2026-08-07'],
  ['2026-08-21'], ['2026-08-28', 'review'],
]);

const firstWindow = monthlyEligibility(weekly, []);
assert.deepEqual(firstWindow.inputs.map((entry) => entry.data.periodEnd), [
  '2026-07-31', '2026-08-07', '2026-08-14', '2026-08-21',
]);
assert.equal(firstWindow.progress, 4);
assert.equal(firstWindow.ready, true);
assert.equal(firstWindow.nextRequiredPeriodEnd, null);
assert.equal(firstWindow.blockedByGap, false);

const nextWindow = monthlyEligibility(weekly, reports([['2026-08-21']]));
assert.deepEqual(nextWindow.inputs, []);
assert.equal(nextWindow.progress, 0);
assert.equal(nextWindow.ready, false);
assert.equal(nextWindow.nextRequiredPeriodEnd, '2026-08-28');
assert.equal(nextWindow.blockedByGap, false);

const reviewDoesNotReset = monthlyEligibility(weekly, reports([['2026-08-21', 'review']]));
assert.equal(reviewDoesNotReset.progress, 4);

const octoberMonthly = reports([['2026-10-16']]);
const oneSource = monthlyEligibility(reports([['2026-10-23']]), octoberMonthly);
assert.equal(oneSource.progress, 1);
assert.equal(oneSource.ready, false);
assert.equal(oneSource.blockedByGap, false);
assert.equal(oneSource.nextRequiredPeriodEnd, '2026-10-30');

const skipWeek = monthlyEligibility(reports([
  ['2026-10-23'], ['2026-11-06'], ['2026-11-13'], ['2026-11-20'],
]), octoberMonthly);
assert.deepEqual(skipWeek.inputs.map((entry) => entry.data.periodEnd), ['2026-10-23']);
assert.equal(skipWeek.eligible.length, 4, 'four published weeks may exist without four consecutive weeks');
assert.equal(skipWeek.progress, 1);
assert.equal(skipWeek.ready, false, 'four nonconsecutive editions cannot claim Monthly readiness');
assert.equal(skipWeek.nextRequiredPeriodEnd, '2026-10-30');
assert.equal(skipWeek.blockedByGap, true);

const missingFirst = monthlyEligibility(reports([
  ['2026-10-30'], ['2026-11-06'], ['2026-11-13'], ['2026-11-20'],
]), octoberMonthly);
assert.equal(missingFirst.progress, 0);
assert.equal(missingFirst.ready, false);
assert.equal(missingFirst.nextRequiredPeriodEnd, '2026-10-23');
assert.equal(missingFirst.blockedByGap, true);

const missingFourth = monthlyEligibility(reports([
  ['2026-10-23'], ['2026-10-30'], ['2026-11-06'], ['2026-11-20'],
]), octoberMonthly);
assert.equal(missingFourth.progress, 3);
assert.equal(missingFourth.ready, false);
assert.equal(missingFourth.nextRequiredPeriodEnd, '2026-11-13');
assert.equal(missingFourth.blockedByGap, true);

const resolvedByBackfill = monthlyEligibility(reports([
  ['2026-11-13'], ['2026-10-23'], ['2026-11-06'], ['2026-10-30'],
]), octoberMonthly);
assert.deepEqual(resolvedByBackfill.inputs.map((entry) => entry.data.periodEnd), [
  '2026-10-23', '2026-10-30', '2026-11-06', '2026-11-13',
]);
assert.equal(resolvedByBackfill.progress, 4);
assert.equal(resolvedByBackfill.ready, true);
assert.equal(resolvedByBackfill.blockedByGap, false);

const duplicate = monthlyEligibility(reports([
  ['2026-10-23'], ['2026-10-30'], ['2026-10-30'], ['2026-11-06'], ['2026-11-13'],
]), octoberMonthly);
assert.equal(duplicate.progress, 2, 'duplicate week cannot advance consecutive source evidence');
assert.equal(duplicate.ready, false);

const malformed = monthlyEligibility(reports([
  ['2026-10-24'], ['2026-10-30'], ['2026-11-06'], ['2026-11-13'],
]), octoberMonthly);
assert.equal(malformed.progress, 0, 'non-Friday source cannot satisfy Monthly input');
assert.equal(malformed.ready, false);

console.log('report period eligibility tests pass');
