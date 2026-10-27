import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const generator = new URL('./generate-three-dials-snapshot.mjs', import.meta.url);
const sourceLatest = new URL('../src/data/three-dials-latest.json', import.meta.url);
const publicLatest = new URL('../public/data/three-dials/latest.json', import.meta.url);

const [generatorText, beforeSource, beforePublic] = await Promise.all([
  readFile(generator, 'utf8'),
  readFile(sourceLatest, 'utf8'),
  readFile(publicLatest, 'utf8'),
]);

assert.equal(beforeSource, beforePublic, 'Existing latest copies must remain synchronized while v2 is under review.');

for (const forbidden of ['DX-Y.NYB', 'BAMLH0A0HYM2', 'VIXCLS', 'query1.finance.yahoo.com', 'finance.yahoo.com/quote/']) {
  assert.equal(generatorText.includes(forbidden), false, `Three Dials v2 generator must not contain restricted legacy source ${forbidden}.`);
}
for (const required of [
  'FED_BROAD_USD',
  'FED_10Y_REAL_YIELD',
  'SOFR_IORB_SPREAD',
  'DTWEXBGS',
  'DFII10',
  'IORB',
  'https://markets.newyorkfed.org',
  '/api/rates/secured/sofr/search.json',
  'NYFED_SOFR_NOTICE',
  'federal_reserve_board_public_domain',
  'derived_from_permitted_primary_sources',
]) {
  assert.ok(generatorText.includes(required), `Three Dials v2 generator must bind rights-safe contract ${required}.`);
}

assert.match(generatorText, /FRED is used only as the transport/);
assert.match(generatorText, /must not be labeled DXY/);
assert.match(generatorText, /not a credit spread or a complete measure of market liquidity\/stress/);
assert.match(generatorText, /break_from_v1: true/);
assert.match(generatorText, /Do not splice v1 and v2 observations into one continuous series/);
assert.match(generatorText, /USD Impact is not affiliated with the New York Fed/);
assert.match(generatorText, /does not sanction or endorse any particular republication/);

const latest = JSON.parse(beforeSource);
assert.equal(latest.status, 'pending', 'The implementation PR must not activate public numeric publication.');
assert.equal(latest.source_rights_state, 'unverified', 'The existing Production hold remains in checked-in latest data until release approval.');

console.log('Three-Dials v2 source-rights contract PASS: no restricted legacy fetches and current checked-in hold remains unchanged.');
