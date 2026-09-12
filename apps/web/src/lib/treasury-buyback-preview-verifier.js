import { createHash } from 'node:crypto';
import { parseTreasuryBuybackXmlEnvelope } from './treasury-buyback-xml.js';

export const TREASURY_BUYBACK_PREVIEW_VERIFIER_VERSION = 'treasury-buyback-preview-verifier/v1';
export const TREASURY_BUYBACK_PREVIEW_EVIDENCE_MAX_AGE_MS = 15 * 60 * 1000;
export const TREASURY_BUYBACK_PREVIEW_SOURCE_MAX_BYTES = 1_048_576;
const SOURCE_TIMEOUT_MS = 8_000;
const CANDIDATE_FIELDS = Object.freeze(['publisher', 'series', 'operationDate', 'phase', 'preliminaryUrl']);
const PRELIMINARY_PATH = /^\/instit\/annceresult\/press\/preanre\/(20\d{2})\/BBPA_(20\d{12})\.xml$/;
const MODERN_OPERATION_STATUSES = new Set(['Released', 'Extended', 'Cancelled']);

export class TreasuryBuybackPreviewVerifierHold extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TreasuryBuybackPreviewVerifierHold';
    this.code = code;
  }
}

const hold = (code, message) => { throw new TreasuryBuybackPreviewVerifierHold(code, message); };
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function realDate(value) {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function canonicalPreliminaryUrl(value) {
  if (typeof value !== 'string' || value.length > 400) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_URL', 'A bounded TreasuryDirect preliminary XML URL is required.');
  }
  let url;
  try { url = new URL(value); } catch {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_URL', 'TreasuryDirect preliminary XML URL is malformed.');
  }
  if (url.protocol !== 'https:' || url.hostname !== 'www.treasurydirect.gov' || url.port
      || url.username || url.password || url.search || url.hash) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_URL', 'TreasuryDirect preliminary XML URL must use the reviewed HTTPS origin and canonical path only.');
  }
  const match = url.pathname.match(PRELIMINARY_PATH);
  if (!match || match[1] !== match[2].slice(0, 4)) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_URL', 'TreasuryDirect preliminary XML URL does not match the reviewed buyback artifact path.');
  }
  return Object.freeze({ url: url.toString(), year: match[1], operationStamp: match[2] });
}

function normalizeCandidate(value) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_CANDIDATE', 'A bounded plain-object Treasury buyback preview candidate is required.');
  }
  const keys = Object.keys(value).sort();
  const expected = [...CANDIDATE_FIELDS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_CANDIDATE', 'Treasury buyback preview candidate schema changed or is incomplete.');
  }
  if (value.publisher !== 'TREASURY' || value.series !== 'BUYBACK' || value.phase !== 'preview' || !realDate(value.operationDate)) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_CANDIDATE', 'Treasury buyback preview candidate identity is invalid.');
  }
  const preliminary = canonicalPreliminaryUrl(value.preliminaryUrl);
  return Object.freeze({ ...value, preliminary });
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

function header(response, name) {
  const value = response?.headers?.get?.(name);
  return typeof value === 'string' ? value.trim() : '';
}

async function fetchXml({ url, role, allowNotFound = false, fetchImpl, clock }) {
  if (typeof fetchImpl !== 'function') hold('HOLD_TREASURY_BUYBACK_PREVIEW_SOURCE_UNAVAILABLE', 'Official-source fetch is unavailable.');
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
      headers: { accept: 'application/xml, text/xml' },
    });
  } catch (error) {
    if (error instanceof TreasuryBuybackPreviewVerifierHold) throw error;
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_SOURCE_UNAVAILABLE', `Official ${role} source could not be fetched.`);
  }
  const fetchedAtMs = clock();
  if (!response || !Number.isInteger(response.status)) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_SOURCE_UNAVAILABLE', `Official ${role} source returned an invalid response.`);
  }
  if (typeof response.url === 'string' && response.url && response.url !== url) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_SOURCE_REDIRECT', `Official ${role} source redirected away from its canonical URL.`);
  }
  if (allowNotFound && response.status === 404) {
    return Object.freeze({ found: false, role, url, status: 404, fetchedAt: new Date(fetchedAtMs).toISOString() });
  }
  if (response.status !== 200 || typeof response.text !== 'function') {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_SOURCE_UNAVAILABLE', `Official ${role} source did not return HTTP 200.`);
  }
  const length = header(response, 'content-length');
  if (length && (!/^\d+$/.test(length) || BigInt(length) > BigInt(TREASURY_BUYBACK_PREVIEW_SOURCE_MAX_BYTES))) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_SOURCE_TOO_LARGE', `Official ${role} source exceeds the verifier byte bound.`);
  }
  const contentType = header(response, 'content-type').split(';', 1)[0].toLowerCase();
  if (contentType && !new Set(['application/xml', 'text/xml']).has(contentType)) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_SOURCE_TYPE', `Official ${role} source returned an unexpected content type.`);
  }
  const body = await response.text();
  const bytes = typeof body === 'string' ? Buffer.byteLength(body, 'utf8') : 0;
  if (bytes < 16 || bytes > TREASURY_BUYBACK_PREVIEW_SOURCE_MAX_BYTES) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_SOURCE_TOO_LARGE', `Official ${role} source is empty or exceeds the verifier byte bound.`);
  }
  return Object.freeze({
    found: true,
    role,
    url,
    status: 200,
    fetchedAt: new Date(fetchedAtMs).toISOString(),
    sha256: sha256(body),
    body,
  });
}

function announcementOperationStatus(xml) {
  const matches = [...xml.matchAll(/<operationStatus>([\s\S]*?)<\/operationStatus>/g)];
  if (matches.length !== 1) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_SCHEMA', 'Modern Treasury buyback announcement requires exactly one operationStatus.');
  }
  const value = matches[0][1].trim();
  if (!value || value.length > 40 || /[<>&]/.test(value) || !MODERN_OPERATION_STATUSES.has(value)) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_SCHEMA', 'Treasury buyback operationStatus is missing, malformed or unsupported.');
  }
  if (value === 'Cancelled') hold('HOLD_TREASURY_BUYBACK_CANCELLED', 'Treasury marks the buyback operation as cancelled.');
  if (value === 'Extended') hold('HOLD_TREASURY_BUYBACK_EXTENDED', 'Treasury marks the buyback operation as extended and requires separate review.');
  return value;
}

function nyDate(iso) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) hold('HOLD_TREASURY_BUYBACK_PREVIEW_CROSS_SOURCE', 'TreasuryDirect operation timestamp is invalid.');
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function assertPreliminary(candidate, envelope, status) {
  if (envelope.artifactKind !== 'BBPA' || envelope.announcementType !== 'Preliminary' || status !== 'Released'
      || envelope.operationStamp !== candidate.preliminary.operationStamp
      || nyDate(envelope.operationStartAt) !== candidate.operationDate) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_IDENTITY', 'Treasury preliminary announcement does not match the requested operation date and artifact identity.');
  }
  if (envelope.publicationAuthorized !== false || envelope.enforcementActive !== false || envelope.freshSourceVerified !== false) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_CROSS_SOURCE', 'Treasury parser crossed its dormant non-authorizing boundary.');
  }
}

function assertFinal(preliminary, final, status) {
  if (final.artifactKind !== 'BBA' || final.announcementType !== 'Final' || status !== 'Released') {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_IDENTITY', 'Treasury final announcement does not match the modern final-announcement contract.');
  }
  if (final.operationStamp !== preliminary.operationStamp
      || final.operationStartAt !== preliminary.operationStartAt
      || final.operationCloseAt !== preliminary.operationCloseAt) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_CROSS_SOURCE', 'Treasury preliminary and final announcements do not identify the same operation.');
  }
  if (final.publicationAuthorized !== false || final.enforcementActive !== false || final.freshSourceVerified !== false) {
    hold('HOLD_TREASURY_BUYBACK_PREVIEW_CROSS_SOURCE', 'Treasury parser crossed its dormant non-authorizing boundary.');
  }
}

function publicSource(source) {
  const { body, found, ...publicFields } = source;
  return Object.freeze({ ...publicFields, adapterVersion: TREASURY_BUYBACK_PREVIEW_VERIFIER_VERSION });
}

export function deriveTreasuryBuybackFinalUrl(preliminaryUrl) {
  const source = canonicalPreliminaryUrl(preliminaryUrl);
  return source.url.replace('/BBPA_', '/BBA_');
}

/**
 * Dormant preview/discovery evidence contract for Treasury buyback operations.
 *
 * The caller must supply one canonical first-party BBPA XML URL discovered by a
 * separately reviewed source. This verifier never guesses a preliminary URL.
 * It validates that announcement and probes only the documented sibling BBA
 * URL for the same operation stamp. A 404 is a point-in-time absence probe,
 * not a durable assertion that a final announcement does not exist.
 *
 * PASS means fresh first-party announcement evidence is internally consistent.
 * It is not a publication-calendar lease and cannot authorize publication.
 */
export async function verifyTreasuryBuybackPreviewEvidence(value, { now = Date.now, fetchImpl = globalThis.fetch } = {}) {
  let candidate = null;
  let checkedAt = null;
  const sources = [];
  try {
    const clock = monotonicClock(now);
    checkedAt = new Date(clock()).toISOString();
    candidate = normalizeCandidate(value);

    const preliminarySource = await fetchXml({
      url: candidate.preliminary.url,
      role: 'treasurydirect-preliminary',
      fetchImpl,
      clock,
    });
    sources.push(preliminarySource);
    const preliminary = parseTreasuryBuybackXmlEnvelope({ sourceUrl: preliminarySource.url, xml: preliminarySource.body });
    const preliminaryStatus = announcementOperationStatus(preliminarySource.body);
    assertPreliminary(candidate, preliminary, preliminaryStatus);

    let checked = clock();
    checkedAt = new Date(checked).toISOString();
    const preliminaryAnnouncementMs = Date.parse(preliminary.sourceAnnouncementAt);
    const operationStartMs = Date.parse(preliminary.operationStartAt);
    if (checked < preliminaryAnnouncementMs) {
      hold('HOLD_TREASURY_BUYBACK_PREVIEW_NOT_EFFECTIVE', 'Treasury preliminary announcement exists but its source announcement time has not arrived.');
    }
    if (checked >= operationStartMs) {
      hold('HOLD_TREASURY_BUYBACK_PREVIEW_EXPIRED', 'Treasury buyback preview evidence expires at operation start.');
    }

    const finalUrl = deriveTreasuryBuybackFinalUrl(candidate.preliminary.url);
    const finalProbe = await fetchXml({
      url: finalUrl,
      role: 'treasurydirect-final',
      allowNotFound: true,
      fetchImpl,
      clock,
    });

    let announcementStage = 'preliminary';
    let finalAnnouncementAt = null;
    let finalEffective = false;
    if (finalProbe.found) {
      sources.push(finalProbe);
      const final = parseTreasuryBuybackXmlEnvelope({ sourceUrl: finalProbe.url, xml: finalProbe.body });
      const finalStatus = announcementOperationStatus(finalProbe.body);
      assertFinal(preliminary, final, finalStatus);
      finalAnnouncementAt = final.sourceAnnouncementAt;
      checked = clock();
      checkedAt = new Date(checked).toISOString();
      if (checked < Date.parse(finalAnnouncementAt)) {
        hold('HOLD_TREASURY_BUYBACK_FINAL_NOT_EFFECTIVE', 'Treasury final announcement exists but its source announcement time has not arrived.');
      }
      announcementStage = 'final';
      finalEffective = true;
    } else {
      checked = clock();
      checkedAt = new Date(checked).toISOString();
    }

    for (const source of sources) {
      const fetched = Date.parse(source.fetchedAt);
      if (checked < fetched || checked >= fetched + TREASURY_BUYBACK_PREVIEW_EVIDENCE_MAX_AGE_MS) {
        hold('HOLD_EVIDENCE_STALE', 'Treasury buyback preview evidence exceeded its bounded validity window.');
      }
    }
    const freshnessDeadline = Math.min(...sources.map((source) => Date.parse(source.fetchedAt) + TREASURY_BUYBACK_PREVIEW_EVIDENCE_MAX_AGE_MS));
    const validUntilMs = Math.min(freshnessDeadline, operationStartMs);
    if (checked >= validUntilMs) hold('HOLD_EVIDENCE_STALE', 'Treasury buyback preview evidence has no remaining validity window.');

    return Object.freeze({
      verifierVersion: TREASURY_BUYBACK_PREVIEW_VERIFIER_VERSION,
      decision: 'PASS',
      reason: announcementStage === 'final'
        ? 'Fresh matching TreasuryDirect preliminary and final announcement evidence agree.'
        : 'Fresh TreasuryDirect preliminary announcement evidence is valid; the canonical final sibling returned HTTP 404 at this check.',
      checkedAt,
      validUntil: new Date(validUntilMs).toISOString(),
      announcementStage,
      operationDate: candidate.operationDate,
      operationStamp: preliminary.operationStamp,
      operationStartAt: preliminary.operationStartAt,
      operationCloseAt: preliminary.operationCloseAt,
      preliminaryAnnouncementAt: preliminary.sourceAnnouncementAt,
      finalAnnouncementAt,
      finalProbe: Object.freeze({
        url: finalProbe.url,
        status: finalProbe.status,
        checkedAt: finalProbe.fetchedAt,
        effective: finalEffective,
      }),
      sources: Object.freeze(sources.map(publicSource)),
      evidenceVerified: true,
      calendarLease: false,
      publicationAttempted: false,
      publicationAuthorized: false,
      enforcementActive: false,
    });
  } catch (error) {
    const decision = typeof error?.code === 'string' && error.code.startsWith('HOLD_') ? error.code : 'HOLD_TREASURY_BUYBACK_PREVIEW_INTERNAL';
    return Object.freeze({
      verifierVersion: TREASURY_BUYBACK_PREVIEW_VERIFIER_VERSION,
      decision,
      reason: error instanceof Error ? error.message : 'Treasury buyback preview verification failed closed.',
      checkedAt,
      validUntil: null,
      announcementStage: null,
      operationDate: candidate?.operationDate ?? value?.operationDate ?? null,
      sources: Object.freeze(sources.map(publicSource)),
      evidenceVerified: false,
      calendarLease: false,
      publicationAttempted: false,
      publicationAuthorized: false,
      enforcementActive: false,
    });
  }
}
