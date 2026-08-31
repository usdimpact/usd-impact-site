import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assessBookLiveEvidence,
  getBookLiveEvidenceFacts,
  getDxyEvidenceReference,
  getWeeklyDialReference,
  validateBookLiveEvidenceSnapshot,
} from '../src/lib/book-site-bridge/live-evidence.mjs';
import { compareWeeklyReading } from '../src/lib/book-site-bridge/practice-classifiers.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(scriptDir, '..');
const snapshot = JSON.parse(readFileSync(resolve(webRoot, 'src/data/three-dials-latest.json'), 'utf8'));
const tools = JSON.parse(readFileSync(resolve(webRoot, 'src/data/book-site-bridge/tools.json'), 'utf8'));

assert.equal(validateBookLiveEvidenceSnapshot(snapshot).valid, true, 'The repository Three-Dials snapshot must satisfy the Phase 2B source-bound contract.');
const facts = getBookLiveEvidenceFacts(snapshot);
for (const id of ['DXY', 'DTWEXBGS', 'DFII10', 'DGS10', 'BAMLH0A0HYM2', 'VIXCLS', 'SOFR_IORB_SPREAD']) {
  assert(facts.has(id), `Phase 2B requires source-bound fact ${id}.`);
}

const synthetic = structuredClone(snapshot);
synthetic.week_ending = '2026-08-21';
synthetic.model_output.week_ending = '2026-08-21';
assert.deepEqual(
  { state: assessBookLiveEvidence(synthetic, new Date('2026-08-28T23:30:00Z')).state, usable: assessBookLiveEvidence(synthetic, new Date('2026-08-28T23:30:00Z')).usable },
  { state: 'current', usable: true },
  'On Friday the workflow definition still treats the prior Friday as the latest completed week.',
);
assert.deepEqual(
  { state: assessBookLiveEvidence(synthetic, new Date('2026-08-29T12:00:00Z')).state, usable: assessBookLiveEvidence(synthetic, new Date('2026-08-29T12:00:00Z')).usable },
  { state: 'publication-pending', usable: true },
  'The prior snapshot remains usable during the normal Monday/Tuesday publication window.',
);
assert.deepEqual(
  { state: assessBookLiveEvidence(synthetic, new Date('2026-09-02T00:01:00Z')).state, usable: assessBookLiveEvidence(synthetic, new Date('2026-09-02T00:01:00Z')).usable },
  { state: 'stale', usable: false },
  'The comparison must fail closed once the publication window expires.',
);

const invalidScoreWeek = structuredClone(snapshot);
invalidScoreWeek.model_output.week_ending = '2099-01-01';
assert.equal(validateBookLiveEvidenceSnapshot(invalidScoreWeek).valid, false, 'A mismatched Score week must fail closed.');
assert.equal(assessBookLiveEvidence(invalidScoreWeek, new Date()).usable, false);

const dxyReference = getDxyEvidenceReference(snapshot);
assert(['firmer', 'softer', 'mixed'].includes(dxyReference.dxy));
assert(['firmer', 'softer', 'mixed'].includes(dxyReference.broad));
assert(['confirmed', 'mixed', 'divergent'].includes(dxyReference.breadthConfirmation));

const weeklyReference = getWeeklyDialReference(snapshot);
assert(['firmer', 'softer', 'mixed'].includes(weeklyReference.dollar));
assert(['rising', 'falling', 'mixed'].includes(weeklyReference.realRates));
assert(['tightening', 'easing', 'mixed'].includes(weeklyReference.liquidity));

const sameDialsDifferentDriver = compareWeeklyReading(
  { ...weeklyReference, driver: 'rates' },
  { ...weeklyReference, driver: 'asset-specific' },
);
assert.equal(sameDialsDifferentDriver.total, 3, 'Phase 2B must compare exactly three deterministic dials.');
assert.equal(sameDialsDifferentDriver.status, 'aligned', 'Dominant-driver hypotheses must remain unscored.');

const dxyPage = readFileSync(resolve(webRoot, 'src/pages/practice/dxy-vs-broad-usd.astro'), 'utf8');
const weeklyPage = readFileSync(resolve(webRoot, 'src/pages/practice/weekly-regime.astro'), 'utf8');
for (const [name, content] of [['DXY practice', dxyPage], ['Weekly Regime Lab', weeklyPage]]) {
  assert(content.includes('three-dials-latest.json'), `${name} must reuse the repository Three-Dials snapshot.`);
  assert(content.includes('assessBookLiveEvidence'), `${name} must use the Phase 2B publication/freshness gate.`);
  assert(content.includes('data-live-evidence-state'), `${name} must expose the rendered publication state.`);
  assert(content.includes('data-live-evidence-usable'), `${name} must expose the fail-closed comparison state.`);
  assert(!content.includes('fetch('), `${name} must not add a browser or runtime market-data request.`);
  assert(!content.includes('localStorage'), `${name} must not persist the reader's financial reading.`);
  assert(!content.includes('/api/telemetry'), `${name} must not add telemetry for practice responses.`);
  assert(content.includes('noindex={true}'), `${name} must retain the existing noindex gate.`);
}
assert(dxyPage.includes('data-reference-classification'), 'DXY deterministic classification must remain inside the hidden post-submit result.');
assert(dxyPage.includes('Dated completed-week evidence'), 'DXY must identify the evidence as dated rather than real-time.');
assert(weeklyPage.includes('data-score-model-output'), 'Weekly Lab must include the exact-week Score output inside the hidden post-submit result.');
assert(weeklyPage.includes('not scored'), 'Weekly Lab must explicitly leave the driver hypothesis unscored.');
assert(weeklyPage.includes('not transmitted'), 'Weekly Lab must explicitly disclose that the written reading is not transmitted.');

for (const id of ['dxy-vs-broad-usd', 'weekly-regime-lab']) {
  const tool = tools.find((candidate) => candidate.id === id);
  assert(tool, `Missing governed tool ${id}.`);
  assert.equal(tool.status, 'preview-live-evidence');
  assert.equal(tool.version, '0.2.0-preview');
  assert(tool.dataCadence.includes('repository-published completed-week'));
  assert(tool.timestampRule.includes('publication'));
}

console.log('Book-site Phase 2B live-evidence regression passed: source boundary, freshness states, three-dial-only comparison, browser-local response boundary, and exact-week Score separation.');
