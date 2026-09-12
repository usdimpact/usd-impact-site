import { createHash } from 'node:crypto';

export const TREASURY_BUYBACK_DISCOVERY_VERSION = 'treasury-buyback-discovery/treasurydirect-html-v1';
export const TREASURY_BUYBACK_LISTING_URL = 'https://www.treasurydirect.gov/auctions/announcements-data-results/buy-backs/';
export const TREASURY_BUYBACK_DISCOVERY_MAX_AGE_MS = 15 * 60 * 1000;
export const TREASURY_BUYBACK_DISCOVERY_MAX_BYTES = 2_097_152;
const SOURCE_TIMEOUT_MS = 8_000;
const CANDIDATE_FIELDS = Object.freeze(['publisher', 'series', 'operationDate']);
const SCHEMA_HOLD = 'HOLD_TREASURY_BUYBACK_DISCOVERY_SCHEMA';

export class TreasuryBuybackDiscoveryHold extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TreasuryBuybackDiscoveryHold';
    this.code = code;
  }
}

const hold = (code, message) => { throw new TreasuryBuybackDiscoveryHold(code, message); };
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function asciiDigits(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

function realDate(value) {
  if (typeof value !== 'string' || value.length !== 10 || value[4] !== '-' || value[7] !== '-') return false;
  if (!asciiDigits(value.slice(0, 4)) || !asciiDigits(value.slice(5, 7)) || !asciiDigits(value.slice(8, 10))) return false;
  if (!value.startsWith('20')) return false;
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
  if (length && (!asciiDigits(length) || BigInt(length) > BigInt(TREASURY_BUYBACK_DISCOVERY_MAX_BYTES))) {
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

function htmlSpace(character) {
  return character === ' ' || character === '\n' || character === '\r' || character === '\t' || character === '\f';
}

function nameBoundary(character) {
  return character === undefined || character === '>' || character === '/' || htmlSpace(character);
}

function findTagEnd(source, start, limit = source.length) {
  let quote = null;
  for (let index = start + 1; index < limit; index += 1) {
    const character = source[index];
    if (quote !== null) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      return index;
    }
  }
  return -1;
}

function findTag(document, tagName, from, limit, closing = false) {
  const needle = closing ? `</${tagName}` : `<${tagName}`;
  let cursor = from;
  while (cursor < limit) {
    const start = document.lower.indexOf(needle, cursor);
    if (start < 0 || start >= limit) return null;
    if (!nameBoundary(document.lower[start + needle.length])) {
      cursor = start + needle.length;
      continue;
    }
    const tagEnd = findTagEnd(document.source, start, limit);
    if (tagEnd < 0) hold(SCHEMA_HOLD, `TreasuryDirect buyback table contains an unterminated ${closing ? 'closing ' : ''}${tagName} tag.`);
    return Object.freeze({ start, end: tagEnd + 1 });
  }
  return null;
}

function findElements(document, tagName, from, limit, maximum) {
  const elements = [];
  let cursor = from;
  while (cursor < limit) {
    const opening = findTag(document, tagName, cursor, limit, false);
    if (!opening) break;
    const closing = findTag(document, tagName, opening.end, limit, true);
    if (!closing) hold(SCHEMA_HOLD, `TreasuryDirect buyback table contains an unclosed ${tagName} element.`);
    const nested = findTag(document, tagName, opening.end, closing.start, false);
    if (nested) hold(SCHEMA_HOLD, `TreasuryDirect buyback table contains an unexpected nested ${tagName} element.`);
    elements.push(Object.freeze({
      openStart: opening.start,
      openEnd: opening.end,
      innerStart: opening.end,
      innerEnd: closing.start,
      closeEnd: closing.end,
    }));
    if (elements.length > maximum) hold(SCHEMA_HOLD, `TreasuryDirect buyback table contains too many ${tagName} elements.`);
    cursor = closing.end;
  }
  return elements;
}

function attributeNameCharacter(character) {
  if (character === undefined) return false;
  const code = character.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
    || character === '_' || character === '-' || character === ':';
}

function parseOpeningTagAttributes(source, start, end, tagName) {
  let cursor = start + 1 + tagName.length;
  const attributes = new Map();
  while (cursor < end - 1) {
    while (cursor < end - 1 && htmlSpace(source[cursor])) cursor += 1;
    if (cursor >= end - 1 || source[cursor] === '>' || (source[cursor] === '/' && source[cursor + 1] === '>')) break;
    const nameStart = cursor;
    while (cursor < end - 1 && attributeNameCharacter(source[cursor])) cursor += 1;
    if (cursor === nameStart) hold(SCHEMA_HOLD, `TreasuryDirect ${tagName} tag contains a malformed attribute name.`);
    const name = source.slice(nameStart, cursor).toLowerCase();
    while (cursor < end - 1 && htmlSpace(source[cursor])) cursor += 1;
    let value = '';
    if (source[cursor] === '=') {
      cursor += 1;
      while (cursor < end - 1 && htmlSpace(source[cursor])) cursor += 1;
      if (cursor >= end - 1) hold(SCHEMA_HOLD, `TreasuryDirect ${tagName} tag contains a malformed ${name} attribute.`);
      const quote = source[cursor];
      if (quote === '"' || quote === "'") {
        cursor += 1;
        const valueStart = cursor;
        while (cursor < end - 1 && source[cursor] !== quote) cursor += 1;
        if (cursor >= end - 1) hold(SCHEMA_HOLD, `TreasuryDirect ${tagName} tag contains an unterminated ${name} attribute.`);
        value = source.slice(valueStart, cursor);
        cursor += 1;
      } else {
        const valueStart = cursor;
        while (cursor < end - 1 && !htmlSpace(source[cursor]) && source[cursor] !== '>') cursor += 1;
        value = source.slice(valueStart, cursor);
      }
    }
    if (!attributes.has(name)) attributes.set(name, value);
  }
  return attributes;
}

function decodeEntity(document, index, limit) {
  const candidates = [
    ['&nbsp;', ' '], ['&#160;', ' '], ['&amp;', '&'], ['&#x2f;', '/'], ['&#47;', '/'],
  ];
  for (const [entity, value] of candidates) {
    if (index + entity.length <= limit && document.lower.startsWith(entity, index)) {
      return Object.freeze({ value, length: entity.length });
    }
  }
  return null;
}

function stripMarkup(document, start, limit) {
  let output = '';
  let pendingSpace = false;
  let cursor = start;
  while (cursor < limit) {
    const character = document.source[cursor];
    if (character === '<') {
      const tagEnd = findTagEnd(document.source, cursor, limit);
      if (tagEnd < 0) hold(SCHEMA_HOLD, 'TreasuryDirect buyback table contains unterminated markup.');
      cursor = tagEnd + 1;
      pendingSpace = output.length > 0;
      continue;
    }
    if (character === '&') {
      const decoded = decodeEntity(document, cursor, limit);
      if (decoded) {
        if (htmlSpace(decoded.value)) {
          pendingSpace = output.length > 0;
        } else {
          if (pendingSpace && output.length > 0) output += ' ';
          output += decoded.value;
          pendingSpace = false;
        }
        cursor += decoded.length;
        continue;
      }
    }
    if (htmlSpace(character)) {
      pendingSpace = output.length > 0;
    } else {
      if (pendingSpace && output.length > 0) output += ' ';
      output += character;
      pendingSpace = false;
    }
    cursor += 1;
  }
  return output;
}

function operationDateText(isoDate) {
  const year = isoDate.slice(0, 4);
  const month = isoDate.slice(5, 7);
  const day = isoDate.slice(8, 10);
  return `${month}/${day}/${year}`;
}

function operationStampDate(stamp) {
  return `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
}

function canonicalPreliminaryHref(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 500) return null;
  let url;
  try { url = new URL(value, TREASURY_BUYBACK_LISTING_URL); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'www.treasurydirect.gov' || url.port
      || url.username || url.password || url.search || url.hash) return null;
  const parts = url.pathname.split('/');
  if (parts.length !== 7 || parts[0] !== '' || parts[1] !== 'instit' || parts[2] !== 'annceresult'
      || parts[3] !== 'press' || parts[4] !== 'preanre') return null;
  const year = parts[5];
  const filename = parts[6];
  if (year.length !== 4 || !year.startsWith('20') || !asciiDigits(year)
      || !filename.startsWith('BBPA_') || !filename.endsWith('.xml')) return null;
  const operationStamp = filename.slice(5, -4);
  if (operationStamp.length !== 14 || !operationStamp.startsWith('20') || !asciiDigits(operationStamp)
      || year !== operationStamp.slice(0, 4)) return null;
  return Object.freeze({ url: url.toString(), operationStamp });
}

function preliminaryLinksFromRow(document, row) {
  const links = [];
  let cursor = row.innerStart;
  while (cursor < row.innerEnd) {
    const anchor = findTag(document, 'a', cursor, row.innerEnd, false);
    if (!anchor) break;
    const attributes = parseOpeningTagAttributes(document.source, anchor.start, anchor.end, 'a');
    const parsed = canonicalPreliminaryHref(attributes.get('href'));
    if (parsed) links.push(parsed);
    if (links.length > 1) {
      hold('HOLD_TREASURY_BUYBACK_DISCOVERY_AMBIGUOUS', 'Matching Treasury buyback row must contain exactly one canonical preliminary XML link.');
    }
    cursor = anchor.end;
  }
  return links;
}

function parseListing(body, operationDate) {
  const document = Object.freeze({ source: body, lower: body.toLowerCase() });
  const allTables = findElements(document, 'table', 0, body.length, 128);
  const tables = allTables.filter((table) => {
    const attributes = parseOpeningTagAttributes(body, table.openStart, table.openEnd, 'table');
    return attributes.get('id') === 'buybackTable';
  });
  if (tables.length !== 1) {
    hold(SCHEMA_HOLD, 'TreasuryDirect buyback listing must contain exactly one reviewed buybackTable.');
  }
  const table = tables[0];
  const bodies = findElements(document, 'tbody', table.innerStart, table.innerEnd, 8);
  if (bodies.length !== 1) {
    hold(SCHEMA_HOLD, 'TreasuryDirect buyback table must contain exactly one tbody.');
  }
  const rows = findElements(document, 'tr', bodies[0].innerStart, bodies[0].innerEnd, 1000);
  if (rows.length === 0) {
    hold(SCHEMA_HOLD, 'TreasuryDirect buyback table row count is empty or unbounded.');
  }

  const expectedDate = operationDateText(operationDate);
  const matches = [];
  for (const row of rows) {
    if (Buffer.byteLength(body.slice(row.innerStart, row.innerEnd), 'utf8') > 64 * 1024) {
      hold(SCHEMA_HOLD, 'TreasuryDirect buyback table contains an unbounded row.');
    }
    const cells = findElements(document, 'td', row.innerStart, row.innerEnd, 64);
    if (cells.length < 8 || stripMarkup(document, cells[0].innerStart, cells[0].innerEnd) !== expectedDate) continue;

    const links = preliminaryLinksFromRow(document, row);
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
