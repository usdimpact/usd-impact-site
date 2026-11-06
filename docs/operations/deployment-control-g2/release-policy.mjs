/**
 * G2 - Option 2 offline, synthetic-only decision model. No network or writes.
 * NEVER use its verdict as permission to merge, dispatch, deploy, or promote.
 * This is a proposed safety contract, NOT a configured GitHub/Vercel gate.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const POLICY = Object.freeze({
  repository: 'usdimpact/usd-impact-site',
  projectId: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7',
  releaseBranch: 'refs/heads/release/production',
  publisherWorkflow: '.github/workflows/daily-news-auto-publish.yml',
  requiredChecks: Object.freeze([
    'validate-and-build',
    'Dependency review',
    'Reject Development-only Production migration files',
  ]),
  // TEST FIXTURE ONLY: not a G-R5 owner-approved production path map.
  exampleDocsPaths: Object.freeze(['docs/operations/g2-synthetic-example.md']),
  exampleOwnerPaths: Object.freeze(['apps/web/src/pages/g2-synthetic-example.astro']),
});

const SHA = /^[0-9a-f]{40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const validSha = x => typeof x === 'string' && SHA.test(x);
const unique = xs => [...new Set(xs)];
const result = (status, reasons) => ({
  status, modelOnly: true, mergeAuthorized: false,
  deploymentAuthorized: false, workflowDispatchAuthorized: false,
  productionSettingsAuthorized: false, reasons: unique(reasons),
});
const validTime = (x, now, maxAgeMs = 15 * 60 * 1000) =>
  typeof x === 'string' && Number.isFinite(Date.parse(x))
  && Number.isFinite(now) && Date.parse(x) <= now && now - Date.parse(x) <= maxAgeMs;

export function beforeNewYorkCutoff(now) {
  if (!Number.isFinite(now)) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(now));
  const h = Number(parts.find(p => p.type === 'hour')?.value);
  const m = Number(parts.find(p => p.type === 'minute')?.value);
  return Number.isInteger(h) && Number.isInteger(m) && h * 60 + m < 510;
}

function verifyGraph(history, liveSha, mainSha, reasons) {
  if (!isObj(history) || history.complete !== true || history.netDiffComplete !== true
      || history.baseIsAncestor !== true || history.baseSha !== liveSha
      || history.tipSha !== mainSha) {
    reasons.push('INCOMPLETE_HISTORY'); return [];
  }
  const commits = history.commits;
  if (!Array.isArray(commits) || commits.length < 1 || commits.length > 50
      || !Array.isArray(history.netPaths) || history.netPaths.length > 200
      || history.netPaths.some(p => typeof p !== 'string')) {
    reasons.push('INCOMPLETE_HISTORY'); return [];
  }
  const seen = new Set();
  const bySha = new Map();
  let structuralError = false;
  for (const c of commits) {
    if (!isObj(c) || !validSha(c.sha) || seen.has(c.sha)
        || !Array.isArray(c.parents) || c.parents.length < 1 || c.parents.length > 2
        || c.parents.some(p => !validSha(p) || (p !== liveSha && !seen.has(p)))
        || !Array.isArray(c.paths) || c.paths.length < 1
        || c.paths.some(p => typeof p !== 'string' || p.length === 0)) {
      structuralError = true; break;
    }
    seen.add(c.sha); bySha.set(c.sha, c);
  }
  if (!seen.has(mainSha) || structuralError) {
    reasons.push('INVALID_GRAPH'); return [];
  }
  const visited = new Set();
  let touchesBase = false;
  function walk(sha) {
    if (sha === liveSha) { touchesBase = true; return; }
    if (visited.has(sha)) return;
    const c = bySha.get(sha);
    if (!c) { structuralError = true; return; }
    visited.add(sha);
    for (const parent of c.parents) walk(parent);
  }
  walk(mainSha);
  if (structuralError || !touchesBase || visited.size !== commits.length) {
    reasons.push('INVALID_GRAPH'); return [];
  }
  const union = new Set(commits.flatMap(c => c.paths));
  if (history.netPaths.some(p => !union.has(p)) || new Set(history.netPaths).size !== history.netPaths.length) {
    reasons.push('NET_DIFF_OUTSIDE_ENUMERATED_HISTORY');
  }
  return commits;
}

function verifyFiles(commits, history, intent, daily, approval, reasons) {
  const docSet = new Set(POLICY.exampleDocsPaths);
  const ownerSet = new Set(POLICY.exampleOwnerPaths);
  const dailyPath = isObj(daily) && DATE.test(daily.date || '')
    ? `apps/web/src/content/news/${daily.date}.md` : null;
  const expected = kind => kind === 'docs_neutral' ? docSet : kind === 'owner_approved' ? ownerSet : null;
  for (const c of commits) {
    if (c.paths.some(p => p.startsWith('supabase/') || p.includes('/score/')
        || p.startsWith('.github/workflows/') || p.endsWith('/vercel.json'))) {
      reasons.push('HELD_PATH');
    }
    if (c.kind === 'docs_neutral') {
      if (!c.paths.every(p => docSet.has(p))) reasons.push('UNKNOWN_DOCS_PATH');
    } else if (c.kind === 'daily') {
      if (!dailyPath || c.paths.length !== 1 || c.paths[0] !== dailyPath) reasons.push('DAILY_CONTENT_MISMATCH');
    } else if (c.kind === 'owner_approved') {
      if (!c.paths.every(p => ownerSet.has(p)) || !isObj(approval)
          || approval.sha !== c.sha) reasons.push('UNAPPROVED_CHANGE');
    } else if (c.kind === 'revert') {
      if (!isObj(approval) || approval.sha !== c.sha || approval.revert !== true) reasons.push('UNAPPROVED_CHANGE');
    } else reasons.push('UNCLASSIFIED_PATH');
  }
  if (history?.netPaths?.some(p => !commits.some(c => c.paths.includes(p)))) {
    reasons.push('NET_DIFF_OUTSIDE_ENUMERATED_HISTORY');
  }
  if (intent === 'docs_only' && commits.some(c => c.kind !== 'docs_neutral')) reasons.push('DOCS_INTENT_CHANGED');
  if (intent === 'daily' && (commits.at(-1)?.kind !== 'daily'
      || commits.at(-1)?.paths[0] !== dailyPath)) reasons.push('DAILY_CONTENT_MISMATCH');
}

export function evaluate(snapshot, now = Date.now()) {
  const r = [];
  if (!isObj(snapshot)) return result('HOLD', ['INVALID_SNAPSHOT']);
  if (!Number.isFinite(now) || Math.abs(now) > 8.64e15) return result('HOLD', ['INVALID_CLOCK']);
  const { mode, provenance, intent, evidence, repository: repo,
    vercel, history, checks, dispatch, daily, approval, lock, dedupe, isolation } = snapshot;
  if (mode !== 'dry_run' || provenance !== 'synthetic_fixture') r.push('NOT_DRY_RUN');
  if (!['docs_only', 'daily', 'owner_release', 'emergency'].includes(intent)) r.push('INVALID_INTENT');
  if (!isObj(evidence) || evidence.complete !== true || !validTime(evidence.observedAt, now)) r.push('STALE_EVIDENCE');
  if (!isObj(repo) || repo.fullName !== POLICY.repository || !validSha(repo.mainSha)
      || !validSha(repo.mainTreeSha)) r.push('WRONG_REPOSITORY');
  if (!isObj(repo) || repo.mainAutoDeployDisabled !== true) r.push('MAIN_DEPLOYMENT_NOT_SUPPRESSED');
  if (!isObj(repo) || repo.releaseBranch !== POLICY.releaseBranch
      || repo.releaseBranchProtected !== true || repo.configPinVerified !== true) r.push('RELEASE_CONFIG_NOT_PINNED');
  if (!isObj(vercel) || vercel.projectId !== POLICY.projectId) r.push('WRONG_PROJECT');
  if (!isObj(vercel) || vercel.productionBranch !== 'release/production') r.push('WRONG_RELEASE_BRANCH');
  if (!isObj(vercel) || !validSha(vercel.liveSha) || !validSha(vercel.releaseSha)
      || vercel.latestState !== 'READY' || vercel.rollbackKnown !== true
      || vercel.rollbackActive !== false || vercel.liveSha !== vercel.releaseSha) r.push('ROLLBACK_LOCKED');
  if (!isObj(vercel) || vercel.candidateDeploymentCount !== 0) r.push('UNEXPECTED_DEPLOYMENT');
  if (!isObj(isolation) || isolation.syntheticOnly !== true
      || isolation.productionDomainsUntouched !== true
      || isolation.noCredentialsRead !== true || isolation.noRemoteActions !== true) r.push('ISOLATION_NOT_PROVEN');

  const commits = verifyGraph(history, vercel?.liveSha, repo?.mainSha, r);
  if (commits.length) verifyFiles(commits, history, intent, daily, approval, r);
  if (!isObj(checks) || checks.complete !== true || !Array.isArray(checks.runs)
      || checks.runs.length !== POLICY.requiredChecks.length
      || !validSha(checks.prHeadSha)) r.push('CHECKS_INCOMPLETE');
  else {
    if (checks.prHeadTreeSha !== repo?.mainTreeSha) r.push('TREE_NOT_IDENTICAL');
    if (!validTime(checks.observedAt, now)) r.push('STALE_CHECKS');
    const names = new Set();
    for (const check of checks.runs) {
      if (!isObj(check) || !POLICY.requiredChecks.includes(check.name)
          || names.has(check.name) || check.sha !== checks.prHeadSha
          || check.status !== 'completed' || check.conclusion !== 'success') r.push('CHECK_NOT_EXACT_SUCCESS');
      if (isObj(check)) names.add(check.name);
    }
    if (POLICY.requiredChecks.some(n => !names.has(n))) r.push('CHECKS_INCOMPLETE');
  }
  if (!isObj(lock) || lock.state !== 'clear' || lock.atomicVerified !== true) r.push('LOCK_NOT_ATOMIC');
  if (!isObj(lock) || lock.baseSha !== vercel?.releaseSha
      || !validTime(lock.observedAt, now) || Date.parse(lock.expiresAt || '') <= now
      || !Number.isFinite(Date.parse(lock.expiresAt || ''))) r.push('LOCK_STALE');
  if (!isObj(dedupe) || dedupe.leaseAcquired !== true || dedupe.activeDuplicate !== false
      || dedupe.releasedSha === repo?.mainSha || dedupe.idempotencyKey !== repo?.mainSha) {
    r.push('DEDUPLICATION_NOT_PROVEN');
  }
  if (vercel?.releaseSha === repo?.mainSha) r.push('RELEASE_ALREADY_AT_TARGET');

  if (intent === 'docs_only') {
    if (dispatch !== null || daily !== null) r.push('DOCS_DISPATCH_PRESENT');
  } else {
    if (!isObj(dispatch) || dispatch.event !== 'workflow_dispatch'
        || dispatch.sender !== 'github-actions[bot]'
        || dispatch.issuerWorkflow !== POLICY.publisherWorkflow
        || dispatch.receiptSha !== repo?.mainSha || dispatch.attempt !== 1
        || dispatch.acknowledged !== true || !Number.isSafeInteger(dispatch.runId)
        || dispatch.runId <= 0 || !validTime(dispatch.observedAt, now)) r.push('DISPATCH_NOT_AUTHENTICATED');
    if (intent === 'daily') {
      if (!isObj(daily) || !DATE.test(daily.date || '')
          || daily.date !== new Date(now).toISOString().slice(0, 10)
          || daily.editionPath !== `apps/web/src/content/news/${daily.date}.md`) r.push('DAILY_CONTENT_MISMATCH');
      if (!isObj(daily) || daily.sourceRepo !== POLICY.repository
          || daily.sourceWorkflow !== '.github/workflows/daily-news.yml'
          || daily.sourceEvent !== 'schedule' || daily.sourceAttempt !== 1
          || daily.sourceSucceeded !== true) r.push('DAILY_SOURCE_UNTRUSTED');
      if (!isObj(daily) || daily.publisherSucceeded !== true
          || daily.publisherActor !== 'github-actions[bot]') r.push('DAILY_PUBLISHER_NOT_VERIFIED');
      if (!isObj(daily) || daily.sourceMainSha !== commits.at(-1)?.parents?.[0]) r.push('DAILY_SOURCE_MAIN_DRIFT');
      if (!beforeNewYorkCutoff(now) || [0, 6].includes(new Date(now).getUTCDay())) r.push('OUTSIDE_DAILY_WINDOW');
    } else {
      if (!isObj(approval) || approval.kind !== intent || approval.sha !== repo?.mainSha
          || approval.signed !== true || !validTime(approval.observedAt, now)
          || Date.parse(approval.expiresAt || '') <= now) r.push('OWNER_APPROVAL_MISSING');
      if (approval?.bypassRequested === true) r.push('EMERGENCY_BYPASS_FORBIDDEN');
    }
  }
  if (r.length) return result('HOLD', r);
  return result(intent === 'docs_only' ? 'MODEL_DOCS_NO_DEPLOY' : 'MODEL_RELEASE_CANDIDATE', []);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('invalid args');
    const s = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    process.stdout.write(JSON.stringify(evaluate(s), null, 2) + '\n');
  } catch {
    process.stdout.write(JSON.stringify(result('HOLD', ['INPUT_ERROR'])) + '\n');
  }
  // Even a synthetic positive model result NEVER returns a release-ready exit code.
  process.exitCode = 2;
}
