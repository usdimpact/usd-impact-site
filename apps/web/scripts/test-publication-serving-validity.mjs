import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPublicationServingPolicy, SERVING_SCOPE, SERVING_NO_STORE } from '../src/lib/publication-serving-policy.js';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const at = '2026-09-11T12:30:00.000Z'; const deadline = Date.parse(at);
const iso = (value) => new Date(value).toISOString();
const base = { ...SERVING_SCOPE, schema: 'publication-serving-authority/v1', target: 'production',
  exposure: 'public-approved', deploymentId: 'dpl_servingtest1', commitSha: 'a'.repeat(40),
  artifactSha256: 'b'.repeat(64), historyRevision: 'revision1', legacyBaseline: null };
const calendar = { publisher: 'BLS', series: 'CPI', referencePeriod: '2026-08', releaseStage: 'initial',
  eventDate: '2026-09-11', releaseTime: '08:30', timeZone: 'America/New_York', releaseAt: at };
function article(slug = '/news/catalysts/cpi-august-preview', extra = {}, body = 'VISIBLE_ARTICLE_BODY') {
  const payload = { status: 'published', slug, category: 'USD Impact Catalyst Brief',
    title: 'August CPI preview', event: 'BLS Consumer Price Index (CPI) for August 2026',
    phase: 'preview', statusLabel: 'scheduled-confirmed', eventDate: '2026-09-11', calendar, ...extra };
  return `---\n${Object.entries(payload).map(([key,value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n${body}`;
}
function record(source, path = '/news/catalysts/cpi-august-preview', extra = {}) {
  return { ...SERVING_SCOPE, schema: 'publication-admission/v1', path, sourceSha256: digest(source),
    state: 'admitted', basis: 'calendar-verified', calendarVerified: true,
    deploymentId: 'dpl_originaltest', commitSha: 'c'.repeat(40), artifactSha256: 'd'.repeat(64),
    evidenceSha256: 'e'.repeat(64), calendarCheckedAt: iso(deadline - 60_000),
    admittedAt: iso(deadline - 30_000), calendarValidUntil: at, previewDeadline: at, ...extra };
}
function setup({ sources = [article()], records = sources.map((source) => record(source)),
  time = deadline - 1, authorityPatch = {}, readError = false, finalPatch = null,
  recordPatch = null } = {}) {
  let current = time; let reads = 0; let authorityReads = 0;
  const entries = sources.map((source) => ({ path: JSON.parse(source.match(/^slug: (.*)$/m)[1]), sourceSha256: digest(source) }))
    .sort((a,b) => a.path.localeCompare(b.path));
  const auth = { ...base, entries, manifestSha256: digest(JSON.stringify(entries)),
    observedAt: iso(time - 1), validUntil: iso(time + 10_000), ...authorityPatch };
  const ledger = entries.map((entry, i) => ({ ...entry, record: records[i] }));
  const policy = createPublicationServingPolicy({ now: () => current,
    loadAuthority: async () => { authorityReads++; return { ...auth, ...(authorityReads >= 2 ? finalPatch : null) }; },
    readHistory: async ({ revision, entries: requested }) => {
      reads++; if (readError) throw new Error('PRIVATE_BACKEND_SECRET_DO_NOT_EXPOSE');
      const result = { revision, records: requested.map((entry) => ledger.find((row) => row.path === entry.path)) };
      return recordPatch ? recordPatch(result) : result;
    },
  });
  return { policy, sources, auth, ledger, clock: (value) => { current = value; },
    reads: () => reads, authorityReads: () => authorityReads };
}
let groups = 0;
async function check(name, operation) {
  try { await operation(); groups++; }
  catch (error) { throw new Error(`Serving policy regression: ${name}`, { cause: error }); }
}
async function view(env, options) { const ticket = await env.policy.inspect(env.sources); return env.policy.project(ticket, options); }
// Invalidation is irreversible for already-issued tickets, even when authority later
// returns to byte-equivalent values. All histories and clocks below are fixtures.
for (const surface of ['article', 'homepage', 'news-current', 'news-archive', 'feed', 'latest-json', 'sitemap']) {
  await check(`shortened authority invalidates older ${surface} ticket`, async () => {
    const env = setup({ time: deadline - 1000 });
    const older = await env.policy.inspect(env.sources);
    env.auth.validUntil = iso(deadline - 500);
    const newer = await env.policy.inspect(env.sources);
    assert.equal(env.policy.project(newer, { surface }).view.items.length, 1);
    env.clock(deadline - 500);
    assert.equal(env.policy.project(older, { surface }).decision, 'HOLD_AUTHORITY_DRIFT');
    assert.equal(env.policy.project(newer, { surface }).decision, 'HOLD_AUTHORITY_EXPIRED');
  });
}
await check('extending authority again never revives a superseded ticket', async () => {
  const env = setup({ time: deadline - 1000 });
  const older = await env.policy.inspect(env.sources);
  env.auth.validUntil = iso(deadline - 500); await env.policy.inspect(env.sources);
  env.auth.validUntil = iso(deadline + 9000);
  const latest = await env.policy.inspect(env.sources);
  assert.equal(env.policy.project(latest).view.items.length, 1);
  assert.equal(env.policy.project(older).decision, 'HOLD_AUTHORITY_DRIFT');
});
await check('same-authority refresh cannot extend an existing ticket', async () => {
  const env = setup({ time: deadline - 1000 });
  const older = await env.policy.inspect(env.sources);
  env.clock(deadline + 8000);
  env.auth.observedAt = iso(deadline + 8000); env.auth.validUntil = iso(deadline + 13000);
  const latest = await env.policy.inspect(env.sources);
  env.clock(deadline + 9000);
  assert.equal(env.policy.project(latest).view.items.length, 1);
  assert.equal(env.policy.project(older).decision, 'HOLD_AUTHORITY_EXPIRED');
});
for (const field of ['historyRevision', 'deploymentId', 'commitSha', 'artifactSha256']) {
  await check(`authority ${field} A-to-B-to-A cannot revive old ticket`, async () => {
    const env = setup(); const older = await env.policy.inspect(env.sources);
    const original = env.auth[field];
    env.auth[field] = { historyRevision: 'revision2', deploymentId: 'dpl_newerfixture',
      commitSha: '9'.repeat(40), artifactSha256: '9'.repeat(64) }[field];
    await env.policy.inspect(env.sources);
    assert.equal(env.policy.project(older).decision, 'HOLD_AUTHORITY_DRIFT');
    env.auth[field] = original; const recovered = await env.policy.inspect(env.sources);
    assert.equal(env.policy.project(recovered).view.items.length, 1);
    assert.equal(env.policy.project(older).decision, 'HOLD_AUTHORITY_DRIFT');
  });
}
await check('history outage recovery cannot revive a ticket invalidated by failure', async () => {
  let unavailable = false;
  const env = setup({ recordPatch: value => {
    if (unavailable) throw new Error('PRIVATE_RECOVERY_SENTINEL'); return value;
  } });
  const older = await env.policy.inspect(env.sources); unavailable = true;
  assert.equal((await env.policy.inspect(env.sources)).decision, 'HOLD_ADAPTER_UNAVAILABLE');
  assert.equal(env.policy.project(older).decision, 'HOLD_AUTHORITY_DRIFT');
  unavailable = false; const recovered = await env.policy.inspect(env.sources);
  assert.equal(env.policy.project(recovered).view.items.length, 1);
  assert.equal(env.policy.project(older).decision, 'HOLD_AUTHORITY_DRIFT');
});
await check('invalid input invalidates prior tickets without permanent policy shutdown', async () => {
  const env = setup(); const older = await env.policy.inspect(env.sources);
  assert.equal((await env.policy.inspect(null)).decision, 'HOLD_SOURCE_INVALID');
  const recovered = await env.policy.inspect(env.sources);
  assert.equal(env.policy.project(recovered).view.items.length, 1);
  assert.equal(env.policy.project(older).decision, 'HOLD_AUTHORITY_DRIFT');
});

function deferred() {
  let resolve; let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function racingSetup({ authorityRead, historyRead } = {}) {
  const env = setup(); let authorityCalls = 0; let historyCalls = 0;
  const clone = value => JSON.parse(JSON.stringify(value));
  const policy = createPublicationServingPolicy({ now: () => deadline - 1,
    loadAuthority: async () => {
      const value = clone(env.auth); const call = ++authorityCalls;
      return authorityRead ? authorityRead(call, value) : value;
    },
    readHistory: async ({ revision, entries }) => {
      const value = { revision, records: clone(entries.map(entry => env.ledger.find(row => row.path === entry.path))) };
      const call = ++historyCalls;
      return historyRead ? historyRead(call, value) : value;
    },
  });
  return { ...env, policy };
}
await check('late successful history read cannot undo a newer failed inspection', async () => {
  const entered = deferred(); const finish = deferred();
  const env = racingSetup({ historyRead: async (call, value) => {
    if (call === 2) { entered.resolve(); await finish.promise; }
    if (call === 3) throw new Error('PRIVATE_NEWER_FAILURE');
    return value;
  } });
  const older = await env.policy.inspect(env.sources);
  const pending = env.policy.inspect(env.sources); await entered.promise;
  assert.equal((await env.policy.inspect(env.sources)).decision, 'HOLD_ADAPTER_UNAVAILABLE');
  finish.resolve(); assert.equal((await pending).decision, 'HOLD_INSPECTION_SUPERSEDED');
  assert.equal(env.policy.project(older).decision, 'HOLD_AUTHORITY_DRIFT');
  const recovered = await env.policy.inspect(env.sources);
  assert.equal(env.policy.project(recovered).view.items.length, 1);
  assert.equal(env.policy.project(older).decision, 'HOLD_AUTHORITY_DRIFT');
});
for (const stage of ['first-authority', 'history', 'final-authority']) {
  for (const reject of [false, true]) {
    await check(`late ${stage} ${reject ? 'failure' : 'success'} cannot clobber newer ticket`, async () => {
      const entered = deferred(); const finish = deferred();
      async function blocked(value) {
        entered.resolve(); await finish.promise;
        if (reject) throw new Error('PRIVATE_OLD_READ_FAILURE');
        return value;
      }
      const env = racingSetup({
        authorityRead: async (call, value) => {
          if ((stage === 'first-authority' && call === 1) || (stage === 'final-authority' && call === 2)) return blocked(value);
          return value;
        },
        historyRead: async (call, value) => stage === 'history' && call === 1 ? blocked(value) : value,
      });
      const pending = env.policy.inspect(env.sources); await entered.promise;
      const latest = await env.policy.inspect(env.sources);
      assert.equal(env.policy.project(latest).view.items.length, 1);
      finish.resolve(); const superseded = await pending;
      assert.equal(superseded.decision, 'HOLD_INSPECTION_SUPERSEDED');
      assert.doesNotMatch(JSON.stringify(superseded), /PRIVATE_/);
      assert.equal(env.policy.project(latest).view.items.length, 1);
      assert.equal(env.policy.project(superseded).decision, 'HOLD_UNTRUSTED_TICKET');
    });
  }
}
await check('source array is snapshotted before the first asynchronous read', async () => {
  const entered = deferred(); const finish = deferred();
  const env = racingSetup({ authorityRead: async (call, value) => {
    if (call === 1) { entered.resolve(); await finish.promise; } return value;
  } });
  const sources = [...env.sources]; const pending = env.policy.inspect(sources);
  await entered.promise; sources.push(...Array(501).fill(article())); finish.resolve();
  const ticket = await pending;
  assert.equal(ticket.state, 'INSPECTED');
  assert.equal(env.policy.project(ticket).view.items.length, 1);
});


console.log(`Publication serving validity: ${groups} regression groups passed (mocked authority/history; no live routing or provider changes).`);
