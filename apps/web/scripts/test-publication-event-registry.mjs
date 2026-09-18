import assert from 'node:assert/strict';
import {
  canonicalPublicationEventIdentity,
  parsePublicationEventLabel,
  publicationEventDescriptor,
  publicationEventRegistrySnapshot,
} from '../src/lib/publication-event-registry.js';
import { calendarIdentity, normalizeCalendarCandidate, verifyPublicationCalendar } from '../src/lib/publication-calendar.js';
import { candidate } from './fixtures/publication-calendar.js';

let groups = 0;
const pass = () => { groups += 1; };
const held = (work, code) => {
  assert.throws(work, (error) => error?.code === code);
  pass();
};

const registry = publicationEventRegistrySnapshot();
assert.equal(registry.length, 4);
assert.ok(Object.isFrozen(registry));
assert.ok(registry.every((entry) => Object.isFrozen(entry)
  && Object.isFrozen(entry.reference)
  && Object.isFrozen(entry.releaseStages)
  && Object.isFrozen(entry.clock)
  && Object.isFrozen(entry.identity)
  && Object.isFrozen(entry.identity.fields)
  && Object.isFrozen(entry.verification)));
pass();

for (const series of ['CPI', 'PPI', 'EMPSIT']) {
  const descriptor = publicationEventDescriptor('BLS', series);
  assert.equal(descriptor.family, 'BLS_NATIONAL_MONTHLY');
  assert.equal(descriptor.publisher, 'BLS');
  assert.equal(descriptor.series, series);
  assert.deepEqual(descriptor.reference, { kind: 'month', field: 'referencePeriod', pattern: 'YYYY-MM' });
  assert.deepEqual(descriptor.releaseStages, ['initial']);
  assert.deepEqual(descriptor.clock, { kind: 'iana-local-release', timeZone: 'America/New_York' });
  assert.deepEqual(descriptor.identity.fields, ['publisher', 'series', 'referencePeriod', 'releaseStage']);
  assert.equal(descriptor.verification.enabled, true);
  assert.equal(descriptor.verification.adapter, 'bls-national-monthly/html-v4');
  pass();
}

assert.equal(publicationEventDescriptor('BLS', 'REAL_EARNINGS'), null);
assert.equal(publicationEventDescriptor('BEA', 'PCE'), null);
assert.equal(publicationEventDescriptor('Eurostat', 'CPI'), null);
pass();

const cpiDescriptor = publicationEventDescriptor('BLS', 'CPI');
assert.equal(canonicalPublicationEventIdentity(candidate, cpiDescriptor), 'BLS:CPI:2026-08:initial');
assert.equal(calendarIdentity(candidate), 'BLS:CPI:2026-08:initial');
pass();

const normalizedBls = normalizeCalendarCandidate(candidate);
assert.deepEqual(normalizedBls, {
  publisher: 'BLS',
  series: 'CPI',
  referencePeriod: '2026-08',
  releaseStage: 'initial',
  eventDate: '2026-09-11',
  releaseTime: '08:30',
  timeZone: 'America/New_York',
  phase: 'preview',
  statusLabel: 'scheduled-confirmed',
  releaseAt: '2026-09-11T12:30:00.000Z',
});
pass();

const parsedBls = parsePublicationEventLabel(cpiDescriptor, 'BLS Consumer Price Index (CPI) for August 2026');
assert.deepEqual(parsedBls, { publisher: 'BLS', series: 'CPI', referenceText: 'August 2026', releaseStage: 'initial' });
pass();

const treasury = publicationEventDescriptor('TREASURY', 'BUYBACK');
assert.equal(treasury.family, 'TREASURY_BUYBACK');
assert.deepEqual(treasury.reference, { kind: 'operation-date', field: 'operationDate', pattern: 'YYYY-MM-DD' });
assert.deepEqual(treasury.releaseStages, ['operation']);
assert.deepEqual(treasury.clock, { kind: 'operation-window', timeZone: 'America/New_York' });
assert.deepEqual(treasury.identity.fields, ['publisher', 'series', 'operationDate', 'operationIdentity', 'releaseStage']);
assert.equal(treasury.verification.enabled, false);
assert.equal(treasury.verification.adapter, null);
pass();

const treasuryCandidate = {
  publisher: 'TREASURY',
  series: 'BUYBACK',
  operationDate: '2026-09-09',
  operationIdentity: '20260909174000:Liquidity Support:Nominal Coupons:20Y to 30Y',
  releaseStage: 'operation',
};
assert.equal(
  canonicalPublicationEventIdentity(treasuryCandidate, treasury),
  'publication-event/v1|TREASURY_BUYBACK|publisher=TREASURY|series=BUYBACK|operationDate=2026-09-09|operationIdentity=20260909174000%3ALiquidity%20Support%3ANominal%20Coupons%3A20Y%20to%2030Y|releaseStage=operation',
);
pass();

assert.equal(canonicalPublicationEventIdentity({ ...treasuryCandidate, operationIdentity: '' }, treasury), null);
assert.equal(canonicalPublicationEventIdentity({ ...treasuryCandidate, operationDate: undefined }, treasury), null);
assert.equal(canonicalPublicationEventIdentity({ publisher: 'TREASURY', series: 'AUCTION' }), null);
pass();

assert.notEqual(
  canonicalPublicationEventIdentity(treasuryCandidate, treasury),
  canonicalPublicationEventIdentity(candidate, cpiDescriptor),
);
pass();

assert.equal(parsePublicationEventLabel(treasury, 'BLS Consumer Price Index for August 2026'), null);
assert.equal(parsePublicationEventLabel(treasury, 'Treasury 13-week and 26-week auctions'), null);
assert.equal(parsePublicationEventLabel(treasury, 'Treasury liquidity-support buyback operation'), null);
pass();

held(() => normalizeCalendarCandidate({
  ...candidate,
  publisher: 'TREASURY',
  series: 'BUYBACK',
  referencePeriod: '2026-09',
  releaseStage: 'initial',
  event: 'Treasury liquidity-support buyback operation',
}), 'HOLD_UNSUPPORTED_EVENT');

held(() => normalizeCalendarCandidate({ ...candidate, publisher: 'BLS', series: 'CPI', releaseStage: 'revised' }), 'HOLD_UNSUPPORTED_EVENT');
held(() => normalizeCalendarCandidate({ ...candidate, publisher: 'BLS', series: 'CPI', timeZone: 'UTC' }), 'HOLD_RELEASE_TIME_MISMATCH');
held(() => normalizeCalendarCandidate({ ...candidate, publisher: 'BLS', series: 'CPI', event: 'Treasury liquidity-support buyback operation' }), 'HOLD_IDENTITY_MISMATCH');
held(() => normalizeCalendarCandidate({ ...candidate, publisher: 'BLS', series: 'PPI', event: 'BLS Consumer Price Index for August 2026' }), 'HOLD_IDENTITY_MISMATCH');

let treasuryFetchCalled = false;
const treasuryDecision = await verifyPublicationCalendar({
  publisher: 'TREASURY', series: 'BUYBACK', operationDate: '2026-09-09',
  operationIdentity: '20260909174000:Liquidity Support:Nominal Coupons:20Y to 30Y', releaseStage: 'operation',
  eventDate: '2026-09-09', releaseTime: '13:40', timeZone: 'America/New_York', releaseAt: '2026-09-09T17:40:00Z',
  phase: 'preview', statusLabel: 'scheduled-confirmed',
}, {
  now: () => Date.parse('2026-09-08T12:00:00Z'),
  fetchImpl: async () => { treasuryFetchCalled = true; throw new Error('must not fetch'); },
});
assert.equal(treasuryDecision.decision, 'HOLD_UNSUPPORTED_EVENT');
assert.equal(treasuryDecision.publicationAuthorized, false);
assert.equal(treasuryDecision.publicationAttempted, false);
assert.equal(treasuryFetchCalled, false);
pass();

console.log(`Publication canonical event registry: ${groups} regression groups passed (family descriptors only; Treasury remains non-authorizing).`);
