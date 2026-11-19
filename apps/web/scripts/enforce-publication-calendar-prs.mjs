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
  if (targetPr) return { prs: [await github(`/repos/${repository}/pulls/${targetPr}`)], hold: null };
  const all = [];
  const seen = new Set();
  for (let page = 1; page <= 5; page++) {
    let batch;
    try {
      batch = await github(`/repos/${repository}/pulls?state=open&per_page=100&page=${page}`);
    } catch (error) {
      return { prs: all, hold: `HOLD_OPEN_PR_LIST_${error?.message ?? 'UNKNOWN'}` };
    }
    if (!Array.isArray(batch) || batch.length > 100) {
      return { prs: all, hold: 'HOLD_OPEN_PR_PAGE_SHAPE' };
    }
    // Duplicated pages are evidence of an unstable snapshot, not complete coverage.
    for (const pr of batch) {
      if (!Number.isInteger(pr?.number) || seen.has(pr.number)) {
        return { prs: all, hold: 'HOLD_OPEN_PR_SCAN_DRIFT' };
      }
      seen.add(pr.number);
      all.push(pr);
    }
    if (batch.length < 100) return { prs: all, hold: null };
  }
  // Evaluate the visible PRs conservatively, but never claim a full sweep.
  return { prs: all, hold: 'HOLD_OPEN_PR_SCAN_TRUNCATED' };
}

async function listFiles(number) {
  const all = [];
  for (let page = 1; page <= 4; page++) {
    const batch = await github(`/repos/${repository}/pulls/${number}/files?per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length > 100) throw new Error('HOLD_PR_FILE_PAGE_SHAPE');
    all.push(...batch);
    if (batch.length < 100) return all;
  }
  // Do not conclude that a PR is unrelated after an incomplete file scan.
  throw new Error('HOLD_PR_FILE_SCAN_TRUNCATED');
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
  if (result.decision === 'PASS' && result.relevantCount === 0) return false;
  const state = result.decision === 'BLOCK' ? 'failure' : 'success';
  const description = statusDescription(result, guardMinutes);
  let statuses;
  try {
    statuses = await github(`/repos/${repository}/commits/${pr.head.sha}/statuses?per_page=100`);
    if (!Array.isArray(statuses) || statuses.length > 100) {
      throw new Error('HOLD_STATUS_LIST_SHAPE');
    }
  } catch (error) {
    // No positive write after an unknown status read; the whole sweep must HOLD.
    throw new Error(`HOLD_GUARD_STATUS_READ_PR_${pr.number}_${error?.message ?? 'UNKNOWN'}`);
  }
  // GitHub returns commit statuses newest-first. If 100 unrelated contexts
  // obscure this one, don't risk overwriting an unknown failure.
  const previous = statuses.find((item) => item.context === context);
  if (!previous && statuses.length === 100) throw new Error('HOLD_STATUS_CONTEXT_UNVERIFIED');
  if (previous?.state === state && previous?.description === description
    && previous?.target_url === pr.html_url) return false;
  try {
    await github(`/repos/${repository}/statuses/${pr.head.sha}`, {
      method: 'POST',
      body: { state, context, description, target_url: pr.html_url },
    });
  } catch (error) {
    // An ambiguous response must not be retried; other SHAs still get evaluated.
    throw new Error(`HOLD_GUARD_STATUS_WRITE_PR_${pr.number}_${error?.message ?? 'UNKNOWN'}`);
  }
  return true;
}

async function closePr(pr, evaluatedHeadSha) {
  const latest = await github(`/repos/${repository}/pulls/${pr.number}`);
  if (latest?.state !== 'open' || latest?.head?.sha !== evaluatedHeadSha) return false;
  await github(`/repos/${repository}/pulls/${pr.number}`, {
    method: 'PATCH',
    body: { state: 'closed' },
  });
  return true;
}

const summaries = [];
const holds = [];
const scan = await listOpenPrs();
if (scan.hold) holds.push(scan.hold);
const groups = new Map();
function infrastructureBlock(error) {
  return { decision: 'BLOCK', reason: error?.message ?? 'HOLD_GUARD_EVALUATION',
    relevantCount: 0, blockAt: null, releaseAt: null };
}

// Evaluate every available PR independently. One malformed or oversized PR
// must not prevent a later expired BLS preview from receiving a failure status.
for (const pr of scan.prs) {
  const descriptor = {
    number: pr?.number, headRef: pr?.head?.ref,
    headSha: pr?.head?.sha, headRepo: pr?.head?.repo?.full_name,
  };
  if (!Number.isInteger(descriptor.number) || !/^[a-f0-9]{40}$/.test(String(descriptor.headSha ?? ''))) {
    holds.push('HOLD_PR_IDENTITY');
    continue;
  }
  let result;
  let infrastructureHold = false;
  try {
    const files = await listFiles(descriptor.number);
    const relevant = files.filter((file) => (
      file.status !== 'removed'
      && typeof file.filename === 'string'
      && file.filename.startsWith('apps/web/src/content/catalyst-briefs/')
      && file.filename.endsWith('.md')
    ));
    const changes = [];
    for (const file of relevant) {
      changes.push({ path: file.filename, status: file.status,
        content: await readAtHead(file.filename, descriptor.headSha) });
    }
    result = classifyPublicationCalendarChanges(changes, {
      nowMs: Date.now(), guardWindowMs: guardMinutes * 60 * 1000,
    });
  } catch (error) {
    infrastructureHold = true;
    result = infrastructureBlock(error);
    holds.push(`HOLD_PR_${descriptor.number}_${result.reason}`);
  }
  if (!groups.has(descriptor.headSha)) groups.set(descriptor.headSha, []);
  groups.get(descriptor.headSha).push({ pr, descriptor, result, infrastructureHold });
}

// A commit status is keyed by SHA + context, not by PR number. Aggregate first
// so a different-base PR with the same head SHA cannot overwrite a BLOCK.
for (const records of groups.values()) {
  const incomplete = records.some((item) => item.infrastructureHold);
  const chosen = records.find((item) => item.infrastructureHold)
    ?? records.find((item) => item.result.decision === 'BLOCK')
    ?? records.find((item) => item.result.relevantCount > 0);
  let statusConfirmed = false;
  let statusWritten = false;
  if (chosen && (chosen.result.decision === 'BLOCK' || !scan.hold)) {
    try {
      statusWritten = await setStatus(chosen.pr, chosen.result);
      statusConfirmed = true;
    } catch (error) {
      holds.push(error?.message ?? 'HOLD_STATUS_WRITE_UNKNOWN');
    }
  }
  for (const item of records) {
    let closed = false;
    // Never auto-close on an incomplete scan or before the failure status is
    // confirmed, and never close because of an infrastructure error.
    if (statusConfirmed && !scan.hold && !incomplete
      && item.result.decision === 'BLOCK'
      && shouldAutoClosePublicationPr(item.descriptor, item.result, {
        automationBranchPrefix: branchPrefix,
      })) {
      try {
        closed = await closePr(item.pr, item.descriptor.headSha);
      } catch (error) {
        holds.push(`HOLD_PR_${item.descriptor.number}_CLOSE_${error?.message ?? 'UNKNOWN'}`);
      }
    }
    summaries.push({
      number: item.descriptor.number,
      headSha: item.descriptor.headSha,
      decision: item.result.decision,
      reason: item.result.reason,
      relevantCount: item.result.relevantCount,
      blockAt: item.result.blockAt,
      statusWritten,
      statusConfirmed,
      closed,
    });
  }
}
console.log(JSON.stringify({
  schema: 'publication-calendar-pr-guard/v1', guardMinutes, prs: summaries,
  holdCount: holds.length, holds: holds.slice(0, 12),
}));
if (holds.length) throw new Error(`HOLD_GUARD_SWEEP_${holds.length}_${holds[0]}`);
