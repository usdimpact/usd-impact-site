import { createHash } from 'node:crypto';

export const PUBLICATION_RELEASE_LEASE_VERSION = 'publication-release-readiness-lease/v1';
export const PUBLICATION_RELEASE_SCOPE = Object.freeze({
  repository: 'usdimpact/usd-impact-site',
  projectId: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7',
  canonicalHost: 'www.usd-impact.com',
});

const SHA = /^[a-f0-9]{40}$/;
const HEX = /^[a-f0-9]{64}$/;
const DEPLOYMENT = /^dpl_[A-Za-z0-9]{8,80}$/;
const FILE = /^apps\/web\/src\/content\/(?:news|catalyst-briefs)\/[a-z0-9-]+\.md$/;
const INPUT_FIELDS = Object.freeze(['expectedMain', 'expectedHead', 'deploymentId']);
const MAX_PREFLIGHT_AGE_MS = 15 * 60 * 1000;
const DEFAULT_LEASE_MS = 5000;
const readyEvidence = new WeakMap();

class ReleaseLeaseHold extends Error {
  constructor(code, upstreamDecision = null) {
    super(code);
    this.name = 'ReleaseLeaseHold';
    this.code = code;
    this.upstreamDecision = upstreamDecision;
  }
}

const fail = (code, upstreamDecision = null) => { throw new ReleaseLeaseHold(code, upstreamDecision); };
const need = (value, code) => { if (!value) fail(code); };
const digest = (value) => createHash('sha256').update(value).digest('hex');

function plain(value) {
  return value && Object.getPrototypeOf(value) === Object.prototype;
}

function copy(value, maxBytes, code) {
  let encoded;
  try { encoded = JSON.stringify(value); } catch { fail(code); }
  need(typeof encoded === 'string' && Buffer.byteLength(encoded) <= maxBytes, code);
  let parsed;
  try { parsed = JSON.parse(encoded); } catch { fail(code); }
  return parsed;
}

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) freeze(nested);
    Object.freeze(value);
  }
  return value;
}

function instant(value, code) {
  need(typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), code);
  const time = Date.parse(value);
  need(Number.isFinite(time) && new Date(time).toISOString() === value, code);
  return time;
}

function normalizeInput(value) {
  need(plain(value), 'HOLD_RELEASE_LEASE_INPUT');
  const keys = Object.keys(value).sort();
  const expected = [...INPUT_FIELDS].sort();
  need(keys.length === expected.length && keys.every((key, index) => key === expected[index]), 'HOLD_RELEASE_LEASE_INPUT');
  need(SHA.test(value.expectedMain) && SHA.test(value.expectedHead)
    && value.expectedMain === value.expectedHead && DEPLOYMENT.test(value.deploymentId), 'HOLD_RELEASE_LEASE_INPUT');
  return freeze({ expectedMain: value.expectedMain, expectedHead: value.expectedHead, deploymentId: value.deploymentId });
}

function observations(value) {
  need(Array.isArray(value) && value.length <= 20, 'HOLD_RELEASE_LEASE_PREFLIGHT');
  const files = new Set();
  const normalized = value.map((row) => {
    need(plain(row) && Object.keys(row).length === 4 && ['file','blob','contentSha256','status'].every((key) => Object.hasOwn(row, key)),
      'HOLD_RELEASE_LEASE_PREFLIGHT');
    need(FILE.test(row.file) && SHA.test(row.blob) && HEX.test(row.contentSha256)
      && typeof row.status === 'string' && /^[a-z-]{1,32}$/.test(row.status) && !files.has(row.file),
      'HOLD_RELEASE_LEASE_PREFLIGHT');
    files.add(row.file);
    return { file: row.file, blob: row.blob, contentSha256: row.contentSha256, status: row.status };
  });
  return normalized;
}

function normalizePreflight(value, input, observedNow) {
  need(plain(value), 'HOLD_RELEASE_LEASE_PREFLIGHT');
  if (value.decision !== 'PASS_READ_ONLY_PREFLIGHT') {
    const upstream = typeof value.decision === 'string' && /^HOLD_[A-Z0-9_]+$/.test(value.decision) ? value.decision : null;
    fail('HOLD_RELEASE_LEASE_PREFLIGHT', upstream);
  }
  need(Object.entries(PUBLICATION_RELEASE_SCOPE).every(([key, expected]) => value[key] === expected),
    'HOLD_RELEASE_LEASE_PREFLIGHT');
  need(value.publicationAuthorized === false && value.promotionPerformed === false && value.enforcementActive === false,
    'HOLD_RELEASE_LEASE_PREFLIGHT');
  need(value.expectedMain === input.expectedMain, 'HOLD_RELEASE_LEASE_DRIFT');
  need(plain(value.baseline) && DEPLOYMENT.test(value.baseline.id) && SHA.test(value.baseline.sha)
    && plain(value.candidate) && value.candidate.id === input.deploymentId && value.candidate.sha === input.expectedHead,
    'HOLD_RELEASE_LEASE_DRIFT');
  need(HEX.test(value.contentSetSha256), 'HOLD_RELEASE_LEASE_PREFLIGHT');
  const rows = observations(value.observations);
  need(digest(JSON.stringify(rows)) === value.contentSetSha256, 'HOLD_RELEASE_LEASE_PREFLIGHT');
  need(Array.isArray(value.checks) && value.checks.length <= 20, 'HOLD_RELEASE_LEASE_PREFLIGHT');
  const checks = copy(value.checks, 750_000, 'HOLD_RELEASE_LEASE_PREFLIGHT');
  const checkedAt = instant(value.checkedAt, 'HOLD_RELEASE_LEASE_PREFLIGHT');
  const validUntil = instant(value.validUntil, 'HOLD_RELEASE_LEASE_PREFLIGHT');
  need(checkedAt <= observedNow && observedNow < validUntil && validUntil - checkedAt <= MAX_PREFLIGHT_AGE_MS,
    'HOLD_RELEASE_LEASE_EXPIRED');
  return freeze({
    ...PUBLICATION_RELEASE_SCOPE,
    expectedMain: input.expectedMain,
    expectedHead: input.expectedHead,
    deploymentId: input.deploymentId,
    baseline: { id: value.baseline.id, sha: value.baseline.sha },
    candidate: { id: value.candidate.id, sha: value.candidate.sha },
    contentSetSha256: value.contentSetSha256,
    observations: rows,
    checks,
    checkedAt: value.checkedAt,
    validUntil: value.validUntil,
  });
}

function sameRelease(left, right) {
  const omitTime = (value) => ({
    repository: value.repository,
    projectId: value.projectId,
    canonicalHost: value.canonicalHost,
    expectedMain: value.expectedMain,
    expectedHead: value.expectedHead,
    deploymentId: value.deploymentId,
    baseline: value.baseline,
    candidate: value.candidate,
    contentSetSha256: value.contentSetSha256,
  });
  return JSON.stringify(omitTime(left)) === JSON.stringify(omitTime(right));
}

function holdResult(error) {
  const code = error instanceof ReleaseLeaseHold ? error.code : 'HOLD_RELEASE_LEASE_INTERNAL';
  const result = {
    state: 'HOLD',
    decision: code,
    publicationAuthorized: false,
    promotionPerformed: false,
    admissionPrepared: false,
    enforcementActive: false,
  };
  if (error instanceof ReleaseLeaseHold && error.upstreamDecision) result.upstreamDecision = error.upstreamDecision;
  return freeze(result);
}

/**
 * Consume the exact final preflight retained behind a READY object's in-process
 * identity. This is one use, uses the original lease clock, and exposes no write
 * or provider operation. Serialized or reconstructed READY objects are rejected.
 */
export function consumePublicationReleaseReadinessEvidence(ready) {
  let state = null;
  try {
    need(ready && typeof ready === 'object' && readyEvidence.has(ready), 'HOLD_RELEASE_LEASE_UNTRUSTED_READY');
    state = readyEvidence.get(ready);
    need(!state.spent, 'HOLD_RELEASE_LEASE_EVIDENCE_REPLAY');
    state.spent = true;
    const current = state.clock();
    need(current < state.expiresAt, 'HOLD_RELEASE_LEASE_EXPIRED');
    return freeze({
      state: 'RELEASE_READINESS_EVIDENCE',
      decision: 'PASS_RELEASE_READINESS_EVIDENCE',
      releaseLeaseSha256: ready.releaseLeaseSha256,
      contentSetSha256: state.fresh.contentSetSha256,
      observations: state.fresh.observations,
      checks: state.fresh.checks,
      preflightCheckedAt: state.fresh.checkedAt,
      preflightValidUntil: state.fresh.validUntil,
      consumedAt: new Date(current).toISOString(),
      publicationAuthorized: false,
      promotionPerformed: false,
      admissionPrepared: false,
      enforcementActive: false,
    });
  } catch (error) {
    return holdResult(error);
  }
}

/**
 * Dormant final-readiness lease. It deliberately exposes no provider promotion,
 * admission write, merge or publication method. A protected future controller
 * may use this only as a fail-closed prerequisite immediately before a separately
 * authorized atomic serving/admission boundary.
 *
 * runPreflight must be a trusted server-only adapter for the complete read-only
 * staged-Production preflight. The lease runs it once to prepare and again to
 * consume. Serialized/cloned tickets are rejected through WeakMap identity.
 */
export function createPublicationReleaseReadinessLease({ runPreflight, now = Date.now, leaseMs = DEFAULT_LEASE_MS } = {}) {
  need(typeof runPreflight === 'function' && typeof now === 'function'
    && Number.isInteger(leaseMs) && leaseMs >= 1000 && leaseMs <= 15000,
    'HOLD_RELEASE_LEASE_CONFIG');

  const tickets = new WeakMap();
  let highestTime = -1;
  let sequence = 0;
  let epoch = 0;

  function clock() {
    const value = now();
    need(Number.isSafeInteger(value) && value >= 0 && value >= highestTime, 'HOLD_RELEASE_LEASE_CLOCK');
    highestTime = value;
    return value;
  }

  async function prepare(rawInput) {
    const mySequence = ++sequence;
    const myEpoch = ++epoch;
    try {
      const input = normalizeInput(copy(rawInput, 2048, 'HOLD_RELEASE_LEASE_INPUT'));
      const started = clock();
      const rawPreflight = await runPreflight(input);
      need(mySequence === sequence && myEpoch === epoch, 'HOLD_RELEASE_LEASE_SUPERSEDED');
      const observed = clock();
      const preflight = normalizePreflight(copy(rawPreflight, 1_000_000, 'HOLD_RELEASE_LEASE_PREFLIGHT'), input, observed);
      const expiresAt = Math.min(Date.parse(preflight.validUntil), started + leaseMs);
      need(observed < expiresAt, 'HOLD_RELEASE_LEASE_EXPIRED');
      const ticket = Object.freeze({
        state: 'PREPARED_RELEASE_READINESS_LEASE',
        version: PUBLICATION_RELEASE_LEASE_VERSION,
        publicationAuthorized: false,
        promotionPerformed: false,
        admissionPrepared: false,
        enforcementActive: false,
      });
      tickets.set(ticket, { input, preflight, expiresAt, epoch: myEpoch, spent: false, consuming: false });
      return ticket;
    } catch (error) {
      if (mySequence === sequence && myEpoch === epoch) epoch++;
      return holdResult(error);
    }
  }

  async function consume(ticket) {
    let state = null;
    try {
      need(ticket && typeof ticket === 'object' && tickets.has(ticket), 'HOLD_RELEASE_LEASE_UNTRUSTED_TICKET');
      state = tickets.get(ticket);
      need(state.epoch === epoch, 'HOLD_RELEASE_LEASE_SUPERSEDED');
      need(!state.spent && !state.consuming, 'HOLD_RELEASE_LEASE_REPLAY');
      state.consuming = true;
      state.spent = true;
      const before = clock();
      need(before < state.expiresAt, 'HOLD_RELEASE_LEASE_EXPIRED');
      const rawPreflight = await runPreflight(state.input);
      need(state.epoch === epoch, 'HOLD_RELEASE_LEASE_SUPERSEDED');
      const observed = clock();
      const fresh = normalizePreflight(copy(rawPreflight, 1_000_000, 'HOLD_RELEASE_LEASE_PREFLIGHT'), state.input, observed);
      need(sameRelease(state.preflight, fresh), 'HOLD_RELEASE_LEASE_DRIFT');
      const expiresAt = Math.min(state.expiresAt, Date.parse(fresh.validUntil));
      need(observed < expiresAt, 'HOLD_RELEASE_LEASE_EXPIRED');
      const leaseBinding = {
        version: PUBLICATION_RELEASE_LEASE_VERSION,
        ...PUBLICATION_RELEASE_SCOPE,
        expectedMain: fresh.expectedMain,
        expectedHead: fresh.expectedHead,
        deploymentId: fresh.deploymentId,
        baseline: fresh.baseline,
        candidate: fresh.candidate,
        contentSetSha256: fresh.contentSetSha256,
        preparedCheckedAt: state.preflight.checkedAt,
        finalCheckedAt: fresh.checkedAt,
        validUntil: new Date(expiresAt).toISOString(),
      };
      const ready = freeze({
        state: 'READY',
        decision: 'READY_FOR_SEPARATELY_AUTHORIZED_RELEASE',
        ...leaseBinding,
        releaseLeaseSha256: digest(JSON.stringify(leaseBinding)),
        publicationAuthorized: false,
        promotionPerformed: false,
        admissionPrepared: false,
        enforcementActive: false,
      });
      readyEvidence.set(ready, { fresh, expiresAt, clock, spent: false });
      return ready;
    } catch (error) {
      return holdResult(error);
    } finally {
      if (state) state.consuming = false;
    }
  }

  return Object.freeze({ prepare, consume });
}
