import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(
  new URL('../../../.github/workflows/daily-news-health.yml', import.meta.url),
  'utf8',
);

assert.match(
  workflow,
  /cron: '45 18 \* \* 1-5'/,
  'Health must run after the primary and bounded backstop observation windows',
);
assert.match(
  workflow,
  /MAX_AGE_HOURS: '12'/,
  'the late Health sentinel must accept a normal 09:17 UTC run from the same edition day',
);

assert.match(
  workflow,
  /--json databaseId,status,conclusion,createdAt,updatedAt,url,event/,
  'health checks must request the workflow update timestamp',
);
assert.match(
  workflow,
  /expected_date="\$\{created_at:0:10\}"/,
  'the scheduled run date must remain the expected edition date',
);
assert.match(
  workflow,
  /updated_at="\$\(jq -r '\.\[0\]\.updatedAt \/\/ \.\[0\]\.createdAt'/,
  'freshness must use the latest run update with a created-time fallback',
);
assert.match(
  workflow,
  /updated_epoch="\$\(date -u -d "\$updated_at" \+%s\)"[\s\S]*age_seconds="\$\(\(now_epoch - updated_epoch\)\)"/,
  'recovered retries must be aged from their latest update',
);
assert.doesNotMatch(
  workflow,
  /(?:^|\n)\s+age_seconds="\$\(\(now_epoch - created_epoch\)\)"/,
  'freshness must not remain pinned to the original failed attempt start',
);
assert.match(
  workflow,
  /created_epoch="\$\(date -u -d "\$created_at" \+%s\)"[\s\S]*active_age_seconds="\$\(\(now_epoch - created_epoch\)\)"/,
  'active-run allowance must be measured from the actual run start',
);
assert.match(
  workflow,
  /MAX_ACTIVE_MINUTES: '130'[\s\S]*generation_pending[\s\S]*state=pending[\s\S]*exit 0[\s\S]*remained active beyond/,
  'a recent active Daily run must remain pending while a stale active run fails',
);
assert.match(
  workflow,
  /actions\/runs\/\$run_id\/jobs\?per_page=100/,
  'health reporting must inspect the failed workflow steps',
);
assert.match(
  workflow,
  /usd-impact-daily-failure-stage/,
  'health reports must include the bounded failure-stage marker',
);
assert.match(
  workflow,
  /'Validate and build'\) failure_stage='validation'/,
  'site validation and build failures must be classified separately',
);
assert.match(
  workflow,
  /'Import as published content'\) failure_stage='import'/,
  'import failures must be classified separately',
);
assert.match(
  workflow,
  /'Open and validate publication pull request'\) failure_stage='publication'/,
  'publication failures must be classified separately',
);

assert.match(
  workflow,
  /if \[ "\$conclusion" != "success" \] && \[ "\$failure_stage" = "publication" \]/,
  'only publication-stage raw failures may enter reviewed-recovery evaluation',
);
assert.match(
  workflow,
  /expected_title="Publish Daily USD Impact — \$expected_date"/,
  'reviewed recovery must require the exact scheduled edition PR title',
);
assert.match(
  workflow,
  /expected_head_prefix="automation\/daily-usd-impact-\$expected_date-"/,
  'reviewed recovery must require a scheduled Daily automation branch',
);
assert.match(
  workflow,
  /pulls\?state=closed&base=main&sort=updated&direction=desc&per_page=100/,
  'reviewed recovery must be sourced from merged PR evidence on main',
);
assert.match(
  workflow,
  /\.merged_at != null[\s\S]*\.title == \$title[\s\S]*startswith\(\$prefix\)/,
  'reviewed recovery must require a merged exact-title PR from the expected branch family',
);
assert.match(
  workflow,
  /recovery_merged_epoch" -gt "\$updated_epoch"/,
  'the recovery merge must occur after the failed scheduled run completed',
);
assert.match(
  workflow,
  /recovery_file_count" -eq 1[\s\S]*recovery_file" = "\$expected_file"/,
  'reviewed recovery must contain only the expected Daily edition file',
);
assert.match(
  workflow,
  /operational_conclusion='recovered_after_review'/,
  'a bounded reviewed publication recovery must be explicit in Health evidence',
);
assert.match(
  workflow,
  /if \[ "\$operational_conclusion" != "success" \][\s\\\n]*&& \[ "\$operational_conclusion" != "recovered_after_review" \]/,
  'unrecovered failures must remain fatal',
);
assert.match(
  workflow,
  /check-daily-news-deployment-health\.mjs[\s\S]*--expected-date "\$expected_date"[\s\S]*--base-url "https:\/\/www\.usd-impact\.com"/,
  'reviewed recovery must still pass the strict deployed date/page/RSS checks',
);
assert.match(
  workflow,
  /if ! gh api "repos\/\$GITHUB_REPOSITORY\/contents\/\$expected_file\?ref=main"[\s\S]*--state open[\s\S]*awaiting_editorial_review[\s\S]*state=pending/,
  'an exact open Daily publication PR must be reported as protected editorial review pending',
);
assert.match(
  workflow,
  /echo "state=healthy" >> "\$GITHUB_OUTPUT"[\s\S]*if: steps\.health\.outcome == 'success' && steps\.health\.outputs\.state == 'healthy'/,
  'only proven deployed health may close an existing Daily health issue',
);
assert.match(
  workflow,
  /pull-requests: read/,
  'Health must have only the read permission needed to verify reviewed recovery PRs',
);

assert.match(
  workflow,
  /ISSUE_TITLE: P1 — Daily USD Impact automation requires attention/,
  'the operational health issue must remain a Daily-specific P1',
);
assert.match(
  workflow,
  /gh issue view 184[\s\S]*gh issue comment 184/,
  'while hardening is open, health evidence must be appended without overwriting its specification',
);
assert.match(
  workflow,
  /gh issue edit "\$issue_number"[\s\S]*--body-file daily-health-report\.md/,
  'a later operational issue must keep its current failure marker in the body',
);

const healthStep = workflow.match(
  /      - name: Inspect latest daily workflow run\n[\s\S]*?        run: \|\n([\s\S]*?)(?=\n      - name: Open or update daily health issue)/,
);
assert.ok(healthStep, 'Daily Health inspection shell must be present');
const healthShell = healthStep[1]
  .split('\n')
  .map((line) => (line.startsWith('          ') ? line.slice(10) : line))
  .join('\n');
const syntaxCheck = spawnSync('bash', ['-n'], {
  input: healthShell,
  encoding: 'utf8',
});
assert.equal(
  syntaxCheck.status,
  0,
  `Daily Health shell must parse with bash -n:\n${syntaxCheck.stderr}`,
);

console.log('daily news health workflow tests pass');
