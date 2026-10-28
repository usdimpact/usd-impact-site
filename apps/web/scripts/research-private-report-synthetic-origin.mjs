// SYNTHETIC DEVELOPMENT CONTRACT ONLY. No runtime imports, Supabase client,
// Vercel endpoint, network fallback, real secrets, production data or publishing.
import { createHash } from 'node:crypto';
import {
  isSyntheticApprovedReportAsset,
  parseSyntheticPrivateReportPath,
  SYNTHETIC_RESEARCH_PRODUCT_ID,
  SYNTHETIC_REPORT_BODY_PREFIX,
} from './research-private-report-synthetic-contract.mjs';

export const SYNTHETIC_PRIVATE_ORIGIN = 'https://research-assets.invalid';
const SYNTHETIC_TABLE = '/rest/v1/research_private_report_assets';
const SHA40 = /^[a-f0-9]{40}$/;
const MAX_BYTES = 10_000;
const BODY_FORBIDDEN = /<\s*(?:script|iframe|object|form|embed)\b|https?:\/\/|(?:src|href)\s*=/i;

// Fixed, minimal projection. Never SELECT * or provider/customer identifiers.
const COLUMNS = Object.freeze([
  'syntheticFixture', 'productId', 'reportType', 'periodEnd',
  'rightsApproval', 'approvedForMemberDelivery', 'rightsScope',
  'originPublic', 'privateObjectUrl', 'providerSourceUrl',
  'sourceCommit', 'contentType', 'body', 'bodySha256',
]);

function safeReportKey({ reportType, periodEnd, productId } = {}) {
  if (productId !== SYNTHETIC_RESEARCH_PRODUCT_ID ||
      typeof reportType !== 'string' || typeof periodEnd !== 'string') {
    return null;
  }
  const parsed = parseSyntheticPrivateReportPath(
    '/research/member/reports/' + reportType + '/' + periodEnd,
  );
  if (!parsed || parsed.reportType !== reportType || parsed.periodEnd !== periodEnd) return null;
  return parsed;
}

export function createSyntheticPrivateReportArtifact({
  reportType, periodEnd, body, sourceCommit,
} = {}) {
  if (!safeReportKey({ reportType, periodEnd, productId: SYNTHETIC_RESEARCH_PRODUCT_ID }) ||
      !SHA40.test(sourceCommit || '') ||
      typeof body !== 'string' ||
      !body.startsWith(SYNTHETIC_REPORT_BODY_PREFIX) ||
      Buffer.byteLength(body, 'utf8') > MAX_BYTES ||
      BODY_FORBIDDEN.test(body)) {
    throw new TypeError('Invalid synthetic report artifact');
  }
  const asset = {
    syntheticFixture: true,
    productId: SYNTHETIC_RESEARCH_PRODUCT_ID,
    reportType,
    periodEnd,
    rightsApproval: 'synthetic-test-only-not-legal-approval',
    approvedForMemberDelivery: true,
    rightsScope: 'member',
    originPublic: false,
    privateObjectUrl: null,
    providerSourceUrl: null,
    sourceCommit,
    contentType: 'text/html; charset=utf-8',
    body,
    bodySha256: createHash('sha256').update(body, 'utf8').digest('hex'),
  };
  if (!isSyntheticApprovedReportAsset(asset, reportType, periodEnd)) {
    throw new TypeError('Synthetic artifact contract failed');
  }
  return Object.freeze(asset);
}

function strictSyntheticRow(row, key) {
  if (!row || Array.isArray(row) || typeof row !== 'object') {
    throw new Error('Synthetic private origin returned invalid artifact');
  }
  const keys = Object.keys(row).sort();
  if (keys.length !== COLUMNS.length ||
      keys.some((name, index) => name !== [...COLUMNS].sort()[index])) {
    throw new Error('Synthetic private origin returned unapproved fields');
  }
  if (!isSyntheticApprovedReportAsset(row, key.reportType, key.periodEnd)) {
    throw new Error('Synthetic private origin returned unapproved artifact');
  }
  return Object.freeze({ ...row });
}

export function createSyntheticPrivateOriginAdapter({
  environment,
  mode,
  fetchImpl,
} = {}) {
  // No real endpoint or client can be configured. The .invalid TLD and
  // required injected mock keep this contract isolated from Supabase.
  if (environment?.VERCEL_ENV !== 'development' ||
      process.env.VERCEL_ENV === 'production' ||
      mode !== 'synthetic-rehearsal' ||
      typeof fetchImpl !== 'function' ||
      fetchImpl === globalThis.fetch) {
    throw new TypeError('Development synthetic mock is required');
  }
  return Object.freeze({
    async read(input) {
      const key = safeReportKey(input);
      if (!key) throw new TypeError('Invalid synthetic report lookup');
      const url = new URL(SYNTHETIC_TABLE, SYNTHETIC_PRIVATE_ORIGIN);
      url.searchParams.set('report_type', 'eq.' + key.reportType);
      url.searchParams.set('period_end', 'eq.' + key.periodEnd);
      url.searchParams.set('product_id', 'eq.' + SYNTHETIC_RESEARCH_PRODUCT_ID);
      url.searchParams.set('select', COLUMNS.join(','));
      url.searchParams.set('limit', '2'); // A duplicate result is a hard error.
      const options = {
        method: 'GET',
        redirect: 'error',
        cache: 'no-store',
        credentials: 'omit',
        headers: Object.freeze({
          Accept: 'application/json',
          'Cache-Control': 'no-store',
          'X-Research-Synthetic-Only': 'true',
        }),
      };
      let response;
      try {
        response = await fetchImpl(url, options);
      } catch {
        throw new Error('Synthetic private origin unavailable');
      }
      if (!response || response.ok !== true || response.status !== 200) {
        throw new Error('Synthetic private origin unavailable');
      }
      const contentType = response.headers?.get?.('content-type') || '';
      if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
        throw new Error('Synthetic private origin unexpected media type');
      }
      let rows;
      try { rows = await response.json(); }
      catch { throw new Error('Synthetic private origin malformed JSON'); }
      if (!Array.isArray(rows) || rows.length > 1) {
        throw new Error('Synthetic private origin invalid cardinality');
      }
      if (rows.length === 0) return null;
      return strictSyntheticRow(rows[0], key);
    },
  });
}
