import assert from 'node:assert/strict';
import { normalizeCalendarCandidate } from '../src/lib/publication-calendar.js';
import {
  TREASURY_BUYBACK_OPERATION_FIELDS,
  TREASURY_BUYBACK_OPERATION_SCHEMA_VERSION,
  TREASURY_BUYBACK_OPERATIONS_ENDPOINT,
  TreasuryBuybackOperationHold,
  normalizeTreasuryBuybackOperationResponse,
  normalizeTreasuryBuybackOperationRow,
} from '../src/lib/treasury-buyback-operation.js';

let groups = 0;
const pass = () => { groups += 1; };
const baseRow = Object.freeze({
  operation_date: '2026-08-18',
  operation_start_time_est: '01:40 PM',
  operation_close_time_est: '02:00 PM',
  settlement_date: '2026-08-19',
  preliminary_ann_pdf: 'BBPA_20260818174000.pdf',
  preliminary_ann_xml: 'BBPA_20260818174000.xml',
  final_ann_pdf: 'BBA_20260818174000.pdf',
  final_ann_xml: 'BBA_20260818174000.xml',
  results_pdf: 'BBR_20260818174000.pdf',
  results_xml: 'BBR_20260818174000.xml',
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

function held(work, code) {
  assert.throws(work, (error) => error instanceof TreasuryBuybackOperationHold && error.code === code);
  pass();
}

assert.equal(TREASURY_BUYBACK_OPERATION_SCHEMA_VERSION, 'treasury-buyback-operation/fiscaldata-v0');
assert.equal(TREASURY_BUYBACK_OPERATIONS_ENDPOINT, 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/buybacks_operations');
assert.equal(TREASURY_BUYBACK_OPERATION_FIELDS.length, 21);
pass();

const operation = normalizeTreasuryBuybackOperationRow({ ...baseRow });
assert.equal(operation.identity, 'TREASURY:BUYBACK:2026-08-18:20260818174000:Liquidity Support:Nominal Coupons:20Y to 30Y');
assert.equal(operation.operationDate, '2026-08-18');
assert.equal(operation.settlementDate, '2026-08-19');
assert.equal(operation.operationStartTimeText, '01:40 PM');
assert.equal(operation.operationCloseTimeText, '02:00 PM');
assert.equal(operation.artifacts.preliminary.pdf.filename, 'BBPA_20260818174000.pdf');
assert.equal(operation.artifacts.final.xml.filename, 'BBA_20260818174000.xml');
assert.equal(operation.artifacts.results.pdf.filename, 'BBR_20260818174000.pdf');
assert.equal(operation.announcementAt, null, 'artifact filename must not become announcement time');
assert.equal(operation.resultsPublishedAt, null, 'operation close must not become results publication time');
assert.equal(operation.freshSourceVerified, false);
assert.equal(operation.publicationAuthorized, false);
assert.equal(operation.enforcementActive, false);
pass();

assert.deepEqual(operation.numeric, {
  numberIssuesAccepted: '10',
  totalParAmountOffered: '19868000000',
  parAmountPerOffer: '1000000',
  maxParAmountRedeemed: '2000000000',
  maxNumberOffers: '100',
  numberIssuesEligible: '36',
  totalParAmountAccepted: '2000000000',
});
pass();

held(() => normalizeTreasuryBuybackOperationRow({ ...baseRow, surprise_field: 'not reviewed' }), 'HOLD_TREASURY_BUYBACK_SCHEMA');
const missingField = { ...baseRow }; delete missingField.operation_type;
held(() => normalizeTreasuryBuybackOperationRow(missingField), 'HOLD_TREASURY_BUYBACK_SCHEMA');
held(() => normalizeTreasuryBuybackOperationRow({ ...baseRow, operation_date: '2026-02-30' }), 'HOLD_TREASURY_BUYBACK_DATE');
held(() => normalizeTreasuryBuybackOperationRow({ ...baseRow, settlement_date: '2026-08-17' }), 'HOLD_TREASURY_BUYBACK_DATE');
held(() => normalizeTreasuryBuybackOperationRow({ ...baseRow, operation_start_time_est: '13:40' }), 'HOLD_TREASURY_BUYBACK_TIME');
held(() => normalizeTreasuryBuybackOperationRow({ ...baseRow, operation_start_time_est: '02:00 PM', operation_close_time_est: '01:40 PM' }), 'HOLD_TREASURY_BUYBACK_TIME');
held(() => normalizeTreasuryBuybackOperationRow({ ...baseRow, operation_start_time_est: '09:00 AM', operation_close_time_est: '01:00 PM' }), 'HOLD_TREASURY_BUYBACK_TIME');

held(() => normalizeTreasuryBuybackOperationRow({ ...baseRow, preliminary_ann_xml: 'BBA_20260818174000.xml' }), 'HOLD_TREASURY_BUYBACK_ARTIFACT');
held(() => normalizeTreasuryBuybackOperationRow({ ...baseRow, preliminary_ann_xml: 'BBPA_20260818174100.xml' }), 'HOLD_TREASURY_BUYBACK_ARTIFACT');
held(() => normalizeTreasuryBuybackOperationRow({ ...baseRow, results_pdf: 'null', results_xml: 'null' }), 'HOLD_TREASURY_BUYBACK_INCOMPLETE');
held(() => normalizeTreasuryBuybackOperationRow({ ...baseRow, results_xml: 'null' }), 'HOLD_TREASURY_BUYBACK_ARTIFACT');
held(() => normalizeTreasuryBuybackOperationRow({ ...baseRow, final_ann_pdf: 'BBA_20260819174000.pdf', final_ann_xml: 'BBA_20260819174000.xml' }), 'HOLD_TREASURY_BUYBACK_ARTIFACT');
held(() => normalizeTreasuryBuybackOperationRow({ ...baseRow, preliminary_ann_pdf: 'BBPA_20260817174000.pdf', preliminary_ann_xml: 'BBPA_20260817174000.xml', final_ann_pdf: 'BBA_20260817174000.pdf', final_ann_xml: 'BBA_20260817174000.xml', results_pdf: 'BBR_20260817174000.pdf', results_xml: 'BBR_20260817174000.xml' }), 'HOLD_TREASURY_BUYBACK_IDENTITY');
held(() => normalizeTreasuryBuybackOperationRow({ ...baseRow, preliminary_ann_pdf: 'https://evil.example/BBPA_20260818174000.pdf' }), 'HOLD_TREASURY_BUYBACK_ARTIFACT');
held(() => normalizeTreasuryBuybackOperationRow({ ...baseRow, special_ann_pdf: 'javascript:bad.pdf' }), 'HOLD_TREASURY_BUYBACK_ARTIFACT');

held(() => normalizeTreasuryBuybackOperationRow({ ...baseRow, nbr_issues_accepted: '-1' }), 'HOLD_TREASURY_BUYBACK_SCHEMA');
held(() => normalizeTreasuryBuybackOperationRow({ ...baseRow, nbr_issues_accepted: '37' }), 'HOLD_TREASURY_BUYBACK_RESULT');
held(() => normalizeTreasuryBuybackOperationRow({ ...baseRow, total_par_amt_accepted: '19868000001' }), 'HOLD_TREASURY_BUYBACK_RESULT');
held(() => normalizeTreasuryBuybackOperationRow({ ...baseRow, max_par_amt_redeemed: '1999999999' }), 'HOLD_TREASURY_BUYBACK_RESULT');
held(() => normalizeTreasuryBuybackOperationRow({ ...baseRow, total_par_amt_offered: '1e10' }), 'HOLD_TREASURY_BUYBACK_SCHEMA');

const response = normalizeTreasuryBuybackOperationResponse({ data: [{ ...baseRow }] });
assert.equal(response.operationCount, 1);
assert.equal(response.operations[0].identity, operation.identity);
assert.equal(response.freshSourceVerified, false);
assert.equal(response.publicationAuthorized, false);
assert.equal(response.enforcementActive, false);
pass();

held(() => normalizeTreasuryBuybackOperationResponse({ data: [{ ...baseRow }, { ...baseRow }] }), 'HOLD_TREASURY_BUYBACK_DUPLICATE');
held(() => normalizeTreasuryBuybackOperationResponse({ data: new Array(51).fill({ ...baseRow }) }), 'HOLD_TREASURY_BUYBACK_SCHEMA');
held(() => normalizeTreasuryBuybackOperationResponse({ data: [] }, { maxRows: 101 }), 'HOLD_TREASURY_BUYBACK_SCHEMA');
held(() => normalizeTreasuryBuybackOperationResponse({ rows: [] }), 'HOLD_TREASURY_BUYBACK_SCHEMA');

assert.throws(
  () => normalizeCalendarCandidate({
    publisher: 'TREASURY', series: 'BUYBACK', referencePeriod: '2026-08', releaseStage: 'initial',
    eventDate: '2026-08-18', releaseTime: '14:00', timeZone: 'America/New_York',
    releaseAt: '2026-08-18T18:00:00Z', phase: 'outcome', statusLabel: 'released',
  }),
  (error) => error?.code === 'HOLD_UNSUPPORTED_EVENT',
  'dormant Treasury parser must not create a publication-calendar PASS path',
);
pass();

assert.equal(JSON.stringify(operation).includes('11:00'), false, 'parser must not invent preliminary/final announcement timing');
assert.equal(JSON.stringify(operation).includes('18:02'), false, 'parser must not invent empirical results publication timing');
pass();

console.log(`Treasury buyback dormant-operation parser: ${groups} regression groups passed (synthetic/captured-shape fixtures only; no live-source or publication certification).`);
