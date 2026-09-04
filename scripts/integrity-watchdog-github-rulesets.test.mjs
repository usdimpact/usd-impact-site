import assert from 'node:assert/strict';
import { githubContracts } from './integrity-watchdog-github.mjs';
import { CLASSIFICATION, OUTCOME } from './integrity-watchdog-policy.mjs';

const reply = (body, status = 200, url = '') => {
  const response = new Response(body, { status });
  if (url) Object.defineProperty(response, 'url', { value: url });
  return response;
};

const head = 'c'.repeat(40);

function rulesetFetch({ complete = true } = {}) {
  return async (url) => {
    const value = String(url);
    if (value.endsWith('/branches/main')) {
      return reply(JSON.stringify({ commit: { sha: head } }), 200, value);
    }
    if (value.includes('/actions/workflows/quality.yml/runs?')) {
      return reply(JSON.stringify({ workflow_runs: [{ id: 42, head_sha: head, status: 'completed', conclusion: 'success' }] }), 200, value);
    }
    if (value.endsWith('/branches/main/protection')) {
      return reply(JSON.stringify({ message: 'Resource not accessible by integration' }), 403, value);
    }
    if (value.endsWith('/rulesets')) {
      return reply(JSON.stringify([{ id: 123, name: 'Protect main', target: 'branch', enforcement: 'active' }]), 200, value);
    }
    if (value.endsWith('/rulesets/123')) {
      const requiredStatusChecks = complete
        ? [{ context: 'validate-and-build', integration_id: 15368 }, { context: 'Dependency review', integration_id: 15368 }]
        : [{ context: 'validate-and-build', integration_id: 15368 }];
      return reply(JSON.stringify({
        id: 123,
        name: 'Protect main',
        target: 'branch',
        enforcement: 'active',
        conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
        rules: [
          { type: 'deletion' },
          { type: 'non_fast_forward' },
          { type: 'pull_request', parameters: { required_review_thread_resolution: complete } },
          { type: 'required_status_checks', parameters: { strict_required_status_checks_policy: true, required_status_checks: requiredStatusChecks } },
        ],
        bypass_actors: [],
        current_user_can_bypass: 'never',
      }), 200, value);
    }
    return reply(JSON.stringify({ message: 'not found' }), 404, value);
  };
}

const complete = await githubContracts({
  env: { GITHUB_TOKEN: 'github-read-token-for-test' },
  repository: 'usdimpact/usd-impact-site',
  branch: 'main',
  fetchImpl: rulesetFetch({ complete: true }),
});

assert.equal(complete.length, 2);
assert.equal(complete[0].id, 'GITHUB-CURRENT-HEAD-QUALITY');
assert.equal(complete[0].outcome, OUTCOME.PASS);
assert.equal(complete[1].id, 'GITHUB-REQUIRED-CHECKS');
assert.equal(complete[1].outcome, OUTCOME.PASS);
assert.equal(complete[1].classification, CLASSIFICATION.GOLD_CANDIDATE);
assert.equal(complete[1].evidence[0].protection_source, 'ruleset');
assert.equal(complete[1].evidence[0].branch_protection_response_status, 403);
assert.equal(complete[1].evidence[0].applicable_ruleset_count, 1);
assert.equal(complete[1].evidence[0].expected_contexts_present, true);
assert.equal(complete[1].evidence[0].pull_request_required, true);
assert.equal(complete[1].evidence[0].review_thread_resolution_required, true);
assert.equal(complete[1].evidence[0].strict_required_status_checks, true);
assert.equal(complete[1].evidence[0].force_push_protected, true);
assert.equal(complete[1].evidence[0].deletion_protected, true);
assert.equal(complete[1].evidence[0].bypass_actor_count, 0);
assert.deepEqual(complete[1].evidence[0].current_user_can_bypass, ['never']);
assert.ok(complete[1].evidence[0].required_contexts.includes('validate-and-build'));
assert.ok(complete[1].evidence[0].required_contexts.includes('Dependency review'));

const incomplete = await githubContracts({
  env: { GITHUB_TOKEN: 'github-read-token-for-test' },
  repository: 'usdimpact/usd-impact-site',
  branch: 'main',
  fetchImpl: rulesetFetch({ complete: false }),
});
assert.equal(incomplete[1].outcome, OUTCOME.WARN);
assert.equal(incomplete[1].evidence[0].expected_contexts_present, false);
assert.equal(incomplete[1].evidence[0].review_thread_resolution_required, false);

console.log('USD Impact GitHub ruleset watchdog fallback tests passed.');
