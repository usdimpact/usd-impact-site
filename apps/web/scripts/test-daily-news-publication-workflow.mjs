import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
assert.doesNotMatch(
  workflow,
  /gh pr merge/,
  'publication must not merge unreviewed content',
);
assert.match(
  workflow,
  /passed Web quality and is ready for protected review and merge/,
  'publication must clearly report the protected review handoff',
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

const handoffStep = workflow.match(
  /      - name: Open, validate, and merge publication pull request\n[\s\S]*?        run: \|\n([\s\S]*)$/,
);
assert.ok(handoffStep, 'publication handoff shell must be present');

const handoffShell = handoffStep[1]
  .split('\n')
  .map((line) => (line.startsWith('          ') ? line.slice(10) : line))
  .join('\n');
const syntaxCheck = spawnSync('bash', ['-n'], {
  input: handoffShell,
  encoding: 'utf8',
});
assert.equal(
  syntaxCheck.status,
  0,
  `publication handoff shell must parse with bash -n:\n${syntaxCheck.stderr}`,
);

console.log('daily news publication workflow tests pass');
