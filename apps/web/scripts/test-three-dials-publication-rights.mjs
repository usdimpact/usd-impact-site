import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const generator = new URL('./generate-three-dials-snapshot.mjs', import.meta.url);
const boardReleaseXml = new URL('../src/lib/three-dials-board-release-xml.js', import.meta.url);
const sourceLatest = new URL('../src/data/three-dials-latest.json', import.meta.url);
const publicLatest = new URL('../public/data/three-dials/latest.json', import.meta.url);

const [generatorText, boardReleaseXmlText, sourceText, publicText] = await Promise.all([
  readFile(generator, 'utf8'),
  readFile(boardReleaseXml, 'utf8'),
  readFile(sourceLatest, 'utf8'),
  readFile(publicLatest, 'utf8'),
]);
const sourceAdapterText = `${generatorText}\n${boardReleaseXmlText}`;

assert.equal(sourceText, publicText, 'Three Dials source/public latest copies must remain byte-identical.');

const forbiddenLegacy = ['DX-Y.NYB', 'BAMLH0A0HYM2', 'VIXCLS', 'query1.finance.yahoo.com', 'finance.yahoo.com/quote/'];
for (const marker of [...forbiddenLegacy, 'fred.stlouisfed.org', '/graph/fredgraph.csv', '/datadownload/Output.aspx']) {
  assert.equal(sourceAdapterText.includes(marker), false, `Three Dials v2 generator must not contain disallowed source/transport marker ${marker}.`);
}
for (const required of [
  'FED_BROAD_USD',
  'FED_10Y_REAL_YIELD',
  'SOFR_IORB_SPREAD',
  'H10/H10/JRXWTFB_N.B',
  'H15/H15/RIFLGFCY10_XII_N.B',
  'PRATES/PRATES_POLICY_RATES/RESBM_N.D',
  'JRXWTFB_N.B',
  'RIFLGFCY10_XII_N.B',
  'RESBM_N.D',
  'FRB_h10_xml.zip',
  'FRB_h15_xml.zip',
  'FRB_PRATES_xml.zip',
  'https://markets.newyorkfed.org',
  '/api/rates/secured/sofr/search.json',
  'NYFED_SOFR_NOTICE',
  'federal_reserve_board_public_domain',
  'derived_from_permitted_primary_sources',
]) {
  assert.ok(sourceAdapterText.includes(required), `Three Dials v2 generator must bind rights-safe contract ${required}.`);
}

assert.match(generatorText, /full-release XML linked from the Federal Reserve release page/);
assert.match(boardReleaseXmlText, /SERIES_NAME/);
assert.match(boardReleaseXmlText, /TIME_PERIOD/);
assert.match(boardReleaseXmlText, /OBS_VALUE/);
assert.match(boardReleaseXmlText, /extractZipEntry/);
assert.match(generatorText, /must not be labeled DXY/);
assert.match(generatorText, /not a credit spread or a complete measure of market liquidity\/stress/);
assert.match(generatorText, /break_from_v1: true/);
assert.match(generatorText, /Do not splice v1 and v2 observations into one continuous series/);
assert.match(generatorText, /USD Impact is not affiliated with the New York Fed/);
assert.match(generatorText, /does not sanction or endorse any particular republication/);
assert.doesNotMatch(generatorText, /score\.usd-impact\.com|SCORE_ORIGIN|fetchScoreModelOutput|model_output/i);

const latest = JSON.parse(sourceText);
assert.ok(['pending', 'published'].includes(latest.status), 'Three Dials latest status must be pending or published.');

if (latest.status === 'pending') {
  assert.equal(latest.version, 1);
  assert.equal(latest.source_rights_state, 'unverified');
  assert.match(latest.message, /temporarily unavailable pending source-rights review/);
  assert.equal(latest.dials, undefined);
  assert.equal(latest.interpretation, undefined);
  assert.equal(latest.model_output, undefined);
} else {
  assert.equal(latest.version, 2);
  assert.equal(latest.methodology?.id, 'three-dials-rights-safe-v2');
  assert.equal(latest.methodology?.break_from_v1, true);
  assert.match(latest.methodology?.history_policy ?? '', /Do not splice v1 and v2/);
  assert.equal(Object.hasOwn(latest, 'source_rights_state'), false);
  assert.equal(Object.hasOwn(latest, 'model_output'), false);
  assert.deepEqual(Object.keys(latest.dials ?? {}).sort(), ['dollar', 'funding_pressure', 'real_rates']);

  const facts = Object.values(latest.dials ?? {}).flatMap((dial) => dial?.facts ?? []);
  assert.deepEqual(
    new Set(facts.map((fact) => fact.id)),
    new Set(['FED_BROAD_USD', 'FED_10Y_REAL_YIELD', 'SOFR_IORB_SPREAD']),
  );
  for (const fact of facts) {
    assert.match(fact.source_url, /^https:\/\/(www\.federalreserve\.gov|www\.newyorkfed\.org)\//);
  }

  assert.equal(latest.source_rights?.federal_reserve_board?.class, 'public_domain_unless_otherwise_indicated');
  assert.equal(latest.source_rights?.new_york_fed_sofr?.class, 'permitted_with_reference_rate_notice');
  assert.match(latest.source_rights?.new_york_fed_sofr?.notice ?? '', /does not sanction or endorse any particular republication/);
  assert.match(latest.source_rights?.new_york_fed_sofr?.affiliation_notice ?? '', /not affiliated with the New York Fed/);

  for (const marker of forbiddenLegacy) {
    assert.equal(sourceText.includes(marker), false, `Published v2 snapshot contains restricted legacy marker ${marker}.`);
  }

  const archive = await readFile(new URL(`../public/data/three-dials/archive/${latest.week_ending}.json`, import.meta.url), 'utf8');
  assert.equal(sourceText, archive, 'Published latest must be byte-identical to its immutable dated archive.');
}

console.log(`Three-Dials v2 source-rights contract PASS: rights-safe generator with latest status ${latest.status}.`);
