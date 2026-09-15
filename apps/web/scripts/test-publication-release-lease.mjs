import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  createPublicationReleaseReadinessLease,
  PUBLICATION_RELEASE_LEASE_VERSION,
  PUBLICATION_RELEASE_SCOPE,
} from '../src/lib/publication-release-lease.js';

const BASE = Date.parse('2026-09-11T15:00:00.000Z');
const SHA = 'a'.repeat(40);
const DEPLOYMENT = 'dpl_LeaseFixture123';
const BASELINE = 'dpl_BaselineFixture1';
const OBSERVATIONS = Object.freeze([
  Object.freeze({
    file: 'apps/web/src/content/catalyst-briefs/2026-09-11-cpi-preview.md',
    blob: 'b'.repeat(40), contentSha256: 'c'.repeat(64), status: 'published',
  }),
]);
const contentSetSha256 = createHash('sha256').update(JSON.stringify(OBSERVATIONS)).digest('hex');
const input = Object.freeze({ expectedMain: SHA, expectedHead: SHA, deploymentId: DEPLOYMENT });
const iso = (value) => new Date(value).toISOString();

function environment({ leaseMs = 5000 } = {}) {
  let now = BASE;
  let calls = 0;
  let deferredCall = null;
  const state = {
    decision: 'PASS_READ_ONLY_PREFLIGHT',
    repository: PUBLICATION_RELEASE_SCOPE.repository,
    projectId: PUBLICATION_RELEASE_SCOPE.projectId,
    canonicalHost: PUBLICATION_RELEASE_SCOPE.canonicalHost,
    baseline: { id: BASELINE, sha: 'd'.repeat(40) },
    candidate: { id: DEPLOYMENT, sha: SHA },
    expectedMain: SHA,
    contentSetSha256,
    observations: OBSERVATIONS,
    checks: [],
    publicationAuthorized: false,
    promotionPerformed: false,
    enforcementActive: false,
  };
  const runPreflight = async () => {
    calls++;
    if (deferredCall) await deferredCall();
    return { ...state, checkedAt: iso(now), validUntil: iso(now + 60_000) };
  };
  const lease = createPublicationReleaseReadinessLease({ runPreflight, now: () => now, leaseMs });
  return {
    lease, state,
    setNow(value) { now = value; },
    advance(value) { now += value; },
    get now() { return now; },
    get calls() { return calls; },
    defer(callback) { deferredCall = callback; },
  };
}

const tests = [];
async function test(name, work) {
  try { await work(); tests.push(name); }
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

await test('valid ticket reruns preflight before readiness and never authorizes', async () => {
  const env = environment();
  const ticket = await env.lease.prepare(input);
  assert.equal(ticket.state, 'PREPARED_RELEASE_READINESS_LEASE');
  assert.equal(ticket.version, PUBLICATION_RELEASE_LEASE_VERSION);
  flags(ticket);
  const ready = await env.lease.consume(ticket);
  assert.equal(ready.decision, 'READY_FOR_SEPARATELY_AUTHORIZED_RELEASE');
  assert.equal(env.calls, 2);
  assert.equal(ready.expectedMain, SHA);
  assert.equal(ready.deploymentId, DEPLOYMENT);
  assert.equal(ready.contentSetSha256, contentSetSha256);
  assert.match(ready.releaseLeaseSha256, /^[a-f0-9]{64}$/);
  flags(ready);
});

await test('plain forged ticket is rejected', async () => {
  const env = environment();
  held(await env.lease.consume({ state: 'PREPARED_RELEASE_READINESS_LEASE' }), 'HOLD_RELEASE_LEASE_UNTRUSTED_TICKET');
});
await test('serialized ticket is rejected', async () => {
  const env = environment();
  const ticket = await env.lease.prepare(input);
  held(await env.lease.consume(JSON.parse(JSON.stringify(ticket))), 'HOLD_RELEASE_LEASE_UNTRUSTED_TICKET');
});
await test('ticket is one use even after successful readiness', async () => {
  const env = environment();
  const ticket = await env.lease.prepare(input);
  assert.equal((await env.lease.consume(ticket)).state, 'READY');
  held(await env.lease.consume(ticket), 'HOLD_RELEASE_LEASE_REPLAY');
});
await test('failed final preflight spends ticket fail closed', async () => {
  const env = environment();
  const ticket = await env.lease.prepare(input);
  env.state.decision = 'HOLD_PREVIEW_EXPIRED';
  const first = await env.lease.consume(ticket);
  held(first, 'HOLD_RELEASE_LEASE_PREFLIGHT');
  assert.equal(first.upstreamDecision, 'HOLD_PREVIEW_EXPIRED');
  held(await env.lease.consume(ticket), 'HOLD_RELEASE_LEASE_REPLAY');
});
await test('exact local lease deadline is exclusive', async () => {
  const env = environment({ leaseMs: 1000 });
  const ticket = await env.lease.prepare(input);
  env.advance(1000);
  held(await env.lease.consume(ticket), 'HOLD_RELEASE_LEASE_EXPIRED');
});
await test('one millisecond before local lease deadline remains eligible', async () => {
  const env = environment({ leaseMs: 1000 });
  const ticket = await env.lease.prepare(input);
  env.advance(999);
  assert.equal((await env.lease.consume(ticket)).state, 'READY');
});
await test('baseline deployment drift is rejected', async () => {
  const env = environment(); const ticket = await env.lease.prepare(input);
  env.state.baseline = { ...env.state.baseline, id: 'dpl_ChangedBaseline1' };
  held(await env.lease.consume(ticket), 'HOLD_RELEASE_LEASE_DRIFT');
});
await test('baseline commit drift is rejected', async () => {
  const env = environment(); const ticket = await env.lease.prepare(input);
  env.state.baseline = { ...env.state.baseline, sha: 'e'.repeat(40) };
  held(await env.lease.consume(ticket), 'HOLD_RELEASE_LEASE_DRIFT');
});
await test('candidate deployment drift is rejected', async () => {
  const env = environment(); const ticket = await env.lease.prepare(input);
  env.state.candidate = { ...env.state.candidate, id: 'dpl_ChangedCandidate1' };
  held(await env.lease.consume(ticket), 'HOLD_RELEASE_LEASE_DRIFT');
});
await test('candidate commit drift is rejected', async () => {
  const env = environment(); const ticket = await env.lease.prepare(input);
  env.state.candidate = { ...env.state.candidate, sha: 'f'.repeat(40) };
  held(await env.lease.consume(ticket), 'HOLD_RELEASE_LEASE_DRIFT');
});
await test('current main drift is rejected', async () => {
  const env = environment(); const ticket = await env.lease.prepare(input);
  env.state.expectedMain = 'f'.repeat(40);
  held(await env.lease.consume(ticket), 'HOLD_RELEASE_LEASE_DRIFT');
});
await test('content set drift is rejected', async () => {
  const env = environment(); const ticket = await env.lease.prepare(input);
  const rows = [{ ...OBSERVATIONS[0], contentSha256: 'f'.repeat(64) }];
  env.state.observations = rows;
  env.state.contentSetSha256 = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  held(await env.lease.consume(ticket), 'HOLD_RELEASE_LEASE_DRIFT');
});
await test('fabricated content-set digest fails before ticket creation', async () => {
  const env = environment(); env.state.contentSetSha256 = 'f'.repeat(64);
  held(await env.lease.prepare(input), 'HOLD_RELEASE_LEASE_PREFLIGHT');
});
await test('preflight that claims authorization is rejected', async () => {
  const env = environment(); env.state.publicationAuthorized = true;
  held(await env.lease.prepare(input), 'HOLD_RELEASE_LEASE_PREFLIGHT');
});
await test('preflight that claims promotion is rejected', async () => {
  const env = environment(); env.state.promotionPerformed = true;
  held(await env.lease.prepare(input), 'HOLD_RELEASE_LEASE_PREFLIGHT');
});
await test('preflight with wrong scope is rejected', async () => {
  const env = environment(); env.state.projectId = 'prj_wrong';
  held(await env.lease.prepare(input), 'HOLD_RELEASE_LEASE_PREFLIGHT');
});
await test('expired upstream evidence cannot prepare a ticket', async () => {
  const env = environment();
  env.defer(async () => { env.advance(60_000); env.defer(null); });
  held(await env.lease.prepare(input), 'HOLD_RELEASE_LEASE_EXPIRED');
});
await test('upstream HOLD is preserved only as a bounded decision code', async () => {
  const env = environment(); env.state.decision = 'HOLD_REVISION_DRIFT'; env.state.reason = 'PRIVATE_DO_NOT_EXPOSE';
  const result = await env.lease.prepare(input);
  held(result, 'HOLD_RELEASE_LEASE_PREFLIGHT');
  assert.equal(result.upstreamDecision, 'HOLD_REVISION_DRIFT');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_DO_NOT_EXPOSE/);
});
await test('malformed upstream decision is not echoed', async () => {
  const env = environment(); env.state.decision = 'PRIVATE_SECRET';
  const result = await env.lease.prepare(input);
  held(result, 'HOLD_RELEASE_LEASE_PREFLIGHT');
  assert.equal(Object.hasOwn(result, 'upstreamDecision'), false);
});
await test('invalid input is rejected before preflight', async () => {
  const env = environment();
  held(await env.lease.prepare({ ...input, expectedHead: 'f'.repeat(40) }), 'HOLD_RELEASE_LEASE_INPUT');
  assert.equal(env.calls, 0);
});
await test('extra caller fields cannot become lease evidence', async () => {
  const env = environment();
  held(await env.lease.prepare({ ...input, verified: true }), 'HOLD_RELEASE_LEASE_INPUT');
  assert.equal(env.calls, 0);
});
await test('clock reversal fails closed', async () => {
  let now = BASE;
  const state = environment().state;
  const lease = createPublicationReleaseReadinessLease({
    now: () => now,
    runPreflight: async () => ({ ...state, checkedAt: iso(BASE), validUntil: iso(BASE + 60_000) }),
  });
  const ticket = await lease.prepare(input);
  now--;
  held(await lease.consume(ticket), 'HOLD_RELEASE_LEASE_CLOCK');
});
await test('new preparation invalidates an older unconsumed ticket', async () => {
  const env = environment();
  const first = await env.lease.prepare(input);
  const second = await env.lease.prepare(input);
  held(await env.lease.consume(first), 'HOLD_RELEASE_LEASE_SUPERSEDED');
  assert.equal((await env.lease.consume(second)).state, 'READY');
});
await test('new preparation supersedes an in-flight final preflight', async () => {
  const env = environment();
  const first = await env.lease.prepare(input);
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  let entered;
  const inside = new Promise((resolve) => { entered = resolve; });
  let block = true;
  env.defer(async () => { if (block) { entered(); await blocked; } });
  const pending = env.lease.consume(first);
  await inside;
  block = false;
  env.defer(null);
  const second = await env.lease.prepare(input);
  release();
  held(await pending, 'HOLD_RELEASE_LEASE_SUPERSEDED');
  assert.equal((await env.lease.consume(second)).state, 'READY');
});
await test('concurrent consume attempts cannot both become ready', async () => {
  const env = environment(); const ticket = await env.lease.prepare(input);
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  let entered;
  const inside = new Promise((resolve) => { entered = resolve; });
  env.defer(async () => { entered(); await blocked; });
  const first = env.lease.consume(ticket);
  await inside;
  held(await env.lease.consume(ticket), 'HOLD_RELEASE_LEASE_REPLAY');
  env.defer(null); release();
  assert.equal((await first).state, 'READY');
});
await test('adapter exception fails closed without leaking message', async () => {
  const lease = createPublicationReleaseReadinessLease({ now: () => BASE,
    runPreflight: async () => { throw new Error('PRIVATE_PROVIDER_SECRET'); } });
  const result = await lease.prepare(input);
  held(result, 'HOLD_RELEASE_LEASE_INTERNAL');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_PROVIDER_SECRET/);
});
await test('missing adapter is rejected at construction', async () => {
  assert.throws(() => createPublicationReleaseReadinessLease({ now: () => BASE }), /HOLD_RELEASE_LEASE_CONFIG/);
});
await test('invalid lease duration is rejected at construction', async () => {
  assert.throws(() => createPublicationReleaseReadinessLease({ runPreflight: async () => ({}), now: () => BASE, leaseMs: 60_000 }), /HOLD_RELEASE_LEASE_CONFIG/);
});

console.log(`Publication release readiness lease: ${tests.length} groups passed (offline synthetic preflight; no writer, provider, workflow, admission or Production activation).`);
