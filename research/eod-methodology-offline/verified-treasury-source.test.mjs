import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTreasuryCandidate, fetchTreasuryCandidate, readTreasuryObservation,
  renderTreasuryCandidate, treasuryMonthlyUrl, validateTreasuryClock,
} from './verified-treasury-source.mjs';

const DAY = '2026-11-03';
const AS_OF = '2026-11-03T22:37:00Z';
const URL = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml' +
  '?data=daily_treasury_yield_curve&field_tdr_date_value_month=202611';

// All values are clearly invented fixtures. No real provider data is embedded.
function xmlRows(rows = [{day: DAY, two: '4.12', ten: '4.65'}]) {
  const rowXml = rows.map(row => '<entry><id>FICTIONAL-ROW</id><content type="application/xml">' +
    '<m:properties>' +
    '<d:NEW_DATE m:type="Edm.DateTime">' + row.day + 'T00:00:00</d:NEW_DATE>' +
    (row.two === null ? '<d:BC_2YEAR m:null="true" />' :
      '<d:BC_2YEAR m:type="Edm.Double">' + row.two + '</d:BC_2YEAR>') +
    (row.ten === null ? '<d:BC_10YEAR m:null="true" />' :
      '<d:BC_10YEAR m:type="Edm.Double">' + row.ten + '</d:BC_10YEAR>') +
    '</m:properties></content></entry>').join('');
  return '<?xml version="1.0" encoding="utf-8"?>' +
    '<feed xmlns="http://www.w3.org/2005/Atom" ' +
    'xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices" ' +
    'xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">' +
    '<updated>2100-01-01T00:00:00Z</updated>' + rowXml + '</feed>';
}

function response(xml = xmlRows(), changes = {}) {
  const h = {
    'content-type': 'application/xml; charset=utf-8',
    'content-length': String(Buffer.byteLength(xml)),
    ...changes.headers,
  };
  const {headers: _overrides, ...otherChanges} = changes;
  return {
    ok: true, status: 200, url: URL, redirected: false,
    text: async () => xml,
    ...otherChanges,
    headers: {get: name => h[name.toLowerCase()] ?? null},
  };
}

test('official Treasury URL is derived from fixed issuer and requested month only', () => {
  assert.equal(treasuryMonthlyUrl(DAY), URL);
  assert.equal(treasuryMonthlyUrl('2026-07-02').slice(-6), '202607');
  assert.throws(() => treasuryMonthlyUrl('2026-11-03?host=evil'), /invalid/);
  assert.throws(() => treasuryMonthlyUrl('2026-11-31'), /invalid/);
});

test('same New York day and 17:00 Eastern cutoff are mandatory, including DST', () => {
  assert.equal(validateTreasuryClock(DAY, AS_OF), new Date(AS_OF).toISOString());
  assert.throws(() => validateTreasuryClock(DAY, '2026-11-03T21:59:00Z'), /before 17/);
  assert.throws(() => validateTreasuryClock('2026-07-02', '2026-07-02T20:59:00Z'), /before 17/);
  assert.equal(validateTreasuryClock('2026-07-02', '2026-07-02T21:05:00Z'),
    '2026-07-02T21:05:00.000Z');
  assert.throws(() => validateTreasuryClock(DAY, '2026-11-04T00:15:00Z'), /match New York/);
  assert.throws(() => validateTreasuryClock('2026-11-07', '2026-11-07T22:37:00Z'), /weekend/);
});

test('the parser extracts dated issuer-shaped 2Y/10Y observations, not unrequested series', () => {
  const x = readTreasuryObservation(xmlRows(), DAY);
  assert.deepEqual(x, {observation_date:DAY,bc_2year_percent:4.12,bc_10year_percent:4.65});
  const y = readTreasuryObservation(xmlRows([{day:'2026-11-02',two:'3.8',ten:'4.1'},
    {day:DAY,two:'4.12',ten:'4.65'}]), DAY);
  assert.deepEqual(y,x);
});

test('private candidate contains only source values and exact 10Y−2Y arithmetic', () => {
  const x = buildTreasuryCandidate({xml:xmlRows(),day:DAY,asOfUtc:AS_OF});
  assert.equal(x.record.status, 'AWAITING_EDITORIAL_REVIEW');
  assert.equal(x.record.source.transport, 'UNVERIFIED_FIXTURE');
  assert.deepEqual(x.record.facts.map(f=>f.value), [4.12,4.65,0.53]);
  assert.deepEqual(x.en.canonical_values,x.es.canonical_values);
  assert.deepEqual(x.en.fact_ids,x.es.fact_ids);
  assert.equal(x.record.original_score_reconstruction_authorized,false);
  assert.equal(x.record.public_release_authorized,false);
  assert.equal(x.record.source.public_redistribution_rights_granted,false);
  assert.equal(x.record.source.publisher_release_instant_verified,false);
  assert.equal(x.record.source.source_sha256.length,64);
});

test('EN/ES are rendering variants of identical source IDs, units and dated observations', () => {
  const x = buildTreasuryCandidate({xml:xmlRows(),day:DAY,asOfUtc:AS_OF});
  assert.equal(x.en.canonical_source_url,URL);
  assert.equal(x.es.canonical_source_url,URL);
  assert.match(x.en.markdown,/4\.12%/);
  assert.match(x.es.markdown,/4,12%/);
  assert.match(x.es.markdown,/0,53 puntos porcentuales/);
  assert.match(x.en.markdown,/0\.53 percentage points/);
  assert.match(x.en.markdown,/verified.*licensed or permitted/i);
  assert.match(x.es.markdown,/verificados.*licencia o permiso/i);
  assert.match(x.en.markdown,/not the original USD Impact Score/);
  assert.match(x.es.markdown,/No sustituya el Score original/);
  assert.match(x.en.markdown,/original publisher release instant is not certified/i);
  assert.doesNotMatch(x.en.markdown,/buy now|guaranteed gain|USD strengthened/);
  assert.equal(x.en.public_release_authorized,false);
  assert.equal(x.es.public_release_authorized,false);
});

test('source-less day is a dated no-observation educational note, not invented news', () => {
  const x = buildTreasuryCandidate({xml:xmlRows([{day:'2026-11-02',two:'4.0',ten:'4.3'}]),
    day:DAY,asOfUtc:AS_OF});
  assert.equal(x.record.status,'NO_MATCHING_OBSERVATION_DRAFT');
  assert.equal(x.record.facts.length,0);
  assert.deepEqual(x.en.canonical_values,[]);
  assert.match(x.en.markdown,/no observation for this date/);
  assert.match(x.es.markdown,/no contenía una observación/);
  assert.doesNotMatch(x.en.markdown,/There were no market events/);
});

test('duplicate observation date blocks claims even if candidate date differs', () => {
  assert.throws(()=>readTreasuryObservation(xmlRows([
    {day:'2026-11-02',two:'4.0',ten:'4.1'},
    {day:'2026-11-02',two:'4.0',ten:'4.1'}]),DAY),/duplicate Treasury observation/);
});

test('missing, blank, null, nonnumeric and outlier tenors never become zeros', () => {
  for (const [two,ten] of [[null,'4.5'],['4.1',null],['','4.5'],['NaN','4.5'],
    ['4.1','unknown'],['4.1','99.99']]) {
    assert.throws(()=>readTreasuryObservation(xmlRows([{day:DAY,two,ten}]),DAY),
      /missing|numeric|outside/);
  }
});

test('unsafe XML constructions and non-feed HTML are rejected', () => {
  assert.throws(()=>readTreasuryObservation('<html>Not an issuer feed</html>',DAY),/not an Atom/);
  assert.throws(()=>readTreasuryObservation('<!DOCTYPE feed [<!ENTITY x SYSTEM "file:///etc/passwd">]>' +
    xmlRows(),DAY),/unsupported active/);
  assert.throws(()=>readTreasuryObservation(xmlRows().replace('<feed ', '<feed><script>alert(1)</script> '),DAY),
    /unsupported active/);
});

test('odd cardinality, invalid date fields and huge responses fail closed', () => {
  const bad = xmlRows().replace('2026-11-03T00:00:00','2026-11-32T00:00:00');
  assert.throws(()=>readTreasuryObservation(bad,DAY),/bad or missing/);
  const huge = xmlRows() + ' '.repeat(500_000);
  assert.throws(()=>readTreasuryObservation(huge,DAY),/exceeds bounded/);
  const excess = xmlRows(Array.from({length:46},(_,i)=>({day:'2026-11-' +
    String(i%30+1).padStart(2,'0'),two:'4.0',ten:'4.5'})));
  assert.throws(()=>readTreasuryObservation(excess,DAY),/large Treasury month/);
});

test('injected issuer fetch verifies exact URL, status, content type and no redirect', async () => {
  const calls=[];
  const x=await fetchTreasuryCandidate({day:DAY,asOfUtc:AS_OF,fetchImpl:async(url,options)=>{
    calls.push({url,options});return response();
  }});
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,URL);
  assert.equal(calls[0].options.method,'GET');
  assert.equal(calls[0].options.redirect,'error');
  assert.equal(calls[0].options.credentials,'omit');
  assert.equal(x.record.source.transport,'EXACT_ISSUER_RESPONSE');
  assert.equal(x.record.public_release_authorized,false);
});

test('issuer fetch rejects wrong URL, redirect, HTTP status and HTML', async () => {
  const bad = [
    {url:'https://fred.stlouisfed.org/graph.csv'},
    {redirected:true},
    {ok:false,status:403},
    {headers:{'content-type':'text/html'}},
    {headers:{'content-length':'900001'}},
  ];
  for(const changes of bad) {
    await assert.rejects(()=>fetchTreasuryCandidate({
      day:DAY,asOfUtc:AS_OF,fetchImpl:async()=>response(xmlRows(),changes)
    }), /issuer|redirect|HTTP|content type|length/);
  }
});

test('issuer fetch refuses implicit network permissions', async () => {
  await assert.rejects(()=>fetchTreasuryCandidate({day:DAY,asOfUtc:AS_OF}),/explicit issuer fetch/);
});

test('parser does not bless real provider claims merely because request was mocked', async () => {
  const x=await fetchTreasuryCandidate({day:DAY,asOfUtc:AS_OF,fetchImpl:async()=>response()});
  assert.equal(x.record.source.source_rights_status,'SEPARATE_LEGAL_EDITORIAL_REVIEW_REQUIRED');
  assert.equal(x.record.publisher_release_verification_pending,true);
  assert.equal(x.record.human_editorial_review_required,true);
  assert.equal(x.record.permitted_claim_class,'DATED_ISSUER_OBSERVATIONS_AND_ARITHMETIC_ONLY');
  assert.equal(x.record.interpretation_level,'NO_CAUSAL_INFERENCE');
  assert.equal(x.record.existing_news_workflow_untouched,true);
});

test('cannot render as an approved public article or in an unapproved language', () => {
  const x=buildTreasuryCandidate({xml:xmlRows(),day:DAY,asOfUtc:AS_OF});
  assert.throws(()=>renderTreasuryCandidate({...x.record,public_release_authorized:true},'en'),
    /only non-public/);
  assert.throws(()=>renderTreasuryCandidate(x.record,'pt'),/unapproved candidate/);
});
