import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const workflow = readFileSync(new URL('../../../.github/workflows/daily-news-health.yml', import.meta.url), 'utf8');

// Execute only the guard body with mock GitHub evidence and no network.
const closeSection = workflow.split('      - name: Close recovered daily health issue\n')[1];
assert.ok(closeSection, 'the Close issue step must exist');
const match = closeSection.match(
  /          if \[ -n "\$issue_number" \]; then\n([\s\S]*?)(?=\n            \{\n              echo "## Recovery confirmed")/,
);
assert.ok(match, 'auto-closure guard must precede any closure receipt');
const body = match[1].split('\n')
  .map((line) => line.startsWith('            ') ? line.slice(12) : line)
  .join('\n');
assert.match(body, /merged_by\.login == "github-actions\[bot\]"/);
assert.match(body, /daily-news-auto-publish\.yml\/runs/);
assert.match(body, /\.head\.ref == \$branch/);
assert.match(body, /length == 1 and \.\[0\]\.filename == \$expected/);
assert.match(body, /VERIFIED_SOURCE_RUN_ID/);
const mockGh = [
  'gh() {',
  '  [ "$1" = "api" ] || return 1',
  '  case "$2" in',
  '    *"/pulls?state=closed&base=main"*) printf "%s\\n" "$MOCK_PRS" ;;',
  '    *"/pulls/1101/files?per_page=100") printf "%s\\n" "$MOCK_FILES" ;;',
  '    *"/pulls/1101") printf "%s\\n" "$MOCK_PR_DETAIL" ;;',
  '    *"/actions/workflows/daily-news-auto-publish.yml/runs"*) printf "%s\\n" "$MOCK_RUNS" ;;',
  '    *) return 55 ;;',
  '  esac',
  '}',
].join('\n');
const edition = '2026-11-04';
const id = '700001';
const branch = 'automation/daily-usd-impact-' + edition + '-' + id;
const title = 'Publish Daily USD Impact — ' + edition;
const file = 'apps/web/src/content/news/' + edition + '.md';
const goodPr = {
  number: 1101, merged: true, merged_at: '2026-11-04T10:14:00Z',
  merge_commit_sha: 'a'.repeat(40), merged_by: { login: 'github-actions[bot]' },
  head: { ref: branch }, base: { ref: 'main' }, title,
};
const goodRuns = { total_count: 1, workflow_runs: [{
  path: '.github/workflows/daily-news-auto-publish.yml',
  event: 'workflow_run', head_branch: 'main',
  status: 'completed', conclusion: 'success',
  created_at: '2026-11-04T10:11:00Z',
}] };
const good = {
  prs: [goodPr], detail: goodPr,
  files: [{ filename: file, status: 'added' }], runs: goodRuns,
};
const cases = [
  ['automatic exact source PR and live-controller evidence', good, true],
  ['manual merge is not automatic',
    { ...good, detail: { ...goodPr, merged_by: { login: 'usdimpact' } } }, false],
  ['failed controller cannot authorize closing',
    { ...good, runs: { ...goodRuns, workflow_runs: [{ ...goodRuns.workflow_runs[0], conclusion: 'failure' }] } }, false],
  ['source run id mismatch cannot close',
    { ...good, prs: [{ ...goodPr, head: { ref: branch + '-other' } }] }, false],
  ['duplicate closed PR evidence cannot close',
    { ...good, prs: [goodPr, goodPr] }, false],
  ['missing automation run cannot close',
    { ...good, runs: { total_count: 0, workflow_runs: [] } }, false],
  ['unmatched event date cannot close',
    { ...good, runs: { total_count: 1, workflow_runs: [{ ...goodRuns.workflow_runs[0], created_at: '2026-11-03T10:11:00Z' }] } }, false],
  ['extra changed file cannot close',
    { ...good, files: [...good.files, { filename: '.github/workflows/other.yml', status: 'modified' }] }, false],
  ['incomplete workflow run collection cannot close',
    { ...good, runs: { total_count: 2, workflow_runs: goodRuns.workflow_runs } }, false],
  ['GitHub API malformed response leaves issue open',
    { ...good, prs: null }, false],
];
const jqProbe = spawnSync('jq', ['--version'], { encoding: 'utf8', timeout: 2000 });
// The Health workflow itself executes on Ubuntu GitHub Actions (which supplies
// jq); Vercel's separate site-build image does not have to include jq.
// Keep structural assertions in every environment and require all 10 executable
// tests on the real GitHub Actions validation runner.
if (jqProbe.status !== 0 && process.env.GITHUB_ACTIONS === 'true') {
  throw new Error('jq is required to execute auto-closure evidence tests on GitHub Actions');
}
if (jqProbe.status !== 0) {
  console.log('Daily auto-closure: static guard assertions pass; jq-dependent offline fixtures run in GitHub Actions, not this site builder.');
} else {
for (const [name, fixture, shouldClose] of cases) {
  const script = 'set -euo pipefail\n' + mockGh + '\n' + body + '\necho CLOSE_ELIGIBLE\n';
  const run = spawnSync('bash', ['-c', script], {
    encoding: 'utf8', timeout: 5000,
    env: {
      ...process.env, GITHUB_REPOSITORY: 'usdimpact/usd-impact-site',
      VERIFIED_SOURCE_RUN_ID: id, VERIFIED_EDITION_DATE: edition,
      MOCK_PRS: fixture.prs === null ? '' : JSON.stringify(fixture.prs),
      MOCK_PR_DETAIL: JSON.stringify(fixture.detail),
      MOCK_FILES: JSON.stringify(fixture.files),
      MOCK_RUNS: JSON.stringify(fixture.runs),
    },
  });
  assert.equal(run.status, 0, name + ': shell must fail closed without error: ' + run.stderr);
  assert.equal(run.stdout.includes('CLOSE_ELIGIBLE'), shouldClose, name + ': ' + run.stdout);
}
console.log('Daily auto-closure evidence: 10 offline positive/negative cases passed');
}
