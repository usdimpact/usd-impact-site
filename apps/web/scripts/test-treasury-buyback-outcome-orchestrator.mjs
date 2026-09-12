import assert from 'node:assert/strict';
import { normalizeCalendarCandidate } from '../src/lib/publication-calendar.js';
import { publicationEventDescriptor } from '../src/lib/publication-event-registry.js';
import {
  TREASURY_BUYBACK_OPERATION_FIELDS,
  TREASURY_BUYBACK_OPERATIONS_ENDPOINT,
} from '../src/lib/treasury-buyback-operation.js';
import { verifyDiscoveredTreasuryBuybackOutcome } from '../src/lib/treasury-buyback-outcome-orchestrator.js';

let groups = 0;
const pass = () => { groups += 1; };
const operationDate = '2026-08-18';
const stamp = '20260818174000';
const operationIdentity = `TREASURY:BUYBACK:${operationDate}:${stamp}:Liquidity Support:Nominal Coupons:20Y to 30Y`;
const treasuryBase = 'https://www.treasurydirect.gov/instit/annceresult/press/preanre/2026';
const preliminaryUrl = `${treasuryBase}/BBPA_${stamp}.xml`;
const finalUrl = `${treasuryBase}/BBA_${stamp}.xml`;
const resultsUrl = `${treasuryBase}/BBR_${stamp}.xml`;
const base = Object.freeze({
  publisher: 'TREASURY', series: 'BUYBACK', operationDate, operationIdentity, releaseStage: 'operation', phase: 'outcome',
});
const t0 = Date.parse('2026-08-18T18:05:00Z');
const clock = () => t0;

function fiscalUrl(date = operationDate) {
  const url = new URL(TREASURY_BUYBACK_OPERATIONS_ENDPOINT);
  url.searchParams.set('fields', TREASURY_BUYBACK_OPERATION_FIELDS.join(','));
  url.searchParams.set('filter', `operation_date:eq:${date}`);
  url.searchParams.set('page[size]', '50');
  return url.toString();
}

const discoveryPass = (overrides = {}) => ({
  decision: 'PASS', reason: 'ok', checkedAt: '2026-08-18T18:05:00.000Z', validUntil: '2026-08-18T18:20:00.000Z',
  operationDate, operationStamp: stamp, preliminaryUrl, finalUrl, resultsUrl,
  source: { url: 'https://www.treasurydirect.gov/auctions/announcements-data-results/buy-backs/', sha256: 'a'.repeat(64) },
  discoveryVerified: true, resultsLinkObserved: true,
  calendarLease: false, publicationAttempted: false, publicationAuthorized: false, enforcementActive: false,
  ...overrides,
});

const outcomePass = (overrides = {}) => ({
  decision: 'PASS', reason: 'ok', checkedAt: '2026-08-18T18:05:02.000Z', validUntil: '2026-08-18T18:15:00.000Z',
  eventIdentity: 'publication-event/v1|TREASURY_BUYBACK|example', operationDate, operationIdentity,
  operationStartAt: '2026-08-18T17:40:00.000Z', operationCloseAt: '2026-08-18T18:00:00.000Z', resultsPublishedAt: null,
  sources: [
    { role: 'fiscaldata-operation', url: fiscalUrl(), fetchedAt: '2026-08-18T18:05:00.000Z', sha256: 'b'.repeat(64) },
    { role: 'treasurydirect-preliminary', url: preliminaryUrl, fetchedAt: '2026-08-18T18:05:01.000Z', sha256: 'c'.repeat(64) },
    { role: 'treasurydirect-final', url: finalUrl, fetchedAt: '2026-08-18T18:05:01.000Z', sha256: 'd'.repeat(64) },
    { role: 'treasurydirect-results', url: resultsUrl, fetchedAt: '2026-08-18T18:05:02.000Z', sha256: 'e'.repeat(64) },
  ],
  publicationAttempted: false, publicationAuthorized: false, enforcementActive: false,
  ...overrides,
});

{
  let discoveredInput = null;
  let outcomeInput = null;
  const result = await verifyDiscoveredTreasuryBuybackOutcome(base, {
    now: clock,
    fetchImpl: async () => ({ status: 200 }),
    discover: async (value) => { discoveredInput = value; return discoveryPass(); },
    verifyOutcome: async (value) => { outcomeInput = value; return outcomePass(); },
  });
  assert.equal(result.decision, 'PASS');
  assert.equal(result.validUntil, '2026-08-18T18:15:00.000Z');
  assert.equal(result.operationStamp, stamp);
  assert.equal(result.preliminaryUrl, preliminaryUrl);
  assert.equal(result.finalUrl, finalUrl);
  assert.equal(result.resultsUrl, resultsUrl);
  assert.equal(result.evidenceVerified, true);
  assert.equal(result.resultsLinkObserved, true);
  assert.equal(result.calendarLease, false);
  assert.equal(result.publicationAttempted, false);
  assert.equal(result.publicationAuthorized, false);
  assert.equal(result.enforcementActive, false);
  assert.deepEqual(discoveredInput, { publisher: 'TREASURY', series: 'BUYBACK', operationDate });
  assert.deepEqual(outcomeInput, base);
  pass();
}

for (const bad of [
  null,
  {},
  { ...base, publisher: 'BLS' },
  { ...base, operationDate: '2026-02-30' },
  { ...base, phase: 'preview' },
  { ...base, releaseStage: 'initial' },
  { ...base, operationIdentity: operationIdentity.replace(operationDate, '2026-08-19') },
  { ...base, resultsUrl },
]) {
  let called = false;
  const result = await verifyDiscoveredTreasuryBuybackOutcome(bad, {
    now: clock,
    fetchImpl: async () => { called = true; },
    discover: async () => { called = true; return discoveryPass(); },
    verifyOutcome: async () => { called = true; return outcomePass(); },
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_CANDIDATE');
  assert.equal(called, false);
}
pass();

{
  let outcomeCalled = false;
  const held = discoveryPass({ decision: 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_INCOMPLETE', reason: 'results missing', discoveryVerified: false, resultsLinkObserved: false });
  const result = await verifyDiscoveredTreasuryBuybackOutcome(base, {
    now: clock, fetchImpl: async () => ({}), discover: async () => held,
    verifyOutcome: async () => { outcomeCalled = true; return outcomePass(); },
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_INCOMPLETE');
  assert.equal(outcomeCalled, false);
  assert.equal(result.publicationAuthorized, false);
  pass();
}

{
  const held = outcomePass({ decision: 'HOLD_TREASURY_BUYBACK_SOURCE_UNAVAILABLE', reason: 'missing results' });
  const result = await verifyDiscoveredTreasuryBuybackOutcome(base, {
    now: clock, fetchImpl: async () => ({}), discover: async () => discoveryPass(), verifyOutcome: async () => held,
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_SOURCE_UNAVAILABLE');
  assert.equal(result.publicationAuthorized, false);
  pass();
}

for (const [name, discovery] of [
  ['unverified', discoveryPass({ discoveryVerified: false })],
  ['results not observed', discoveryPass({ resultsLinkObserved: false })],
  ['wrong date', discoveryPass({ operationDate: '2026-08-19' })],
  ['missing stamp', discoveryPass({ operationStamp: null })],
  ['missing preliminary', discoveryPass({ preliminaryUrl: null })],
  ['missing final', discoveryPass({ finalUrl: null })],
  ['missing results', discoveryPass({ resultsUrl: null })],
]) {
  const result = await verifyDiscoveredTreasuryBuybackOutcome(base, {
    now: clock, fetchImpl: async () => ({}), discover: async () => discovery, verifyOutcome: async () => outcomePass(),
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_DISCOVERY', name);
}
pass();

for (const [name, discovery, outcome] of [
  ['discovery lease', discoveryPass({ calendarLease: true }), outcomePass()],
  ['discovery authorization', discoveryPass({ publicationAuthorized: true }), outcomePass()],
  ['outcome attempt', discoveryPass(), outcomePass({ publicationAttempted: true })],
  ['outcome authorization', discoveryPass(), outcomePass({ publicationAuthorized: true })],
  ['outcome enforcement', discoveryPass(), outcomePass({ enforcementActive: true })],
  ['outcome lease', discoveryPass(), outcomePass({ calendarLease: true })],
]) {
  const result = await verifyDiscoveredTreasuryBuybackOutcome(base, {
    now: clock, fetchImpl: async () => ({}), discover: async () => discovery, verifyOutcome: async () => outcome,
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_BOUNDARY', name);
}
pass();

for (const [name, outcome] of [
  ['wrong operation date', outcomePass({ operationDate: '2026-08-19' })],
  ['wrong operation identity', outcomePass({ operationIdentity: `${operationIdentity}:changed` })],
]) {
  const result = await verifyDiscoveredTreasuryBuybackOutcome(base, {
    now: clock, fetchImpl: async () => ({}), discover: async () => discoveryPass(), verifyOutcome: async () => outcome,
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_IDENTITY', name);
}
pass();

{
  const altered = outcomePass({
    sources: outcomePass().sources.map((source, index) => index === 3 ? { ...source, url: resultsUrl.replace('BBR_', 'BBA_') } : source),
  });
  const result = await verifyDiscoveredTreasuryBuybackOutcome(base, {
    now: clock, fetchImpl: async () => ({}), discover: async () => discoveryPass(), verifyOutcome: async () => altered,
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_SOURCE_BINDING');
  pass();
}

{
  const result = await verifyDiscoveredTreasuryBuybackOutcome(base, {
    now: clock,
    fetchImpl: async () => ({}),
    discover: async () => discoveryPass(),
    verifyOutcome: async (_value, options) => {
      try { await options.fetchImpl('https://evil.example/undiscovered.xml', {}); } catch {}
      return outcomePass({ decision: 'HOLD_TREASURY_BUYBACK_SOURCE_UNAVAILABLE' });
    },
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_SOURCE_BINDING');
  pass();
}

{
  const calls = [];
  const expectedUrls = [fiscalUrl(), preliminaryUrl, finalUrl, resultsUrl];
  const result = await verifyDiscoveredTreasuryBuybackOutcome(base, {
    now: clock,
    fetchImpl: async (url) => { calls.push(String(url)); return { status: 200 }; },
    discover: async () => discoveryPass(),
    verifyOutcome: async (_value, options) => {
      for (const url of expectedUrls) await options.fetchImpl(url, {});
      return outcomePass();
    },
  });
  assert.equal(result.decision, 'PASS');
  assert.deepEqual(calls, expectedUrls);
  pass();
}

for (const [name, discovery, outcome] of [
  ['discovery validity', discoveryPass({ validUntil: 'not-a-time' }), outcomePass()],
  ['outcome validity', discoveryPass(), outcomePass({ validUntil: null })],
  ['close time', discoveryPass(), outcomePass({ operationCloseAt: 'not-a-time' })],
]) {
  const result = await verifyDiscoveredTreasuryBuybackOutcome(base, {
    now: clock, fetchImpl: async () => ({}), discover: async () => discovery, verifyOutcome: async () => outcome,
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_FRESHNESS', name);
}
pass();

{
  const exact = Date.parse('2026-08-18T18:15:00Z');
  const result = await verifyDiscoveredTreasuryBuybackOutcome(base, {
    now: () => exact,
    fetchImpl: async () => ({}),
    discover: async () => discoveryPass({ checkedAt: new Date(exact).toISOString(), validUntil: '2026-08-18T18:20:00.000Z' }),
    verifyOutcome: async () => outcomePass({ checkedAt: new Date(exact).toISOString(), validUntil: new Date(exact).toISOString() }),
  });
  assert.equal(result.decision, 'HOLD_EVIDENCE_STALE');
  pass();
}

{
  const before = Date.parse('2026-08-18T17:59:59Z');
  const result = await verifyDiscoveredTreasuryBuybackOutcome(base, {
    now: () => before,
    fetchImpl: async () => ({}),
    discover: async () => discoveryPass({ checkedAt: new Date(before).toISOString(), validUntil: '2026-08-18T18:20:00.000Z' }),
    verifyOutcome: async () => outcomePass({ checkedAt: new Date(before).toISOString(), validUntil: '2026-08-18T18:15:00.000Z' }),
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_OUTCOME_NOT_RELEASED');
  pass();
}

{
  const times = [t0, t0 + 1, t0 - 1];
  const now = () => times.length > 1 ? times.shift() : times[0];
  const result = await verifyDiscoveredTreasuryBuybackOutcome(base, {
    now,
    fetchImpl: async () => ({}),
    discover: async (_value, options) => { options.now(); return discoveryPass(); },
    verifyOutcome: async () => outcomePass(),
  });
  assert.equal(result.decision, 'HOLD_INVALID_CLOCK');
  pass();
}

{
  const result = await verifyDiscoveredTreasuryBuybackOutcome(base, {
    now: clock, fetchImpl: async () => ({}), discover: null, verifyOutcome: null,
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_OUTCOME_ORCHESTRATOR_INTERNAL');
  pass();
}

assert.equal(publicationEventDescriptor('TREASURY', 'BUYBACK')?.verification.enabled, false);
assert.throws(
  () => normalizeCalendarCandidate({
    publisher: 'TREASURY', series: 'BUYBACK', referencePeriod: '2026-08', releaseStage: 'initial',
    eventDate: operationDate, releaseTime: '14:00', timeZone: 'America/New_York',
    releaseAt: '2026-08-18T18:00:00Z', phase: 'outcome', statusLabel: 'released-confirmed',
  }),
  (error) => error?.code === 'HOLD_UNSUPPORTED_EVENT',
  'outcome orchestration evidence must not activate Treasury in the canonical publication calendar',
);
pass();

console.log(`Treasury buyback dormant outcome orchestrator v1: ${groups} regression groups passed (mocked discovery/outcome adapters; exact source confinement; no calendar lease or publication authorization).`);
