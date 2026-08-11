import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(
  new URL('../../../.github/workflows/daily-news-health.yml', import.meta.url),
  'utf8',
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
  /age_seconds="\$\(\(now_epoch - created_epoch\)\)"/,
  'freshness must not remain pinned to the original failed attempt start',
);

console.log('daily news health workflow tests pass');
