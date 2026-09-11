import assert from 'node:assert/strict';
import { normalizeCalendarCandidate } from '../src/lib/publication-calendar.js';
import { publicationEventDescriptor } from '../src/lib/publication-event-registry.js';
import { verifyDiscoveredTreasuryBuybackPreview } from '../src/lib/treasury-buyback-preview-orchestrator.js';

let groups = 0;
const pass = () => { groups += 1; };
const operationDate = '2026-09-10';
const stamp = '20260910174000';
const preliminaryUrl = `https://www.treasurydirect.gov/instit/annceresult/press/preanre/2026/BBPA_${stamp}.xml`;
const base = { publisher: 'TREASURY', series: 'BUYBACK', operationDate, phase: 'preview' };
const t0 = Date.parse('2026-09-09T15:05:00Z');
const clock = () => t0;

const discoveryPass = (overrides = {}) => ({
  decision: 'PASS', reason: 'ok', checkedAt: '2026-09-09T15:05:00.000Z', validUntil: '2026-09-09T15:20:00.000Z',
  operationDate, operationStamp: stamp, preliminaryUrl,
  source: { url: 'https://www.treasurydirect.gov/auctions/announcements-data-results/buy-backs/', sha256: 'a'.repeat(64) },
  discoveryVerified: true, calendarLease: false, publicationAttempted: false, publicationAuthorized: false, enforcementActive: false,
  ...overrides,
});
const previewPass = (overrides = {}) => ({
  decision: 'PASS', reason: 'ok', checkedAt: '2026-09-09T15:05:01.000Z', validUntil: '2026-09-09T15:15:00.000Z',
  announcementStage: 'preliminary', operationDate, operationStamp: stamp,
  operationStartAt: '2026-09-10T17:40:00.000Z', operationCloseAt: '2026-09-10T18:00:00.000Z',
  sources: [{ url: preliminaryUrl, fetchedAt: '2026-09-09T15:05:01.000Z', sha256: 'b'.repeat(64) }],
  evidenceVerified: true, calendarLease: false, publicationAttempted: false, publicationAuthorized: false, enforcementActive: false,
  ...overrides,
});

{
  let discoveredInput = null;
  let previewInput = null;
  const result = await verifyDiscoveredTreasuryBuybackPreview(base, {
    now: clock,
    fetchImpl: async () => { throw new Error('not used by injected adapters'); },
    discover: async (value) => { discoveredInput = value; return discoveryPass(); },
    verifyPreview: async (value) => { previewInput = value; return previewPass(); },
  });
  assert.equal(result.decision, 'PASS');
  assert.equal(result.validUntil, '2026-09-09T15:15:00.000Z');
  assert.equal(result.operationStamp, stamp);
  assert.equal(result.preliminaryUrl, preliminaryUrl);
  assert.equal(result.evidenceVerified, true);
  assert.equal(result.calendarLease, false);
  assert.equal(result.publicationAuthorized, false);
  assert.deepEqual(discoveredInput, { publisher: 'TREASURY', series: 'BUYBACK', operationDate });
  assert.deepEqual(previewInput, { publisher: 'TREASURY', series: 'BUYBACK', operationDate, phase: 'preview', preliminaryUrl });
  pass();
}

for (const bad of [
  null, {},
  { publisher: 'BLS', series: 'BUYBACK', operationDate, phase: 'preview' },
  { publisher: 'TREASURY', series: 'BUYBACK', operationDate: '2026-02-30', phase: 'preview' },
  { ...base, preliminaryUrl },
]) {
  let called = false;
  const result = await verifyDiscoveredTreasuryBuybackPreview(bad, {
    now: clock,
    discover: async () => { called = true; return discoveryPass(); },
    verifyPreview: async () => { called = true; return previewPass(); },
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_CANDIDATE');
  assert.equal(called, false);
}
pass();

{
  let previewCalled = false;
  const held = discoveryPass({ decision: 'HOLD_TREASURY_BUYBACK_DISCOVERY_NOT_FOUND', reason: 'missing', discoveryVerified: false });
  const result = await verifyDiscoveredTreasuryBuybackPreview(base, {
    now: clock,
    discover: async () => held,
    verifyPreview: async () => { previewCalled = true; return previewPass(); },
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_DISCOVERY_NOT_FOUND');
  assert.equal(previewCalled, false);
  assert.equal(result.publicationAuthorized, false);
  pass();
}

{
  const held = previewPass({ decision: 'HOLD_TREASURY_BUYBACK_PREVIEW_EXPIRED', reason: 'expired', evidenceVerified: false });
  const result = await verifyDiscoveredTreasuryBuybackPreview(base, {
    now: clock, discover: async () => discoveryPass(), verifyPreview: async () => held,
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_EXPIRED');
  assert.equal(result.publicationAuthorized, false);
  pass();
}

for (const [name, discovery] of [
  ['missing verification', discoveryPass({ discoveryVerified: false })],
  ['wrong operation date', discoveryPass({ operationDate: '2026-09-11' })],
  ['missing URL', discoveryPass({ preliminaryUrl: null })],
  ['missing stamp', discoveryPass({ operationStamp: null })],
]) {
  const result = await verifyDiscoveredTreasuryBuybackPreview(base, {
    now: clock, discover: async () => discovery, verifyPreview: async () => previewPass(),
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_DISCOVERY', name);
}
pass();

for (const [name, preview] of [
  ['wrong operation date', previewPass({ operationDate: '2026-09-11' })],
  ['wrong stamp', previewPass({ operationStamp: '20260911174000' })],
  ['unverified', previewPass({ evidenceVerified: false })],
]) {
  const result = await verifyDiscoveredTreasuryBuybackPreview(base, {
    now: clock, discover: async () => discoveryPass(), verifyPreview: async () => preview,
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_IDENTITY', name);
}
pass();

{
  const result = await verifyDiscoveredTreasuryBuybackPreview(base, {
    now: clock,
    discover: async () => discoveryPass(),
    verifyPreview: async () => previewPass({ sources: [{ url: preliminaryUrl.replace('BBPA_', 'BBA_') }] }),
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_IDENTITY');
  pass();
}

for (const [name, discovery, preview] of [
  ['discovery', discoveryPass({ calendarLease: true }), previewPass()],
  ['preview', discoveryPass(), previewPass({ publicationAuthorized: true }))],
]) {
  const result = await verifyDiscoveredTreasuryBuybackPreview(base, {
    now: clock, discover: async () => discovery, verifyPreview: async () => preview,
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_BOUNDARY', name);
}
pass();

for (const [name, discovery, preview] of [
  ['discovery validity', discoveryPass({ validUntil: 'not-a-time' }), previewPass()],
  ['preview validity', discoveryPass(), previewPass({ validUntil: null }))],
]) {
  const result = await verifyDiscoveredTreasuryBuybackPreview(base, {
    now: clock, discover: async () => discovery, verifyPreview: async () => preview,
  });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_FRESHNESS', name);
}
pass();

{
  const exact = Date.parse('2026-09-09T15:15:00Z');
  const result = await verifyDiscoveredTreasuryBuybackPreview(base, {
    now: () => exact,
    discover: async () => discoveryPass({ checkedAt: new Date(exact).toISOString(), validUntil: '2026-09-09T15:20:00.000Z' }),
    verifyPreview: async () => previewPass({ checkedAt: new Date(exact).toISOString(), validUntil: new Date(exact).toISOString() }),
  });
  assert.equal(result.decision, 'HOLD_EVIDENCE_STALE');
  pass();
}

{
  const times = [t0, t0 + 1, t0 - 1];
  const now = () => times.length > 1 ? times.shift() : times[0];
  const result = await verifyDiscoveredTreasuryBuybackPreview(base, {
    now,
    discover: async (_value, options) => { options.now(); return discoveryPass(); },
    verifyPreview: async () => previewPass(),
  });
  assert.equal(result.decision, 'HOLD_INVALID_CLOCK');
  pass();
}

{
  const result = await verifyDiscoveredTreasuryBuybackPreview(base, { now: clock, discover: null, verifyPreview: null });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_ORCHESTRATOR_INTERNAL');
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
);
pass();

console.log(`Treasury buyback dormant preview orchestrator v1: ${groups} regression groups passed (mocked discovery/preview adapters; no calendar lease or publication authorization).`);
