import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../../../.github/workflows/catalyst-brief.yml', import.meta.url), 'utf8');

assert.match(workflow, /cron: '45 6 \* \* \*'/, 'preview check must run every day');
assert.match(workflow, /cron: '45 22 \* \* \*'/, 'outcome check must run every day');
assert.match(workflow, /select-important-catalyst\.mjs/, 'workflow must deterministically select an eligible catalyst');
assert.match(workflow, /catalyst-brief-source/, 'workflow must fetch fresh source-backed analysis');
assert.match(workflow, /for attempt in 1 2;/, 'research must have one bounded retry');
assert.match(workflow, /import-catalyst-brief\.mjs[\s\S]*--publish --skip-published/, 'workflow must import idempotently');
assert.match(workflow, /existing_pr_url="\$\(gh pr list --state open --head "\$branch"/, 'reruns must reuse an existing immutable publication PR');
assert.match(workflow, /gh workflow run quality\.yml/, 'exact publication commit must receive Web quality');
assert.match(workflow, /ready for protected review and merge/, 'workflow must hand off to protected human review');
assert.doesNotMatch(workflow, /gh pr merge/, 'workflow must never merge unreviewed catalyst content');
assert.match(workflow, /automation requires attention/, 'workflow failures must create or update a health issue');
assert.match(workflow, /- name: Open publication pull request\n\s*id: publish_pr\n\s*if: steps\.eligibility\.outputs\.publishable == 'true'/, 'only an eligible Catalyst candidate may enter tracked PR handoff');
assert.match(workflow, /if \[ "\$run_conclusion" != "success" \]; then[\s\S]*echo "validated_pr_url=\$pr_url" >> "\$GITHUB_OUTPUT"/, 'validated PR receipt must be emitted only after exact-head Web quality success');
assert.match(workflow, /- name: Close recovered automation issue\n[\s\S]*?if: success\(\) && github\.event_name == 'schedule' && steps\.config\.outputs\.configured == 'true' && steps\.candidate\.outputs\.has_candidate == 'true' && steps\.eligibility\.outputs\.publishable == 'true' && steps\.publish_pr\.outputs\.validated_pr_url != ''/, 'incident closure requires natural schedule, configured source, eligible publishable candidate and validated PR');
assert.match(workflow, /VALIDATED_PUBLICATION_PR: \$\{\{ steps\.publish_pr\.outputs\.validated_pr_url \}\}/, 'recovery receipt must name the exact validated PR');
assert.doesNotMatch(workflow, /- name: Close recovered automation issue\n\s*if: success\(\)\s*\n/, 'a green no-op or held candidate must never close a Catalyst failure incident');

console.log('catalyst brief workflow tests pass');
