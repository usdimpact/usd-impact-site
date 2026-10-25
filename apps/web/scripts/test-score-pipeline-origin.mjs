import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  BRANDED_SCORE_PIPELINE_ORIGIN,
  LEGACY_SCORE_PIPELINE_ORIGIN,
  resolveScorePipelineOrigin,
  resolveScoreStageEOrigin,
  scorePipelineArchiveUrl,
  scorePipelineUrl,
} from '../src/lib/score-pipeline-origin.js';


const stageEOrigin = 'https://fix-score-membership-handoff.usd-impact-pipeline.pages.dev';
assert.equal(resolveScoreStageEOrigin(stageEOrigin, 'true', 'production'), stageEOrigin);
for (const args of [
  [stageEOrigin, 'false', 'production'],
  [stageEOrigin, 'true', 'preview'],
  [stageEOrigin, 'true', 'development'],
]) {
  assert.equal(resolveScoreStageEOrigin(...args), '');
}
for (const candidate of [
  'https://score.usd-impact.com',
  'https://evil.pages.dev',
  'http://fix-score-membership-handoff.usd-impact-pipeline.pages.dev',
  'https://fix-score-membership-handoff.usd-impact-pipeline.pages.dev:8443',
  'https://fix-score-membership-handoff.usd-impact-pipeline.pages.dev/path',
]) {
  assert.throws(
    () => resolveScoreStageEOrigin(candidate, 'true', 'production'),
    /Unsupported Stage E Score origin/,
  );
}

const pinnedPreview = 'https://fix-score-membership-handoff-147.usd-impact-pipeline.pages.dev';
const isolatedWorkerPreview = 'https://pr-148-usd-impact-score-isolated-dev.michael-w-d0b.workers.dev';
assert.equal(resolveScorePipelineOrigin(isolatedWorkerPreview, isolatedWorkerPreview, 'preview'), isolatedWorkerPreview);
assert.equal(scorePipelineUrl('/en/', isolatedWorkerPreview, isolatedWorkerPreview, 'preview'), isolatedWorkerPreview+'/en/');
assert.equal(scorePipelineArchiveUrl('2026-10-09', isolatedWorkerPreview, isolatedWorkerPreview, 'preview'),
  isolatedWorkerPreview+'/archive/2026-10-09/weekly_input.json');
for (const env of ['', 'production', 'development']) {
  assert.throws(() => resolveScorePipelineOrigin(isolatedWorkerPreview, isolatedWorkerPreview, env),
    /Unsupported Score pipeline origin/);
}
assert.throws(() => resolveScorePipelineOrigin(isolatedWorkerPreview, '', 'preview'), /Unsupported Score pipeline origin/);
assert.throws(() => resolveScorePipelineOrigin(isolatedWorkerPreview, pinnedPreview, 'preview'), /Unsupported Score pipeline origin/);
for (const host of [
  'https://pr-149-usd-impact-score-isolated-dev.michael-w-d0b.workers.dev',
  'https://pr-148-usd-impact-score-isolated-dev.attacker.workers.dev',
  'https://evil.workers.dev',
  isolatedWorkerPreview+'.evil.example',
  isolatedWorkerPreview.replace('https:', 'http:'),
  isolatedWorkerPreview+':443',
  isolatedWorkerPreview+'/en/',
  isolatedWorkerPreview+'?ticket=notallowed',
]) {
  assert.throws(() => resolveScorePipelineOrigin(host, host, 'preview'),
    /Unsupported Score pipeline origin/, 'Unapproved origin: '+host);
}

assert.equal(resolveScorePipelineOrigin(pinnedPreview, pinnedPreview, 'preview'), pinnedPreview);
assert.equal(scorePipelineUrl('/en/', pinnedPreview, pinnedPreview, 'preview'), `${pinnedPreview}/en/`);
assert.throws(() => scorePipelineUrl('/en/', pinnedPreview, pinnedPreview, 'production'), /Unsupported Score pipeline origin/);

for (const environment of ['', 'production', 'development']) {
  assert.throws(() => resolveScorePipelineOrigin(pinnedPreview, pinnedPreview, environment), /Unsupported Score pipeline origin/);
}
assert.throws(
  () => resolveScorePipelineOrigin('https://other.usd-impact-pipeline.pages.dev', pinnedPreview, 'preview'),
  /Unsupported Score pipeline origin/,
);
for (const candidate of [
  'https://usd-impact-pipeline.pages.dev.evil.test',
  'http://fix-score-membership-handoff-147.usd-impact-pipeline.pages.dev',
  'https://fix-score-membership-handoff-147.usd-impact-pipeline.pages.dev:8443',
]) {
  assert.throws(() => resolveScorePipelineOrigin(candidate, candidate, 'preview'), /Unsupported Score pipeline origin/);
}
assert.throws(() => resolveScorePipelineOrigin(pinnedPreview, '', 'preview'), /Unsupported Score pipeline origin/);

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
  assert.ok(text.includes('score-pipeline-origin.js'), `${name} must import the Score origin contract.`);
}

for (const [name, text] of [['Three Dials', threeDials], ['Weekly Regime Lab', weeklyRegime]]) {
  assert.match(text, /import \{ scorePipelineArchiveUrl \} from ['"].*score-pipeline-origin\.js['"]/);
  assert.match(text, /scorePipelineArchiveUrl\(\s*snapshot\.model_output\.week_ending,\s*import\.meta\.env\.PUBLIC_SCORE_PIPELINE_ORIGIN/);
  assert.match(text, /href=\{scoreArchiveUrl\}/);
  assert.doesNotMatch(text, /href=\{snapshot\.model_output\.source_url\}/);
  assert.equal(text.includes(LEGACY_SCORE_PIPELINE_ORIGIN), false, `${name} must use the origin contract.`);
  assert.equal(text.includes(BRANDED_SCORE_PIPELINE_ORIGIN), false, `${name} must use the origin contract.`);
}
assert.equal(
  scorePipelineArchiveUrl('2026-10-09', pinnedPreview, pinnedPreview, 'preview'),
  `${pinnedPreview}/archive/2026-10-09/weekly_input.json`,
);
assert.throws(
  () => scorePipelineArchiveUrl('2026-10-09', pinnedPreview, pinnedPreview, 'production'),
  /Unsupported Score pipeline origin/,
);
assert.match(threeDials, /SCORE_PREVIEW_PIPELINE_ORIGIN/);
assert.match(weeklyRegime, /SCORE_PREVIEW_PIPELINE_ORIGIN/);
assert.match(threeDials, /const scoreArchiveUrl = isPublished\s*\?/);
assert.match(weeklyRegime, /const scoreArchiveUrl = snapshot\.status === 'published'\s*\?/);
assert.match(weeklyRegime, /\{scoreArchiveUrl && \(\s*<section class="score-output"/);

// The build-time CSP validator must use the same strict Preview origin pin as
// Astro's CSP and the Score route. Preview keys must never open Production.
assert.ok(cspBuildValidator.includes('process.env.SCORE_PREVIEW_PIPELINE_ORIGIN'));
assert.ok(cspBuildValidator.includes('process.env.VERCEL_ENV'));
assert.ok(cspBuildValidator.includes("`form-action 'self' \u0024{scorePipelineOrigin}`"));

assert.match(astroConfig, /resolveScorePipelineOrigin/);
assert.match(astroConfig, /PUBLIC_SCORE_PIPELINE_ORIGIN/);
assert.match(astroConfig, /frame-src/);
assert.match(astroConfig, /scorePipelineOrigin/);
assert.equal(astroConfig.includes(LEGACY_SCORE_PIPELINE_ORIGIN), false, 'Astro CSP config must not hard-code the legacy Score origin.');
assert.equal(astroConfig.includes(BRANDED_SCORE_PIPELINE_ORIGIN), false, 'Astro CSP config must not hard-code the branded Score origin.');

console.log('Score pipeline origin contract passed.');
