import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createPublicationReleaseReadinessLease } from '../src/lib/publication-release-lease.js';
import {
  createPublicationAdmissionHandoff,
  PUBLICATION_ADMISSION_HANDOFF_VERSION,
  PUBLICATION_ADMISSION_HANDOFF_SCOPE,
} from '../src/lib/publication-admission-handoff.js';

const BASE = Date.parse('2026-09-11T16:00:00.000Z');
const SHA = 'a'.repeat(40);
const BASE_SHA = 'b'.repeat(40);
const DEPLOYMENT = 'dpl_HandoffCandidate1';
const BASELINE = 'dpl_HandoffBaseline1';
const FILE = 'apps/web/src/content/catalyst-briefs/2026-09-11-cpi-preview.md';
const SOURCE = 'c'.repeat(64);
const BLOB = 'd'.repeat(40);
const iso = (value) => new Date(value).toISOString();
const digest = (value) => createHash('sha256').update(value).digest('hex');
const input = Object.freeze({ expectedMain: SHA, expectedHead: SHA, deploymentId: DEPLOYMENT });

function previewDecision(checkedAt, releaseAt = BASE + 3600000) {
  return {
    policyVersion: 'publication-calendar/v1', decision: 'PASS', reason: 'fixture',
    checkedAt: iso(checkedAt), validUntil: iso(Math.min(checkedAt + 15 * 60_000, releaseAt)),
    eventIdentity: 'BLS:CPI:2026-08:initial',
    event: {
      publisher: 'BLS', series: 'CPI', referencePeriod: '2026-08', releaseStage: 'initial',
      eventDate: '2026-09-11', releaseTime: '08:30', timeZone: 'America/New_York',
      phase: 'preview', statusLabel: 'scheduled-confirmed', releaseAt: iso(releaseAt),
    },
    binding: null,
    sources: [{ url: 'https://www.bls.gov/schedule/news_release/cpi.htm', fetchedAt: iso(checkedAt) }],
    publicationAttempted: false, publicationAuthorized: false,
  };
}

function environment({ noCalendar = false, outcome = false, codeOnly = false, leaseMs = 5000 } = {}) {
  let now = BASE;
  let preflightCalls = 0;
  let mutateSecond = null;
  let advanceAfterConsume = 0;
  let throwPreflight = false;
  const releaseId = randomUUID();

  function observations() {
    if (codeOnly) return [];
    const file = noCalendar ? 'apps/web/src/content/news/2026-09-11.md' : FILE;
    return [{ file, blob: BLOB, contentSha256: SOURCE, status: 'published' }];
  }
  function preflight() {
    const rows = observations();
    const checked = now;
    let decisions = [];
    let decision = 'NO_CALENDAR_ENTRIES';
    let validUntil = null;
    if (!noCalendar) {
      decision = 'PASS';
      const item = previewDecision(checked);
      if (outcome) {
        item.event.phase = 'outcome'; item.event.statusLabel = 'released';
        item.event.releaseAt = iso(BASE - 60_000); item.validUntil = iso(checked + 15 * 60_000);
      }
      decisions = [item]; validUntil = item.validUntil;
    }
    const result = {
      decision: 'PASS_READ_ONLY_PREFLIGHT',
      ...PUBLICATION_ADMISSION_HANDOFF_SCOPE,
      baseline: { id: BASELINE, sha: BASE_SHA }, candidate: { id: DEPLOYMENT, sha: SHA },
      expectedMain: SHA, checkedAt: iso(checked), validUntil: iso(checked + 15 * 60_000),
      contentSetSha256: digest(JSON.stringify(rows)), observations: rows,
      checks: codeOnly ? [] : [{
        file: rows[0].file, boundary: 'staged-release-preflight', decision,
        contentSha256: 'e'.repeat(64), checkedAt: iso(checked), validUntil, decisions,
        publicationAttempted: false, publicationAuthorized: false,
      }],
      publicationAuthorized: false, promotionPerformed: false, enforcementActive: false,
    };
    if (preflightCalls === 2 && mutateSecond) mutateSecond(result);
    return result;
  }
  const runPreflight = async () => {
    preflightCalls++;
    if (throwPreflight) throw new Error('PRIVATE_PREFLIGHT_SECRET');
    return preflight();
  };
  const lease = createPublicationReleaseReadinessLease({ runPreflight, now: () => now, leaseMs });
  const consumeReadiness = async (ticket) => {
    const result = await lease.consume(ticket);
    if (advanceAfterConsume) now += advanceAfterConsume;
    return result;
  };
  const handoff = createPublicationAdmissionHandoff({ consumeReadiness });
  return {
    lease, handoff, releaseId,
    async ticket() { return lease.prepare(input); },
    get now() { return now; }, setNow(value) { now = value; }, advance(value) { now += value; },
    get preflightCalls() { return preflightCalls; }, mutateSecond(fn) { mutateSecond = fn; },
    advanceAfterConsume(value) { advanceAfterConsume = value; }, throwPreflight() { throwPreflight = true; },
  };
}

let groups = 0;
async function test(name, fn) {
  try { await fn(); groups++; }
  catch (error) { error.message = `${name}: ${error.message}`; throw error; }
}
function flags(value) {
  assert.equal(value.publicationAuthorized, false);
  assert.equal(value.promotionPerformed, false);
  assert.equal(value.admissionPrepared, false);
  assert.equal(value.enforcementActive, false);
}
function held(value, code) {
  assert.equal(value.state, 'HOLD');
  assert.equal(value.decision, code);
  flags(value);
}

await test('preview readiness becomes an immutable admission plan without a writer', async () => {
  const env = environment(); const ticket = await env.ticket();
  const result = await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId });
  assert.equal(result.state, 'ADMISSION_HANDOFF_READY');
  assert.equal(result.decision, 'READY_FOR_SEPARATELY_AUTHORIZED_ADMISSION_TRANSACTION');
  assert.equal(result.version, PUBLICATION_ADMISSION_HANDOFF_VERSION);
  assert.equal(result.releaseConstraint.releaseId, env.releaseId);
  assert.equal(result.releaseConstraint.deploymentId, DEPLOYMENT);
  assert.equal(result.releaseConstraint.commitSha, SHA);
  assert.equal(result.admissions.length, 1);
  assert.equal(result.admissions[0].path, '/news/catalysts/2026-09-11-cpi-preview');
  assert.equal(result.admissions[0].sourceSha256, SOURCE);
  assert.equal(result.admissions[0].mode, 'preview');
  assert.equal(result.admissions[0].validUntil, result.releaseConstraint.expiresAt);
  assert.match(result.admissions[0].evidenceSha256, /^[a-f0-9]{64}$/);
  assert.match(result.admissionPlanSha256, /^[a-f0-9]{64}$/);
  assert.equal(env.preflightCalls, 2, 'handoff must reuse the second/final preflight rather than run a third');
  flags(result);
  assert.deepEqual(Object.keys(env.handoff), ['prepare']);
  assert(Object.isFrozen(result) && Object.isFrozen(result.admissions) && Object.isFrozen(result.admissions[0]));
});

await test('no-calendar Daily remains explicit and inherits release expiry', async () => {
  const env = environment({ noCalendar: true }); const ticket = await env.ticket();
  const result = await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId });
  assert.equal(result.admissions[0].path, '/news/2026-09-11');
  assert.equal(result.admissions[0].mode, 'none');
  assert.equal(result.admissions[0].previewDeadline, null);
  assert.equal(result.admissions[0].notBefore, null);
  assert.equal(result.admissions[0].validUntil, result.releaseConstraint.expiresAt);
});

await test('outcome carries not-before and no preview deadline', async () => {
  const env = environment({ outcome: true }); const ticket = await env.ticket();
  const result = await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId });
  assert.equal(result.admissions[0].mode, 'outcome');
  assert.equal(result.admissions[0].previewDeadline, null);
  assert.equal(result.admissions[0].notBefore, iso(BASE - 60_000));
});

await test('code-only release produces an explicit no-admission result', async () => {
  const env = environment({ codeOnly: true }); const ticket = await env.ticket();
  const result = await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId });
  assert.equal(result.state, 'NO_ADMISSION_REQUIRED');
  assert.equal(result.decision, 'NO_PUBLICATION_ADMISSION_REQUIRED');
  assert.deepEqual(result.admissions, []);
  assert.equal(env.preflightCalls, 2);
  flags(result);
});

await test('shorter final calendar evidence narrows the admission deadline', async () => {
  const env = environment(); env.mutateSecond((result) => {
    result.checks[0].validUntil = iso(BASE + 500);
    result.checks[0].decisions[0].validUntil = iso(BASE + 500);
  });
  const ticket = await env.ticket(); env.advance(100);
  const result = await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId });
  assert.equal(result.admissions[0].validUntil, iso(BASE + 500));
});

await test('exact release-readiness deadline is exclusive at evidence handoff', async () => {
  const env = environment({ leaseMs: 1000 }); const ticket = await env.ticket();
  env.advanceAfterConsume(1000);
  held(await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId }), 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
});

await test('one millisecond inside the readiness deadline remains eligible', async () => {
  const env = environment({ leaseMs: 1000 }); const ticket = await env.ticket();
  env.advanceAfterConsume(999);
  const result = await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId });
  assert.equal(result.state, 'ADMISSION_HANDOFF_READY');
});

await test('baseline drift in the final preflight prevents readiness before handoff', async () => {
  const env = environment(); env.mutateSecond((result) => { result.baseline.id = 'dpl_ChangedBaseline1'; });
  const ticket = await env.ticket();
  const result = await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId });
  held(result, 'HOLD_ADMISSION_HANDOFF_READINESS');
  assert.equal(result.upstreamDecision, 'HOLD_RELEASE_LEASE_DRIFT');
});
await test('candidate drift in the final preflight prevents readiness', async () => {
  const env = environment(); env.mutateSecond((result) => { result.candidate.sha = 'f'.repeat(40); });
  const ticket = await env.ticket();
  const result = await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId });
  held(result, 'HOLD_ADMISSION_HANDOFF_READINESS');
});
await test('content-set drift in the final preflight prevents readiness', async () => {
  const env = environment(); env.mutateSecond((result) => {
    result.observations[0].contentSha256 = 'f'.repeat(64);
    result.contentSetSha256 = digest(JSON.stringify(result.observations));
  });
  const ticket = await env.ticket();
  held(await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId }), 'HOLD_ADMISSION_HANDOFF_READINESS');
});

await test('a forged READY object from a substitute consumer cannot expose retained evidence', async () => {
  const handoff = createPublicationAdmissionHandoff({
    consumeReadiness: async () => ({ state: 'READY', decision: 'READY_FOR_SEPARATELY_AUTHORIZED_RELEASE' }),
  });
  const result = await handoff.prepare({ readinessTicket: {}, releaseId: randomUUID() });
  held(result, 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
  assert.equal(result.upstreamDecision, 'HOLD_RELEASE_LEASE_UNTRUSTED_READY');
});

await test('serialized readiness ticket is rejected by the release lease', async () => {
  const env = environment(); const ticket = await env.ticket();
  const result = await env.handoff.prepare({ readinessTicket: JSON.parse(JSON.stringify(ticket)), releaseId: env.releaseId });
  held(result, 'HOLD_ADMISSION_HANDOFF_READINESS');
  assert.equal(result.upstreamDecision, 'HOLD_RELEASE_LEASE_UNTRUSTED_TICKET');
});
await test('readiness ticket cannot be replayed through a second handoff', async () => {
  const env = environment(); const ticket = await env.ticket();
  assert.equal((await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId })).state, 'ADMISSION_HANDOFF_READY');
  const second = await env.handoff.prepare({ readinessTicket: ticket, releaseId: randomUUID() });
  held(second, 'HOLD_ADMISSION_HANDOFF_READINESS');
  assert.equal(second.upstreamDecision, 'HOLD_RELEASE_LEASE_REPLAY');
});

await test('published evidence missing its check is rejected', async () => {
  const env = environment(); env.mutateSecond((result) => { result.checks = []; });
  const ticket = await env.ticket();
  held(await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId }), 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
});
await test('duplicate checks are rejected', async () => {
  const env = environment(); env.mutateSecond((result) => { result.checks.push(structuredClone(result.checks[0])); });
  const ticket = await env.ticket();
  held(await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId }), 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
});
await test('check for nonpublished source is rejected', async () => {
  const env = environment(); env.mutateSecond((result) => {
    result.observations[0].status = 'review'; result.contentSetSha256 = digest(JSON.stringify(result.observations));
  });
  const ticket = await env.ticket();
  held(await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId }), 'HOLD_ADMISSION_HANDOFF_READINESS');
});
await test('mixed preview and outcome decisions are rejected', async () => {
  const env = environment(); env.mutateSecond((result) => {
    const other = structuredClone(result.checks[0].decisions[0]); other.event.phase = 'outcome';
    result.checks[0].decisions.push(other);
  });
  const ticket = await env.ticket();
  held(await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId }), 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
});
await test('no-calendar Catalyst Brief is rejected', async () => {
  const env = environment(); env.mutateSecond((result) => {
    result.checks[0].decision = 'NO_CALENDAR_ENTRIES'; result.checks[0].decisions = []; result.checks[0].validUntil = null;
  });
  const ticket = await env.ticket();
  held(await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId }), 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
});
await test('preview at its release instant is rejected even if a malformed trusted adapter said PASS', async () => {
  const env = environment(); env.mutateSecond((result) => { result.checks[0].decisions[0].event.releaseAt = iso(BASE); });
  const ticket = await env.ticket();
  held(await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId }), 'HOLD_ADMISSION_HANDOFF_EXPIRED');
});
await test('future outcome not-before is rejected', async () => {
  const env = environment({ outcome: true }); env.mutateSecond((result) => { result.checks[0].decisions[0].event.releaseAt = iso(BASE + 60_000); });
  const ticket = await env.ticket();
  held(await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId }), 'HOLD_ADMISSION_HANDOFF_EVIDENCE');
});

await test('invalid release id is rejected before consuming readiness', async () => {
  const env = environment(); const ticket = await env.ticket(); const before = env.preflightCalls;
  held(await env.handoff.prepare({ readinessTicket: ticket, releaseId: 'not-a-uuid' }), 'HOLD_ADMISSION_HANDOFF_INPUT');
  assert.equal(env.preflightCalls, before);
});
await test('caller cannot supply an alternate deadline or admission field', async () => {
  const env = environment(); const ticket = await env.ticket();
  held(await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId, validUntil: iso(BASE + 999999) }), 'HOLD_ADMISSION_HANDOFF_INPUT');
});
await test('preflight adapter exception stays inside release-lease sanitization', async () => {
  const env = environment(); const ticket = await env.ticket(); env.throwPreflight();
  const result = await env.handoff.prepare({ readinessTicket: ticket, releaseId: env.releaseId });
  held(result, 'HOLD_ADMISSION_HANDOFF_READINESS');
  assert.equal(result.upstreamDecision, 'HOLD_RELEASE_LEASE_INTERNAL');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_PREFLIGHT_SECRET/);
});
await test('factory exposes no SQL, writer, promotion or authorization method', async () => {
  const env = environment();
  assert.deepEqual(Object.keys(env.handoff), ['prepare']);
  assert.equal('authorizeRelease' in env.handoff, false);
  assert.equal('prepareAdmission' in env.handoff, false);
  assert.equal('promote' in env.handoff, false);
  assert.equal('publish' in env.handoff, false);
});
await test('missing consume adapter is rejected at construction', async () => {
  assert.throws(() => createPublicationAdmissionHandoff(), /HOLD_ADMISSION_HANDOFF_CONFIG/);
});

console.log(`Publication admission handoff: ${groups} groups passed (offline source-only composition; reuses final readiness evidence; no SQL, provider, route, admission, publication or Production activation).`);
