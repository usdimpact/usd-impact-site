import assert from 'node:assert/strict';
import { normalizeCalendarCandidate } from '../src/lib/publication-calendar.js';
import { publicationEventDescriptor } from '../src/lib/publication-event-registry.js';
import {
  TREASURY_BUYBACK_DISCOVERY_MAX_AGE_MS,
  TREASURY_BUYBACK_DISCOVERY_MAX_BYTES,
  TREASURY_BUYBACK_DISCOVERY_VERSION,
  TREASURY_BUYBACK_LISTING_URL,
  discoverTreasuryBuybackPreliminaryUrl,
} from '../src/lib/treasury-buyback-discovery.js';

let groups = 0;
const pass = () => { groups += 1; };
const operationDate = '2026-09-10';
const stamp = '20260910174000';
const preliminaryUrl = `https://www.treasurydirect.gov/instit/annceresult/press/preanre/2026/BBPA_${stamp}.xml`;
const row = ({ date = '09/10/2026', href = `/instit/annceresult/press/preanre/2026/BBPA_${stamp}.xml`, extra = '' } = {}) => `
<tr>
<td>${date}</td><td>01:40 PM</td><td>02:00 PM</td><td>09/11/2026</td>
<td>Liquidity Support</td><td>Nominal Coupons</td><td>10Y to 20Y</td>
<td><a href="/instit/annceresult/press/preanre/2026/BBPA_${stamp}.pdf">PDF</a><a href="${href}">XML</a>${extra}</td>
<td><a href="/instit/annceresult/press/preanre/2026/BBA_${stamp}.xml">XML</a></td>
</tr>`;
const html = (rows = row(), { tableId = 'buybackTable', tbody = true, duplicateTable = false } = {}) => {
  const body = tbody ? `<tbody>${rows}</tbody>` : rows;
  const table = `<table class="display" id="${tableId}"><thead><tr><th>Operation Date</th></tr></thead>${body}</table>`;
  return `<!doctype html><html><body><main><h1>Buyback Announcements & Results Press Releases</h1>${table}${duplicateTable ? table : ''}</main></body></html>`;
};
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
const NOW = '2026-09-09T15:05:00Z';

assert.equal(TREASURY_BUYBACK_DISCOVERY_VERSION, 'treasury-buyback-discovery/treasurydirect-html-v1');
assert.equal(TREASURY_BUYBACK_DISCOVERY_MAX_AGE_MS, 15 * 60 * 1000);
assert.equal(TREASURY_BUYBACK_DISCOVERY_MAX_BYTES, 2_097_152);
pass();

{
  const { fetchImpl, calls } = fetchFor(html());
  const result = await discoverTreasuryBuybackPreliminaryUrl({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl });
  assert.equal(result.decision, 'PASS');
  assert.equal(result.preliminaryUrl, preliminaryUrl);
  assert.equal(result.operationStamp, stamp);
  assert.equal(result.discoveryVerified, true);
  assert.equal(result.calendarLease, false);
  assert.equal(result.publicationAuthorized, false);
  assert.equal(result.enforcementActive, false);
  assert.equal(result.publicationAttempted, false);
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
  const absolute = row({ href: preliminaryUrl });
  const { fetchImpl } = fetchFor(html(absolute));
  assert.equal((await discoverTreasuryBuybackPreliminaryUrl({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'PASS');
  pass();
}

for (const bad of [
  null,
  {},
  { publisher: 'BLS', series: 'BUYBACK', operationDate },
  { publisher: 'TREASURY', series: 'CPI', operationDate },
  { publisher: 'TREASURY', series: 'BUYBACK', operationDate: '2026-02-30' },
  { publisher: 'TREASURY', series: 'BUYBACK', operationDate, extra: true },
]) {
  let called = false;
  const result = await discoverTreasuryBuybackPreliminaryUrl(bad, { now: constantNow(NOW), fetchImpl: async () => { called = true; } });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_DISCOVERY_CANDIDATE');
  assert.equal(called, false);
}
pass();

{
  const { fetchImpl } = fetchFor(html(), { status: 503 });
  assert.equal((await discoverTreasuryBuybackPreliminaryUrl({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_DISCOVERY_SOURCE_UNAVAILABLE');
  pass();
}
{
  const { fetchImpl } = fetchFor(html(), { url: 'https://www.treasurydirect.gov/other' });
  assert.equal((await discoverTreasuryBuybackPreliminaryUrl({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_DISCOVERY_SOURCE_REDIRECT');
  pass();
}
{
  const { fetchImpl } = fetchFor(html(), { type: 'application/json' });
  assert.equal((await discoverTreasuryBuybackPreliminaryUrl({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_DISCOVERY_SOURCE_TYPE');
  pass();
}
{
  const { fetchImpl } = fetchFor(html(), { length: TREASURY_BUYBACK_DISCOVERY_MAX_BYTES + 1 });
  assert.equal((await discoverTreasuryBuybackPreliminaryUrl({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_DISCOVERY_SOURCE_TOO_LARGE');
  pass();
}
{
  const fetchImpl = async () => { throw new Error('offline'); };
  assert.equal((await discoverTreasuryBuybackPreliminaryUrl({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_DISCOVERY_SOURCE_UNAVAILABLE');
  pass();
}

{
  const { fetchImpl } = fetchFor(html(row(), { tableId: 'otherTable' }));
  assert.equal((await discoverTreasuryBuybackPreliminaryUrl({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_DISCOVERY_SCHEMA');
  pass();
}
{
  const { fetchImpl } = fetchFor(html(row(), { duplicateTable: true }));
  assert.equal((await discoverTreasuryBuybackPreliminaryUrl({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_DISCOVERY_SCHEMA');
  pass();
}
{
  const { fetchImpl } = fetchFor(html(row(), { tbody: false }));
  assert.equal((await discoverTreasuryBuybackPreliminaryUrl({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_DISCOVERY_SCHEMA');
  pass();
}
{
  const { fetchImpl } = fetchFor(html(row({ date: '09/09/2026' })));
  assert.equal((await discoverTreasuryBuybackPreliminaryUrl({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_DISCOVERY_NOT_FOUND');
  pass();
}
{
  const { fetchImpl } = fetchFor(html(`${row()}${row()}`));
  assert.equal((await discoverTreasuryBuybackPreliminaryUrl({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_DISCOVERY_AMBIGUOUS');
  pass();
}
{
  const extra = `<a href="/instit/annceresult/press/preanre/2026/BBPA_20260910184500.xml">XML duplicate</a>`;
  const { fetchImpl } = fetchFor(html(row({ extra })));
  assert.equal((await discoverTreasuryBuybackPreliminaryUrl({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_DISCOVERY_AMBIGUOUS');
  pass();
}
{
  const wrongStamp = '/instit/annceresult/press/preanre/2026/BBPA_20260911174000.xml';
  const { fetchImpl } = fetchFor(html(row({ href: wrongStamp })));
  assert.equal((await discoverTreasuryBuybackPreliminaryUrl({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_DISCOVERY_IDENTITY');
  pass();
}
{
  const external = `https://evil.example/instit/annceresult/press/preanre/2026/BBPA_${stamp}.xml`;
  const { fetchImpl } = fetchFor(html(row({ href: external })));
  assert.equal((await discoverTreasuryBuybackPreliminaryUrl({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_DISCOVERY_AMBIGUOUS');
  pass();
}
{
  const query = `/instit/annceresult/press/preanre/2026/BBPA_${stamp}.xml?download=1`;
  const { fetchImpl } = fetchFor(html(row({ href: query })));
  assert.equal((await discoverTreasuryBuybackPreliminaryUrl({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now: constantNow(NOW), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_DISCOVERY_AMBIGUOUS');
  pass();
}

{
  const t0 = Date.parse(NOW);
  const times = [t0, t0, t0 + TREASURY_BUYBACK_DISCOVERY_MAX_AGE_MS];
  const now = () => times.length > 1 ? times.shift() : times[0];
  const { fetchImpl } = fetchFor(html());
  assert.equal((await discoverTreasuryBuybackPreliminaryUrl({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now, fetchImpl })).decision, 'HOLD_EVIDENCE_STALE');
  pass();
}
{
  const t0 = Date.parse(NOW);
  const times = [t0, t0 - 1];
  const now = () => times.length > 1 ? times.shift() : times[0];
  const { fetchImpl } = fetchFor(html());
  assert.equal((await discoverTreasuryBuybackPreliminaryUrl({ publisher: 'TREASURY', series: 'BUYBACK', operationDate }, { now, fetchImpl })).decision, 'HOLD_INVALID_CLOCK');
  pass();
}

assert.equal(publicationEventDescriptor('TREASURY', 'BUYBACK')?.verification.enabled, false);
assert.throws(
  () => normalizeCalendarCandidate({
    publisher: 'TREASURY', series: 'BUYBACK', referencePeriod: '2026-09', releaseStage: 'initial',
    eventDate: operationDate, releaseTime: '14:00', timeZone: 'America/New_York',
    releaseAt: '2026-09-10T18:00:00Z', phase: 'preview', statusLabel: 'scheduled-confirmed',
  }),
  (error) => error?.code === 'HOLD_UNSUPPORTED_EVENT',
  'discovery evidence must not activate Treasury in the canonical publication calendar',
);
pass();

console.log(`Treasury buyback dormant discovery adapter v1: ${groups} regression groups passed (captured-shape/synthetic first-party listing fixtures; no live publication authorization).`);
