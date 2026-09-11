import { createHash } from 'node:crypto';
import {
  TREASURY_BUYBACK_DISCOVERY_MAX_AGE_MS,
  TREASURY_BUYBACK_DISCOVERY_MAX_BYTES,
  TREASURY_BUYBACK_LISTING_URL,
} from './treasury-buyback-discovery.js';

export const TREASURY_BUYBACK_OUTCOME_DISCOVERY_VERSION = 'treasury-buyback-outcome-discovery/treasurydirect-html-v1';
const SOURCE_TIMEOUT_MS = 8_000;
const CANDIDATE_FIELDS = Object.freeze(['publisher', 'series', 'operationDate']);
const ARTIFACT_PATH = /^\/instit\/annceresult\/press\/preanre\/(20\d{2})\/(BBPA|BBA|BBR)_(20\d{12})\.xml$/;
const STAGE_CELLS = Object.freeze([
  Object.freeze({ name: 'preliminary', prefix: 'BBPA', index: 7 }),
  Object.freeze({ name: 'final', prefix: 'BBA', index: 8 }),
  Object.freeze({ name: 'results', prefix: 'BBR', index: 9 }),
]);

export class TreasuryBuybackOutcomeDiscoveryHold extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TreasuryBuybackOutcomeDiscoveryHold';
    this.code = code;
  }
}

const hold = (code, message) => { throw new TreasuryBuybackOutcomeDiscoveryHold(code, message); };
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function realDate(value) {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeCandidate(value) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_CANDIDATE', 'A bounded plain-object Treasury buyback outcome discovery candidate is required.');
  }
  const keys = Object.keys(value).sort();
  const expected = [...CANDIDATE_FIELDS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_CANDIDATE', 'Treasury buyback outcome discovery candidate schema changed or is incomplete.');
  }
  if (value.publisher !== 'TREASURY' || value.series !== 'BUYBACK' || !realDate(value.operationDate)) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_CANDIDATE', 'Treasury buyback outcome discovery candidate identity is invalid.');
  }
  return Object.freeze({ ...value });
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

async function fetchListing({ fetchImpl, clock }) {
  if (typeof fetchImpl !== 'function') {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SOURCE_UNAVAILABLE', 'Official-source fetch is unavailable.');
  }
  let response;
  try {
    response = await fetchImpl(TREASURY_BUYBACK_LISTING_URL, {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
      headers: { accept: 'text/html, application/xhtml+xml' },
    });
  } catch (error) {
    if (error instanceof TreasuryBuybackOutcomeDiscoveryHold) throw error;
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SOURCE_UNAVAILABLE', 'Official TreasuryDirect buyback listing could not be fetched.');
  }
  const fetchedAtMs = clock();
  if (!response || response.status !== 200 || typeof response.text !== 'function') {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SOURCE_UNAVAILABLE', 'Official TreasuryDirect buyback listing did not return HTTP 200.');
  }
  if (typeof response.url === 'string' && response.url && response.url !== TREASURY_BUYBACK_LISTING_URL) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SOURCE_REDIRECT', 'Official TreasuryDirect buyback listing redirected away from its canonical URL.');
  }
  const length = header(response, 'content-length');
  if (length && (!/^\d+$/.test(length) || BigInt(length) > BigInt(TREASURY_BUYBACK_DISCOVERY_MAX_BYTES))) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SOURCE_TOO_LARGE', 'Official TreasuryDirect buyback listing exceeds the outcome-discovery byte bound.');
  }
  const contentType = header(response, 'content-type').split(';', 1)[0].toLowerCase();
  if (contentType && !new Set(['text/html', 'application/xhtml+xml']).has(contentType)) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SOURCE_TYPE', 'Official TreasuryDirect buyback listing returned an unexpected content type.');
  }
  const body = await response.text();
  const bytes = typeof body === 'string' ? Buffer.byteLength(body, 'utf8') : 0;
  if (bytes < 128 || bytes > TREASURY_BUYBACK_DISCOVERY_MAX_BYTES) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SOURCE_TOO_LARGE', 'Official TreasuryDirect buyback listing is empty or exceeds the outcome-discovery byte bound.');
  }
  return Object.freeze({
    url: TREASURY_BUYBACK_LISTING_URL,
    status: 200,
    fetchedAt: new Date(fetchedAtMs).toISOString(),
    sha256: sha256(body),
    body,
  });
}

function stripMarkup(value) {
  return value
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#x2F;|&#47;/gi, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function operationDateText(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${month}/${day}/${year}`;
}

function operationStampDate(stamp) {
  return `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
}

function extractAttribute(tag, attribute) {
  const pattern = new RegExp(`\\b${attribute}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  return tag.match(pattern)?.[2] ?? null;
}

function canonicalArtifactHref(value) {
  if (typeof value !== 'string' || value.length > 500) return null;
  let url;
  try { url = new URL(value, TREASURY_BUYBACK_LISTING_URL); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'www.treasurydirect.gov' || url.port
      || url.username || url.password || url.search || url.hash) return null;
  const match = url.pathname.match(ARTIFACT_PATH);
  if (!match || match[1] !== match[3].slice(0, 4)) return null;
  return Object.freeze({ url: url.toString(), prefix: match[2], operationStamp: match[3] });
}

function artifactFromCell(cell, expectedPrefix) {
  const links = [];
  for (const anchor of cell.matchAll(/<a\b[^>]*>/gi)) {
    const parsed = canonicalArtifactHref(extractAttribute(anchor[0], 'href'));
    if (parsed) links.push(parsed);
  }
  if (links.length === 0) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_INCOMPLETE', `TreasuryDirect ${expectedPrefix} XML link is not yet present in the reviewed operation row.`);
  }
  if (links.length !== 1 || links[0].prefix !== expectedPrefix) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_AMBIGUOUS', `TreasuryDirect ${expectedPrefix} cell must contain exactly one canonical XML artifact for its reviewed stage.`);
  }
  return links[0];
}

function parseListing(body, operationDate) {
  const tables = [...body.matchAll(/<table\b[^>]*\bid\s*=\s*(["'])buybackTable\1[^>]*>[\s\S]*?<\/table>/gi)];
  if (tables.length !== 1) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SCHEMA', 'TreasuryDirect buyback listing must contain exactly one reviewed buybackTable.');
  }
  const table = tables[0][0];
  const bodies = [...table.matchAll(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/gi)];
  if (bodies.length !== 1) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SCHEMA', 'TreasuryDirect buyback table must contain exactly one tbody.');
  }
  const rows = [...bodies[0][1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  if (rows.length === 0 || rows.length > 1000) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SCHEMA', 'TreasuryDirect buyback table row count is empty or unbounded.');
  }

  const expectedDate = operationDateText(operationDate);
  const matches = [];
  for (const row of rows) {
    if (Buffer.byteLength(row, 'utf8') > 64 * 1024) {
      hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SCHEMA', 'TreasuryDirect buyback table contains an unbounded row.');
    }
    const cellBlocks = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
    const cells = cellBlocks.map(stripMarkup);
    if (cells.length < 10 || cells[0] !== expectedDate) continue;

    const artifacts = {};
    for (const stage of STAGE_CELLS) {
      if (stage.index >= cellBlocks.length) {
        hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_SCHEMA', 'TreasuryDirect buyback row no longer exposes the reviewed announcement/result columns.');
      }
      artifacts[stage.name] = artifactFromCell(cellBlocks[stage.index], stage.prefix);
    }
    const stamps = new Set(Object.values(artifacts).map((artifact) => artifact.operationStamp));
    if (stamps.size !== 1) {
      hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_IDENTITY', 'TreasuryDirect preliminary/final/results links do not identify one buyback operation.');
    }
    const operationStamp = artifacts.preliminary.operationStamp;
    if (operationStampDate(operationStamp) !== operationDate) {
      hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_IDENTITY', 'TreasuryDirect outcome artifact stamp disagrees with the requested operation date.');
    }
    matches.push(Object.freeze({ artifacts: Object.freeze(artifacts), operationStamp }));
  }

  if (matches.length === 0) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_NOT_FOUND', 'TreasuryDirect listing does not contain a reviewed operation row for the requested date.');
  }
  if (matches.length !== 1) {
    hold('HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_AMBIGUOUS', 'TreasuryDirect listing contains multiple operation rows for the requested date.');
  }
  return matches[0];
}

function publicSource(source) {
  const { body, ...publicFields } = source;
  return Object.freeze({ ...publicFields, adapterVersion: TREASURY_BUYBACK_OUTCOME_DISCOVERY_VERSION });
}

/**
 * Discover one canonical TreasuryDirect BBPA/BBA/BBR XML set from the
 * first-party buyback table. The operation row, stage columns and shared
 * operation stamp must all agree. No artifact filename is synthesized.
 * This is dormant evidence discovery only and cannot authorize publication.
 */
export async function discoverTreasuryBuybackOutcomeUrls(value, { now = Date.now, fetchImpl = globalThis.fetch } = {}) {
  let candidate = null;
  let checkedAt = null;
  let source = null;
  try {
    const clock = monotonicClock(now);
    checkedAt = new Date(clock()).toISOString();
    candidate = normalizeCandidate(value);
    source = await fetchListing({ fetchImpl, clock });
    const discovered = parseListing(source.body, candidate.operationDate);
    const checked = clock();
    checkedAt = new Date(checked).toISOString();
    const fetched = Date.parse(source.fetchedAt);
    const validUntilMs = fetched + TREASURY_BUYBACK_DISCOVERY_MAX_AGE_MS;
    if (checked < fetched || checked >= validUntilMs) {
      hold('HOLD_EVIDENCE_STALE', 'Treasury buyback outcome-discovery evidence exceeded its bounded validity window.');
    }
    return Object.freeze({
      verifierVersion: TREASURY_BUYBACK_OUTCOME_DISCOVERY_VERSION,
      decision: 'PASS',
      reason: 'Fresh TreasuryDirect buyback listing contains one canonical preliminary/final/results XML set for the requested operation date.',
      checkedAt,
      validUntil: new Date(validUntilMs).toISOString(),
      operationDate: candidate.operationDate,
      operationStamp: discovered.operationStamp,
      preliminaryUrl: discovered.artifacts.preliminary.url,
      finalUrl: discovered.artifacts.final.url,
      resultsUrl: discovered.artifacts.results.url,
      source: publicSource(source),
      discoveryVerified: true,
      resultsLinkObserved: true,
      calendarLease: false,
      publicationAttempted: false,
      publicationAuthorized: false,
      enforcementActive: false,
    });
  } catch (error) {
    const decision = typeof error?.code === 'string' && error.code.startsWith('HOLD_')
      ? error.code
      : 'HOLD_TREASURY_BUYBACK_OUTCOME_DISCOVERY_INTERNAL';
    return Object.freeze({
      verifierVersion: TREASURY_BUYBACK_OUTCOME_DISCOVERY_VERSION,
      decision,
      reason: error instanceof Error ? error.message : 'Treasury buyback outcome discovery failed closed.',
      checkedAt,
      validUntil: null,
      operationDate: candidate?.operationDate ?? value?.operationDate ?? null,
      operationStamp: null,
      preliminaryUrl: null,
      finalUrl: null,
      resultsUrl: null,
      source: source ? publicSource(source) : null,
      discoveryVerified: false,
      resultsLinkObserved: false,
      calendarLease: false,
      publicationAttempted: false,
      publicationAuthorized: false,
      enforcementActive: false,
    });
  }
}
