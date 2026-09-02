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
  /- name: Check existing Daily publication state[\s\S]*id: preflight/,
  'every Daily run must preflight the current UTC publication state before generation',
);
assert.match(
  workflow,
  /expected_file="apps\/web\/src\/content\/news\/\$today\.md"[\s\S]*contents\/\$expected_file\?ref=main/,
  'the publication preflight must stop when the current UTC edition already exists on main',
);
assert.match(
  workflow,
  /existing_pr="\$\(gh pr list[\s\S]*--state all[\s\S]*expected_head_prefix/,
  'the publication preflight must respect any exact current-day Daily PR state',
);
assert.match(
  workflow,
  /needed=false[\s\S]*reason=published[\s\S]*needed=false[\s\S]*reason=publication-pr-exists[\s\S]*needed=true[\s\S]*reason=missing/,
  'the publication preflight must expose deterministic skip or generate decisions',
);
assert.match(
  workflow,
  /PUBLICATION_NEEDED: \$\{\{ steps\.preflight\.outputs\.needed \}\}/,
  'newsfeed configuration must consume the publication preflight decision',
);
assert.match(
  workflow,
  /if \[ "\$PUBLICATION_NEEDED" != "true" \]; then[\s\S]*configured=false[\s\S]*downstream publication steps are skipped/,
  'an existing publication artifact must skip generation without reporting a failure',
);
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

const preflightStep = workflow.match(
  /      - name: Check existing Daily publication state\n[\s\S]*?        run: \|\n([\s\S]*?)(?=\n      - name: Check newsfeed configuration)/,
);
assert.ok(preflightStep, 'cross-run Daily publication preflight shell must be present');

const pollStep = workflow.match(
  /      - name: Poll background news generation\n[\s\S]*?        run: \|\n([\s\S]*?)(?=\n      - name: Import as published content)/,
);
assert.ok(pollStep, 'background polling shell must be present');
assert.match(
  workflow,
  /build-and-publish:[\s\S]*timeout-minutes: 120/,
  'the Daily job must leave enough time for both bounded 40-minute generation leases and validation',
);
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
  /poll_payload="\$RUNNER_TEMP\/daily-usd-impact-poll\.json"[\s\S]*rm -f "\$poll_payload"[\s\S]*curl_exit=0[\s\S]*\)" \|\| curl_exit=\$\?/,
  'the polling request must capture curl transport failures without set -e aborting the workflow',
);
assert.ok(
  (pollStep[1].match(/rm -f "\$poll_payload"/g) || []).length >= 2,
  'partial or stale poll payloads must be removed before requests and after transport failures',
);
assert.match(
  pollStep[1],
  /case "\$curl_exit" in[\s\S]*5\|6\|7\|18\|28\|35\|52\|55\|56\|92\)[\s\S]*retrying the same response[\s\S]*continue/,
  'reviewed transient curl failures, including connection reset code 35, must retry the same background response',
);
assert.match(
  pollStep[1],
  /poll-transport-error[\s\S]*non-retryable curl exit/,
  'non-retryable transport failures must remain fail-closed with bounded diagnostic detail',
);
assert.match(
  pollStep[1],
  /poll-transport-retries-exhausted/,
  'exhausted bounded transport retries must leave a safe failure payload for issue reporting',
);
assert.match(
  pollStep[1],
  /max_active_seconds=2400[\s\S]*regeneration_used=false[\s\S]*while true/,
  'each actual background response must receive a 40-minute active polling lease',
);
assert.match(
  pollStep[1],
  /if \[ "\$status" != "queued" \] && \[ "\$status" != "in_progress" \]; then[\s\S]*saw_active_response=true[\s\S]*continue/,
  'queued and in-progress responses must remain nonterminal and continue polling',
);
assert.match(
  pollStep[1],
  /if \[ "\$regeneration_used" = "false" \] && node scripts\/daily-news-retry-policy\.mjs[\s\S]*regeneration_used=true[\s\S]*generation_attempt=2/,
  'the workflow must permit exactly one full regeneration only after the reviewed retry policy accepts a terminal payload',
);
assert.match(
  pollStep[1],
  /poll-active-timeout[\s\S]*No regeneration was started because the response never reached a retryable terminal state/,
  'an active-response timeout must fail accurately without pretending that regeneration occurred',
);
assert.doesNotMatch(
  pollStep[1],
  /for generation_attempt in 1 2/,
  'fixed poll-loop exhaustion must not advance a synthetic generation attempt',
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
assert.match(
  backstop,
  /cron: '47 15 \* \* 1-5'/,
  'the backstop must have a second delayed-schedule observation without expanding the recovery budget',
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
  /gh pr list[\s\S]*--state all[\s\S]*expected_head_prefix/,
  'the backstop must respect any exact current-day publication PR, including a human-closed PR',
);
assert.match(
  backstop,
  /actions\/workflows\/daily-news\.yml\/runs\?per_page=30/,
  'the backstop must inspect current-day Daily runs before dispatching recovery',
);
assert.match(
  backstop,
  /active_count[\s\S]*success_count[\s\S]*failed_count[\s\S]*gh workflow run daily-news\.yml --repo "\$GITHUB_REPOSITORY" --ref main/,
  'the backstop must record earlier outcomes and dispatch only when no current-day Daily run is active and no publication artifact exists',
);
assert.match(
  backstop,
  /recovery_dispatch_count=.*\.event == "workflow_dispatch"[\s\S]*if \[ "\$recovery_dispatch_count" -gt 0 \]; then[\s\S]*one-recovery budget is exhausted[\s\S]*exit 0[\s\S]*gh workflow run daily-news\.yml/,
  'multiple backstop observations must still permit at most one Daily recovery dispatch per UTC edition',
);
assert.doesNotMatch(
  backstop,
  /if \[ "\$success_count" -gt 0 \]/,
  'a false-green Daily run without a publication artifact must not suppress the bounded recovery dispatch',
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
  ['publication preflight', preflightStep[1]],
  ['background polling', pollStep[1]],
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
