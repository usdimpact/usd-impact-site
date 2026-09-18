import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const raw = await readFile(new URL('../../../.github/workflows/publication-calendar-pr-guard.yml', import.meta.url), 'utf8');
for (const required of [
  "cron: '2/5 * * * *'",
  'workflow_dispatch:',
  'pull-requests: write',
  'statuses: write',
  'contents: read',
  'persist-credentials: false',
  'GUARD_WINDOW_MINUTES:',
  'publication-calendar-freshness',
  'node scripts/enforce-publication-calendar-prs.mjs',
]) assert.ok(raw.includes(required), `missing workflow contract: ${required}`);

assert.doesNotMatch(raw, /pull_request_target/, 'privileged pull_request_target must remain forbidden');
assert.doesNotMatch(raw, /^\s*pull_request\s*:/m, 'PR-event execution is unnecessary for the scheduled guard');
assert.doesNotMatch(raw, /TARGET_PR/, 'scheduled sweep must evaluate all open PRs');
assert.doesNotMatch(raw, /github\.event\.pull_request/, 'workflow must not depend on PR-event fields');
assert.doesNotMatch(raw, /actions:\s*write/, 'workflow does not need Actions write permission');
assert.doesNotMatch(raw, /contents:\s*write/, 'workflow must not mutate repository contents');

console.log('publication calendar PR workflow contract pass');
