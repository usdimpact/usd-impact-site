import { createHash, timingSafeEqual } from 'node:crypto';

// Wake the EXISTING serialized backstop, never a source/generation endpoint.
const REPO = 'usdimpact/usd-impact-site';
const ROOT = `https://api.github.com/repos/${REPO}`;
const DAILY = 'daily-news.yml';
const BACKSTOP = 'daily-news-schedule-backstop.yml';
const MAX_PAGES = 20;
const SHA = /^[a-f0-9]{40}$/;
const KNOWN_STATUSES = new Set(['queued', 'in_progress', 'completed', 'waiting', 'pending', 'requested']);
const hash = (value) => createHash('sha256').update(value).digest();

export function authorizedWake(header, secret) {
  return typeof secret === 'string' && secret.length >= 32 &&
    typeof header === 'string' && header.length <= 512 &&
    timingSafeEqual(hash(header), hash(`Bearer ${secret}`));
}

function hold(reason) {
  const error = new Error(reason);
  error.safeReason = reason;
  return error;
}

function utcDay(now) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw hold('invalid-clock');
  return now.toISOString().slice(0, 10);
}

function inWindow(now) {
  const minute = now.getUTCHours() * 60 + now.getUTCMinutes();
  return now.getUTCDay() >= 1 && now.getUTCDay() <= 5 && minute >= 572 && minute < 990;
}

function checkedRuns(payload, filename, day) {
  if (!payload || !Array.isArray(payload.workflow_runs) ||
      !Number.isSafeInteger(payload.total_count) || payload.total_count < 0 ||
      payload.total_count !== payload.workflow_runs.length || payload.total_count > 100) {
    throw hold('incomplete-run-history');
  }
  for (const run of payload.workflow_runs) {
    if (!Number.isSafeInteger(run.id) || run.id <= 0 ||
        run.path !== `.github/workflows/${filename}` || run.head_branch !== 'main' ||
        !SHA.test(run.head_sha || '') || !KNOWN_STATUSES.has(run.status) ||
        !['schedule', 'workflow_dispatch'].includes(run.event) ||
        typeof run.created_at !== 'string' || !run.created_at.startsWith(`${day}T`) ||
        !Number.isFinite(Date.parse(run.created_at)) ||
        (run.status === 'completed' && typeof run.conclusion !== 'string')) throw hold('untrusted-run-history');
  }
  return payload.workflow_runs;
}

/**
 * Default-off adapter. The dependency-injected fetch/clock allow fully offline tests.
 * A 204 from GitHub acknowledges a wake request, NOT a started run or publication.
 * Concurrent wake requests are serialized by the existing backstop's concurrency
 * group; its receipt guard preserves the one-recovery budget even on ambiguity.
 */
export async function wakeDailyBackstop({ env = process.env, fetchImpl = globalThis.fetch,
  clock = () => new Date() } = {}) {
  const no = (reason, day) => ({ state: 'noop', reason, day, nativeAcceptance: false });
  if (env.VERCEL_ENV !== 'production' || env.DAILY_NEWS_SCHEDULE_WAKE_ENABLED !== 'true') {
    return no('disabled');
  }
  let day;
  let postStarted = false;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 40000);
  timer.unref?.();
  let requests = 0;
  try {
    const now = clock();
    day = utcDay(now);
    if (!inWindow(now)) return no('outside-weekday-window', day);
    const token = env.DAILY_NEWS_SCHEDULE_GITHUB_TOKEN;
    if (typeof token !== 'string' || token.length < 20 || /[\r\n]/.test(token)) {
      throw hold('missing-dispatch-credential');
    }
    const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'usd-impact-daily-schedule-wake' };
    async function get(path, allow404 = false) {
      if (++requests > 32) throw hold('request-budget-exhausted');
      let response;
      try { response = await fetchImpl(`${ROOT}${path}`, { method: 'GET', headers,
        signal: abort.signal, redirect: 'error', cache: 'no-store' }); }
      catch { throw hold('github-read-unavailable'); }
      if (allow404 && response.status === 404) return null;
      if (response.status !== 200) throw hold(`github-read-${response.status}`);
      try { return await response.json(); } catch { throw hold('invalid-github-json'); }
    }
    // Establish repository access before treating a contents 404 as an absent file.
    const repo = await get('');
    if (repo.full_name !== REPO || repo.default_branch !== 'main' || repo.archived !== false ||
        repo.disabled !== false) throw hold('repository-not-ready');
    const expectedFile = `apps/web/src/content/news/${day}.md`;
    async function articleExists() {
      const file = await get(`/contents/${expectedFile}?ref=main`, true);
      if (file === null) return false;
      if (file.path !== expectedFile || file.type !== 'file' || !SHA.test(file.sha || '')) {
        throw hold('untrusted-publication-file');
      }
      return true;
    }
    if (await articleExists()) return no('edition-already-on-main', day);

    // All PR states matter. A closed/draft matching PR must preserve editorial HOLD.
    let complete = false;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const pulls = await get(`/pulls?state=all&base=main&sort=updated&direction=desc&per_page=100&page=${page}`);
      if (!Array.isArray(pulls) || pulls.length > 100) throw hold('invalid-pr-history');
      for (const pr of pulls) {
        if (!Number.isSafeInteger(pr.number) || typeof pr.title !== 'string' ||
            typeof pr.head?.ref !== 'string' || pr.base?.ref !== 'main' ||
            !['open', 'closed'].includes(pr.state)) throw hold('invalid-pr-history');
        if (pr.title === `Publish Daily USD Impact \u2014 ${day}` &&
            pr.head.ref.startsWith(`automation/daily-usd-impact-${day}-`)) {
          return no('publication-pr-exists', day);
        }
      }
      if (pulls.length < 100) { complete = true; break; }
    }
    if (!complete) throw hold('incomplete-pr-history');

    const dailyRuns = checkedRuns(await get(`/actions/workflows/${DAILY}/runs?branch=main&created=${day}&per_page=100`), DAILY, day);
    if (dailyRuns.some((run) => run.status !== 'completed')) return no('daily-active', day);
    if (dailyRuns.some((run) => run.event === 'workflow_dispatch')) return no('recovery-budget-used', day);
    const backstopRuns = checkedRuns(await get(`/actions/workflows/${BACKSTOP}/runs?branch=main&created=${day}&per_page=100`), BACKSTOP, day);
    if (backstopRuns.some((run) => run.status !== 'completed')) return no('backstop-active', day);
    if (backstopRuns.some((run) => run.conclusion !== 'success')) throw hold('previous-backstop-not-successful');
    if (backstopRuns.some((run) => run.event === 'workflow_dispatch')) return no('wake-already-requested', day);

    // Recheck publication and clock immediately before the ONLY write.
    if (await articleExists()) return no('edition-already-on-main', day);
    const justBeforePost = clock();
    if (utcDay(justBeforePost) !== day || !inWindow(justBeforePost)) return no('window-expired', day);
    postStarted = true;
    const response = await fetchImpl(`${ROOT}/actions/workflows/${BACKSTOP}/dispatches`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'main' }), signal: abort.signal, redirect: 'error', cache: 'no-store',
    });
    if (response.status !== 204) throw hold('wake-dispatch-not-confirmed');
    return { state: 'wake-requested', reason: 'github-accepted-backstop-dispatch', day,
      targetWorkflow: BACKSTOP, origin: 'external-vercel-scheduler', nativeAcceptance: false };
  } catch (error) {
    return { state: 'hold', reason: postStarted ? 'wake-dispatch-unknown-do-not-retry' :
      (error?.safeReason || 'inspection-unavailable'), day, nativeAcceptance: false };
  } finally { clearTimeout(timer); }
}

export function createScheduleWakeHandler({ env = process.env, fetchImpl = globalThis.fetch,
  clock = () => new Date(), log = (message) => console.info(message) } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    const send = (code, value) => res.status(code).json(value);
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return send(405, { state: 'rejected', reason: 'method-not-allowed' });
    }
    if (!authorizedWake(req.headers?.authorization, env.CRON_SECRET)) {
      return send(401, { state: 'rejected', reason: 'unauthorized' });
    }
    // Neither the date, destination repository nor workflow can come from the URL.
    if (typeof req.url !== 'string' || req.url.includes('?')) {
      return send(400, { state: 'rejected', reason: 'parameters-not-allowed' });
    }
    const result = await wakeDailyBackstop({ env, fetchImpl, clock });
    log(JSON.stringify({ component: 'daily-schedule-wake', ...result }));
    return send(result.state === 'hold' ? 503 : result.state === 'wake-requested' ? 202 : 200, result);
  };
}
