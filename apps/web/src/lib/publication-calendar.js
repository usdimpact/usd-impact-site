import {
  canonicalPublicationEventIdentity,
  parsePublicationEventLabel,
  publicationEventDescriptor,
} from './publication-event-registry.js';
import { createHash } from 'node:crypto';

export const CALENDAR_POLICY_VERSION = 'publication-calendar/v1';
export const CALENDAR_MAX_AGE_MS = 15 * 60 * 1000;
export const CALENDAR_TIME_ZONE = 'America/New_York';
export const MONTHS = Object.freeze(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);
const issuedDecisions = new WeakSet();

export class CalendarHold extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CalendarHold';
    this.code = code;
  }
}
export function hold(code, message) { throw new CalendarHold(code, message); }
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function referencePeriod(value) {
  const match = typeof value === 'string' && value.match(/^([A-Za-z]+) (20\d{2})$/);
  const month = match ? MONTHS.findIndex((name) => name.toLowerCase() === match[1].toLowerCase()) + 1 : 0;
  if (!month) hold('HOLD_REFERENCE_PERIOD_MISMATCH', 'An explicit month and year are required.');
  return `${match[2]}-${String(month).padStart(2, '0')}`;
}
function localParts(formatter, instant) {
  const parts = Object.fromEntries(formatter.formatToParts(instant).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00`;
}
/** Resolve a local wall clock, rejecting nonexistent and ambiguous DST times. */
export function localReleaseInstant(date, time, timeZone = CALENDAR_TIME_ZONE) {
  if (!isCalendarDate(date) || typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    hold('HOLD_RELEASE_TIME_MISMATCH', 'Invalid release date or local time.');
  }
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
  } catch { hold('HOLD_RELEASE_TIME_MISMATCH', 'Unsupported release timezone.'); }
  const wallClock = `${date}T${time}:00`;
  const naive = Date.parse(`${wallClock}Z`);
  const offsets = new Set();
  for (const hours of [-36, -24, -12, 0, 12, 24, 36]) {
    const probe = naive + hours * 3600000;
    offsets.add(Date.parse(`${localParts(formatter, probe)}Z`) - probe);
  }
  const matches = [...offsets].map((offset) => naive - offset)
    .filter((instant) => localParts(formatter, instant) === wallClock);
  if (matches.length !== 1) hold('HOLD_RELEASE_TIME_MISMATCH', 'Release wall clock is ambiguous or nonexistent.');
  return new Date(matches[0]).toISOString();
}
function instant(value) {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return NaN;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString().replace('.000Z', 'Z') === value.replace('.000Z', 'Z') ? milliseconds : NaN;
}
export function calendarIdentity(candidate) {
  return canonicalPublicationEventIdentity(candidate)
    ?? `${candidate.publisher}:${candidate.series}:${candidate.referencePeriod}:${candidate.releaseStage}`;
}
/** This validates assertions only. It does not turn assertions into verified evidence. */
export function normalizeCalendarCandidate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) hold('HOLD_INVALID_CANDIDATE', 'A structured event record is required.');
  const eventDescriptor = publicationEventDescriptor(value.publisher, value.series);
  if (!eventDescriptor || !eventDescriptor.verification.enabled) hold('HOLD_UNSUPPORTED_EVENT', 'Only BLS national CPI, PPI and Employment Situation monthly adapters are implemented.');
  if (!eventDescriptor.releaseStages.includes(value.releaseStage)) hold('HOLD_UNSUPPORTED_EVENT', 'Only initial monthly releases are supported; revisions require separate release-stage coverage.');
  if (eventDescriptor.reference.kind !== 'month'
      || typeof value.referencePeriod !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(value.referencePeriod)) {
    hold('HOLD_REFERENCE_PERIOD_MISMATCH', 'Reference period must be explicit YYYY-MM.');
  }
  if (eventDescriptor.clock.kind !== 'iana-local-release' || value.timeZone !== eventDescriptor.clock.timeZone) {
    hold('HOLD_RELEASE_TIME_MISMATCH', 'BLS release times require America/New_York.');
  }
  const resolved = localReleaseInstant(value.eventDate, value.releaseTime, value.timeZone);
  if (!Number.isFinite(instant(value.releaseAt)) || instant(value.releaseAt) !== Date.parse(resolved)) {
    hold('HOLD_RELEASE_TIME_MISMATCH', 'UTC timestamp does not match the local release time.');
  }
  if (!['preview', 'outcome'].includes(value.phase)) hold('HOLD_INVALID_PHASE', 'Phase must be preview or outcome.');
  if (value.statusLabel !== (value.phase === 'preview' ? 'scheduled-confirmed' : 'released')) {
    hold('HOLD_SCHEDULE_CONFLICT', 'Cancellation and rescheduling need a separate reviewed notice.');
  }
  if (value.event !== undefined) {
    const match = parsePublicationEventLabel(eventDescriptor, value.event);
    if (!match || match.publisher !== value.publisher || match.series !== value.series) {
      hold('HOLD_IDENTITY_MISMATCH', 'Editorial event label does not match the structured national BLS series.');
    }
    if (referencePeriod(match.referenceText) !== value.referencePeriod) hold('HOLD_REFERENCE_PERIOD_MISMATCH', 'Editorial event label contradicts the structured reference period.');
  }
  return Object.freeze(Object.fromEntries([
    'publisher', 'series', 'referencePeriod', 'releaseStage', 'eventDate', 'releaseTime', 'timeZone', 'phase', 'statusLabel',
  ].map((key) => [key, value[key]]).concat([['releaseAt', resolved]])));
}
async function loadCalendarRecord(eventDescriptor, candidate, { fetchImpl, now }) {
  if (eventDescriptor.verification.adapter !== 'bls-national-monthly/html-v4') {
    hold('HOLD_UNSUPPORTED_EVENT', 'No verified publication-calendar adapter is enabled for this event family.');
  }
  const { loadBlsMonthlyCalendar } = await import('./bls-cpi-calendar.js');
  return loadBlsMonthlyCalendar(candidate, { fetchImpl, now });
}
function normalizedBinding(binding) {
  if (binding === undefined) return null;
  if (!binding || binding.repository !== 'usdimpact/usd-impact-site'
      || typeof binding.base !== 'string' || typeof binding.head !== 'string' || typeof binding.contentSha256 !== 'string'
      || !/^[a-f0-9]{40}$/.test(binding.base) || !/^[a-f0-9]{40}$/.test(binding.head)
      || !/^[a-f0-9]{64}$/.test(binding.contentSha256 ?? '')) {
    hold('HOLD_REVISION_DRIFT', 'Exact repository, base, head and content digest are required.');
  }
  return Object.freeze({ repository: binding.repository, base: binding.base, head: binding.head, contentSha256: binding.contentSha256 });
}
/** A fresh read is required per invocation. Input evidence, clocks and PASS flags are ignored. */
export async function verifyPublicationCalendar(value, { now = Date.now, fetchImpl = globalThis.fetch, binding } = {}) {
  let candidate;
  let revision = null;
  let record = null;
  let checkedAt;
  try {
    const began = now();
    if (!Number.isFinite(began)) hold('HOLD_INVALID_CLOCK', 'Trusted current time is unavailable.');
    checkedAt = new Date(began).toISOString();
    candidate = normalizeCalendarCandidate(value);
    revision = normalizedBinding(binding);
    const eventDescriptor = publicationEventDescriptor(candidate.publisher, candidate.series);
    record = await loadCalendarRecord(eventDescriptor, candidate, { fetchImpl, now });
    const checked = now();
    if (!Number.isFinite(checked) || checked < began) hold('HOLD_INVALID_CLOCK', 'Trusted clock moved backwards.');
    checkedAt = new Date(checked).toISOString();
    if (record.sources.some((source) => checked < Date.parse(source.fetchedAt) || checked >= Date.parse(source.fetchedAt) + CALENDAR_MAX_AGE_MS)) {
      hold('HOLD_EVIDENCE_STALE', 'Primary evidence exceeded its bounded validity window.');
    }
    for (const field of ['publisher', 'series', 'referencePeriod', 'releaseStage', 'eventDate', 'releaseTime', 'timeZone', 'releaseAt']) {
      if (candidate[field] !== record.event[field]) {
        hold(field === 'referencePeriod' ? 'HOLD_REFERENCE_PERIOD_MISMATCH' : ['publisher', 'series', 'releaseStage'].includes(field) ? 'HOLD_IDENTITY_MISMATCH' : 'HOLD_RELEASE_TIME_MISMATCH', `Candidate ${field} disagrees with the official schedule.`);
      }
    }
    const scheduled = Date.parse(record.event.releaseAt);
    const sameRelease = record.release.referencePeriod === candidate.referencePeriod;
    if (sameRelease && record.release.releaseAt !== record.event.releaseAt) hold('HOLD_SCHEDULE_CONFLICT', 'Schedule and release artifact disagree on the release instant.');
    const released = sameRelease && Date.parse(record.release.releaseAt) <= checked;
    if (candidate.phase === 'preview' && (checked >= scheduled || released || record.release.referencePeriod > candidate.referencePeriod)) {
      hold('HOLD_PREVIEW_EXPIRED', 'A new preview is no longer eligible for this event.');
    }
    if (candidate.phase === 'outcome' && (checked < scheduled || !released)) {
      hold('HOLD_OUTCOME_NOT_RELEASED', 'A matching, non-embargoed official results artifact is required.');
    }
    const validUntil = new Date(Math.min(...record.sources.map((source) => Date.parse(source.fetchedAt) + CALENDAR_MAX_AGE_MS), candidate.phase === 'preview' ? scheduled : Infinity)).toISOString();
    const result = Object.freeze({
      policyVersion: CALENDAR_POLICY_VERSION, decision: 'PASS', reason: 'Official identity, period, timing and phase agree.',
      checkedAt, validUntil, eventIdentity: calendarIdentity(candidate), event: candidate, binding: revision,
      sources: record.sources, publicationAttempted: false, publicationAuthorized: false,
    });
    issuedDecisions.add(result);
    return result;
  } catch (error) {
    return Object.freeze({
      policyVersion: CALENDAR_POLICY_VERSION, decision: error instanceof CalendarHold ? error.code : 'HOLD_INTERNAL_ERROR',
      reason: error instanceof CalendarHold ? error.message : 'Calendar verification could not complete.',
      checkedAt: checkedAt ?? null, validUntil: null, eventIdentity: candidate ? calendarIdentity(candidate) : null,
      binding: revision, sources: record?.sources ?? error?.calendarSources ?? [],
      sourceDiagnostic: error instanceof CalendarHold ? error.sourceDiagnostic ?? null : null,
      publicationAttempted: false, publicationAuthorized: false,
    });
  }
}
/** Reject serialized/forged decisions; this is a freshness check, never merge authorization. */
export function checkCalendarDecisionFreshness(decision, { now = Date.now, binding } = {}) {
  if (!issuedDecisions.has(decision) || decision.decision !== 'PASS') return 'HOLD_UNTRUSTED_EVIDENCE';
  let revision;
  try { revision = normalizedBinding(binding); } catch { return 'HOLD_REVISION_DRIFT'; }
  if (!revision || JSON.stringify(revision) !== JSON.stringify(decision.binding)) return 'HOLD_REVISION_DRIFT';
  const current = now();
  if (!Number.isFinite(current) || current < Date.parse(decision.checkedAt)) return 'HOLD_INVALID_CLOCK';
  if (current >= Date.parse(decision.validUntil)) {
    return decision.event.phase === 'preview' && current >= Date.parse(decision.event.releaseAt) ? 'HOLD_PREVIEW_EXPIRED' : 'HOLD_EVIDENCE_STALE';
  }
  return 'PASS';
}

/** Compare trusted source snapshots, not self-declared publication dates or statuses.
 * The caller must obtain the baseline from the last verified deployed revision.
 * This helper does not discover/authorize that baseline and is not a release gate.
 */
export function classifyPublicationSnapshots(baseSnapshot, headSnapshot) {
  const valid = (snapshot) => snapshot && Object.getPrototypeOf(snapshot) === Object.prototype
    && Object.keys(snapshot).length <= 500
    && Object.entries(snapshot).every(([file, source]) => /^apps\/web\/src\/content\/(news|catalyst-briefs)\/[a-z0-9-]+\.md$/.test(file)
      && typeof source === 'string' && Buffer.byteLength(source) <= 256000);
  if (!valid(baseSnapshot) || !valid(headSnapshot)) hold('HOLD_REVISION_DRIFT', 'Trusted bounded publication source snapshots are required.');
  return Object.freeze([...new Set([...Object.keys(baseSnapshot), ...Object.keys(headSnapshot)])].sort().map((file) => {
    const before = Object.hasOwn(baseSnapshot, file) ? digest(baseSnapshot[file]) : null;
    const after = Object.hasOwn(headSnapshot, file) ? digest(headSnapshot[file]) : null;
    const change = before === after ? 'unchanged' : before === null ? 'added' : after === null ? 'deleted' : 'modified';
    return Object.freeze({ file, change, before, after, requiresCalendarValidation: ['added', 'modified'].includes(change) });
  }));
}
