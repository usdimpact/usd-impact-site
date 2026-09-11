import assert from 'node:assert/strict';
import { normalizeCalendarCandidate } from '../src/lib/publication-calendar.js';
import { publicationEventDescriptor } from '../src/lib/publication-event-registry.js';
import {
  TREASURY_BUYBACK_PREVIEW_EVIDENCE_MAX_AGE_MS,
  TREASURY_BUYBACK_PREVIEW_SOURCE_MAX_BYTES,
  TREASURY_BUYBACK_PREVIEW_VERIFIER_VERSION,
  deriveTreasuryBuybackFinalUrl,
  verifyTreasuryBuybackPreviewEvidence,
} from '../src/lib/treasury-buyback-preview-verifier.js';

let groups = 0;
const pass = () => { groups += 1; };
const stamp = '20260818174000';
const base = 'https://www.treasurydirect.gov/instit/annceresult/press/preanre/2026';
const preliminaryUrl = `${base}/BBPA_${stamp}.xml`;
const finalUrl = `${base}/BBA_${stamp}.xml`;
const candidate = Object.freeze({
  publisher: 'TREASURY',
  series: 'BUYBACK',
  operationDate: '2026-08-18',
  phase: 'preview',
  preliminaryUrl,
});
const common = `
  <operationStartDTM>2026-08-18T13:40:00-04:00</operationStartDTM>
  <operationCloseDTM>2026-08-18T14:00:00-04:00</operationCloseDTM>`;
const baseXml = Object.freeze({
  preliminary: `<?xml version="1.0" encoding="UTF-8"?>
<buybackAnnouncement>
  <announcementType>Preliminary</announcementType>
  <operationStatus>Released</operationStatus>
  <announcementDTM>2026-08-17T11:00:00-04:00</announcementDTM>
  <announcementTitle>TREASURY DEBT BUYBACK OPERATION PRELIMINARY ANNOUNCEMENT</announcementTitle>${common}
  <maxParAmountRedeemed>2000000000</maxParAmountRedeemed>
  <numberIssuesEligible>36</numberIssuesEligible>
</buybackAnnouncement>`,
  final: `<?xml version="1.0" encoding="UTF-8"?>
<buybackAnnouncement>
  <announcementType>Final</announcementType>
  <operationStatus>Released</operationStatus>
  <announcementDTM>2026-08-18T11:00:00-04:00</announcementDTM>${common}
</buybackAnnouncement>`,
});

function response(url, body, { status = 200, contentType = 'application/xml', redirectUrl, contentLength } = {}) {
  const headers = new Map();
  if (contentType !== null) headers.set('content-type', contentType);
  if (contentLength !== undefined) headers.set('content-length', String(contentLength));
  return {
    status,
    url: redirectUrl ?? url,
    headers: { get: (name) => headers.get(String(name).toLowerCase()) ?? null },
    text: async () => body,
  };
}

function makeFetch({ preliminary = baseXml.preliminary, final = baseXml.final, preliminaryOptions = {}, finalOptions = { status: 404 } } = {}) {
  const calls = [];
  const fetchImpl = async (requestUrl) => {
    const url = String(requestUrl);
    calls.push(url);
    if (url === preliminaryUrl) return response(url, preliminary, preliminaryOptions);
    if (url === finalUrl) return response(url, final, finalOptions);
    throw new Error(`Unexpected URL ${url}`);
  };
  return { fetchImpl, calls };
}

const constantNow = (iso) => () => Date.parse(iso);
const PRELIMINARY_AFTER = '2026-08-17T15:05:00Z';
const FINAL_BEFORE = '2026-08-18T14:59:59Z';
const FINAL_AT = '2026-08-18T15:00:00Z';
const FINAL_AFTER = '2026-08-18T15:05:00Z';
const OPERATION_AT = '2026-08-18T17:40:00Z';

assert.equal(TREASURY_BUYBACK_PREVIEW_VERIFIER_VERSION, 'treasury-buyback-preview-verifier/v1');
assert.equal(TREASURY_BUYBACK_PREVIEW_EVIDENCE_MAX_AGE_MS, 15 * 60 * 1000);
assert.equal(TREASURY_BUYBACK_PREVIEW_SOURCE_MAX_BYTES, 1_048_576);
assert.equal(deriveTreasuryBuybackFinalUrl(preliminaryUrl), finalUrl);
pass();

{
  const { fetchImpl, calls } = makeFetch();
  const result = await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(PRELIMINARY_AFTER), fetchImpl });
  assert.equal(result.decision, 'PASS');
  assert.equal(result.announcementStage, 'preliminary');
  assert.equal(result.operationDate, '2026-08-18');
  assert.equal(result.operationStamp, stamp);
  assert.equal(result.operationStartAt, '2026-08-18T17:40:00.000Z');
  assert.equal(result.operationCloseAt, '2026-08-18T18:00:00.000Z');
  assert.equal(result.preliminaryAnnouncementAt, '2026-08-17T15:00:00.000Z');
  assert.equal(result.finalAnnouncementAt, null);
  assert.equal(result.finalProbe.status, 404);
  assert.equal(result.finalProbe.effective, false);
  assert.equal(result.evidenceVerified, true);
  assert.equal(result.calendarLease, false);
  assert.equal(result.publicationAuthorized, false);
  assert.equal(result.enforcementActive, false);
  assert.equal(result.publicationAttempted, false);
  assert.equal(result.sources.length, 1);
  assert.deepEqual(calls, [preliminaryUrl, finalUrl]);
  assert.equal(JSON.stringify(result).includes('<buybackAnnouncement>'), false);
  pass();
}

{
  const { fetchImpl, calls } = makeFetch({ finalOptions: { status: 200 } });
  const result = await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(FINAL_AFTER), fetchImpl });
  assert.equal(result.decision, 'PASS');
  assert.equal(result.announcementStage, 'final');
  assert.equal(result.finalAnnouncementAt, '2026-08-18T15:00:00.000Z');
  assert.equal(result.finalProbe.status, 200);
  assert.equal(result.finalProbe.effective, true);
  assert.equal(result.sources.length, 2);
  assert.equal(result.sources.every((source) => /^[a-f0-9]{64}$/.test(source.sha256)), true);
  assert.deepEqual(calls, [preliminaryUrl, finalUrl]);
  pass();
}

{
  const { fetchImpl } = makeFetch({ finalOptions: { status: 200 } });
  const result = await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(FINAL_AT), fetchImpl });
  assert.equal(result.decision, 'PASS', 'final announcement becomes effective at its exact source timestamp');
  assert.equal(result.announcementStage, 'final');
  pass();
}

{
  const { fetchImpl } = makeFetch({ finalOptions: { status: 200 } });
  const result = await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(FINAL_BEFORE), fetchImpl });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_FINAL_NOT_EFFECTIVE');
  assert.equal(result.publicationAuthorized, false);
  pass();
}

{
  const { fetchImpl, calls } = makeFetch();
  const result = await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow('2026-08-17T14:59:59Z'), fetchImpl });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_NOT_EFFECTIVE');
  assert.equal(calls.length, 1, 'pre-embargo preliminary must HOLD before probing final');
  pass();
}

{
  const { fetchImpl } = makeFetch();
  const result = await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow('2026-08-17T15:00:00Z'), fetchImpl });
  assert.equal(result.decision, 'PASS', 'preliminary announcement becomes effective at its exact source timestamp');
  pass();
}

{
  const { fetchImpl, calls } = makeFetch({ finalOptions: { status: 200 } });
  const result = await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(OPERATION_AT), fetchImpl });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_EXPIRED');
  assert.equal(calls.length, 1, 'expired preview must HOLD before final discovery');
  pass();
}

for (const value of [
  { ...candidate, phase: 'outcome' },
  { ...candidate, publisher: 'BLS' },
  { ...candidate, series: 'CPI' },
  { ...candidate, operationDate: '2026-02-30' },
  { ...candidate, extra: true },
]) {
  const { fetchImpl, calls } = makeFetch();
  const result = await verifyTreasuryBuybackPreviewEvidence(value, { now: constantNow(PRELIMINARY_AFTER), fetchImpl });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_CANDIDATE');
  assert.equal(calls.length, 0);
}
pass();

for (const badUrl of [
  preliminaryUrl.replace('www.treasurydirect.gov', 'evil.example'),
  `${preliminaryUrl}?download=1`,
  preliminaryUrl.replace('/BBPA_', '/BBA_'),
  preliminaryUrl.replace('/2026/', '/2025/'),
]) {
  const { fetchImpl, calls } = makeFetch();
  const result = await verifyTreasuryBuybackPreviewEvidence({ ...candidate, preliminaryUrl: badUrl }, { now: constantNow(PRELIMINARY_AFTER), fetchImpl });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_URL');
  assert.equal(calls.length, 0);
}
pass();

{
  const { fetchImpl } = makeFetch({ preliminaryOptions: { status: 503 } });
  assert.equal((await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(PRELIMINARY_AFTER), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_SOURCE_UNAVAILABLE');
  pass();
}
{
  const { fetchImpl } = makeFetch({ preliminaryOptions: { redirectUrl: 'https://evil.example/file.xml' } });
  assert.equal((await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(PRELIMINARY_AFTER), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_SOURCE_REDIRECT');
  pass();
}
{
  const { fetchImpl } = makeFetch({ preliminaryOptions: { contentType: 'text/html' } });
  assert.equal((await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(PRELIMINARY_AFTER), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_SOURCE_TYPE');
  pass();
}
{
  const { fetchImpl } = makeFetch({ preliminaryOptions: { contentLength: TREASURY_BUYBACK_PREVIEW_SOURCE_MAX_BYTES + 1 } });
  assert.equal((await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(PRELIMINARY_AFTER), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_SOURCE_TOO_LARGE');
  pass();
}

{
  const preliminary = baseXml.preliminary.replace('<operationStatus>Released</operationStatus>\n', '');
  const { fetchImpl } = makeFetch({ preliminary });
  assert.equal((await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(PRELIMINARY_AFTER), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_SCHEMA');
  pass();
}
{
  const preliminary = baseXml.preliminary.replace('operationStatus>Released', 'operationStatus>Scheduled');
  const { fetchImpl } = makeFetch({ preliminary });
  assert.equal((await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(PRELIMINARY_AFTER), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_SCHEMA');
  pass();
}
{
  const preliminary = baseXml.preliminary.replace('operationStatus>Released', 'operationStatus>Extended');
  const { fetchImpl } = makeFetch({ preliminary });
  assert.equal((await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(PRELIMINARY_AFTER), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_EXTENDED');
  pass();
}
{
  const preliminary = baseXml.preliminary.replace('operationStatus>Released', 'operationStatus>Cancelled');
  const { fetchImpl } = makeFetch({ preliminary });
  assert.equal((await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(PRELIMINARY_AFTER), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_CANCELLED');
  pass();
}

{
  const { fetchImpl } = makeFetch({ finalOptions: { status: 403 } });
  assert.equal((await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(PRELIMINARY_AFTER), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_SOURCE_UNAVAILABLE');
  pass();
}
{
  const { fetchImpl } = makeFetch({ finalOptions: { status: 404, redirectUrl: 'https://evil.example/not-found' } });
  assert.equal((await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(PRELIMINARY_AFTER), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_SOURCE_REDIRECT');
  pass();
}
{
  const final = baseXml.final.replace('operationStatus>Released', 'operationStatus>Extended');
  const { fetchImpl } = makeFetch({ final, finalOptions: { status: 200 } });
  assert.equal((await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(FINAL_AFTER), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_EXTENDED');
  pass();
}
{
  const final = baseXml.final.replace('operationStatus>Released', 'operationStatus>Cancelled');
  const { fetchImpl } = makeFetch({ final, finalOptions: { status: 200 } });
  assert.equal((await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(FINAL_AFTER), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_CANCELLED');
  pass();
}
{
  const final = baseXml.final.replace('2026-08-18T14:00:00-04:00', '2026-08-18T14:01:00-04:00');
  const { fetchImpl } = makeFetch({ final, finalOptions: { status: 200 } });
  assert.equal((await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(FINAL_AFTER), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_CROSS_SOURCE');
  pass();
}
{
  const final = baseXml.final.replace('<announcementType>Final</announcementType>', '<announcementType>Preliminary</announcementType>');
  const { fetchImpl } = makeFetch({ final, finalOptions: { status: 200 } });
  assert.equal((await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(FINAL_AFTER), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_XML_KIND');
  pass();
}

{
  const preliminary = baseXml.preliminary.replaceAll('2026-08-18', '2026-08-19');
  const { fetchImpl, calls } = makeFetch({ preliminary });
  const result = await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(PRELIMINARY_AFTER), fetchImpl });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_XML_IDENTITY');
  assert.equal(calls.length, 1);
  pass();
}

{
  const t0 = Date.parse(PRELIMINARY_AFTER);
  const times = [t0, t0, t0, t0, t0 + TREASURY_BUYBACK_PREVIEW_EVIDENCE_MAX_AGE_MS];
  const now = () => times.length > 1 ? times.shift() : times[0];
  const { fetchImpl } = makeFetch();
  assert.equal((await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now, fetchImpl })).decision, 'HOLD_EVIDENCE_STALE');
  pass();
}
{
  const t0 = Date.parse(PRELIMINARY_AFTER);
  const times = [t0, t0 - 1];
  const now = () => times.length > 1 ? times.shift() : times[0];
  const { fetchImpl } = makeFetch();
  assert.equal((await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now, fetchImpl })).decision, 'HOLD_INVALID_CLOCK');
  pass();
}
{
  const fetchImpl = async () => { throw new Error('network down'); };
  assert.equal((await verifyTreasuryBuybackPreviewEvidence({ ...candidate }, { now: constantNow(PRELIMINARY_AFTER), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_SOURCE_UNAVAILABLE');
  pass();
}

assert.equal(publicationEventDescriptor('TREASURY', 'BUYBACK')?.verification.enabled, false);
assert.throws(
  () => normalizeCalendarCandidate({
    publisher: 'TREASURY', series: 'BUYBACK', referencePeriod: '2026-08', releaseStage: 'initial',
    eventDate: '2026-08-18', releaseTime: '14:00', timeZone: 'America/New_York',
    releaseAt: '2026-08-18T18:00:00Z', phase: 'preview', statusLabel: 'scheduled-confirmed',
  }),
  (error) => error?.code === 'HOLD_UNSUPPORTED_EVENT',
  'preview evidence verification must not activate Treasury in the canonical publication calendar',
);
pass();

console.log(`Treasury buyback dormant preview verifier v1: ${groups} regression groups passed (mocked first-party announcement evidence; no calendar lease or publication authorization).`);
