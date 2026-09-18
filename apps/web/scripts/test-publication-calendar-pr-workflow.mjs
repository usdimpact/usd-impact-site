import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const raw = await readFile(new URL('../../../.github/workflows/publication-calendar-pr-guard.yml', import.meta.url), 'utf8');
for (const required of [
  'pull_request_target:',
  "cron: '*/5 * * * *'",
  'pull-requests: write',
  'statuses: write',
  'contents: read',
  'persist-credentials: false',
  'GUARD_WINDOW_MINUTES:',
  'publication-calendar-freshness',
  'node scripts/enforce-publication-calendar-prs.mjs',
]) assert.ok(raw.includes(required), `missing workflow contract: ${required}`);

assert.ok(!/pull_request:\s*\n/.test(raw), 'ordinary pull_request must not replace the trusted pull_request_target boundary');
assert.ok(!/github\.event\.pull_request\.head\.(sha|ref)/.test(raw), 'workflow must never checkout PR-head code');
assert.ok(!/actions:\s*write/.test(raw), 'workflow does not need Actions write permission');
assert.ok(!/contents:\s*write/.test(raw), 'workflow must not mutate repository contents');

console.log('publication calendar PR workflow contract pass');
