import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CLASSIFICATION, OUTCOME, SEVERITY, assertSafeArtifact, classify, fixPacket, health, result, sanitize } from './integrity-watchdog-policy.mjs';
import { dailyFreshness, probe, repositoryContracts, resendContracts, supabaseContracts, vercelContracts } from './integrity-watchdog-collectors.mjs';
import { independentReview } from './integrity-watchdog-reviewer.mjs';

const reply = (body, status = 200, headers = {}, url = '') => {
  const response = new Response(body, { status, headers });
  if (url) Object.defineProperty(response, 'url', { value: url });
  return response;
};

const openAiShape = `${'sk-' + 'proj-'}abcdefghijklmnopqrstuvwxyz0123456789`;
const resendShape = `${'re' + '_'}abcdefghijklmnopqrstuvwxyz0123456789`;
const safe = sanitize({
  email: 'person@example.com',
  authorization: 'Bearer abcdefghijklmnopqrstuvwxyz',
  nested: `${openAiShape} ${resendShape}`,
  secret_values_persisted: false,
});
assert.equal(safe.email, '[REDACTED_EMAIL]');
assert.equal(safe.authorization, '[REDACTED]');
assert.match(safe.nested, /REDACTED_OPENAI_KEY/);
assert.match(safe.nested, /REDACTED_RESEND_KEY/);
assert.equal(safe.secret_values_persisted, false);
assert.equal(assertSafeArtifact(safe), true);
assert.equal(classify(OUTCOME.PASS, true), CLASSIFICATION.GOLD_CANDIDATE);
assert.equal(classify(OUTCOME.FAIL), CLASSIFICATION.FAILED);

const passed = result({ id: 'PASS', workflowId: 'WF', title: 'Pass', domain: 'test', severity: SEVERITY.P0, outcome: OUTCOME.PASS, summary: 'passed', goldEligible: true });
const warned = result({ id: 'WARN', workflowId: 'WF', title: 'Warn', domain: 'test', severity: SEVERITY.P1, outcome: OUTCOME.WARN, summary: 'warned' });
const failed = result({ id: 'FAIL', workflowId: 'WF', title: 'Fail', domain: 'test', severity: SEVERITY.P0, outcome: OUTCOME.FAIL, summary: 'failed' });
assert.equal(health([passed]).status, 'GREEN');
assert.equal(health([passed, warned]).status, 'AMBER');
assert.equal(health([passed, failed]).status, 'RED');
assert.equal(fixPacket(failed, '2026-09-04T00:00:00.000Z').status, 'PROPOSED_ONLY');
assert.equal(fixPacket(passed), null);

const headers = {
  'strict-transport-security': 'max-age=63072000',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'cache-control': 'no-store',
};
const goodProbe = await probe({
  fetchImpl: async () => reply('required marker', 200, headers, 'https://example.test/'),
  id: 'HTTP-PASS', workflowId: 'WF', title: 'HTTP pass', severity: SEVERITY.P1,
  url: 'https://example.test/', requiredText: ['required marker'], requiredHeaders: headers, goldEligible: true,
});
assert.equal(goodProbe.outcome, OUTCOME.PASS);
assert.equal(goodProbe.classification, CLASSIFICATION.GOLD_CANDIDATE);
const badProbe = await probe({
  fetchImpl: async () => reply('wrong', 503),
  id: 'HTTP-FAIL', workflowId: 'WF', title: 'HTTP fail', severity: SEVERITY.P0,
  url: 'https://example.test/', expectedStatus: 200, requiredText: ['required marker'],
});
assert.equal(badProbe.outcome, OUTCOME.FAIL);

const currentDaily = await dailyFreshness({
  fetchImpl: async () => reply('<a href="/news/2026-09-04/">Daily</a>'),
  baseUrl: 'https://www.usd-impact.com',
  now: new Date('2026-09-04T18:00:00Z'),
});
const staleDaily = await dailyFreshness({
  fetchImpl: async () => reply('<a href="/news/2026-09-03/">Daily</a>'),
  baseUrl: 'https://www.usd-impact.com',
  now: new Date('2026-09-04T18:00:00Z'),
});
assert.equal(currentDaily.outcome, OUTCOME.PASS);
assert.equal(staleDaily.outcome, OUTCOME.FAIL);

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'watchdog-'));
fs.mkdirSync(path.join(workspace, '.github', 'workflows'), { recursive: true });
fs.mkdirSync(path.join(workspace, 'scripts'), { recursive: true });
fs.writeFileSync(path.join(workspace, '.github', 'workflows', 'quality.yml'), 'permissions:\n  contents: read\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1\n');
fs.writeFileSync(path.join(workspace, 'scripts', 'safe.mjs'), 'export const safe = true;\n');
assert.equal(repositoryContracts({ workspace })[0].outcome, OUTCOME.PASS);
fs.writeFileSync(path.join(workspace, '.github', 'workflows', 'quality.yml'), 'permissions: write-all\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v7\n');
assert.equal(repositoryContracts({ workspace })[0].outcome, OUTCOME.FAIL);
fs.rmSync(workspace, { recursive: true, force: true });

assert.equal((await vercelContracts({ env: {} }))[0].outcome, OUTCOME.UNKNOWN);
assert.equal((await independentReview({ results: [passed], enabled: false, env: {} })).outcome, OUTCOME.SKIP);
assert.equal((await independentReview({ results: [passed], enabled: true, env: {} })).outcome, OUTCOME.UNKNOWN);

let resendFetchCalled = false;
const resendBlocked = await resendContracts({
  env: { USDIMPACT_WATCHDOG_RESEND_API_KEY: resendShape },
  fetchImpl: async () => {
    resendFetchCalled = true;
    throw new Error('Resend must remain blocked without explicit approval.');
  },
});
assert.equal(resendBlocked[0].outcome, OUTCOME.UNKNOWN);
assert.equal(resendFetchCalled, false);

const resendMethods = [];
const resendAllowed = await resendContracts({
  env: {
    USDIMPACT_WATCHDOG_RESEND_API_KEY: resendShape,
    USDIMPACT_WATCHDOG_RESEND_FULL_ACCESS_APPROVED: 'true',
    USDIMPACT_WATCHDOG_RESEND_DOMAIN: 'usd-impact.com',
  },
  fetchImpl: async (url, options = {}) => {
    resendMethods.push(options.method || 'GET');
    if (String(url).endsWith('/domains')) return reply(JSON.stringify({ data: [{ name: 'usd-impact.com', status: 'verified', region: 'us-east-1' }] }), 200);
    return reply(JSON.stringify({ data: [{ events: ['email.delivered', 'email.bounced', 'email.complained', 'email.suppressed'] }] }), 200);
  },
});
assert.equal(resendAllowed[0].outcome, OUTCOME.PASS);
assert.deepEqual(resendMethods, ['GET', 'GET']);
assert.equal(resendAllowed[0].evidence[0].email_sent, false);

const supabaseReviewed = await supabaseContracts({
  env: {
    USDIMPACT_WATCHDOG_SUPABASE_ACCESS_TOKEN: 'supabase-read-token-for-test',
    USDIMPACT_WATCHDOG_SUPABASE_PROJECT_REF: 'abcdefghijklmnopqrst',
  },
  fetchImpl: async (url) => {
    if (String(url).endsWith('/v1/projects')) return reply(JSON.stringify([{ ref: 'abcdefghijklmnopqrst', status: 'ACTIVE_HEALTHY', database: { version: '17' } }]), 200);
    return reply(JSON.stringify({ lints: [] }), 200);
  },
});
assert.equal(supabaseReviewed[0].outcome, OUTCOME.WARN);
assert.equal(supabaseReviewed[0].evidence[0].advisor_endpoint_experimental, true);
assert.equal(supabaseReviewed[0].evidence[0].direct_rls_policy_rows_collected, false);

let request;
const reviewed = await independentReview({
  results: [passed],
  projectSummary: { health: 'GREEN' },
  enabled: true,
  env: {
    USDIMPACT_WATCHDOG_OPENAI_API_KEY: openAiShape,
    USDIMPACT_WATCHDOG_OPENAI_MODEL: 'gpt-5.6-terra',
  },
  fetchImpl: async (url, options) => {
    request = { url: String(url), options };
    return reply(JSON.stringify({
      id: 'resp_test',
      output: [{ content: [{ type: 'output_text', text: JSON.stringify({ verdict: 'CONFIRM', summary: 'Supported.', challenged_contract_ids: [], findings: [] }) }] }],
    }), 200);
  },
});
assert.equal(reviewed.outcome, OUTCOME.PASS);
const body = JSON.parse(request.options.body);
assert.equal(request.url, 'https://api.openai.com/v1/responses');
assert.equal(body.store, false);
assert.equal(body.text.format.type, 'json_schema');
assert.equal(body.text.format.strict, true);
assert.doesNotMatch(JSON.stringify(reviewed), /abcdefghijklmnopqrstuvwxyz0123456789/);

console.log('USD Impact integrity watchdog unit tests passed.');
