import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { verifyDailyNewsDeployment } from './check-daily-news-deployment-health.mjs';

const ISSUE_URL = 'https://github.com/usdimpact/usd-impact-site/issues/840';
const BASE_URL = 'https://www.usd-impact.com';
const USER_AGENT = 'usd-impact-early-daily-advisory/1.0';

function requireDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) {
    throw new Error('Expected a real ISO edition date.');
  }
  return value;
}

function newYorkClock(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hourCycle: 'h23', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(now);
  const get = (part) => parts.find((item) => item.type === part)?.value;
  return {
    date: get('year') + '-' + get('month') + '-' + get('day'),
    time: get('hour') + ':' + get('minute'),
  };
}

async function apiGet(path, { repository, token, fetchImpl }) {
  const url = 'https://api.github.com/repos/' + repository + path;
  const response = await fetchImpl(url, {
    headers: {
      authorization: 'Bearer ' + token,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': USER_AGENT,
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('GitHub evidence unavailable (HTTP ' + response.status + ').');
  try {
    return await response.json();
  } catch {
    throw new Error('GitHub evidence was not valid JSON.');
  }
}

function requireOnePage(result, label) {
  if (!result || !Array.isArray(result.workflow_runs)
    || !Number.isInteger(result.total_count)
    || result.total_count !== result.workflow_runs.length
    || result.total_count > 100) {
    throw new Error(label + ' workflow receipt was incomplete or ambiguous.');
  }
  return result.workflow_runs;
}

function verifiedGenerator(run, date) {
  if (run?.path !== '.github/workflows/daily-news.yml'
    || run.head_branch !== 'main'
    || run.status !== 'completed' || run.conclusion !== 'success'
    || run.run_attempt !== 1 || !run.created_at?.startsWith(date)) return false;
  if (run.event === 'schedule') return true;
  return run.event === 'workflow_dispatch'
    && run.actor?.login === 'github-actions[bot]'
    && run.triggering_actor?.login === 'github-actions[bot]';
}

async function mergedBotDaily({ date, runs, repository, token, fetchImpl }) {
  const found = [];
  for (const run of runs) {
    const branch = 'automation/daily-usd-impact-' + date + '-' + run.id;
    const query = '/pulls?state=all&head='
      + encodeURIComponent(repository.split('/')[0] + ':' + branch)
      + '&per_page=100';
    const pulls = await apiGet(query, { repository, token, fetchImpl });
    if (!Array.isArray(pulls) || pulls.length > 1) {
      throw new Error('Original Daily PR query returned ambiguous evidence.');
    }
    if (pulls.length !== 1) continue;
    const pr = pulls[0];
    if (pr.head?.ref !== branch
      || pr.base?.ref !== 'main'
      || pr.title !== 'Publish Daily USD Impact — ' + date
      || !pr.merged_at) continue;
    const detail = await apiGet('/pulls/' + pr.number, { repository, token, fetchImpl });
    if (!detail?.merged || detail.merged_by?.login !== 'github-actions[bot]'
      || detail.head?.ref !== branch) continue;
    const files = await apiGet('/pulls/' + pr.number + '/files?per_page=100',
      { repository, token, fetchImpl });
    if (!Array.isArray(files) || files.length !== 1
      || files[0].filename !== 'apps/web/src/content/news/' + date + '.md'
      || files[0].status !== 'added') continue;
    found.push({ number: pr.number, runId: run.id, event: run.event });
  }
  if (found.length !== 1) {
    throw new Error('No unique source-linked, bot-merged, one-file Daily PR was proven.');
  }
  return found[0];
}

export async function checkEarlyDaily({
  date,
  repository = 'usdimpact/usd-impact-site',
  token,
  now = new Date(),
  fetchImpl = globalThis.fetch,
  baseUrl = BASE_URL,
} = {}) {
  requireDate(date);
  if (!/^[-\w.]+\/[-\w.]+$/.test(repository) || typeof token !== 'string' || !token) {
    throw new Error('Approved repository and GitHub token are required.');
  }
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is required.');
  const local = newYorkClock(now);
  if (local.date !== date) throw new Error('Edition and New York dates differ; fail closed.');
  if (local.time < '08:30') {
    return { state: 'BEFORE_CUTOFF', date, usTime: local.time };
  }

  const github = { repository, token, fetchImpl };
  const mainFile = await apiGet(
    '/contents/apps/web/src/content/news/' + date + '.md?ref=main', github,
  );
  if (!mainFile || mainFile.type !== 'file') {
    throw new Error('Dated edition is missing from protected main.');
  }

  const sourceResponse = await apiGet(
    '/actions/workflows/daily-news.yml/runs?created='
    + encodeURIComponent(date) + '&per_page=100', github,
  );
  const sourceRuns = requireOnePage(sourceResponse, 'Daily source')
    .filter((run) => verifiedGenerator(run, date));
  if (sourceRuns.length < 1 || sourceRuns.length > 3) {
    throw new Error('No bounded first-attempt scheduled/bot Daily generator was proven.');
  }

  const matchedPr = await mergedBotDaily({
    date, runs: sourceRuns, repository, token, fetchImpl,
  });

  const publisherResponse = await apiGet(
    '/actions/workflows/daily-news-auto-publish.yml/runs?created='
    + encodeURIComponent(date) + '&per_page=100', github,
  );
  const publisherRuns = requireOnePage(publisherResponse, 'Daily publisher')
    .filter((run) => run.path === '.github/workflows/daily-news-auto-publish.yml'
      && run.head_branch === 'main'
      && (run.event === 'workflow_run' || run.event === 'workflow_dispatch')
      && run.status === 'completed' && run.conclusion === 'success'
      && run.run_attempt === 1 && run.created_at?.startsWith(date));
  if (!publisherRuns.length) {
    throw new Error('No completed successful first-attempt bounded publisher was observed.');
  }

  const deployed = await verifyDailyNewsDeployment({
    expectedDate: date,
    baseUrl,
    fetchImpl,
    attempts: 2,
    retryDelayMs: 0,
  });
  const indexResponse = await fetchImpl(baseUrl + '/news', {
    headers: { accept: 'text/html', 'cache-control': 'no-cache', 'user-agent': USER_AGENT },
  });
  if (!indexResponse.ok) throw new Error('Daily news index HTTP ' + indexResponse.status + '.');
  const indexHtml = await indexResponse.text();
  if (!indexHtml.includes('Latest edition')
    || !indexHtml.includes(deployed.title)
    || !indexHtml.includes('/news/' + date)) {
    throw new Error('News index/latest edition parity was not proven.');
  }

  return {
    state: 'PRELIMINARY_PASS',
    date,
    usTime: local.time,
    sourceRunId: matchedPr.runId,
    generatorEvent: matchedPr.event,
    articlePr: matchedPr.number,
    publisherRunIds: publisherRuns.map((run) => run.id),
    title: deployed.title,
  };
}

export function formatEarlyReport({ date, result, failure }) {
  const lines = [
    '# Daily USD Impact early advisory',
    '',
    '- Edition: ' + date,
    '- Observation: first weekday check after the 08:30 New York cutoff',
    '- Scope: read-only GitHub provenance and four public surfaces; no regeneration or merge',
  ];
  if (failure) {
    lines.push('- Status: HOLD / investigate', '- Observation: ' + failure);
    lines.push('- Incident: ' + ISSUE_URL);
    lines.push('- Next step: preserve source PR, investigate; later Health retains sole closure authority');
  } else {
    lines.push('- Status: ' + result.state);
    lines.push('- New York clock: ' + result.usTime);
    if (result.sourceRunId) {
      lines.push('- Original source run: https://github.com/usdimpact/usd-impact-site/actions/runs/' + result.sourceRunId);
      lines.push('- Source type: ' + result.generatorEvent);
      lines.push('- Original merged PR: https://github.com/usdimpact/usd-impact-site/pull/' + result.articlePr);
      lines.push('- Publisher runs observed: ' + result.publisherRunIds.join(', '));
      lines.push('- Public latest JSON, article, RSS, and News index: matching edition');
    }
    lines.push('- Qualification: this early advisory does not attest the exact Vercel SHA or close the unattended incident');
  }
  return lines.join('\n') + '\n';
}

function parseCli(args) {
  const opts = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--date') opts.date = args[++index];
    else if (args[index] === '--report') opts.report = args[++index];
    else throw new Error('Unsupported early advisory argument.');
  }
  if (!opts.date || !opts.report) throw new Error('--date and --report are required.');
  return opts;
}

async function main() {
  const opts = parseCli(process.argv.slice(2));
  let result;
  let failure;
  try {
    result = await checkEarlyDaily({
      date: opts.date,
      repository: process.env.GITHUB_REPOSITORY,
      token: process.env.GH_TOKEN,
    });
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Unidentified advisory error';
    process.exitCode = 1;
  }
  const report = formatEarlyReport({ date: opts.date, result, failure });
  await writeFile(opts.report, report, 'utf8');
  console.log(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
