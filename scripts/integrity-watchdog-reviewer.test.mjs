import assert from 'node:assert/strict';
import fs from 'node:fs';
import { independentReview } from './integrity-watchdog-reviewer.mjs';

const reply = (body, status = 200, headers = {}) => new Response(body, { status, headers });
const workflow = fs.readFileSync(new URL('../.github/workflows/integrity-watchdog.yml', import.meta.url), 'utf8');

assert.match(workflow, /USDIMPACT_WATCHDOG_OPENAI_API_KEY: \$\{\{ secrets\.USDIMPACT_WATCHDOG_OPENAI_API_KEY \}\}/);
assert.match(workflow, /USDIMPACT_WATCHDOG_OPENAI_MODEL: \$\{\{ vars\.USDIMPACT_WATCHDOG_OPENAI_MODEL \}\}/);
assert.doesNotMatch(workflow, /OPENAI_API_KEY[^\n]*\|\|/);

for (const env of [
  { OPENAI_API_KEY: 'general-key-must-not-be-used', USDIMPACT_WATCHDOG_OPENAI_MODEL: 'gpt-5.6-terra' },
  { USDIMPACT_WATCHDOG_OPENAI_API_KEY: 'dedicated-key-without-model' },
  { USDIMPACT_WATCHDOG_OPENAI_MODEL: 'gpt-5.6-terra' },
]) {
  let fetchCalled = false;
  const result = await independentReview({
    enabled: true,
    env,
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error('OpenAI must not be called with incomplete dedicated configuration.');
    },
  });
  assert.equal(fetchCalled, false);
  assert.equal(result.outcome, 'UNKNOWN');
}

const model = 'gpt-5.6-terra';
const dedicatedKey = 'dedicated-openai-key-for-test';
const requests = [];
const reviewPayload = {
  verdict: 'CONFIRM',
  summary: 'The deterministic findings are supported by the supplied normalized evidence.',
  challenged_contract_ids: [],
  findings: [],
};
const responseEnvelope = {
  id: 'resp_watchdog_test',
  status: 'completed',
  output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(reviewPayload) }] }],
};

const direct = await independentReview({
  enabled: true,
  env: {
    USDIMPACT_WATCHDOG_OPENAI_API_KEY: dedicatedKey,
    USDIMPACT_WATCHDOG_OPENAI_MODEL: model,
  },
  projectSummary: { release_gate: 'READY_WITH_CONDITIONS' },
  results: [{ id: 'TEST-CONTRACT', workflow_id: 'TEST-01', severity: 'P2', outcome: 'PASS', classification: 'A_GOLD_CANDIDATE', summary: 'Test evidence.', evidence_digest: 'a'.repeat(64), evidence: [] }],
  fixReadyPackets: [],
  fetchImpl: async (url, options = {}) => {
    requests.push({ url: String(url), options });
    return reply(JSON.stringify(responseEnvelope), 200, { 'content-type': 'application/json' });
  },
});

assert.equal(requests.length, 1);
assert.equal(requests[0].url, 'https://api.openai.com/v1/responses');
assert.equal(String(requests[0].options.method || '').toUpperCase(), 'POST');
const requestBody = JSON.parse(String(requests[0].options.body));
assert.equal(requestBody.model, model);
assert.equal(requestBody.store, false);
assert.deepEqual(requestBody.tools, []);
assert.equal(requestBody.tool_choice, 'none');
assert.equal(requestBody.parallel_tool_calls, false);
assert.equal(requestBody.text?.format?.type, 'json_schema');
assert.equal(requestBody.text?.format?.strict, true);
assert.equal(requestBody.text?.format?.name, 'usd_impact_integrity_review');
assert.equal(requestBody.previous_response_id, undefined);
assert.equal(direct.outcome, 'PASS');
assert.equal(direct.evidence[0].model, model);
assert.equal(direct.evidence[0].input_stored_by_request, false);
assert.equal(direct.evidence[0].tools_enabled, false);
assert.doesNotMatch(JSON.stringify(direct), new RegExp(dedicatedKey));

const refusal = await independentReview({
  enabled: true,
  env: {
    USDIMPACT_WATCHDOG_OPENAI_API_KEY: dedicatedKey,
    USDIMPACT_WATCHDOG_OPENAI_MODEL: model,
  },
  fetchImpl: async () => reply(JSON.stringify({
    id: 'resp_watchdog_refusal_test',
    status: 'completed',
    output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Cannot provide this review.' }] }],
  }), 200, { 'content-type': 'application/json' }),
});
assert.equal(refusal.outcome, 'UNKNOWN');
assert.equal(refusal.evidence[0].refusal_detected, true);
assert.doesNotMatch(JSON.stringify(refusal), /Cannot provide this review/);

console.log('USD Impact OpenAI watchdog reviewer-boundary tests passed.');
