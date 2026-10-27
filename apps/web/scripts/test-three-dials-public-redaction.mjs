import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const dir = new URL('../public/data/three-dials/archive/', import.meta.url);
const archives = (await readdir(dir)).filter((s) => s.endsWith('.json')).sort();
assert(archives.length >= 7, 'Three Dials dated archives must remain available');

const pub = await readFile(new URL('../public/data/three-dials/latest.json', import.meta.url), 'utf8');
const src = await readFile(new URL('../src/data/three-dials-latest.json', import.meta.url), 'utf8');
assert.equal(pub, src, 'Latest public and source files must be identical');

const legacyAllowed = ['version','status','week_ending','source_rights_state','hold_applied_at','message','scope','notice_url'].sort();
const v2Allowed = ['version','methodology','status','week_ending','retrieved_at','observation_policy','labels','dials','interpretation','source_rights','disclosures'].sort();
const requiredV2Facts = new Set(['FED_BROAD_USD', 'FED_10Y_REAL_YIELD', 'SOFR_IORB_SPREAD']);
const forbiddenV2Markers = ['DX-Y.NYB', 'BAMLH0A0HYM2', 'VIXCLS', 'model_output'];

const verifyLegacyHold = (value, filename, week) => {
  assert.deepEqual(Object.keys(value).sort(), legacyAllowed, filename + ' contains unscreened hold fields');
  assert.equal(value.version, 1, filename);
  assert.equal(value.status, 'pending', filename);
  assert.equal(value.week_ending, week, filename);
  assert.equal(value.source_rights_state, 'unverified', filename);
  assert.equal(value.hold_applied_at, '2026-10-21', filename);
  assert.match(value.message, /temporarily unavailable pending source-rights review/);
  assert.match(value.scope, /Numeric observations, historical comparisons/);
  assert.equal(value.notice_url, 'https://github.com/usdimpact/usd-impact-site/issues/845');
  for (const key of ['dials', 'facts', 'interpretation', 'model_output', 'latest', 'previous', 'change']) {
    assert(!Object.hasOwn(value, key), filename + ' leaked ' + key);
  }
};

const verifyPublishedV2 = (value, raw, filename, week) => {
  assert.deepEqual(Object.keys(value).sort(), v2Allowed, filename + ' contains unexpected v2 fields');
  assert.equal(value.version, 2, filename);
  assert.equal(value.status, 'published', filename);
  assert.equal(value.week_ending, week, filename);
  assert.equal(value.methodology?.id, 'three-dials-rights-safe-v2', filename);
  assert.equal(value.methodology?.break_from_v1, true, filename);
  assert.match(value.methodology?.history_policy ?? '', /Do not splice v1 and v2/);
  assert.deepEqual(Object.keys(value.dials ?? {}).sort(), ['dollar', 'funding_pressure', 'real_rates']);
  assert.equal(value.dials?.dollar?.facts?.length, 1, filename);
  assert.equal(value.dials?.real_rates?.facts?.length, 1, filename);
  assert.equal(value.dials?.funding_pressure?.facts?.length, 1, filename);

  const facts = Object.values(value.dials ?? {}).flatMap((dial) => dial?.facts ?? []);
  assert.deepEqual(new Set(facts.map((fact) => fact.id)), requiredV2Facts, filename + ' v2 fact set changed');
  for (const fact of facts) {
    assert.match(fact.source_url, /^https:\/\/(www\.federalreserve\.gov|www\.newyorkfed\.org)\//, filename);
    assert(Number.isFinite(fact.latest?.value), filename + ' latest value is not finite');
    assert(Number.isFinite(fact.previous?.value), filename + ' previous value is not finite');
    assert(Number.isFinite(fact.change?.value), filename + ' change value is not finite');
  }

  assert.equal(value.source_rights?.federal_reserve_board?.class, 'public_domain_unless_otherwise_indicated', filename);
  assert.equal(value.source_rights?.new_york_fed_sofr?.class, 'permitted_with_reference_rate_notice', filename);
  assert.match(value.source_rights?.new_york_fed_sofr?.notice ?? '', /does not sanction or endorse any particular republication/);
  assert.match(value.source_rights?.new_york_fed_sofr?.affiliation_notice ?? '', /not affiliated with the New York Fed/);
  assert(Array.isArray(value.disclosures) && value.disclosures.length >= 8, filename + ' disclosures are incomplete');
  assert.equal(Object.hasOwn(value, 'model_output'), false, filename + ' must not embed Score output');

  for (const marker of forbiddenV2Markers) {
    assert.equal(raw.includes(marker), false, filename + ' contains forbidden legacy/Score marker ' + marker);
  }
};

let legacyHoldCount = 0;
let publishedV2Count = 0;
for (const filename of archives) {
  assert.match(filename, /^20\d{2}-\d{2}-\d{2}\.json$/);
  const raw = await readFile(new URL(filename, dir), 'utf8');
  const value = JSON.parse(raw);
  const week = filename.slice(0, -5);
  if (value.status === 'pending') {
    verifyLegacyHold(value, filename, week);
    legacyHoldCount += 1;
  } else {
    verifyPublishedV2(value, raw, filename, week);
    publishedV2Count += 1;
  }
}
assert(legacyHoldCount >= 7, 'Historical rights-hold archives must remain preserved');

const latest = JSON.parse(pub);
const latestArchiveName = `${latest.week_ending}.json`;
assert(archives.includes(latestArchiveName), 'Latest Three Dials week must have an immutable dated archive');
const latestArchive = await readFile(new URL(latestArchiveName, dir), 'utf8');
assert.equal(pub, latestArchive, 'Latest public/source snapshot must be byte-identical to its immutable archive');

if (latest.status === 'pending') {
  verifyLegacyHold(latest, 'latest.json', latest.week_ending);
} else {
  verifyPublishedV2(latest, pub, 'latest.json', latest.week_ending);
}

console.log(
  'Three Dials public-data contract PASS: '
  + legacyHoldCount + ' historical rights-hold archives, '
  + publishedV2Count + ' published v2 archives, synchronized latest.'
);
