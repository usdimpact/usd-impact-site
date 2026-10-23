import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildMethodologyIntegrityCertificate } from './generate-methodology-integrity-certificate.mjs';

const source = fs.readFileSync(new URL('../apps/web/src/pages/score/methodology.astro', import.meta.url), 'utf8');
const fixed = {
  methodologySource: source,
  repositoryCommit: 'test-commit',
  generatedAt: '2026-10-23T00:00:00.000Z',
};

const first = buildMethodologyIntegrityCertificate(fixed);
const second = buildMethodologyIntegrityCertificate(fixed);

assert.deepEqual(first, second, 'Shadow certificate must be deterministic for identical inputs');
assert.equal(first.mode, 'shadow_non_production');
assert.equal(first.specification.score_version, 'v2');
assert.equal(first.specification.status, 'descriptive_non_predictive');
assert.equal(first.specification.production_start_date, '2015-01-01');
assert.equal(first.specification.normalization, 'full_sample');
assert.equal(first.specification.sample_std_ddof, 1);
assert.equal(first.specification.clipping, 3.5);
assert.equal(first.specification.absolute_weight_each, 0.125);
assert.deepEqual(first.specification.signed_components, {
  DXY: 1,
  WTI: -1,
  SPX: -1,
  VIX: 1,
  BTC: -1,
  GOLD: -1,
  UST2Y: 1,
  UST10Y: 1,
});
assert.deepEqual(first.specification.thresholds, {
  strong_dollar_min: 1,
  firm_dollar_min: 0.3,
  soft_dollar_max: -0.3,
  weak_dollar_max: -1,
});
assert.match(first.methodology_source_sha256, /^[a-f0-9]{64}$/);
assert.match(first.specification_sha256, /^[a-f0-9]{64}$/);
assert.match(first.certificate_sha256, /^[a-f0-9]{64}$/);
assert.equal(first.invariants.changes_production_score, false);
assert.equal(first.invariants.changes_published_history, false);
assert.equal(first.invariants.changes_methodology, false);
assert.equal(first.invariants.authorizes_promotion, false);

console.log('Methodology integrity shadow certificate test passed.');
