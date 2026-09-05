import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(new URL('../.github/workflows/integrity-watchdog.yml', import.meta.url), 'utf8');
const concurrency = workflow.match(/concurrency:\n([\s\S]*?)\n\njobs:/)?.[1] || '';

assert.match(concurrency, /group: usd-impact-integrity-watchdog-\$\{\{ github\.event_name \}\}/);
assert.match(concurrency, /cancel-in-progress: false/);
assert.match(concurrency, /queue: max/);
assert.doesNotMatch(concurrency, /cancel-in-progress: true/);

console.log('USD Impact watchdog workflow concurrency tests passed.');
