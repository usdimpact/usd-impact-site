import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
  /latest_run_json="\$\(gh run list[\s\S]*?--branch main[\s\S]*?--limit 1[\s\S]*?--json databaseId,status,conclusion,createdAt,updatedAt,url,event\)"/,
  'the latest any-event run must remain available to detect newer fallback failures',
);
assert.match(
  workflow,
  /run_json="\$\(gh run list[\s\S]*?--branch main[\s\S]*?--event schedule[\s\S]*?--limit 1[\s\S]*?--json databaseId,status,conclusion,createdAt,updatedAt,url,event\)"/,
  'native recovery must select a schedule-event run even when an external wake came later',
);
assert.match(
  workflow,
  /No native scheduled Daily USD Impact workflow run was found\./,
  'missing native schedule evidence must remain a failure rather than becoming healthy',
);
assert.match(
  workflow,
  /latest_created_epoch" -gt "\$created_epoch"[\s\S]*newer_fallback_pending[\s\S]*latest_conclusion" != "success"[\s\S]*exit 1/,
  'a newer failed or pending fallback must never be ignored when certifying the native schedule',
);
assert.match(
  workflow,
  /Newer non-scheduled run succeeded; assessing the independently identified native schedule below\./,
  'a successful newer fallback must not hide the earlier natural schedule',
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
  /'Validate publication content preflight'\) failure_stage='validation'/,
  'publication preflight failures must be classified separately',
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
  /echo "state=healthy" >> "\$GITHUB_OUTPUT"[\s\S]*if: steps\.health\.outcome == 'success' && steps\.health\.outputs\.state == 'healthy' && github\.event_name == 'schedule' && vars\.DAILY_NEWS_INCIDENT_AUTOCLOSE_APPROVED == 'true'/,
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

assert.match(
  workflow,
  /if \[ "\$event" != "schedule" \]; then[\s\S]*non_scheduled_handoff[\s\S]*state=pending[\s\S]*exit 0/,
  'a manually dispatched Daily run must not close the scheduled recovery incident',
);
assert.match(
  workflow,
  /if \[ "\$operational_conclusion" = "success" \]; then[\s\S]*required_steps=\([\s\S]*Start background news generation[\s\S]*Poll background news generation[\s\S]*Import as published content[\s\S]*Validate publication content preflight[\s\S]*Open and validate publication pull request/,
  'every successful scheduled Daily claim must require all real generation/validation/handoff stages',
);
assert.match(
  workflow,
  /for step_name in "\$\{required_steps\[@\]\}"; do[\s\S]*select\(\.name == \$name\)[\s\S]*if \[ "\$step_conclusion" != "success" \]; then[\s\S]*scheduled_generation_not_proven[\s\S]*state=pending/,
  'missing or skipped generator job steps must fail closed as PENDING, not healthy',
);
assert.match(
  workflow,
  /HEALTH_WORKFLOW_EVENT: \$\{\{ github\.event_name \}\}/,
  'Health inspection must receive the actual event trigger, not infer it from Daily provenance',
);
assert.match(
  workflow,
  /check-daily-news-deployment-health\.mjs[\s\S]*if \[ "\$HEALTH_WORKFLOW_EVENT" != "schedule" \]; then[\s\S]*health_workflow_not_scheduled[\s\S]*state=pending[\s\S]*exit 0[\s\S]*echo "- Result: healthy\."/,
  'a manually dispatched Health run must stay pending even if all Daily and deployment checks pass',
);
assert.match(
  workflow,
  /- name: Close recovered daily health issue\n(?:\s*#.*\n)*\s*if: steps\.health\.outcome == 'success' && steps\.health\.outputs\.state == 'healthy' && github\.event_name == 'schedule' && vars\.DAILY_NEWS_INCIDENT_AUTOCLOSE_APPROVED == 'true'/,
  'issue closure must independently require the natural Health schedule event',
);

assert.ok(
  !workflow.includes('DAILY_NEWS_INCIDENT_AUTOCLOSE_APPROVED: true'),
  'incident closure approval must not be hardcoded inside the workflow',
);
assert.match(
  workflow,
  /vars\.DAILY_NEWS_INCIDENT_AUTOCLOSE_APPROVED == 'true'/,
  'incident auto-closure must remain disabled without a separate owner activation',
);
assert.ok(
  (workflow.match(/echo "state=healthy" >> "\$GITHUB_OUTPUT"/g) || []).length === 1,
  'Health must have only one healthy emission downstream from provenance checks',
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

// Execute the real Health shell's selection and fallback-safety preamble in
// isolation with synthetic GitHub run JSON. This complements pattern checks:
// no GitHub API, model call, schedule dispatch or Production request is made.
const earlyExitMarker = 'if [ "$status" = "completed" ] && [ "$conclusion" != "success" ]; then';
const boundary = healthShell.indexOf(earlyExitMarker);
assert.ok(boundary > 0, 'the native/fallback guard preamble must be extractable');
const selectionOnlyShell = [
  healthShell.slice(0, boundary),
  'printf "SELECTED_RUN_ID=%s\\n" "$run_id"',
].join('\n');

const mockDir = await mkdtemp(join(tmpdir(), 'usd-daily-health-events-'));
try {
  const mockGhPath = join(mockDir, 'gh');
  await writeFile(mockGhPath, [
    '#!/usr/bin/env bash',
    'case " $* " in',
    '  *" --event schedule "*) printf "%s\\n" "$MOCK_SCHEDULE_JSON" ;;',
    '  *) printf "%s\\n" "$MOCK_LATEST_JSON" ;;',
    'esac',
    '',
  ].join('\n'), { mode: 0o755 });

  // GitHub's Ubuntu runner supplies jq; Vercel's build image may not. The
  // production Health workflow still uses real jq. Only this offline synthetic
  // shell harness installs a strictly whitelisted temporary compatibility
  // reader when the executable is absent. No network or package install.
  const jqProbe = spawnSync('jq', ['--version'], { encoding: 'utf8' });
  if (jqProbe.error?.code === 'ENOENT') {
    await writeFile(join(mockDir, 'jq'), [
      '#!/usr/bin/env node',
      "const { readFileSync } = require('node:fs');",
      "const args = process.argv.slice(2);",
      "const selector = args.length === 1 ? args[0] : (args.length === 2 && args[0] === '-r' ? args[1] : null);",
      "const allowed = new Set(['length', '.[0].databaseId', '.[0].status', '.[0].conclusion // \"unknown\"', '.[0].createdAt', '.[0].updatedAt // .[0].createdAt', '.[0].url', '.[0].event']);",
      "if (!allowed.has(selector)) { console.error('Unsupported synthetic jq selector'); process.exit(2); }",
      "const input = JSON.parse(readFileSync(0, 'utf8'));",
      "if (!Array.isArray(input)) process.exit(3);",
      "const run = input[0] || {};",
      "const key = selector.match(/^\\.\\[0\\]\\.([A-Za-z]+)(?: \\/\\/ .*)?$/)?.[1];",
      "const value = selector === 'length' ? input.length : (selector === '.[0].conclusion // \"unknown\"' ? (run.conclusion ?? 'unknown') : (selector === '.[0].updatedAt // .[0].createdAt' ? (run.updatedAt ?? run.createdAt) : run[key]));",
      "if (value === undefined) process.exit(4);",
      "process.stdout.write(String(value) + '\\n');",
    ].join(String.fromCharCode(10)), { mode: 0o755 });
  } else {
    assert.equal(jqProbe.error, undefined, 'system jq should execute when installed');
    assert.equal(jqProbe.status, 0, 'system jq should be usable when installed');
  }

  const utcMinutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
  const fakeRun = (id, event, status, conclusion, minutesAgo) => ({
    databaseId: id,
    event,
    status,
    conclusion,
    createdAt: utcMinutesAgo(minutesAgo),
    updatedAt: utcMinutesAgo(Math.max(1, minutesAgo - 2)),
    url: 'https://github.com/example/repo/actions/runs/' + id,
  });
  const scheduled = fakeRun(1001, 'schedule', 'completed', 'success', 65);
  const latestFailed = fakeRun(1002, 'workflow_dispatch', 'completed', 'failure', 20);
  const latestActive = fakeRun(1003, 'workflow_dispatch', 'in_progress', null, 20);
  const latestSuccess = fakeRun(1004, 'workflow_dispatch', 'completed', 'success', 20);

  const cases = [
    {
      name: 'missing-native-schedule-is-failure',
      native: [],
      latest: [latestSuccess],
      exitCode: 1,
      report: /No native scheduled Daily USD Impact workflow run was found/,
    },
    {
      name: 'newer-failed-fallback-is-failure',
      native: [scheduled],
      latest: [latestFailed],
      exitCode: 1,
      report: /newer non-scheduled Daily run ended unsuccessfully/,
    },
    {
      name: 'newer-active-fallback-is-pending',
      native: [scheduled],
      latest: [latestActive],
      exitCode: 0,
      report: /newer_fallback_pending/,
      output: /state=pending/,
    },
    {
      name: 'newer-successful-fallback-does-not-hide-native',
      native: [scheduled],
      latest: [latestSuccess],
      exitCode: 0,
      report: /assessing the independently identified native schedule/,
      stdout: /SELECTED_RUN_ID=1001/,
    },
    {
      name: 'latest-run-is-the-native-schedule',
      native: [scheduled],
      latest: [scheduled],
      exitCode: 0,
      stdout: /SELECTED_RUN_ID=1001/,
    },
  ];

  for (const scenario of cases) {
    const outputFile = join(mockDir, scenario.name + '.output');
    const result = spawnSync('bash', ['-c', selectionOnlyShell], {
      cwd: mockDir,
      encoding: 'utf8',
      timeout: 5_000,
      env: {
        ...process.env,
        PATH: mockDir + ':' + process.env.PATH,
        GITHUB_REPOSITORY: 'example/repo',
        WORKFLOW_NAME: 'daily-news.yml',
        GITHUB_OUTPUT: outputFile,
        MAX_AGE_HOURS: '12',
        MAX_ACTIVE_MINUTES: '130',
        HEALTH_WORKFLOW_EVENT: 'schedule',
        MOCK_SCHEDULE_JSON: JSON.stringify(scenario.native),
        MOCK_LATEST_JSON: JSON.stringify(scenario.latest),
      },
    });
    assert.equal(result.error, undefined, scenario.name + ' should run without subprocess failure');
    assert.equal(
      result.status, scenario.exitCode,
      scenario.name + ': ' + result.stdout + '\n' + result.stderr,
    );
    const report = await readFile(join(mockDir, 'daily-health-report.md'), 'utf8');
    if (scenario.report) assert.match(report, scenario.report, scenario.name);
    if (scenario.stdout) assert.match(result.stdout, scenario.stdout, scenario.name);
    if (scenario.output) {
      const output = await readFile(outputFile, 'utf8');
      assert.match(output, scenario.output, scenario.name);
    }
  }
} finally {
  await rm(mockDir, { recursive: true, force: true });
}

console.log('daily news health workflow tests pass');

// Offline scheduler tests join the existing CI validation route; no new workflow.
await import('./test-daily-news-schedule-wake.mjs');
// Always execute the real auto-closure shell against fake manual, missing,
// bot, edited-file, workflow-failure and duplicate-PR receipts. No network.
await import('./test-daily-health-auto-close-evidence.mjs');
await import('./test-daily-news-early-advisory.mjs');
