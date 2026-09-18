import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manual = await readFile(new URL('../../../.github/workflows/publication-calendar-pr-guard.yml', import.meta.url), 'utf8');
const watchdog = await readFile(new URL('../../../.github/workflows/integrity-watchdog.yml', import.meta.url), 'utf8');
const freshnessJob = watchdog.match(/\n  publication-calendar-freshness:\n([\s\S]*?)\n  audit:/)?.[1] || '';
const guardCron = '4,9,14,19,24,29,34,39,44,49,54,59 * * * *';

for (const required of [
  'workflow_dispatch:',
  'pull-requests: write',
  'statuses: write',
  'contents: read',
  'persist-credentials: false',
  'GUARD_WINDOW_MINUTES:',
  'publication-calendar-freshness',
  'node scripts/enforce-publication-calendar-prs.mjs',
]) assert.ok(manual.includes(required), `missing manual guard contract: ${required}`);

assert.doesNotMatch(manual, /^\s*schedule\s*:/m, 'standalone guard must not retain an unobserved cron schedule');
assert.doesNotMatch(manual, /pull_request_target/, 'privileged pull_request_target must remain forbidden');
assert.doesNotMatch(manual, /^\s*pull_request\s*:/m, 'PR-event execution is unnecessary for the manual fallback');
assert.doesNotMatch(manual, /TARGET_PR/, 'guard sweep must evaluate all open PRs');
assert.doesNotMatch(manual, /github\.event\.pull_request/, 'guard must not depend on PR-event fields');
assert.doesNotMatch(manual, /actions:\s*write/, 'manual guard does not need Actions write permission');
assert.doesNotMatch(manual, /contents:\s*write/, 'manual guard must not mutate repository contents');

assert.ok(watchdog.includes(`cron: '${guardCron}'`), 'watchdog must retain the dedicated freshness cadence');
assert.ok(freshnessJob, 'watchdog must contain the freshness-only job');
assert.match(freshnessJob, /if: github\.event_name == 'schedule'/, 'freshness job must run on every watchdog schedule as a fallback');
assert.doesNotMatch(freshnessJob, /github\.event\.schedule ==/, 'freshness job must not depend on only the dedicated cadence');
assert.ok(watchdog.includes(`github.event.schedule != '${guardCron}'`), 'heavy audit must remain excluded from the dedicated freshness cadence');

for (const required of [
  'pull-requests: write',
  'statuses: write',
  'node scripts/enforce-publication-calendar-prs.mjs',
]) assert.ok(freshnessJob.includes(required), `missing watchdog-hosted guard contract: ${required}`);

console.log('publication calendar PR workflow hosting fallback contract pass');
