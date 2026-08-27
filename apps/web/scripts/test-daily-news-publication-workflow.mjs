import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(
  new URL('../../../.github/workflows/daily-news.yml', import.meta.url),
  'utf8',
);
const backstop = await readFile(
  new URL('../../../.github/workflows/daily-news-schedule-backstop.yml', import.meta.url),
  'utf8',
);

assert.match(workflow, /permissions:[\s\S]*issues: write/, 'failure reporting needs issue-write permission');
assert.match(
  workflow,
  /existing_pr_url="\$\(gh pr list[\s\S]*--state open[\s\S]*--head "\$branch"/,
  'bounded reruns must look for an existing publication pull request',
);
assert.match(
  workflow,
  /if \[ -n "\$existing_pr_url" \]; then[\s\S]*gh pr view "\$pr_url" --json headRefOid[\s\S]*else[\s\S]*git push --set-upstream origin "\$branch"/,
  'bounded reruns must reuse the immutable existing PR head instead of overwriting it',
);
assert.doesNotMatch(
  workflow,
  /gh pr merge/,
  'publication must not merge unreviewed content',
);
assert.match(
  workflow,
  /passed Web quality and is ready for protected editorial review and merge/,
  'publication must clearly report the protected editorial review handoff',
);
assert.match(
  workflow,
  /stops for protected human editorial review and merge/,
  'publication PR copy must not imply that Web quality alone causes a merge',
);
assert.match(
  workflow,
  /run_conclusion="\$\(gh run view "\$run_id" --json conclusion --jq '\.conclusion \/\/ empty'\)"[\s\S]*if \[ "\$run_conclusion" != "success" \]; then[\s\S]*exit 1/,
  'publication must reject action_required and every other non-success workflow conclusion',
);
assert.match(
  workflow,
  /printf '%s\\n\\n%s\\n\\n%s\\n'/,
  'publication pull-request copy must use the shell-safe printf writer',
);
assert.doesNotMatch(
  workflow,
  /<<-?\s*['"]?EOF/,
  'publication workflow must not use an indentation-sensitive here-document',
);

const pollStep = workflow.match(
  /      - name: Poll background news generation\n[\s\S]*?        run: \|\n([\s\S]*?)(?=\n      - name: Import as published content)/,
);
assert.ok(pollStep, 'background polling shell must be present');
const pollRequest = pollStep[1].match(
  /http_code="\$\(curl[\s\S]*?--write-out '%\{http_code\}'\)"/,
);
assert.ok(pollRequest, 'background polling request must be present');
assert.match(
  pollRequest[0],
  /--max-time 240/,
  'a completed response must have enough time for the bounded multi-pass repair budget',
);
assert.doesNotMatch(
  pollRequest[0],
  /--max-time 60/,
  'background polling must not terminate a valid bounded repair at 60 seconds',
);
assert.match(
  pollStep[1],
  /for generation_attempt in 1 2/,
  'the workflow must permit only the initial generation and one bounded full regeneration',
);
assert.match(
  pollStep[1],
  /daily-news-retry-policy\.mjs/,
  'the bounded regeneration decision must use the reviewed retry policy',
);

const handoffStep = workflow.match(
  /      - name: Open and validate publication pull request\n[\s\S]*?        run: \|\n([\s\S]*?)(?=\n      - name: Report Daily failure gate)/,
);
assert.ok(handoffStep, 'publication handoff shell must be present');

const failureStep = workflow.match(
  /      - name: Report Daily failure gate\n[\s\S]*?        run: \|\n([\s\S]*)$/,
);
assert.ok(failureStep, 'stage-aware failure reporting shell must be present');
assert.match(workflow, /id: start/);
assert.match(workflow, /id: poll/);
assert.match(workflow, /id: import_content/);
assert.match(workflow, /id: validate_build/);
assert.match(workflow, /id: publish_pr/);
assert.match(failureStep[1], /daily-news-failure-stage\.mjs/);
assert.match(failureStep[1], /usd-impact-daily-failure-stage/);
assert.match(failureStep[1], /Failure stage:/);
assert.match(failureStep[1], /Failing gate:/);
assert.match(failureStep[1], /gh issue comment 184/);
assert.match(failureStep[1], /gh issue create/);

assert.match(
  backstop,
  /cron: '17 12 \* \* 1-5'/,
  'the backstop must run after the primary 09:17 UTC Daily schedule',
);
assert.match(backstop, /actions: write/, 'the backstop needs only Actions write permission to dispatch recovery');
assert.match(backstop, /contents: read/, 'the backstop must keep repository contents read-only');
assert.match(backstop, /pull-requests: read/, 'the backstop must inspect review state without writing PRs');
assert.match(
  backstop,
  /expected_file="apps\/web\/src\/content\/news\/\$today\.md"/,
  'the backstop must bind recovery to the current UTC Daily file',
);
assert.match(
  backstop,
  /contents\/\$expected_file\?ref=main/,
  'the backstop must stop when the current edition is already on main',
);
assert.match(
  backstop,
  /gh pr list[\s\S]*--state open[\s\S]*expected_head_prefix/,
  'the backstop must stop when the current edition is already in editorial review',
);
assert.match(
  backstop,
  /actions\/workflows\/daily-news\.yml\/runs\?per_page=30/,
  'the backstop must inspect current-day Daily runs before dispatching recovery',
);
assert.match(
  backstop,
  /active_count[\s\S]*success_count[\s\S]*gh workflow run daily-news\.yml --repo "\$GITHUB_REPOSITORY" --ref main/,
  'the backstop must dispatch only when no current-day Daily run is active or successful',
);
assert.doesNotMatch(backstop, /contents: write/, 'the backstop must not be able to write publication content');
assert.doesNotMatch(backstop, /gh pr merge/, 'the backstop must never merge editorial content');

function shellFromWorkflowBlock(block) {
  return block
    .split('\n')
    .map((line) => (line.startsWith('          ') ? line.slice(10) : line))
    .join('\n');
}

const backstopStep = backstop.match(
  /      - name: Check whether Daily recovery is needed\n[\s\S]*?        run: \|\n([\s\S]*)$/,
);
assert.ok(backstopStep, 'schedule backstop shell must be present');

for (const [label, block] of [
  ['publication handoff', handoffStep[1]],
  ['failure reporting', failureStep[1]],
  ['schedule backstop', backstopStep[1]],
]) {
  const syntaxCheck = spawnSync('bash', ['-n'], {
    input: shellFromWorkflowBlock(block),
    encoding: 'utf8',
  });
  assert.equal(
    syntaxCheck.status,
    0,
    `${label} shell must parse with bash -n:\n${syntaxCheck.stderr}`,
  );
}

console.log('daily news publication workflow tests pass');
