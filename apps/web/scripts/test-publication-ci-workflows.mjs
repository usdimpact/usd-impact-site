import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { classifyDailyWorkflowFailure } from './daily-news-failure-stage.mjs';

const read = (name) => readFileSync(new URL(`../../../.github/workflows/${name}`, import.meta.url), 'utf8');
const quality = read('quality.yml');
const daily = read('daily-news.yml');
const catalyst = read('catalyst-brief.yml');
let count = 0;
function check(label, fn) { fn(); count += 1; console.log(`PASS ${label}`); }
function steps(workflow) {
  return [...workflow.matchAll(/^      - (?:name|uses): ([^\n]+)\n([\s\S]*?)(?=^      - |$(?![\s\S]))/gm)]
    .map((match) => ({ name: match[1], body: match[2] }));
}
const qSteps = steps(quality);
function step(list, name) {
  const matches = list.filter((entry) => entry.name === name);
  assert.equal(matches.length, 1, `exactly one ${name} step must exist`);
  return matches[0].body;
}
check('required job and PR/main/dispatch triggers remain', () => {
  assert.match(quality, /\n  validate-and-build:\n    runs-on: ubuntu-latest\n/);
  assert.match(quality, /on:\n  pull_request:\n    branches: \[main\]\n  push:\n    branches: \[main\]\n  workflow_dispatch:/);
  assert.doesNotMatch(quality, /pull_request_target|paths-ignore|\n\s*paths:|continue-on-error|\[skip ci\]/);
  assert.match(quality, /permissions:\n  contents: read\n  actions: read\n/);
  assert.doesNotMatch(quality, /:\s*write\b/);
});
check('routing runs trusted main policy before installing project code', () => {
  const selection = step(qSteps, 'Select publication validation route');
  assert.match(selection, /git fetch --no-tags origin '\+refs\/heads\/main:refs\/remotes\/origin\/main'/);
  assert.match(selection, /git show refs\/remotes\/origin\/main:apps\/web\/scripts\/publication-ci-plan\.mjs > "\$policy"/);
  assert.match(selection, /PUBLICATION_POLICY_BASE_SHA="\$\(git rev-parse refs\/remotes\/origin\/main\)" node "\$policy"/);
  assert.match(selection, /route=full\\nreason=trusted-policy-unavailable/);
  assert.ok(qSteps.findIndex((s) => s.name === 'Select publication validation route') < qSteps.findIndex((s) => s.name === 'Install dependencies'));
  assert.match(quality, /fetch-depth: 0/);
  assert.match(selection, /PUBLICATION_BASE_SHA: \$\{\{ inputs.publication_base_sha \}\}/);
  assert.match(selection, /PUBLICATION_HEAD_SHA: \$\{\{ inputs.publication_head_sha \}\}/);
});
const always = {
  'Audit high and critical vulnerabilities': ['npm audit --audit-level=high'],
  'Validate GitHub Action runtimes': ['node scripts/test-github-action-runtimes.mjs'],
  'Validate AI control center': ['node ../../scripts/test-control-center-policy.mjs'],
  'Validate publication CI routing contracts': ['node scripts/test-publication-ci-plan.mjs', 'node scripts/test-publication-ci-workflows.mjs'],
  'Validate content': ['npm run validate:content'],
  'Validate news and UX contracts': ['npm run validate:news', 'npm run validate:ux'],
  'Validate reports': ['npm run validate:reports'],
  'Validate compliance': ['npm run validate:compliance'],
  'Validate internal links': ['npm run validate:links'],
  'Validate publishing': ['npm run validate:publishing'],
  'Validate automation health checks': ['npm run validate:automation-health'],
  'Validate knowledge retrieval': ['node scripts/sync-knowledge-corpus-production.mjs'],
  'Validate Daily Cards': ['npm run validate:daily-cards'],
  'Build production site': ['npm run build'],
};
for (const [name, commands] of Object.entries(always)) check(`always retained: ${name}`, () => {
  const body = step(qSteps, name);
  assert.doesNotMatch(body, /^        if:/m);
  for (const command of commands) assert.ok(body.includes(command), command);
});
const platform = {
  'Validate Vercel functions': 'npm run validate:functions',
  'Validate paid access and protected audiobook': 'npm run validate:paid-access',
  'Validate quiz entitlement and mastery contracts': 'npm run validate:quizzes',
  'Validate protected video library': 'npm run validate:video-library',
  'Validate Supabase contracts': 'npm run validate:supabase',
};
for (const [name, command] of Object.entries(platform)) check(`full fallback retains: ${name}`, () => {
  const body = step(qSteps, name);
  assert.match(body, /if: steps\.publication_route\.outputs\.route != 'content-only'/);
  assert.ok(body.includes(command));
});
check('only the five reviewed platform steps are conditional', () => {
  const actual = qSteps.filter((s) => s.body.includes("route != 'content-only'")).map((s) => s.name).sort();
  assert.deepEqual(actual, Object.keys(platform).sort());
  const body = step(qSteps, 'Validate publication source and importer contracts');
  assert.match(body, /if: steps\.publication_route\.outputs\.route == 'content-only'/);
  assert.match(body, /node scripts\/validate-publication-content\.mjs --contracts/);
});
for (const [name, source, opening] of [
  ['Daily', daily, 'Open and validate publication pull request'],
  ['Catalyst', catalyst, 'Open publication pull request'],
]) {
  const list = steps(source);
  check(`${name}: content preflight replaces only the pre-PR validate/build`, () => {
    const body = step(list, 'Validate publication content preflight');
    assert.match(body, /run: node scripts\/validate-publication-content\.mjs --preflight/);
    assert.doesNotMatch(source, /npm run build|npm run validate(?:\s|$)/);
    assert.ok(list.findIndex((s) => s.name === 'Validate publication content preflight') < list.findIndex((s) => s.name === opening));
  });
  check(`${name}: dispatch binds exact head/base and only selects fresh runs`, () => {
    const body = step(list, opening);
    assert.match(body, /publication_base_sha="\$\(gh pr view "\$pr_url" --json baseRefOid --jq '\.baseRefOid'\)"/);
    assert.match(body, /-f publication_base_sha="\$publication_base_sha"/);
    assert.match(body, /-f publication_head_sha="\$head_sha"/);
    assert.match(body, /quality_requested_at="\$\(date -u \+%FT%TZ\)"/);
    assert.match(body, /--json databaseId,headSha,createdAt/);
    assert.ok(body.includes('.createdAt >= \\"$quality_requested_at\\"'));
    assert.ok(body.includes('.headSha == \\"$head_sha\\"'));
    assert.match(body, /if \[ "\$run_conclusion" != "success" \]; then[\s\S]*exit 1/);
  });
  check(`${name}: protected human release gates remain separate`, () => {
    assert.doesNotMatch(source, /gh pr merge|--admin|gh run rerun|gh api .*\/approve/);
    assert.match(source, /human.*review.*merge/);
    assert.match(source, /Required PR-event checks, editorial facts\/calendar review, Preview and exact-version release approval remain separate gates/);
  });
}
check('schedules and generation retry budgets remain unchanged', () => {
  assert.match(daily, /cron: '17 9 \* \* 1-5'/);
  assert.match(catalyst, /cron: '45 6 \* \* \*'/);
  assert.match(catalyst, /cron: '45 22 \* \* \*'/);
  assert.match(daily, /max_active_seconds=2400/);
  assert.match(daily, /regeneration_used=false/);
  assert.match(daily, /regeneration_used=true/);
  assert.match(catalyst, /for attempt in 1 2; do/);
});
check('import and publication-eligibility protections remain', () => {
  assert.match(daily, /import-daily-news\.mjs.*--replace --skip-published --publish/);
  assert.match(catalyst, /import-catalyst-brief\.mjs.*--publish --skip-published/);
  assert.match(daily, /existing_pr=.*[\s\S]*--state all/);
  assert.match(catalyst, /if: steps\.eligibility\.outputs\.publishable == 'true'/);
});
check('new preflight failure label is accurate and backward compatible', () => {
  assert.match(daily, /"\$PUBLISH_OUTCOME" \\\n            'publication-content-preflight'/);
  assert.equal(classifyDailyWorkflowFailure({ validateOutcome: 'failure', validationGate: 'publication-content-preflight' }).gate, 'publication-content-preflight');
  assert.equal(classifyDailyWorkflowFailure({ validateOutcome: 'failure' }).gate, 'site-validation-build');
  assert.equal(classifyDailyWorkflowFailure({ validateOutcome: 'failure', validationGate: 'untrusted-value' }).gate, 'site-validation-build');
  assert.equal(classifyDailyWorkflowFailure({ validateOutcome: 'success', publishOutcome: 'action_required' }).gate, 'publication-pr-quality');
});
check('all workflow run blocks parse as shell without executing them', () => {
  for (const source of [quality, daily, catalyst]) for (const entry of steps(source)) {
    const match = entry.body.match(/^        run: (.*)\n?([\s\S]*)$/m);
    if (!match) continue;
    const shell = match[1] === '|' ? match[2].split('\n').map((line) => line.startsWith('          ') ? line.slice(10) : line).join('\n') : match[1];
    const result = spawnSync('bash', ['-n'], { input: shell, encoding: 'utf8' });
    assert.equal(result.status, 0, `${entry.name}: ${result.stderr}`);
  }
});
console.log(`publication CI workflows: ${count} grouped checks passed; no live workflow dispatched`);
