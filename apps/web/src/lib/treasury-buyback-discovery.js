import { createHash } from 'node:crypto';

export const TREASURY_BUYBACK_DISCOVERY_VERSION = 'treasury-buyback-discovery/treasurydirect-html-v1';
export const TREASURY_BUYBACK_LISTING_URL = 'https://www.treasurydirect.gov/auctions/announcements-data-results/buy-backs/';
export const TREASURY_BUYBACK_DISCOVERY_MAX_AGE_MS = 15 * 60 * 1000;
export const TREASURY_BUYBACK_DISCOVERY_MAX_BYTES = 2_097_152;
const SOURCE_TIMEOUT_MS = 8_000;
const CANDIDATE_FIELDS = Object.freeze(['publisher', 'series', 'operationDate']);
const PRELIMINARY_PATH = /^\/instit\/annceresult\/press\/preanre\/(20\d{2})\/BBPA_(20\d{12})\.xml$/;

export class TreasuryBuybackDiscoveryHold extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TreasuryBuybackDiscoveryHold';
    this.code = code;
  }
}

const hold = (code, message) => { throw new TreasuryBuybackDiscoveryHold(code, message); };
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function realDate(value) {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeCandidate(value) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) {
    hold('HOLD_TREASURY_BUYBACK_DISCOVERY_CANDIDATE', 'A bounded plain-object Treasury buyback discovery candidate is required.');
  }
  const keys = Object.keys(value).sort();
  const expected = [...CANDIDATE_FIELDS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    hold('HOLD_TREASURY_BUYBACK_DISCOVERY_CANDIDATE', 'Treasury buyback discovery candidate schema changed or is incomplete.');
  }
  if (value.publisher !== 'TREASURY' || value.series !== 'BUYBACK' || !realDate(value.operationDate)) {
    hold('HOLD_TREASURY_BUYBACK_DISCOVERY_CANDIDATE', 'Treasury buyback discovery candidate identity is invalid.');
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
  if (typeof fetchImpl !== 'function') hold('HOLD_TREASURY_BUYBACK_DISCOVERY_SOURCE_UNAVAILABLE', 'Official-source fetch is unavailable.');
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
    if (error instanceof TreasuryBuybackDiscoveryHold) throw error;
    hold('HOLD_TREASURY_BUYBACK_DISCOVERY_SOURCE_UNAVAILABLE', 'Official TreasuryDirect buyback listing could not be fetched.');
  }
  const fetchedAtMs = clock();
  if (!response || response.status !== 200 || typeof response.text !== 'function') {
    hold('HOLD_TREASURY_BUYBACK_DISCOVERY_SOURCE_UNAVAILABLE', 'Official TreasuryDirect buyback listing did not return HTTP 200.');
  }
  if (typeof response.url === 'string' && response.url && response.url !== TREASURY_BUYBACK_LISTING_URL) {
    hold('HOLD_TREASURY_BUYBACK_DISCOVERY_SOURCE_REDIRECT', 'Official TreasuryDirect buyback listing redirected away from its canonical URL.');
  }
  const length = header(response, 'content-length');
  if (length && (!/^\d+$/.test(length) || BigInt(length) > BigInt(TREASURY_BUYBACK_DISCOVERY_MAX_BYTES))) {
    hold('HOLD_TREASURY_BUYBACK_DISCOVERY_SOURCE_TOO_LARGE', 'Official TreasuryDirect buyback listing exceeds the discovery byte bound.');
  }
  const contentType = header(response, 'content-type').split(';', 1)[0].toLowerCase();
  if (contentType && !new Set(['text/html', 'application/xhtml+xml']).has(contentType)) {
    hold('HOLD_TREASURY_BUYBACK_DISCOVERY_SOURCE_TYPE', 'Official TreasuryDirect buyback listing returned an unexpected content type.');
  }
  const body = await response.text();
  const bytes = typeof body === 'string' ? Buffer.byteLength(body, 'utf8') : 0;
  if (bytes < 128 || bytes > TREASURY_BUYBACK_DISCOVERY_MAX_BYTES) {
    hold('HOLD_TREASURY_BUYBACK_DISCOVERY_SOURCE_TOO_LARGE', 'Official TreasuryDirect buyback listing is empty or exceeds the discovery byte bound.');
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

function canonicalPreliminaryHref(value) {
  if (typeof value !== 'string' || value.length > 500) return null;
  let url;
  try { url = new URL(value, TREASURY_BUYBACK_LISTING_URL); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'www.treasurydirect.gov' || url.port
      || url.username || url.password || url.search || url.hash) return null;
  const match = url.pathname.match(PRELIMINARY_PATH);
  if (!match || match[1] !== match[2].slice(0, 4)) return null;
  return Object.freeze({ url: url.toString(), operationStamp: match[2] });
}

function extractAttribute(tag, attribute) {
  const pattern = new RegExp(`\\b${attribute}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  return tag.match(pattern)?.[2] ?? null;
}

function parseListing(body, operationDate) {
  const tables = [...body.matchAll(/<table\b[^>]*\bid\s*=\s*(["'])buybackTable\1[^>]*>[\s\S]*?<\/table>/gi)];
  if (tables.length !== 1) {
    hold('HOLD_TREASURY_BUYBACK_DISCOVERY_SCHEMA', 'TreasuryDirect buyback listing must contain exactly one reviewed buybackTable.');
  }
  const table = tables[0][0];
  const bodies = [...table.matchAll(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/gi)];
  if (bodies.length !== 1) {
    hold('HOLD_TREASURY_BUYBACK_DISCOVERY_SCHEMA', 'TreasuryDirect buyback table must contain exactly one tbody.');
  }
  const rows = [...bodies[0][1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  if (rows.length === 0 || rows.length > 1000) {
    hold('HOLD_TREASURY_BUYBACK_DISCOVERY_SCHEMA', 'TreasuryDirect buyback table row count is empty or unbounded.');
  }

  const expectedDate = operationDateText(operationDate);
  const matches = [];
  for (const row of rows) {
    if (Buffer.byteLength(row, 'utf8') > 64 * 1024) {
      hold('HOLD_TREASURY_BUYBACK_DISCOVERY_SCHEMA', 'TreasuryDirect buyback table contains an unbounded row.');
    }
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripMarkup(match[1]));
    if (cells.length < 8 || cells[0] !== expectedDate) continue;

    const links = [];
    for (const anchor of row.matchAll(/<a\b[^>]*>/gi)) {
      const href = extractAttribute(anchor[0], 'href');
      const parsed = canonicalPreliminaryHref(href);
      if (parsed) links.push(parsed);
    }
    if (links.length !== 1) {
      hold('HOLD_TREASURY_BUYBACK_DISCOVERY_AMBIGUOUS', 'Matching Treasury buyback row must contain exactly one canonical preliminary XML link.');
    }
    if (operationStampDate(links[0].operationStamp) !== operationDate) {
      hold('HOLD_TREASURY_BUYBACK_DISCOVERY_IDENTITY', 'Discovered preliminary XML operation stamp disagrees with the requested operation date.');
    }
    matches.push(links[0]);
  }

  if (matches.length === 0) {
    hold('HOLD_TREASURY_BUYBACK_DISCOVERY_NOT_FOUND', 'TreasuryDirect listing does not contain a reviewed operation row for the requested date.');
  }
  if (matches.length !== 1) {
    hold('HOLD_TREASURY_BUYBACK_DISCOVERY_AMBIGUOUS', 'TreasuryDirect listing contains multiple operation rows for the requested date.');
  }
  return matches[0];
}

function publicSource(source) {
  const { body, ...publicFields } = source;
  return Object.freeze({ ...publicFields, adapterVersion: TREASURY_BUYBACK_DISCOVERY_VERSION });
}

/**
 * Discover one canonical TreasuryDirect BBPA XML URL from the first-party
 * buyback operations table. This adapter never constructs the initial BBPA
 * filename from a date or schedule. It is dormant evidence discovery only.
 */
export async function discoverTreasuryBuybackPreliminaryUrl(value, { now = Date.now, fetchImpl = globalThis.fetch } = {}) {
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
      hold('HOLD_EVIDENCE_STALE', 'Treasury buyback discovery evidence exceeded its bounded validity window.');
    }
    return Object.freeze({
      verifierVersion: TREASURY_BUYBACK_DISCOVERY_VERSION,
      decision: 'PASS',
      reason: 'Fresh TreasuryDirect buyback listing contains exactly one canonical preliminary XML link for the requested operation date.',
      checkedAt,
      validUntil: new Date(validUntilMs).toISOString(),
      operationDate: candidate.operationDate,
      preliminaryUrl: discovered.url,
      operationStamp: discovered.operationStamp,
      source: publicSource(source),
      discoveryVerified: true,
      calendarLease: false,
      publicationAttempted: false,
      publicationAuthorized: false,
      enforcementActive: false,
    });
  } catch (error) {
    const decision = typeof error?.code === 'string' && error.code.startsWith('HOLD_') ? error.code : 'HOLD_TREASURY_BUYBACK_DISCOVERY_INTERNAL';
    return Object.freeze({
      verifierVersion: TREASURY_BUYBACK_DISCOVERY_VERSION,
      decision,
      reason: error instanceof Error ? error.message : 'Treasury buyback discovery failed closed.',
      checkedAt,
      validUntil: null,
      operationDate: candidate?.operationDate ?? value?.operationDate ?? null,
      preliminaryUrl: null,
      operationStamp: null,
      source: source ? publicSource(source) : null,
      discoveryVerified: false,
      calendarLease: false,
      publicationAttempted: false,
      publicationAuthorized: false,
      enforcementActive: false,
    });
  }
}
