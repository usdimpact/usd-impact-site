import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { hasOpenCatalystReviewPr } from './check-open-catalyst-pr.mjs';

const workflow = await readFile(new URL('../../../.github/workflows/catalyst-brief.yml', import.meta.url), 'utf8');

assert.match(workflow, /cron: '45 6 \* \* \*'/, 'preview check must run every day');
assert.match(workflow, /cron: '45 22 \* \* \*'/, 'outcome check must run every day');
assert.match(workflow, /select-important-catalyst\.mjs/, 'workflow must deterministically select an eligible catalyst');
assert.match(workflow, /catalyst-brief-source/, 'workflow must fetch fresh source-backed analysis');
assert.match(workflow, /for attempt in 1 2;/, 'research must have one bounded retry');

assert.match(workflow, /gh api --paginate --slurp/, 'all open PR pages must be checked before any paid research');
assert.match(workflow, /check-open-catalyst-pr\.mjs/, 'the fail-closed read-only dedupe parser must be invoked');
assert.match(workflow, /needs_research=false/, 'an existing PR must suppress paid research');
assert.match(workflow, /needs_research=true/, 'a new slug may proceed only after a complete open-PR scan');
assert.match(workflow, /- name: Fetch and analyze the catalyst\n\s*if: steps\.candidate\.outputs\.has_candidate == 'true' && steps\.pending_catalyst\.outputs\.needs_research == 'true'/, 'no paid research without complete duplicate check');
assert.match(workflow, /- name: Check publication eligibility\n\s*if: steps\.candidate\.outputs\.has_candidate == 'true' && steps\.pending_catalyst\.outputs\.needs_research == 'true'/, 'no eligibility read after a skipped duplicate');
const candidatePos = workflow.indexOf('- name: Select one important catalyst');
const duplicatePos = workflow.indexOf('- name: Skip duplicate Catalyst PR before paid research');
const paidPos = workflow.indexOf('- name: Fetch and analyze the catalyst');
assert.ok(candidatePos >= 0 && candidatePos < duplicatePos && duplicatePos < paidPos, 'cost gate must precede paid endpoint invocation');
assert.doesNotMatch(workflow, /Skip duplicate Catalyst PR before paid research[\s\S]*?continue-on-error: true/, 'duplicate-check errors must stop research');

const selected = { candidate: { slug: '2026-11-12-eia-wpsr-outcome' } };
const branch = 'automation/catalyst-brief-2026-11-12-eia-wpsr-outcome-123456789';
const otherPhase = 'automation/catalyst-brief-2026-11-12-eia-wpsr-preview-999';
const owned = ref => ({ state: 'open', head: { ref, repo: { full_name: 'usdimpact/usd-impact-site' } }, base: { ref: 'main' } });
assert.equal(hasOpenCatalystReviewPr(selected, [[owned('automation/catalyst-brief-unrelated-preview-111')], [owned(branch)]], 'usdimpact/usd-impact-site'), true, 'page two must suppress duplicate paid generation');
assert.equal(hasOpenCatalystReviewPr(selected, [[owned(otherPhase)]], 'usdimpact/usd-impact-site'), false, 'a preview must not suppress an outcome');
assert.equal(hasOpenCatalystReviewPr(selected, [[], []], 'usdimpact/usd-impact-site'), false, 'complete empty scan permits first research');
assert.equal(hasOpenCatalystReviewPr(selected, [[owned(branch+'-extra')]], 'usdimpact/usd-impact-site'), false, 'non-numeric suffix must not suppress a candidate');
assert.equal(hasOpenCatalystReviewPr(selected, [[{...owned(branch),head:{ref:branch,repo:{full_name:'external/fork'}}}]], 'usdimpact/usd-impact-site'), false, 'fork head must not impersonate review branch');
for(const badPages of [null, {}, [{head: {ref: branch}}], [[null]], [[{state:'open',head:null}]]]) {
  assert.throws(() => hasOpenCatalystReviewPr(selected, badPages, 'usdimpact/usd-impact-site'), Error, 'invalid/incomplete pagination must fail closed');
}
assert.throws(() => hasOpenCatalystReviewPr({candidate:{slug:'../escape'}}, [[]], 'usdimpact/usd-impact-site'), Error);
for(const [label, mutated] of [
  ['cost gate removed', workflow.replace("id: pending_catalyst", "id: cancelled_catalyst")],
  ['paid fetch guard bypassed', workflow.replace("if: steps.candidate.outputs.has_candidate == 'true' && steps.pending_catalyst.outputs.needs_research == 'true'", "if: steps.candidate.outputs.has_candidate == 'true'")],
  ['PR scan unpaginated', workflow.replace("gh api --paginate --slurp", "gh api")],
]) {
  assert.notEqual(mutated, workflow, label + ' must mutate the fixture');
  assert.ok(!mutated.includes('id: pending_catalyst') || !mutated.includes("if: steps.candidate.outputs.has_candidate == 'true' && steps.pending_catalyst.outputs.needs_research == 'true'") || !mutated.includes('gh api --paginate --slurp'), label + ' must be caught by policy assertions');
}

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
