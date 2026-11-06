import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluate, beforeNewYorkCutoff, POLICY } from './release-policy.mjs';

const NOW = Date.parse('2026-11-06T12:00:00Z'); // 07:00 America/New_York
const main = 'b'.repeat(40), live = 'a'.repeat(40), checked = 'c'.repeat(40), tree = 'd'.repeat(40);
const iso = ms => new Date(ms).toISOString();
const newsPath = 'apps/web/src/content/news/2026-11-06.md';
const docPath = POLICY.exampleDocsPaths[0];
const ownerPath = POLICY.exampleOwnerPaths[0];

function base(intent = 'daily') {
  const kind = intent === 'docs_only' ? 'docs_neutral'
    : intent === 'daily' ? 'daily' : 'owner_approved';
  const path = kind === 'docs_neutral' ? docPath
    : kind === 'daily' ? newsPath : ownerPath;
  return {
    mode: 'dry_run', provenance: 'synthetic_fixture', intent,
    evidence: { complete: true, observedAt: iso(NOW - 60000) },
    repository: { fullName: POLICY.repository, mainSha: main, mainTreeSha: tree,
      mainAutoDeployDisabled: true, releaseBranch: POLICY.releaseBranch,
      releaseBranchProtected: true, configPinVerified: true },
    vercel: { projectId: POLICY.projectId, productionBranch: 'release/production',
      liveSha: live, releaseSha: live, rollbackKnown: true, rollbackActive: false,
      latestState: 'READY', candidateDeploymentCount: 0 },
    history: { complete: true, netDiffComplete: true, baseIsAncestor: true,
      baseSha: live, tipSha: main, commits: [{sha: main, parents:[live], kind, paths:[path]}],
      netPaths: [path] },
    checks: { complete: true, prHeadSha: checked, prHeadTreeSha: tree,
      observedAt: iso(NOW-45000), runs: POLICY.requiredChecks.map(name => ({
        name, sha: checked, status: 'completed', conclusion: 'success' })) },
    dispatch: intent === 'docs_only' ? null : {
      event: 'workflow_dispatch', sender: 'github-actions[bot]',
      issuerWorkflow: POLICY.publisherWorkflow, receiptSha: main,
      attempt: 1, acknowledged: true, runId: 123, observedAt: iso(NOW-40000) },
    daily: intent === 'daily' ? {
      date:'2026-11-06', editionPath:newsPath, sourceRepo:POLICY.repository,
      sourceWorkflow:'.github/workflows/daily-news.yml', sourceEvent:'schedule',
      sourceAttempt:1, sourceSucceeded:true, sourceMainSha:live,
      publisherSucceeded:true, publisherActor:'github-actions[bot]' } : null,
    approval: intent === 'docs_only' || intent === 'daily' ? null : {
      kind:intent, sha:main, signed:true, observedAt:iso(NOW-40000),
      expiresAt:iso(NOW+300000), bypassRequested:false },
    lock: {state:'clear', atomicVerified:true, baseSha:live,
      observedAt:iso(NOW-40000), expiresAt:iso(NOW+300000) },
    dedupe: {leaseAcquired:true, activeDuplicate:false,
      releasedSha:live, idempotencyKey:main },
    isolation: {syntheticOnly:true, productionDomainsUntouched:true,
      noCredentialsRead:true, noRemoteActions:true},
  };
}
const cases = [
  // Q-01: docs/main suppression must create zero production deployment records.
  ['Q-01.01 main suppression disabled', 'daily', x => {x.repository.mainAutoDeployDisabled=false}, 'MAIN_DEPLOYMENT_NOT_SUPPRESSED'],
  ['Q-01.02 wrong configured Production branch', 'daily', x => {x.vercel.productionBranch='main'}, 'WRONG_RELEASE_BRANCH'],
  ['Q-01.03 candidate already created deployment', 'daily', x => {x.vercel.candidateDeploymentCount=1}, 'UNEXPECTED_DEPLOYMENT'],
  ['Q-01.04 unknown docs path is not neutral', 'docs_only', x => {x.history.commits[0].paths=['docs/unknown.md'];x.history.netPaths=['docs/unknown.md']}, 'UNKNOWN_DOCS_PATH'],
  // Q-02: Daily must have authenticated successful source and verified trigger.
  ['Q-02.01 missing Daily source evidence', 'daily', x => {x.daily.sourceSucceeded=false}, 'DAILY_SOURCE_UNTRUSTED'],
  ['Q-02.02 mismatched edition date', 'daily', x => {x.daily.date='2026-11-05'}, 'DAILY_CONTENT_MISMATCH'],
  ['Q-02.03 no explicit post-merge dispatch', 'daily', x => {x.dispatch=null}, 'DISPATCH_NOT_AUTHENTICATED'],
  ['Q-02.04 human instead of bot dispatch', 'daily', x => {x.dispatch.sender='owner'}, 'DISPATCH_NOT_AUTHENTICATED'],
  // Q-03: untrusted dispatch, replay and publisher receipt fail closed.
  ['Q-03.01 forged issuer workflow', 'daily', x => {x.dispatch.issuerWorkflow='other.yml'}, 'DISPATCH_NOT_AUTHENTICATED'],
  ['Q-03.02 replayed controller dispatch', 'daily', x => {x.dispatch.attempt=2}, 'DISPATCH_NOT_AUTHENTICATED'],
  ['Q-03.03 publisher not proven successful', 'daily', x => {x.daily.publisherSucceeded=false}, 'DAILY_PUBLISHER_NOT_VERIFIED'],
  // Q-04: exact main tree, all commits and net diff must be classified.
  ['Q-04.01 truncated history', 'daily', x => {x.history.complete=false}, 'INCOMPLETE_HISTORY'],
  ['Q-04.02 live commit ancestry not established', 'daily', x => {x.history.baseIsAncestor=false}, 'INCOMPLETE_HISTORY'],
  ['Q-04.03 held Supabase migration in delta', 'daily', x => {x.history.commits[0].paths=['supabase/migrations/unsafe.sql'];x.history.netPaths=['supabase/migrations/unsafe.sql']}, 'HELD_PATH'],
  ['Q-04.04 duplicate commit in ancestry', 'daily', x => {x.history.commits.push({...x.history.commits[0]})}, 'INVALID_GRAPH'],
  ['Q-04.05 net diff path not enumerated', 'daily', x => {x.history.netPaths.push('apps/web/src/pages/hidden.astro')}, 'NET_DIFF_OUTSIDE_ENUMERATED_HISTORY'],
  // Q-05: exact PR-head/tree CI cannot be guessed, omitted or stale.
  ['Q-05.01 absent required CI', 'daily', x => {x.checks.runs.pop()}, 'CHECKS_INCOMPLETE'],
  ['Q-05.02 failed required CI', 'daily', x => {x.checks.runs[0].conclusion='failure'}, 'CHECK_NOT_EXACT_SUCCESS'],
  ['Q-05.03 tested PR tree differs from main tree', 'daily', x => {x.checks.prHeadTreeSha='e'.repeat(40)}, 'TREE_NOT_IDENTICAL'],
  ['Q-05.04 stale check evidence', 'daily', x => {x.checks.observedAt=iso(NOW-3600000)}, 'STALE_CHECKS'],
  // Q-06: duplicate requests/leases/already released SHAs cannot release again.
  ['Q-06.01 lease missing', 'daily', x => {x.dedupe.leaseAcquired=false}, 'DEDUPLICATION_NOT_PROVEN'],
  ['Q-06.02 competing duplicate run', 'daily', x => {x.dedupe.activeDuplicate=true}, 'DEDUPLICATION_NOT_PROVEN'],
  ['Q-06.03 release branch already at requested SHA', 'daily', x => {x.vercel.releaseSha=main}, 'RELEASE_ALREADY_AT_TARGET'],
  // Q-07: any uncertain rollback state locks ordinary publishing.
  ['Q-07.01 rollback active', 'daily', x => {x.vercel.rollbackActive=true}, 'ROLLBACK_LOCKED'],
  ['Q-07.02 live SHA diverges from release ref', 'daily', x => {x.vercel.liveSha='e'.repeat(40)}, 'ROLLBACK_LOCKED'],
  ['Q-07.03 rollback state unknown', 'daily', x => {x.vercel.rollbackKnown=false}, 'ROLLBACK_LOCKED'],
  // Q-08: emergency and owner releases need exact short-lived owner evidence.
  ['Q-08.01 owner release lacks approval', 'owner_release', x => {x.approval=null}, 'OWNER_APPROVAL_MISSING'],
  ['Q-08.02 approval binds wrong commit', 'owner_release', x => {x.approval.sha='e'.repeat(40)}, 'OWNER_APPROVAL_MISSING'],
  ['Q-08.03 owner approval expired', 'emergency', x => {x.approval.expiresAt=iso(NOW-1000)}, 'OWNER_APPROVAL_MISSING'],
  ['Q-08.04 emergency bypass requested', 'emergency', x => {x.approval.bypassRequested=true}, 'EMERGENCY_BYPASS_FORBIDDEN'],
  // Q-09: protect live Daily source window with fresh, atomic exact-base lock.
  ['Q-09.01 New York cutoff has passed', 'daily', x => {}, 'OUTSIDE_DAILY_WINDOW', Date.parse('2026-11-06T13:30:00Z')],
  ['Q-09.02 lock not atomic', 'daily', x => {x.lock.atomicVerified=false}, 'LOCK_NOT_ATOMIC'],
  ['Q-09.03 lock observation stale', 'daily', x => {x.lock.observedAt=iso(NOW-3600000)}, 'LOCK_STALE'],
  ['Q-09.04 original Daily main moved', 'daily', x => {x.daily.sourceMainSha='e'.repeat(40)}, 'DAILY_SOURCE_MAIN_DRIFT'],
  // Q-10: wrong Production project, failed isolation or an action request is denied.
  ['Q-10.01 wrong project', 'daily', x => {x.vercel.projectId='prj_other'}, 'WRONG_PROJECT'],
  ['Q-10.02 isolated controls unverified', 'daily', x => {x.isolation.productionDomainsUntouched=false}, 'ISOLATION_NOT_PROVEN'],
  ['Q-10.03 request is not a dry run', 'daily', x => {x.mode='deploy'}, 'NOT_DRY_RUN'],
];
assert.equal(cases.length, 37, 'exactly 37 required negative cases');

for (const [name, intent, mutate, expected, instant=NOW] of cases) {
  test(name, () => {
    const snapshot=base(intent);
    mutate(snapshot);
    const outcome=evaluate(snapshot, instant);
    assert.equal(outcome.status,'HOLD', name);
    assert.ok(outcome.reasons.includes(expected), `${name}: ${JSON.stringify(outcome.reasons)}`);
    assert.equal(outcome.mergeAuthorized,false);
    assert.equal(outcome.deploymentAuthorized,false);
    assert.equal(outcome.workflowDispatchAuthorized,false);
    assert.equal(outcome.productionSettingsAuthorized,false);
  });
}

test('synthetic daily model pass never authorizes any action', () => {
  const x=evaluate(base('daily'), NOW);
  assert.equal(x.status,'MODEL_RELEASE_CANDIDATE');
  assert.equal(x.mergeAuthorized,false);
  assert.equal(x.deploymentAuthorized,false);
});
test('synthetic docs-only no-release model never authorizes any action', () => {
  const x=evaluate(base('docs_only'), NOW);
  assert.equal(x.status,'MODEL_DOCS_NO_DEPLOY');
  assert.equal(x.mergeAuthorized,false);
});
test('New York cutoff follows DST, not fixed UTC', () => {
  assert.equal(beforeNewYorkCutoff(Date.parse('2026-07-06T12:29:00Z')),true); // 08:29 EDT
  assert.equal(beforeNewYorkCutoff(Date.parse('2026-07-06T12:30:00Z')),false);
  assert.equal(beforeNewYorkCutoff(Date.parse('2026-11-06T13:29:00Z')),true); // 08:29 EST
  assert.equal(beforeNewYorkCutoff(Date.parse('2026-11-06T13:30:00Z')),false);
});
test('CLI intentionally fails closed even for malformed template', () => {
  const tool=fileURLToPath(new URL('./release-policy.mjs', import.meta.url));
  const template=fileURLToPath(new URL('./snapshot.template.json', import.meta.url));
  const r=spawnSync(process.execPath,[tool,template],{encoding:'utf8',timeout:5000});
  assert.equal(r.status,2);
  const output=JSON.parse(r.stdout);
  assert.equal(output.status,'HOLD');
  assert.equal(output.mergeAuthorized,false);
  assert.equal(output.deploymentAuthorized,false);
});

test('non-finite or out-of-range clock fails closed without throwing', () => {
  for (const now of [NaN, Infinity, -Infinity, 8.64e15 + 1]) {
    const out = evaluate(base('daily'), now);
    assert.equal(out.status, 'HOLD');
    assert.ok(out.reasons.includes('INVALID_CLOCK'));
    assert.equal(out.mergeAuthorized, false);
    assert.equal(out.deploymentAuthorized, false);
  }
});
