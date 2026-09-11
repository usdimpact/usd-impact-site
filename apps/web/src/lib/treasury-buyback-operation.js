import { isCalendarDate } from './publication-calendar.js';

export const TREASURY_BUYBACK_OPERATION_SCHEMA_VERSION = 'treasury-buyback-operation/fiscaldata-v0';
export const TREASURY_BUYBACK_OPERATIONS_ENDPOINT = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/buybacks_operations';

export const TREASURY_BUYBACK_OPERATION_FIELDS = Object.freeze([
  'operation_date',
  'operation_start_time_est',
  'operation_close_time_est',
  'settlement_date',
  'preliminary_ann_pdf',
  'preliminary_ann_xml',
  'final_ann_pdf',
  'final_ann_xml',
  'results_pdf',
  'results_xml',
  'special_ann_pdf',
  'operation_type',
  'security_type',
  'maturity_bucket',
  'nbr_issues_accepted',
  'total_par_amt_offered',
  'par_amt_per_offer',
  'max_par_amt_redeemed',
  'max_nbr_offers',
  'nbr_issues_eligible',
  'total_par_amt_accepted',
]);

export class TreasuryBuybackOperationHold extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TreasuryBuybackOperationHold';
    this.code = code;
  }
}

const hold = (code, message) => { throw new TreasuryBuybackOperationHold(code, message); };
const NULLISH = new Set(['', 'null']);
const TIME_PATTERN = /^(0[1-9]|1[0-2]):([0-5]\d) (AM|PM)$/;
const MONEY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const INTEGER_PATTERN = /^(?:0|[1-9]\d*)$/;
const ARTIFACT_PATTERN = /^(BBPA|BBA|BBR)_(20\d{12})\.(pdf|xml)$/;

function requirePlainObject(value, code = 'HOLD_TREASURY_BUYBACK_SCHEMA') {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) hold(code, 'A bounded plain-object Treasury buyback record is required.');
  return value;
}

function boundedString(value, field, { nullable = false, max = 200 } = {}) {
  if (typeof value !== 'string' || value.length > max) hold('HOLD_TREASURY_BUYBACK_SCHEMA', `Treasury buyback ${field} must be a bounded string.`);
  if (!nullable && NULLISH.has(value.trim().toLowerCase())) hold('HOLD_TREASURY_BUYBACK_SCHEMA', `Treasury buyback ${field} is required.`);
  return value.trim();
}

function clockMinutes(value, field) {
  const text = boundedString(value, field, { max: 8 });
  const match = text.match(TIME_PATTERN);
  if (!match) hold('HOLD_TREASURY_BUYBACK_TIME', `Treasury buyback ${field} uses an unsupported clock format.`);
  let hour = Number(match[1]) % 12;
  if (match[3] === 'PM') hour += 12;
  return hour * 60 + Number(match[2]);
}

function decimal(value, field, { integer = false } = {}) {
  const text = boundedString(value, field, { max: 40 });
  const pattern = integer ? INTEGER_PATTERN : MONEY_PATTERN;
  if (!pattern.test(text)) hold('HOLD_TREASURY_BUYBACK_SCHEMA', `Treasury buyback ${field} is not a canonical non-negative number.`);
  return text;
}

function optionalArtifact(value, field, expectedPrefix) {
  const text = boundedString(value, field, { nullable: true, max: 96 });
  if (NULLISH.has(text.toLowerCase())) return null;
  const match = text.match(ARTIFACT_PATTERN);
  if (!match || match[1] !== expectedPrefix) hold('HOLD_TREASURY_BUYBACK_ARTIFACT', `Treasury buyback ${field} is not an expected first-party artifact filename.`);
  return Object.freeze({ filename: text, prefix: match[1], operationStamp: match[2], format: match[3] });
}

function requireArtifactPair(row, pdfField, xmlField, prefix) {
  const pdf = optionalArtifact(row[pdfField], pdfField, prefix);
  const xml = optionalArtifact(row[xmlField], xmlField, prefix);
  if ((pdf === null) !== (xml === null)) hold('HOLD_TREASURY_BUYBACK_ARTIFACT', `Treasury buyback ${prefix} PDF/XML evidence must be present as a pair.`);
  if (pdf && pdf.operationStamp !== xml.operationStamp) hold('HOLD_TREASURY_BUYBACK_ARTIFACT', `Treasury buyback ${prefix} PDF/XML operation stamps disagree.`);
  return Object.freeze({ pdf, xml });
}

function operationStampDate(stamp) {
  return `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
}

/**
 * Dormant parser for a completed FiscalData Treasury buyback operation row.
 *
 * This is not a publication-calendar adapter and cannot authorize a preview,
 * outcome, release, admission or serving decision. In particular, artifact
 * filename timestamps identify the operation family only; they are never
 * interpreted here as announcement or results-publication timestamps.
 */
export function normalizeTreasuryBuybackOperationRow(value) {
  const row = requirePlainObject(value);
  const keys = Object.keys(row).sort();
  const expected = [...TREASURY_BUYBACK_OPERATION_FIELDS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    hold('HOLD_TREASURY_BUYBACK_SCHEMA', 'Treasury buyback FiscalData row schema changed or is incomplete.');
  }

  const operationDate = boundedString(row.operation_date, 'operation_date', { max: 10 });
  const settlementDate = boundedString(row.settlement_date, 'settlement_date', { max: 10 });
  if (!isCalendarDate(operationDate) || !isCalendarDate(settlementDate) || settlementDate < operationDate) {
    hold('HOLD_TREASURY_BUYBACK_DATE', 'Treasury buyback operation/settlement dates are invalid or reversed.');
  }

  const startMinutes = clockMinutes(row.operation_start_time_est, 'operation_start_time_est');
  const closeMinutes = clockMinutes(row.operation_close_time_est, 'operation_close_time_est');
  if (closeMinutes <= startMinutes || closeMinutes - startMinutes > 180) {
    hold('HOLD_TREASURY_BUYBACK_TIME', 'Treasury buyback operation window is invalid or unbounded.');
  }

  const preliminary = requireArtifactPair(row, 'preliminary_ann_pdf', 'preliminary_ann_xml', 'BBPA');
  const final = requireArtifactPair(row, 'final_ann_pdf', 'final_ann_xml', 'BBA');
  const results = requireArtifactPair(row, 'results_pdf', 'results_xml', 'BBR');
  if (!preliminary.pdf || !final.pdf || !results.pdf) {
    hold('HOLD_TREASURY_BUYBACK_INCOMPLETE', 'Completed Treasury buyback normalization requires preliminary, final and results artifacts.');
  }
  const operationStamp = preliminary.pdf.operationStamp;
  if (final.pdf.operationStamp !== operationStamp || results.pdf.operationStamp !== operationStamp) {
    hold('HOLD_TREASURY_BUYBACK_ARTIFACT', 'Treasury buyback preliminary/final/results artifacts do not identify one operation.');
  }
  if (operationStampDate(operationStamp) !== operationDate) {
    hold('HOLD_TREASURY_BUYBACK_IDENTITY', 'Treasury buyback artifact operation date disagrees with the FiscalData row.');
  }

  const specialAnnouncement = boundedString(row.special_ann_pdf, 'special_ann_pdf', { nullable: true, max: 160 });
  if (!NULLISH.has(specialAnnouncement.toLowerCase()) && !/^https:\/\/(?:home\.treasury\.gov|www\.treasurydirect\.gov|treasurydirect\.gov)\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$/.test(specialAnnouncement)
      && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,158}\.pdf$/.test(specialAnnouncement)) {
    hold('HOLD_TREASURY_BUYBACK_ARTIFACT', 'Treasury buyback special announcement reference is malformed.');
  }

  const numeric = Object.freeze({
    numberIssuesAccepted: decimal(row.nbr_issues_accepted, 'nbr_issues_accepted', { integer: true }),
    totalParAmountOffered: decimal(row.total_par_amt_offered, 'total_par_amt_offered'),
    parAmountPerOffer: decimal(row.par_amt_per_offer, 'par_amt_per_offer'),
    maxParAmountRedeemed: decimal(row.max_par_amt_redeemed, 'max_par_amt_redeemed'),
    maxNumberOffers: decimal(row.max_nbr_offers, 'max_nbr_offers', { integer: true }),
    numberIssuesEligible: decimal(row.nbr_issues_eligible, 'nbr_issues_eligible', { integer: true }),
    totalParAmountAccepted: decimal(row.total_par_amt_accepted, 'total_par_amt_accepted'),
  });
  if (BigInt(numeric.numberIssuesAccepted) > BigInt(numeric.numberIssuesEligible)) {
    hold('HOLD_TREASURY_BUYBACK_RESULT', 'Treasury buyback accepted-issue count exceeds eligible issues.');
  }
  if (Number(numeric.totalParAmountAccepted) > Number(numeric.totalParAmountOffered)
      || Number(numeric.totalParAmountAccepted) > Number(numeric.maxParAmountRedeemed)) {
    hold('HOLD_TREASURY_BUYBACK_RESULT', 'Treasury buyback accepted par amount exceeds an official operation bound.');
  }

  const operationType = boundedString(row.operation_type, 'operation_type', { max: 80 });
  const securityType = boundedString(row.security_type, 'security_type', { max: 80 });
  const maturityBucket = boundedString(row.maturity_bucket, 'maturity_bucket', { max: 80 });
  const identity = `TREASURY:BUYBACK:${operationDate}:${operationStamp}:${operationType}:${securityType}:${maturityBucket}`;

  return Object.freeze({
    schemaVersion: TREASURY_BUYBACK_OPERATION_SCHEMA_VERSION,
    sourceEndpoint: TREASURY_BUYBACK_OPERATIONS_ENDPOINT,
    identity,
    operationDate,
    settlementDate,
    operationStartTimeText: boundedString(row.operation_start_time_est, 'operation_start_time_est', { max: 8 }),
    operationCloseTimeText: boundedString(row.operation_close_time_est, 'operation_close_time_est', { max: 8 }),
    operationType,
    securityType,
    maturityBucket,
    numeric,
    artifacts: Object.freeze({
      preliminary,
      final,
      results,
      specialAnnouncement: NULLISH.has(specialAnnouncement.toLowerCase()) ? null : specialAnnouncement,
    }),
    announcementAt: null,
    resultsPublishedAt: null,
    freshSourceVerified: false,
    publicationAuthorized: false,
    enforcementActive: false,
  });
}

export function normalizeTreasuryBuybackOperationResponse(value, { maxRows = 50 } = {}) {
  const response = requirePlainObject(value);
  if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 100) hold('HOLD_TREASURY_BUYBACK_SCHEMA', 'Treasury buyback response bound must be 1-100 rows.');
  if (!Array.isArray(response.data) || response.data.length > maxRows) hold('HOLD_TREASURY_BUYBACK_SCHEMA', 'Treasury buyback response data is missing or exceeds the parser bound.');
  const operations = response.data.map(normalizeTreasuryBuybackOperationRow);
  const identities = new Set();
  for (const operation of operations) {
    if (identities.has(operation.identity)) hold('HOLD_TREASURY_BUYBACK_DUPLICATE', 'Duplicate Treasury buyback operation identity requires source review.');
    identities.add(operation.identity);
  }
  return Object.freeze({
    schemaVersion: TREASURY_BUYBACK_OPERATION_SCHEMA_VERSION,
    sourceEndpoint: TREASURY_BUYBACK_OPERATIONS_ENDPOINT,
    operationCount: operations.length,
    operations: Object.freeze(operations),
    freshSourceVerified: false,
    publicationAuthorized: false,
    enforcementActive: false,
  });
}
