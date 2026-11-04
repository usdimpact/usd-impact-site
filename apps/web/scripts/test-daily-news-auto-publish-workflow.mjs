import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  REPOSITORY, REQUIRED_GENERATOR_STEPS, REQUIRED_CHECKS,
  beforeUsFirstRelease, validateSourceRun, isTrustedBackstop,
  selectExactDailyPr, validateDailyContent, requireExactChecks, isSingleGeneratorCommit,
  dispatchSourceRunId, isAuthenticatedBotDispatch,
} from './daily-news-auto-publish-policy.mjs';

const auto = readFileSync(new URL('../../../.github/workflows/daily-news-auto-publish.yml', import.meta.url), 'utf8');
const dep = readFileSync(new URL('../../../.github/workflows/dependency-review.yml', import.meta.url), 'utf8');
const mainDaily = readFileSync(new URL('../../../.github/workflows/daily-news.yml', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('./daily-news-auto-publish.mjs', import.meta.url), 'utf8');
const sha = 'a'.repeat(40);
const base = 'b'.repeat(40);
const now = new Date('2026-11-04T10:40:00Z');
const day = '2026-11-04';
const run = {
  id: 80001, status: 'completed', conclusion: 'success', event: 'workflow_dispatch',
  path: '.github/workflows/daily-news.yml', head_branch: 'main',
  head_sha: base, created_at: '2026-11-04T09:32:18Z',
  repository: { full_name: REPOSITORY },
};
const jobs = [{ name: 'build-and-publish', conclusion: 'success',
  steps: REQUIRED_GENERATOR_STEPS.map((name) => ({ name, conclusion: 'success' })) }];

assert.equal(beforeUsFirstRelease(new Date('2026-11-04T13:29:00Z')), true);
assert.equal(beforeUsFirstRelease(new Date('2026-11-04T13:30:00Z')), false);
assert.equal(beforeUsFirstRelease(new Date('2026-07-15T12:29:00Z')), true);
assert.equal(beforeUsFirstRelease(new Date('2026-07-15T12:30:00Z')), false);
assert.equal(beforeUsFirstRelease(new Date('garbage')), false);
assert.equal(validateSourceRun(run, jobs, base, now), null);
assert.equal(validateSourceRun({ ...run, path: 'untrusted.yml' }, jobs, base, now), 'not-a-successful-trusted-daily-run');
assert.equal(validateSourceRun({ ...run, head_branch: 'feature' }, jobs, base, now), 'not-a-successful-trusted-daily-run');
assert.equal(validateSourceRun({ ...run, conclusion: 'failure' }, jobs, base, now), 'not-a-successful-trusted-daily-run');
assert.equal(validateSourceRun(run, jobs, sha, now), 'main-has-moved');
assert.equal(validateSourceRun(run, jobs, base, new Date('2026-11-04T13:30:01Z')), 'after-first-us-release-cutoff');
assert.equal(validateSourceRun(run, jobs, base, new Date('2026-11-05T10:00:00Z')), 'not-current-utc-weekday');
assert.equal(validateSourceRun(run, [{ ...jobs[0], steps: jobs[0].steps.slice(1) }], base, now), 'generator-required-step-missing-or-failed');
assert.equal(validateSourceRun(run, [{ ...jobs[0], steps: [{ name: 'Import as published content', conclusion: 'failure' }] }], base, now), 'generator-required-step-missing-or-failed');

const backstop = {
  path: '.github/workflows/daily-news-schedule-backstop.yml',
  event: 'workflow_dispatch', head_branch: 'main', head_sha: base,
  conclusion: 'success', status: 'completed', created_at: '2026-11-04T09:32:10Z',
};
assert.equal(isTrustedBackstop([backstop], run), true);
assert.equal(isTrustedBackstop([{ ...backstop, conclusion: 'failure' }], run), false);
assert.equal(isTrustedBackstop([{ ...backstop, created_at: '2026-11-04T09:29:00Z' }], run), false);
assert.equal(isTrustedBackstop([{ ...backstop, head_sha: sha }], run), false);

const branch = 'automation/daily-usd-impact-' + day + '-' + run.id;
const pr = {
  number: 1101, title: 'Publish Daily USD Impact — ' + day,
  state: 'open', draft: false, base: { ref: 'main', sha: base },
  head: { ref: branch, sha, repo: { full_name: REPOSITORY } },
};
assert.deepEqual(selectExactDailyPr([pr], run, base),
  { prNumber: 1101, branch, headSha: sha, editionDate: day });
assert.throws(() => selectExactDailyPr([{ ...pr, draft: true }], run, base), /not-unique/);
assert.throws(() => selectExactDailyPr([{ ...pr, base: { ref: 'main', sha } }], run, base), /not-unique/);
assert.throws(() => selectExactDailyPr([pr, pr], run, base), /not-unique/);
assert.throws(() => selectExactDailyPr(Array(100).fill(pr), run, base), /incomplete/);
const comparison = {
  status: 'ahead', ahead_by: 1, behind_by: 0,
  files: [{ filename: 'apps/web/src/content/news/2026-11-04.md', status: 'added' }],
};
assert.equal(isSingleGeneratorCommit(comparison, day), true);
assert.equal(isSingleGeneratorCommit({ ...comparison, ahead_by: 2 }, day), false);
assert.equal(isSingleGeneratorCommit({ ...comparison, behind_by: 1 }, day), false);
assert.equal(isSingleGeneratorCommit({ ...comparison, files: [
  ...comparison.files, { filename: '.github/workflows/other.yml', status: 'modified' },
] }, day), false);
const candidate = [
  '---',
  'title: "Daily USD Impact — November 4, 2026"',
  'metaTitle: "Daily USD Impact | USD Impact"',
  'metaDescription: "Synthetic fixture only."',
  'slug: "/news/2026-11-04"',
  'date: "2026-11-04"',
  'generatedAt: "2026-11-04T09:41:05Z"',
  'lastReviewed: "2026-11-04"',
  'status: "published"',
  'category: "Daily USD Impact"',
  'marketRegime: "No live prices inferred"',
  'summary: "Synthetic fixture, no asset recommendation."',
  'featured: true',
  'assets:',
  '  - "USD"',
  'highlights:',
  ...[1, 2, 3].flatMap((id) => [
    '  - headline: "Synthetic highlight ' + id + '"',
    '    development: "No market claim."',
    '    whyItMatters: "Context only."',
    '    assets:',
    '      - "USD"',
    '    importance: "low"',
    '    verification: "verified-primary"',
    '    sourceIds:',
    '      - "synthetic-' + id + '"',
  ]),
  'catalysts: []',
  'sources:',
  ...[1, 2, 3].flatMap((id) => [
    '  - id: "synthetic-' + id + '"',
    '    title: "Synthetic source"',
    '    publisher: "Fixture"',
    '    url: "https://www.bls.gov/news.release/archives/fake_11042026.htm"',
    '    publishedAt: "2026-11-04"',
    '    sourceType: "primary"',
  ]),
  'complianceNote: "Educational and informational only. Not investment advice."',
  '---',
  'Synthetic test copy; no market claims.',
  '',
].join('\n');
const file = { filename: 'apps/web/src/content/news/2026-11-04.md', status: 'added' };
assert.deepEqual(validateDailyContent(candidate, day, file), { sourceCount: 3, headlineCount: 3 });
assert.throws(() => validateDailyContent(candidate.replace('status: "published"', 'status: "review"'), day, file), /drift/);
assert.throws(() => validateDailyContent(candidate.replace('sourceType: "primary"', 'sourceType: "reporting"'), day, file), /primary/);
assert.throws(() => validateDailyContent(candidate.replace('2026-11-04T09:41', '2026-11-03T09:41'), day, file), /drift/);
assert.throws(() => validateDailyContent(candidate, day, { filename: file.filename, status: 'modified' }), /single/);
assert.throws(() => validateDailyContent(candidate, day + '\\hostile', {
  filename: 'apps/web/src/content/news/' + day + '\\hostile.md', status: 'added',
}), /invalid-edition-date/);


const checks = REQUIRED_CHECKS.map((name, i) => ({
  name, head_sha: sha, status: 'completed', conclusion: 'success',
  id: 100 + i, app: { slug: 'github-actions' },
}));
assert.equal(requireExactChecks(checks, sha), true);
assert.throws(() => requireExactChecks(checks.slice(1), sha), /missing|required/);
assert.throws(() => requireExactChecks([{ ...checks[0], conclusion: 'failure', id: 999 }, ...checks], sha), /not-successful/);
assert.throws(() => requireExactChecks(checks.map((x) => ({ ...x, head_sha: base })), sha), /not-successful/);
assert.throws(() => requireExactChecks(checks.map((x) => ({ ...x, app: { slug: 'rogue-bot' } })), sha), /not-successful/);

assert.match(auto, /workflow_run:[\s\S]*workflows: \["Daily USD Impact publication"\]/);
assert.match(auto, /branches: \[main\]/);
assert.match(auto, /cancel-in-progress: false/);
assert.match(auto, /github\.event\.workflow_run\.conclusion == 'success'/);
assert.match(auto, /vars\.DAILY_NEWS_AUTO_PUBLISH_DISABLED != 'true'/);
assert.match(auto, /persist-credentials: false/);
assert.match(auto, /node apps\/web\/scripts\/daily-news-auto-publish\.mjs/);
assert.doesNotMatch(auto, /checkout.*head_sha|gh pr merge --admin/);
assert.match(dep, /workflow_dispatch:[\s\S]*publication_pr:[\s\S]*publication_base_sha:/);
assert.match(dep, /- name: Fail closed unless dispatched for an exact one-file Daily PR/);
assert.match(dep, /live_main[\s\S]*EXPECTED_BASE/);
assert.match(dep, /length == 1 and \.\[0\]\.filename == \$expected/);
assert.match(dep, /base-ref: \$\{\{ github\.event_name == 'workflow_dispatch'/);
assert.match(dep, /head-ref: \$\{\{ github\.event_name == 'workflow_dispatch'/);
assert.match(mainDaily, /gh workflow run quality\.yml --ref "\$branch"/);
assert.doesNotMatch(mainDaily, /gh pr merge/);
assert.match(runtime, /isSingleGeneratorCommit\(/);
assert.match(runtime, /requireExactChecks\(/);
assert.match(runtime, /previewReady\(/);
assert.match(runtime, /ensureMorning\(\)/);
assert.match(runtime, /verifyDailyNewsDeployment\(/);
assert.match(runtime, /'merge_method=squash'/);
assert.doesNotMatch(runtime, /--admin|--force|--bypass|gh pr merge/);
assert.match(runtime, /files\[0\]\.filename !== expectedPath/);
assert.match(runtime, /'contents\/' \+ expectedPath/);
assert.doesNotMatch(runtime, /'contents\/' \+ files\[0\]\.filename/);


assert.equal(dispatchSourceRunId({ inputs: { source_run_id: '41808333994' } }), 41808333994);
for (const invalid of ['', '0', '-1', '1.2', '999999999999999999999',
  '41808333994\n--ref untrusted', ' 41808333994', 'not-a-run']) {
  assert.throws(() => dispatchSourceRunId({ inputs: { source_run_id: invalid } }),
    /invalid-explicit-source-run-id/, 'dispatch source ID must be non-authoritative and strictly numeric');
}
assert.throws(() => dispatchSourceRunId({ inputs: {} }), /invalid-explicit-source-run-id/);
assert.match(auto, /workflow_dispatch:[\s\S]*source_run_id:[\s\S]*required: true/);
assert.match(auto, /github.event_name == 'workflow_dispatch'/);
assert.match(mainDaily, /Explicitly dispatch trusted bounded publisher after source verification/);
assert.match(mainDaily, /gh workflow run daily-news-auto-publish\.yml[\s\S]*source_run_id=\$GITHUB_RUN_ID/);
assert.match(mainDaily, /if ! gh workflow run daily-news-auto-publish\.yml[\s\S]*never retry automatically/);
assert.match(runtime, /source = api\('actions\/runs\/' \+ id\)/);
assert.match(runtime, /source\.id !== id \|\| source\.head_branch !== 'main'/);
assert.match(runtime, /!isAuthenticatedBotDispatch\(source, process\.env\.GITHUB_ACTOR\)/);
assert.match(runtime, /source\.status === 'completed'[\s\S]*source\.conclusion !== 'success'/);
assert.match(runtime, /explicit-source-uses-trusted-dispatch-controller/);
assert.match(runtime, /process\.env\.GITHUB_REF !== 'refs\/heads\/main'/);
assert.match(runtime, /validateSourceRun\(source, jobsPayload.jobs, mainSha, NOW\(\)\)/);
assert.match(runtime, /isTrustedBackstop\(backstop\.workflow_runs, source\)/);
assert.doesNotMatch(runtime, /GH_TOKEN[^\n]*secrets\./);

const acceptedBotSource = {
  ...run, actor: { login: 'github-actions[bot]' },
};
assert.equal(isAuthenticatedBotDispatch(acceptedBotSource, 'github-actions[bot]'), true);
assert.equal(isAuthenticatedBotDispatch(acceptedBotSource, 'usdimpact'), false,
  'a manually dispatched publisher must not accept a copied source run ID');
assert.equal(isAuthenticatedBotDispatch({ ...acceptedBotSource, actor: { login: 'usdimpact' } }, 'github-actions[bot]'), false,
  'a human-started generator cannot masquerade as the automatic backstop');
assert.equal(isAuthenticatedBotDispatch({ ...acceptedBotSource, event: 'schedule' }, 'github-actions[bot]'), false,
  'native schedule runs must use their separate workflow_run verification path');
assert.equal(isAuthenticatedBotDispatch({ ...acceptedBotSource, path: 'other.yml' }, 'github-actions[bot]'), false);
assert.equal(isAuthenticatedBotDispatch({ ...acceptedBotSource, repository: { full_name: 'someone/else' } }, 'github-actions[bot]'), false);
assert.match(runtime, /isAuthenticatedBotDispatch\(source, process\.env\.GITHUB_ACTOR\)/);
assert.match(runtime, /explicit-publisher-not-dispatched-by-github-bot/);
assert.match(mainDaily, /Publisher run receipt not observed; no retry authorized/);
assert.match(mainDaily, /Multiple new publisher runs; hold for provenance review/);
assert.match(mainDaily, /\.actor\.login == "github-actions\[bot\]"/);
assert.match(mainDaily, /\(\.created_at \| fromdateiso8601\)/);
assert.match(mainDaily, /if \[ "\$GITHUB_ACTOR" != "github-actions\[bot\]" \]/);


// Execute the source workflow's actual publisher-dispatch shell in an offline
// stubbed GitHub environment. No repository write, workflow dispatch or network.
const dispatchStepMatch = mainDaily.match(
  /      - name: Explicitly dispatch trusted bounded publisher after source verification\n[\s\S]*?        run: \|\n([\s\S]*?)(?=\n      - name: Report Daily failure gate)/,
);
assert.ok(dispatchStepMatch, 'publisher handoff shell must exist');
const dispatchShell = dispatchStepMatch[1].split('\n')
  .map((line) => line.startsWith('          ') ? line.slice(10) : line).join('\n');
const parsedDispatch = spawnSync('bash', ['-n'], { input: dispatchShell, encoding: 'utf8' });
assert.equal(parsedDispatch.status, 0, 'publisher dispatch shell syntax must pass bash -n');
const jqAvailable = spawnSync('jq', ['--version'], { encoding: 'utf8' }).status === 0;
if (!jqAvailable && process.env.GITHUB_ACTIONS === 'true') {
  throw new Error('jq required for publisher dispatch mock evidence in GitHub Actions');
}
if (jqAvailable) {
  const createdAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const goodReceipt = {
    event: 'workflow_dispatch', head_branch: 'main',
    actor: { login: 'github-actions[bot]' }, created_at: createdAt,
    html_url: 'https://github.com/usdimpact/usd-impact-site/actions/runs/700001',
  };
  const mockGh = [
    'gh() {',
    '  case "$1" in',
    '    pr) printf "%s\\n" "$MOCK_PR_COUNT" ;;',
    '    workflow) echo "MOCK_DISPATCH" >&2; [ "$MOCK_DISPATCH_FAIL" != "true" ] ;;',
    '    api) printf "%s\\n" "$MOCK_PAYLOAD" ;;',
    '    *) return 59 ;;',
    '  esac',
    '}',
    'sleep() { :; }',
  ].join('\n');
  const fixtures = [
    ['valid single bot receiver', 'github-actions[bot]', '1', false, [goodReceipt], 0, true],
    ['missing original PR', 'github-actions[bot]', '0', false, [goodReceipt], 1, false],
    ['manual source actor', 'usdimpact', '1', false, [goodReceipt], 1, false],
    ['publisher dispatch refused', 'github-actions[bot]', '1', true, [goodReceipt], 1, true],
    ['receiver not created', 'github-actions[bot]', '1', false, [], 1, true],
    ['ambiguous bot receivers', 'github-actions[bot]', '1', false, [goodReceipt, { ...goodReceipt, html_url: 'https://github.com/usdimpact/usd-impact-site/actions/runs/700002' }], 1, true],
    ['human receiver not accepted', 'github-actions[bot]', '1', false, [{ ...goodReceipt, actor: { login: 'usdimpact' } }], 1, true],
    ['old run cannot be mistaken for this request', 'github-actions[bot]', '1', false, [{ ...goodReceipt, created_at: '2026-01-02T09:00:00Z' }], 1, true],
  ];
  for (const [name, actor, count, dispatchFail, runs, expectedExit, wasDispatched] of fixtures) {
    const payload = JSON.stringify({ total_count: runs.length, workflow_runs: runs });
    const test = spawnSync('bash', ['-c', 'set -euo pipefail\n' + mockGh + '\n' + dispatchShell], {
      encoding: 'utf8', timeout: 10000,
      env: {
        ...process.env, GITHUB_REPOSITORY: REPOSITORY, GITHUB_RUN_ID: '770001',
        GITHUB_ACTOR: actor, MOCK_PR_COUNT: count,
        MOCK_DISPATCH_FAIL: dispatchFail ? 'true' : 'false', MOCK_PAYLOAD: payload,
      },
    });
    assert.equal(test.status, expectedExit, name + ': ' + test.stderr);
    assert.equal(test.stderr.includes('MOCK_DISPATCH'), wasDispatched, name + ' actual dispatch receipt');
    if (expectedExit === 0) assert.match(test.stdout, /Publisher workflow_dispatch observed/);
  }
  console.log('Daily publisher dispatch shell: eight mocked positive and negative scenarios passed');
}

console.log('Daily bounded auto-publication policy PASS: fake dates, backstop, exact PR, strict source, check provenance and workflow limits; no network or merge.');
