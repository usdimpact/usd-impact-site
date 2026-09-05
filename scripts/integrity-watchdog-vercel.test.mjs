import assert from 'node:assert/strict';
import fs from 'node:fs';
import { vercelContracts } from './integrity-watchdog-vercel.mjs';

const reply = (body, status = 200, headers = {}, url = '') => {
  const response = new Response(body, { status, headers });
  if (url) Object.defineProperty(response, 'url', { value: url });
  return response;
};

const workflow = fs.readFileSync(new URL('../.github/workflows/integrity-watchdog.yml', import.meta.url), 'utf8');
assert.match(workflow, /USDIMPACT_WATCHDOG_VERCEL_TOKEN: \$\{\{ secrets\.USDIMPACT_WATCHDOG_VERCEL_TOKEN \}\}/);
assert.doesNotMatch(workflow, /USDIMPACT_WATCHDOG_VERCEL_TOKEN \|\| secrets\.USDIMPACT_VERCEL_TOKEN/);

let blockedFetchCalled = false;
const blocked = await vercelContracts({
  env: {
    USDIMPACT_VERCEL_TOKEN: 'general-production-token-must-not-be-used',
  },
  expectedGitSha: 'a'.repeat(40),
  fetchImpl: async () => {
    blockedFetchCalled = true;
    throw new Error('General Vercel credential fallback must remain blocked.');
  },
});
assert.equal(blockedFetchCalled, false);
assert.equal(blocked[0].outcome, 'UNKNOWN');
assert.equal(blocked[1].outcome, 'UNKNOWN');

const exactHead = 'b'.repeat(40);
const projectId = 'prj_watchdog_test';
const teamId = 'team_watchdog_test';
const runtimeSecretShape = `${'re' + '_'}${'x'.repeat(30)}`;
const requests = [];

const direct = await vercelContracts({
  env: {
    USDIMPACT_WATCHDOG_VERCEL_TOKEN: 'dedicated-read-token-for-test',
    USDIMPACT_WATCHDOG_VERCEL_PROJECT_ID: projectId,
    USDIMPACT_WATCHDOG_VERCEL_TEAM_ID: teamId,
  },
  expectedGitSha: exactHead,
  fetchImpl: async (url, options = {}) => {
    const requestUrl = String(url);
    requests.push({ url: requestUrl, method: String(options.method || 'GET').toUpperCase() });
    if (requestUrl.includes(`/v9/projects/${projectId}?`)) {
      return reply(JSON.stringify({ id: projectId, name: 'usd-impact-site' }), 200, {}, requestUrl);
    }
    if (requestUrl.includes('/v13/deployments?')) {
      return reply(JSON.stringify({
        deployments: [{ uid: 'dpl_watchdog_test', state: 'READY', meta: { githubCommitSha: exactHead } }],
      }), 200, {}, requestUrl);
    }
    if (requestUrl.includes(`/v10/projects/${projectId}/env?`)) {
      return reply(JSON.stringify({
        envs: [
          { key: 'OPENAI_API_KEY', target: ['production'], value: runtimeSecretShape },
          { key: 'NEWSFEED_BEARER_TOKEN', target: ['production'], value: 'runtime-value-not-for-evidence' },
          { key: 'RESEND_API_KEY', target: ['production'], value: runtimeSecretShape },
          { key: 'PREVIEW_ONLY_TEST', target: ['preview'], value: runtimeSecretShape },
        ],
      }), 200, {}, requestUrl);
    }
    return reply('{}', 404, {}, requestUrl);
  },
});

assert.equal(requests.length, 3);
assert.deepEqual(new Set(requests.map((entry) => entry.method)), new Set(['GET']));
assert.ok(requests.some((entry) => entry.url.includes('/v13/deployments?')));
const envRequest = requests.find((entry) => entry.url.includes('/v10/projects/'));
assert.ok(envRequest);
assert.match(envRequest.url, /[?&]decrypt=false(?:&|$)/);
assert.match(envRequest.url, new RegExp(`teamId=${teamId}`));

const source = direct.find((entry) => entry.id === 'VERCEL-SOURCE-IDENTITY');
const config = direct.find((entry) => entry.id === 'VERCEL-CONFIG-PRESENCE');
assert.equal(source.outcome, 'PASS');
assert.equal(config.outcome, 'PASS');
assert.equal(source.evidence[0].deployment_api_version, 'v13');
assert.equal(config.evidence[0].environment_api_version, 'v10');
assert.equal(config.evidence[0].decrypt_requested, false);
assert.equal(config.evidence[0].provider_returned_value_fields, true);
assert.equal(config.evidence[0].value_fields_used_for_contract, false);
assert.equal(config.evidence[0].values_persisted, false);
assert.equal(config.evidence[0].production_variable_count, 3);
assert.deepEqual(config.evidence[0].missing_variable_names, []);
assert.doesNotMatch(JSON.stringify(direct), new RegExp(runtimeSecretShape));
assert.doesNotMatch(JSON.stringify(direct), /runtime-value-not-for-evidence/);

console.log('USD Impact Vercel watchdog read-boundary tests passed.');
