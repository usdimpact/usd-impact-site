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
  assert.doesNotMatch(text, /https:\/\/usd-impact-pipeline\.pages\.dev/);
  assert.doesNotMatch(text, /https:\/\/score\.usd-impact\.com/);
  assert.match(text, /PUBLIC_SCORE_PIPELINE_ORIGIN/);
  assert.ok(text.includes("score-pipeline-origin.js"), `${name} must import the Score origin contract.`);
}

assert.match(astroConfig, /resolveScorePipelineOrigin/);
assert.match(astroConfig, /PUBLIC_SCORE_PIPELINE_ORIGIN/);
assert.match(astroConfig, /frame-src/);
assert.match(astroConfig, /scorePipelineOrigin/);
assert.doesNotMatch(astroConfig, /frame-src[^\n]*usd-impact-pipeline\.pages\.dev/);
assert.doesNotMatch(astroConfig, /frame-src[^\n]*score\.usd-impact\.com/);

console.log('Score pipeline origin contract passed.');
