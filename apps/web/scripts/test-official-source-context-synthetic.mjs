import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assessOfficialSourceSyntheticPilot,
  OFFICIAL_CONTEXT_SCHEMA,
  OFFICIAL_CONTEXT_CATALOG,
  OFFICIAL_CONTEXT_UNAVAILABLE_STRESS,
  OFFICIAL_CONTEXT_ROUTE,
} from '../src/lib/official-source-context-synthetic.mjs';

const fixtureText = await readFile(new URL('../src/data/official-source-context-synthetic.json', import.meta.url), 'utf8');
const fixture = JSON.parse(fixtureText);
const good = assessOfficialSourceSyntheticPilot(fixture);
assert.equal(fixture.schema, OFFICIAL_CONTEXT_SCHEMA);
assert.equal(OFFICIAL_CONTEXT_ROUTE, '/lab/official-source-context/');
assert.deepEqual(OFFICIAL_CONTEXT_CATALOG.map((entry) => entry.id), ['BOARD_H10_BROAD_NOMINAL','BOARD_H15_TIPS10Y']);
assert.equal(good.status, 'synthetic-demo');
assert.equal(good.rows.length, 2);
assert.ok(good.rows.every((entry) => entry.isSynthetic && entry.notEquivalentTo && entry.rightsState));
assert.equal(good.rows[0].change, '+1.00 index points (synthetic)');
assert.equal(good.rows[1].change, '-0.10 percentage points (synthetic)');
assert.equal(good.thirdDial.status, 'unavailable');
assert.equal(good.thirdDial, OFFICIAL_CONTEXT_UNAVAILABLE_STRESS);
assert.equal(good.publicationAllowed, false);
assert.equal(good.scoreModelAllowed, false);
assert.equal(good.regimeAvailable, false);
assert.equal(good.scoreOutput, null);

const mutations = [
  ['real-source-mode', (x) => { x.mode = 'live'; }],
  ['real-source-fetch', (x) => { x.source_fetch_count = 1; }],
  ['publishing-switch', (x) => { x.publication_allowed = true; }],
  ['score-switch', (x) => { x.score_model_allowed = true; }],
  ['schema-change', (x) => { x.schema = 'other'; }],
  ['extra-score-data', (x) => { x.model_output = { score: 0.5 }; }],
  ['unexpected-payload', (x) => { x.provider_payload = { data: 'unsafe' }; }],
  ['unknown-id', (x) => { x.observations[0].id = 'DXY'; }],
  ['duplicate-id', (x) => { x.observations[1].id = x.observations[0].id; }],
  ['swapped-order', (x) => { x.observations.reverse(); }],
  ['wrong-unit', (x) => { x.observations[0].unit = 'percent_per_annum'; }],
  ['real-provenance', (x) => { x.observations[0].origin = 'downloaded-provider-data'; }],
  ['missing-one', (x) => { x.observations.pop(); }],
  ['missing-value', (x) => { delete x.observations[0].latest.value; }],
  ['nonfinite-value', (x) => { x.observations[0].latest.value = Infinity; }],
  ['wrong-observation-week', (x) => { x.observations[0].latest.date = '2031-01-17'; }],
  ['stale-cutoff', (x) => { x.week_ending = '2031-01-17'; }],
  ['non-Friday', (x) => { x.previous_friday = '2031-01-02'; }],
  ['same-week', (x) => { x.week_ending = x.previous_friday; }],
  ['missing-stress', (x) => { delete x.stress; }],
  ['stress-substitute', (x) => { x.stress.status = 'available'; }],
  ['stress-hidden-market-value', (x) => { x.stress.observations = [{value: 99}]; }],
  ['stress-renamed', (x) => { x.stress.reason = 'not needed'; }],
  ['extra-indicator-field', (x) => { x.observations[0].source_url = 'https://example.com'; }],
  ['extra-measurement-field', (x) => { x.observations[0].latest.observed_at = '2031-01-10T00:00:00Z'; }],
];
for (const [name, change] of mutations) {
  const trial = structuredClone(fixture);
  change(trial);
  const result = assessOfficialSourceSyntheticPilot(trial);
  assert.equal(result.status, 'hold', 'Must reject ' + name);
  assert.deepEqual(result.rows, [], 'Must not leak partial rows on ' + name);
  assert.equal(result.publicationAllowed, false);
  assert.equal(result.regimeAvailable, false);
  assert.equal(result.scoreOutput, null);
}

const [page, moduleCode, legacy, generator, packageText] = await Promise.all([
  readFile(new URL('../src/pages/lab/official-source-context.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/official-source-context-synthetic.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../src/data/three-dials-latest.json', import.meta.url), 'utf8'),
  readFile(new URL('./generate-three-dials-snapshot.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
]);
const legacyState = JSON.parse(legacy);
assert.equal(legacyState.status, 'pending');
assert.equal(legacyState.source_rights_state, 'unverified');
assert.equal(legacyState.dials, undefined);
assert.equal(legacyState.model_output, undefined);
assert.match(generator, /HOLD_THREE_DIALS_REDISTRIBUTION_RIGHTS/);
assert.ok(generator.indexOf('assertPublicThreeDialsRedistributionRights();') < generator.indexOf('const fredEntries = await Promise.all('));
for (const text of [page,moduleCode]) {
  assert.doesNotMatch(text, /\bfetch\s*\(|XMLHttpRequest|https\.request\s*\(/i, 'Pilot may not fetch or call providers');
  assert.doesNotMatch(text, /\/data\/three-dials\/(latest|archive)\.json|weekly_input_latest\.json/i, 'No legacy live data reads');
  assert.doesNotMatch(text, /import\.meta\.env|process\.env|localStorage/i, 'No flags, secrets or client storage');
}
assert.match(page, /noindex=\{true\}/);
assert.match(page, /SYNTHETIC EXERCISE/);
assert.match(page, /data-publishable="false"/);
assert.match(page, /data-score-enabled="false"/);
assert.match(page, /data-stress-state="unavailable"/);
assert.match(page, /<main id="main-content"/);
assert.doesNotMatch(page, /scorePipelineArchiveUrl|assessThreeDials|classifyHyOasChange/);
assert.ok(JSON.parse(packageText).scripts['validate:compliance'].includes('test-official-source-context-synthetic.mjs'));
console.log('Official-source context synthetic pilot PASS: 25 negative gates, no provider requests, no legacy/Score changes.');
