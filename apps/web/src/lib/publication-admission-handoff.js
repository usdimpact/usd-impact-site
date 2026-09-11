import { createHash } from 'node:crypto';
import { consumePublicationReleaseReadinessEvidence } from './publication-release-lease.js';

export const PUBLICATION_ADMISSION_HANDOFF_VERSION = 'publication-admission-handoff/v1';
export const PUBLICATION_ADMISSION_HANDOFF_SCOPE = Object.freeze({
  repository: 'usdimpact/usd-impact-site',
  projectId: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7',
  canonicalHost: 'www.usd-impact.com',
});

const SHA = /^[a-f0-9]{40}$/;
const HEX = /^[a-f0-9]{64}$/;
const DEPLOYMENT = /^dpl_[A-Za-z0-9]{8,80}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILE = /^apps\/web\/src\/content\/(news|catalyst-briefs)\/([a-z0-9-]+)\.md$/;
const HOLD = /^HOLD_[A-Z0-9_]+$/;
const MAX_EVIDENCE_BYTES = 900_000;
const MAX_CHECK_BYTES = 500_000;

class AdmissionHandoffHold extends Error {
  constructor(code, upstreamDecision = null) {
    super(code);
    this.name = 'AdmissionHandoffHold';
    this.code = code;
    this.upstreamDecision = upstreamDecision;
  }
}

const fail = (code, upstreamDecision = null) => { throw new AdmissionHandoffHold(code, upstreamDecision); };
const need = (value, code) => { if (!value) fail(code); };
const digest = (value) => createHash('sha256').update(value).digest('hex');

function plain(value) {
  return value && Object.getPrototypeOf(value) === Object.prototype;
}
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) freeze(nested);
    Object.freeze(value);
  }
  return value;
}
function copy(value, maxBytes, code) {
  let encoded;
  try { encoded = JSON.stringify(value); } catch { fail(code); }
  need(typeof encoded === 'string' && Buffer.byteLength(encoded) <= maxBytes, code);
  let parsed;
  try { parsed = JSON.parse(encoded); } catch { fail(code); }
  return parsed;
}
function instant(value, code) {
  need(typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), code);
  const time = Date.parse(value);
  need(Number.isFinite(time) && new Date(time).toISOString() === value, code);
  return time;
}
function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function routeForFile(file) {
  const match = file.match(FILE);
  need(match, 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
  return match[1] === 'news' ? `/news/${match[2]}` : `/news/catalysts/${match[2]}`;
}
function holdResult(error) {
  const code = error instanceof AdmissionHandoffHold ? error.code : 'HOLD_ADMISSION_HANDOFF_INTERNAL';
  const result = {
    state: 'HOLD', decision: code,
    publicationAuthorized: false, promotionPerformed: false,
    admissionPrepared: false, enforcementActive: false,
  };
  if (error instanceof AdmissionHandoffHold && error.upstreamDecision) result.upstreamDecision = error.upstreamDecision;
  return freeze(result);
}

function normalizeReadiness(value, consumedAt) {
  need(plain(value), 'HOLD_ADMISSION_HANDOFF_READINESS');
  if (value.state !== 'READY' || value.decision !== 'READY_FOR_SEPARATELY_AUTHORIZED_RELEASE') {
    const upstream = typeof value.decision === 'string' && HOLD.test(value.decision) ? value.decision : null;
    fail('HOLD_ADMISSION_HANDOFF_READINESS', upstream);
  }
  need(value.version === 'publication-release-readiness-lease/v1'
    && Object.entries(PUBLICATION_ADMISSION_HANDOFF_SCOPE).every(([key, expected]) => value[key] === expected),
  'HOLD_ADMISSION_HANDOFF_READINESS');
  need(value.publicationAuthorized === false && value.promotionPerformed === false
    && value.admissionPrepared === false && value.enforcementActive === false,
  'HOLD_ADMISSION_HANDOFF_READINESS');
  need(SHA.test(value.expectedMain ?? '') && value.expectedMain === value.expectedHead
    && DEPLOYMENT.test(value.deploymentId ?? '') && HEX.test(value.contentSetSha256 ?? '')
    && HEX.test(value.releaseLeaseSha256 ?? ''), 'HOLD_ADMISSION_HANDOFF_READINESS');
  need(plain(value.baseline) && DEPLOYMENT.test(value.baseline.id ?? '') && SHA.test(value.baseline.sha ?? '')
    && plain(value.candidate) && value.candidate.id === value.deploymentId && value.candidate.sha === value.expectedHead,
  'HOLD_ADMISSION_HANDOFF_READINESS');
  const preparedCheckedAt = instant(value.preparedCheckedAt, 'HOLD_ADMISSION_HANDOFF_READINESS');
  const finalCheckedAt = instant(value.finalCheckedAt, 'HOLD_ADMISSION_HANDOFF_READINESS');
  const validUntil = instant(value.validUntil, 'HOLD_ADMISSION_HANDOFF_READINESS');
  need(preparedCheckedAt <= finalCheckedAt && finalCheckedAt <= consumedAt && consumedAt < validUntil,
    'HOLD_ADMISSION_HANDOFF_EXPIRED');
  const binding = {
    version: value.version,
    ...PUBLICATION_ADMISSION_HANDOFF_SCOPE,
    expectedMain: value.expectedMain,
    expectedHead: value.expectedHead,
    deploymentId: value.deploymentId,
    baseline: { id: value.baseline.id, sha: value.baseline.sha },
    candidate: { id: value.candidate.id, sha: value.candidate.sha },
    contentSetSha256: value.contentSetSha256,
    preparedCheckedAt: value.preparedCheckedAt,
    finalCheckedAt: value.finalCheckedAt,
    validUntil: value.validUntil,
  };
  need(digest(JSON.stringify(binding)) === value.releaseLeaseSha256, 'HOLD_ADMISSION_HANDOFF_READINESS');
  return freeze({ ...binding, releaseLeaseSha256: value.releaseLeaseSha256 });
}

function normalizeObservations(value) {
  need(Array.isArray(value) && value.length <= 20, 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
  const seen = new Set();
  return value.map((row) => {
    need(plain(row) && Object.keys(row).length === 4
      && ['file', 'blob', 'contentSha256', 'status'].every((key) => Object.hasOwn(row, key)),
    'HOLD_ADMISSION_HANDOFF_EVIDENCE');
    need(FILE.test(row.file) && SHA.test(row.blob ?? '') && HEX.test(row.contentSha256 ?? '')
      && typeof row.status === 'string' && /^[a-z-]{1,32}$/.test(row.status) && !seen.has(row.file),
    'HOLD_ADMISSION_HANDOFF_EVIDENCE');
    seen.add(row.file);
    return { file: row.file, blob: row.blob, contentSha256: row.contentSha256, status: row.status };
  });
}

function normalizeEvidence(value, readiness) {
  need(plain(value), 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
  if (value.state !== 'RELEASE_READINESS_EVIDENCE' || value.decision !== 'PASS_RELEASE_READINESS_EVIDENCE') {
    const upstream = typeof value.decision === 'string' && HOLD.test(value.decision) ? value.decision : null;
    fail('HOLD_ADMISSION_HANDOFF_EVIDENCE', upstream);
  }
  need(value.publicationAuthorized === false && value.promotionPerformed === false
    && value.admissionPrepared === false && value.enforcementActive === false,
  'HOLD_ADMISSION_HANDOFF_EVIDENCE');
  need(value.releaseLeaseSha256 === readiness.releaseLeaseSha256
    && value.contentSetSha256 === readiness.contentSetSha256,
  'HOLD_ADMISSION_HANDOFF_DRIFT');
  const observations = normalizeObservations(value.observations);
  need(digest(JSON.stringify(observations)) === value.contentSetSha256, 'HOLD_ADMISSION_HANDOFF_DRIFT');
  const preflightCheckedAt = instant(value.preflightCheckedAt, 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
  const preflightValidUntil = instant(value.preflightValidUntil, 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
  const consumedAt = instant(value.consumedAt, 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
  need(value.preflightCheckedAt === readiness.finalCheckedAt
    && preflightCheckedAt <= consumedAt && consumedAt < preflightValidUntil
    && consumedAt < Date.parse(readiness.validUntil), 'HOLD_ADMISSION_HANDOFF_EXPIRED');
  need(Array.isArray(value.checks) && value.checks.length <= observations.length,
    'HOLD_ADMISSION_HANDOFF_EVIDENCE');
  return freeze({
    observations,
    checks: copy(value.checks, MAX_EVIDENCE_BYTES, 'HOLD_ADMISSION_HANDOFF_EVIDENCE'),
    preflightCheckedAt: value.preflightCheckedAt,
    preflightValidUntil: value.preflightValidUntil,
    consumedAt: value.consumedAt,
  });
}

function decisionReleaseAt(value) {
  need(plain(value) && value.decision === 'PASS' && value.publicationAttempted === false
    && value.publicationAuthorized === false && plain(value.event), 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
  need(['preview', 'outcome'].includes(value.event.phase), 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
  return instant(value.event.releaseAt, 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
}

function admissionsFrom(evidence, readiness, releaseId) {
  const current = Date.parse(evidence.consumedAt);
  const observations = new Map(evidence.observations.map((row) => [row.file, row]));
  const checks = new Map();
  for (const raw of evidence.checks) {
    need(plain(raw) && typeof raw.file === 'string' && observations.has(raw.file) && !checks.has(raw.file),
      'HOLD_ADMISSION_HANDOFF_EVIDENCE');
    const row = observations.get(raw.file);
    need(row.status === 'published', 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
    need(raw.boundary === 'staged-release-preflight' && HEX.test(raw.contentSha256 ?? '')
      && raw.publicationAttempted === false && raw.publicationAuthorized === false,
    'HOLD_ADMISSION_HANDOFF_EVIDENCE');
    const checked = instant(raw.checkedAt, 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
    need(checked <= current, 'HOLD_ADMISSION_HANDOFF_EXPIRED');
    need(Array.isArray(raw.decisions) && raw.decisions.length <= 10,
      'HOLD_ADMISSION_HANDOFF_EVIDENCE');
    checks.set(raw.file, copy(raw, MAX_CHECK_BYTES, 'HOLD_ADMISSION_HANDOFF_EVIDENCE'));
  }

  const published = evidence.observations.filter((row) => row.status === 'published');
  need(published.length === checks.size && published.every((row) => checks.has(row.file)),
    'HOLD_ADMISSION_HANDOFF_EVIDENCE');

  const rows = [];
  for (const observation of published) {
    const check = checks.get(observation.file);
    let mode;
    let previewDeadline = null;
    let notBefore = null;
    let calendarValidUntil = Date.parse(evidence.preflightValidUntil);
    if (check.decision === 'NO_CALENDAR_ENTRIES') {
      need(check.decisions.length === 0 && observation.file.includes('/news/'),
        'HOLD_ADMISSION_HANDOFF_EVIDENCE');
      mode = 'none';
    } else {
      need(check.decision === 'PASS' && check.decisions.length > 0 && check.validUntil !== null,
        'HOLD_ADMISSION_HANDOFF_EVIDENCE');
      const phases = new Set(check.decisions.map((decision) => decision?.event?.phase));
      need(phases.size === 1 && ['preview', 'outcome'].includes([...phases][0]),
        'HOLD_ADMISSION_HANDOFF_EVIDENCE');
      mode = [...phases][0];
      const releaseTimes = check.decisions.map(decisionReleaseAt);
      calendarValidUntil = Math.min(calendarValidUntil,
        instant(check.validUntil, 'HOLD_ADMISSION_HANDOFF_EVIDENCE'));
      if (mode === 'preview') previewDeadline = new Date(Math.min(...releaseTimes)).toISOString();
      else notBefore = new Date(Math.max(...releaseTimes)).toISOString();
    }
    const validUntil = Math.min(calendarValidUntil, Date.parse(readiness.validUntil));
    need(current < validUntil, 'HOLD_ADMISSION_HANDOFF_EXPIRED');
    if (previewDeadline !== null) need(current < Date.parse(previewDeadline), 'HOLD_ADMISSION_HANDOFF_EXPIRED');
    if (notBefore !== null) need(current >= Date.parse(notBefore), 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
    const checkedAt = check.checkedAt;
    need(Date.parse(checkedAt) < validUntil && validUntil - Date.parse(checkedAt) <= 15 * 60_000,
      'HOLD_ADMISSION_HANDOFF_EVIDENCE');
    rows.push({
      releaseId,
      path: routeForFile(observation.file),
      sourceSha256: observation.contentSha256,
      mode,
      evidenceSha256: digest(JSON.stringify(check)),
      checkedAt,
      validUntil: new Date(validUntil).toISOString(),
      previewDeadline,
      notBefore,
    });
  }
  rows.sort((a, b) => a.path.localeCompare(b.path));
  return freeze(rows);
}

/**
 * Dormant source-only handoff. It consumes the already one-use readiness ticket
 * and then consumes the exact final preflight retained behind that READY object's
 * in-process identity. No third network preflight is introduced.
 *
 * It emits exact arguments for a future separately authorized controller but
 * never calls SQL, a provider promotion API, a route, or a publication writer.
 * Every admission validUntil is capped by the release-readiness deadline. The
 * existing database writer checks that timestamp with clock_timestamp() after
 * lock waits, so a delayed future database operation cannot widen the deadline
 * by reusing this plan unchanged.
 */
export function createPublicationAdmissionHandoff({ consumeReadiness } = {}) {
  need(typeof consumeReadiness === 'function', 'HOLD_ADMISSION_HANDOFF_CONFIG');
  let sequence = 0;

  async function prepare(input) {
    const mySequence = ++sequence;
    try {
      need(plain(input) && Object.keys(input).length === 2
        && Object.hasOwn(input, 'readinessTicket') && Object.hasOwn(input, 'releaseId')
        && UUID.test(input.releaseId ?? ''), 'HOLD_ADMISSION_HANDOFF_INPUT');
      const rawReadiness = await consumeReadiness(input.readinessTicket);
      need(mySequence === sequence, 'HOLD_ADMISSION_HANDOFF_SUPERSEDED');
      if (rawReadiness?.state !== 'READY' || rawReadiness?.decision !== 'READY_FOR_SEPARATELY_AUTHORIZED_RELEASE') {
        const upstream = typeof rawReadiness?.decision === 'string' && HOLD.test(rawReadiness.decision) ? rawReadiness.decision : null;
        fail('HOLD_ADMISSION_HANDOFF_READINESS', upstream);
      }
      const rawEvidence = consumePublicationReleaseReadinessEvidence(rawReadiness);
      need(mySequence === sequence, 'HOLD_ADMISSION_HANDOFF_SUPERSEDED');
      if (rawEvidence?.state !== 'RELEASE_READINESS_EVIDENCE') {
        const upstream = typeof rawEvidence?.decision === 'string' && HOLD.test(rawEvidence.decision) ? rawEvidence.decision : null;
        fail('HOLD_ADMISSION_HANDOFF_EVIDENCE', upstream);
      }
      const evidenceCopy = copy(rawEvidence, MAX_EVIDENCE_BYTES, 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
      const consumedAt = instant(evidenceCopy.consumedAt, 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
      const readiness = normalizeReadiness(copy(rawReadiness, 100_000, 'HOLD_ADMISSION_HANDOFF_READINESS'), consumedAt);
      const evidence = normalizeEvidence(evidenceCopy, readiness);
      const admissions = admissionsFrom(evidence, readiness, input.releaseId);
      const releaseConstraint = freeze({
        releaseId: input.releaseId,
        deploymentId: readiness.deploymentId,
        commitSha: readiness.expectedHead,
        expiresAt: readiness.validUntil,
        releaseLeaseSha256: readiness.releaseLeaseSha256,
        contentSetSha256: readiness.contentSetSha256,
      });
      const binding = {
        version: PUBLICATION_ADMISSION_HANDOFF_VERSION,
        ...PUBLICATION_ADMISSION_HANDOFF_SCOPE,
        releaseConstraint,
        admissions,
      };
      return freeze({
        state: admissions.length ? 'ADMISSION_HANDOFF_READY' : 'NO_ADMISSION_REQUIRED',
        decision: admissions.length ? 'READY_FOR_SEPARATELY_AUTHORIZED_ADMISSION_TRANSACTION' : 'NO_PUBLICATION_ADMISSION_REQUIRED',
        ...binding,
        admissionPlanSha256: digest(JSON.stringify(binding)),
        publicationAuthorized: false,
        promotionPerformed: false,
        admissionPrepared: false,
        enforcementActive: false,
      });
    } catch (error) {
      return holdResult(error);
    }
  }

  return Object.freeze({ prepare });
}
