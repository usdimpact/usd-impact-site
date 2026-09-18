import {
  classifyPublicationCalendarChanges,
  shouldAutoClosePublicationPr,
} from '../src/lib/publication-calendar-pr-guard.js';

const token = String(process.env.GITHUB_TOKEN ?? '').trim();
const repository = String(process.env.GITHUB_REPOSITORY ?? '').trim();
const targetPr = String(process.env.TARGET_PR ?? '').trim();
const context = String(process.env.GUARD_STATUS_CONTEXT ?? 'publication-calendar-freshness').trim();
const branchPrefix = String(process.env.AUTOMATION_BRANCH_PREFIX ?? 'automation/catalyst-brief-').trim();
const guardMinutes = Number(process.env.GUARD_WINDOW_MINUTES ?? 60);
if (!token || repository !== 'usdimpact/usd-impact-site' || !context
  || !Number.isInteger(guardMinutes) || guardMinutes < 15 || guardMinutes > 360
  || (targetPr && !/^\d+$/.test(targetPr))) {
  throw new Error('HOLD_GUARD_CONFIGURATION');
}

const apiRoot = 'https://api.github.com';
const headers = Object.freeze({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'User-Agent': 'usd-impact-publication-calendar-guard/1.0',
  'X-GitHub-Api-Version': '2022-11-28',
});

async function github(path, { method = 'GET', body } = {}) {
  const response = await fetch(apiRoot + path, {
    method,
    headers: body ? { ...headers, 'Content-Type': 'application/json' } : headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`HOLD_GITHUB_API_${method}_${response.status}`);
  if (response.status === 204) return null;
  return response.json();
}

async function listOpenPrs() {
  if (targetPr) return [await github(`/repos/${repository}/pulls/${targetPr}`)];
  const all = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await github(`/repos/${repository}/pulls?state=open&per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

async function listFiles(number) {
  const all = [];
  for (let page = 1; page <= 4; page++) {
    const batch = await github(`/repos/${repository}/pulls/${number}/files?per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

async function readAtHead(path, headSha) {
  const data = await github(`/repos/${repository}/contents/${encodePath(path)}?ref=${encodeURIComponent(headSha)}`);
  if (!data || data.type !== 'file' || data.encoding !== 'base64' || typeof data.content !== 'string') {
    throw new Error('HOLD_GITHUB_CONTENT_SHAPE');
  }
  const bytes = Buffer.from(data.content.replace(/\s+/g, ''), 'base64');
  if (bytes.length === 0 || bytes.length > 262144) throw new Error('HOLD_SOURCE_BOUNDS');
  return bytes.toString('utf8');
}

function statusDescription(result, guardMinutes) {
  if (result.decision === 'BLOCK') {
    if (result.reason === 'HOLD_PREVIEW_EXPIRED') return 'Blocked: verified BLS preview release instant has passed.';
    if (result.reason === 'HOLD_FRESHNESS_SAFETY_WINDOW') return `Blocked: within ${guardMinutes}m pre-release freshness safety window.`;
    return `Blocked: ${result.reason}`.slice(0, 140);
  }
  if (result.blockAt) return `Freshness lease valid until ${result.blockAt}`.slice(0, 140);
  return 'No guarded BLS preview change in this PR.';
}

async function setStatus(pr, result) {
  await github(`/repos/${repository}/statuses/${pr.head.sha}`, {
    method: 'POST',
    body: {
      state: result.decision === 'BLOCK' ? 'failure' : 'success',
      context,
      description: statusDescription(result, guardMinutes),
      target_url: pr.html_url,
    },
  });
}

async function closePr(pr) {
  await github(`/repos/${repository}/pulls/${pr.number}`, {
    method: 'PATCH',
    body: { state: 'closed' },
  });
}

const summaries = [];
for (const pr of await listOpenPrs()) {
  const descriptor = {
    number: pr.number,
    headRef: pr.head?.ref,
    headSha: pr.head?.sha,
    headRepo: pr.head?.repo?.full_name,
  };
  if (!Number.isInteger(descriptor.number) || !/^[a-f0-9]{40}$/.test(String(descriptor.headSha ?? ''))) {
    throw new Error('HOLD_PR_IDENTITY');
  }
  const files = await listFiles(descriptor.number);
  const relevant = files.filter((file) => (
    file.status !== 'removed'
    && typeof file.filename === 'string'
    && file.filename.startsWith('apps/web/src/content/catalyst-briefs/')
    && file.filename.endsWith('.md')
  ));
  const changes = [];
  for (const file of relevant) {
    changes.push({
      path: file.filename,
      status: file.status,
      content: await readAtHead(file.filename, descriptor.headSha),
    });
  }
  const result = classifyPublicationCalendarChanges(changes, {
    nowMs: Date.now(),
    guardWindowMs: guardMinutes * 60 * 1000,
  });
  await setStatus(pr, result);
  let closed = false;
  if (shouldAutoClosePublicationPr(descriptor, result, { automationBranchPrefix: branchPrefix })) {
    await closePr(pr);
    closed = true;
  }
  summaries.push({
    number: descriptor.number,
    headSha: descriptor.headSha,
    decision: result.decision,
    reason: result.reason,
    relevantCount: result.relevantCount,
    blockAt: result.blockAt,
    closed,
  });
}
console.log(JSON.stringify({ schema: 'publication-calendar-pr-guard/v1', guardMinutes, prs: summaries }));
