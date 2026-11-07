import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import {
  SYNTHETIC_DRIVERS, SYNTHETIC_HISTORY, SYNTHETIC_FIXTURE_ID,
  evaluateSyntheticLab, syntheticCsv, sampleMean, sampleStd, clipZ, syntheticRegime,
} from '../src/lib/score-synthetic-lab.js';

const lab = fs.readFileSync(new URL('../src/pages/score/lab.astro', import.meta.url), 'utf8');
const scorePage = fs.readFileSync(new URL('../src/pages/score.astro', import.meta.url), 'utf8');
const helper = fs.readFileSync(new URL('../src/lib/score-synthetic-lab.js', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function independentScore(values) {
  const weights = [0.125, -0.125, -0.125, 0.125, -0.125, -0.125, 0.125, 0.125];
  return values.reduce((sum, x, index) => {
    const points = [900, 900, 1000, 1100, 1100, x];
    const mean = points.reduce((a, b) => a + b, 0) / 6;
    const std = Math.sqrt(points.reduce((a, b) => a + (b - mean) ** 2, 0) / 5);
    return sum + weights[index] * Math.max(-3.5, Math.min(3.5, (x - mean) / std));
  }, 0);
}

test('fixed signed eight-factor arithmetic and 2099 fictional fixture', () => {
  assert.deepEqual(SYNTHETIC_DRIVERS.map(d => d.id), ['DXY','WTI','SPX','VIX','BTC','GOLD','UST_2Y','UST_10Y']);
  assert.deepEqual(SYNTHETIC_DRIVERS.map(d => d.weight), [0.125,-0.125,-0.125,0.125,-0.125,-0.125,0.125,0.125]);
  assert.equal(SYNTHETIC_DRIVERS.reduce((s,d) => s + Math.abs(d.weight), 0), 1);
  assert.deepEqual(SYNTHETIC_HISTORY, [900,900,1000,1100,1100]);
  assert.match(SYNTHETIC_FIXTURE_ID, /2099/);
});

test('six-week sample standard deviation uses ddof=1, includes W6', () => {
  assert.equal(sampleMean([900,900,1000,1100,1100]), 1000);
  assert.equal(sampleStd([900,900,1000,1100,1100]), 100);
  const result = evaluateSyntheticLab();
  assert.equal(result.synthetic, true);
  assert.equal(result.realMarketScore, false);
  assert.equal(result.rows[0].mean, 1020);
  assert.ok(Math.abs(result.rows[0].std - Math.sqrt(10400)) < 1e-11);
  assert.ok(Math.abs(result.score - independentScore(SYNTHETIC_DRIVERS.map(d => d.exampleX))) < 1e-12);
  assert.ok(Math.abs(result.score - 0.40112486817517307) < 1e-12);
});

test('changed sliders recompute without mutating original scenario', () => {
  const initial = evaluateSyntheticLab();
  const x = SYNTHETIC_DRIVERS.map(d => d.exampleX);
  x[0] = 500; x[3] = 1500;
  const changed = evaluateSyntheticLab(x);
  assert.ok(Math.abs(changed.score - independentScore(x)) < 1e-12);
  assert.notEqual(changed.score, initial.score);
  assert.equal(initial.rows[0].x, 1120);
});

test('score clipping and regime boundaries reproduce documented conditions', () => {
  assert.equal(clipZ(4), 3.5);
  assert.equal(clipZ(-8), -3.5);
  assert.equal(clipZ(1.25), 1.25);
  assert.match(syntheticRegime(1), /fuerte/);
  assert.match(syntheticRegime(0.3), /firme/);
  assert.match(syntheticRegime(-0.3), /neutral/);
  assert.match(syntheticRegime(-0.301), /suave/);
  assert.match(syntheticRegime(-1.001), /débil/);
});

test('fail closed on out-of-range, incomplete, nonnumeric inputs', () => {
  const good = SYNTHETIC_DRIVERS.map(d => d.exampleX);
  for (const invalid of [null,{},[],good.slice(1),[...good,1000],
    ...[NaN,Infinity,-Infinity,null,undefined,'1000',1510,490,1081,1050.5].map(x => [x,...good.slice(1)])]) {
    assert.throws(() => evaluateSyntheticLab(invalid));
    assert.throws(() => syntheticCsv(invalid));
  }
  assert.throws(() => sampleStd([5,5,5]));
  assert.throws(() => clipZ(NaN));
});

test('CSV exposes only eight fictional factor rows for independent reconstruction', () => {
  const lines = syntheticCsv().trim().split('\n');
  assert.equal(lines.length, 9);
  assert.equal(lines[0], 'factor_ficticio,peso,W1,W2,W3,W4,W5,W6');
  assert.match(lines[1], /^DXY,0\.125,900,900,1000,1100,1100,1120$/);
  assert.ok(lines.every(line => !/https?:|fred|yahoo|storage|auth|token/i.test(line)));
});

test('lab noindex, visible simulation warning, client-only and step-by-step links', () => {
  assert.match(lab, /<BaseLayout[\s\S]*?noindex=\{true\}/);
  assert.match(lab, /data-lab-status="fictional-only"/);
  assert.match(lab, /No representa el Score real/i);
  assert.match(lab, /data-sim-input/);
  assert.match(lab, /STDEV\.S/);
  assert.match(lab, /=SUM\(L2:L9\)/);
  assert.match(lab, /href="\/score\/methodology\/"/);
  assert.match(lab, /github\.com\/usdimpact\/usd-impact-pipeline\/blob\/main\/usd_impact_score_v2\.py/);
  assert.match(lab, /federalreserve\.gov/);
  assert.match(lab, /home\.treasury\.gov/);
  assert.match(lab, /eia\.gov/);
  assert.match(scorePage, /href="\/score\/lab\/"/);
  for (const source of [lab,helper]) {
    assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|WebSocket|EventSource|\bpostMessage\s*\(/i);
    assert.doesNotMatch(source, /\/api\/|\/archive\/|\/data\/usd_impact_score|weekly_input_latest|score_repro_bundle_latest|DGS2|DGS10|DX-Y\.NYB|\bCL=F\b/);
  }
  assert.match(pkg.scripts['validate:score-membership'], /test-score-synthetic-lab\.mjs/);
});
