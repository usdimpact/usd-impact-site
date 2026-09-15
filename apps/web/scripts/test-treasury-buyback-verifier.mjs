import assert from 'node:assert/strict';
import { normalizeCalendarCandidate } from '../src/lib/publication-calendar.js';
import {
  TREASURY_BUYBACK_EVIDENCE_MAX_AGE_MS,
  TREASURY_BUYBACK_SOURCE_MAX_BYTES,
  TREASURY_BUYBACK_VERIFIER_VERSION,
  verifyTreasuryBuybackEvidence,
} from '../src/lib/treasury-buyback-verifier.js';

let groups = 0;
const pass = () => { groups += 1; };
const stamp = '20260818174000';
const fiscalEndpoint = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/buybacks_operations';
const treasuryBase = 'https://www.treasurydirect.gov/instit/annceresult/press/preanre/2026';
const baseRow = Object.freeze({
  operation_date: '2026-08-18',
  operation_start_time_est: '01:40 PM',
  operation_close_time_est: '02:00 PM',
  settlement_date: '2026-08-19',
  preliminary_ann_pdf: `BBPA_${stamp}.pdf`,
  preliminary_ann_xml: `BBPA_${stamp}.xml`,
  final_ann_pdf: `BBA_${stamp}.pdf`,
  final_ann_xml: `BBA_${stamp}.xml`,
  results_pdf: `BBR_${stamp}.pdf`,
  results_xml: `BBR_${stamp}.xml`,
  special_ann_pdf: 'null',
  operation_type: 'Liquidity Support',
  security_type: 'Nominal Coupons',
  maturity_bucket: '20Y to 30Y',
  nbr_issues_accepted: '10',
  total_par_amt_offered: '19868000000',
  par_amt_per_offer: '1000000',
  max_par_amt_redeemed: '2000000000',
  max_nbr_offers: '100',
  nbr_issues_eligible: '36',
  total_par_amt_accepted: '2000000000',
});
const operationIdentity = `TREASURY:BUYBACK:2026-08-18:${stamp}:Liquidity Support:Nominal Coupons:20Y to 30Y`;
const candidate = Object.freeze({
  publisher: 'TREASURY',
  series: 'BUYBACK',
  operationDate: '2026-08-18',
  operationIdentity,
  releaseStage: 'operation',
  phase: 'outcome',
});
const commonXml = `
  <operationStartDTM>2026-08-18T13:40:00-04:00</operationStartDTM>
  <operationCloseDTM>2026-08-18T14:00:00-04:00</operationCloseDTM>`;
const baseXml = Object.freeze({
  BBPA: `<?xml version="1.0" encoding="UTF-8"?>
<buybackAnnouncement>
  <announcementType>Preliminary</announcementType>
  <announcementDTM>2026-08-17T11:00:00-04:00</announcementDTM>
  <announcementTitle>TREASURY DEBT BUYBACK OPERATION PRELIMINARY ANNOUNCEMENT</announcementTitle>${commonXml}
  <maxParAmountRedeemed>2000000000</maxParAmountRedeemed>
  <numberIssuesEligible>36</numberIssuesEligible>
</buybackAnnouncement>`,
  BBA: `<?xml version="1.0" encoding="UTF-8"?>
<buybackAnnouncement>
  <announcementType>Final</announcementType>
  <announcementDTM>2026-08-18T11:00:00-04:00</announcementDTM>${commonXml}
</buybackAnnouncement>`,
  BBR: `<?xml version="1.0" encoding="UTF-8"?>
<buybackResults>
  <announcementDTM>2026-08-18T11:00:00-04:00</announcementDTM>${commonXml}
  <operationStatus>Results</operationStatus>
  <numberIssuesAccepted>10</numberIssuesAccepted>
  <totalParAmountOffered>19868000000</totalParAmountOffered>
  <totalParAmountAccepted>2000000000</totalParAmountAccepted>
</buybackResults>`,
});

function response(url, body, { status = 200, contentType, redirectUrl, contentLength } = {}) {
  const headers = new Map();
  if (contentType) headers.set('content-type', contentType);
  if (contentLength !== undefined) headers.set('content-length', String(contentLength));
  return {
    status,
    url: redirectUrl ?? url,
    headers: { get: (name) => headers.get(String(name).toLowerCase()) ?? null },
    text: async () => body,
  };
}

function makeFetch({ rows = [{ ...baseRow }], xml = {}, fail = {}, invalidJson = false } = {}) {
  const calls = [];
  const fetchImpl = async (requestUrl) => {
    const url = String(requestUrl);
    calls.push(url);
    if (url.startsWith(fiscalEndpoint)) {
      const body = invalidJson ? '{broken' : JSON.stringify({ data: rows });
      return response(url, body, {
        status: fail.fiscalStatus ?? 200,
        contentType: fail.fiscalContentType ?? 'application/json; charset=utf-8',
        redirectUrl: fail.fiscalRedirect,
        contentLength: fail.fiscalLength,
      });
    }
    const match = url.match(/\/(BBPA|BBA|BBR)_20\d{12}\.xml$/);
    const kind = match?.[1];
    if (!kind) throw new Error(`Unexpected URL ${url}`);
    const body = xml[kind] ?? baseXml[kind];
    return response(url, body, {
      status: fail[`${kind}Status`] ?? 200,
      contentType: fail[`${kind}ContentType`] ?? 'application/xml',
      redirectUrl: fail[`${kind}Redirect`],
      contentLength: fail[`${kind}Length`],
    });
  };
  return { fetchImpl, calls };
}

const AFTER_CLOSE = Date.parse('2026-08-18T18:05:00Z');
const constantNow = (value = AFTER_CLOSE) => () => value;

assert.equal(TREASURY_BUYBACK_VERIFIER_VERSION, 'treasury-buyback-verifier/v1');
assert.equal(TREASURY_BUYBACK_EVIDENCE_MAX_AGE_MS, 15 * 60 * 1000);
assert.equal(TREASURY_BUYBACK_SOURCE_MAX_BYTES, 1_048_576);
pass();

{
  const { fetchImpl, calls } = makeFetch();
  const result = await verifyTreasuryBuybackEvidence({ ...candidate }, { now: constantNow(), fetchImpl });
  assert.equal(result.decision, 'PASS');
  assert.equal(result.operationIdentity, operationIdentity);
  assert.equal(result.operationDate, '2026-08-18');
  assert.equal(result.operationStartAt, '2026-08-18T17:40:00.000Z');
  assert.equal(result.operationCloseAt, '2026-08-18T18:00:00.000Z');
  assert.equal(result.resultsPublishedAt, null);
  assert.equal(result.publicationAuthorized, false);
  assert.equal(result.enforcementActive, false);
  assert.equal(result.publicationAttempted, false);
  assert.equal(result.sources.length, 4);
  assert.equal(calls.length, 4);
  assert.equal(calls[0].startsWith(`${fiscalEndpoint}?`), true);
  assert.equal(calls.slice(1).every((url) => url.startsWith(`${treasuryBase}/`)), true);
  assert.equal(result.sources.every((source) => /^[a-f0-9]{64}$/.test(source.sha256)), true);
  assert.equal(JSON.stringify(result).includes('<buyback'), false, 'raw official bodies must not leak into audit results');
  pass();
}

{
  const { fetchImpl } = makeFetch();
  const result = await verifyTreasuryBuybackEvidence({ ...candidate }, { now: constantNow(), fetchImpl });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.sources), true);
  assert.equal(Object.isFrozen(result.sources[0]), true);
  assert.match(result.eventIdentity, /^publication-event\/v1\|TREASURY_BUYBACK\|/);
  pass();
}

{
  const { fetchImpl, calls } = makeFetch();
  const result = await verifyTreasuryBuybackEvidence({ ...candidate, phase: 'preview' }, { now: constantNow(), fetchImpl });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_PREVIEW_UNVERIFIED');
  assert.equal(calls.length, 0, 'preview HOLD must occur before a completed-operation fetch');
  assert.equal(result.publicationAuthorized, false);
  pass();
}

for (const value of [
  { ...candidate, releaseStage: 'initial' },
  { ...candidate, operationDate: '2026-02-30' },
  { ...candidate, phase: 'released' },
  { ...candidate, operationIdentity: operationIdentity.replace('2026-08-18', '2026-08-19') },
  { ...candidate, freshSourceVerified: true },
]) {
  const { fetchImpl, calls } = makeFetch();
  const result = await verifyTreasuryBuybackEvidence(value, { now: constantNow(), fetchImpl });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_CANDIDATE');
  assert.equal(calls.length, 0);
  assert.equal(result.publicationAuthorized, false);
}
pass();

{
  const { fetchImpl } = makeFetch({ fail: { fiscalStatus: 503 } });
  assert.equal((await verifyTreasuryBuybackEvidence({ ...candidate }, { now: constantNow(), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_SOURCE_UNAVAILABLE');
  pass();
}
{
  const { fetchImpl } = makeFetch({ fail: { fiscalRedirect: 'https://evil.example/data' } });
  assert.equal((await verifyTreasuryBuybackEvidence({ ...candidate }, { now: constantNow(), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_SOURCE_REDIRECT');
  pass();
}
{
  const { fetchImpl } = makeFetch({ fail: { fiscalContentType: 'text/html' } });
  assert.equal((await verifyTreasuryBuybackEvidence({ ...candidate }, { now: constantNow(), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_SOURCE_TYPE');
  pass();
}
{
  const { fetchImpl } = makeFetch({ fail: { fiscalLength: TREASURY_BUYBACK_SOURCE_MAX_BYTES + 1 } });
  assert.equal((await verifyTreasuryBuybackEvidence({ ...candidate }, { now: constantNow(), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_SOURCE_TOO_LARGE');
  pass();
}
{
  const { fetchImpl } = makeFetch({ invalidJson: true });
  assert.equal((await verifyTreasuryBuybackEvidence({ ...candidate }, { now: constantNow(), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_SOURCE_SCHEMA');
  pass();
}

{
  const other = { ...baseRow, operation_type: 'Cash Management' };
  const { fetchImpl } = makeFetch({ rows: [other] });
  assert.equal((await verifyTreasuryBuybackEvidence({ ...candidate }, { now: constantNow(), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_IDENTITY');
  pass();
}
{
  const { fetchImpl } = makeFetch({ rows: [{ ...baseRow }, { ...baseRow }] });
  assert.equal((await verifyTreasuryBuybackEvidence({ ...candidate }, { now: constantNow(), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_DUPLICATE');
  pass();
}
{
  const { fetchImpl } = makeFetch({ fail: { BBRStatus: 404 } });
  assert.equal((await verifyTreasuryBuybackEvidence({ ...candidate }, { now: constantNow(), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_SOURCE_UNAVAILABLE');
  pass();
}
{
  const xml = { BBR: baseXml.BBR.replace('2026-08-18T13:40:00-04:00', '2026-08-18T13:41:00-04:00') };
  const { fetchImpl } = makeFetch({ xml });
  assert.equal((await verifyTreasuryBuybackEvidence({ ...candidate }, { now: constantNow(), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_XML_IDENTITY');
  pass();
}
{
  const xml = { BBR: baseXml.BBR.replace('<totalParAmountAccepted>2000000000</totalParAmountAccepted>', '<totalParAmountAccepted>1999999999</totalParAmountAccepted>') };
  const { fetchImpl } = makeFetch({ xml });
  assert.equal((await verifyTreasuryBuybackEvidence({ ...candidate }, { now: constantNow(), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_CROSS_SOURCE');
  pass();
}
{
  const xml = { BBPA: baseXml.BBPA.replace('<maxParAmountRedeemed>2000000000</maxParAmountRedeemed>', '<maxParAmountRedeemed>1999999999</maxParAmountRedeemed>') };
  const { fetchImpl } = makeFetch({ xml });
  assert.equal((await verifyTreasuryBuybackEvidence({ ...candidate }, { now: constantNow(), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_CROSS_SOURCE');
  pass();
}
{
  const row = { ...baseRow, operation_start_time_est: '01:41 PM' };
  const alteredIdentity = operationIdentity;
  const { fetchImpl } = makeFetch({ rows: [row] });
  const result = await verifyTreasuryBuybackEvidence({ ...candidate, operationIdentity: alteredIdentity }, { now: constantNow(), fetchImpl });
  assert.equal(result.decision, 'HOLD_TREASURY_BUYBACK_CROSS_SOURCE');
  pass();
}

{
  const { fetchImpl } = makeFetch();
  const beforeClose = Date.parse('2026-08-18T17:59:59Z');
  assert.equal((await verifyTreasuryBuybackEvidence({ ...candidate }, { now: constantNow(beforeClose), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_OUTCOME_NOT_RELEASED');
  pass();
}
{
  const atClose = Date.parse('2026-08-18T18:00:00Z');
  const { fetchImpl } = makeFetch();
  assert.equal((await verifyTreasuryBuybackEvidence({ ...candidate }, { now: constantNow(atClose), fetchImpl })).decision, 'PASS');
  pass();
}

{
  const t0 = Date.parse('2026-08-18T18:00:00Z');
  const times = [t0, t0, t0, t0, t0, t0 + TREASURY_BUYBACK_EVIDENCE_MAX_AGE_MS];
  const now = () => times.length > 1 ? times.shift() : times[0];
  const { fetchImpl } = makeFetch();
  assert.equal((await verifyTreasuryBuybackEvidence({ ...candidate }, { now, fetchImpl })).decision, 'HOLD_EVIDENCE_STALE');
  pass();
}
{
  const t0 = Date.parse('2026-08-18T18:05:00Z');
  const times = [t0, t0, t0 - 1];
  const now = () => times.length > 1 ? times.shift() : times[0];
  const { fetchImpl } = makeFetch();
  assert.equal((await verifyTreasuryBuybackEvidence({ ...candidate }, { now, fetchImpl })).decision, 'HOLD_INVALID_CLOCK');
  pass();
}
{
  const fetchImpl = async () => { throw new Error('network down'); };
  assert.equal((await verifyTreasuryBuybackEvidence({ ...candidate }, { now: constantNow(), fetchImpl })).decision, 'HOLD_TREASURY_BUYBACK_SOURCE_UNAVAILABLE');
  pass();
}

{
  const scaledRow = { ...baseRow, total_par_amt_offered: '19868000000.0', total_par_amt_accepted: '2000000000.000' };
  const scaledIdentity = operationIdentity;
  const { fetchImpl } = makeFetch({ rows: [scaledRow] });
  const result = await verifyTreasuryBuybackEvidence({ ...candidate, operationIdentity: scaledIdentity }, { now: constantNow(), fetchImpl });
  assert.equal(result.decision, 'PASS', 'equivalent decimal scales across official sources must compare exactly');
  pass();
}

assert.throws(
  () => normalizeCalendarCandidate({
    publisher: 'TREASURY', series: 'BUYBACK', operationDate: candidate.operationDate,
    operationIdentity: candidate.operationIdentity, releaseStage: 'operation', phase: 'outcome',
    eventDate: candidate.operationDate, releaseTime: '14:00', timeZone: 'America/New_York',
    releaseAt: '2026-08-18T18:00:00Z', statusLabel: 'released',
  }),
  (error) => error?.code === 'HOLD_UNSUPPORTED_EVENT',
  'verifier v1 must not activate the canonical publication-calendar path',
);
pass();

console.log(`Treasury buyback dormant verifier v1: ${groups} regression groups passed (mocked official sources; evidence consistency only; no publication authorization).`);
