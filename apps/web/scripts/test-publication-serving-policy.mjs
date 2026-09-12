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
const hidden = article('/news/catalysts/held-private-title', { title: 'HIDDEN_TITLE_SENTINEL',
  summary: 'HIDDEN_SUMMARY_SENTINEL' }, 'HIDDEN_BODY_SENTINEL');

await check('unconfigured adapters fail closed', async () => {
  const p = createPublicationServingPolicy(); const ticket = await p.inspect([article()]);
  assert.equal(ticket.decision, 'HOLD_ADAPTER_NOT_CONFIGURED'); assert.equal(p.project(ticket).view.items.length, 0);
});
for (const time of [deadline - 1, deadline, deadline + 1]) {
  await check(`unadmitted content absent at ${time}`, async () => {
    const env = setup({ sources: [hidden], records: [null], time }); const result = await view(env);
    assert.equal(result.view.items.length, 0); assert.equal(result.audit[0].decision, 'HOLD_NOT_ADMITTED');
    assert.doesNotMatch(JSON.stringify(result), /HIDDEN_|held-private-title/);
    assert.equal(result.publicationAuthorized, false); assert.equal(result.enforcementActive, false);
  });
}
for (const state of ['pending','revoked','preflight-passed','ready','failed','private-preview']) {
  await check(`non-admitted history ${state} cannot serve`, async () => {
    const source = article(); const env = setup({ records: [record(source, undefined, { state })] });
    assert.equal((await view(env)).view.items.length, 0);
  });
}
await check('recorded preview remains an archive across deadline', async () => {
  const env = setup(); const ticket = await env.policy.inspect(env.sources);
  assert.equal(env.policy.project(ticket).view.items[0].publicationPresentation, 'current');
  env.clock(deadline);
  const result = env.policy.project(ticket); assert.equal(result.view.items[0].publicationPresentation, 'archive');
  assert.equal(result.view.items[0].calendarVerified, true); assert.equal(env.reads(), 1);
});
for (const surface of ['homepage','news-current','feed','latest-json']) {
  await check(`expired recorded preview absent from ${surface}`, async () => {
    const env = setup(); const ticket = await env.policy.inspect(env.sources);
    assert.equal(env.policy.project(ticket, { surface }).view.items.length, 1); env.clock(deadline);
    assert.equal(env.policy.project(ticket, { surface }).view.items.length, 0);
  });
}
for (const surface of ['article','news-archive','sitemap']) {
  await check(`legitimate archive stays on ${surface}`, async () => {
    const env = setup({ time: deadline + 1 }); assert.equal((await view(env, { surface })).view.items.length, 1);
  });
}
for (const patch of [
  { admittedAt: at }, { admittedAt: iso(deadline + 1) }, { calendarValidUntil: iso(deadline - 30_000) },
  { calendarCheckedAt: iso(deadline - 20_000) }, { previewDeadline: iso(deadline + 1) },
  { previewDeadline: null }, { basis: 'preflight' }, { basis: 'private-preview' },
  { calendarVerified: false }, { sourceSha256: 'f'.repeat(64) }, { path: '/news/catalysts/other' },
  { projectId: 'wrong-project' }, { repository: 'wrong/repository' }, { teamId: 'wrong-team' },
  { commitSha: 'bad' }, { deploymentId: 'bad' }, { evidenceSha256: 'bad' },
  { admittedAt: '2026-02-30T12:30:00.000Z' }, { calendarCheckedAt: iso(deadline - 1_000_000) },
]) {
  await check(`reject inconsistent history ${JSON.stringify(patch)}`, async () => {
    const env = setup({ records: [record(article(), undefined, patch)] }); assert.equal((await view(env)).view.items.length, 0);
  });
}
await check('a single held item does not suppress established items', async () => {
  const good = article('/news/catalysts/aaa-established');
  const env = setup({ sources: [good, hidden], records: [record(good, '/news/catalysts/aaa-established'), null] });
  const result = await view(env, { surface: 'homepage' }); assert.equal(result.view.items.length, 1);
  assert.equal(result.view.items[0].slug, '/news/catalysts/aaa-established');
  assert.doesNotMatch(JSON.stringify(result), /HIDDEN_|held-private-title/);
});
for (const patch of [
  { exposure: 'private-preview' }, { target: 'preview' }, { projectId: 'other' },
  { teamId: 'other' }, { repository: 'other/repo' }, { commitSha: 'bad' },
  { artifactSha256: 'bad' }, { manifestSha256: '0'.repeat(64) },
  { validUntil: iso(deadline - 1) }, { validUntil: iso(deadline + 20_000) },
  { observedAt: at }, { legacyBaseline: {} },
]) {
  await check(`reject authority ${JSON.stringify(patch)}`, async () => {
    const env = setup({ authorityPatch: patch }); const ticket = await env.policy.inspect(env.sources);
    assert.equal(ticket.state, 'HOLD'); assert.equal(env.reads(), 0);
  });
}
for (const patch of [{ historyRevision: 'revision2' }, { deploymentId: 'dpl_anotherdeploy' },
  { commitSha: 'f'.repeat(40) }, { artifactSha256: 'f'.repeat(64) }]) {
  await check(`drift rejects delayed inspection ${JSON.stringify(patch)}`, async () => {
    const env = setup({ finalPatch: patch }); const ticket = await env.policy.inspect(env.sources);
    assert.equal(ticket.decision, 'HOLD_AUTHORITY_DRIFT');
  });
}
for (const recordPatch of [
  (value) => ({ ...value, revision: 'changed' }), (value) => ({ ...value, records: [] }),
  (value) => ({ ...value, records: [...value.records, value.records[0]] }),
  (value) => ({ ...value, records: [{ ...value.records[0], path: '/news/catalysts/wrong' }] }),
]) {
  await check('incomplete or wrong-revision ledger snapshot denied', async () => {
    const env = setup({ recordPatch }); assert.equal((await env.policy.inspect(env.sources)).state, 'HOLD');
  });
}
await check('unavailable ledger sanitized and never retried', async () => {
  const env = setup({ readError: true }); const ticket = await env.policy.inspect(env.sources);
  assert.equal(ticket.decision, 'HOLD_ADAPTER_UNAVAILABLE'); assert.doesNotMatch(JSON.stringify(ticket), /PRIVATE_BACKEND/);
  assert.equal(env.reads(), 1);
});
await check('serialized tickets cannot recreate capability', async () => {
  const env = setup(); const ticket = await env.policy.inspect(env.sources);
  assert.equal(env.policy.project(JSON.parse(JSON.stringify(ticket))).decision, 'HOLD_UNTRUSTED_TICKET');
});
await check('ticket cannot be reused by another controller instance', async () => {
  const env = setup(); const ticket = await env.policy.inspect(env.sources);
  assert.equal(setup().policy.project(ticket).decision, 'HOLD_UNTRUSTED_TICKET');
});
await check('expired authority cannot keep serving from an old ticket', async () => {
  const env = setup(); const ticket = await env.policy.inspect(env.sources); env.clock(deadline + 9_999);
  assert.equal(env.policy.project(ticket).decision, 'HOLD_AUTHORITY_EXPIRED');
});
await check('final read cannot extend original ticket deadline', async () => {
  const env = setup({ finalPatch: { validUntil: iso(deadline + 14_000) } });
  const ticket = await env.policy.inspect(env.sources); env.clock(deadline + 9_999);
  assert.equal(env.policy.project(ticket).decision, 'HOLD_AUTHORITY_EXPIRED');
});
for (const time of [NaN, Infinity, deadline - 1.5, -1, deadline - 2]) {
  await check(`invalid or backwards clock ${time}`, async () => {
    const env = setup(); const ticket = await env.policy.inspect(env.sources); env.clock(time);
    assert.equal(env.policy.project(ticket).decision, 'HOLD_INVALID_CLOCK');
  });
}
await check('authority changes invalidate old tickets after next inspection', async () => {
  const env = setup(); const first = await env.policy.inspect(env.sources); env.auth.historyRevision = 'revision2';
  await env.policy.inspect(env.sources); assert.equal(env.policy.project(first).decision, 'HOLD_AUTHORITY_DRIFT');
});
await check('manifest changes after inspection cannot mutate captured sources', async () => {
  const env = setup(); const ticket = await env.policy.inspect(env.sources);
  env.auth.entries[0].sourceSha256 = 'f'.repeat(64); env.ledger[0].record.state = 'revoked';
  const result = env.policy.project(ticket); assert.equal(result.view.items.length, 1);
  assert.throws(() => { result.view.items[0].body = 'tampered'; }, TypeError);
  // External revocation needs a new authenticated revision/read; no immediate provider revocation is claimed.
});
for (const method of ['POST','PUT','DELETE','OPTIONS','get']) {
  await check(`unsupported method ${method} cannot serve`, async () => {
    const env = setup(); const ticket = await env.policy.inspect(env.sources);
    assert.equal(env.policy.project(ticket, { method }).decision, 'HOLD_METHOD_NOT_ALLOWED');
  });
}
await check('HEAD projects no body', async () => { const env = setup(); assert.deepEqual((await view(env, { method: 'HEAD' })).view, { items: [] }); });
await check('unknown surface denied', async () => { const env = setup(); assert.equal((await view(env, { surface: 'unguarded-html' })).decision, 'HOLD_SURFACE_UNSUPPORTED'); });
await check('all cache header layers deny stored policy projections', async () => {
  const env = setup(); assert.deepEqual((await view(env)).headers, SERVING_NO_STORE);
  assert.deepEqual(env.policy.project({}).headers, SERVING_NO_STORE);
});
const legacyBaseline = { commitSha: 'f'.repeat(40), deploymentId: 'dpl_legacybaseline', inventorySha256: '0'.repeat(64) };
const old = article('/news/catalysts/old-preview', { calendar: null });
const oldRecord = { ...SERVING_SCOPE, schema: 'publication-admission/v1', path: '/news/catalysts/old-preview',
  sourceSha256: digest(old), state: 'admitted', basis: 'legacy-baseline', calendarVerified: false,
  admittedAt: null, observedAt: iso(deadline - 100_000), baseline: legacyBaseline };
await check('approved legacy record serves as archive without invented admission time', async () => {
  const env = setup({ sources: [old], records: [oldRecord], authorityPatch: { legacyBaseline } });
  const ticket = await env.policy.inspect(env.sources); const result = env.policy.project(ticket);
  assert.equal(result.view.items[0].publicationPresentation, 'archive'); assert.equal(result.view.items[0].calendarVerified, false);
  assert.equal(env.policy.project(ticket, { surface: 'homepage' }).view.items.length, 0);
});
for (const patch of [{ admittedAt: iso(deadline - 100_000) }, { calendarVerified: true },
  { baseline: { ...legacyBaseline, inventorySha256: '1'.repeat(64) } }]) {
  await check('legacy evidence cannot imply retrospective calendar verification', async () => {
    const env = setup({ sources: [old], records: [{ ...oldRecord, ...patch }], authorityPatch: { legacyBaseline } });
    assert.equal((await view(env)).view.items.length, 0);
  });
}
await check('unapproved legacy baseline denied', async () => {
  assert.equal((await view(setup({ sources: [old], records: [oldRecord] }))).view.items.length, 0);
});
for (const status of ['draft','review','ready-for-build']) {
  await check(`${status} content is never projected`, async () => {
    const source = article(undefined, { status }); const env = setup({ sources: [source], records: [record(source)] });
    assert.equal((await view(env)).view.items.length, 0);
  });
}
await check('duplicate manifest path denied', async () => {
  const source = article(); const env = setup({ sources: [source, source] });
  assert.equal((await env.policy.inspect(env.sources)).decision, 'HOLD_MANIFEST_INVALID');
});
await check('caller publication flags cannot create history', async () => {
  const source = article(undefined, { publicationAuthorized: true, verified: true, admittedAt: iso(deadline - 100_000) });
  assert.equal((await view(setup({ sources: [source], records: [null] }))).view.items.length, 0);
});
await check('outcome record has no preview expiry', async () => {
  const source = article('/news/catalysts/cpi-outcome', { phase: 'outcome', statusLabel: 'released' });
  const outcome = record(source, '/news/catalysts/cpi-outcome', { admittedAt: iso(deadline + 1000),
    calendarCheckedAt: at, calendarValidUntil: iso(deadline + 100_000), previewDeadline: null });
  assert.equal((await view(setup({ sources: [source], records: [outcome], time: deadline + 2000 }))).view.items.length, 1);
});
await check('Daily calendar uses earliest preview deadline', async () => {
  const source = article('/news/2026-09-11', { category: 'Daily USD Impact', date: '2026-09-11',
    catalysts: [{ calendar }, { calendar: { ...calendar, series: 'PPI', releaseAt: iso(deadline + 60_000) } }] });
  const env = setup({ sources: [source], records: [record(source, '/news/2026-09-11')] });
  const ticket = await env.policy.inspect(env.sources); assert.equal(env.policy.project(ticket, { surface: 'homepage' }).view.items.length, 1);
  env.clock(deadline); assert.equal(env.policy.project(ticket, { surface: 'homepage' }).view.items.length, 0);
  assert.equal(env.policy.project(ticket).view.items.length, 1);
});
await check('outcome cannot have an admission before its release', async () => {
  const source = article('/news/catalysts/too-early-outcome', { phase: 'outcome', statusLabel: 'released' });
  const early = record(source, '/news/catalysts/too-early-outcome', { previewDeadline: null });
  assert.equal((await view(setup({ sources: [source], records: [early] }))).view.items.length, 0);
});
await check('preview history cannot contradict the recorded phase label', async () => {
  const source = article(undefined, { statusLabel: 'released' });
  assert.equal((await view(setup({ sources: [source], records: [record(source)] }))).view.items.length, 0);
});
await check('no-calendar Daily remains explicitly uncertified', async () => {
  const source = article('/news/2026-09-11', { category: 'Daily USD Impact', date: '2026-09-11', catalysts: [] });
  const row = record(source, '/news/2026-09-11', { basis: 'no-calendar-entries', calendarVerified: false, previewDeadline: null });
  const result = await view(setup({ sources: [source], records: [row] }));
  assert.equal(result.view.items.length, 1); assert.equal(result.view.items[0].calendarVerified, false);
});
await check('source count is bounded before invoking any adapter', async () => {
  const env = setup(); const ticket = await env.policy.inspect(Array(501).fill(article()));
  assert.equal(ticket.decision, 'HOLD_SOURCE_INVALID'); assert.equal(env.authorityReads(), 0);
});
for (const suffix of ['?bypass=1', '.html', '/index.html', '/']) {
  await check(`noncanonical source route rejected ${suffix}`, async () => {
    const source = article(`/news/catalysts/cpi-august-preview${suffix}`);
    assert.equal((await view(setup({ sources: [source], records: [record(source)] }))).view.items.length, 0);
  });
}
console.log(`Publication serving policy: ${groups} regression groups passed (mocked authority/history; no live admission, storage or routing enforcement).`);
