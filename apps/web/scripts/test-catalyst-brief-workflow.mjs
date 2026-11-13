import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../../../.github/workflows/catalyst-brief.yml', import.meta.url), 'utf8');

assert.match(workflow, /cron: '45 6 \* \* \*'/, 'preview check must run every day');
assert.match(workflow, /cron: '45 22 \* \* \*'/, 'outcome check must run every day');
assert.match(workflow, /select-important-catalyst\.mjs/, 'workflow must deterministically select an eligible catalyst');
assert.match(workflow, /catalyst-brief-source/, 'workflow must fetch fresh source-backed analysis');
assert.match(workflow, /for attempt in 1 2;/, 'research must have one bounded retry');
assert.match(workflow, /import-catalyst-brief\.mjs[^\n]*--review-only --skip-published/, 'scheduled importer must be review-only and preserve calendar checks');
assert.doesNotMatch(workflow, /import-catalyst-brief\.mjs[^\n]*--publish/, 'scheduled Catalyst must never claim published status');
assert.match(workflow, /gh pr create[\s\S]*?--draft/, 'Catalyst automation must create a Draft review-only PR');
assert.match(workflow, /with status \\`review\\`/, 'PR body must explicitly disclose review status');
assert.match(workflow, /existing_pr_url="\$\(gh pr list --state open --head "\$branch"/, 'reruns must reuse an existing immutable publication PR');
assert.match(workflow, /gh workflow run quality\.yml/, 'exact publication commit must receive Web quality');
assert.match(workflow, /ready for protected editorial review ONLY/, 'workflow must hand off to human review without release claim');
assert.doesNotMatch(workflow, /gh pr merge/, 'workflow must never merge unreviewed catalyst content');
assert.match(workflow, /automation requires attention/, 'workflow failures must create or update a health issue');
assert.match(workflow, /- name: Open protected Draft review pull request\n\s*id: publish_pr\n\s*if: steps\.eligibility\.outputs\.publishable == 'true'/, 'only an eligible candidate may enter review PR handoff');
assert.match(workflow, /if \[ "\$run_conclusion" != "success" \]; then[\s\S]*echo "validated_pr_url=\$pr_url" >> "\$GITHUB_OUTPUT"/, 'validated PR receipt must be emitted only after exact-head Web quality success');
assert.match(workflow, /- name: Record scheduled review handoff without closing issue\n[\s\S]*?if: success\(\) && github\.event_name == 'schedule' && steps\.config\.outputs\.configured == 'true' && steps\.candidate\.outputs\.has_candidate == 'true' && steps\.eligibility\.outputs\.publishable == 'true' && steps\.publish_pr\.outputs\.validated_pr_url != ''/, 'review-only receipt requires naturally scheduled eligible verified candidate');
assert.match(workflow, /VALIDATED_PUBLICATION_PR: \$\{\{ steps\.publish_pr\.outputs\.validated_pr_url \}\}/, 'recovery receipt must name the exact validated PR');
assert.doesNotMatch(workflow, /gh issue close/, 'review PR success must not close an automation attention issue');
assert.doesNotMatch(workflow, /- name: Close recovered automation issue/, 'review-only handoff cannot be conflated with real public recovery');
for (const [label, weakened] of [
  ['reintroduced publication importer', workflow.replace('--review-only --skip-published', '--publish --skip-published')],
  ['removed Draft PR', workflow.replace('              --draft \\', '')],
  ['auto-closes issue', workflow + '\n      - run: gh issue close 123\n'],
]) {
  assert.notEqual(weakened, workflow, 'Test mutant must change text: ' + label);
  assert.ok(
    /import-catalyst-brief\.mjs[^\n]*--publish/.test(weakened)
      || !/gh pr create[\s\S]*?--draft/.test(weakened)
      || /gh issue close/.test(weakened),
    'Unsafe regression must be detected: ' + label,
  );
}

console.log('catalyst brief workflow tests pass');
