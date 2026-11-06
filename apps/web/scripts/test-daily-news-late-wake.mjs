import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { wakeDailyBackstop } from '../src/lib/daily-news-schedule-wake.js';

const day = '2026-10-19';
const token = 'synthetic-testing-token-not-a-real-credential';
const clock = () => new Date(day + 'T15:47:00Z');
const env = { VERCEL_ENV: 'production', DAILY_NEWS_SCHEDULE_WAKE_ENABLED: 'true',
  DAILY_NEWS_LATE_FALLBACK_ENABLED: 'true', DAILY_NEWS_SCHEDULE_GITHUB_TOKEN: token };
const dailyRun = (file, overrides = {}) => ({ id: 554, path: '.github/workflows/' + file,
  event: 'workflow_dispatch', status: 'completed', conclusion: 'failure', head_branch: 'main',
  head_sha: 'a'.repeat(40), created_at: day + 'T09:32:00Z', ...overrides });
let cases = 0;
async function check(label, fn) { await fn(); cases += 1; }
function fixture(options = {}) {
  const calls = [];
  let fileCount = 0;
  const fetchImpl = async (raw, init) => {
    const url = new URL(raw); calls.push({ url: url.pathname, method: init.method });
    assert.equal(url.origin, 'https://api.github.com');
    assert.equal(init.headers.Authorization, 'Bearer ' + token);
    const response = (status, value) => ({ status, json: async () => value });
    if (init.method === 'POST') {
      assert.ok([
        '/repos/usdimpact/usd-impact-site/actions/workflows/daily-news-late-carryforward.yml/dispatches',
        '/repos/usdimpact/usd-impact-site/actions/workflows/daily-news-schedule-backstop.yml/dispatches',
      ].includes(url.pathname));
      assert.deepEqual(JSON.parse(init.body), { ref: 'main' });
      if (options.postFailure) return response(500, null);
      return response(204, null);
    }
    if (url.pathname === '/repos/usdimpact/usd-impact-site') {
      return response(200, { full_name: 'usdimpact/usd-impact-site', default_branch: 'main',
        archived: false, disabled: false });
    }
    if (url.pathname.includes('/contents/')) {
      fileCount++;
      const exists = options.exists || (options.existsAfter && fileCount > 1);
      return response(exists ? 200 : 404, exists ? { path: 'apps/web/src/content/news/' + day + '.md',
        type: 'file', sha: 'b'.repeat(40) } : null);
    }
    if (url.pathname.endsWith('/pulls')) return response(200, options.prs || []);
    if (url.pathname.endsWith('/runs')) {
      const kind = url.pathname.includes('late-carryforward') ? 'late'
        : url.pathname.includes('schedule-backstop') ? 'backstop' : 'daily';
      const items = options[kind] || [];
      return response(200, { total_count: items.length, workflow_runs: items });
    }
    throw new Error('unexpected fixture route: ' + url.pathname);
  };
  return { fetchImpl, calls, posts: () => calls.filter((c) => c.method === 'POST') };
}
await check('late independent wake uses no-paid workflow only', async () => {
  const f = fixture({ daily: [dailyRun('daily-news.yml')],
    backstop: [dailyRun('daily-news-schedule-backstop.yml')] });
  const result = await wakeDailyBackstop({ env, clock, fetchImpl: f.fetchImpl });
  assert.equal(result.state, 'wake-requested');
  assert.equal(result.targetWorkflow, 'daily-news-late-carryforward.yml');
  assert.equal(result.nativeAcceptance, false);
  assert.equal(f.posts().length, 1);
});
await check('afternoon invocation is gated off without explicit activation', async () => {
  const f = fixture();
  const result = await wakeDailyBackstop({
    env: { ...env, DAILY_NEWS_LATE_FALLBACK_ENABLED: undefined }, clock, fetchImpl: f.fetchImpl,
  });
  assert.equal(result.reason, 'outside-weekday-window');
  assert.equal(f.calls.length, 0);
});
for (const time of ['2026-10-17T15:47:00Z','2026-10-19T15:39:59Z','2026-10-19T17:30:00Z']) {
  await check('late window is bounded', async () => {
    const f = fixture();
    const v = await wakeDailyBackstop({ env, clock: () => new Date(time), fetchImpl: f.fetchImpl });
    // 15:39 falls inside the old morning wake; do not interpret that as late proof.
    if (time.includes('15:39')) assert.equal(v.targetWorkflow, 'daily-news-schedule-backstop.yml');
    else assert.equal(v.reason, 'outside-weekday-window');
  });
}
for (const options of [
  { exists: true, expected: 'edition-already-on-main' },
  { existsAfter: true, expected: 'edition-already-on-main' },
  { daily: [dailyRun('daily-news.yml', { status: 'in_progress', conclusion: null })], expected: 'daily-active' },
  { late: [dailyRun('daily-news-late-carryforward.yml', { status: 'in_progress', conclusion: null })], expected: 'late-fallback-active' },
  { late: [dailyRun('daily-news-late-carryforward.yml', { conclusion: 'failure' })], expected: 'previous-late-fallback-not-successful' },
  { late: [dailyRun('daily-news-late-carryforward.yml', { conclusion: 'success' })], expected: 'late-fallback-already-started' },
  { prs: [{ number: 902, title: 'Publish Daily USD Impact — ' + day + ' (late verified carry-forward)',
    head: { ref: 'automation/daily-carryforward-' + day + '-fixture' }, base: { ref: 'main' },
    state: 'closed' }], expected: 'publication-pr-exists' },
]) await check(options.expected, async () => {
  const f = fixture(options); const v = await wakeDailyBackstop({ env, clock, fetchImpl: f.fetchImpl });
  assert.equal(v.reason, options.expected);
  assert.equal(f.posts().length, 0);
});
await check('ambiguous late GitHub acknowledgement never retries', async () => {
  const f = fixture({ postFailure: true });
  const v = await wakeDailyBackstop({ env, clock, fetchImpl: f.fetchImpl });
  assert.equal(v.state, 'hold');
  assert.equal(v.reason, 'wake-dispatch-unknown-do-not-retry');
  assert.equal(f.posts().length, 1);
});
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
assert.ok(config.crons.some((cron) => cron.path === '/api/daily-news-late-wake' &&
  cron.schedule === '47 15 * * 1-5'));
assert.ok(config.rewrites.some((rule) => rule.source === '/api/daily-news-late-wake' &&
  rule.destination === '/api/daily-news-grounded-background'));
const workflow = await readFile(new URL('../../../.github/workflows/daily-news-late-carryforward.yml', import.meta.url), 'utf8');
assert.match(workflow, /cron: '47 15 \* \* 1-5'/);
assert.match(workflow, /test-daily-carry-forward/);
assert.match(workflow, /actions\/create-github-app-token@/);
assert.match(workflow, /npm run validate:news/);
assert.doesNotMatch(workflow, /gh pr merge|gh workflow run daily-news\.yml|openai\.com|NEWSFEED_BEARER_TOKEN/);
assert.match(workflow, /git push origin/);
console.log('No-paid independent afternoon wake offline regression PASS (' + cases + ' checks).');
