import fs from 'node:fs';
import path from 'node:path';

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

async function latestWorkflow(repo, workflow) {
  const data = await gh(`https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?per_page=1`);
  const run = data.workflow_runs?.[0];
  if (!run) return { status: 'UNKNOWN', conclusion: 'UNKNOWN', url: null, created_at: null, head_sha: null };
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

const websiteRepo = 'usdimpact/usd-impact-site';
const pipelineRepo = 'usdimpact/usd-impact-pipeline';
const commentaryRepo = 'usdimpact/usd-impact';

const [websiteHead, pipelineHead, commentaryHead, issuesRaw, quality, daily, dailyHealth, catalyst] = await Promise.all([
  repoHead(websiteRepo),
  repoHead(pipelineRepo),
  repoHead(commentaryRepo),
  gh(`https://api.github.com/repos/${websiteRepo}/issues?state=open&per_page=100&sort=updated&direction=desc`),
  latestWorkflow(websiteRepo, 'quality.yml'),
  latestWorkflow(websiteRepo, 'daily-news.yml'),
  latestWorkflow(websiteRepo, 'daily-news-health.yml'),
  latestWorkflow(websiteRepo, 'catalyst-brief.yml')
]);

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
      blocked: scored.explicitlyBlocked
    };
  })
  .sort((a, b) => b.score - a.score || b.number - a.number);

const criticalWorkflowFailure = [quality, dailyHealth].some((run) => run.conclusion === 'failure');
const hasP0 = openIssues.some((issue) => issue.priority === 'P0' && !issue.blocked);
const hasP1 = openIssues.some((issue) => issue.priority === 'P1' && !issue.blocked);
let health = 'GREEN';
if (criticalWorkflowFailure || hasP0) health = 'RED';
else if (hasP1 || [quality, daily, dailyHealth].some((run) => run.status === 'UNKNOWN' || run.conclusion === 'UNKNOWN')) health = 'AMBER';

const dailyIssueBlocker = openIssues.find((issue) => {
  if (issue.blocked || !['P0', 'P1'].includes(issue.priority)) return false;
  const text = issue.title.toLowerCase();
  return /daily|news|publish|publishing|workflow|automation/.test(text);
});
const dailyWorkflowUnknown = [quality, dailyHealth].some((run) => run.status === 'UNKNOWN' || run.conclusion === 'UNKNOWN');
const dailyAllowed = !criticalWorkflowFailure && !dailyIssueBlocker && !dailyWorkflowUnknown;

const next = openIssues.find((issue) => !issue.blocked) || openIssues[0] || null;
const mainBlocker = health === 'RED'
  ? (next ? `#${next.number} ${next.title}` : 'Critical workflow failure detected')
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
    quality,
    daily_news: daily,
    daily_news_health: dailyHealth,
    catalyst_brief: catalyst
  },
  publishing: {
    daily_allowed: dailyAllowed,
    daily_blocker: dailyIssueBlocker ? `#${dailyIssueBlocker.number} ${dailyIssueBlocker.title}` : (criticalWorkflowFailure ? 'Critical quality or daily-health workflow failure' : (dailyWorkflowUnknown ? 'Quality or daily-health workflow state is unknown' : 'NONE'))
  },
  open_work: openIssues,
  priority_queue: openIssues.slice(0, 10),
  main_blocker: mainBlocker,
  next_action: next ? `#${next.number} ${next.title}` : 'No open issue selected; inspect roadmap and publication health.',
  notes: [
    'Generated state is a snapshot and never overrides canonical production or governance configuration.',
    'Vercel production readiness must be verified outside this GitHub-only state snapshot after release.',
    'Cloudflare Pages remains separate to the pipeline dashboard and is not a usd-impact-site deployment target.',
    'A project-wide P0 does not automatically block public Daily News unless it affects publishing or a critical quality/health workflow.'
  ]
};

const statePath = path.join(process.cwd(), 'docs/operations/ai-control-center/PROJECT_STATE.json');
fs.mkdirSync(path.dirname(statePath), { recursive: true });
fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

const workflowLine = (name, run) => `- ${name}: ${run.conclusion || run.status || 'UNKNOWN'}`;
const nextLine = next ? `#${next.number} ${next.title} (${next.priority}, score ${next.score})` : 'No open issue selected';
const statusMd = [
  '## USD IMPACT CONTROL',
  '',
  `**Status:** ${health}`,
  `**Production:** Vercel / main / https://www.usd-impact.com/ — post-deploy verification remains external to this GitHub snapshot`,
  `**Main blocker:** ${mainBlocker}`,
  `**Next priority:** ${nextLine}`,
  '',
  '**Workflow health:**',
  workflowLine('quality', quality),
  workflowLine('daily-news', daily),
  workflowLine('daily-news-health', dailyHealth),
  workflowLine('catalyst-brief', catalyst)
].join('\n');

let responseMd = statusMd;
if (command === 'next') {
  responseMd += `\n\n### NEXT BEST ACTION\n\n${next ? `**Task:** #${next.number} ${next.title}\n\n**Priority:** ${next.priority} — score ${next.score}\n\n**Link:** ${next.url}` : 'No actionable open issue was found.'}`;
}
if (command === 'daily') {
  const blocker = state.publishing.daily_blocker;
  responseMd += `\n\n### DAILY PREFLIGHT\n\n${dailyAllowed ? '**PREFLIGHT PASS:** daily-specific quality and health gates permit dispatch. The existing daily publication workflow remains authoritative.' : `**RELEASE BLOCKED:** ${blocker}. The daily publication workflow was not dispatched.`}`;
}
if (command === 'sync') {
  responseMd += '\n\n**State:** refreshed from live GitHub repository, issue, and workflow data.';
}

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${responseMd}\n`);
}
if (process.env.GITHUB_OUTPUT) {
  const delimiter = `EOF_${Date.now()}`;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `health=${health}\ndaily_allowed=${dailyAllowed}\ncommand=${command}\nresponse<<${delimiter}\n${responseMd}\n${delimiter}\n`);
}

console.log(responseMd);
