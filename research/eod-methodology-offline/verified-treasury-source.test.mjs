import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildTreasuryCandidate, fetchTreasuryCandidate, readTreasuryObservation,
  renderTreasuryCandidate, treasuryMonthlyUrl, validateTreasuryClock, redactedIssuerProbeReceipt, planTreasuryProbeArgs,
} from './verified-treasury-source.mjs';

const DAY = '2026-11-03';
const AS_OF = '2026-11-03T23:37:00Z';
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

test('Treasury-specific 18:30 New York availability buffer is mandatory, including DST', () => {
  assert.equal(validateTreasuryClock(DAY, AS_OF), new Date(AS_OF).toISOString());
  assert.throws(() => validateTreasuryClock(DAY, '2026-11-03T23:29:00Z'), /before 18:30/);
  assert.throws(() => validateTreasuryClock('2026-07-02', '2026-07-02T22:29:00Z'), /before 18:30/);
  assert.equal(validateTreasuryClock('2026-07-02', '2026-07-02T22:30:00Z'),
    '2026-07-02T22:30:00.000Z');
  assert.throws(() => validateTreasuryClock(DAY, '2026-11-03T22:37:00Z'), /before 18:30/);
  assert.equal(validateTreasuryClock(DAY, '2026-11-03T23:30:00Z'), '2026-11-03T23:30:00.000Z');
  assert.throws(() => validateTreasuryClock(DAY, '2026-11-04T05:15:00Z'), /retrospective review/);
  assert.throws(() => validateTreasuryClock('2026-11-07', '2026-11-07T22:37:00Z'), /weekend/);
});

test('delayed-source review must be explicitly requested; same-day buffer cannot be bypassed', () => {
  const later='2026-11-04T12:00:00Z';
  assert.throws(()=>validateTreasuryClock(DAY,later),/retrospective review/);
  assert.equal(validateTreasuryClock(DAY,later,{allowRetrospective:true}),
    '2026-11-04T12:00:00.000Z');
  assert.throws(()=>validateTreasuryClock(DAY,'2026-11-03T23:29:00Z',
    {allowRetrospective:true}),/before 18:30/);
  assert.throws(()=>validateTreasuryClock(DAY,later,
    {allowRetrospective:'true'}),/boolean/);
});

test('retrospective source review is bounded by 14 days and never pre-dated', () => {
  assert.equal(validateTreasuryClock(DAY,'2026-11-17T12:00:00Z',
    {allowRetrospective:true}),'2026-11-17T12:00:00.000Z');
  assert.throws(()=>validateTreasuryClock(DAY,'2026-11-18T12:00:00Z',
    {allowRetrospective:true}),/within 14/);
  assert.throws(()=>validateTreasuryClock(DAY,'2026-11-02T23:59:00Z',
    {allowRetrospective:true}),/within 14/);
});

test('post-trading-day weekend inspection is allowed only for a weekday observation', () => {
  const capture='2026-11-07T15:00:00Z'; // Saturday in New York
  assert.equal(validateTreasuryClock('2026-11-06',capture,
    {allowRetrospective:true}),'2026-11-07T15:00:00.000Z');
  assert.throws(()=>validateTreasuryClock('2026-11-07',capture,
    {allowRetrospective:true}),/weekend observation/);
});

test('English and Spanish late review drafts explicitly separate observation and later capture', () => {
  const x=buildTreasuryCandidate({
    xml:xmlRows(),day:DAY,asOfUtc:'2026-11-04T12:00:00Z',allowRetrospective:true
  });
  assert.equal(x.record.source.capture_context.capture_mode,'EXPLICIT_RETROSPECTIVE');
  assert.equal(x.record.source.capture_context.capture_lag_calendar_days,1);
  assert.equal(x.record.source.capture_context.first_issuer_publication_time_verified,false);
  assert.match(x.en.markdown,/Retrospective review: captured after/);
  assert.match(x.es.markdown,/Revisión retrospectiva/);
  assert.deepEqual(x.en.canonical_values,x.es.canonical_values);
  assert.equal(x.record.public_release_authorized,false);
});

test('one explicitly late issuer fetch keeps private metadata and original dated observation', async () => {
  const x=await fetchTreasuryCandidate({day:DAY,allowRetrospective:true,
    clock:()=>new Date('2026-11-04T12:00:00Z'),fetchImpl:async()=>response()});
  const receipt=redactedIssuerProbeReceipt(x);
  assert.equal(receipt.capture_context.capture_mode,'EXPLICIT_RETROSPECTIVE');
  assert.equal(receipt.capture_context.capture_lag_calendar_days,1);
  assert.equal(receipt.observation_date,DAY);
  assert.equal(receipt.original_publisher_release_time_verified,false);
  assert.doesNotMatch(JSON.stringify(receipt),/4\.12|4\.65|0\.53|markdown/);
});

test('forged dates or retrospective privilege cannot be rendered as valid source facts', () => {
  const x=buildTreasuryCandidate({
    xml:xmlRows(),day:DAY,asOfUtc:'2026-11-04T12:00:00Z',allowRetrospective:true
  });
  assert.throws(()=>renderTreasuryCandidate({
    ...x.record,source:{...x.record.source,capture_context:{
      ...x.record.source.capture_context,capture_lag_calendar_days:0
    }}
  },'en'),/capture date relation/);
  assert.throws(()=>renderTreasuryCandidate({
    ...x.record,source:{...x.record.source,capture_context:{
      ...x.record.source.capture_context,capture_mode:'SAME_DAY_AFTER_1830_ET'
    }}
  },'es'),/retrospective review/);
});

test('the parser extracts dated issuer-shaped 2Y/10Y observations, not unrequested series', () => {
  const x = readTreasuryObservation(xmlRows(), DAY);
  assert.deepEqual(x, {observation_date:DAY,bc_2year_percent:4.12,bc_10year_percent:4.65});
  const y = readTreasuryObservation(xmlRows([{day:'2026-11-02',two:'3.8',ten:'4.1'},
    {day:DAY,two:'4.12',ten:'4.65'}]), DAY);
  assert.deepEqual(y,x);
});

test('OData observation date rejects corrupted timestamp suffixes and times', () => {
  for (const malformed of [
    '2026-11-03Tgarbage',
    '2026-11-03T25:00:00',
    '2026-11-03T00:79:00',
    '2026-11-03T00:00:61',
    '2026-11-03T00:00:00EVIL',
  ]) {
    const xml = xmlRows().replace('2026-11-03T00:00:00', malformed);
    assert.throws(()=>readTreasuryObservation(xml,DAY),/bad or missing Treasury observation date/);
  }
  assert.equal(readTreasuryObservation(xmlRows().replace('2026-11-03T00:00:00',
    '2026-11-03T00:00:00.000'),DAY).observation_date,DAY);
});

test('Treasury 2022 omitted-null-field convention never creates a zero rate', () => {
  const base=xmlRows();
  const missingTwo=base.replace(/<d:BC_2YEAR[^>]*>[^<]*<\/d:BC_2YEAR>/, '');
  const missingTen=base.replace(/<d:BC_10YEAR[^>]*>[^<]*<\/d:BC_10YEAR>/, '');
  assert.notEqual(missingTwo,base);
  assert.notEqual(missingTen,base);
  assert.throws(()=>readTreasuryObservation(missingTwo,DAY),/BC_2YEAR missing/);
  assert.throws(()=>readTreasuryObservation(missingTen,DAY),/BC_10YEAR missing/);
});

test('Treasury added optional curve tenor fields do not change the two-factor source note', () => {
  const expanded=xmlRows().replace('</m:properties>',
    '<d:BC_1_5MONTH m:type="Edm.Double">3.22</d:BC_1_5MONTH></m:properties>');
  const a=readTreasuryObservation(xmlRows(),DAY);
  const b=readTreasuryObservation(expanded,DAY);
  assert.deepEqual(b,a);
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
  assert.throws(()=>readTreasuryObservation('<html>Not an issuer feed</html>',DAY),/not a complete Atom/);
  assert.throws(()=>readTreasuryObservation('<!DOCTYPE feed [<!ENTITY x SYSTEM "file:///etc/passwd">]>' +
    xmlRows(),DAY),/unsupported active/);
  assert.throws(()=>readTreasuryObservation(xmlRows().replace('<feed ', '<feed><script>alert(1)</script> '),DAY),
    /unsupported active/);
});

test('entry appended outside the signed feed root is never interpreted as a valid row', () => {
  const forged = xmlRows([{day:'2026-11-02',two:'3.8',ten:'4.1'}]) +
    '<entry><d:NEW_DATE>2026-11-03T00:00:00</d:NEW_DATE>' +
    '<d:BC_2YEAR>4.12</d:BC_2YEAR><d:BC_10YEAR>4.65</d:BC_10YEAR></entry>';
  assert.throws(()=>readTreasuryObservation(forged,DAY),/complete Atom-style/);
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
  const x=await fetchTreasuryCandidate({day:DAY,clock:()=>new Date(AS_OF),fetchImpl:async(url,options)=>{
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
      day:DAY,clock:()=>new Date(AS_OF),fetchImpl:async()=>response(xmlRows(),changes)
    }), /issuer|redirect|HTTP|content type|length/);
  }
});

test('issuer fetch refuses implicit network permissions', async () => {
  await assert.rejects(()=>fetchTreasuryCandidate({day:DAY,clock:()=>new Date(AS_OF)}),/explicit issuer fetch/);
});

test('parser does not bless real provider claims merely because request was mocked', async () => {
  const x=await fetchTreasuryCandidate({day:DAY,clock:()=>new Date(AS_OF),fetchImpl:async()=>response()});
  assert.equal(x.record.source.source_rights_status,'SEPARATE_LEGAL_EDITORIAL_REVIEW_REQUIRED');
  assert.equal(x.record.publisher_release_verification_pending,true);
  assert.equal(x.record.human_editorial_review_required,true);
  assert.equal(x.record.permitted_claim_class,'DATED_ISSUER_OBSERVATIONS_AND_ARITHMETIC_ONLY');
  assert.equal(x.record.interpretation_level,'NO_CAUSAL_INFERENCE');
  assert.equal(x.record.existing_news_workflow_untouched,true);
});

test('response capture time is stamped after the source bytes were read', async () => {
  let calls = 0;
  const clock = () => new Date(++calls === 1 ? AS_OF : '2026-11-03T23:43:00Z');
  const x = await fetchTreasuryCandidate({day:DAY,clock,fetchImpl:async()=>response()});
  assert.equal(calls, 2);
  assert.equal(x.record.captured_as_of_utc, '2026-11-03T23:43:00.000Z');
});

test('source completed after New York midnight cannot be backdated', async () => {
  let calls = 0;
  const clock = () => new Date(++calls === 1 ? AS_OF : '2026-11-04T05:15:00Z');
  await assert.rejects(()=>fetchTreasuryCandidate({
    day:DAY,clock,fetchImpl:async()=>response()
  }), /retrospective review/);
});

test('streaming source length is bounded before buffering any oversized response', async () => {
  let sent = false;
  const stream = {getReader:()=>({read:async()=> {
    if(sent) return {done:true};
    sent = true; return {done:false,value:new Uint8Array(500001)};
  }})};
  await assert.rejects(()=>fetchTreasuryCandidate({
    day:DAY,clock:()=>new Date(AS_OF),
    fetchImpl:async()=>response(xmlRows(),{body:stream})
  }),/stream exceeds bounded/);
});

test('fixture inputs cannot forge exact official-issuer transport status', () => {
  const x = buildTreasuryCandidate({
    xml:xmlRows(),day:DAY,asOfUtc:AS_OF,transport:'EXACT_ISSUER_RESPONSE'
  });
  assert.equal(x.record.source.transport,'UNVERIFIED_FIXTURE');
  assert.equal(x.record.source.public_redistribution_rights_granted,false);
});

test('month-filtered issuer feed rejects wrong-month rows even with a matching target day', () => {
  assert.throws(() => readTreasuryObservation(xmlRows([
    {day:'2026-10-30',two:'3.90',ten:'4.20'},
    {day:DAY,two:'4.12',ten:'4.65'}
  ]), DAY), /different month/);
});

test('yield values use percent while a rate difference uses percentage points', () => {
  const x = buildTreasuryCandidate({xml:xmlRows(),day:DAY,asOfUtc:AS_OF});
  assert.deepEqual(x.record.facts.map(f=>f.unit), ['percent','percent','percentage_point']);
  assert.deepEqual(x.en.canonical_values,x.es.canonical_values);
});

test('renderer fails closed when source IDs, calculated spread or rights are tampered', () => {
  const record = buildTreasuryCandidate({xml:xmlRows(),day:DAY,asOfUtc:AS_OF}).record;
  assert.throws(()=>renderTreasuryCandidate({
    ...record, facts:record.facts.map((f,i)=>i===2?{...f,value:9.99}:f)
  },'en'),/derived 10Y-minus-2Y/);
  assert.throws(()=>renderTreasuryCandidate({
    ...record, facts:record.facts.map((f,i)=>i===0?{...f,unit:'percentage_point'}:f)
  },'es'),/source facts, date or units/);
  assert.throws(()=>renderTreasuryCandidate({
    ...record, source:{...record.source,public_redistribution_rights_granted:true}
  },'en'),/candidate status, rights/);
  assert.throws(()=>renderTreasuryCandidate({
    ...record, source:{...record.source,source_observation_date:'2026-11-02'}
  },'en'),/source facts, date or units/);
  assert.throws(()=>renderTreasuryCandidate({
    ...record,source:{...record.source,canonical_url:'https://other.example/test'}
  },'en'),/candidate status, rights/);
});

test('a fact-bearing candidate cannot silently become approved, released or source-verified', () => {
  const record=buildTreasuryCandidate({xml:xmlRows(),day:DAY,asOfUtc:AS_OF}).record;
  for(const status of ['APPROVED','PUBLISHED','NO_MATCHING_OBSERVATION_DRAFT']) {
    assert.throws(()=>renderTreasuryCandidate({...record,status},'en'),
      /not pending editorial review/);
  }
  for(const change of [
    {source:{...record.source,publisher_release_instant:'2026-11-03T21:00:00Z'}},
    {source:{...record.source,publisher_release_instant_verified:true}},
    {source:{...record.source,issuer_payload_origin_independently_attested:true}},
    {source:{...record.source,source_rights_status:'APPROVED'}},
    {source:{...record.source,origin_provenance_level:'ISSUER_VERIFIED'}},
    {source:{...record.source,documentation_url:'https://example.invalid'}},
    {publisher_release_verification_pending:false},
    {permitted_claim_class:'TRADE_RECOMMENDATION'},
    {interpretation_level:'PRICE_CAUSATION_PROVEN'},
    {live_issuer_fetch_does_not_grant_licence:false},
    {existing_news_workflow_untouched:false},
    {edition_key:'METHOD-TREASURY:2026-11-02'},
  ]) assert.throws(()=>renderTreasuryCandidate({...record,...change},'es'),
    /candidate status, rights or issuer provenance/);
});

test('a fetched response cannot be mistaken for independent publisher authentication', async () => {
  // In-process fetch mocks are permitted for tests, so response.url alone
  // must never be treated as a cryptographically attested publisher.
  const x=await fetchTreasuryCandidate({
    day:DAY,clock:()=>new Date(AS_OF),fetchImpl:async()=>response()
  });
  assert.equal(x.record.source.transport,'EXACT_ISSUER_RESPONSE');
  assert.equal(x.record.source.origin_provenance_level,
    'ASSERTED_EXACT_RESPONSE_URL_NOT_INDEPENDENTLY_ATTESTED');
  assert.equal(x.record.source.issuer_payload_origin_independently_attested,false);
  const receipt=redactedIssuerProbeReceipt(x);
  assert.equal(receipt.origin_provenance_level,x.record.source.origin_provenance_level);
  assert.equal(receipt.issuer_payload_origin_independently_attested,false);
  assert.equal(receipt.public_release_authorized,false);
  assert.doesNotMatch(JSON.stringify(receipt),/4\.12|4\.65|0\.53|markdown/);
});

test('a hand-supplied XML fixture is not promoted by caller-supplied transport metadata', () => {
  const fixture=buildTreasuryCandidate({
    xml:xmlRows(),day:DAY,asOfUtc:AS_OF,
    transport:'EXACT_ISSUER_RESPONSE',
    origin_provenance_level:'ISSUER_VERIFIED',
    public_release_authorized:true,
  });
  assert.equal(fixture.record.source.transport,'UNVERIFIED_FIXTURE');
  assert.equal(fixture.record.source.origin_provenance_level,'UNVERIFIED_FIXTURE');
  assert.equal(fixture.record.source.issuer_payload_origin_independently_attested,false);
  assert.throws(()=>redactedIssuerProbeReceipt(fixture),/rights-held exact-issuer/);
});

test('no-observation note cannot be relabeled as an approved observation', () => {
  const record = buildTreasuryCandidate({
    xml:xmlRows([{day:'2026-11-02',two:'4.00',ten:'4.20'}]),day:DAY,asOfUtc:AS_OF
  }).record;
  assert.equal(record.facts.length,0);
  assert.throws(()=>renderTreasuryCandidate({
    ...record,status:'AWAITING_EDITORIAL_REVIEW'
  },'en'),/no-observation status/);
});

test('optional real-issuer probe receipt never includes rates, translations or Score output', async () => {
  const result = await fetchTreasuryCandidate({
    day:DAY,clock:()=>new Date(AS_OF),fetchImpl:async()=>response()
  });
  const receipt = redactedIssuerProbeReceipt(result);
  assert.equal(receipt.scenario, 'PRIVATE_ISSUER_SCHEMA_RECEIPT_ONLY');
  assert.equal(receipt.issuer_raw_values_redacted, true);
  assert.equal(receipt.issuer_numerical_data_not_logged, true);
  assert.equal(receipt.public_release_authorized, false);
  assert.equal(receipt.rights_and_editorial_hold, true);
  assert.equal(receipt.parsed_field_count, 3);
  assert.deepEqual(receipt.parsed_field_ids, result.record.facts.map(f=>f.id));
  const rendered = JSON.stringify(receipt);
  assert.doesNotMatch(rendered, /4\.12|4\.65|0\.53|canonical_values|markdown|english|spanish|"value":/);
  assert.ok(!Object.hasOwn(receipt, 'record'));
  assert.ok(!Object.hasOwn(receipt, 'facts'));
});

test('private issuer receipt proves transport header types and presence, not first publication', async () => {
  const result = await fetchTreasuryCandidate({
    day:DAY, clock:()=>new Date(AS_OF), fetchImpl:async()=>response(xmlRows(),{
      headers:{
        'content-type':'application/atom+xml; charset=utf-8',
        'date':'Tue, 03 Nov 2026 23:37:00 GMT',
        'last-modified':'Tue, 03 Nov 2026 23:20:00 GMT',
        'etag':'"fictional-validator"',
      }
    })
  });
  const receipt = redactedIssuerProbeReceipt(result);
  assert.deepEqual(receipt.http_response_checks, {
    http_status:200,content_type:'application/atom+xml',
    http_date_header_present:true,last_modified_header_present:true,
    etag_header_present:true,original_first_publication_instant_verified:false
  });
  assert.doesNotMatch(JSON.stringify(receipt), /fictional-validator|Tue, 03 Nov|4\.12|4\.65|0\.53/);
  assert.equal(receipt.original_publisher_release_time_verified,false);
});

test('fixtures cannot forge a verified issuer HTTP header receipt', () => {
  const fixture = buildTreasuryCandidate({
    xml:xmlRows(),day:DAY,asOfUtc:AS_OF,
    httpChecks:{http_status:200,content_type:'application/xml'}
  });
  assert.equal(fixture.record.source.transport,'UNVERIFIED_FIXTURE');
  assert.equal(fixture.record.source.http_response_checks,null);
});

test('redacted receipt refuses fake transport and any claimed public rights', async () => {
  const invented = buildTreasuryCandidate({xml:xmlRows(),day:DAY,asOfUtc:AS_OF});
  assert.throws(()=>redactedIssuerProbeReceipt(invented), /rights-held exact-issuer/);
  const received = await fetchTreasuryCandidate({
    day:DAY,clock:()=>new Date(AS_OF),fetchImpl:async()=>response()
  });
  assert.throws(()=>redactedIssuerProbeReceipt({
    ...received,record:{...received.record,source:{
      ...received.record.source,public_redistribution_rights_granted:true
    }}
  }),/rights-held exact-issuer/);
});

test('pure Treasury CLI flag plan keeps demo and same-day live modes distinct', () => {
  assert.deepEqual(planTreasuryProbeArgs(['--demo']),
    {mode:'demo',day:null,allowRetrospective:false});
  assert.deepEqual(planTreasuryProbeArgs(['--live-official']),
    {mode:'live',day:null,allowRetrospective:false});
});

test('manual delayed-source probe is explicit, exactly one date and one request mode', () => {
  assert.deepEqual(planTreasuryProbeArgs([
    '--live-official','--probe-date=2026-10-30','--allow-retrospective'
  ]),{mode:'live',day:'2026-10-30',allowRetrospective:true});
  assert.throws(()=>validateTreasuryClock('2026-10-30','2026-11-14T15:00:00Z',
    {allowRetrospective:true}), /within 14/);
  assert.equal(validateTreasuryClock('2026-10-30','2026-11-07T15:00:00Z',
    {allowRetrospective:true}), '2026-11-07T15:00:00.000Z');
});

test('CLI plan rejects implicit network, bad arguments, duplicated flags, and date injection', () => {
  for (const args of [
    [], ['--allow-retrospective'],['--probe-date=2026-10-30'],
    ['--live-official','--probe-date=2026-10-30'],
    ['--live-official','--allow-retrospective'],
    ['--live-official','--probe-date=2026-10-30','--demo'],
    ['--demo','--probe-date=2026-10-30','--allow-retrospective'],
    ['--live-official','--probe-date=2026-10-30','--allow-retrospective','--demo'],
    ['--live-official','--live-official'],
    ['--live-official','--probe-date=2026-10-30?redirect=evil','--allow-retrospective'],
    ['--live-official','--probe-date=2026-02-30','--allow-retrospective'],
    ['--live-official','--probe-date=2026-10-30','--allow-retrospective','--allow-retrospective'],
  ]) assert.throws(()=>planTreasuryProbeArgs(args), /Use --demo|invalid explicit retrospective/);
});

test('CLI must route live output through nonnumeric redaction', () => {
  const source = readFileSync(new globalThis.URL('./treasury-candidate-cli.mjs', import.meta.url), 'utf8');
  assert.match(source, /:\s*redactedIssuerProbeReceipt\(result\)/);
  assert.match(source, /const plan = planTreasuryProbeArgs\(process\.argv\.slice\(2\)\)/);
  assert.match(source, /const report = plan\.mode === 'demo'/);
  assert.match(source, /allowRetrospective: plan\.allowRetrospective/);
});

test('real issuer Atom namespaces are required; similarly named foreign data fail closed', () => {
  const clean = xmlRows();
  assert.throws(()=>readTreasuryObservation(
    clean.replace('xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices"',
      'xmlns:d="https://untrusted.example/odata"'), DAY),
  /unexpected Treasury Atom or OData namespaces/);
  assert.throws(()=>readTreasuryObservation(
    clean.replace('xmlns="http://www.w3.org/2005/Atom"',
      'xmlns="https://untrusted.example/atom"'), DAY),
  /unexpected Treasury Atom or OData namespaces/);
  assert.throws(()=>readTreasuryObservation(
    clean.replace('<d:NEW_DATE ', '<x:NEW_DATE ').replace('</d:NEW_DATE>', '</x:NEW_DATE>'),
    DAY), /bad or missing Treasury observation date/);
});

test('Treasury source values must be inside one m:properties within application/xml content', () => {
  const clean = xmlRows();
  assert.throws(()=>readTreasuryObservation(
    clean.replace('<content type="application/xml">', '<content type="text/plain">'),
    DAY), /unexpected Treasury Atom entry content/);
  assert.throws(()=>readTreasuryObservation(
    clean.replace('</m:properties>', '</m:properties><m:properties><d:BC_2YEAR>9</d:BC_2YEAR></m:properties>'),
    DAY), /missing or duplicate Treasury OData properties/);
  assert.throws(()=>readTreasuryObservation(
    clean.replace('<d:BC_2YEAR', '</m:properties><d:BC_2YEAR'),
    DAY), /BC_2YEAR missing/);
});

test('a matching observation date outside issuer properties cannot fabricate a dated record', () => {
  const clean=xmlRows([{day:'2026-11-02',two:'4.01',ten:'4.21'}]);
  const changed=clean.replace('</content>', '</content><d:NEW_DATE>2026-11-03T00:00:00</d:NEW_DATE>');
  assert.equal(readTreasuryObservation(changed,DAY),null);
});

test('a truncated Atom entry cannot silently become a no-observation day', () => {
  const clean=xmlRows([{day:'2026-11-02',two:'4.01',ten:'4.21'}]);
  assert.throws(()=>readTreasuryObservation(clean.replace('</entry>', ''),
    DAY), /malformed or incomplete Treasury Atom entry/);
});

test('cannot render as an approved public article or in an unapproved language', () => {
  const x=buildTreasuryCandidate({xml:xmlRows(),day:DAY,asOfUtc:AS_OF});
  assert.throws(()=>renderTreasuryCandidate({...x.record,public_release_authorized:true},'en'),
    /only non-public/);
  assert.throws(()=>renderTreasuryCandidate(x.record,'pt'),/unapproved candidate/);
});
