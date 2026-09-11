import assert from 'node:assert/strict';
import { normalizeCalendarCandidate } from '../src/lib/publication-calendar.js';
import { publicationEventDescriptor } from '../src/lib/publication-event-registry.js';
import {
  TREASURY_BUYBACK_DISCOVERY_MAX_AGE_MS,
  TREASURY_BUYBACK_DISCOVERY_MAX_BYTES,
  TREASURY_BUYBACK_LISTING_URL,
} from '../src/lib/treasury-buyback-discovery.js';
import {
  TREASURY_BUYBACK_OUTCOME_DISCOVERY_VERSION,
  discoverTreasuryBuybackOutcomeUrls,
} from '../src/lib/treasury-buyback-outcome-discovery.js';

let groups = 0;
const pass = () => { groups += 1; };
const operationDate = '2026-09-10';
const stamp = '20260910174000';
const basePath = '/instit/annceresult/press/preanre/2026';
const urls = Object.freeze({
  preliminary: `https://www.treasurydirect.gov${basePath}/BBPA_${stamp}.xml`,
  final: `https://www.treasurydirect.gov${basePath}/BBA_${stamp}.xml`,
  results: `https://www.treasurydirect.gov${basePath}/BBR_${stamp}.xml`,
});

function stageCell(prefix, href, extra = '') {
  return `<td><a href="${basePath}/${prefix}_${stamp}.pdf">PDF</a><a href="${href}">XML</a>${extra}</td>`;
}

function row({
  date = '09/10/2026',
  preliminaryHref = `${basePath}/BBPA_${stamp}.xml`,
  finalHref = `${basePath}/BBA_${stamp}.xml`,
  resultsHref = `${basePath}/BBR_${stamp}.xml`,
  preliminaryExtra = '',
  finalExtra = '',
  resultsExtra = '',
} = {}) {
  return `<tr>
<td>${date}</td><td>01:40 PM</td><td>02:00 PM</td><td>09/11/2026</td>
<td>Liquidity Support</td><td>Nominal Coupons</td><td>10Y to 20Y</td>
${stageCell('BBPA', preliminaryHref, preliminaryExtra)}
${stageCell('BBA', finalHref, finalExtra)}
${stageCell('BBR', resultsHref, resultsExtra)}
<td></td></tr>`;
}

function html(rows = row(), { tableId = 'buybackTable', tbody = true, duplicateTable = false } = {}) {
  const body = tbody ? `<tbody>${rows}</tbody>` : rows;
  const table = `<table class="display" id="${tableId}"><thead><tr><th>Operation Date</th></tr></thead>${body}</table>`;
  return `<!doctype html><html><body><main><h1>Buyback Announcements & Results Press Releases</h1>${table}${duplicateTable ? table : ''}</main></body></html>`;
}

function response(body, { status = 200, url = TREASURY_BUYBACK_LISTING_URL, type = 'text/html', length } = {}) {
  const headers = new Map();
  if (type !== null) headers.set('content-type', type);
  if (length !== undefined) headers.set('content-length', String(length));
  return { status, url, headers: { get: (name) => headers.get(String(name).toLowerCase()) ?? null }, text: async () => body };
}

function fetchFor(body, options = {}) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, init) => { calls.push({ url: String(url), init }); return response(body, options); },
  };
}

const constantNow = (iso) => () => Date.parse(iso);
const NOW = '2026-09-10T18:05:00Z';

assert.equal(TREASURY_BUYBACK_OUTCOME_DISCOVERY_VERSION, 'treasury-buyback-outcome-discovery/treasurydirect-html-v1');
pass();

{
  const { fetchImpl, calls } = fetchFor(html());
  const result = await discoverTreasuryBuybackOutcomeUrls({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl });
  assert.equal(result.decision, 'PASS');
  assert.equal(result.operationStamp, stamp);
  assert.equal(result.preliminaryUrl, urls.preliminary);
  assert.equal(result.finalUrl, urls.final);
  assert.equal(result.resultsUrl, urls.results);
  assert.equal(result.discoveryVerified, true);
  assert.equal(result.resultsLinkObserved, true);
  assert.equal(result.calendarLease, false);
  assert.equal(result.publicationAttempted, false);
  assert.equal(result.publicationAuthorized, false);
  assert.equal(result.enforcementActive, false);
  assert.equal(result.source.url, TREASURY_BUYBACK_LISTING_URL);
  assert.match(result.source.sha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(result).includes('<table'), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, TREASURY_BUYBACK_LISTING_URL);
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.cache, 'no-store');
  pass();
}

{
  const { fetchImpl } = fetchFor(html(row({
    preliminaryHref: urls.preliminary,
    finalHref: urls.final,
    resultsHref: urls.results,
  })));
  assert.equal((await discoverTreasuryBuybackOutcomeUrls({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'PASS');
  pass();
}

for (const bad of [
  null,
  {},
  { publisher: 'BLS', series: 'BUYBACK', operationDate },
  { publisher: 'TREASURY', series: 'CPI', operationDate },
  { publisher: 'TREASURY', series: 'BUYBACK', operationDate: '2026-02-30' },
  { publisher: 'TREASURY', series: 'BUYBACK', operationDate, resultsUrl: urls.results },
]) {
  let called = false;
  const result = await discoverTreasuryBuybackOutcomeUrls(bad, { now: constantNow(NOW), fetchImpl: async () => { called = true; } });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_CANDIDATE');
  assert.equal(called, false);
}
pass();

for (const [options, decision] of [
  [{ status: 503 }, 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SOURCE_UNAVAILABLE'],
  [{ url: 'https://www.treasurydirect.gov/other' }, 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SOURCE_REDIRECT'],
  [{ type: 'application/json' }, 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SOURCE_TYPE'],
  [{ length: TREASURY_BUYBACK_DISCOVERY_MAX_BYTES + 1 }, 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SOURCE_TOO_LARGE'],
]) {
  const { fetchImpl } = fetchFor(html(), options);
  assert.equal((await discoverTreasuryBuybackOutcomeUrls({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, decision);
}
pass();

{
  const result = await discoverTreasuryBuybackOutcomeUrls({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, {
    now: constantNow(NOW), fetchImpl: async () => { throw new Error('offline'); },
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SOURCE_UNAVAILABLE');
  pass();
}

for (const [body, decision] of [
  [html(row(), { tableId: 'otherTable' }), 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SCHEMA'],
  [html(row(), { duplicateTable: true }), 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SCHEMA'],
  [html(row(), { tbody: false }), 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SCHEMA'],
  [html(row({ date: '09/09/2026' })), 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_NOT_FOUND'],
  [html(`${row()}${row()}`), 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_AMBIGUOUS'],
]) {
  const { fetchImpl } = fetchFor(body);
  assert.equal((await discoverTreasuryBuybackOutcomeUrls({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, decision);
}
pass();

{
  const { fetchImpl } = fetchFor(html(row({ resultsHref: '' })));
  assert.equal((await discoverTreasuryBuybackOutcomeUrls({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_INCOMPLETE');
  pass();
}

{
  const duplicate = `<a href="${basePath}/BBR_${stamp}.xml">XML duplicate</a>`;
  const { fetchImpl } = fetchFor(html(row({ resultsExtra: duplicate })));
  assert.equal((await discoverTreasuryBuybackOutcomeUrls({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_AMBIGUOUS');
  pass();
}

{
  const { fetchImpl } = fetchFor(html(row({ finalHref: `${basePath}/BBR_${stamp}.xml` })));
  assert.equal((await discoverTreasuryBuybackOutcomeUrls({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_AMBIGUOUS');
  pass();
}

{
  const otherStamp = '20260910184500';
  const { fetchImpl } = fetchFor(html(row({ resultsHref: `${basePath}/BBR_${otherStamp}.xml` })));
  assert.equal((await discoverTreasuryBuybackOutcomeUrls({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_IDENTITY');
  pass();
}

{
  const wrongDateStamp = '20260911174000';
  const { fetchImpl } = fetchFor(html(row({
    preliminaryHref: `${basePath}/BBPA_${wrongDateStamp}.xml`,
    finalHref: `${basePath}/BBA_${wrongDateStamp}.xml`,
    resultsHref: `${basePath}/BBR_${wrongDateStamp}.xml`,
  })));
  assert.equal((await discoverTreasuryBuybackOutcomeUrls({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_IDENTITY');
  pass();
}

for (const href of [
  `https://evil.example${basePath}/BBR_${stamp}.xml`,
  `${basePath}/BBR_${stamp}.xml?download=1`,
]) {
  const { fetchImpl } = fetchFor(html(row({ resultsHref: href })));
  assert.equal((await discoverTreasuryBuybackOutcomeUrls({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_INCOMPLETE');
}
pass();

{
  const t0 = Date.parse(NOW);
  const times = [t0, t0, t0 + TREASURY_BUYBACK_DISCOVERY_MAX_AGE_MS];
  const now = () => times.length > 1 ? times.shift() : times[0];
  const { fetchImpl } = fetchFor(html());
  assert.equal((await discoverTreasuryBuybackOutcomeUrls({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now, fetchImpl })).decision, 'HOLD_EVIDENCE_STALE');
  pass();
}

{
  const t0 = Date.parse(NOW);
  const times = [t0, t0 - 1];
  const now = () => times.length > 1 ? times.shift() : times[0];
  const { fetchImpl } = fetchFor(html());
  assert.equal((await discoverTreasuryBuybackOutcomeUrls({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now, fetchImpl })).decision, 'HOLD_INVALID_CLOCK');
  pass();
}

assert.equal(publicationEventDescriptor('TREASURY', 'BUYBACK')?.verification.enabled, false);
assert.throws(
  () => normalizeCalendarCandidate({
    publisher: 'TREASURY', series: 'BUYBACK', referencePeriod: '2026-09', releaseStage: 'initial',
    eventDate: operationDate, releaseTime: '14:00', timeZone: 'America/New_York',
    releaseAt: '2026-09-10T18:00:00Z', phase: 'outcome', statusLabel: 'released-confirmed',
  }),
  (error) => error?.code === 'HOLD_UNSUPPORTED_EVENT',
  'outcome discovery evidence must not activate Treasury in the canonical publication calendar',
);
pass();

console.log(`Treasury buyback dormant outcome discovery v1: ${groups} regression groups passed (captured-shape/synthetic first-party listing fixtures; no live publication authorization).`);
