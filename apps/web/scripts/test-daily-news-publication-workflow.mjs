import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(
  new URL('../../../.github/workflows/daily-news.yml', import.meta.url),
  'utf8',
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
assert.match(
  workflow,
  /gh pr merge "\$pr_url" --auto --squash --delete-branch/,
  'publication must wait for protected-branch requirements through auto-merge',
);
assert.doesNotMatch(
  workflow,
  /gh pr merge "\$pr_url" --squash --delete-branch/,
  'publication must not attempt an immediate protected-branch merge',
);

console.log('daily news publication workflow tests pass');
