import { execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { verifyDailyNewsDeployment } from './check-daily-news-deployment-health.mjs';
import {
  REPOSITORY, beforeUsFirstRelease, validateSourceRun, isTrustedBackstop,
  selectExactDailyPr, validateDailyContent, requireExactChecks, isSingleGeneratorCommit,
  dispatchSourceRunId,
} from './daily-news-auto-publish-policy.mjs';

const SHA = /^[a-f0-9]{40}$/;
const NOW = () => new Date();
function gh(args, timeout = 30000) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8', timeout, maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, GH_PAGER: 'cat', GIT_TERMINAL_PROMPT: '0' },
    }).trim();
  } catch {
    throw new Error('github-api-or-workflow-request-failed');
  }
}
function api(route) { return JSON.parse(gh(['api', 'repos/' + REPOSITORY + '/' + route])); }
function notice(message) { console.log('Daily auto-publication: ' + message); }
function summary(message) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, '- ' + message + '\n', 'utf8');
  }
}
function hold(reason) { throw new Error(reason); }
function noOp(reason) { notice('NOOP: ' + reason); summary('NOOP: ' + reason); }
function ensureMorning() { if (!beforeUsFirstRelease(NOW())) hold('after-first-us-release-cutoff'); }
function currentMain() { return api('branches/main').commit.sha; }

async function findRun(workflow, branch, headSha, requestedAt) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const result = JSON.parse(gh(['run', 'list', '--repo', REPOSITORY,
      '--workflow', workflow, '--branch', branch, '--event', 'workflow_dispatch',
      '--limit', '30', '--json', 'databaseId,headSha,createdAt,status,conclusion']));
    const matching = result.filter((run) =>
      run.headSha === headSha && Date.parse(run.createdAt) >= requestedAt - 15_000
    ).sort((a, b) => b.databaseId - a.databaseId);
    if (matching.length === 1) return matching[0].databaseId;
    if (matching.length > 1) hold('ambiguous-dispatched-check-runs');
    await sleep(5000);
  }
  hold('missing-dispatched-check-run-' + workflow.replace(/[^a-z]+/gi, '-'));
}

function requiredCheckSnapshot(headSha) {
  const payload = api('commits/' + headSha + '/check-runs?per_page=100');
  if (payload.total_count > 100 || payload.total_count !== payload.check_runs.length) {
    hold('incomplete-required-check-list');
  }
  return payload.check_runs;
}

async function previewReady(headSha) {
  for (let attempt = 0; attempt < 36; attempt++) {
    const statuses = api('commits/' + headSha + '/status').statuses || [];
    const vercel = statuses.filter((x) => x.context === 'Vercel');
    if (vercel[0]?.state === 'success') return;
    if (['error', 'failure'].includes(vercel[0]?.state)) hold('preview-deployment-failed');
    await sleep(10000);
  }
  hold('preview-deployment-not-verified');
}

async function verifyLive(editionDate) {
  const url = 'https://www.usd-impact.com/news/';
  for (let attempt = 0; attempt < 22; attempt++) {
    try {
      const result = await verifyDailyNewsDeployment({
        expectedDate: editionDate, attempts: 1, retryDelayMs: 0,
      });
      const response = await fetch(url, {
        headers: { 'cache-control': 'no-cache', 'user-agent': 'usd-impact-auto-release/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('index-non-200');
      const html = await response.text();
      if (!html.includes(result.title)) throw new Error('latest-index-not-yet-deployed');
      return result;
    } catch {
      if (attempt < 21) await sleep(15000);
    }
  }
  hold('production-live-edition-not-verified');
}


async function lookupAuthenticSourceRun() {
  if (process.env.GITHUB_REPOSITORY !== REPOSITORY) hold('unexpected-repository');
  if (process.env.GITHUB_EVENT_NAME === 'workflow_run') {
    const envelope = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const source = envelope.workflow_run;
    if (!source) hold('missing-workflow-run-receipt');
    // An explicitly-dispatched Daily has its own independently verified
    // workflow_dispatch path. Suppress the fallback workflow_run to avoid
    // two controllers racing to merge the same article.
    if (source.event === 'workflow_dispatch') return null;
    return source;
  }
  if (process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch'
      || process.env.GITHUB_REF !== 'refs/heads/main') {
    hold('not-a-trusted-publisher-event');
  }
  const envelope = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const id = dispatchSourceRunId(envelope);
  for (let attempt = 0; attempt < 24; attempt++) {
    // Never trust the supplied run ID until its GitHub REST receipt, immutable
    // source workflow identity, and actual successful completion are verified.
    const source = api('actions/runs/' + id);
    if (source.id !== id || source.repository?.full_name !== REPOSITORY
        || source.path !== '.github/workflows/daily-news.yml'
        || source.head_branch !== 'main' || source.event !== 'workflow_dispatch') {
      hold('explicit-source-run-not-authenticated-backstop-candidate');
    }
    if (source.status === 'completed') {
      if (source.conclusion !== 'success') hold('explicit-source-run-not-successful');
      return source;
    }
    await sleep(5000);
  }
  hold('source-run-completion-not-confirmed-within-bounded-lease');
}

async function run() {
  const source = await lookupAuthenticSourceRun();
  if (source === null) return noOp('explicit-source-uses-trusted-dispatch-controller');
  if (source.conclusion !== 'success') return noOp('source-workflow-not-successful');
  const mainSha = currentMain();
  const jobsPayload = api('actions/runs/' + source.id + '/jobs?per_page=100');
  if (jobsPayload.total_count !== jobsPayload.jobs?.length || jobsPayload.total_count > 100) {
    hold('incomplete-source-job-evidence');
  }
  const reason = validateSourceRun(source, jobsPayload.jobs, mainSha, NOW());
  if (reason === 'not-a-successful-trusted-daily-run' || reason === 'generator-required-step-missing-or-failed') {
    return noOp(reason);
  }
  if (reason) hold(reason);
  const editionDate = source.created_at.slice(0, 10);
  if (source.event === 'workflow_dispatch') {
    const backstop = api('actions/workflows/daily-news-schedule-backstop.yml/runs?created='
      + editionDate + '&per_page=100');
    if (backstop.total_count !== backstop.workflow_runs?.length
        || !isTrustedBackstop(backstop.workflow_runs, source)) {
      hold('not-a-proven-automatic-backstop-run');
    }
  }

  const pulls = api('pulls?state=open&base=main&per_page=100');
  const { prNumber, branch, headSha } = selectExactDailyPr(pulls, source, mainSha);
  const pr = api('pulls/' + prNumber);
  if (pr.head.sha !== headSha || pr.base.sha !== mainSha || pr.draft || pr.state !== 'open'
      || pr.head.repo?.full_name !== REPOSITORY) hold('pull-request-head-or-base-drift');
  const compare = api('compare/' + mainSha + '...' + headSha);
  if (!isSingleGeneratorCommit(compare, editionDate)) hold('pr-head-is-not-the-original-one-commit-generator-output');
  const files = api('pulls/' + prNumber + '/files?per_page=100');
  const expectedPath = 'apps/web/src/content/news/' + editionDate + '.md';
  if (!Array.isArray(files) || files.length !== 1
      || files[0].filename !== expectedPath || files[0].status !== 'added') {
    hold('unexpected-publication-file-scope');
  }
  // Build the source URL only from the verified ISO date, never from PR data.
  const contentResult = api('contents/' + expectedPath + '?ref=' + headSha);
  if (contentResult.encoding !== 'base64') hold('unreadable-publication-file');
  const content = Buffer.from(contentResult.content, 'base64').toString('utf8');
  const counts = validateDailyContent(content, editionDate, files[0]);
  const initial = requiredCheckSnapshot(headSha);
  if (!initial.some((x) => x.name === 'validate-and-build' && x.head_sha === headSha
      && x.status === 'completed' && x.conclusion === 'success')) {
    hold('original-exact-head-web-quality-not-successful');
  }
  notice('Eligible one-file ' + editionDate + ' PR #' + prNumber
    + ': ' + counts.sourceCount + ' primary sources, ' + counts.headlineCount + ' highlights.');
  ensureMorning();

  const requestedAt = Date.now();
  gh(['workflow', 'run', 'supabase-production-intake-guard.yml', '--repo', REPOSITORY,
    '--ref', branch]);
  gh(['workflow', 'run', 'dependency-review.yml', '--repo', REPOSITORY,
    '--ref', branch, '-f', 'publication_pr=' + prNumber,
    '-f', 'publication_base_sha=' + mainSha]);
  const migrationId = await findRun('supabase-production-intake-guard.yml', branch, headSha, requestedAt);
  const dependencyId = await findRun('dependency-review.yml', branch, headSha, requestedAt);
  for (const [label, id] of [['migration', migrationId], ['dependency', dependencyId]]) {
    try {
      gh(['run', 'watch', String(id), '--repo', REPOSITORY, '--exit-status', '--interval', '5'], 12 * 60 * 1000);
    } catch { hold('dispatched-' + label + '-check-failed'); }
  }
  requireExactChecks(requiredCheckSnapshot(headSha), headSha);
  await previewReady(headSha);
  ensureMorning();

  const freshMainSha = currentMain();
  const freshPr = api('pulls/' + prNumber);
  if (freshMainSha !== mainSha || freshPr.head.sha !== headSha
      || freshPr.base.sha !== mainSha || freshPr.state !== 'open'
      || freshPr.draft || freshPr.mergeable !== true
      || freshPr.mergeable_state !== 'clean') hold('pre-merge-main-or-pr-changed');
  requireExactChecks(requiredCheckSnapshot(headSha), headSha);
  const result = JSON.parse(gh(['api', '-X', 'PUT',
    'repos/' + REPOSITORY + '/pulls/' + prNumber + '/merge',
    '-f', 'sha=' + headSha, '-f', 'merge_method=squash',
    '-f', 'commit_title=publish(daily): automatic guarded ' + editionDate]));
  if (!result.merged || !SHA.test(result.sha || '')) hold('protected-squash-merge-not-confirmed');
  notice('Merged one-file Daily PR #' + prNumber + ' at ' + result.sha);
  const live = await verifyLive(editionDate);
  notice('PRODUCTION VERIFIED: ' + live.editionUrl);
  summary('SUCCESS: guarded PR #' + prNumber + ', merge ' + result.sha + ', live article/index/JSON/RSS.');
  try {
    gh(['api', '-X', 'POST', 'repos/' + REPOSITORY + '/issues/840/comments',
      '-f', 'body=Auto-publisher outcome: VERIFIED ' + editionDate
      + ' PR #' + prNumber + ' merged at ' + result.sha
      + '; public article/index/latest.json/RSS served correctly. Native schedule timing must still be assessed separately.']);
  } catch { notice('Incident log update failed; publication proof remains in this run.'); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await run();
  } catch (error) {
    const reason = String(error?.message || 'unknown')
      .replace(/[^a-z0-9-]/gi, '-').slice(0, 100);
    console.error('Daily guarded auto-publication HOLD: ' + reason);
    try {
      const evidence = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
      const sourceId = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch'
        ? (typeof evidence.inputs?.source_run_id === 'string' ? evidence.inputs.source_run_id : '')
        : String(evidence.workflow_run?.id || '');
      const safeSourceId = /^[1-9][0-9]{0,15}$/.test(sourceId) ? sourceId : 'unknown';
      gh(['api', '-X', 'POST', 'repos/' + REPOSITORY + '/issues/840/comments',
        '-f', 'body=Daily guarded auto-publication HOLD: ' + reason
        + '. Source run ID: ' + safeSourceId
        + '. No content validation bypass or new generation was authorized.']);
    } catch { /* Never obscure original hold. */ }
    process.exitCode = 1;
  }
}
