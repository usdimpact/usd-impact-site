import assert from 'node:assert/strict';
import { monthlyEligibility } from '../src/lib/report-periods.js';

const weekly = [
  ['2026-08-14', 'published'],
  ['2026-07-31', 'published'],
  ['2026-08-07', 'published'],
  ['2026-08-21', 'published'],
  ['2026-08-28', 'review'],
].map(([periodEnd, status]) => ({ data: { periodEnd, status } }));

const firstWindow = monthlyEligibility(weekly, []);
assert.deepEqual(firstWindow.inputs.map((entry) => entry.data.periodEnd), [
  '2026-07-31',
  '2026-08-07',
  '2026-08-14',
  '2026-08-21',
]);
assert.equal(firstWindow.progress, 4);
assert.equal(firstWindow.ready, true);

const nextWindow = monthlyEligibility(weekly, [
  { data: { periodEnd: '2026-08-21', status: 'published' } },
]);
assert.deepEqual(nextWindow.inputs, []);
assert.equal(nextWindow.progress, 0);
assert.equal(nextWindow.ready, false);

const reviewDoesNotReset = monthlyEligibility(weekly, [
  { data: { periodEnd: '2026-08-21', status: 'review' } },
]);
assert.equal(reviewDoesNotReset.progress, 4);

console.log('report period eligibility tests pass');
