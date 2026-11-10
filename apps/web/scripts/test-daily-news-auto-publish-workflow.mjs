import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  REPOSITORY, REQUIRED_GENERATOR_STEPS, REQUIRED_CHECKS,
  beforeUsFirstRelease, validateSourceRun, isTrustedBackstop,
  exactDailyPrQuery, selectExactDailyPr, validateDailyContent, requireExactChecks, isSingleGeneratorCommit,
  dispatchSourceRunId, isAuthenticatedBotDispatch, classifyPreMergeReadiness,
  waitForProtectedPrChecks,
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
  run_attempt: 1, triggering_actor: { login: 'github-actions[bot]' },
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
assert.equal(validateSourceRun({ ...run, run_attempt: 2 }, jobs, base, now),
  'source-run-was-replayed', 'a successful human rerun cannot be the unattended source');
assert.equal(validateSourceRun({ ...run, run_attempt: undefined }, jobs, base, now),
  'source-run-was-replayed', 'missing attempt provenance is a HOLD');
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
  conclusion: 'success', status: 'completed', run_attempt: 1, created_at: '2026-11-04T09:32:10Z',
};
assert.equal(isTrustedBackstop([backstop], run), true);
assert.equal(isTrustedBackstop([{ ...backstop, run_attempt: 2 }], run), false,
  'a manually rerun backstop cannot prove natural recovery provenance');
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

const scopedQuery = exactDailyPrQuery(run);
assert.equal(scopedQuery,
  'pulls?state=open&base=main&head=usdimpact%3Aautomation%2Fdaily-usd-impact-2026-11-04-80001&per_page=100');
const scopedFilters = new URLSearchParams(scopedQuery.split('?')[1]);
assert.deepEqual([...scopedFilters.keys()], ['state', 'base', 'head', 'per_page']);
assert.equal(scopedFilters.get('state'), 'open');
assert.equal(scopedFilters.get('base'), 'main');
assert.equal(scopedFilters.get('head'), 'usdimpact:' + branch);
assert.equal(scopedFilters.get('per_page'), '100');
assert.match(runtime, /const pulls = api\(exactDailyPrQuery\(source\)\);/);
assert.doesNotMatch(runtime, /api\('pulls\?state=open&base=main&per_page=100'\)/,
  'the privileged publisher must not reintroduce an unscoped 100-PR listing');
for (const invalidRun of [null, { ...run, id: 0 },
  { ...run, id: '80001' }, { ...run, id: Number.MAX_SAFE_INTEGER + 1 },
  { ...run, created_at: 'invalid' }]) {
  assert.throws(() => exactDailyPrQuery(invalidRun), /invalid-daily-pr-query-source/);
}
// Regress the 2026-11-10 real failure shape: 104 unrelated open base PRs.
// GitHub's exact head filter must leave only the authentic candidate;
// the downstream fail-closed max-100 and identity assertions remain intact.
const heldPrs = Array.from({ length: 104 }, (_, i) => ({
  ...pr, number: 2000 + i, head: { ...pr.head, ref: 'agent/held-' + i },
}));
const headFilteredPrs = [pr, ...heldPrs].filter((item) => item.head.ref === branch);
assert.equal(headFilteredPrs.length, 1);
assert.deepEqual(selectExactDailyPr(headFilteredPrs, run, base),
  { prNumber: 1101, branch, headSha: sha, editionDate: day });
assert.throws(() => selectExactDailyPr([...heldPrs, pr], run, base), /open-pr-evidence-incomplete/,
  'the old unfiltered 105-PR response must still fail closed');
assert.throws(() => selectExactDailyPr([{ ...pr,
  head: { ...pr.head, repo: { full_name: 'other/repo' } } }], run, base), /not-unique/);
assert.throws(() => selectExactDailyPr([{ ...pr,
  title: 'Publish Daily USD Impact — 2026-11-03' }], run, base), /not-unique/);
console.log('Daily exact-head PR query: 104-unrelated-PR and negative integrity fixtures PASS.');

// Native required checks can start after separately dispatched jobs pass.
// A bounded wait is permitted; conflicts, drift and bypasses are not.
const cleanPr = { ...pr, mergeable: true, mergeable_state: 'clean' };
assert.equal(classifyPreMergeReadiness(base, base, cleanPr, sha), 'ready');
assert.equal(classifyPreMergeReadiness(base, base,
  { ...cleanPr, mergeable_state: 'blocked' }, sha), 'pending');
assert.equal(classifyPreMergeReadiness(base, base,
  { ...cleanPr, mergeable: null, mergeable_state: 'unknown' }, sha), 'pending');
assert.equal(classifyPreMergeReadiness(sha, base, cleanPr, sha),
  'pre-merge-main-or-pr-changed', 'main drift must fail immediately');
assert.equal(classifyPreMergeReadiness(base, base,
  { ...cleanPr, head: { ...cleanPr.head, sha: base } }, sha),
  'pre-merge-main-or-pr-changed', 'head drift must fail immediately');
assert.equal(classifyPreMergeReadiness(base, base,
  { ...cleanPr, base: { ...cleanPr.base, sha } }, sha),
  'pre-merge-main-or-pr-changed', 'base drift must fail immediately');
assert.equal(classifyPreMergeReadiness(base, base,
  { ...cleanPr, draft: true }, sha), 'pre-merge-main-or-pr-changed');
assert.equal(classifyPreMergeReadiness(base, base,
  { ...cleanPr, state: 'closed' }, sha), 'pre-merge-main-or-pr-changed');
assert.equal(classifyPreMergeReadiness(base, base,
  { ...cleanPr, mergeable: false, mergeable_state: 'blocked' }, sha),
  'pre-merge-pr-not-clean', 'a known conflict must never wait/merge');
assert.equal(classifyPreMergeReadiness(base, base,
  { ...cleanPr, mergeable_state: 'dirty' }, sha), 'pre-merge-pr-not-clean');
assert.equal(classifyPreMergeReadiness(base, base,
  { ...cleanPr, mergeable_state: 'unstable' }, sha), 'pre-merge-pr-not-clean');
assert.equal(classifyPreMergeReadiness(base, base,
  { ...cleanPr, mergeable_state: 'behind' }, sha), 'pre-merge-pr-not-clean');
assert.equal(classifyPreMergeReadiness(base, base, null, sha), 'pre-merge-main-or-pr-changed');
assert.match(runtime, /async function awaitProtectedMergeReadiness\(mainSha, prNumber, headSha\)/);
assert.match(runtime, /const MAX_POLLS = 60/);
assert.match(runtime, /return waitForProtectedPrChecks\(\{/);
assert.match(runtime, /checkCutoff: ensureMorning/);
assert.match(runtime, /pause: sleep/);
assert.match(runtime, /maxPolls: MAX_POLLS/);
assert.match(runtime, /retryDelayMs: 10000/);
assert.match(runtime, /await awaitProtectedMergeReadiness\(mainSha, prNumber, headSha\);\s*ensureMorning\(\);/);
assert.doesNotMatch(runtime, /gh pr merge --admin|merge_method=force/);


const waitFixture = {
  mainSha: base, prNumber: pr.number, headSha: sha,
  readMain: () => base, readPr: () => cleanPr,
  checkCutoff: () => {}, pause: async () => {}, report: () => {},
  maxPolls: 3, retryDelayMs: 1,
};
assert.equal(await waitForProtectedPrChecks(waitFixture), 1);
{
  let n = 0, deadlines = 0, slept = 0;
  const count = await waitForProtectedPrChecks({
    ...waitFixture,
    readPr: () => ({ ...cleanPr, mergeable_state: n++ === 0 ? 'blocked' : 'clean' }),
    checkCutoff: () => { deadlines++; },
    pause: async (ms) => { assert.equal(ms, 1); slept++; },
  });
  assert.equal(count, 2);
  assert.equal(deadlines, 2);
  assert.equal(slept, 1);
}
{
  let seen = 0, slept = 0;
  await assert.rejects(waitForProtectedPrChecks({
    ...waitFixture,
    readPr: () => ({ ...cleanPr, mergeable_state: 'blocked' }),
    checkCutoff: () => { seen++; },
    pause: async () => { slept++; },
  }), /pre-merge-pr-check-readiness-timeout/);
  assert.equal(seen, 3);
  assert.equal(slept, 2);
}
{
  let seen = 0;
  await assert.rejects(waitForProtectedPrChecks({
    ...waitFixture,
    readPr: () => ({ ...cleanPr, mergeable_state: 'blocked' }),
    checkCutoff: () => { if (++seen === 2) throw Error('after-first-us-release-cutoff'); },
  }), /after-first-us-release-cutoff/);
  assert.equal(seen, 2);
}
await assert.rejects(waitForProtectedPrChecks({
  ...waitFixture, readMain: () => sha,
}), /pre-merge-main-or-pr-changed/);
await assert.rejects(waitForProtectedPrChecks({
  ...waitFixture, readPr: () => ({ ...cleanPr, mergeable: false, mergeable_state: 'blocked' }),
}), /pre-merge-pr-not-clean/);
await assert.rejects(waitForProtectedPrChecks({
  ...waitFixture, readPr: () => { throw Error('github-api-failure'); },
}), /github-api-failure/);
await assert.rejects(waitForProtectedPrChecks({
  ...waitFixture, maxPolls: 61,
}), /invalid-protected-pr-readiness-bounds/);

assert.match(runtime, /const finalMainSha = currentMain\(\);/);
assert.match(runtime, /const finalPr = api\('pulls\/' \+ prNumber\);/);
assert.match(runtime, /const finalDecision = classifyPreMergeReadiness\(finalMainSha, mainSha, finalPr, headSha\);/);
assert.match(runtime, /if \(finalDecision !== 'ready'\) hold\('final-pr-readiness-' \+ finalDecision\);/);
const afterExactChecks = runtime.lastIndexOf('requireExactChecks(requiredCheckSnapshot(headSha), headSha);');
const afterFinalCheck = runtime.indexOf('const finalDecision = classifyPreMergeReadiness(');
const mergeCall = runtime.indexOf("'repos/' + REPOSITORY + '/pulls/' + prNumber + '/merge'");
assert.ok(afterExactChecks >= 0 && afterFinalCheck > afterExactChecks && mergeCall > afterFinalCheck,
  'the immutable main/PR must be revalidated after final exact-head checks and before any merge');
assert.equal(classifyPreMergeReadiness(base, base,
  { ...cleanPr, mergeable_state: 'blocked' }, sha), 'pending',
  'a PR that became blocked after the prior clean read must not pass final guard');
assert.equal(classifyPreMergeReadiness(sha, base, cleanPr, sha), 'pre-merge-main-or-pr-changed',
  'a base change after prior checks must not pass final guard');
console.log('Daily pre-merge last-read protection: ordering and two negatives PASS.');

console.log('Daily bounded protected PR wait: eight offline cases PASS.');

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

// The generator must not spend on the next eligible Daily without a scoped,
// independently owned GitHub App PR-author identity. The default GITHUB_TOKEN
// can push the one-file branch, but cannot author an eligible PR event.
assert.match(mainDaily, /DAILY_PR_APP_CLIENT_ID: \$\{\{ vars\.DAILY_NEWS_PR_APP_CLIENT_ID \}\}/);
assert.match(mainDaily, /DAILY_PR_APP_PRIVATE_KEY: \$\{\{ secrets\.DAILY_NEWS_PR_APP_PRIVATE_KEY \}\}/);
assert.match(mainDaily, /\[ -z "\$DAILY_PR_APP_CLIENT_ID" \] \|\| \[ -z "\$DAILY_PR_APP_PRIVATE_KEY" \]/);
const appAction = mainDaily.match(
  /      - name: Mint short-lived Daily PR-author GitHub App token\n([\s\S]*?)(?=\n      - name: Open and validate publication pull request)/,
);
assert.ok(appAction, 'App token must be minted immediately before the PR author step');
assert.match(appAction[0], /actions\/create-github-app-token@[a-f0-9]{40}/);
// Validate the actual App installation/permissions before any paid request.
// Mint a second fresh PR token only after bounded background generation.
const appPreflight = mainDaily.match(
  /      - name: Verify PR-author App installation before paid news generation\n([\s\S]*?)(?=\n      - uses: actions\/setup-node@)/,
);
assert.ok(appPreflight, 'pre-paid installation-token probe must exist');
assert.match(appPreflight[0], /if: steps\.config\.outputs\.configured == 'true'/);
assert.match(appPreflight[0], /actions\/create-github-app-token@[a-f0-9]{40}/);
assert.match(appPreflight[0], /permission-contents: read/);
assert.match(appPreflight[0], /permission-pull-requests: write/);
assert.doesNotMatch(appPreflight[0], /permission-actions: write|permission-administration: write|skip-token-revoke: true/);
assert.doesNotMatch(appPreflight[0], /^\s+(?:owner|repositories):/m);
assert.equal((mainDaily.match(/actions\/create-github-app-token@[a-f0-9]{40}/g) || []).length, 2);
assert.ok(mainDaily.indexOf('Verify PR-author App installation before paid news generation')
  < mainDaily.indexOf('Start background news generation'),
  'actual installation check must complete before paid source requests');
assert.ok(mainDaily.indexOf('Start background news generation')
  < mainDaily.indexOf('Mint short-lived Daily PR-author GitHub App token'),
  'fresh PR token must be minted after lengthy generation');

assert.match(appAction[0], /permission-contents: read/);
assert.match(appAction[0], /permission-pull-requests: write/);
assert.doesNotMatch(appAction[0], /permission-actions: write|permission-administration: write|skip-token-revoke: true/);
assert.doesNotMatch(appAction[0], /^\s+(?:owner|repositories):/m,
  'omitting owner and repositories scopes token to this repository');
assert.ok(mainDaily.indexOf('      - name: Validate publication content preflight')
  < mainDaily.indexOf('      - name: Mint short-lived Daily PR-author GitHub App token'));
const prAuthor = mainDaily.match(
  /      - name: Open and validate publication pull request\n([\s\S]*?)(?=\n      # GITHUB_TOKEN-dispatched upstream runs)/,
);
assert.ok(prAuthor);
assert.match(prAuthor[0], /DAILY_PR_APP_TOKEN: \$\{\{ steps\.daily_pr_author_token\.outputs\.token \}\}/);
assert.ok(prAuthor[0].includes('if [ -z "$DAILY_PR_APP_TOKEN" ]; then'));
assert.ok(prAuthor[0].includes('GH_TOKEN="$DAILY_PR_APP_TOKEN" gh pr create'),
  'only the App token can create the PR event');
assert.equal((prAuthor[0].match(/gh pr create/g) || []).length, 1);
assert.ok(!prAuthor[0].includes('gh pr create --admin'));
assert.doesNotMatch(mainDaily, /GH_TOKEN: \$\{\{ steps\.daily_pr_author_token\.outputs\.token \}\}/,
  'subsequent CI dispatch and GitHub calls retain the ordinary Actions token');

// Execute the actual pre-spend configuration shell using synthetic credentials.
// No network or paid source generation. Verify missing App identity holds and
// that its private key never appears in logs.
const appConfigStep = mainDaily.match(
  /      - name: Check newsfeed configuration\n[\s\S]*?        run: \|\n([\s\S]*?)(?=\n      # Validate App installation and scoped token permissions)/,
);
assert.ok(appConfigStep, 'pre-spend configuration must be present');
const configShell = appConfigStep[1].split('\n')
  .map((line) => line.startsWith('          ') ? line.slice(10) : line).join('\n');
assert.equal(spawnSync('bash', ['-n'], { input: configShell, encoding: 'utf8' }).status, 0);
const fakeEnv = {
  ...process.env,
  // Assigned per synthetic scenario to a temporary regular file below.
  PUBLICATION_NEEDED: 'true',
  NEWSFEED_ENDPOINT: 'https://invalid.example/daily-news-source',
  NEWSFEED_BEARER_TOKEN: 'synthetic-newsfeed-only',
  DAILY_PR_APP_CLIENT_ID: 'synthetic-app-id',
  DAILY_PR_APP_PRIVATE_KEY: 'SYNTHETIC-PRIVATE-KEY-DO-NOT-USE',
};
// GITHUB_OUTPUT is a writable regular file in GitHub Actions; /dev/stdout
// under node child-process pipes is not always reopenable on Linux.
const appPreflightDir = mkdtempSync(join(tmpdir(), 'usdimpact-daily-app-preflight-'));
try {
  let scenario = 0;
  for (const [label, changes, accepted] of [
    ['complete fictional configuration', {}, true],
    ['missing App ID', { DAILY_PR_APP_CLIENT_ID: '' }, false],
    ['missing App private key', { DAILY_PR_APP_PRIVATE_KEY: '' }, false],
    ['missing newsfeed token', { NEWSFEED_BEARER_TOKEN: '' }, false],
    ['existing Daily article', { PUBLICATION_NEEDED: 'false' }, false],
  ]) {
    const outputFile = join(appPreflightDir, 'output-' + String(++scenario));
    const test = spawnSync('bash', ['-c', 'set -euo pipefail\n' + configShell], {
      encoding: 'utf8', env: { ...fakeEnv, ...changes, GITHUB_OUTPUT: outputFile }, timeout: 10000,
    });
    assert.equal(test.status, 0, label + ': ' + test.stderr);
    assert.match(readFileSync(outputFile, 'utf8'), new RegExp('configured=' + String(accepted)), label);
    assert.doesNotMatch(test.stdout + test.stderr, /SYNTHETIC-PRIVATE-KEY-DO-NOT-USE/,
      'never print a private key');
  }
} finally {
  rmSync(appPreflightDir, { recursive: true, force: true });
}
console.log('Daily PR GitHub App authorship: fixed SHA, scoped token, no-spend and 5 negative/positive configuration fixtures PASS');

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
assert.match(auto, /run-name:.*inputs\.source_run_id/);
assert.match(mainDaily, /\.display_title == \$expected_title/);
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
assert.equal(isAuthenticatedBotDispatch({ ...acceptedBotSource, run_attempt: 2 }, 'github-actions[bot]'), false,
  'bot-original source rerun must not authorize publication');
assert.equal(isAuthenticatedBotDispatch({
  ...acceptedBotSource, triggering_actor: { login: 'usdimpact' },
}, 'github-actions[bot]'), false,
  'original bot actor and a human triggering_actor are different');
assert.equal(isAuthenticatedBotDispatch(acceptedBotSource, 'usdimpact'), false,
  'a manually dispatched publisher must not accept a copied source run ID');
assert.equal(isAuthenticatedBotDispatch({ ...acceptedBotSource, actor: { login: 'usdimpact' } }, 'github-actions[bot]'), false,
  'a human-started generator cannot masquerade as the automatic backstop');
assert.equal(isAuthenticatedBotDispatch({ ...acceptedBotSource, event: 'schedule' }, 'github-actions[bot]'), false,
  'native schedule runs must use their separate workflow_run verification path');
assert.equal(isAuthenticatedBotDispatch({ ...acceptedBotSource, path: 'other.yml' }, 'github-actions[bot]'), false);
assert.equal(isAuthenticatedBotDispatch({ ...acceptedBotSource, repository: { full_name: 'someone/else' } }, 'github-actions[bot]'), false);
assert.match(runtime, /isAuthenticatedBotDispatch\(source, process\.env\.GITHUB_ACTOR\)/);
assert.match(runtime, /explicit-publisher-not-first-attempt-bot-trigger/);
assert.match(runtime, /PUBLISH_TRIGGERING_ACTOR !== 'github-actions\[bot\]'/);
assert.match(runtime, /PUBLISH_RUN_ATTEMPT !== '1'/);
assert.match(auto, /PUBLISH_TRIGGERING_ACTOR: \$\{\{ github\.triggering_actor \}\}/);
assert.match(mainDaily, /SOURCE_TRIGGERING_ACTOR: \$\{\{ github\.triggering_actor \}\}/);
assert.match(mainDaily, /SOURCE_RUN_ATTEMPT: \$\{\{ github\.run_attempt \}\}/);
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
  const expectedTitle = 'Daily USD Impact bounded auto-publication source 770001';
  const goodReceipt = {
    event: 'workflow_dispatch', head_branch: 'main',
    actor: { login: 'github-actions[bot]' }, created_at: createdAt,
    display_title: expectedTitle,
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
    ['bot source rerun by original bot denied', 'github-actions[bot]', '1', false, [goodReceipt], 1, false,
      { SOURCE_RUN_ATTEMPT: '2' }],
    ['bot source rerun by human denied', 'github-actions[bot]', '1', false, [goodReceipt], 1, false,
      { SOURCE_TRIGGERING_ACTOR: 'usdimpact', SOURCE_RUN_ATTEMPT: '2' }],
    ['human replay with original bot privilege denied', 'github-actions[bot]', '1', false, [goodReceipt], 1, false,
      { SOURCE_TRIGGERING_ACTOR: 'usdimpact' }],
    ['publisher dispatch refused', 'github-actions[bot]', '1', true, [goodReceipt], 1, true],
    ['receiver not created', 'github-actions[bot]', '1', false, [], 1, true],
    ['ambiguous bot receivers same source ID', 'github-actions[bot]', '1', false, [goodReceipt, { ...goodReceipt, html_url: 'https://github.com/usdimpact/usd-impact-site/actions/runs/700002' }], 1, true],
    ['other bot source ID ignored', 'github-actions[bot]', '1', false, [goodReceipt, { ...goodReceipt, display_title: 'Daily USD Impact bounded auto-publication source 880002', html_url: 'https://github.com/usdimpact/usd-impact-site/actions/runs/700003' }], 0, true],
    ['only wrong source ID does not authorize', 'github-actions[bot]', '1', false, [{ ...goodReceipt, display_title: 'Daily USD Impact bounded auto-publication source 880002' }], 1, true],
    ['missing display title does not authorize', 'github-actions[bot]', '1', false, [{ ...goodReceipt, display_title: undefined }], 1, true],
    ['human receiver not accepted', 'github-actions[bot]', '1', false, [{ ...goodReceipt, actor: { login: 'usdimpact' } }], 1, true],
    ['old run cannot be mistaken for this request', 'github-actions[bot]', '1', false, [{ ...goodReceipt, created_at: '2026-01-02T09:00:00Z' }], 1, true],
  ];
  for (const [name, actor, count, dispatchFail, runs, expectedExit, wasDispatched, overrides = {}] of fixtures) {
    const payload = JSON.stringify({ total_count: runs.length, workflow_runs: runs });
    const test = spawnSync('bash', ['-c', 'set -euo pipefail\n' + mockGh + '\n' + dispatchShell], {
      encoding: 'utf8', timeout: 10000,
      env: {
        ...process.env, GITHUB_REPOSITORY: REPOSITORY, GITHUB_RUN_ID: '770001',
        GITHUB_ACTOR: actor, SOURCE_TRIGGERING_ACTOR: 'github-actions[bot]',
        SOURCE_RUN_ATTEMPT: '1', MOCK_PR_COUNT: count,
        MOCK_DISPATCH_FAIL: dispatchFail ? 'true' : 'false', MOCK_PAYLOAD: payload,
        ...overrides,
      },
    });
    assert.equal(test.status, expectedExit, name + ': ' + test.stderr);
    assert.equal(test.stderr.includes('MOCK_DISPATCH'), wasDispatched, name + ' actual dispatch receipt');
    if (expectedExit === 0) assert.match(test.stdout, /Publisher workflow_dispatch observed/);
  }
  console.log('Daily publisher dispatch shell: fourteen mocked positive and negative scenarios passed');
}

console.log('Daily bounded auto-publication policy PASS: fake dates, backstop, exact PR, strict source, check provenance and workflow limits; no network or merge.');
