import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(new URL('../.github/workflows/integrity-watchdog.yml', import.meta.url), 'utf8');
const concurrency = workflow.match(/concurrency:\n([\s\S]*?)\n\njobs:/)?.[1] || '';
const freshnessJob = workflow.match(/\n  publication-calendar-freshness:\n([\s\S]*?)\n  audit:/)?.[1] || '';

assert.match(concurrency, /group: usd-impact-integrity-watchdog-\$\{\{ github\.event_name \}\}/);
assert.match(concurrency, /cancel-in-progress: false/);
assert.match(concurrency, /queue: max/);
assert.doesNotMatch(concurrency, /cancel-in-progress: true/);

const guardCron = '4,9,14,19,24,29,34,39,44,49,54,59 * * * *';
assert.ok(workflow.includes(`cron: '${guardCron}'`), 'watchdog must host the 5-minute freshness cadence');
assert.ok(freshnessJob, 'watchdog must contain the freshness-only job');
assert.match(freshnessJob, /if: github\.event_name == 'schedule'/, 'freshness job must run on every watchdog schedule as a fallback');
assert.doesNotMatch(freshnessJob, /github\.event\.schedule ==/, 'freshness job must not depend on only one cron expression');
assert.ok(workflow.includes(`github.event.schedule != '${guardCron}'`), 'heavy audit must be excluded from the freshness cadence');
assert.ok(freshnessJob.includes('pull-requests: write'), 'freshness job requires bounded PR-state write');
assert.ok(freshnessJob.includes('statuses: write'), 'freshness job requires bounded commit-status write');
assert.ok(freshnessJob.includes('node scripts/enforce-publication-calendar-prs.mjs'), 'freshness job must invoke the guarded enforcer');

console.log('USD Impact watchdog workflow concurrency and freshness-hosting fallback tests passed.');
