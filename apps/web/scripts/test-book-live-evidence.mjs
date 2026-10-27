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

if (snapshot.status === 'pending') {
  assert.equal(snapshot.source_rights_state, 'unverified');
  assert.equal(validateBookLiveEvidenceSnapshot(snapshot).valid, false);
  assert.deepEqual(
    { state: assessBookLiveEvidence(snapshot).state, usable: assessBookLiveEvidence(snapshot).usable },
    { state: 'rights-hold', usable: false },
  );
  assert.throws(() => getBookLiveEvidenceFacts(snapshot), /publication gate is not open/i);
} else {
  assert.equal(snapshot.status, 'published');
  assert.equal(snapshot.version, 2);
  assert.equal(validateBookLiveEvidenceSnapshot(snapshot).valid, true);
  const currentFacts = getBookLiveEvidenceFacts(snapshot);
  for (const id of ['FED_BROAD_USD', 'FED_10Y_REAL_YIELD', 'SOFR_IORB_SPREAD']) {
    assert(currentFacts.has(id), `Published repository snapshot must contain ${id}`);
  }
  assert.equal(Object.hasOwn(snapshot, 'model_output'), false);
}

const mockFacts = [
  {
    id: 'FED_BROAD_USD',
    source_url: 'https://www.federalreserve.gov/releases/h10/current/',
    latest: { date: '2026-08-21', value: 120.5 },
    previous: { date: '2026-08-14', value: 120.0 },
    change: { value: 0.42 },
  },
  {
    id: 'FED_10Y_REAL_YIELD',
    source_url: 'https://www.federalreserve.gov/releases/h15/',
    latest: { date: '2026-08-21', value: 2.4 },
    previous: { date: '2026-08-14', value: 2.35 },
    change: { value: 5 },
  },
  {
    id: 'SOFR_IORB_SPREAD',
    source_url: 'https://www.newyorkfed.org/markets/reference-rates/sofr',
    latest: { date: '2026-08-21', value: 1 },
    previous: { date: '2026-08-14', value: -1 },
    change: { value: 2 },
  },
];
const synthetic = {
  version: 2,
  status: 'published',
  week_ending: '2026-08-21',
  dials: {
    dollar: { direction: 'firmer', facts: [mockFacts[0]] },
    real_rates: { direction: 'rising', facts: [mockFacts[1]] },
    funding_pressure: { direction: 'contained', facts: [mockFacts[2]] },
  },
};
assert.equal(validateBookLiveEvidenceSnapshot(synthetic).valid, true);
const facts = getBookLiveEvidenceFacts(synthetic);
for (const fact of mockFacts) assert(facts.has(fact.id), `Synthetic fixture must contain ${fact.id}`);

assert.deepEqual(
  { state: assessBookLiveEvidence(synthetic, new Date('2026-08-28T23:30:00Z')).state, usable: assessBookLiveEvidence(synthetic, new Date('2026-08-28T23:30:00Z')).usable },
  { state: 'current', usable: true },
);
assert.deepEqual(
  { state: assessBookLiveEvidence(synthetic, new Date('2026-08-29T12:00:00Z')).state, usable: assessBookLiveEvidence(synthetic, new Date('2026-08-29T12:00:00Z')).usable },
  { state: 'publication-pending', usable: true },
);
assert.deepEqual(
  { state: assessBookLiveEvidence(synthetic, new Date('2026-09-02T00:01:00Z')).state, usable: assessBookLiveEvidence(synthetic, new Date('2026-09-02T00:01:00Z')).usable },
  { state: 'stale', usable: false },
);

assert.throws(() => getDxyEvidenceReference(synthetic), /intentionally unavailable under Three Dials v2/i);

const weeklyReference = getWeeklyDialReference(synthetic);
assert.deepEqual(weeklyReference, { dollar: 'firmer', realRates: 'rising', liquidity: 'mixed' });

const sameDialsDifferentDriver = compareWeeklyReading(
  { ...weeklyReference, driver: 'rates' },
  { ...weeklyReference, driver: 'asset-specific' },
);
assert.equal(sameDialsDifferentDriver.total, 3);
assert.equal(sameDialsDifferentDriver.status, 'aligned');

const dxyPage = readFileSync(resolve(webRoot, 'src/pages/practice/dxy-vs-broad-usd.astro'), 'utf8');
const weeklyPage = readFileSync(resolve(webRoot, 'src/pages/practice/weekly-regime.astro'), 'utf8');
for (const [name, content] of [['DXY practice', dxyPage], ['Weekly Regime Lab', weeklyPage]]) {
  assert(content.includes('three-dials-latest.json'), `${name} must reuse the repository Three-Dials snapshot.`);
  assert(content.includes('assessBookLiveEvidence'), `${name} must use the publication/freshness gate.`);
  assert(content.includes('data-live-evidence-state'), `${name} must expose the rendered publication state.`);
  assert(content.includes('data-live-evidence-usable'), `${name} must expose the fail-closed comparison state.`);
  assert(!content.includes('fetch('), `${name} must not add a browser or runtime market-data request.`);
  assert(!content.includes('localStorage'), `${name} must not persist the reader's financial reading.`);
  assert(!content.includes('/api/telemetry'), `${name} must not add telemetry for practice responses.`);
  assert(content.includes('noindex={true}'), `${name} must retain the existing noindex gate.`);
}
assert(dxyPage.includes('data-dxy-live-v2="disabled"'), 'DXY practice must explicitly expose the v2 live-comparison disablement.');
assert(weeklyPage.includes('Funding pressure'), 'Weekly Lab must use the v2 funding-pressure label.');
assert(!weeklyPage.includes('data-score-model-output'), 'Weekly Lab must not embed Score output in the Three Dials snapshot contract.');
assert(weeklyPage.includes('data-score-separate-product'), 'Weekly Lab must expose Score only as a separate product link.');

const dxyTool = tools.find((candidate) => candidate.id === 'dxy-vs-broad-usd');
const weeklyTool = tools.find((candidate) => candidate.id === 'weekly-regime-lab');
assert.equal(dxyTool?.status, 'preview-conceptual');
assert.equal(dxyTool?.version, '0.3.0-v2');
assert.equal(weeklyTool?.status, 'preview-live-evidence');
assert.equal(weeklyTool?.version, '0.3.0-v2');

console.log('Book-site Three Dials v2 live-evidence regression passed.');
