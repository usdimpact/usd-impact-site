import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { authorizedWake, wakeDailyBackstop, createScheduleWakeHandler } from '../src/lib/daily-news-schedule-wake.js';

const day = '2026-10-19';
const token = 'fixture-github-token-not-a-real-credential';
const secret = 'fixture-cron-secret-at-least-thirty-two-characters';
const env = { VERCEL_ENV: 'production', DAILY_NEWS_SCHEDULE_WAKE_ENABLED: 'true',
  DAILY_NEWS_SCHEDULE_GITHUB_TOKEN: token, CRON_SECRET: secret };
const clock = () => new Date(`${day}T09:32:00Z`);
const run = (filename, overrides = {}) => ({ id: 1, path: `.github/workflows/${filename}`,
  event: 'schedule', status: 'completed', conclusion: 'success', head_branch: 'main',
  head_sha: 'a'.repeat(40), created_at: `${day}T09:20:00Z`, ...overrides });
let cases = 0;
async function check(name, task) { await task(); cases++; }

function fixture(options = {}) {
  const calls = [];
  let fileCalls = 0;
  const fetchImpl = async (input, init) => {
    const url = new URL(input);
    calls.push({ url: input, method: init.method, body: init.body });
    assert.equal(url.origin, 'https://api.github.com');
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.headers.Authorization, `Bearer ${token}`);
    assert.ok(init.signal instanceof AbortSignal);
    const response = (status, value) => ({ status, json: async () => value });
    if (init.method === 'POST') {
      assert.equal(url.pathname, '/repos/usdimpact/usd-impact-site/actions/workflows/daily-news-schedule-backstop.yml/dispatches');
      assert.deepEqual(JSON.parse(init.body), { ref: 'main' });
      if (options.postThrows) throw new Error(`untrusted body ${token}`);
      return response(options.postStatus ?? 204, null);
    }
    if (options.readThrows) throw new Error(`untrusted body ${token}`);
    if (options.readStatus) return response(options.readStatus, {});
    if (url.pathname === '/repos/usdimpact/usd-impact-site') {
      return response(200, { full_name: 'usdimpact/usd-impact-site', default_branch: 'main',
        archived: false, disabled: false, ...options.repo });
    }
    if (url.pathname.includes('/contents/')) {
      fileCalls++;
      if (options.fileStatus) return response(options.fileStatus, {});
      const exists = options.exists || (options.existsAfter && fileCalls > 1);
      return response(exists ? 200 : 404, exists ? { path: `apps/web/src/content/news/${day}.md`,
        type: 'file', sha: 'b'.repeat(40) } : null);
    }
    if (url.pathname.endsWith('/pulls')) {
      return response(200, options.pages?.[Number(url.searchParams.get('page')) - 1] ?? options.prs ?? []);
    }
    if (url.pathname.endsWith('/runs')) {
      const backstop = url.pathname.includes('schedule-backstop');
      const runs = (backstop ? options.backstopRuns : options.dailyRuns) ?? [];
      return response(200, { total_count: options.incompleteRuns ? 101 : runs.length, workflow_runs: runs });
    }
    throw new Error(`unexpected fixture request: ${input}`);
  };
  return { calls, fetchImpl, countPosts: () => calls.filter((c) => c.method === 'POST').length };
}

for (const bad of [undefined, '', `Bearer ${secret}x`, [secret], 'x'.repeat(513)]) {
  await check('authentication rejects invalid header', () => assert.equal(authorizedWake(bad, secret), false));
}
await check('authentication accepts exact bearer only', () => assert.equal(authorizedWake(`Bearer ${secret}`, secret), true));
await check('short configured secret is rejected', () => assert.equal(authorizedWake('Bearer short', 'short'), false));

for (const overrides of [{ VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' },
  { DAILY_NEWS_SCHEDULE_WAKE_ENABLED: undefined }, { DAILY_NEWS_SCHEDULE_WAKE_ENABLED: '1' }]) {
  await check('disabled before network', async () => {
    const f = fixture();
    const result = await wakeDailyBackstop({ env: { ...env, ...overrides }, clock, fetchImpl: f.fetchImpl });
    assert.equal(result.reason, 'disabled'); assert.equal(f.calls.length, 0);
  });
}
for (const time of ['2026-10-17T10:00:00Z', '2026-10-18T10:00:00Z',
  '2026-10-19T09:31:59Z', '2026-10-19T16:30:00Z', '2026-10-19T23:00:00Z']) {
  await check('bounded weekday clock', async () => {
    const f = fixture();
    const r = await wakeDailyBackstop({ env, clock: () => new Date(time), fetchImpl: f.fetchImpl });
    assert.equal(r.reason, 'outside-weekday-window'); assert.equal(f.calls.length, 0);
  });
}
await check('invalid clock fails closed', async () => {
  const f = fixture(); const r = await wakeDailyBackstop({ env, clock: () => new Date('bad'), fetchImpl: f.fetchImpl });
  assert.equal(r.state, 'hold'); assert.equal(f.calls.length, 0);
});
await check('missing token prevents network', async () => {
  const f = fixture(); const r = await wakeDailyBackstop({ env: { ...env, DAILY_NEWS_SCHEDULE_GITHUB_TOKEN: '' }, clock, fetchImpl: f.fetchImpl });
  assert.equal(r.reason, 'missing-dispatch-credential'); assert.equal(f.calls.length, 0);
});
for (const options of [{ readStatus: 401 }, { readStatus: 403 }, { readStatus: 429 },
  { readStatus: 500 }, { readThrows: true }, { repo: { archived: true } },
  { repo: { full_name: 'other/repository' } }, { fileStatus: 403 }, { fileStatus: 500 }, { incompleteRuns: true }]) {
  await check('uncertain state never dispatches', async () => {
    const f = fixture(options); const r = await wakeDailyBackstop({ env, clock, fetchImpl: f.fetchImpl });
    assert.equal(r.state, 'hold'); assert.equal(f.countPosts(), 0); assert.ok(!JSON.stringify(r).includes(token));
  });
}
for (const options of [{ exists: true }, { existsAfter: true }]) {
  await check('existing publication prevents all dispatches', async () => {
    const f = fixture(options); const r = await wakeDailyBackstop({ env, clock, fetchImpl: f.fetchImpl });
    assert.equal(r.reason, 'edition-already-on-main'); assert.equal(f.countPosts(), 0);
  });
}
const publicationPr = { number: 900, title: `Publish Daily USD Impact \u2014 ${day}`,
  head: { ref: `automation/daily-usd-impact-${day}-fixture` }, base: { ref: 'main' }, state: 'open' };
for (const pr of [publicationPr, { ...publicationPr, state: 'closed' }, { ...publicationPr, draft: true }]) {
  await check('all editorial PR states suppress wake', async () => {
    const f = fixture({ prs: [pr] }); const r = await wakeDailyBackstop({ env, clock, fetchImpl: f.fetchImpl });
    assert.equal(r.reason, 'publication-pr-exists'); assert.equal(f.countPosts(), 0);
  });
}
await check('matching PR beyond first page is respected', async () => {
  const otherPr = { ...publicationPr, title: 'Other PR' };
  const f = fixture({ pages: [Array.from({ length: 100 }, (_, i) => ({ ...otherPr, number: i + 1 })), [publicationPr]] });
  const r = await wakeDailyBackstop({ env, clock, fetchImpl: f.fetchImpl });
  assert.equal(r.reason, 'publication-pr-exists'); assert.equal(f.countPosts(), 0);
});
await check('unbounded PR history is HOLD, not absent', async () => {
  const f = fixture({ prs: Array.from({ length: 100 }, (_, i) => ({ ...publicationPr, number: i + 1, title: 'Other' })) });
  const r = await wakeDailyBackstop({ env, clock, fetchImpl: f.fetchImpl });
  assert.equal(r.reason, 'incomplete-pr-history'); assert.equal(f.countPosts(), 0);
});
for (const status of ['queued', 'in_progress', 'waiting', 'pending', 'requested']) {
  await check('active Daily run suppresses wake', async () => {
    const f = fixture({ dailyRuns: [run('daily-news.yml', { status, conclusion: null })] });
    const r = await wakeDailyBackstop({ env, clock, fetchImpl: f.fetchImpl });
    assert.equal(r.reason, 'daily-active'); assert.equal(f.countPosts(), 0);
  });
}
for (const [options, reason] of [
  [{ dailyRuns: [run('daily-news.yml', { event: 'workflow_dispatch', conclusion: 'failure' })] }, 'recovery-budget-used'],
  [{ backstopRuns: [run('daily-news-schedule-backstop.yml', { status: 'in_progress', conclusion: null })] }, 'backstop-active'],
  [{ backstopRuns: [run('daily-news-schedule-backstop.yml', { event: 'workflow_dispatch' })] }, 'wake-already-requested'],
  [{ backstopRuns: [run('daily-news-schedule-backstop.yml', { conclusion: 'failure' })] }, 'previous-backstop-not-successful'],
  [{ backstopRuns: [run('daily-news-schedule-backstop.yml', { conclusion: 'cancelled' })] }, 'previous-backstop-not-successful'],
  [{ dailyRuns: [run('other.yml')] }, 'untrusted-run-history'],
]) {
  await check(reason, async () => {
    const f = fixture(options); const r = await wakeDailyBackstop({ env, clock, fetchImpl: f.fetchImpl });
    assert.equal(r.reason, reason); assert.equal(f.countPosts(), 0);
  });
}
for (const options of [{}, { dailyRuns: [run('daily-news.yml', { conclusion: 'failure' })] },
  { dailyRuns: [run('daily-news.yml')] }]) {
  await check('wake only existing bounded backstop, never source or direct Daily', async () => {
    const f = fixture(options); const r = await wakeDailyBackstop({ env, clock, fetchImpl: f.fetchImpl });
    assert.equal(r.state, 'wake-requested'); assert.equal(r.nativeAcceptance, false); assert.equal(f.countPosts(), 1);
  });
}
for (const options of [{ postThrows: true }, { postStatus: 500 }, { postStatus: 403 }, { postStatus: 302 }]) {
  await check('ambiguous write is never retried', async () => {
    const f = fixture(options); const r = await wakeDailyBackstop({ env, clock, fetchImpl: f.fetchImpl });
    assert.equal(r.state, 'hold'); assert.equal(r.reason, 'wake-dispatch-unknown-do-not-retry');
    assert.equal(f.countPosts(), 1); assert.ok(!JSON.stringify(r).includes(token));
  });
}
await check('clock expiry between inspection and write aborts', async () => {
  const f = fixture(); let n = 0;
  const r = await wakeDailyBackstop({ env, clock: () => (++n === 1 ? clock() : new Date(`${day}T16:30:00Z`)), fetchImpl: f.fetchImpl });
  assert.equal(r.reason, 'window-expired'); assert.equal(f.countPosts(), 0);
});
function responseSink() {
  return { headers: {}, code: 0, body: null, setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
for (const [req, expected] of [
  [{ method: 'POST', url: '/api/daily-news-schedule-wake', headers: {} }, 405],
  [{ method: 'GET', url: '/api/daily-news-schedule-wake', headers: {} }, 401],
  [{ method: 'GET', url: '/api/daily-news-schedule-wake?date=2026-10-14', headers: { authorization: `Bearer ${secret}` } }, 400],
]) {
  await check('handler rejects unsafe requests', async () => {
    const f = fixture(); const res = responseSink();
    await createScheduleWakeHandler({ env, clock, fetchImpl: f.fetchImpl, log: () => {} })(req, res);
    assert.equal(res.code, expected); assert.equal(f.calls.length, 0); assert.equal(res.headers['Cache-Control'], 'no-store');
  });
}
await check('handler returns accepted wake, not publication PASS', async () => {
  const f = fixture(); const res = responseSink(); const logs = [];
  await createScheduleWakeHandler({ env, clock, fetchImpl: f.fetchImpl, log: (x) => logs.push(x) })({
    method: 'GET', url: '/api/daily-news-schedule-wake', headers: { authorization: `Bearer ${secret}` },
  }, res);
  assert.equal(res.code, 202); assert.equal(res.body.nativeAcceptance, false);
  assert.ok(!logs.join('').includes(token)); assert.ok(!logs.join('').includes(secret));
});

const backstop = await readFile(new URL('../../../.github/workflows/daily-news-schedule-backstop.yml', import.meta.url), 'utf8');
await check('shared mutex and unchanged least-privilege permissions', () => {
  assert.match(backstop, /group: daily-usd-impact-schedule-backstop/);
  assert.match(backstop, /cancel-in-progress: false/);
  assert.match(backstop, /contents: read/); assert.doesNotMatch(backstop, /contents: write|gh pr merge/);
  assert.equal((backstop.match(/gh workflow run daily-news.yml/g) || []).length, 1);
  assert.match(backstop, /earlier backstop did not succeed/);
  assert.match(backstop, /accepted dispatch has no visible run receipt/);
  assert.match(backstop, /for receipt_check in \$\(seq 1 12\)/);
  assert.match(backstop, /file_status.*!=.*404/s);
});


// Execute the REAL backstop shell with only local stand-ins for gh/date/sleep.
// The child inherits no real credentials, and the gh stand-in never makes HTTP calls.
const shell = backstop.split('        run: |\n')[1].split('\n')
  .map((line) => line.startsWith('          ') ? line.slice(10) : line).join('\n');
const temp = await mkdtemp(join(tmpdir(), 'usd-daily-wake-test-'));
try {
  const gh = `#!/bin/bash
set -eu
args="$*"
echo "$args" >> "$FAKE_CALLS"
if [[ "$args" == *"--jq .default_branch"* ]]; then
  echo main
elif [[ "$args" == *"--include --silent"* ]]; then
  case "$SCENARIO" in
    published) echo 'HTTP/2 200 OK' ;;
    forbidden) echo 'HTTP/2 403 Forbidden'; exit 1 ;;
    transport) exit 1 ;;
    *) echo 'HTTP/2 404 Not Found'; exit 1 ;;
  esac
elif [[ "$args" == pr\\ list* ]]; then
  if [ "$SCENARIO" = closed-pr ]; then printf '900\\tCLOSED\\thttps://github.com/usdimpact/usd-impact-site/pull/900\\n'; fi
elif [[ "$args" == *'daily-news.yml/runs?per_page=30'* ]]; then
  case "$SCENARIO" in
    active) echo '{"workflow_runs":[{"created_at":"2026-10-19T09:31:00Z","status":"in_progress","event":"schedule"}]}' ;;
    used) echo '{"workflow_runs":[{"created_at":"2026-10-19T09:31:00Z","status":"completed","event":"workflow_dispatch","conclusion":"failure"}]}' ;;
    *) echo '{"workflow_runs":[]}' ;;
  esac
elif [[ "$args" == *'daily-news-schedule-backstop.yml/runs?'* ]]; then
  if [ "$SCENARIO" = prior-failed ]; then
    echo '{"total_count":1,"workflow_runs":[{"id":98,"status":"completed","conclusion":"failure"}]}'
  else echo '{"total_count":0,"workflow_runs":[]}'; fi
elif [[ "$args" == workflow\\ run* ]]; then
  if [ "$SCENARIO" = ack-lost ]; then exit 1; fi
elif [[ "$args" == *'daily-news.yml/runs?created='* ]]; then
  case "$SCENARIO" in
    no-receipt) echo '{"total_count":0,"workflow_runs":[]}' ;;
    duplicate-receipt) echo '{"total_count":2,"workflow_runs":[{"event":"workflow_dispatch","head_branch":"main","html_url":"https://github.com/usdimpact/usd-impact-site/actions/runs/1"},{"event":"workflow_dispatch","head_branch":"main","html_url":"https://github.com/usdimpact/usd-impact-site/actions/runs/2"}]}' ;;
    *) echo '{"total_count":1,"workflow_runs":[{"event":"workflow_dispatch","head_branch":"main","html_url":"https://github.com/usdimpact/usd-impact-site/actions/runs/1"}]}' ;;
  esac
else echo 'Unexpected mock invocation' >&2; exit 99; fi
`;
  const date = `#!/bin/bash
if [[ "$*" == *'+%u'* ]]; then
  if [ "$SCENARIO" = weekend ]; then echo 6; else echo 1; fi
else echo 2026-10-19; fi
`;
  for (const [name, content] of [['gh', gh], ['date', date], ['sleep', '#!/bin/bash\nexit 0\n']]) {
    await writeFile(join(temp, name), content); await chmod(join(temp, name), 0o700);
  }
  // GitHub runs the backstop with native jq. Vercel's build image lacks it,
  // so use a bounded, offline query interpreter there; do not skip shell cases.
  const nativeJq = spawnSync('/bin/bash', ['-c', 'command -v jq'], {
    encoding: 'utf8', env: { PATH: '/usr/bin:/bin' },
  });
  if (nativeJq.status !== 0 || process.env.TEST_DAILY_WAKE_PORTABLE_JQ === '1') {
    const portableJq = `#!${process.execPath}
const { readFileSync } = require('node:fs');
const args = process.argv.slice(2), vars = {};
let query = '';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--arg') { vars[args[++i]] = args[++i]; }
  else if (!args[i].startsWith('-')) query = args[i];
}
const data = JSON.parse(readFileSync(0, 'utf8'));
const runs = data.workflow_runs;
if (!Array.isArray(runs)) process.exit(2);
if (query.includes('.total_count ==')) {
  const ok = Number.isInteger(data.total_count) && data.total_count === runs.length && data.total_count <= 100;
  console.log(ok); process.exit(ok ? 0 : 1);
}
let selected = runs;
if (query.includes('startswith($day)')) selected = selected.filter(r => r.created_at.startsWith(vars.day));
if (query.includes('(.id | tostring) != $current')) selected = selected.filter(r => String(r.id) !== vars.current);
if (query.includes('.status != "completed"')) selected = selected.filter(r => r.status !== 'completed');
if (query.includes('.status == "completed"')) selected = selected.filter(r => r.status === 'completed');
if (query.includes('.conclusion != "success"')) selected = selected.filter(r => r.conclusion !== 'success');
if (query.includes('.conclusion == "success"')) selected = selected.filter(r => r.conclusion === 'success');
if (query.includes('.event == "workflow_dispatch"')) selected = selected.filter(r => r.event === 'workflow_dispatch');
if (query.includes('.head_branch == "main"')) selected = selected.filter(r => r.head_branch === 'main');
if (query.endsWith('| length')) console.log(selected.length);
else if (query.endsWith('| .html_url')) selected.forEach(r => console.log(r.html_url));
else process.exit(2);
`;
    await writeFile(join(temp, 'jq'), portableJq);
    await chmod(join(temp, 'jq'), 0o700);
  }
  for (const [scenario, exit, dispatches, message] of [
    ['published', 0, 0, 'already exists'], ['forbidden', 1, 0, 'lookup did not return'],
    ['transport', 1, 0, 'lookup did not return'], ['weekend', 0, 0, 'outside UTC weekdays'],
    ['closed-pr', 0, 0, 'publication PR already exists'], ['active', 0, 0, 'already active'],
    ['used', 0, 0, 'one-recovery budget is exhausted'], ['prior-failed', 1, 0, 'earlier backstop did not succeed'],
    ['ack-lost', 1, 1, 'acknowledgement is unknown'], ['no-receipt', 1, 1, 'no visible run receipt'],
    ['duplicate-receipt', 1, 1, 'more than one recovery run'], ['receipt', 0, 1, 'Recovery run receipt'],
  ]) {
    await check(`backstop shell ${scenario}`, async () => {
      const summary = join(temp, 'summary'); const calls = join(temp, 'calls');
      await writeFile(summary, ''); await writeFile(calls, '');
      const child = spawnSync('/bin/bash', ['-c', shell], { encoding: 'utf8', timeout: 15000,
        env: { PATH: `${temp}:/usr/bin:/bin`, SCENARIO: scenario, FAKE_CALLS: calls,
          GITHUB_REPOSITORY: 'usdimpact/usd-impact-site', GITHUB_RUN_ID: '99',
          GITHUB_STEP_SUMMARY: summary, GH_TOKEN: 'fixture-not-real' } });
      assert.equal(child.status, exit, `${scenario}: ${child.stderr}`);
      assert.ok((await readFile(summary, 'utf8')).includes(message));
      assert.equal((await readFile(calls, 'utf8')).split('\n').filter((x) => x.startsWith('workflow run')).length, dispatches);
    });
  }
} finally { await rm(temp, { recursive: true, force: true }); }
// Verify the existing function routes cron requests before the generator wrapper.
const routedSource = await readFile(new URL('../api/daily-news-grounded-background.js', import.meta.url), 'utf8');
const routeImport = "import { createScheduleWakeHandler } from '../src/lib/daily-news-schedule-wake.js';\n";
const routeSetup = '\nconst scheduleWakeHandler = createScheduleWakeHandler();';
const routeGuard = "  // User-agent selects the route only; CRON_SECRET still authorizes every wake.\n" +
  "  // Return before the provider wrapper. No thirteenth Vercel function is added.\n" +
  "  if (request.headers?.['user-agent'] === 'vercel-cron/1.0') {\n" +
  "    return scheduleWakeHandler(request, response);\n  }\n";
await check('normal grounded generation implementation is byte-for-byte preserved', () => {
  assert.ok(routedSource.startsWith(routeImport));
  assert.ok(routedSource.includes(routeGuard));
  const original = Buffer.from(routedSource.replace(routeImport, '').replace(routeSetup, '').replace(routeGuard, ''));
  const blob = createHash('sha1').update(`blob ${original.length}\0`).update(original).digest('hex');
  // Reviewed Daily source-date update: FOMC annual-index rejection/guidance changed,
  // while the exact cron route and all wake behavior remain unchanged.
  assert.equal(blob, 'ea45105e53a3bd34ff013b8dac6ded6e3ad9dc3a');
});
const routedBody = routedSource.match(/export default async function handler\(request, response\) \{([\s\S]*)\}\s*$/)?.[1];
assert.ok(routedBody);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const routed = new AsyncFunction('request', 'response', 'scheduleWakeHandler', 'backgroundHandler', 'groundedFetch',
  'let runtimeOverrideQueue = Promise.resolve();\n' + routedBody);
for (const [label, patch, status] of [
  ['unauthorized cron', { headers: { 'user-agent': 'vercel-cron/1.0' } }, 401],
  ['wrong method cron', { method: 'POST' }, 405],
  ['query parameter cron', { url: '/api/daily-news-grounded-background?date=2026-10-14' }, 400],
  ['valid cron wake', {}, 202],
]) {
  await check(`existing function isolates ${label}`, async () => {
    const f = fixture(); const res = responseSink(); let generatorCalls = 0;
    const req = { method: 'GET', url: '/api/daily-news-grounded-background',
      headers: { 'user-agent': 'vercel-cron/1.0', authorization: `Bearer ${secret}` }, ...patch };
    await routed(req, res, createScheduleWakeHandler({ env, clock, fetchImpl: f.fetchImpl, log: () => {} }),
      async () => { generatorCalls++; throw new Error('generator must not run'); }, () => { throw new Error('provider wrapper must not run'); });
    assert.equal(res.code, status); assert.equal(generatorCalls, 0);
    assert.equal(f.countPosts(), status === 202 ? 1 : 0);
  });
}
await check('ordinary non-cron generation route is unchanged', async () => {
  let wakes = 0; let generators = 0;
  const value = await routed({ headers: { 'user-agent': 'curl/fixture' } }, {},
    () => { wakes++; }, async () => { generators++; return 'unchanged-generation-route'; }, (f) => f);
  assert.equal(value, 'unchanged-generation-route'); assert.equal(wakes, 0); assert.equal(generators, 1);
});
console.log(`daily schedule wake tests pass (${cases} cases; all GitHub calls mocked)`);