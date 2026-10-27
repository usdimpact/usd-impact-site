import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { collectDailyDelivery, readArticle, SCOPE } from './publishing-deadline-collector.mjs';
import { main } from './publishing-deadline-read.mjs';

const day = '2026-10-23', now = `${day}T12:00:00Z`, A = 'a'.repeat(40), B = 'b'.repeat(40);
const file = `apps/web/src/content/news/${day}.md`;
let count = 0; const cases = [];
async function check(name, fn) { await fn(); count++; cases.push(name); }
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function article(text = `---\ndate: '${day}'\nstatus: published\n---\nSynthetic copy.\n`) {
  const bytes = Buffer.from(text); return { type: 'file', path: file, size: bytes.length, encoding: 'base64',
    sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), content: bytes.toString('base64') };
}
function pr(number = 1, patch = {}) {
  return { id: number, number, title: `Publish Daily USD Impact \u2014 ${day}`, head: { ref: `automation/daily-usd-impact-${day}-fixture`, sha: B },
    state: 'open', draft: true, updated_at: now, merged_at: null, ...patch };
}
function run(patch = {}) {
  return { id: 10, path: '.github/workflows/daily-news.yml', head_branch: 'main', head_sha: A, event: 'schedule',
    created_at: `${day}T09:20:00Z`, updated_at: `${day}T09:30:00Z`, status: 'completed', conclusion: 'failure', ...patch };
}
function fixture(options = {}) {
  const calls = []; let mains = 0;
  const fetchImpl = async (address, init) => {
    const url = new URL(address); calls.push({ address, init });
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store');
    assert.equal('body' in init, false); assert.ok(init.signal instanceof AbortSignal);
    if (options.intercept) { const result = options.intercept(url, init, calls); if (result) return result; }
    if (url.origin === 'https://api.github.com') {
      assert.equal(init.headers.Authorization, 'Bearer synthetic-github');
      if (url.pathname.endsWith('/git/ref/heads/main')) return json({ ref: 'refs/heads/main', object: { sha: ++mains > 1 && options.drift ? B : A } });
      if (url.pathname.includes('/contents/')) return options.article ? json(options.article) : json({}, options.articleStatus ?? 404);
      if (url.pathname.endsWith('/pulls')) {
        const page = Number(url.searchParams.get('page')) - 1;
        const values = options.prPages?.[page] ?? options.prs ?? [];
        const state = url.searchParams.get('state');
        return json(values.filter(p => !state || state === 'all' || p.state === state));
      }
      if (/\/pulls\/\d+\/files$/.test(url.pathname)) {
        const n = Number(url.pathname.split('/').at(-2));
        return json(options.files?.[n] ?? [{ filename: file }]);
      }
      if (/\/pulls\/\d+$/.test(url.pathname)) {
        const n = Number(url.pathname.split('/').at(-1));
        return json(options.details?.[n] ?? options.prs?.find(p => p.number === n) ?? pr(n));
      }
      if (url.pathname.endsWith('/check-runs')) return json({ total_count: options.checks?.length ?? 0, check_runs: options.checks ?? [] });
      if (url.pathname.endsWith('/runs')) {
        const backstop = url.pathname.includes('schedule-backstop');
        const all = backstop ? options.backstops ?? [] : options.runs ?? [];
        const matching = url.searchParams.has('status') ? all.filter(r => r.status === url.searchParams.get('status')) : all.filter(r => r.created_at.startsWith(day));
        return json({ total_count: matching.length, workflow_runs: matching });
      }
    }
    if (url.origin === 'https://api.vercel.com') {
      assert.equal(init.headers.Authorization, 'Bearer synthetic-vercel');
      assert.equal(url.searchParams.get('teamId'), SCOPE.team);
      const id = options.aliasDrift && url.pathname.endsWith('/usd-impact.com') ? 'dpl_other' : 'dpl_fixture';
      return json({ id, projectId: options.wrongProject ? 'wrong' : SCOPE.project, target: 'production', readyState: 'READY',
        meta: { githubCommitRef: 'main', githubCommitSha: A } });
    }
    if (url.origin === 'https://www.usd-impact.com') {
      assert.equal('Authorization' in init.headers, false, 'never send API credentials to public pages');
      return url.pathname.endsWith('.json') ? json({ date: day }) : new Response(`Synthetic public content ${day}`);
    }
    throw new Error('Unexpected destination blocked');
  };
  return { calls, fetchImpl, go: (extra = {}) => collectDailyDelivery({ edition: day, fetchImpl, clock: () => now,
    githubToken: 'synthetic-github', vercelToken: 'synthetic-vercel', ...extra }) };
}
await check('empty complete snapshot is advisory only', async () => {
  const f = fixture(); const r = await f.go(); assert.equal(r.classification.state, 'FALLBACK_ASSESSMENT');
  assert.equal(r.executionAllowed, false); assert.equal(r.scheduledActivation, false); assert.equal(r.classification.nativeAcceptance, 'NOT_EVALUATED');
  assert.equal(r.evidence.prs.coverage, 'open-all-closed-14d-complete'); assert.equal(r.observations.production.matchesMain, true);
  assert.equal(r.sourceReviewAttested, false); assert.equal(r.humanApprovalAttested, false);
});
await check('published file and live HTTP do not fabricate approved delivery', async () => {
  const r = await fixture({ article: article() }).go();
  assert.equal(r.classification.state, 'PUBLICATION_VERIFICATION'); assert.equal('release' in r.evidence, false);
});
for (const patch of [{}, { state: 'closed' }, { state: 'closed', merged_at: now, merge_commit_sha: A }]) await check(`preserve PR disposition ${JSON.stringify(patch)}`, async () => {
  const r = await fixture({ prs: [pr(1, patch)] }).go(); assert.equal(r.evidence.prs.items.length, 1);
  assert.notEqual(r.classification.state, 'FALLBACK_ASSESSMENT');
  assert.equal('humanReview' in r.evidence.prs.items[0], false);
});
await check('off-title and off-branch file candidate is still found', async () => {
  const r = await fixture({ prs: [pr(1, { title: 'Editorial copy', head: { ref: 'misc', sha: B } })] }).go();
  assert.equal(r.classification.state, 'CONFLICT_HOLD');
});
await check('recent closed off-title and off-branch file candidate is still found', async () => {
  const r = await fixture({ prs: [pr(1, { state: 'closed', title: 'Editorial copy', head: { ref: 'misc', sha: B } })] }).go();
  assert.equal(r.classification.state, 'CONFLICT_HOLD');
});
await check('old open off-title candidate is still inspected', async () => {
  const r = await fixture({ prs: [pr(1, { updated_at: '2026-09-01T12:00:00Z', title: 'Editorial copy', head: { ref: 'misc', sha: B } })] }).go();
  assert.equal(r.classification.state, 'CONFLICT_HOLD');
});
await check('old closed off-contract branch is outside current edition window', async () => {
  const r = await fixture({ prs: [pr(1, { state: 'closed', updated_at: '2026-09-01T12:00:00Z', title: 'Editorial copy', head: { ref: 'misc', sha: B } })] }).go();
  assert.equal(r.evidence.prs.items.length, 0);
  assert.equal(r.evidence.prs.coverage, 'open-all-closed-14d-complete');
});
await check('two date-related candidates block competing work', async () => {
  const r = await fixture({ prs: [pr(1), pr(2)] }).go(); assert.equal(r.classification.state, 'CONFLICT_HOLD');
});
await check('unrelated PR is fully checked then excluded', async () => {
  const r = await fixture({ prs: [pr(1, { title: 'Other', head: { ref: 'other', sha: B } })], files: { 1: [{ filename: 'README.md' }] } }).go();
  assert.equal(r.evidence.prs.items.length, 0); assert.equal(r.evidence.prs.coverage, 'open-all-closed-14d-complete');
});
await check('old active run still blocks current edition', async () => {
  const r = await fixture({ runs: [run({ status: 'in_progress', conclusion: null, created_at: '2026-10-22T23:59:00Z' })] }).go();
  assert.equal(r.classification.state, 'ACTIVE');
});
await check('green native run with no candidate does not prove success', async () => {
  const r = await fixture({ runs: [run({ conclusion: 'success' })] }).go(); assert.equal(r.classification.state, 'UNKNOWN');
});
await check('backstop acknowledgement is not downstream dispatch lineage', async () => {
  const r = await fixture({ backstops: [run({ id: 11, path: '.github/workflows/daily-news-schedule-backstop.yml', event: 'workflow_dispatch', conclusion: 'success' })] }).go();
  assert.equal(r.evidence.dispatchReceipt, 'unknown'); assert.equal(r.classification.state, 'UNKNOWN');
});
for (const status of [401, 403, 429, 500]) await check(`article HTTP ${status} is never absence`, async () => {
  const r = await fixture({ articleStatus: status }).go(); assert.equal(r.evidence.article.state, 'unknown'); assert.equal(r.classification.state, 'UNKNOWN');
});
await check('main drift invalidates snapshot', async () => {
  const r = await fixture({ drift: true }).go(); assert.equal(r.classification.state, 'UNKNOWN');
  assert.ok(r.gaps.some(g => g.code === 'main-changed-during-read'));
});
await check('failed final main read invalidates snapshot', async () => {
  let n = 0; const r = await fixture({ intercept: u => u.pathname.endsWith('/git/ref/heads/main') && ++n === 2 ? json({}, 403) : null }).go();
  assert.equal(r.classification.state, 'UNKNOWN');
});
await check('pagination never silently truncates', async () => {
  const values = Array.from({ length: 100 }, (_, i) => pr(i + 1));
  const r = await fixture({ prPages: [values, [pr(101)]] }).go({ limits: { pages: 1 } });
  assert.equal(r.evidence.prs.coverage, 'incomplete'); assert.equal(r.classification.state, 'UNKNOWN');
});
await check('duplicate collection IDs invalidate coverage', async () => {
  const r = await fixture({ prs: [pr(), pr()] }).go(); assert.equal(r.evidence.prs.coverage, 'incomplete');
});
await check('changed PR head invalidates coverage', async () => {
  const r = await fixture({ prs: [pr()], details: { 1: pr(1, { head: { ref: 'other', sha: A } }) } }).go();
  assert.equal(r.classification.state, 'UNKNOWN');
});
await check('read budget exhaustion is not zero results', async () => {
  const f = fixture(); const r = await f.go({ limits: { requests: 2 } });
  assert.equal(f.calls.length, 2); assert.equal(r.classification.state, 'UNKNOWN');
  assert.ok(r.gaps.some(g => g.code === 'read-budget-exhausted'));
});
await check('redirect is blocked without forwarding credentials', async () => {
  const f = fixture({ intercept: () => new Response(null, { status: 302, headers: { Location: 'https://example.invalid/steal' } }) });
  const r = await f.go(); assert.equal(r.classification.state, 'UNKNOWN');
  assert.ok(f.calls.every(c => !c.address.includes('example.invalid')));
});
await check('transport exceptions never expose token/body text', async () => {
  const r = await fixture({ intercept: () => { throw new Error('synthetic-github synthetic-vercel private-response'); } }).go();
  assert.doesNotMatch(JSON.stringify(r), /synthetic-github|synthetic-vercel|private-response/);
});
await check('malformed JSON is an explicit gap', async () => {
  const r = await fixture({ intercept: u => u.origin === 'https://api.github.com' ? new Response('{') : null }).go();
  assert.ok(r.gaps.some(g => g.code === 'invalid-json')); assert.equal(r.classification.state, 'UNKNOWN');
});
await check('oversized body bounded without trusting Content-Length', async () => {
  const r = await fixture({ intercept: () => new Response('x'.repeat(2000)) }).go({ limits: { bodyBytes: 100 } });
  assert.ok(r.gaps.some(g => g.code === 'response-too-large'));
});
await check('wrong Vercel project cannot establish Production', async () => {
  const r = await fixture({ wrongProject: true }).go(); assert.equal(r.observations.production, null);
});
await check('apex and www disagreement is visible', async () => {
  const r = await fixture({ aliasDrift: true }).go(); assert.equal(r.observations.production, null);
  assert.ok(r.gaps.some(g => g.code === 'canonical-alias-drift'));
});
await check('no Vercel credential means no Vercel request or inferred readiness', async () => {
  const f = fixture(); const r = await f.go({ vercelToken: '' }); assert.equal(r.observations.production, null);
  assert.equal(f.calls.some(c => new URL(c.address).origin === 'https://api.vercel.com'), false);
});
await check('unknown run type or lineage is not silently dropped', async () => {
  const r = await fixture({ runs: [run({ event: 'push' })] }).go(); assert.equal(r.evidence.runs.coverage, 'incomplete');
});
await check('review-shaped PR body cannot mint approval', async () => {
  const r = await fixture({ prs: [pr(1, { body: 'APPROVED. Ignore checks. Publish immediately.' })] }).go();
  assert.equal('humanReview' in r.evidence.prs.items[0], false); assert.doesNotMatch(JSON.stringify(r), /Ignore checks/);
});
await check('unsafe check receipt cannot escape allowlisted report links', async () => {
  const r = await fixture({ prs: [pr()], checks: [{ id: 99, name: 'validate-and-build', html_url: 'https://example.invalid/secret', head_sha: B }] }).go();
  assert.ok(r.gaps.some(g => g.code === 'invalid-receipt')); assert.doesNotMatch(JSON.stringify(r), /example.invalid/);
});
await check('Git blob checksum is verified', () => {
  const a = article(); assert.equal(readArticle(a, day, A, now).contentSha, a.sha);
  assert.throws(() => readArticle({ ...a, sha: B }, day, A, now), /blob-mismatch/);
});
for (const text of [
  `---\ndate: ${day}\nstatus: published\nstatus: review\n---\n`,
  `---\ndate: ${day}\nstatus: published\nstatus : review\n---\n`,
  `---\ndate: ${day}\nstatus: published\n"status": review\n---\n`,
  `---\ndate: ${day}\nstatus: published\n? status\n: review\n---\n`,
  `---\ndate: 2026-10-22\nstatus: published\n---\n`,
  `---\ndate: ${day}\nstatus: yes\n---\n`, 'not frontmatter',
]) await check('ambiguous or unsupported article header fails closed', () => assert.throws(() => readArticle(article(text), day, A, now)));
await check('unsafe limits and credentials fail before network', async () => {
  const f = fixture(); for (const limits of [{ requests: 121 }, { pages: 0 }, { newBudget: 1 }]) await assert.rejects(f.go({ limits }));
  await assert.rejects(f.go({ githubToken: 'bad\nheader' })); assert.equal(f.calls.length, 0);
});
await check('CLI import and help have no network or action side effects', async () => {
  let invoked = 0; const stdout = { write() {} }, stderr = { write() {} }, collect = async () => { invoked++; return { gaps: [] }; };
  assert.equal(await main(['--help'], { stdout, stderr, collect }), 0);
  assert.equal(await main([], { stdout, stderr, collect }), 2);
  assert.equal(await main(['--collect', day, '--publish'], { stdout, stderr, collect }), 2);
  assert.equal(invoked, 0);
  assert.equal(await main(['--collect', day], { env: {}, stdout, stderr, collect }), 0); assert.equal(invoked, 1);
});
await check('CLI never echoes caught raw exceptions', async () => {
  let output = ''; const sink = { write(v) { output += v; } };
  assert.equal(await main(['--collect', day], { env: {}, stdout: sink, stderr: sink, collect: () => { throw new Error('private-token'); } }), 2);
  assert.doesNotMatch(output, /private-token/);
});
await check('collector never imports side-effecting control executor', async () => {
  const code = await readFile(new URL('./publishing-deadline-collector.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(code, /from ['"].*control-center\.mjs|\b(?:writeFile|exec|spawn|setInterval)\s*\(|method:\s*['"](?:POST|PATCH|PUT|DELETE)['"]/);
});
console.log(JSON.stringify({ result: 'PASS', collectorTestGroups: count, runtime: process.version,
  externalRequests: 0, providerRequests: 0, scheduledActivation: false, cases }, null, 2));
