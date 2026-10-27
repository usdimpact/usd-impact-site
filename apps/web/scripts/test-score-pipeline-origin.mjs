import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  BRANDED_SCORE_PIPELINE_ORIGIN,
  LEGACY_SCORE_PIPELINE_ORIGIN,
  resolveScorePipelineOrigin,
  scorePipelineArchiveUrl,
  scorePipelineUrl,
} from '../src/lib/score-pipeline-origin.js';

assert.equal(resolveScorePipelineOrigin(), LEGACY_SCORE_PIPELINE_ORIGIN);
assert.equal(resolveScorePipelineOrigin(''), LEGACY_SCORE_PIPELINE_ORIGIN);
assert.equal(resolveScorePipelineOrigin(`${BRANDED_SCORE_PIPELINE_ORIGIN}/`), BRANDED_SCORE_PIPELINE_ORIGIN);
assert.equal(scorePipelineUrl('/en/', BRANDED_SCORE_PIPELINE_ORIGIN), `${BRANDED_SCORE_PIPELINE_ORIGIN}/en/`);
assert.equal(scorePipelineUrl('archive/en/', LEGACY_SCORE_PIPELINE_ORIGIN), `${LEGACY_SCORE_PIPELINE_ORIGIN}/archive/en/`);
assert.throws(
  () => resolveScorePipelineOrigin('https://example.com'),
  /Unsupported Score pipeline origin/,
);

assert.equal(
  scorePipelineArchiveUrl('2026-10-09', ` ${BRANDED_SCORE_PIPELINE_ORIGIN}/ `),
  `${BRANDED_SCORE_PIPELINE_ORIGIN}/archive/2026-10-09/weekly_input.json`,
  'Historical Score links must retain the displayed week, not the moving latest bridge.',
);
assert.equal(
  scorePipelineArchiveUrl('2026-10-02'),
  `${LEGACY_SCORE_PIPELINE_ORIGIN}/archive/2026-10-02/weekly_input.json`,
);
assert.equal(
  scorePipelineArchiveUrl('2026-08-22', BRANDED_SCORE_PIPELINE_ORIGIN),
  `${BRANDED_SCORE_PIPELINE_ORIGIN}/archive/2026-08-22/weekly_input.json`,
  'Legacy Saturday archives remain valid.',
);
assert.equal(
  scorePipelineArchiveUrl('2024-02-29', LEGACY_SCORE_PIPELINE_ORIGIN),
  `${LEGACY_SCORE_PIPELINE_ORIGIN}/archive/2024-02-29/weekly_input.json`,
);
for (const invalidWeek of [
  undefined, null, 20261009, '', '2026-2-09', '2026-02-29', '2026-04-31',
  '2026-13-01', '2026-00-01', '2026-10-00', '2026-10-09T00:00:00Z',
  '../latest', '2026-10-09/..', ' 2026-10-09',
]) {
  assert.throws(() => scorePipelineArchiveUrl(invalidWeek), /valid ISO date/);
}
assert.throws(
  () => scorePipelineArchiveUrl('2026-10-09', 'https://example.com'),
  /Unsupported Score pipeline origin/,
);

const [home, score, astroConfig, threeDials, weeklyRegime] = await Promise.all([
  readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/score.astro', import.meta.url), 'utf8'),
  readFile(new URL('../astro.config.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/ThreeDialsSnapshot.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/practice/weekly-regime.astro', import.meta.url), 'utf8'),
]);

for (const [name, text] of [['home', home], ['score', score]]) {
  assert.match(text, /resolveScorePipelineOrigin/);
  assert.match(text, /scorePipelineUrl/);
  assert.equal(text.includes(LEGACY_SCORE_PIPELINE_ORIGIN), false, `${name} must not hard-code the legacy Score origin.`);
  assert.equal(text.includes(BRANDED_SCORE_PIPELINE_ORIGIN), false, `${name} must not hard-code the branded Score origin.`);
  assert.match(text, /PUBLIC_SCORE_PIPELINE_ORIGIN/);
  assert.ok(text.includes('score-pipeline-origin.js'), `${name} must import the Score origin contract.`);
}

for (const [name, text] of [['Three Dials', threeDials], ['Weekly Regime Lab', weeklyRegime]]) {
  assert.doesNotMatch(text, /scorePipelineArchiveUrl|snapshot\.model_output|data-score-model-output/);
  assert.equal(text.includes(LEGACY_SCORE_PIPELINE_ORIGIN), false, `${name} must not hard-code the legacy Score origin.`);
  assert.equal(text.includes(BRANDED_SCORE_PIPELINE_ORIGIN), false, `${name} must not hard-code the branded Score origin.`);
  assert.match(text, /href="\/score\/"|href=\{"\/score\/"\}/, `${name} may link to the separate Score product without embedding its data contract.`);
}
assert.match(threeDials, /intentionally not embedded in the Three Dials v2 snapshot/);
assert.match(weeklyRegime, /data-score-separate-product/);

assert.match(astroConfig, /resolveScorePipelineOrigin/);
assert.match(astroConfig, /PUBLIC_SCORE_PIPELINE_ORIGIN/);
assert.match(astroConfig, /frame-src/);
assert.match(astroConfig, /scorePipelineOrigin/);
assert.equal(astroConfig.includes(LEGACY_SCORE_PIPELINE_ORIGIN), false, 'Astro CSP config must not hard-code the legacy Score origin.');
assert.equal(astroConfig.includes(BRANDED_SCORE_PIPELINE_ORIGIN), false, 'Astro CSP config must not hard-code the branded Score origin.');

console.log('Score pipeline origin contract passed.');
