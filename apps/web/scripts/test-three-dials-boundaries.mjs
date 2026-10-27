import assert from 'node:assert/strict';
import {
  assessThreeDials,
  classifyDollarChange,
  classifyFundingSpreadChange,
  classifyYieldChange,
} from '../src/lib/three-dials.js';

assert.equal(classifyDollarChange(0.10), 'rangebound');
assert.equal(classifyDollarChange(-0.10), 'rangebound');
assert.equal(classifyDollarChange(0.10000001), 'firmer');
assert.equal(classifyDollarChange(-0.10000001), 'softer');

assert.equal(classifyYieldChange((4.75 - 4.70) * 100), 'flat');
assert.equal(classifyYieldChange((4.65 - 4.70) * 100), 'flat');
assert.equal(classifyFundingSpreadChange((4.93 - 4.90) * 100), 'contained');
assert.equal(classifyFundingSpreadChange((4.87 - 4.90) * 100), 'contained');

const assessment = assessThreeDials({
  broadUsdChangePct: 0.58,
  realYieldChangeBps: 7,
  fundingSpreadChangeBps: 0,
});

assert.deepEqual(assessment.dials, {
  dollar: { direction: 'firmer', confirmation: 'single-primary-measure', confidence: 'medium' },
  real_rates: { direction: 'rising', confirmation: 'single-primary-measure', confidence: 'medium' },
  funding_pressure: { direction: 'contained', confirmation: 'single-derived-measure', confidence: 'medium' },
});
assert.equal(assessment.interpretation.label, 'Rate-led firm-dollar environment');
assert.equal(
  assessment.interpretation.sentence,
  'The completed week showed a firmer broad-dollar reading, 10-year real yields rising, and funding pressure stayed contained.',
);
assert.throws(() => classifyFundingSpreadChange(Number.NaN), /change must be a finite number/);

console.log('Three-Dials v2 exact-boundary regression tests passed.');
