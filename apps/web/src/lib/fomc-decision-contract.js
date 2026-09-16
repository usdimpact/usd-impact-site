import { types } from 'node:util';

// Pure assertion diagnostics only: no source reads, calendar lease or authority.
export const FOMC_ASSERTION_SCHEMA = 'fomc-decision-assertion/v1';
export const FOMC_CONTRACT_VERSION = 'fomc-decision-contract/v1';
export const FOMC_ASSERTION_FIELDS = Object.freeze([
  'schema', 'publisher', 'committee', 'eventKind', 'meetingKind',
  'meetingStartDate', 'meetingEndDate', 'decisionDate',
  'releaseTime', 'timeZone', 'releaseAt',
]);
const REQUEST_FIELDS = Object.freeze(['assertion', 'phase', 'statusLabel']);
const DAY_MS = 86400000;
const IDENTITY_FIELDS = Object.freeze([
  'publisher', 'committee', 'eventKind', 'meetingKind', 'meetingStartDate', 'meetingEndDate',
]);

export class FomcContractHold extends Error {
  constructor(code) { super(code); this.name = 'FomcContractHold'; this.code = code; }
}
function hold(code) { throw new FomcContractHold(code); }

/** Inspect descriptors before values; never invoke accessors or proxy traps. */
function ownDataRecord(value, fields) {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value)) {
    hold('HOLD_FOMC_ASSERTION_SHAPE');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) hold('HOLD_FOMC_ASSERTION_SHAPE');
  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length || keys.some((key) => typeof key !== 'string' || !fields.includes(key))) {
    hold('HOLD_FOMC_ASSERTION_SHAPE');
  }
  const result = Object.create(null);
  for (const key of fields) {
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (!property || !property.enumerable || !Object.hasOwn(property, 'value')) hold('HOLD_FOMC_ASSERTION_SHAPE');
    result[key] = property.value;
  }
  return result;
}

function dateMilliseconds(value) {
  if (!/^20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(value)) hold('HOLD_FOMC_DATES');
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 10) !== value) {
    hold('HOLD_FOMC_DATES');
  }
  return milliseconds;
}

function regularStatementInstant(date) {
  // Derive offsets from the IANA zone for this date; never assume permanent UTC-4/5.
  const naive = Date.parse(`${date}T14:00:00.000Z`);
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    const wallClock = (instant) => {
      const parts = Object.fromEntries(formatter.formatToParts(instant).map(({ type, value }) => [type, value]));
      return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
    };
    const offsets = new Set([-36, -24, -12, 0, 12, 24, 36].map((hours) => {
      const probe = naive + hours * 3600000;
      return Date.parse(`${wallClock(probe)}Z`) - probe;
    }));
    const matches = [...offsets].map((offset) => naive - offset)
      .filter((instant) => wallClock(instant) === `${date}T14:00:00`);
    if (matches.length !== 1 || !Number.isFinite(matches[0])) hold('HOLD_FOMC_RELEASE_TIME');
    return new Date(matches[0]).toISOString();
  } catch { hold('HOLD_FOMC_RELEASE_TIME'); }
}

/** Valid shape does not prove that a meeting exists or its asserted schedule is current. */
export function normalizeFomcDecisionAssertion(value) {
  const data = ownDataRecord(value, FOMC_ASSERTION_FIELDS);
  for (const field of FOMC_ASSERTION_FIELDS) {
    if (typeof data[field] !== 'string' || !data[field] || data[field].length > 80 || data[field].trim() !== data[field]) {
      hold('HOLD_FOMC_ASSERTION_SHAPE');
    }
  }
  if (data.schema !== FOMC_ASSERTION_SCHEMA) hold('HOLD_FOMC_ASSERTION_SHAPE');
  if (data.publisher !== 'FEDERAL_RESERVE' || data.committee !== 'FOMC'
      || data.eventKind !== 'policy-decision' || data.meetingKind !== 'scheduled-two-day') {
    hold('HOLD_FOMC_UNSUPPORTED_EVENT');
  }
  const start = dateMilliseconds(data.meetingStartDate);
  const end = dateMilliseconds(data.meetingEndDate);
  dateMilliseconds(data.decisionDate);
  if (end - start !== DAY_MS || data.decisionDate !== data.meetingEndDate) hold('HOLD_FOMC_DATES');
  if (data.releaseTime !== '14:00' || data.timeZone !== 'America/New_York') hold('HOLD_FOMC_RELEASE_TIME');
  const releaseAt = regularStatementInstant(data.decisionDate);
  // Accept the two equivalent whole-second UTC encodings, but no other repair/coercion.
  if (data.releaseAt !== releaseAt && data.releaseAt !== releaseAt.replace('.000Z', 'Z')) hold('HOLD_FOMC_RELEASE_TIME');
  return Object.freeze({ ...data, releaseAt });
}

function identityOf(assertion) {
  return `fomc-decision/v1|${IDENTITY_FIELDS.map((key) => `${key}=${encodeURIComponent(assertion[key])}`).join('|')}`;
}
function checkedPhase(phase) {
  if (phase !== 'preview' && phase !== 'outcome') hold('HOLD_FOMC_PHASE');
  return phase;
}

/** Phase and mutable timing are excluded from event identity; no legacy mapping is inferred. */
export function fomcDecisionIdentity(assertion) {
  return identityOf(normalizeFomcDecisionAssertion(assertion));
}
export function fomcDecisionPhaseKey(assertion, phase) {
  return `${fomcDecisionIdentity(assertion)}|phase=${checkedPhase(phase)}`;
}

/** The explicit clock is diagnostic input, not a trusted runtime clock or release approval. */
export function inspectFomcDecisionContract(request, observedAtMilliseconds) {
  const data = ownDataRecord(request, REQUEST_FIELDS);
  const assertion = normalizeFomcDecisionAssertion(data.assertion);
  const phase = checkedPhase(data.phase);
  if (data.statusLabel !== (phase === 'preview' ? 'scheduled-confirmed' : 'released')) hold('HOLD_FOMC_PHASE');
  if (!Number.isSafeInteger(observedAtMilliseconds) || observedAtMilliseconds < 0
      || observedAtMilliseconds > 8640000000000000) hold('HOLD_FOMC_CLOCK');
  const release = Date.parse(assertion.releaseAt);
  const eventIdentity = identityOf(assertion);
  return Object.freeze({
    contractVersion: FOMC_CONTRACT_VERSION,
    decision: 'ASSERTION_VALID_NOT_VERIFIED',
    assertion, phase, statusLabel: data.statusLabel,
    eventIdentity, phaseKey: `${eventIdentity}|phase=${phase}`,
    diagnosticAt: new Date(observedAtMilliseconds).toISOString(),
    clockBasis: 'caller-supplied-diagnostic-only',
    clockRelation: observedAtMilliseconds < release ? 'BEFORE_ASSERTED_RELEASE'
      : observedAtMilliseconds === release ? 'AT_ASSERTED_RELEASE' : 'AFTER_ASSERTED_RELEASE',
    previewDeadlineElapsed: observedAtMilliseconds >= release,
    outcomeEvidence: 'NOT_CHECKED',
    freshSourceVerificationPerformed: false,
    calendarLeaseIssued: false,
    publicationAuthorized: false,
    enforcementActive: false,
  });
}
