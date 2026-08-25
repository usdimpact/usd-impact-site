import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  BRANDED_SCORE_PIPELINE_ORIGIN,
  LEGACY_SCORE_PIPELINE_ORIGIN,
  resolveScorePipelineOrigin,
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

const [home, score, astroConfig] = await Promise.all([
  readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/score.astro', import.meta.url), 'utf8'),
  readFile(new URL('../astro.config.mjs', import.meta.url), 'utf8'),
]);

for (const [name, text] of [['home', home], ['score', score]]) {
  assert.match(text, /resolveScorePipelineOrigin/);
  assert.match(text, /scorePipelineUrl/);
  assert.equal(text.includes(LEGACY_SCORE_PIPELINE_ORIGIN), false, `${name} must not hard-code the legacy Score origin.`);
  assert.equal(text.includes(BRANDED_SCORE_PIPELINE_ORIGIN), false, `${name} must not hard-code the branded Score origin.`);
  assert.match(text, /PUBLIC_SCORE_PIPELINE_ORIGIN/);
  assert.ok(text.includes('score-pipeline-origin.js'), `${name} must import the Score origin contract.`);
}

assert.match(astroConfig, /resolveScorePipelineOrigin/);
assert.match(astroConfig, /PUBLIC_SCORE_PIPELINE_ORIGIN/);
assert.match(astroConfig, /frame-src/);
assert.match(astroConfig, /scorePipelineOrigin/);
assert.equal(astroConfig.includes(LEGACY_SCORE_PIPELINE_ORIGIN), false, 'Astro CSP config must not hard-code the legacy Score origin.');
assert.equal(astroConfig.includes(BRANDED_SCORE_PIPELINE_ORIGIN), false, 'Astro CSP config must not hard-code the branded Score origin.');

console.log('Score pipeline origin contract passed.');
