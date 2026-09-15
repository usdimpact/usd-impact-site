import { createHash } from 'node:crypto';
import {
  TREASURY_BUYBACK_OPERATION_FIELDS,
  TREASURY_BUYBACK_OPERATION_SCHEMA_VERSION,
  TREASURY_BUYBACK_OPERATIONS_ENDPOINT,
  normalizeTreasuryBuybackOperationResponse,
} from './treasury-buyback-operation.js';
import {
  TREASURY_BUYBACK_XML_SCHEMA_VERSION,
  parseTreasuryBuybackXmlEnvelope,
  verifyTreasuryBuybackXmlSet,
} from './treasury-buyback-xml.js';
import {
  canonicalPublicationEventIdentity,
  publicationEventDescriptor,
} from './publication-event-registry.js';

export const TREASURY_BUYBACK_VERIFIER_VERSION = 'treasury-buyback-verifier/v1';
export const TREASURY_BUYBACK_EVIDENCE_MAX_AGE_MS = 15 * 60 * 1000;
export const TREASURY_BUYBACK_SOURCE_MAX_BYTES = 1_048_576;
const SOURCE_TIMEOUT_MS = 8_000;
const CANDIDATE_FIELDS = Object.freeze([
  'publisher', 'series', 'operationDate', 'operationIdentity', 'releaseStage', 'phase',
]);

export class TreasuryBuybackVerifierHold extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TreasuryBuybackVerifierHold';
    this.code = code;
  }
}

const hold = (code, message) => { throw new TreasuryBuybackVerifierHold(code, message); };
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function realDate(value) {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeCandidate(value) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) {
    hold('HOLD_TREASURY_BUYBACK_CANDIDATE', 'A bounded plain-object Treasury buyback candidate is required.');
  }
  const keys = Object.keys(value).sort();
  const expected = [...CANDIDATE_FIELDS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    hold('HOLD_TREASURY_BUYBACK_CANDIDATE', 'Treasury buyback verifier candidate schema changed or is incomplete.');
  }
  const descriptor = publicationEventDescriptor(value.publisher, value.series);
  if (!descriptor || descriptor.family !== 'TREASURY_BUYBACK' || descriptor.verification.enabled !== false) {
    hold('HOLD_TREASURY_BUYBACK_CANDIDATE', 'Treasury buyback must remain a recognized but disabled calendar family in verifier v1.');
  }
  if (value.releaseStage !== 'operation' || !descriptor.releaseStages.includes(value.releaseStage)) {
    hold('HOLD_TREASURY_BUYBACK_CANDIDATE', 'Treasury buyback verifier v1 supports only the operation release stage.');
  }
  if (!realDate(value.operationDate)) {
    hold('HOLD_TREASURY_BUYBACK_CANDIDATE', 'Treasury buyback operationDate must be a real YYYY-MM-DD date.');
  }
  if (typeof value.operationIdentity !== 'string' || value.operationIdentity.length > 500
      || !value.operationIdentity.startsWith(`TREASURY:BUYBACK:${value.operationDate}:`)
      || /[^\x20-\x7e]/.test(value.operationIdentity)) {
    hold('HOLD_TREASURY_BUYBACK_CANDIDATE', 'Treasury buyback operationIdentity is missing, unbounded or inconsistent with operationDate.');
  }
  if (!['preview', 'outcome'].includes(value.phase)) {
    hold('HOLD_TREASURY_BUYBACK_CANDIDATE', 'Treasury buyback phase must be preview or outcome.');
  }
  const eventIdentity = canonicalPublicationEventIdentity(value, descriptor);
  if (!eventIdentity) hold('HOLD_TREASURY_BUYBACK_CANDIDATE', 'Treasury buyback canonical event identity could not be constructed.');
  return Object.freeze({ ...Object.fromEntries(CANDIDATE_FIELDS.map((field) => [field, value[field]])), eventIdentity });
}

function monotonicClock(now) {
  if (typeof now !== 'function') hold('HOLD_INVALID_CLOCK', 'Trusted current time is unavailable.');
  let previous = null;
  return () => {
    const current = now();
    if (!Number.isFinite(current) || (previous !== null && current < previous)) {
      hold('HOLD_INVALID_CLOCK', 'Trusted current time is unavailable or moved backwards.');
    }
    previous = current;
    return current;
  };
}

function operationRequestUrl(operationDate) {
  const url = new URL(TREASURY_BUYBACK_OPERATIONS_ENDPOINT);
  url.searchParams.set('fields', TREASURY_BUYBACK_OPERATION_FIELDS.join(','));
  url.searchParams.set('filter', `operation_date:eq:${operationDate}`);
  url.searchParams.set('page[size]', '50');
  return url.toString();
}

function artifactUrl(operationDate, filename) {
  return `https://www.treasurydirect.gov/instit/annceresult/press/preanre/${operationDate.slice(0, 4)}/${filename}`;
}

function header(response, name) {
  const value = response?.headers?.get?.(name);
  return typeof value === 'string' ? value.trim() : '';
}

async function fetchOfficialText({ url, role, mediaTypes, fetchImpl, clock }) {
  if (typeof fetchImpl !== 'function') hold('HOLD_TREASURY_BUYBACK_SOURCE_UNAVAILABLE', 'Official-source fetch is unavailable.');
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
      headers: { accept: [...mediaTypes].join(', ') },
    });
  } catch (error) {
    if (error instanceof TreasuryBuybackVerifierHold) throw error;
    hold('HOLD_TREASURY_BUYBACK_SOURCE_UNAVAILABLE', `Official ${role} source could not be fetched.`);
  }
  if (!response || response.status !== 200 || typeof response.text !== 'function') {
    hold('HOLD_TREASURY_BUYBACK_SOURCE_UNAVAILABLE', `Official ${role} source did not return HTTP 200.`);
  }
  if (typeof response.url === 'string' && response.url && response.url !== url) {
    hold('HOLD_TREASURY_BUYBACK_SOURCE_REDIRECT', `Official ${role} source redirected away from its canonical URL.`);
  }
  const length = header(response, 'content-length');
  if (length && (!/^\d+$/.test(length) || BigInt(length) > BigInt(TREASURY_BUYBACK_SOURCE_MAX_BYTES))) {
    hold('HOLD_TREASURY_BUYBACK_SOURCE_TOO_LARGE', `Official ${role} source exceeds the verifier byte bound.`);
  }
  const contentType = header(response, 'content-type').split(';', 1)[0].toLowerCase();
  if (contentType && !mediaTypes.has(contentType)) {
    hold('HOLD_TREASURY_BUYBACK_SOURCE_TYPE', `Official ${role} source returned an unexpected content type.`);
  }
  const body = await response.text();
  if (typeof body !== 'string' || Buffer.byteLength(body, 'utf8') < 2
      || Buffer.byteLength(body, 'utf8') > TREASURY_BUYBACK_SOURCE_MAX_BYTES) {
    hold('HOLD_TREASURY_BUYBACK_SOURCE_TOO_LARGE', `Official ${role} source is empty or exceeds the verifier byte bound.`);
  }
  const fetchedAtMs = clock();
  return Object.freeze({
    role,
    url,
    fetchedAt: new Date(fetchedAtMs).toISOString(),
    sha256: sha256(body),
    body,
  });
}

function nyParts(iso) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) hold('HOLD_TREASURY_BUYBACK_CROSS_SOURCE', 'TreasuryDirect operation timestamp is invalid.');
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
  const hour = Number(parts.hour);
  const hour12 = hour % 12 || 12;
  return Object.freeze({
    date: `${parts.year}-${parts.month}-${parts.day}`,
    timeText: `${String(hour12).padStart(2, '0')}:${parts.minute} ${hour >= 12 ? 'PM' : 'AM'}`,
  });
}

function normalizedDecimal(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return null;
  const [integer, fraction = ''] = value.split('.');
  const trimmed = fraction.replace(/0+$/, '');
  return trimmed ? `${integer}.${trimmed}` : integer;
}

function sameDecimal(left, right) {
  const a = normalizedDecimal(left);
  const b = normalizedDecimal(right);
  return a !== null && a === b;
}

function assertDormantParserBoundary(operation, xmlSet) {
  for (const evidence of [operation, xmlSet]) {
    if (evidence?.freshSourceVerified !== false || evidence?.publicationAuthorized !== false || evidence?.enforcementActive !== false) {
      hold('HOLD_TREASURY_BUYBACK_CROSS_SOURCE', 'A dormant Treasury parser crossed its non-authorizing boundary.');
    }
  }
}

function assertCrossSource(candidate, operation, xmlSet, xmlEvidence) {
  if (operation.schemaVersion !== TREASURY_BUYBACK_OPERATION_SCHEMA_VERSION
      || xmlSet.schemaVersion !== TREASURY_BUYBACK_XML_SCHEMA_VERSION
      || operation.identity !== candidate.operationIdentity
      || operation.operationDate !== candidate.operationDate) {
    hold('HOLD_TREASURY_BUYBACK_IDENTITY', 'FiscalData operation identity does not match the canonical Treasury candidate.');
  }
  const operationStamp = operation.artifacts.preliminary.xml.operationStamp;
  if (operation.artifacts.final.xml.operationStamp !== operationStamp
      || operation.artifacts.results.xml.operationStamp !== operationStamp
      || xmlSet.operationStamp !== operationStamp) {
    hold('HOLD_TREASURY_BUYBACK_CROSS_SOURCE', 'FiscalData and TreasuryDirect operation stamps disagree.');
  }
  const start = nyParts(xmlSet.operationStartAt);
  const close = nyParts(xmlSet.operationCloseAt);
  if (start.date !== candidate.operationDate || close.date !== candidate.operationDate
      || start.timeText !== operation.operationStartTimeText || close.timeText !== operation.operationCloseTimeText) {
    hold('HOLD_TREASURY_BUYBACK_CROSS_SOURCE', 'FiscalData and TreasuryDirect operation date/time fields disagree.');
  }
  if (!sameDecimal(operation.numeric.numberIssuesAccepted, xmlEvidence.results.numberIssuesAccepted)
      || !sameDecimal(operation.numeric.totalParAmountOffered, xmlEvidence.results.totalParAmountOffered)
      || !sameDecimal(operation.numeric.totalParAmountAccepted, xmlEvidence.results.totalParAmountAccepted)) {
    hold('HOLD_TREASURY_BUYBACK_CROSS_SOURCE', 'FiscalData and TreasuryDirect results totals disagree.');
  }
  if (!sameDecimal(operation.numeric.maxParAmountRedeemed, xmlEvidence.preliminary.maxParAmountRedeemed)
      || !sameDecimal(operation.numeric.numberIssuesEligible, xmlEvidence.preliminary.numberIssuesEligible)) {
    hold('HOLD_TREASURY_BUYBACK_CROSS_SOURCE', 'FiscalData and TreasuryDirect preliminary operation bounds disagree.');
  }
}

/**
 * Dormant Treasury buyback evidence verifier.
 *
 * v1 deliberately does not authorize calendar publication. The currently
 * reviewed FiscalData source models completed operations, so preview requests
 * HOLD before any network request. Outcome evidence can PASS only after the
 * operation close when one exact completed FiscalData row and its matching
 * TreasuryDirect BBPA/BBA/BBR XML artifacts are freshly fetched and agree.
 * A PASS here means evidence consistency only; publicationAuthorized and
 * enforcementActive remain false.
 */
export async function verifyTreasuryBuybackEvidence(value, { now = Date.now, fetchImpl = globalThis.fetch } = {}) {
  let candidate = null;
  let checkedAt = null;
  const sources = [];
  try {
    const clock = monotonicClock(now);
    const began = clock();
    checkedAt = new Date(began).toISOString();
    candidate = normalizeCandidate(value);
    if (candidate.phase === 'preview') {
      hold('HOLD_TREASURY_BUYBACK_PREVIEW_UNVERIFIED', 'Verifier v1 cannot use a completed-operation FiscalData row to certify a future Treasury buyback preview.');
    }

    const fiscalSource = await fetchOfficialText({
      url: operationRequestUrl(candidate.operationDate),
      role: 'fiscaldata-operation',
      mediaTypes: new Set(['application/json']),
      fetchImpl,
      clock,
    });
    sources.push(fiscalSource);
    let fiscalJson;
    try { fiscalJson = JSON.parse(fiscalSource.body); } catch {
      hold('HOLD_TREASURY_BUYBACK_SOURCE_SCHEMA', 'FiscalData buyback response is not valid JSON.');
    }
    const normalized = normalizeTreasuryBuybackOperationResponse(fiscalJson);
    const matches = normalized.operations.filter((operation) => operation.identity === candidate.operationIdentity);
    if (matches.length !== 1) hold('HOLD_TREASURY_BUYBACK_IDENTITY', 'FiscalData did not return exactly one canonical Treasury buyback operation.');
    const operation = matches[0];

    const xmlEvidence = {};
    for (const [name, role] of [['preliminary', 'treasurydirect-preliminary'], ['final', 'treasurydirect-final'], ['results', 'treasurydirect-results']]) {
      const filename = operation.artifacts[name].xml.filename;
      const source = await fetchOfficialText({
        url: artifactUrl(candidate.operationDate, filename),
        role,
        mediaTypes: new Set(['application/xml', 'text/xml']),
        fetchImpl,
        clock,
      });
      sources.push(source);
      xmlEvidence[name] = parseTreasuryBuybackXmlEnvelope({ sourceUrl: source.url, xml: source.body });
    }
    const xmlSet = verifyTreasuryBuybackXmlSet(xmlEvidence);
    assertDormantParserBoundary(operation, xmlSet);
    assertCrossSource(candidate, operation, xmlSet, xmlEvidence);

    const checked = clock();
    checkedAt = new Date(checked).toISOString();
    if (checked < Date.parse(xmlSet.operationCloseAt)) {
      hold('HOLD_TREASURY_BUYBACK_OUTCOME_NOT_RELEASED', 'A Treasury buyback outcome requires fresh matching results evidence after the official operation close.');
    }
    for (const source of sources) {
      const fetched = Date.parse(source.fetchedAt);
      if (checked < fetched || checked >= fetched + TREASURY_BUYBACK_EVIDENCE_MAX_AGE_MS) {
        hold('HOLD_EVIDENCE_STALE', 'Treasury buyback primary evidence exceeded its bounded validity window.');
      }
    }
    const validUntilMs = Math.min(...sources.map((source) => Date.parse(source.fetchedAt) + TREASURY_BUYBACK_EVIDENCE_MAX_AGE_MS));
    const publicSources = Object.freeze(sources.map(({ body, ...source }) => Object.freeze({ ...source, adapterVersion: TREASURY_BUYBACK_VERIFIER_VERSION })));
    return Object.freeze({
      verifierVersion: TREASURY_BUYBACK_VERIFIER_VERSION,
      decision: 'PASS',
      reason: 'Fresh matching FiscalData operation and TreasuryDirect results evidence agree.',
      checkedAt,
      validUntil: new Date(validUntilMs).toISOString(),
      eventIdentity: candidate.eventIdentity,
      operationIdentity: operation.identity,
      operationDate: operation.operationDate,
      operationStartAt: xmlSet.operationStartAt,
      operationCloseAt: xmlSet.operationCloseAt,
      resultsPublishedAt: null,
      sources: publicSources,
      publicationAttempted: false,
      publicationAuthorized: false,
      enforcementActive: false,
    });
  } catch (error) {
    const decision = typeof error?.code === 'string' && error.code.startsWith('HOLD_') ? error.code : 'HOLD_TREASURY_BUYBACK_INTERNAL';
    return Object.freeze({
      verifierVersion: TREASURY_BUYBACK_VERIFIER_VERSION,
      decision,
      reason: decision === 'HOLD_TREASURY_BUYBACK_INTERNAL' ? 'Treasury buyback evidence verification could not complete.' : error.message,
      checkedAt,
      validUntil: null,
      eventIdentity: candidate?.eventIdentity ?? null,
      sources: Object.freeze(sources.map(({ body, ...source }) => Object.freeze({ ...source, adapterVersion: TREASURY_BUYBACK_VERIFIER_VERSION }))),
      publicationAttempted: false,
      publicationAuthorized: false,
      enforcementActive: false,
    });
  }
}
