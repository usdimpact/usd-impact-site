import assert from 'node:assert/strict';
import {
  assessThreeDials,
  classifyFundingSpreadChange,
  classifyHyOasChange,
  classifyYieldChange,
} from '../src/lib/three-dials.js';

const exactPositiveTenBps = (2.70 - 2.60) * 100;
const exactNegativeTenBps = (2.60 - 2.70) * 100;

// JavaScript represents both exact decimal moves slightly outside the boundary.
assert.ok(exactPositiveTenBps > 10);
assert.ok(exactNegativeTenBps < -10);

// The published strict boundary keeps exact +/-10 bp HY OAS moves contained.
assert.equal(classifyHyOasChange(exactPositiveTenBps), 'contained');
assert.equal(classifyHyOasChange(exactNegativeTenBps), 'contained');
assert.equal(classifyHyOasChange(10 + 1e-8), 'tightening');
assert.equal(classifyHyOasChange(-10 - 1e-8), 'easing');

// The same boundary protection applies to the other basis-point classifiers.
assert.equal(classifyYieldChange((4.75 - 4.70) * 100), 'flat');
assert.equal(classifyYieldChange((4.65 - 4.70) * 100), 'flat');
assert.equal(classifyFundingSpreadChange((4.93 - 4.90) * 100), 'contained');
assert.equal(classifyFundingSpreadChange((4.87 - 4.90) * 100), 'contained');

const assessment = assessThreeDials({
  dxyChangePct: 0.91,
  broadUsdChangePct: 0.58,
  realYieldChangeBps: 2,
  nominalYieldChangeBps: -1,
  hyOasChangeBps: exactNegativeTenBps,
  vixChangePoints: -0.70,
  fundingSpreadChangeBps: 0,
});

assert.deepEqual(assessment.dials.liquidity_stress, {
  direction: 'contained',
  confirmation: 'broad',
  confidence: 'high',
  component_directions: {
    high_yield_oas: 'contained',
    vix: 'contained',
    sofr_iorb_spread: 'contained',
  },
});
assert.equal(
  assessment.interpretation.sentence,
  'The completed week showed a firmer DXY reading with confirmed broad-dollar confirmation, 10-year real yields flat, and liquidity stress stayed contained.',
);

assert.throws(() => classifyHyOasChange(Number.NaN), /change must be a finite number/);

console.log('Three-Dials exact-boundary regression tests passed.');
