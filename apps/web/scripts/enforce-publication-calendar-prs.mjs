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
// Owner-preserved historical candidates: exact PR number AND exact reviewed head.
// This is not a blanket number-only exemption. A changed head is a HOLD.
// Statuses are SHA-scoped, so protect pinned SHAs even if a PR is missing from a
// partial open-PR inventory or another PR shares the same commit.
const PRESERVED_PR_HEADS = new Map([
  [916, '763bc389f0915107b03b913942a6c4021e49b48f'],
  [939, '83b206217f813b6d542ba41efd310729b621938c'],
  [1010, '908bc4099be2a4196f68a468f9a4dec4b6605982'],
  [1203, '866df34078f839aed2af164fd371e2fdbbcd033f'],
  [1206, '3d2d56fc7f16f11ab377cee33ba76bca0d4152e5'],
  [1211, '1e6bc1176ae25a59fad9995c3851ddb3e5941d9c'],
  [1225, '0242b360c49f82ad44cd6db3a5cd089a230d440b'],
]);
const PRESERVED_COMMIT_SHAS = new Set(PRESERVED_PR_HEADS.values());
if (!token || repository !== 'usdimpact/usd-impact-site' || !context
  || !Number.isInteger(guardMinutes) || guardMinutes < 15 || guardMinutes > 360
  || (targetPr && !/^\d+$/.test(targetPr))) {
  throw new Error('HOLD_GUARD_CONFIGURATION');
}

const apiRoot = 'https://api.github.com';
const REQUEST_TIMEOUT_MS = 30 * 1000;
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
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
    let batch;
    try {
      batch = await github(`/repos/${repository}/pulls/${number}/files?per_page=100&page=${page}`);
    } catch (error) {
      if (all.length === 0) throw error;
      // A later-page error must not erase a BLS BLOCK already visible on page 1.
      return { files: all, truncated: true,
        hold: `HOLD_PR_FILE_PAGE_${page}_${error?.message ?? 'UNKNOWN'}` };
    }
    if (!Array.isArray(batch) || batch.length > 100) {
      if (all.length === 0) throw new Error('HOLD_PR_FILE_PAGE_SHAPE');
      return { files: all, truncated: true, hold: `HOLD_PR_FILE_PAGE_${page}_HOLD_PR_FILE_PAGE_SHAPE` };
    }
    all.push(...batch);
    if (batch.length < 100) return { files: all, truncated: false, hold: null };
  }
  // Keep what was read; 400 visible paths are not proof of complete coverage.
  return { files: all, truncated: true, hold: 'HOLD_PR_FILE_SCAN_TRUNCATED' };
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

// A status is immutable and does not expire. An additional two-minute cushion
// prevents a long read-only sweep from writing a positive status at the cutoff.
// This is NOT a merge-time release gate: independent issue #1269 remains NO-GO.
const POSITIVE_WRITE_CUSHION_MS = 2 * 60 * 1000;
function decisionAtWrite(result, nowMs = Date.now(), requestBudgetMs = 0) {
  if (result.decision !== 'PASS' || result.relevantCount === 0 || !result.blockAt) return result;
  const blockAtMs = Date.parse(result.blockAt);
  if (!Number.isFinite(blockAtMs)) {
    return { ...result, decision: 'BLOCK', reason: 'HOLD_GUARD_LEASE_INSTANT' };
  }
  if (nowMs + POSITIVE_WRITE_CUSHION_MS + requestBudgetMs >= blockAtMs) {
    return { ...result, decision: 'BLOCK', reason: 'HOLD_FRESHNESS_SAFETY_WINDOW',
      releaseAt: new Date(blockAtMs + guardMinutes * 60 * 1000).toISOString() };
  }
  return result;
}

async function setStatus(pr, evaluatedResult, holds) {
  let result = decisionAtWrite(evaluatedResult);
  if (result.decision === 'PASS' && result.relevantCount === 0) {
    return { written: false, result, statusHistoryComplete: true };
  }
  let statuses = null;
  let historyComplete = false;
  try {
    statuses = await github(`/repos/${repository}/commits/${pr.head.sha}/statuses?per_page=100`);
    if (!Array.isArray(statuses) || statuses.length > 100) throw new Error('HOLD_STATUS_LIST_SHAPE');
    historyComplete = true;
  } catch (error) {
    const hold = `HOLD_GUARD_STATUS_READ_PR_${pr.number}_${error?.message ?? 'UNKNOWN'}`;
    // Known BLOCKs must still get one conservative failure POST even when
    // status history is unavailable; no uncertain positive status is permitted.
    if (result.decision !== 'BLOCK') throw new Error(hold);
    holds.push(hold);
  }

  // Re-check the runner clock AFTER the history read. Reserve a full request timeout
  // in addition to the two-minute cushion so a success POST cannot span the cutoff.
  // This is not an authoritative clock or a merge-time freshness guarantee.
  result = decisionAtWrite(result, Date.now(), REQUEST_TIMEOUT_MS);
  const state = result.decision === 'BLOCK' ? 'failure' : 'success';
  const description = statusDescription(result, guardMinutes);
  if (statuses !== null) {
    const previous = statuses.find((item) => item?.context === context);
    if (!previous && statuses.length === 100) {
      historyComplete = false;
      const hold = `HOLD_STATUS_CONTEXT_UNVERIFIED_PR_${pr.number}`;
      if (state !== 'failure') throw new Error(hold);
      holds.push(hold);
    } else if (previous?.state === state && previous?.description === description
      && (previous?.target_url ?? null) === (pr.html_url ?? null)) {
      return { written: false, result, statusHistoryComplete: true };
    }
  }
  try {
    await github(`/repos/${repository}/statuses/${pr.head.sha}`, {
      method: 'POST',
      body: { state, context, description, target_url: pr.html_url },
    });
  } catch (error) {
    // An ambiguous response must not be retried; other SHAs still get evaluated.
    throw new Error(`HOLD_GUARD_STATUS_WRITE_PR_${pr.number}_${error?.message ?? 'UNKNOWN'}`);
  }
  // One conservative failure POST after a failed history GET is permitted,
  // but the automation PR must not be closed when that history is unknown.
  return { written: true, result, statusHistoryComplete: historyComplete };
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
  // Preserve the exact historical head without reading or mutating it.
  // A changed head is not exempt: it enters an explicit HOLD and remains read-only.
  const pinnedHead = PRESERVED_PR_HEADS.get(descriptor.number);
  if (pinnedHead) {
    const sameHead = descriptor.headSha === pinnedHead;
    const reason = sameHead ? 'SKIP_PRESERVED_PINNED_HEAD' : 'HOLD_PRESERVED_HEAD_DRIFT';
    if (!sameHead) holds.push(`HOLD_PRESERVED_HEAD_DRIFT_PR_${descriptor.number}`);
    if (!groups.has(descriptor.headSha)) groups.set(descriptor.headSha, []);
    groups.get(descriptor.headSha).push({
      pr, descriptor, preserved: true,
      result: { decision: sameHead ? 'SKIP' : 'BLOCK', reason,
        relevantCount: 0, blockAt: null, releaseAt: null },
      infrastructureHold: !sameHead, knownCatalyst: false,
    });
    continue;
  }
  let result;
  let infrastructureHold = false;
  let knownCatalyst = false;
  try {
    const listing = await listFiles(descriptor.number);
    const relevant = listing.files.filter((file) => ( 
      file.status !== 'removed'
      && typeof file.filename === 'string'
      && file.filename.startsWith('apps/web/src/content/catalyst-briefs/')
      && file.filename.endsWith('.md')
    ));
    knownCatalyst = relevant.length > 0;
    const changes = [];
    for (const file of relevant) {
      changes.push({ path: file.filename, status: file.status,
        content: await readAtHead(file.filename, descriptor.headSha) });
    }
    result = classifyPublicationCalendarChanges(changes, {
      nowMs: Date.now(), guardWindowMs: guardMinutes * 60 * 1000,
    });
    if (listing.truncated) {
      infrastructureHold = true;
      holds.push(`HOLD_PR_${descriptor.number}_${listing.hold ?? 'HOLD_PR_FILE_SCAN_TRUNCATED'}`);
      // If an observed file is already BLOCK, preserve that verdict. Otherwise,
      // never post a PASS based on only the first 400 files of this PR.
      if (result.decision !== 'BLOCK') {
        result = infrastructureBlock(new Error('HOLD_PR_FILE_SCAN_TRUNCATED'));
      }
    }
  } catch (error) {
    infrastructureHold = true;
    result = infrastructureBlock(error);
    holds.push(`HOLD_PR_${descriptor.number}_${result.reason}`);
  }
  if (!groups.has(descriptor.headSha)) groups.set(descriptor.headSha, []);
  groups.get(descriptor.headSha).push({ pr, descriptor, result, infrastructureHold, knownCatalyst });
}

// A commit status is keyed by SHA + context, not by PR number. Aggregate first
// so a different-base PR with the same head SHA cannot overwrite a BLOCK.
for (const records of groups.values()) {
  const groupSha = records[0].descriptor.headSha;
  if (PRESERVED_COMMIT_SHAS.has(groupSha) || records.some((item) => item.preserved)) {
    // GitHub commit statuses are shared across PRs with the same SHA. Protect
    // the pinned commit even when the pinned PR is absent from this scan.
    const nonPreserved = records.filter((item) => !item.preserved);
    if (nonPreserved.length) {
      holds.push(`HOLD_PRESERVED_SHARED_SHA_${groupSha}`);
    }
    for (const item of records) {
      if (!item.preserved) {
        item.result = { decision: 'BLOCK', reason: 'HOLD_PRESERVED_SHARED_SHA',
          relevantCount: 0, blockAt: null, releaseAt: null };
      }
      summaries.push({
        number: item.descriptor.number, headSha: item.descriptor.headSha,
        decision: item.result.decision, reason: item.result.reason,
        relevantCount: item.result.relevantCount, blockAt: item.result.blockAt,
        statusWritten: false, statusConfirmed: false, closed: false,
      });
    }
    continue;
  }
  // The scan can take minutes. Never reuse a positive decision without
  // re-evaluating its cutoff immediately before the status is written.
  for (const item of records) item.result = decisionAtWrite(item.result);
  const incomplete = records.some((item) => item.infrastructureHold);
  const earliestPass = records.filter((item) => !item.infrastructureHold
    && item.result.decision === 'PASS' && item.result.relevantCount > 0)
    .sort((a, b) => Date.parse(a.result.blockAt) - Date.parse(b.result.blockAt)
      || a.descriptor.number - b.descriptor.number)[0];
  const chosen = records.find((item) => !item.infrastructureHold && item.result.decision === 'BLOCK')
    ?? records.find((item) => item.infrastructureHold)
    ?? earliestPass;
  const knownCatalyst = records.some((item) => item.knownCatalyst);
  // Unknown file listings cannot prove that a PR contains a guarded brief.
  // Their sweep must HOLD, but a speculative red status on an unrelated SHA
  // would persist forever when later sweeps skip unrelated success writes.
  const speculativeInfrastructureBlock = chosen?.infrastructureHold && !knownCatalyst
    && !records.some((item) => !item.infrastructureHold && item.result.decision === 'BLOCK');
  let headConfirmed = true;
  // Infrastructure failures may follow a moved head. Never write a conservative
  // status to a SHA after the affected PR has moved or ceased to be open.
  if (chosen?.infrastructureHold && !speculativeInfrastructureBlock) {
    try {
      const current = await github(`/repos/${repository}/pulls/${chosen.descriptor.number}`);
      if (current?.state !== 'open' || current?.head?.sha !== chosen.descriptor.headSha) {
        headConfirmed = false;
        holds.push(`HOLD_PR_${chosen.descriptor.number}_HOLD_PR_HEAD_MOVED`);
      }
    } catch (error) {
      headConfirmed = false;
      holds.push(`HOLD_PR_${chosen.descriptor.number}_HOLD_PR_HEAD_RECHECK_${error?.message ?? 'UNKNOWN'}`);
    }
  }
  let statusConfirmed = false;
  let statusWritten = false;
  let statusHistoryComplete = false;
  if (chosen && headConfirmed && !speculativeInfrastructureBlock
    && (chosen.result.decision === 'BLOCK' || !scan.hold)) {
    try {
      const posted = await setStatus(chosen.pr, chosen.result, holds);
      chosen.result = posted.result;
      statusWritten = posted.written;
      statusConfirmed = true;
      statusHistoryComplete = posted.statusHistoryComplete;
    } catch (error) {
      holds.push(error?.message ?? 'HOLD_STATUS_WRITE_UNKNOWN');
    }
  }
  for (const item of records) {
    let closed = false;
    // Never auto-close on an incomplete scan or before the failure status is
    // confirmed, and never close because of an infrastructure error.
    if (statusConfirmed && statusHistoryComplete && !scan.hold && !incomplete
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
  schema: 'publication-calendar-pr-guard/v2', guardMinutes,
  complete: holds.length === 0, listing: { complete: !scan.hold, hold: scan.hold },
  prs: summaries, holdCount: holds.length, holds,
}));
if (holds.length) throw new Error(`HOLD_SWEEP_INCOMPLETE_${holds.length}_${holds[0]}`);
