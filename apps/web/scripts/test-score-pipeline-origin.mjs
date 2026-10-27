import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  BRANDED_SCORE_PIPELINE_ORIGIN,
  LEGACY_SCORE_PIPELINE_ORIGIN,
  resolveScorePipelineOrigin,
  scorePipelineArchiveUrl,
  scorePipelineUrl,
} from '../src/lib/score-pipeline-origin.js';

const pinnedPreview = 'https://fix-score-membership-handoff-147.usd-impact-pipeline.pages.dev';
const retiredWorkerPreview = 'https://pr-148-usd-impact-score-isolated-dev.michael-w-d0b.workers.dev';

assert.equal(resolveScorePipelineOrigin(pinnedPreview, pinnedPreview, 'preview'), pinnedPreview);
assert.equal(scorePipelineUrl('/en/', pinnedPreview, pinnedPreview, 'preview'), `${pinnedPreview}/en/`);
for (const environment of ['', 'production', 'development']) {
  assert.throws(() => resolveScorePipelineOrigin(pinnedPreview, pinnedPreview, environment),
    /Unsupported Score pipeline origin/);
}
assert.throws(() => resolveScorePipelineOrigin(pinnedPreview, '', 'preview'), /Unsupported Score pipeline origin/);
for (const candidate of [
  retiredWorkerPreview,
  'https://evil.workers.dev',
  'https://usd-impact-pipeline.pages.dev.evil.test',
  'http://fix-score-membership-handoff-147.usd-impact-pipeline.pages.dev',
  'https://fix-score-membership-handoff-147.usd-impact-pipeline.pages.dev:8443',
]) {
  assert.throws(() => resolveScorePipelineOrigin(candidate, candidate, 'preview'),
    /Unsupported Score pipeline origin/, 'Unapproved origin: '+candidate);
}

assert.equal(resolveScorePipelineOrigin(), LEGACY_SCORE_PIPELINE_ORIGIN);
assert.equal(resolveScorePipelineOrigin(''), LEGACY_SCORE_PIPELINE_ORIGIN);
assert.equal(resolveScorePipelineOrigin(`${BRANDED_SCORE_PIPELINE_ORIGIN}/`), BRANDED_SCORE_PIPELINE_ORIGIN);
assert.equal(scorePipelineUrl('/en/', BRANDED_SCORE_PIPELINE_ORIGIN), `${BRANDED_SCORE_PIPELINE_ORIGIN}/en/`);
assert.equal(scorePipelineUrl('archive/en/', LEGACY_SCORE_PIPELINE_ORIGIN), `${LEGACY_SCORE_PIPELINE_ORIGIN}/archive/en/`);
assert.throws(() => resolveScorePipelineOrigin('https://example.com'), /Unsupported Score pipeline origin/);

assert.equal(
  scorePipelineArchiveUrl('2026-10-09', ` ${BRANDED_SCORE_PIPELINE_ORIGIN}/ `),
  `${BRANDED_SCORE_PIPELINE_ORIGIN}/archive/2026-10-09/weekly_input.json`,
);
for (const invalidWeek of [
  undefined, null, 20261009, '', '2026-2-09', '2026-02-29', '2026-04-31',
  '2026-13-01', '2026-00-01', '2026-10-00', '2026-10-09T00:00:00Z',
  '../latest', '2026-10-09/..', ' 2026-10-09',
]) {
  assert.throws(() => scorePipelineArchiveUrl(invalidWeek), /valid ISO date/);
}

const [home, score, astroConfig, threeDials, weeklyRegime, cspBuildValidator] = await Promise.all([
  readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/score.astro', import.meta.url), 'utf8'),
  readFile(new URL('../astro.config.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/ThreeDialsSnapshot.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/practice/weekly-regime.astro', import.meta.url), 'utf8'),
  readFile(new URL('./test-csp-build.mjs', import.meta.url), 'utf8'),
]);

for (const [name, text] of [['home', home], ['score', score]]) {
  assert.match(text, /resolveScorePipelineOrigin/);
  assert.match(text, /scorePipelineUrl/);
  assert.equal(text.includes(LEGACY_SCORE_PIPELINE_ORIGIN), false, `${name} must not hard-code the legacy Score origin.`);
  assert.equal(text.includes(BRANDED_SCORE_PIPELINE_ORIGIN), false, `${name} must not hard-code the branded Score origin.`);
  assert.match(text, /PUBLIC_SCORE_PIPELINE_ORIGIN/);
}
assert.match(score, /action="\/api\/score-redeem"/);
assert.doesNotMatch(score, /resolveScoreStageEOrigin|SCORE_PRODUCTION_QA_PIPELINE|workers\.dev/);

for (const [name, text] of [['Three Dials', threeDials], ['Weekly Regime Lab', weeklyRegime]]) {
  assert.match(text, /scorePipelineArchiveUrl/);
  assert.match(text, /SCORE_PREVIEW_PIPELINE_ORIGIN/);
  assert.equal(text.includes(LEGACY_SCORE_PIPELINE_ORIGIN), false, `${name} must use the origin contract.`);
  assert.equal(text.includes(BRANDED_SCORE_PIPELINE_ORIGIN), false, `${name} must use the origin contract.`);
}

assert.doesNotMatch(astroConfig, /resolveScoreStageEOrigin|SCORE_PRODUCTION_QA_PIPELINE|scoreFormActions/);
assert.ok(astroConfig.includes('"form-action \'self\'"'));
assert.ok(astroConfig.includes('"frame-src \'self\' https://challenges.cloudflare.com"'));
assert.doesNotMatch(astroConfig, /workers\.dev/);

assert.ok(cspBuildValidator.includes('"form-action \'self\'"'));
assert.ok(cspBuildValidator.includes('"frame-src \'self\' https://challenges.cloudflare.com"'));
assert.doesNotMatch(cspBuildValidator, /scorePipelineOrigin/);

console.log('Score pipeline public-origin and Vercel member-gate contract passed.');
