/**
 * USD Impact no-deployment control: offline, advisory and fail-closed.
 * No network, credentials, GitHub writes, deployments or file mutation.
 * Inputs are independently verified observations, not trusted assertions.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const POLICY = Object.freeze({
  repo: 'usdimpact/usd-impact-site',
  pr: 1199,
  project: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7',
  changedFile: 'docs/operations/claude-manual-issue-review-beginner.md',
  vercelConfigBlob: 'ffe227d65f476417394d1008a0a12f3b44d55989',
  checks: [
    'CodeQL',
    'CodeQL (javascript-typescript)',
    'validate-and-build',
    'Dependency review',
    'negative-tests',
    'Reject Development-only Production migration files',
  ],
});

const sha40 = /^[a-f0-9]{40}$/;
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);

export function assess(snapshot, nowMs = Date.now()) {
  const reasons = [];
  if (!object(snapshot)) return { status: 'HOLD', stageOnly: false, mergeAuthorized: false, deploymentAuthorized: false, reasons: ['INVALID_SNAPSHOT'] };
  const { action, github, vercel, controls, evidence } = snapshot;
  if (action !== 'stage') reasons.push('MERGE_OR_DEPLOY_NEVER_AUTHORIZED_BY_THIS_TOOL');
  if (!object(github) || !object(vercel) || !object(controls) || !object(evidence)) {
    return { status: 'HOLD', stageOnly: false, mergeAuthorized: false, deploymentAuthorized: false, reasons: [...reasons, 'INCOMPLETE_EVIDENCE'] };
  }
  if (github.repo !== POLICY.repo || github.pr !== POLICY.pr) reasons.push('WRONG_REPOSITORY_OR_PR');
  if (github.state !== 'open' || github.draft !== true || github.merged !== false) reasons.push('PR_NOT_DRAFT_OPEN_UNMERGED');
  if (github.baseBranch !== 'main') reasons.push('WRONG_BASE_BRANCH');
  if (typeof github.headBranch !== 'string' || !/^agent\/[a-z0-9][a-z0-9_-]*$/.test(github.headBranch)) reasons.push('BRANCH_NOT_AGENT_SINGLE_SEGMENT');
  if (!sha40.test(github.headSha ?? '') || !sha40.test(github.mainSha ?? '') || github.headSha === github.mainSha) reasons.push('INVALID_OR_AMBIGUOUS_SHA');
  if (github.baseSha !== github.mainSha) reasons.push('BASE_MAIN_DRIFT');
  if (!Array.isArray(github.changedFiles) || github.changedFiles.length !== 1 || github.changedFiles[0] !== POLICY.changedFile) reasons.push('UNREVIEWED_FILE_SCOPE');
  if (!Array.isArray(github.checks) || github.checks.length !== POLICY.checks.length) reasons.push('MISSING_OR_EXTRA_CHECKS');
  else {
    const names = new Set();
    for (const check of github.checks) {
      if (!object(check) || typeof check.name !== 'string' || names.has(check.name) || !POLICY.checks.includes(check.name)) reasons.push('UNKNOWN_OR_DUPLICATE_CHECK');
      if (object(check)) {
        names.add(check.name);
        if (check.status !== 'completed' || check.conclusion !== 'success' || check.sha !== github.headSha) reasons.push('CHECK_NOT_SUCCESS_ON_EXACT_HEAD');
      }
    }
    if (POLICY.checks.some(name => !names.has(name))) reasons.push('REQUIRED_CHECK_ABSENT');
  }
  if (vercel.projectId !== POLICY.project) reasons.push('WRONG_VERCEL_PROJECT');
  if (vercel.productionBranch !== 'main') reasons.push('PRODUCTION_BRANCH_UNKNOWN_OR_DIFFERENT');
  if (vercel.inspectedSha !== github.headSha || vercel.deploymentCount !== 0) reasons.push('DEPLOYMENT_EXISTENCE_NOT_DISPROVED');
  if (!object(vercel.deploymentEnabled) || vercel.deploymentEnabled['agent/*'] !== false) reasons.push('AGENT_BRANCH_DEPLOYMENT_NOT_DISABLED');
  if (vercel.configBlobSha !== POLICY.vercelConfigBlob) reasons.push('VERCEL_CONFIG_BLOB_DRIFT');
  if (!object(vercel.deploymentEnabled) || own(vercel.deploymentEnabled, 'main') && vercel.deploymentEnabled.main !== true) reasons.push('MAIN_POLICY_CHANGED_REQUALIFY');
  if (controls.noVercelChanges !== true || controls.noGitHubMutations !== true || controls.noClaudeDispatch !== true || controls.releaseHoldsRetained !== true) reasons.push('CONTROL_HOLDS_NOT_RECORDED');
  const freshnessLimitMs = 15 * 60 * 1000;
  for (const field of ['githubObservedAt', 'vercelObservedAt', 'configObservedAt']) {
    const iso = evidence[field];
    const timestamp = typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(iso) ? Date.parse(iso) : NaN;
    if (!Number.isFinite(timestamp) || !Number.isFinite(nowMs) || timestamp > nowMs || nowMs - timestamp > freshnessLimitMs) {
      reasons.push('EVIDENCE_NOT_FRESH_OR_INVALID_' + field.toUpperCase());
    }
  }
  const unique = [...new Set(reasons)];
  return {
    status: unique.length ? 'HOLD' : 'ADVISORY_STAGE_OK',
    stageOnly: unique.length === 0,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    reasons: unique,
  };
}

export function assessArchitecture(plan) {
  const reasons = [];
  if (!object(plan)) return { status: 'HOLD', reasons: ['INVALID_PLAN'] };
  if (plan.productionProjectUntouched !== true) reasons.push('PRODUCTION_PROJECT_MUST_REMAIN_UNCHANGED');
  if (plan.isolatedProject !== true) reasons.push('NONPRODUCTION_ISOLATION_NOT_SHOWN');
  if (plan.mainAutoDeploy === false && plan.dailyPublishingReplacementProven !== true) reasons.push('DAILY_PUBLISHING_REPLACEMENT_NOT_PROVEN');
  if (plan.productionControlsVerified !== true) reasons.push('PRODUCTION_DEPLOYMENT_CONTROLS_UNVERIFIED');
  if (plan.manualReleaseGateDesigned !== true) reasons.push('OWNER_GATED_RELEASE_PATH_MISSING');
  if (plan.rollbackAndFailClosedTestsPassed !== true) reasons.push('ROLLBACK_AND_NEGATIVE_TESTS_MISSING');
  if (reasons.length === 0) reasons.push('SEPARATE_EXACT_SCOPE_OWNER_CUTOVER_APPROVAL_REQUIRED');
  return { status: 'HOLD', mergeAuthorized: false, deploymentAuthorized: false, reasons };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node no-deploy-control.mjs /path/to/verified-snapshot.json');
    const snapshot = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    const result = assess(snapshot);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exitCode = result.stageOnly ? 0 : 1;
  } catch (error) {
    process.stderr.write(JSON.stringify({status:'HOLD',reasons:['INPUT_ERROR'],detail:String(error.message)}) + '\n');
    process.exitCode = 1;
  }
}
