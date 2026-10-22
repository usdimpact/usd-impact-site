import assert from 'node:assert/strict';
import { buildSourceDiscoveryPlan, sourceFirstRequest, SOURCE_FIRST_KEYS } from '../src/lib/daily-news-discovery-contract.js';

let groups = 0;
const check = (name, fn) => { fn(); groups += 1; };
const request = {
  model: 'synthetic-no-network', background: true, store: true,
  reasoning: { effort: 'low' }, max_output_tokens: 20_000,
  input: 'Prepare the research bundle for 2026-10-23 (UTC).',
  instructions: 'Existing instructions remain in force.',
  tools: [{ type: 'web_search', search_context_size: 'medium', filters: { allowed_domains: ['bls.gov'] } }],
  include: ['web_search_call.action.sources'], tool_choice: 'required',
  text: { format: { type: 'json_schema', strict: true, name: 'synthetic', schema: {
    type: 'object', additionalProperties: false,
    required: ['marketRegime', 'summary', 'highlights', 'catalysts', 'sources', 'body'],
    properties: {
      marketRegime: { type: 'string' }, summary: { type: 'string' },
      highlights: { type: 'array', minItems: 3, maxItems: 7 },
      catalysts: { type: 'array', maxItems: 10, items: { properties: { date: { type: 'string', enum: ['2026-10-23'] } } } },
      sources: { type: 'array', minItems: 3, maxItems: 24, items: { properties: { url: { type: 'string', enum: ['https://www.bls.gov/synthetic-a', 'https://www.bls.gov/synthetic-b'] } } } },
      body: { type: 'string' },
    },
  } } },
};
const before = structuredClone(request);
const result = sourceFirstRequest(request);
check('source and catalyst schema precede prose', () => {
  assert.deepEqual(Object.keys(result.text.format.schema.properties), SOURCE_FIRST_KEYS);
  assert.deepEqual(result.text.format.schema.required, SOURCE_FIRST_KEYS);
});
check('all field constraints survive without additions or removals', () => {
  for (const key of Object.keys(before.text.format.schema.properties)) {
    assert.deepEqual(result.text.format.schema.properties[key], before.text.format.schema.properties[key]);
  }
  assert.equal(result.text.format.schema.additionalProperties, false);
  assert.equal(result.text.format.strict, true);
});
check('model, budgets, filters and transport settings unchanged', () => {
  for (const key of Object.keys(before).filter(key => key !== 'text')) assert.deepEqual(result[key], before[key]);
});
check('shared schema and input not mutated', () => {
  assert.deepEqual(request, before);
  result.text.format.schema.properties.catalysts.items.properties.date.enum.push('2099-01-01');
  result.tools[0].filters.allowed_domains.push('example.invalid');
  assert.deepEqual(request, before);
});
check('repeat preparation does not accumulate changes', () => {
  const first = sourceFirstRequest(request);
  assert.deepEqual(sourceFirstRequest(first), first);
});
check('repair URL whitelist and missing source fields are never widened', () => {
  const repair = structuredClone(request);
  delete repair.tools;
  const next = sourceFirstRequest(repair);
  assert.deepEqual(next.text.format.schema.properties.sources.items.properties.url.enum, request.text.format.schema.properties.sources.items.properties.url.enum);
  assert.equal('tools' in next, false);
  const partial = { text: { format: { schema: { properties: { summary: { type: 'string' } } } } } };
  assert.deepEqual(sourceFirstRequest(partial), partial);
});
check('future extension fields and optionality are preserved', () => {
  const extended = structuredClone(request);
  extended.text.format.schema.properties.extension = { type: 'string' };
  extended.text.format.schema.required = ['extension', 'summary'];
  const next = sourceFirstRequest(extended).text.format.schema;
  assert.deepEqual(next.required, ['summary', 'extension']);
  assert.deepEqual(Object.keys(next.properties), [...SOURCE_FIRST_KEYS, 'extension']);
});
check('malformed request fails without side effects', () => {
  for (const invalid of [null, undefined, [], 'draft']) assert.throws(() => sourceFirstRequest(invalid), TypeError);
  assert.deepEqual(sourceFirstRequest({}), {});
});
check('source plan uses actual supplied edition and date boundaries', () => {
  const plan = buildSourceDiscoveryPlan('2026-10-23');
  assert.match(plan, /2026-10-09 through 2026-10-23/);
  assert.match(plan, /2026-10-23 through 2026-10-30/);
  assert.match(plan, /prior-36-hour/);
  assert.match(plan, /source dates/);
  assert.match(plan, /metadata-only/);
  assert.match(plan, /existing request and limits/);
  assert.match(plan, /server validators remain authoritative/);
  assert.doesNotMatch(plan, /https?:\/\//, 'no invented source URL inserted into the source ledger');
});
check('month, year and leap boundaries are deterministic', () => {
  assert.match(buildSourceDiscoveryPlan('2026-12-30'), /2026-12-30 through 2027-01-06/);
  assert.match(buildSourceDiscoveryPlan('2028-02-29'), /2028-02-15 through 2028-02-29/);
});
check('unknown or invalid edition never creates a dated plan', () => {
  for (const invalid of [null, undefined, '', '2026-02-29', '2026-02-31', '2026-13-01', '2026-1-02', '2026-10-23\ninjected', 20261023]) {
    assert.equal(buildSourceDiscoveryPlan(invalid), null);
  }
});
console.log(`Daily source-first request contract PASS: ${groups} groups; no provider or external requests.`);
