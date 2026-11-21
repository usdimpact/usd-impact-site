import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assess, assessArchitecture, POLICY } from './no-deploy-control.mjs';
const head = '3124453043b7c511f3cb1c7c93f91d592e798d84';
const main = '64626a7325eb180d829455d9446b90d7336f173f';
const fixedNow = Date.parse('2026-11-06T21:57:00Z');
const original = () => ({
  action: 'stage',
  github: {
    repo: POLICY.repo, pr: 1199, state: 'open', draft: true, merged: false,
    baseBranch: 'main', headBranch: 'agent/issue-1198-guide-run7-reconciliation-20261106',
    headSha: head, baseSha: main, mainSha: main,
    changedFiles: [POLICY.changedFile],
    checks: POLICY.checks.map(name => ({ name, status: 'completed', conclusion: 'success', sha: head })),
  },
  vercel: {
    projectId: POLICY.project, productionBranch: 'main', inspectedSha: head, deploymentCount: 0, configBlobSha: POLICY.vercelConfigBlob,
    deploymentEnabled: {'agent/*': false, 'preview/*': true, 'automation/control-center-state': false},
  },
  controls: { noVercelChanges: true, noGitHubMutations: true, noClaudeDispatch: true, releaseHoldsRetained: true },
  evidence: { githubObservedAt: '2026-11-06T21:53:00Z', vercelObservedAt: '2026-11-06T21:54:00Z', configObservedAt: '2026-11-06T21:55:00Z' },
});
const denied = (label, change, expected) => test(label, () => {
  const obj = original(); change(obj); const x = assess(obj, fixedNow);
  assert.equal(x.status, 'HOLD'); assert.equal(x.stageOnly, false);
  assert.equal(x.mergeAuthorized, false); assert.equal(x.deploymentAuthorized, false);
  if (expected) assert.ok(x.reasons.includes(expected), JSON.stringify(x));
});

test('exact documented snapshot permits advisory staging only', () => {
  const x=assess(original(), fixedNow);assert.equal(x.status,'ADVISORY_STAGE_OK');
  assert.equal(x.stageOnly,true);assert.equal(x.mergeAuthorized,false);assert.equal(x.deploymentAuthorized,false);
});
denied('main merge request is never authorized', o => {o.action='merge'}, 'MERGE_OR_DEPLOY_NEVER_AUTHORIZED_BY_THIS_TOOL');
denied('release request is never authorized', o => {o.action='release'}, 'MERGE_OR_DEPLOY_NEVER_AUTHORIZED_BY_THIS_TOOL');
denied('wrong or mixed file scope', o => {o.github.changedFiles.push('apps/web/vercel.json')}, 'UNREVIEWED_FILE_SCOPE');
denied('docs wildcard is not allowed', o => {o.github.changedFiles=['docs/operations/another.md']}, 'UNREVIEWED_FILE_SCOPE');
denied('main branch is not a safe agent branch', o => {o.github.headBranch='main'}, 'BRANCH_NOT_AGENT_SINGLE_SEGMENT');
denied('nested agent branch not proven by glob', o => {o.github.headBranch='agent/nested/branch'}, 'BRANCH_NOT_AGENT_SINGLE_SEGMENT');
denied('preview branch triggers deployment', o => {o.github.headBranch='preview/another'}, 'BRANCH_NOT_AGENT_SINGLE_SEGMENT');
denied('pr is no longer draft', o => {o.github.draft=false}, 'PR_NOT_DRAFT_OPEN_UNMERGED');
denied('merge is already recorded', o => {o.github.merged=true}, 'PR_NOT_DRAFT_OPEN_UNMERGED');
denied('wrong base branch', o => {o.github.baseBranch='production'}, 'WRONG_BASE_BRANCH');
denied('stale main base', o => {o.github.mainSha='1234567890123456789012345678901234567890'}, 'BASE_MAIN_DRIFT');
denied('check did not complete', o => {o.github.checks[0].status='queued'}, 'CHECK_NOT_SUCCESS_ON_EXACT_HEAD');
denied('check failed', o => {o.github.checks[0].conclusion='failure'}, 'CHECK_NOT_SUCCESS_ON_EXACT_HEAD');
denied('check ran against old commit', o => {o.github.checks[0].sha='1234567890123456789012345678901234567890'}, 'CHECK_NOT_SUCCESS_ON_EXACT_HEAD');
denied('missing required check', o => {o.github.checks.pop()}, 'MISSING_OR_EXTRA_CHECKS');
denied('duplicate check cannot replace required check', o => {o.github.checks[5]=o.github.checks[0]}, 'UNKNOWN_OR_DUPLICATE_CHECK');
denied('missing Vercel project ID', o => {o.vercel.projectId='unknown'}, 'WRONG_VERCEL_PROJECT');
denied('new deployment found', o => {o.vercel.deploymentCount=1}, 'DEPLOYMENT_EXISTENCE_NOT_DISPROVED');
denied('deployment query on other SHA', o => {o.vercel.inspectedSha=main}, 'DEPLOYMENT_EXISTENCE_NOT_DISPROVED');
denied('agent deployment disabled flag removed', o => {delete o.vercel.deploymentEnabled['agent/*']}, 'AGENT_BRANCH_DEPLOYMENT_NOT_DISABLED');
denied('agent deployment enabled', o => {o.vercel.deploymentEnabled['agent/*']=true}, 'AGENT_BRANCH_DEPLOYMENT_NOT_DISABLED');
denied('main suppression architecture altered', o => {o.vercel.deploymentEnabled.main=false}, 'MAIN_POLICY_CHANGED_REQUALIFY');
denied('controls missing', o => {o.controls.noClaudeDispatch=false}, 'CONTROL_HOLDS_NOT_RECORDED');
denied('malformed snapshot', o => {o.github=null}, 'INCOMPLETE_EVIDENCE');
denied('config blob changed independently of policy keys', o => {o.vercel.configBlobSha=main}, 'VERCEL_CONFIG_BLOB_DRIFT');
denied('stale GitHub observation', o => {o.evidence.githubObservedAt='2026-11-06T21:10:00Z'}, 'EVIDENCE_NOT_FRESH_OR_INVALID_GITHUBOBSERVEDAT');
denied('future-dated Vercel observation', o => {o.evidence.vercelObservedAt='2026-11-07T12:00:00Z'}, 'EVIDENCE_NOT_FRESH_OR_INVALID_VERCELOBSERVEDAT');
denied('config observation missing', o => {delete o.evidence.configObservedAt}, 'EVIDENCE_NOT_FRESH_OR_INVALID_CONFIGOBSERVEDAT');
test('null snapshot fails closed', () => assert.equal(assess(null, fixedNow).status, 'HOLD'));
test('architecture never authorizes live cutover', () => {
  const res=assessArchitecture({productionProjectUntouched:true,isolatedProject:true,mainAutoDeploy:false,dailyPublishingReplacementProven:true,productionControlsVerified:true,manualReleaseGateDesigned:true,rollbackAndFailClosedTestsPassed:true});
  assert.equal(res.status,'HOLD');assert.equal(res.deploymentAuthorized,false);
  assert.ok(res.reasons.includes('SEPARATE_EXACT_SCOPE_OWNER_CUTOVER_APPROVAL_REQUIRED'));
});
test('architecture blocks Daily regression', () => {
  const res=assessArchitecture({productionProjectUntouched:true,isolatedProject:true,mainAutoDeploy:false,dailyPublishingReplacementProven:false,productionControlsVerified:true,manualReleaseGateDesigned:true,rollbackAndFailClosedTestsPassed:true});
  assert.ok(res.reasons.includes('DAILY_PUBLISHING_REPLACEMENT_NOT_PROVEN'));
});


test('malformed architecture object denies all actions', () => {
  const out = assessArchitecture(null);
  assert.deepEqual(out, { status:'HOLD', stageOnly:false, mergeAuthorized:false, deploymentAuthorized:false, reasons:['INVALID_PLAN'] });
});
test('architecture missing mainAutoDeploy is a specific HOLD', () => {
  const out = assessArchitecture({productionProjectUntouched:true,isolatedProject:true,dailyPublishingReplacementProven:true,productionControlsVerified:true,manualReleaseGateDesigned:true,rollbackAndFailClosedTestsPassed:true});
  assert.equal(out.status, 'HOLD');
  assert.equal(out.mergeAuthorized, false);
  assert.ok(out.reasons.includes('MAIN_AUTODEPLOY_STATE_UNVERIFIED'));
});
const runCli = args => spawnSync(process.execPath, [fileURLToPath(new URL('./no-deploy-control.mjs', import.meta.url)), ...args], { encoding:'utf8', timeout: 5000 });
test('CLI rejects deliberately invalid snapshot with explicit denial fields', () => {
  const run = runCli([fileURLToPath(new URL('./snapshot.template.json', import.meta.url))]);
  assert.equal(run.status, 1);
  const result = JSON.parse(run.stdout);
  assert.equal(result.status, 'HOLD');
  assert.equal(result.stageOnly, false);
  assert.equal(result.mergeAuthorized, false);
  assert.equal(result.deploymentAuthorized, false);
});
test('CLI missing file fails closed with consistent authorization flags and no paths', () => {
  const run = runCli(['/absolute-nonexistent-deployment-pilot.json']);
  assert.equal(run.status, 1);
  const result = JSON.parse(run.stderr);
  assert.deepEqual(result, {status:'HOLD',stageOnly:false,mergeAuthorized:false,deploymentAuthorized:false,reasons:['INPUT_ERROR']});
  assert.ok(!run.stderr.includes('/absolute-nonexistent'));
});
test('CLI malformed JSON fails closed without disclosing source input', () => {
  const run = runCli([fileURLToPath(new URL('./no-deploy-control.test.mjs', import.meta.url))]);
  assert.equal(run.status, 1);
  const result = JSON.parse(run.stderr);
  assert.equal(result.status, 'HOLD');
  assert.equal(result.mergeAuthorized, false);
  assert.equal(result.deploymentAuthorized, false);
  assert.ok(!run.stderr.includes('import test'));
});
test('CLI requires exactly one snapshot argument', () => {
  const run = runCli([]);
  assert.equal(run.status, 1);
  const result = JSON.parse(run.stderr);
  assert.equal(result.status,'HOLD');
  assert.equal(result.mergeAuthorized,false);
  assert.equal(result.deploymentAuthorized,false);
});
