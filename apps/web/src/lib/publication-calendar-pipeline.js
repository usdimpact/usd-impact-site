import {
  CalendarHold, MONTHS, calendarIdentity, digest, hold,
  normalizeCalendarCandidate, referencePeriod, verifyPublicationCalendar,
} from './publication-calendar.js';

export const CALENDAR_FIELDS = Object.freeze([
  'publisher', 'series', 'referencePeriod', 'releaseStage', 'eventDate',
  'releaseTime', 'timeZone', 'releaseAt',
]);
// Null is an honest unsupported assertion, never an automatic publication PASS.
export const CALENDAR_ASSERTION_JSON_SCHEMA = {
  anyOf: [
    { type: 'null' },
    { type: 'object', additionalProperties: false, required: [...CALENDAR_FIELDS],
      properties: Object.fromEntries(CALENDAR_FIELDS.map((field) => [field, { type: 'string' }])) },
  ],
};
const leases = new WeakMap();
const CPI_LABEL = /^BLS Consumer Price Index(?: \(CPI\))? for ([A-Za-z]+ 20\d{2})$/;
const CPI_MENTION = /\b(?:CPI|Consumer Price Index)\b/i;
const CALENDAR_LANGUAGE = /\b(?:scheduled|schedule|upcoming|due|next|will be released|to be released)\b/i;

/** Explicit label identity is sufficient for duplicate suppression, never timing verification. */
export function explicitCpiIdentity(event) {
  const match = typeof event === 'string' && event.match(CPI_LABEL);
  if (!match) return null;
  try { return `BLS:CPI:${referencePeriod(match[1])}:initial`; } catch { return null; }
}

/** Read only explicit identity fields in existing importer-format archives. No timing claim is inferred. */
export function archivedCpiIdentity(source) {
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] ?? '';
  const events = [...frontmatter.matchAll(/^event: (.*)$/gm)];
  if (!events.length) return null;
  if (events.length !== 1) hold('HOLD_SOURCE_SCHEMA', 'Duplicate archived event identity requires editorial resolution.');
  let event;
  try { event = JSON.parse(events[0][1]); } catch {
    if (CPI_MENTION.test(events[0][1])) hold('HOLD_SOURCE_SCHEMA', 'Unsupported archived CPI identity encoding requires editorial resolution.');
    return null;
  }
  const identity = explicitCpiIdentity(event);
  if (!identity) return null;
  const phases = [...frontmatter.matchAll(/^phase: "(preview|outcome)"[ \t]*$/gm)];
  if (phases.length !== 1) hold('HOLD_SOURCE_SCHEMA', 'Ambiguous archived CPI phase requires editorial resolution.');
  return `${identity}:${phases[0][1]}`;
}

export function pipelineCalendarCandidate(payload, { daily = false } = {}) {
  if (typeof payload?.event !== 'string' || !payload.event) hold('HOLD_IDENTITY_MISMATCH', 'The original event label is required.');
  const value = payload?.calendar;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    hold(explicitCpiIdentity(payload?.event) ? 'HOLD_MISSING_CALENDAR_RECORD' : 'HOLD_UNSUPPORTED_EVENT',
      'An explicit supported calendar record is required for automatic publication.');
  }
  if (Object.keys(value).length !== CALENDAR_FIELDS.length
      || CALENDAR_FIELDS.some((key) => typeof value[key] !== 'string')) {
    hold('HOLD_INVALID_CANDIDATE', 'Calendar assertions must contain exactly the eight canonical string fields.');
  }
  if (value.eventDate !== (daily ? payload.date : payload.eventDate)) {
    hold('HOLD_RELEASE_TIME_MISMATCH', 'Original publication date contradicts its calendar record.');
  }
  return normalizeCalendarCandidate({
    ...value, event: payload.event,
    phase: daily ? 'preview' : payload.phase,
    statusLabel: daily ? 'scheduled-confirmed' : payload.statusLabel,
  });
}

const monthToken = MONTHS.map((name) => `${name}|${name.slice(0, 3)}\\.?`).join('|') + '|Sept\\.?';
function monthNumber(token) {
  return MONTHS.findIndex((month) => month.slice(0, 3).toLowerCase() === token.slice(0, 3).toLowerCase()) + 1;
}
/** Conservative current-event prose checks. Ambiguous/relative timing is held, not rewritten.
 * This is not a general natural-language fact checker; ordinary editorial review remains required.
 */
export function assertCurrentCpiClaims(text, candidate) {
  if (typeof text !== 'string' || text.length > 50000) hold('HOLD_CALENDAR_CLAIM', 'Unbounded or malformed calendar copy.');
  if (/\b(?:tomorrow|yesterday|today|tonight)\b/i.test(text)) {
    hold('HOLD_CALENDAR_CLAIM', 'Relative event timing requires an absolute-date editorial correction.');
  }
  for (const match of text.matchAll(/\b20\d{2}-\d{2}-\d{2}\b/g)) {
    if (match[0] !== candidate.eventDate) hold('HOLD_RELEASE_TIME_MISMATCH', 'Current-event copy contains a conflicting absolute date.');
  }
  const namedDate = new RegExp(`\\b(${monthToken}) ([0-9]{1,2})(?:,? (20[0-9]{2}))?\\b`, 'gi');
  for (const match of text.matchAll(namedDate)) {
    if (monthNumber(match[1]) !== Number(candidate.eventDate.slice(5, 7))
        || Number(match[2]) !== Number(candidate.eventDate.slice(8, 10))
        || (match[3] && match[3] !== candidate.eventDate.slice(0, 4))) {
      hold('HOLD_RELEASE_TIME_MISMATCH', 'Current-event copy contains a conflicting named date.');
    }
  }
  const periodPattern = new RegExp(`\\b(?:for|reference (?:period|month)(?: is|:)?) (${MONTHS.join('|')}) (20[0-9]{2})\\b`, 'gi');
  for (const match of text.matchAll(periodPattern)) {
    if (referencePeriod(`${match[1]} ${match[2]}`) !== candidate.referencePeriod) {
      hold('HOLD_REFERENCE_PERIOD_MISMATCH', 'Current-event copy contradicts the reference month.');
    }
  }
  const namedCpiPeriod = new RegExp(`\\b(${MONTHS.join('|')})(?: (20[0-9]{2}))? (?:CPI|Consumer Price Index)\\b`, 'gi');
  for (const match of text.matchAll(namedCpiPeriod)) {
    if (monthNumber(match[1]) !== Number(candidate.referencePeriod.slice(5))
        || (match[2] && match[2] !== candidate.referencePeriod.slice(0, 4))) {
      hold('HOLD_REFERENCE_PERIOD_MISMATCH', 'The named CPI reference period in copy disagrees with the canonical record.');
    }
  }
  if (candidate.phase === 'preview' && /\b(?:(?:was|were|has been|have been) (?:released|published)|BLS (?:reported|released)|figures are out|is now available)\b/i.test(text)) {
    hold('HOLD_CALENDAR_CLAIM', 'Preview copy asserts an already released outcome.');
  }
  if (candidate.phase === 'outcome' && /\b(?:not yet released|not yet available|still awaiting the release)\b/i.test(text)) {
    hold('HOLD_CALENDAR_CLAIM', 'Outcome copy contradicts its released phase.');
  }
  // ISO instants have their own complete comparison rather than being treated as local clocks.
  for (const match of text.matchAll(/\b20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z\b/g)) {
    if (Date.parse(match[0]) !== Date.parse(candidate.releaseAt)) hold('HOLD_RELEASE_TIME_MISMATCH', 'Current-event copy contains a conflicting UTC instant.');
  }
  const withoutIso = text.replace(/20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z/g, '');
  for (const match of withoutIso.matchAll(/\b(\d{1,2}):([0-5]\d)(?:\s*(a\.?m\.?|p\.?m\.?))?\s*\(?\s*(America\/New_York|Eastern(?: Time)?|ET|EDT|EST|UTC|GMT)?/gi)) {
    let hours = Number(match[1]);
    const meridiem = match[3]?.replaceAll('.', '').toLowerCase();
    if (hours > 23 || (meridiem && (hours < 1 || hours > 12))) hold('HOLD_CALENDAR_CLAIM', 'Invalid release clock syntax.');
    if (meridiem) hours = hours % 12 + (meridiem === 'pm' ? 12 : 0);
    const zone = match[4]?.toUpperCase();
    if (!zone) hold('HOLD_CALENDAR_CLAIM', 'A release clock in copy must include its timezone.');
    const expected = ['UTC', 'GMT'].includes(zone) ? candidate.releaseAt.slice(11, 16) : candidate.releaseTime;
    if (`${String(hours).padStart(2, '0')}:${match[2]}` !== expected) hold('HOLD_RELEASE_TIME_MISMATCH', 'Current-event copy contains a conflicting release clock.');
    if (zone === 'EST' || zone === 'EDT') {
      const local = Date.parse(`${candidate.eventDate}T${candidate.releaseTime}:00Z`);
      const offsetHours = (Date.parse(candidate.releaseAt) - local) / 3600000;
      if (offsetHours !== (zone === 'EST' ? 5 : 4)) hold('HOLD_RELEASE_TIME_MISMATCH', 'Current-event copy uses the wrong seasonal Eastern offset.');
    }
  }
}

function dailyCopy(payload) {
  return [payload.title, payload.metaTitle, payload.metaDescription, payload.summary, payload.body, ...(payload.highlights ?? []).flatMap((item) => [item.headline, item.development, item.whyItMatters])].join('\n');
}
function briefCopy(payload) {
  return [payload.title, payload.metaTitle, payload.metaDescription, payload.summary, payload.body,
    ...(payload.whatToWatch ?? []),
    ...(payload.transmissionChannels ?? []).flatMap((item) => [item.channel, item.conditionalImpact]),
    ...(payload.verifiedFacts ?? []).map((fact) => fact.statement)].filter((text) => text !== undefined).join('\n');
}
function failed(decision, boundary) {
  const error = new CalendarHold(decision.decision, decision.reason);
  error.calendarAudit = { boundary, ...decision };
  throw error;
}

/** Ingress verification is independent of candidate flags, source IDs and historical asOf fields. */
export async function verifyPipelineCalendar(payload, { kind, boundary, now = Date.now, fetchImpl = globalThis.fetch } = {}) {
  if (!['daily', 'brief'].includes(kind)) hold('HOLD_INVALID_CANDIDATE', 'A supported publication kind is required.');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) hold('HOLD_INVALID_CANDIDATE', 'A publication bundle is required.');
  const contentSha256 = digest(JSON.stringify(payload));
  const rows = kind === 'daily' ? payload.catalysts ?? [] : [payload];
  if (!Array.isArray(rows) || rows.length > 10) hold('HOLD_INVALID_CANDIDATE', 'A bounded calendar array is required.');
  const decisions = [];
  const identities = new Set();
  try {
    for (const row of rows) {
      const candidate = pipelineCalendarCandidate(row, { daily: kind === 'daily' });
      const identity = calendarIdentity(candidate);
      if (identities.has(identity)) hold('HOLD_DUPLICATE_EVENT', 'Duplicate canonical calendar identity in a publication bundle.');
      identities.add(identity);
      assertCurrentCpiClaims(kind === 'brief' ? briefCopy(payload) : `${row.event}\n${row.whyItMatters ?? ''}`, candidate);
      if (kind === 'daily') {
        const narrative = dailyCopy(payload);
        for (const sentence of narrative.split(/(?<=[.!?])\s+|\n/)) {
          if (CPI_MENTION.test(sentence) && CALENDAR_LANGUAGE.test(sentence)) assertCurrentCpiClaims(sentence, candidate);
        }
      }
      const decision = await verifyPublicationCalendar({ ...candidate, event: row.event }, { now, fetchImpl });
      if (decision.decision !== 'PASS') failed(decision, boundary);
      decisions.push(decision);
    }
    if (!rows.length && CPI_MENTION.test(dailyCopy(payload))
        && CALENDAR_LANGUAGE.test(dailyCopy(payload))) {
      hold('HOLD_MISSING_CALENDAR_RECORD', 'Forward-looking CPI copy is missing its canonical calendar entry.');
    }
    const checked = now();
    if (!Number.isFinite(checked)) hold('HOLD_INVALID_CLOCK', 'Trusted pipeline clock is unavailable.');
    const lease = Object.freeze({
      boundary, decision: rows.length ? 'PASS' : 'NO_CALENDAR_ENTRIES',
      contentSha256, checkedAt: new Date(checked).toISOString(),
      validUntil: decisions.length ? new Date(Math.min(...decisions.map((item) => Date.parse(item.validUntil)))).toISOString() : null,
      decisions: Object.freeze(decisions), publicationAttempted: false, publicationAuthorized: false,
    });
    leases.set(lease, contentSha256);
    assertPipelineCalendarLease(lease, payload, { now });
    return lease;
  } catch (error) {
    if (error instanceof CalendarHold && !error.calendarAudit) error.calendarAudit = {
      boundary, decision: error.code, reason: error.message, contentSha256,
      decisions, publicationAttempted: false, publicationAuthorized: false,
    };
    throw error;
  }
}

/** Last in-process check before returning a bundle or writing imported bytes; not release approval. */
export function assertPipelineCalendarLease(lease, payload, { now = Date.now } = {}) {
  if (!leases.has(lease)) hold('HOLD_UNTRUSTED_EVIDENCE', 'A fresh in-process calendar check is required.');
  if (leases.get(lease) !== digest(JSON.stringify(payload))) hold('HOLD_REVISION_DRIFT', 'The publication bundle changed after its calendar check.');
  const current = now();
  if (!Number.isFinite(current) || current < Date.parse(lease.checkedAt)) hold('HOLD_INVALID_CLOCK', 'Trusted clock moved backwards.');
  if (lease.validUntil && current >= Date.parse(lease.validUntil)) {
    hold(lease.decisions.some((item) => item.event.phase === 'preview' && current >= Date.parse(item.event.releaseAt))
      ? 'HOLD_PREVIEW_EXPIRED' : 'HOLD_EVIDENCE_STALE', 'The calendar decision expired before the next publication boundary.');
  }
}
