/** One-shot read-only acquisition. No control-center import, writes or execution authority. */
import { createHash } from 'node:crypto';
import { classifyDailyDelivery, deadlineClock } from './publishing-deadline-status.mjs';

export const SCOPE = Object.freeze({
  repo: 'usdimpact/usd-impact-site', branch: 'main',
  project: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7', team: 'team_1LuMlacGuM198mRjoID4O3Ct',
});
const ROOT = `https://api.github.com/repos/${SCOPE.repo}`;
const WEB = `https://github.com/${SCOPE.repo}`;
const SHA = /^[a-f0-9]{40}$/;
const ACTIVE = ['queued', 'in_progress', 'waiting', 'pending', 'requested'];
const WORKFLOWS = { daily: 'daily-news.yml', backstop: 'daily-news-schedule-backstop.yml' };
const CLOSED_PR_LOOKBACK_DAYS = 14;
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const failure = code => Object.assign(new Error(code), { safeCode: code });
const validDay = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) &&
  Number.isFinite(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
const number = n => Number.isSafeInteger(n) && n > 0;

// Keep response text, error bodies, credentials and arbitrary response URLs out of the report.
function safeUrl(url, pattern) {
  if (typeof url !== 'string' || !pattern.test(url)) throw failure('invalid-receipt');
  return url;
}
function allowed(url, edition) {
  if (url.username || url.password || url.hash) return false;
  if (url.origin === 'https://api.github.com') {
    if (!url.pathname.startsWith(`/repos/${SCOPE.repo}/`)) return false;
    const p = url.pathname.slice(`/repos/${SCOPE.repo}/`.length);
    return /^(git\/ref\/heads\/main|pulls(?:\/\d+(?:\/(?:files|reviews))?)?|actions\/workflows\/(?:daily-news|daily-news-schedule-backstop)\.yml\/runs|actions\/runs\/\d+\/jobs|commits\/[a-f0-9]{40}\/check-runs)$/.test(p) ||
      p === `contents/apps/web/src/content/news/${edition}.md`;
  }
  if (url.origin === 'https://api.vercel.com') {
    return /^\/v13\/deployments\/(?:www\.usd-impact\.com|usd-impact\.com)$/.test(url.pathname) &&
      url.searchParams.get('teamId') === SCOPE.team;
  }
  return url.origin === 'https://www.usd-impact.com' && url.search === '' &&
    [`/news/${edition}`, '/news', '/news/latest.json', '/news/feed.xml'].includes(url.pathname);
}

/** Exact blob verification, then deliberately narrow frontmatter parsing. Unsupported syntax is UNKNOWN. */
export function readArticle(data, edition, mainSha, observedAt) {
  if (!record(data) || data.type !== 'file' || data.path !== `apps/web/src/content/news/${edition}.md` ||
      !SHA.test(data.sha) || data.encoding !== 'base64' || typeof data.content !== 'string') throw failure('invalid-article');
  const encoded = data.content.replace(/\s/g, '');
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw failure('invalid-article-encoding');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length > 512000 || bytes.length !== data.size) throw failure('article-size-mismatch');
  const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (hash !== data.sha) throw failure('article-blob-mismatch');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw failure('unknown-frontmatter');
  // This is intentionally not a general YAML parser. Reject alternate top-level
  // key syntax rather than misreading a later quoted/spaced/explicit duplicate.
  if (match[1].includes('\t') || match[1].split(/\r?\n/).some(line =>
    line && !/^\s|^#|^- |^[A-Za-z][A-Za-z0-9]*:/.test(line))) throw failure('unsupported-frontmatter');
  const fields = {};
  for (const key of ['date', 'status']) {
    const lines = match[1].split(/\r?\n/).filter(line => line.startsWith(`${key}:`));
    if (lines.length !== 1) throw failure('ambiguous-frontmatter');
    const raw = lines[0].slice(key.length + 1).trim();
    if (/^(?:"[^"]*"|'[^']*'|[a-z0-9-]+)$/.test(raw) === false) throw failure('unsupported-frontmatter');
    fields[key] = /^['"]/.test(raw) ? raw.slice(1, -1) : raw;
  }
  if (fields.date !== edition || !['review', 'published'].includes(fields.status)) throw failure('article-identity-mismatch');
  return { observedAt, edition, mainSha, state: fields.status, contentSha: data.sha };
}

/**
 * Fixed destinations only. Limits may be reduced for tests, never raised above production bounds.
 * Completeness is proved by pagination; budget exhaustion is not interpreted as an empty collection.
 * Source review, human approval, dispatch lineage and protected-merge attestations are NOT inferred.
 */
export async function collectDailyDelivery({ edition, fetchImpl = globalThis.fetch,
  clock = () => new Date().toISOString(), githubToken = '', vercelToken = '',
  limits = {} } = {}) {
  if (!validDay(edition) || typeof fetchImpl !== 'function' || typeof clock !== 'function') throw failure('invalid-input');
  if (![githubToken, vercelToken].every(t => typeof t === 'string' && t.length <= 10000 && !/[\r\n]/.test(t))) throw failure('invalid-credential-shape');
  const cap = { requests: 120, pages: 10, bodyBytes: 2000000, durationMs: 120000, timeoutMs: 10000 };
  for (const [key, value] of Object.entries(limits)) {
    if (!(key in cap) || !number(value) || value > cap[key]) throw failure('invalid-limit');
    cap[key] = value;
  }
  const start = clock();
  if (!deadlineClock(start)) throw failure('invalid-clock');
  const started = Date.parse(start), wall = performance.now();
  const gaps = [], receipts = []; let requests = 0;
  const report = { version: 1, edition, observedAt: start, mainSha: null,
    article: { observedAt: start, edition, mainSha: null, state: 'unknown' },
    prs: { observedAt: start, coverage: 'incomplete', items: [] },
    runs: { observedAt: start, coverage: 'incomplete', items: [] }, dispatchReceipt: 'unknown' };
  const observations = { production: null, live: {}, candidateChecks: [], reviews: [] };
  async function read(address, format = 'json', allow404 = false) {
    const url = new URL(address);
    if (!allowed(url, edition)) throw failure('destination-not-allowed');
    if (++requests > cap.requests || performance.now() - wall > cap.durationMs) throw failure('read-budget-exhausted');
    const observedAt = clock();
    if (!deadlineClock(observedAt) || Date.parse(observedAt) < started) throw failure('clock-regressed');
    const headers = { Accept: format === 'json' ? 'application/json' : 'text/html, application/xml', 'User-Agent': 'usd-impact-read-only-delivery-evidence' };
    if (url.origin === 'https://api.github.com') {
      headers.Accept = 'application/vnd.github+json'; headers['X-GitHub-Api-Version'] = '2022-11-28';
      if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
    } else if (url.origin === 'https://api.vercel.com' && vercelToken) headers.Authorization = `Bearer ${vercelToken}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(cap.timeoutMs, Math.max(1, cap.durationMs - (performance.now() - wall))));
    try {
      const response = await fetchImpl(url.href, { method: 'GET', headers, redirect: 'error', cache: 'no-store', signal: controller.signal });
      if (response.redirected || (response.url && response.url !== url.href)) throw failure('unexpected-response-url');
      receipts.push({ url: url.href, observedAt, status: response.status });
      if (response.status === 404 && allow404) return { missing: true, observedAt };
      if (response.status !== 200) throw failure(`http-${response.status}`);
      const declared = Number(response.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > cap.bodyBytes) throw failure('response-too-large');
      if (!response.body) throw failure('empty-response');
      const reader = response.body.getReader(); const chunks = []; let size = 0;
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > cap.bodyBytes) { await reader.cancel(); throw failure('response-too-large'); }
        chunks.push(value);
      }
      const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
      let data;
      try { data = format === 'json' ? JSON.parse(text) : text; } catch { throw failure('invalid-json'); }
      return { data, observedAt };
    } catch (error) { throw failure(error.safeCode || (controller.signal.aborted ? 'read-timeout' : 'read-unavailable')); }
    finally { clearTimeout(timeout); }
  }
  async function group(name, fn) {
    try { return await fn(); } catch (error) { gaps.push({ group: name, code: error.safeCode || 'invalid-evidence' }); return null; }
  }
  async function pages(path, key = null, query = {}) {
    const values = []; const ids = new Set(); let total = null;
    for (let page = 1; page <= cap.pages; page++) {
      const url = new URL(`${ROOT}/${path}`);
      for (const [k, v] of Object.entries({ ...query, per_page: 100, page })) url.searchParams.set(k, String(v));
      const { data } = await read(url.href);
      if (key) {
        if (!record(data) || !Number.isSafeInteger(data.total_count) || data.total_count < 0 || data.total_count >= 1000) throw failure('collection-count-unbounded');
        if (total !== null && total !== data.total_count) throw failure('collection-changed');
        total = data.total_count;
      }
      const items = key ? data[key] : data;
      if (!Array.isArray(items) || items.length > 100) throw failure('invalid-collection');
      for (const item of items) {
        if (!record(item)) throw failure('invalid-collection-item');
        const id = item.id ?? item.filename;
        if ((typeof id !== 'string' && !number(id)) || ids.has(id)) throw failure('duplicate-or-invalid-item');
        ids.add(id); values.push(item);
      }
      if (items.length < 100) {
        if (key && values.length !== total) throw failure('incomplete-collection');
        return values;
      }
    }
    throw failure('pagination-limit');
  }
  function normalizeRun(run, workflow) {
    if (!number(run.id) || run.head_branch !== 'main' || run.path !== `.github/workflows/${WORKFLOWS[workflow]}` ||
        !SHA.test(run.head_sha) || !['schedule', 'workflow_dispatch'].includes(run.event) || !deadlineClock(run.created_at) || !deadlineClock(run.updated_at)) throw failure('unexpected-run');
    // Event dates are an observation, not proof of dispatch-input edition; never claim lineage here.
    return { id: run.id, workflow, branch: run.head_branch, event: run.event, headSha: run.head_sha,
      edition: run.created_at.slice(0, 10), createdAt: run.created_at, updatedAt: run.updated_at,
      status: run.status, conclusion: run.conclusion, receipt: `${WEB}/actions/runs/${run.id}` };
  }
  await group('main', async () => {
    const { data } = await read(`${ROOT}/git/ref/heads/main`);
    if (data?.ref !== 'refs/heads/main' || !SHA.test(data?.object?.sha)) throw failure('invalid-main');
    report.mainSha = data.object.sha; report.article.mainSha = report.mainSha;
  });
  if (report.mainSha) await group('article', async () => {
    const result = await read(`${ROOT}/contents/apps/web/src/content/news/${edition}.md?ref=${report.mainSha}`, 'json', true);
    report.article = result.missing ? { ...report.article, observedAt: result.observedAt, state: 'absent' } :
      readArticle(result.data, edition, report.mainSha, result.observedAt);
  });
  // Read run state before an expensive complete history scan. All active dates are covered.
  await group('runs', async () => {
    const all = new Map();
    for (const [kind, filename] of Object.entries(WORKFLOWS)) {
      const queries = [{ created: edition }, ...ACTIVE.map(status => ({ status }))];
      for (const query of queries) for (const raw of await pages(`actions/workflows/${filename}/runs`, 'workflow_runs', { branch: 'main', ...query })) {
        const run = normalizeRun(raw, kind), prior = all.get(run.id);
        if (prior && JSON.stringify(prior) !== JSON.stringify(run)) throw failure('run-changed-during-read');
        all.set(run.id, run);
      }
    }
    report.runs.items = [...all.values()];
    if (all.size > 100) throw failure('too-many-runs');
    report.runs.coverage = 'all-active-and-edition-complete';
    // No logs or scheduler-request witness is fabricated from a green backstop.
    report.dispatchReceipt = report.runs.items.some(r => r.workflow === 'backstop' && r.event === 'workflow_dispatch') ? 'unknown' : 'none';
    if (report.dispatchReceipt === 'unknown') gaps.push({ group: 'dispatch', code: 'external-wake-receipt-not-attested' });
  });
  await group('prs', async () => {
    const exactPath = `apps/web/src/content/news/${edition}.md`;
    const floor = Date.parse(`${edition}T00:00:00Z`) - CLOSED_PR_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
    const inspect = new Map();

    // Open PRs are always inspected, regardless of age, because any still-open branch can
    // suppress a competing Daily candidate. Closed/merged PRs are inspected only inside a
    // conservative edition-relative window; Daily publication PRs are same-day artifacts,
    // so an older closed off-contract branch is not active editorial state for this edition.
    for (const raw of await pages('pulls', null, { state: 'open', base: 'main', sort: 'updated', direction: 'desc' })) {
      inspect.set(raw.number, raw);
    }

    let closedWindowComplete = false;
    for (let page = 1; page <= cap.pages; page++) {
      const url = new URL(`${ROOT}/pulls`);
      for (const [k, v] of Object.entries({ state: 'closed', base: 'main', sort: 'updated', direction: 'desc', per_page: 100, page })) {
        url.searchParams.set(k, String(v));
      }
      const { data } = await read(url.href);
      if (!Array.isArray(data) || data.length > 100) throw failure('invalid-collection');
      let crossedFloor = false;
      for (const raw of data) {
        if (!record(raw) || !number(raw.number) || typeof raw.updated_at !== 'string' || !deadlineClock(raw.updated_at)) throw failure('invalid-pr');
        const updated = Date.parse(raw.updated_at);
        if (!Number.isFinite(updated)) throw failure('invalid-pr');
        if (updated < floor) { crossedFloor = true; continue; }
        inspect.set(raw.number, raw);
      }
      if (data.length < 100 || crossedFloor) { closedWindowComplete = true; break; }
    }
    if (!closedWindowComplete) throw failure('closed-pr-window-pagination-limit');

    const ordered = [...inspect.values()].sort((a, b) =>
      Number(String(b.title).includes(edition) || String(b.head?.ref).includes(edition)) -
      Number(String(a.title).includes(edition) || String(a.head?.ref).includes(edition)));

    for (const raw of ordered) {
      if (requests >= cap.requests - Math.min(24, Math.floor(cap.requests / 3))) throw failure('pr-file-history-budget');
      if (!number(raw.number) || typeof raw.title !== 'string' || typeof raw.head?.ref !== 'string' ||
          !SHA.test(raw.head?.sha) || !['open', 'closed'].includes(raw.state) ||
          typeof raw.updated_at !== 'string' || !deadlineClock(raw.updated_at)) throw failure('invalid-pr');
      const files = await pages(`pulls/${raw.number}/files`);
      if (files.length >= 3000 || files.some(f => typeof f.filename !== 'string')) throw failure('incomplete-pr-files');
      const paths = files.map(f => f.filename);
      if (!raw.title.includes(edition) && !raw.head.ref.includes(edition) && !paths.includes(exactPath)) continue;
      const { data: pr } = await read(`${ROOT}/pulls/${raw.number}`);
      if (pr.number !== raw.number || pr.head?.sha !== raw.head.sha || pr.state !== raw.state || pr.updated_at !== raw.updated_at) throw failure('pr-changed-during-read');
      report.prs.items.push({ number: pr.number, edition, state: pr.merged_at ? 'merged' : pr.state,
        draft: pr.draft, title: pr.title, headRef: pr.head.ref, headSha: pr.head.sha,
        files: paths, mergeSha: pr.merge_commit_sha, receipt: `${WEB}/pull/${pr.number}` });
      if (report.prs.items.length > 100) throw failure('too-many-candidates');
    }
    report.prs.coverage = 'open-all-closed-14d-complete';
  });
  // Facts only: do not parse prose comments into source-review/human approval certificates.
  for (const pr of report.prs.items.slice(0, 5)) await group('candidate-checks', async () => {
    const checks = await pages(`commits/${pr.headSha}/check-runs`, 'check_runs', { filter: 'latest' });
    observations.candidateChecks.push({ pr: pr.number, headSha: pr.headSha, checks: checks.map(c => ({
      name: c.name, status: c.status, conclusion: c.conclusion, headSha: c.head_sha,
      appId: c.app?.id ?? null, receipt: safeUrl(c.html_url, /^https:\/\/github\.com\/usdimpact\/usd-impact-site\/(?:actions\/runs\/\d+\/job\/\d+|runs\/\d+)$/),
    })) });
    gaps.push({ group: `candidate-${pr.number}`, code: 'source-human-audit-preview-receipts-require-review' });
  });
  if (vercelToken) await group('production', async () => {
    const deployments = [];
    for (const domain of ['www.usd-impact.com', 'usd-impact.com']) {
      const { data: d } = await read(`https://api.vercel.com/v13/deployments/${domain}?teamId=${SCOPE.team}`);
      if (d.projectId !== SCOPE.project && d.project?.id !== SCOPE.project) throw failure('wrong-production-project');
      if (d.target !== 'production' || !/^dpl_[A-Za-z0-9]+$/.test(d.id) || !SHA.test(d.meta?.githubCommitSha) || d.meta?.githubCommitRef !== 'main') throw failure('invalid-production-identity');
      deployments.push({ id: d.id, sha: d.meta.githubCommitSha, state: d.readyState ?? d.state, domain,
        receipt: `https://vercel.com/usd-impact/usd-impact-site/${d.id.slice(4)}` });
    }
    if (deployments[0].id !== deployments[1].id || deployments[0].sha !== deployments[1].sha) throw failure('canonical-alias-drift');
    observations.production = { ...deployments[0], domains: deployments.map(d => d.domain), matchesMain: deployments[0].sha === report.mainSha };
  });
  else gaps.push({ group: 'production', code: 'vercel-read-access-not-supplied' });
  for (const [key, path] of Object.entries({ article: `/news/${edition}`, index: '/news', latestJson: '/news/latest.json', rss: '/news/feed.xml' })) await group(`live-${key}`, async () => {
    const url = `https://www.usd-impact.com${path}`;
    const r = await read(url, key === 'latestJson' ? 'json' : 'text', true);
    // Availability/content digest is not claim fidelity, edition identity or deployed-SHA proof.
    observations.live[key] = { receipt: url, observedAt: r.observedAt, status: r.missing ? 404 : 200,
      digest: r.missing ? null : createHash('sha256').update(typeof r.data === 'string' ? r.data : JSON.stringify(r.data)).digest('hex') };
  });
  const stable = await group('stability', async () => {
    const { data } = await read(`${ROOT}/git/ref/heads/main`);
    if (data?.object?.sha !== report.mainSha) throw failure('main-changed-during-read');
    return true;
  });
  if (!stable) report.prs.coverage = 'incomplete';
  const now = clock();
  if (!deadlineClock(now) || Date.parse(now) < started || Date.parse(now) - started > 300000) gaps.push({ group: 'clock', code: 'snapshot-expired-or-clock-invalid' });
  const classification = classifyDailyDelivery({ now, edition, evidence: report });
  return { schemaVersion: 1, mode: 'READ_ONLY_UNSCHEDULED', collectedAt: now, evidence: report, observations,
    classification, gaps, receipts, requests: Math.min(requests, cap.requests),
    executionAllowed: false, scheduledActivation: false, sourceReviewAttested: false, humanApprovalAttested: false };
}
