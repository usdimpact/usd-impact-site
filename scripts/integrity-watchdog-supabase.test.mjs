import assert from 'node:assert/strict';
import fs from 'node:fs';
import { supabaseContracts } from './integrity-watchdog-supabase.mjs';

const reply = (body, status = 200, headers = {}, url = '') => {
  const response = new Response(body, { status, headers });
  if (url) Object.defineProperty(response, 'url', { value: url });
  return response;
};

const workflow = fs.readFileSync(new URL('../.github/workflows/integrity-watchdog.yml', import.meta.url), 'utf8');
assert.match(workflow, /USDIMPACT_WATCHDOG_SUPABASE_ACCESS_TOKEN: \$\{\{ secrets\.USDIMPACT_WATCHDOG_SUPABASE_ACCESS_TOKEN \}\}/);
assert.doesNotMatch(workflow, /USDIMPACT_WATCHDOG_SUPABASE_ACCESS_TOKEN \|\| secrets\.USDIMPACT_SUPABASE_ACCESS_TOKEN/);

let blockedFetchCalled = false;
const blocked = await supabaseContracts({
  env: {
    USDIMPACT_SUPABASE_ACCESS_TOKEN: 'general-production-token-must-not-be-used',
    USDIMPACT_WATCHDOG_SUPABASE_PROJECT_REF: 'gjzetjugmnwanvjkchux',
  },
  fetchImpl: async () => {
    blockedFetchCalled = true;
    throw new Error('General Supabase credential fallback must remain blocked.');
  },
});
assert.equal(blockedFetchCalled, false);
assert.equal(blocked.length, 1);
assert.equal(blocked[0].outcome, 'UNKNOWN');
assert.deepEqual(blocked[0].evidence[0].required_environment_names, [
  'USDIMPACT_WATCHDOG_SUPABASE_ACCESS_TOKEN',
  'USDIMPACT_WATCHDOG_SUPABASE_PROJECT_REF',
]);

const projectRef = 'gjzetjugmnwanvjkchux';
const dedicatedToken = 'dedicated-advisors-read-token-for-test';
const providerDetail = 'provider-detail-must-not-be-persisted';
const requests = [];
const direct = await supabaseContracts({
  env: {
    USDIMPACT_WATCHDOG_SUPABASE_ACCESS_TOKEN: dedicatedToken,
    USDIMPACT_WATCHDOG_SUPABASE_PROJECT_REF: projectRef,
  },
  fetchImpl: async (url, options = {}) => {
    const requestUrl = String(url);
    requests.push({
      url: requestUrl,
      method: String(options.method || 'GET').toUpperCase(),
      authorization: options.headers?.Authorization || options.headers?.authorization || null,
    });
    return reply(JSON.stringify({
      lints: [{
        name: 'authenticated_security_definer_function_executable',
        level: 'WARN',
        detail: providerDetail,
      }],
    }), 200, {}, requestUrl);
  },
});

assert.equal(requests.length, 1);
assert.equal(requests[0].method, 'GET');
assert.equal(requests[0].authorization, `Bearer ${dedicatedToken}`);
assert.equal(requests[0].url, `https://api.supabase.com/v1/projects/${projectRef}/advisors/security`);
assert.doesNotMatch(requests[0].url, /\/v1\/projects(?:\?|$)/);

const advisor = direct.find((entry) => entry.id === 'SUPABASE-SECURITY-ADVISORS');
assert.ok(advisor);
assert.equal(advisor.outcome, 'WARN');
assert.equal(advisor.evidence[0].configured_project_ref, projectRef);
assert.equal(advisor.evidence[0].project_list_requested, false);
assert.equal(advisor.evidence[0].advisor_only_token_compatible, true);
assert.equal(advisor.evidence[0].advisor_endpoint_status, 200);
assert.equal(advisor.evidence[0].critical_count, 0);
assert.equal(advisor.evidence[0].warning_count, 1);
assert.doesNotMatch(JSON.stringify(direct), new RegExp(dedicatedToken));
assert.doesNotMatch(JSON.stringify(direct), new RegExp(providerDetail));

console.log('USD Impact Supabase watchdog credential-boundary tests passed.');
