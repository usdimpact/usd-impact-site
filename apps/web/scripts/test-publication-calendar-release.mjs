import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyCalendarReleasePreflight } from '../src/lib/publication-calendar-release.js';
import { parsePublicationCalendarSource } from '../src/lib/publication-calendar-source.js';
import { CALENDAR_FIELDS } from '../src/lib/publication-calendar-pipeline.js';
import { candidate, scheduleHtml, monthlyHtml, releaseHtml } from './fixtures/publication-calendar.js';
const A = 'a'.repeat(40), B = 'b'.repeat(40), T0 = 'c'.repeat(40), T1 = 'd'.repeat(40);
const baselineId = 'dpl_baseline0001', deploymentId = 'dpl_candidate0001';
const path = 'apps/web/src/content/catalyst-briefs/2026-09-11-cpi-preview.md';
const archived = 'apps/web/src/content/catalyst-briefs/2020-01-01-old-preview.md';
const canonical = Object.fromEntries(CALENDAR_FIELDS.map((key) => [key, candidate[key]]));
const original = {
  title: candidate.event, slug: '/news/catalysts/2026-09-11-cpi-preview', category: 'USD Impact Catalyst Brief',
  event: candidate.event, eventDate: candidate.eventDate, phase: 'preview', statusLabel: 'scheduled-confirmed',
  status: 'published', calendar: canonical, summary: 'The event may change rates expectations.',
};
const render = (payload) => `---\n${Object.entries(payload).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n\n## Event\n\nRead the component detail.\n`;
const gitHash = (raw) => createHash('sha1').update(`blob ${Buffer.byteLength(raw)}\0`).update(raw).digest('hex');
let tests = 0;
const test = async (name, task) => { await task(); tests++; };
function environment(config = {}) {
  let clock = Date.parse('2026-09-09T18:00:00Z');
  let aliasReads = 0, mainReads = 0;
  const requests = [];
  const source = config.source ?? render({ ...original, ...config.payload });
  const sourceHash = gitHash(source);
  const oldSource = config.oldSource ?? render(original);
  const oldSourceHash = gitHash(oldSource);
  const archiveHash = 'e'.repeat(40);
  const row = (file, sha) => ({ path: file, sha, type: 'blob', mode: '100644' });
  const before = config.oldSource !== undefined ? [row(path, oldSourceHash)] : config.before ?? [row(archived, archiveHash)];
  const after = config.after ?? [...before.filter((entry) => entry.path !== path), row(path, sourceHash)];
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...config.headers } });
  const deployment = (id, sha) => ({ id, source: 'git', projectId: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7', target: 'production', readyState: 'READY',
    gitSource: { type: 'github', repoId: 1265351071, sha },
    meta: { githubCommitOrg: 'usdimpact', githubCommitRepo: 'usd-impact-site', githubCommitRef: 'main', githubCommitSha: sha } });
  const fetchImpl = async (url, init) => {
    const parsed = new URL(url); requests.push({ url: String(url), method: init.method });
    assert.equal(init.method, 'GET');
    if (parsed.origin === 'https://api.vercel.com') assert.equal(init.headers.Authorization, 'Bearer fixture-provider-token');
    else assert.equal(init.headers.Authorization, undefined, 'provider credentials must never reach GitHub/BLS');
    if (config.denied) return json({}, 403);
    if (parsed.origin === 'https://www.bls.gov') {
      const html = parsed.pathname === '/schedule/news_release/cpi.htm' ? scheduleHtml
        : parsed.pathname === '/schedule/2026/09_sched_list.htm' ? monthlyHtml
        : parsed.pathname === '/news.release/cpi.nr0.htm' ? releaseHtml() : null;
      assert.notEqual(html, null);
      return new Response(html, { headers: { 'Content-Type': 'text/html' } });
    }
    if (parsed.pathname === '/v4/aliases/www.usd-impact.com') {
      aliasReads++;
      if (config.expireAtFinalRead && aliasReads === 2) clock = Date.parse(candidate.releaseAt);
      return json({ alias: 'www.usd-impact.com', projectId: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7',
        deploymentId: config.aliasDrift && aliasReads === 2 ? 'dpl_other00001' : baselineId, ...config.alias });
    }
    if (parsed.pathname === `/v13/deployments/${baselineId}`) return json({ ...deployment(baselineId, A), ...config.baseline });
    if (parsed.pathname === `/v13/deployments/${deploymentId}`) return json({ ...deployment(deploymentId, B), ...config.deployment });
    const tail = parsed.pathname.replace('/repos/usdimpact/usd-impact-site', '');
    if (tail === '/git/ref/heads/main') { mainReads++; return json({ ref: 'refs/heads/main', object: { type: 'commit', sha: config.mainDrift && mainReads === 2 ? A : B } }); }
    if (tail === `/git/commits/${A}`) return json({ sha: A, tree: { sha: T0 } });
    if (tail === `/git/commits/${B}`) return json({ sha: B, tree: { sha: T1 } });
    if (tail === `/git/trees/${T0}`) return json({ sha: T0, truncated: false, tree: before });
    if (tail === `/git/trees/${T1}`) return json({ sha: T1, truncated: config.truncated ?? false, tree: after });
    if (tail === `/git/blobs/${oldSourceHash}` && oldSourceHash !== sourceHash) return json({ sha: oldSourceHash, size: Buffer.byteLength(oldSource), encoding: 'base64', content: Buffer.from(oldSource).toString('base64') });
    if (tail === `/git/blobs/${sourceHash}`) return json({ sha: sourceHash, size: Buffer.byteLength(source), encoding: 'base64', content: Buffer.from(config.corrupt ? source + 'changed' : source).toString('base64') });
    throw new Error(`Unexpected request ${parsed.pathname}`);
  };
  return { requests, sourceHash, before, after, setClock: (value) => { clock = value; },
    run: (args = {}) => verifyCalendarReleasePreflight({ expectedMain: B, expectedHead: B, deploymentId, ...args }, {
      fetchImpl, now: () => clock, vercelToken: 'fixture-provider-token',
    }) };
}
await test('explicit generated metadata is parsed', () => assert.deepEqual(parsePublicationCalendarSource(render(original)).calendar, canonical));
await test('nested importer lists preserve calendar and facts', () => {
  const raw = `---\nstatus: "published"\ncalendar: ${JSON.stringify(canonical)}\nverifiedFacts:\n  - statement: "A verified fact"\n    verification: "verified-primary"\n    sourceIds:\n      - "bls"\nassets:\n  - "DXY"\n---\nBody`;
  const parsed = parsePublicationCalendarSource(raw); assert.equal(parsed.verifiedFacts[0].sourceIds[0], 'bls'); assert.equal(parsed.assets[0], 'DXY');
});
for (const source of [
  'status: "published"', '---\nstatus: "review"\nstatus: "published"\n---\n',
  '---\nstatus: published\n---\n', '---\nstatus: &anchor "published"\n---\n',
  '---\nstatus: "published"\nsummary: |\n  Hidden\n---\n',
  '---\nstatus: "published"\n  orphan: "hidden"\n---\n',
  '---\nstatus: "published"\n\tcalendar: {}\n---\n',
  '---\nstatus: "published"\nconstructor: {}\n---\n',
  '---\nstatus: "published"\ncalendar: {"series":"CPI","series":"PPI"}\n---\n',
]) await test('unsupported or ambiguous metadata is never skipped', () => assert.throws(() => parsePublicationCalendarSource(source), (error) => error.code === 'HOLD_SOURCE_SCHEMA'));
await test('live baseline mapping is read twice and unchanged archives are not revalidated', async () => {
  const env = environment(); const result = await env.run();
  assert.equal(result.decision, 'PASS_READ_ONLY_PREFLIGHT', JSON.stringify(result));
  assert.equal(result.baseline.sha, A); assert.equal(result.candidate.sha, B); assert.equal(result.observations.length, 1);
  assert.equal(result.publicationAuthorized, false); assert.equal(result.promotionPerformed, false); assert.equal(result.enforcementActive, false);
  assert.equal(env.requests.filter((item) => item.url.includes('/v4/aliases/')).length, 2);
  assert.ok(!env.requests.some((item) => item.url.includes('/git/blobs/' + 'e'.repeat(40))));
});
await test('stale open PR / previously failed deployment content is checked against the actual deployed baseline', async () => {
  const env = environment(); env.setClock(Date.parse(candidate.releaseAt));
  const result = await env.run(); assert.equal(result.decision, 'HOLD_PREVIEW_EXPIRED');
  assert.ok(env.requests.some((item) => item.url.includes(`/git/commits/${A}`)));
});
await test('late staged promotion cannot reuse a past read-only PASS', async () => {
  const env = environment(); assert.equal((await env.run()).decision, 'PASS_READ_ONLY_PREFLIGHT');
  env.setClock(Date.parse(candidate.releaseAt)); assert.equal((await env.run()).decision, 'HOLD_PREVIEW_EXPIRED');
});
for (const [name, config, code] of [
  ['alias drift', { aliasDrift: true }, 'HOLD_BASELINE_DRIFT'],
  ['main drift', { mainDrift: true }, 'HOLD_REVISION_DRIFT'],
  ['expiry during provider reconciliation', { expireAtFinalRead: true }, 'HOLD_PREVIEW_EXPIRED'],
  ['stale provider cache', { headers: { Age: '60' } }, 'HOLD_EVIDENCE_STALE'],
  ['invalid provider date', { headers: { Date: 'invalid' } }, 'HOLD_EVIDENCE_STALE'],
  ['provider denial', { denied: true }, 'HOLD_PROVIDER_RESPONSE'],
  ['wrong canonical project', { alias: { projectId: 'wrong' } }, 'HOLD_BASELINE_UNVERIFIED'],
  ['redirect alias', { alias: { redirect: 'another.example' } }, 'HOLD_BASELINE_UNVERIFIED'],
  ['unready deployed baseline', { baseline: { readyState: 'ERROR' } }, 'HOLD_DEPLOYMENT_UNVERIFIED'],
  ['Preview is not staged Production', { deployment: { target: null } }, 'HOLD_DEPLOYMENT_UNVERIFIED'],
  ['non-Git candidate', { deployment: { source: 'cli' } }, 'HOLD_DEPLOYMENT_UNVERIFIED'],
  ['conflicting Git source', { deployment: { gitSource: { sha: A } } }, 'HOLD_DEPLOYMENT_UNVERIFIED'],
  ['unready candidate', { deployment: { readyState: 'BUILDING' } }, 'HOLD_DEPLOYMENT_UNVERIFIED'],
  ['incomplete Git tree', { truncated: true }, 'HOLD_REVISION_DRIFT'],
  ['corrupt blob bytes', { corrupt: true }, 'HOLD_REVISION_DRIFT'],
  ['route mismatch', { payload: { slug: '/news/catalysts/something-else' } }, 'HOLD_IDENTITY_MISMATCH'],
  ['missing canonical record', { payload: { calendar: null } }, 'HOLD_MISSING_CALENDAR_RECORD'],
  ['changed archived article without calendar', { payload: { calendar: null }, oldSource: render(original) }, 'HOLD_ARCHIVE_CHANGE'],
  ['deleted archive', { after: [] }, 'HOLD_ARCHIVE_CHANGE'],
  ['nested or unusual markdown path', { after: [{ path: 'apps/web/src/content/news/subdir/hidden.md', mode: '100644', type: 'blob', sha: 'f'.repeat(40) }] }, 'HOLD_SOURCE_SCHEMA'],
  ['symlink publication', { after: [{ path, mode: '120000', type: 'blob', sha: 'f'.repeat(40) }] }, 'HOLD_SOURCE_SCHEMA'],
]) await test(name, async () => assert.equal((await environment(config).run()).decision, code, name));
await test('code-only candidate preserves untouched archives without BLS requests', async () => {
  const env = environment({ after: [{ path: archived, mode: '100644', type: 'blob', sha: 'e'.repeat(40) }] });
  const result = await env.run(); assert.equal(result.decision, 'PASS_READ_ONLY_PREFLIGHT'); assert.equal(result.observations.length, 0);
  assert.ok(!env.requests.some((item) => new URL(item.url).origin === 'https://www.bls.gov'));
});
await test('review-only new file does not claim calendar validation', async () => {
  const result = await environment({ payload: { status: 'review', calendar: null } }).run();
  assert.equal(result.decision, 'PASS_READ_ONLY_PREFLIGHT'); assert.equal(result.checks.length, 0);
});
await test('an untrusted expected base cannot replace the canonical lookup', async () => {
  const env = environment(); const result = await env.run({ expectedHead: A });
  assert.equal(result.decision, 'HOLD_REVISION_DRIFT'); assert.equal(env.requests.length, 0);
});
await test('missing provider access is a HOLD, not an invented baseline', async () => {
  const result = await verifyCalendarReleasePreflight({ expectedMain: B, expectedHead: B, deploymentId }, { vercelToken: '' });
  assert.equal(result.decision, 'HOLD_PROVIDER_AUTH');
});
for (const [name, config, code] of [
  ['published archive cannot be downgraded to review', { payload: { status: 'review', calendar: null }, oldSource: render(original) }, 'HOLD_ARCHIVE_CHANGE'],
  ['published archive cannot be relabelled draft', { payload: { status: 'draft', calendar: null }, oldSource: render(original) }, 'HOLD_ARCHIVE_CHANGE'],
  ['published archive prose is not silently overwritten', { payload: { summary: 'Changed archive prose' }, oldSource: render(original) }, 'HOLD_ARCHIVE_CHANGE'],
  ['missing authoritative Git source', { deployment: { gitSource: null } }, 'HOLD_DEPLOYMENT_UNVERIFIED'],
  ['wrong Git source provider', { deployment: { gitSource: { type: 'gitlab', repoId: 1265351071, sha: B } } }, 'HOLD_DEPLOYMENT_UNVERIFIED'],
  ['wrong authoritative Git repository', { deployment: { gitSource: { type: 'github', repoId: 123, sha: B } } }, 'HOLD_DEPLOYMENT_UNVERIFIED'],
  ['MDX source cannot escape inventory', { after: [{ path: 'apps/web/src/content/news/hidden.mdx', mode: '100644', type: 'blob', sha: 'f'.repeat(40) }] }, 'HOLD_SOURCE_SCHEMA'],
  ['JSON source cannot escape inventory', { after: [{ path: 'apps/web/src/content/news/hidden.json', mode: '100644', type: 'blob', sha: 'f'.repeat(40) }] }, 'HOLD_SOURCE_SCHEMA'],
  ['symlink root cannot escape inventory', { after: [{ path: 'apps/web/src/content/news', mode: '120000', type: 'blob', sha: 'f'.repeat(40) }] }, 'HOLD_SOURCE_SCHEMA'],
  ['nonempty placeholder cannot escape inventory', { after: [{ path: 'apps/web/src/content/news/.gitkeep', mode: '100644', type: 'blob', sha: 'f'.repeat(40) }] }, 'HOLD_SOURCE_SCHEMA'],
]) await test(name, async () => assert.equal((await environment(config).run()).decision, code, name));
await test('review source may become published only after fresh verification', async () => {
  const result = await environment({ oldSource: render({ ...original, status: 'review' }) }).run();
  assert.equal(result.decision, 'PASS_READ_ONLY_PREFLIGHT'); assert.equal(result.checks.length, 1);
});
await test('known empty placeholder is not a publication', async () => {
  const env = environment({ after: [{ path: archived, mode: '100644', type: 'blob', sha: 'e'.repeat(40) }, { path: 'apps/web/src/content/news/.gitkeep', mode: '100644', type: 'blob', sha: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391' }] });
  assert.equal((await env.run()).decision, 'PASS_READ_ONLY_PREFLIGHT');
});
console.log(`Publication calendar release preflight: ${tests} regression groups passed (mocked provider/Git/BLS; no promotion or live certification).`);