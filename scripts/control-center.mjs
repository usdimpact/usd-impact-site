import fs from 'node:fs';
import path from 'node:path';
import {
  classifyWorkflowRecovery,
  evaluateDailyDispatch,
  isCompletedFailure,
  isFailureOnCurrentHead,
  isRunUnknown,
  selectWorkflowRun,
} from './control-center-policy.mjs';

const token = process.env.GITHUB_TOKEN || '';
const command = (process.argv[2] || 'status').replace(/^\//, '').toLowerCase();
const allowed = new Set(['status', 'next', 'daily', 'sync']);
if (!allowed.has(command)) {
  throw new Error(`Unsupported control-center command: ${command}`);
}
if (!token) {
  throw new Error('GITHUB_TOKEN is required');
}

const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'usd-impact-control-center'
};

async function gh(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${url}\n${text.slice(0, 800)}`);
  }
  return res.json();
}

function inferPriority(issue) {
  const title = issue.title || '';
  const labels = (issue.labels || []).map((label) => typeof label === 'string' ? label : label.name || '').join(' ');
  const text = `${title} ${labels}`;
  const match = text.match(/\bP([0-5])\b/i) || text.match(/priority[: -]*p([0-5])/i);
  return match ? `P${match[1]}`.toUpperCase() : 'P3';
}

function scoreIssue(issue) {
  const priority = inferPriority(issue);
  const base = { P0: 1000, P1: 800, P2: 600, P3: 400, P4: 200, P5: 100 }[priority];
  const body = issue.body || '';
  const text = `${issue.title || ''}\n${body}`.toLowerCase();
  let score = base;

  if (/production|security|compliance|customer access|customer-access|privacy/.test(text)) score += 90;
  if (/launch|release|deploy|deployment|authentication|auth\b|payment|email|support/.test(text)) score += 60;
  if (/daily|weekly|publish|publishing|automation|workflow/.test(text)) score += 50;
  if (/required before|blocks?\b|prerequisite|dependency/.test(text)) score += 40;

  const updatedAt = Date.parse(issue.updated_at || '');
  if (Number.isFinite(updatedAt) && Date.now() - updatedAt < 7 * 24 * 60 * 60 * 1000) score += 20;

  const explicitlyBlocked = /awaiting owner|owner decision|required owner decision|blocked by|cannot proceed until/.test(text);
  const phaseTwo = /phase 2|not a launch blocker|non-blocking/.test(text);
  const enhancementOnly = (issue.labels || []).some((label) => (typeof label === 'string' ? label : label.name) === 'enhancement') && priority === 'P3';
  if (explicitlyBlocked) score -= 120;
  if (phaseTwo) score -= 80;
  if (enhancementOnly) score -= 30;

  return { priority, score, explicitlyBlocked };
}

function dailyGateFromIssue(issue) {
  const text = `${issue.title || ''}\n${issue.body || ''}`;
  const marker = text.match(/<!--\s*usd-impact-daily-failure-stage:\s*([a-z0-9-]+)\s*-->/i);
  const visible = text.match(/Failure stage:\s*`?([a-z0-9-]+)`?/i);
  return String(marker?.[1] ?? visible?.[1] ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || null;
}

async function latestWorkflow(repo, workflow, { branch = null, headSha = null } = {}) {
  const params = new URLSearchParams({ per_page: '20' });
  if (branch) params.set('branch', branch);
  const data = await gh(
    `https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?${params}`,
  );
  // Branch filtering prevents automation and feature runs from shadowing the
  // default-branch state. An exact-head request never falls back to another SHA.
  const run = selectWorkflowRun(data.workflow_runs, { headSha });
  if (!run) {
    return {
      status: 'UNKNOWN',
      conclusion: 'UNKNOWN',
      url: null,
      created_at: null,
      head_sha: headSha || null,
    };
  }
  return {
    status: run.status || 'UNKNOWN',
    conclusion: run.conclusion || 'UNKNOWN',
    url: run.html_url || null,
    created_at: run.created_at || null,
    head_sha: run.head_sha || null
  };
}

async function repoHead(repo) {
  const repoData = await gh(`https://api.github.com/repos/${repo}`);
  const branch = repoData.default_branch || 'main';
  const branchData = await gh(`https://api.github.com/repos/${repo}/branches/${encodeURIComponent(branch)}`);
  return { default_branch: branch, head_sha: branchData.commit?.sha || null };
}

function latestMergedPublication(pulls, titlePrefix) {
  const pr = (Array.isArray(pulls) ? pulls : []).find((item) => (
    item?.merged_at
    && typeof item?.title === 'string'
    && item.title.startsWith(titlePrefix)
  ));
  if (!pr) return null;
  return {
    number: pr.number ?? null,
    title: pr.title,
    url: pr.html_url || null,
    merged_at: pr.merged_at,
    merge_commit_sha: pr.merge_commit_sha || null,
  };
}

const websiteRepo = 'usdimpact/usd-impact-site';
const pipelineRepo = 'usdimpact/usd-impact-pipeline';
const commentaryRepo = 'usdimpact/usd-impact';

const [websiteHead, pipelineHead, commentaryHead, issuesRaw, closedPulls] = await Promise.all([
  repoHead(websiteRepo),
  repoHead(pipelineRepo),
  repoHead(commentaryRepo),
  gh(`https://api.github.com/repos/${websiteRepo}/issues?state=open&per_page=100&sort=updated&direction=desc`),
  gh(`https://api.github.com/repos/${websiteRepo}/pulls?state=closed&base=main&sort=updated&direction=desc&per_page=50`),
]);

const [
  quality,
  daily,
  dailyHealth,
  catalyst,
  pipelineQuality,
  pipelineWeekly,
  pipelineWeeklyHealth
] = await Promise.all([
  latestWorkflow(websiteRepo, 'quality.yml', {
    branch: websiteHead.default_branch,
    headSha: websiteHead.head_sha,
  }),
  latestWorkflow(websiteRepo, 'daily-news.yml', {
    branch: websiteHead.default_branch,
  }),
  latestWorkflow(websiteRepo, 'daily-news-health.yml', {
    branch: websiteHead.default_branch,
  }),
  latestWorkflow(websiteRepo, 'catalyst-brief.yml', {
    branch: websiteHead.default_branch,
  }),
  latestWorkflow(pipelineRepo, 'quality.yml', {
    branch: pipelineHead.default_branch,
  }),
  latestWorkflow(pipelineRepo, 'weekly.yml', {
    branch: pipelineHead.default_branch,
  }),
  latestWorkflow(pipelineRepo, 'weekly-health.yml', {
    branch: pipelineHead.default_branch,
  }),
]);

const dailyRecovery = latestMergedPublication(closedPulls, 'Publish Daily USD Impact — ');
const catalystRecovery = latestMergedPublication(closedPulls, 'Publish Catalyst Brief — ');
const dailyOperational = classifyWorkflowRecovery(daily, dailyRecovery);
const catalystOperational = classifyWorkflowRecovery(catalyst, catalystRecovery);

const openIssues = issuesRaw
  .filter((issue) => !issue.pull_request)
  .map((issue) => {
    const scored = scoreIssue(issue);
    return {
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      updated_at: issue.updated_at,
      priority: scored.priority,
      score: scored.score,
      blocked: scored.explicitlyBlocked,
      daily_gate: dailyGateFromIssue(issue),
    };
  })
  .sort((a, b) => b.score - a.score || b.number - a.number);

const dailyIssueBlocker = openIssues.find((issue) => {
  if (issue.blocked || !['P0', 'P1'].includes(issue.priority)) return false;
  const text = issue.title.toLowerCase();
  return /daily|news|publish|publishing|workflow|automation/.test(text);
});
const dailyDecision = evaluateDailyDispatch({
  command,
  websiteHeadSha: websiteHead.head_sha,
  quality,
  daily,
  dailyHealth,
  dailyIssueBlocker: dailyIssueBlocker
    ? { ...dailyIssueBlocker, gate: dailyIssueBlocker.daily_gate }
    : null,
});
const dailyAllowed = dailyDecision.allowed;
const staleDailyRecoveryPending = dailyDecision.dailyFailureStale
  && dailyDecision.dailyHealthFailureStale
  && dailyOperational.operational_conclusion !== 'recovered_after_review';
const dailyHealthOperational = {
  ...dailyHealth,
  operational_conclusion: dailyDecision.dailyHealthFailureStale && isCompletedFailure(dailyHealth)
    ? 'stale_failure'
    : (dailyHealth.conclusion || dailyHealth.status || 'UNKNOWN'),
};
const dailyFailureGate = dailyIssueBlocker?.daily_gate
  ?? (dailyIssueBlocker && dailyOperational.operational_conclusion === 'recovered_after_review'
    ? 'scheduled-proof'
    : (isCompletedFailure(daily) || staleDailyRecoveryPending ? 'unclassified' : 'none'));
const dailyDegradation = dailyIssueBlocker
  ? `gate ${dailyFailureGate} — #${dailyIssueBlocker.number} ${dailyIssueBlocker.title}`
  : staleDailyRecoveryPending
    ? `gate ${dailyFailureGate} — stale Daily and health failures await explicit recovery`
    : isCompletedFailure(daily) && dailyOperational.operational_conclusion !== 'recovered_after_review'
      ? `gate ${dailyFailureGate} — latest Daily workflow failed`
      : 'none';

const qualityFailureUnscoped = isCompletedFailure(quality) && !quality.head_sha;
const dailyHealthFailureUnscoped = isCompletedFailure(dailyHealth) && !dailyHealth.head_sha;
const websiteCriticalFailure = qualityFailureUnscoped
  || dailyHealthFailureUnscoped
  || isFailureOnCurrentHead(quality, websiteHead.head_sha)
  || isFailureOnCurrentHead(dailyHealth, websiteHead.head_sha);
const pipelineCriticalFailure = [pipelineQuality, pipelineWeeklyHealth].some((run) => run.conclusion === 'failure');
const hasP0 = openIssues.some((issue) => issue.priority === 'P0' && !issue.blocked);
const hasP1 = openIssues.some((issue) => issue.priority === 'P1' && !issue.blocked);
const workflowUnknown = [quality, daily, dailyHealth, pipelineQuality, pipelineWeeklyHealth].some(isRunUnknown);
let health = 'GREEN';
if (websiteCriticalFailure || pipelineCriticalFailure || hasP0) health = 'RED';
else if (hasP1 || staleDailyRecoveryPending || workflowUnknown) health = 'AMBER';

const next = openIssues.find((issue) => !issue.blocked) || openIssues[0] || null;
const mainBlocker = health === 'RED'
  ? (next ? `#${next.number} ${next.title}` : (websiteCriticalFailure ? 'Website critical workflow failure detected' : 'Pipeline critical workflow failure detected'))
  : (next && next.priority === 'P1' ? `#${next.number} ${next.title}` : 'NONE');

const state = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  generated_by: `github-actions:${command}`,
  freshness: 'VERIFIED',
  health,
  production: {
    provider: 'vercel',
    domain: 'https://www.usd-impact.com/',
    branch: 'main',
    deployment: 'EXTERNAL_VERIFY',
    verification: 'REQUIRED_AFTER_RELEASE'
  },
  repositories: {
    website: { name: websiteRepo, ...websiteHead },
    pipeline: { name: pipelineRepo, ...pipelineHead },
    weekly_commentary: { name: commentaryRepo, ...commentaryHead }
  },
  workflows: {
    website: {
      quality,
      daily_news: dailyOperational,
      daily_news_health: dailyHealthOperational,
      catalyst_brief: catalystOperational
    },
    pipeline: {
      quality: pipelineQuality,
      weekly: pipelineWeekly,
      weekly_health: pipelineWeeklyHealth
    }
  },
  publishing: {
    daily_allowed: dailyAllowed,
    daily_mode: dailyDecision.mode,
    daily_recovery_eligible: dailyDecision.recoveryEligible,
    daily_blocker: dailyAllowed ? 'NONE' : dailyDecision.reason,
    daily_reason: dailyDecision.reason,
    daily_failure_gate: dailyFailureGate,
    daily_degradation: dailyDegradation,
    daily_workflow_operational_conclusion: dailyOperational.operational_conclusion,
    exact_current_head_quality_green: dailyDecision.currentQualityGreen,
    stale_daily_failure: dailyDecision.dailyFailureStale,
    stale_daily_health_failure: dailyDecision.dailyHealthFailureStale
  },
  open_work: openIssues,
  priority_queue: openIssues.slice(0, 10),
  main_blocker: mainBlocker,
  next_action: next ? `#${next.number} ${next.title}` : 'No open issue selected; inspect roadmap and publication health.',
  notes: [
    'Generated state is a snapshot and never overrides canonical production or governance configuration.',
    'Vercel production readiness must be verified outside this GitHub-only state snapshot after release.',
    'Cloudflare Pages remains separate to the pipeline dashboard and is not a usd-impact-site deployment target.',
    'A project-wide P0 or pipeline failure does not automatically block public Daily News unless it affects website publishing or a critical website quality/health workflow.',
    'Raw workflow conclusions are preserved; operational_conclusion may mark a failed automation run as recovered_after_review only when a later matching publication PR was actually merged.',
    'An explicit /daily may perform one recovery dispatch only when both failed Daily signals belong to older commits and exact-current-head Web Quality is green.',
    'Daily failure gates are read only from bounded issue markers and never from untrusted provider payloads.'
  ]
};

const statePath = path.join(process.cwd(), 'docs/operations/ai-control-center/PROJECT_STATE.json');
fs.mkdirSync(path.dirname(statePath), { recursive: true });
fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

const workflowLine = (name, run) => `- ${name}: ${run.operational_conclusion || run.conclusion || run.status || 'UNKNOWN'}`;
const nextLine = next ? `#${next.number} ${next.title} (${next.priority}, score ${next.score})` : 'No open issue selected';
const dailyLine = dailyAllowed
  ? `${dailyDecision.mode} — ${dailyDecision.reason}`
  : `blocked — ${dailyDecision.reason}`;
const statusMd = [
  '## USD IMPACT CONTROL',
  '',
  `**Status:** ${health}`,
  `**Production:** Vercel / main / https://www.usd-impact.com/ — post-deploy verification remains external to this GitHub snapshot`,
  `**Main blocker:** ${mainBlocker}`,
  `**Next priority:** ${nextLine}`,
  `**Daily dispatch:** ${dailyLine}`,
  `**Daily degradation:** ${dailyDegradation}`,
  '',
  '**Website workflow health:**',
  workflowLine('quality', quality),
  workflowLine('daily-news', dailyOperational),
  workflowLine('daily-news-health', dailyHealthOperational),
  workflowLine('catalyst-brief', catalystOperational),
  '',
  '**Pipeline workflow health:**',
  workflowLine('quality', pipelineQuality),
  workflowLine('weekly', pipelineWeekly),
  workflowLine('weekly-health', pipelineWeeklyHealth)
].join('\n');

let responseMd = statusMd;
if (command === 'next') {
  responseMd += `\n\n### NEXT BEST ACTION\n\n${next ? `**Task:** #${next.number} ${next.title}\n\n**Priority:** ${next.priority} — score ${next.score}\n\n**Link:** ${next.url}` : 'No actionable open issue was found.'}`;
}
if (command === 'daily') {
  if (!dailyAllowed) {
    responseMd += `\n\n### DAILY PREFLIGHT\n\n**RELEASE BLOCKED:** ${dailyDecision.reason} The daily publication workflow was not dispatched.`;
  } else if (dailyDecision.mode === 'stale-failure-recovery') {
    responseMd += `\n\n### DAILY PREFLIGHT\n\n**PREFLIGHT RECOVERY PASS:** ${dailyDecision.reason} The existing daily publication workflow remains authoritative.`;
  } else {
    responseMd += `\n\n### DAILY PREFLIGHT\n\n**PREFLIGHT PASS:** ${dailyDecision.reason} The existing daily publication workflow remains authoritative.`;
  }
}
if (command === 'sync') {
  responseMd += '\n\n**State:** refreshed from live GitHub repository, issue, and workflow data.';
}

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${responseMd}\n`);
}
if (process.env.GITHUB_OUTPUT) {
  const delimiter = `EOF_${Date.now()}`;
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `health=${health}\ndaily_allowed=${dailyAllowed}\ndaily_mode=${dailyDecision.mode}\ndaily_failure_gate=${dailyFailureGate}\ncommand=${command}\nresponse<<${delimiter}\n${responseMd}\n${delimiter}\n`,
  );
}

console.log(responseMd);
