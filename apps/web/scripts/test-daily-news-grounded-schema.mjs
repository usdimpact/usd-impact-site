import assert from 'node:assert/strict';
import {
  extractEditionDate,
  withSourceMetadata,
} from '../api/daily-news-grounded-background.js';

const editionDate = '2026-08-20';
const catalystWindow = [
  '2026-08-20',
  '2026-08-21',
  '2026-08-22',
  '2026-08-23',
  '2026-08-24',
  '2026-08-25',
  '2026-08-26',
  '2026-08-27',
];

assert.equal(extractEditionDate(`Prepare the source-backed Daily USD Impact research bundle for ${editionDate} (UTC).`), editionDate);
assert.equal(extractEditionDate(`The bundle for ${editionDate} failed validation.`), editionDate);
assert.equal(extractEditionDate(`Use the exact inclusive window ${editionDate} through 2026-08-27.`), editionDate);
assert.equal(extractEditionDate('Generate a bundle without a date.'), null);
assert.equal(extractEditionDate('The bundle for 2026-02-31 failed validation.'), null);

const request = {
  tools: [{ type: 'web_search' }],
  input: `Prepare the source-backed Daily USD Impact research bundle for ${editionDate} (UTC).`,
  text: {
    format: {
      schema: {
        type: 'object',
        properties: {
          highlights: {
            type: 'array',
            items: { type: 'object' },
          },
          catalysts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string' },
              },
            },
          },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                publishedAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
};

const hardened = withSourceMetadata(request);
const highlights = hardened.text.format.schema.properties.highlights;
const catalysts = hardened.text.format.schema.properties.catalysts;
const catalystDate = catalysts.items.properties.date;
const sourceProperties = hardened.text.format.schema.properties.sources.items.properties;

assert.equal(highlights.minItems, 3, 'grounded generation must require at least three highlights');
assert.equal(highlights.maxItems, 7, 'grounded generation must allow at most seven highlights');
assert.match(highlights.description, /3-7/);
for (const invalidCount of [0, 1, 2, 8]) {
  assert.equal(
    invalidCount >= highlights.minItems && invalidCount <= highlights.maxItems,
    false,
    `${invalidCount} highlights must fail the schema contract`,
  );
}
for (const validCount of [3, 4, 5, 6, 7]) {
  assert.equal(
    validCount >= highlights.minItems && validCount <= highlights.maxItems,
    true,
    `${validCount} highlights must satisfy the schema contract`,
  );
}

assert.equal(catalysts.type, 'array', 'malformed non-array catalysts must fail structured output');
assert.equal(catalysts.minItems, 0, 'an empty catalyst array remains valid when no qualifying event exists');
assert.equal(catalysts.maxItems, 10);
assert.deepEqual(catalystDate.enum, catalystWindow);
assert.equal(catalystDate.enum.includes('2026-08-19'), false, 'a catalyst before the edition date must be impossible');
assert.equal(catalystDate.enum.includes('2026-08-28'), false, 'a catalyst outside the seven-day window must be impossible');
assert.match(catalystDate.description, /inclusive/);

assert.match(sourceProperties.id.pattern, /^\^/);
assert.match(sourceProperties.publishedAt.pattern, /^\^/);
assert.match(hardened.input, /effective date/i, 'initial grounded prompts must distinguish publication dates from effective dates');
assert.match(hardened.input, /auction date/i, 'initial grounded prompts must distinguish publication dates from auction dates');
assert.equal(hardened.tool_choice, 'required');
assert.ok(hardened.include.includes('web_search_call.action.sources'));

const repairRequest = {
  input: `The bundle for ${editionDate} failed validation. Use the exact inclusive window ${editionDate} through 2026-08-27.`,
  text: {
    format: {
      schema: {
        type: 'object',
        properties: {
          highlights: { type: 'array', minItems: 1, maxItems: 20 },
          catalysts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', pattern: '^.*$' },
              },
            },
          },
        },
      },
    },
  },
};
const repairedRequest = withSourceMetadata(repairRequest);
const repaired = repairedRequest.text.format.schema.properties;
assert.equal(repaired.highlights.minItems, 3, 'repair schemas must not prune below three highlights');
assert.equal(repaired.highlights.maxItems, 7, 'repair schemas must not exceed seven highlights');
assert.deepEqual(repaired.catalysts.items.properties.date.enum, catalystWindow);
assert.equal('pattern' in repaired.catalysts.items.properties.date, false);
assert.match(repairedRequest.input, /effective date/i, 'repair prompts must retain source publication-date semantics');
assert.match(repairedRequest.input, /event date/i, 'repair prompts must not confuse event dates with publishedAt');

const undated = withSourceMetadata({
  input: 'Generate a Daily bundle without a parseable edition date.',
  text: {
    format: {
      schema: {
        properties: {
          catalysts: {
            type: 'array',
            items: { type: 'object', properties: { date: { type: 'string' } } },
          },
        },
      },
    },
  },
});
assert.equal(
  'enum' in undated.text.format.schema.properties.catalysts.items.properties.date,
  false,
  'an unknown date must not produce an invented catalyst window',
);

// #687: schema limits constrain generation; server validation remains mandatory.
const textLimits = [
  ['marketRegime', 180, 'draft', 'marketRegime'],
  ['summary', 700, 'draft', 'summary'],
  ['body', 9000, 'draft', 'body'],
  ['highlights.items.properties.headline', 140, 'highlight', 'headline'],
  ['highlights.items.properties.development', 700, 'highlight', 'development'],
  ['highlights.items.properties.whyItMatters', 700, 'highlight', 'whyItMatters'],
  ['catalysts.items.properties.event', 240, 'catalyst', 'event'],
  ['catalysts.items.properties.whyItMatters', 500, 'catalyst', 'whyItMatters'],
  ['sources.items.properties.title', 300, 'source', 'title'],
  ['sources.items.properties.url', 2000, 'source', 'url'],
];
const nodeAt = (schema, path) => path.split('.').reduce((node, part) => node[part], schema.properties);
const textNode = () => ({ type: 'string' });
const lengthRequest = structuredClone(request);
const props = lengthRequest.text.format.schema.properties;
Object.assign(props, { marketRegime: textNode(), summary: textNode(), body: textNode() });
props.highlights.items.properties = {
  headline: textNode(), development: textNode(), whyItMatters: textNode(),
  assets: { type: 'array', items: { type: 'string', enum: ['DXY'] } },
  sourceIds: { type: 'array', items: textNode() },
};
Object.assign(props.catalysts.items.properties, { event: textNode(), whyItMatters: textNode() });
Object.assign(props.sources.items.properties, { title: textNode(), url: textNode() });
Object.assign(props.sources, { minItems: 3, maxItems: 24 });
Object.assign(lengthRequest, {
  model: 'gpt-5-mini', background: true, store: true,
  reasoning: { effort: 'low' }, max_output_tokens: 16000,
});
lengthRequest.tools[0].search_context_size = 'medium';
lengthRequest.tools[0].filters = { allowed_domains: ['federalreserve.gov', 'eia.gov'] };
Object.assign(lengthRequest.text.format, { type: 'json_schema', name: 'daily_usd_impact_bundle', strict: true });
const originalLengthRequest = structuredClone(lengthRequest);
const bounded = withSourceMetadata(lengthRequest);
let boundaryCases = 0;
for (const [path, limit] of textLimits) {
  const node = nodeAt(bounded.text.format.schema, path);
  assert.equal(node.pattern, `^[\\s\\S]{0,${limit}}$`, path);
  assert.equal('maxLength' in node, false, 'Do not assume an undocumented keyword is supported');
  for (const flags of ['', 'u']) {
    const pattern = new RegExp(node.pattern, flags);
    for (const value of ['x'.repeat(limit - 1), 'x'.repeat(limit), '\u00e9'.repeat(limit), 'x'.repeat(limit - 2) + '\nx']) {
      assert.equal(pattern.test(value), true, `${path}: accept an in-bound decoded string`);
      boundaryCases += 1;
    }
    for (const value of ['x'.repeat(limit + 1), '\u00e9'.repeat(limit + 1), 'x'.repeat(limit - 1) + '\nx']) {
      assert.equal(pattern.test(value), false, `${path}: reject an over-bound decoded string`);
      boundaryCases += 1;
    }
  }
}
assert.deepEqual(lengthRequest, originalLengthRequest, 'The shared request/schema must not be mutated');
assert.deepEqual(withSourceMetadata(bounded), bounded, 'Applying the wrapper twice must be idempotent');
assert.equal(bounded.input, hardened.input, 'No research prompt/rule change');
assert.deepEqual(bounded.tools, originalLengthRequest.tools);
for (const key of ['model', 'background', 'store', 'reasoning', 'max_output_tokens']) {
  assert.deepEqual(bounded[key], originalLengthRequest[key], key);
}
assert.equal(bounded.text.format.strict, true);
assert.equal(bounded.text.format.name, 'daily_usd_impact_bundle');
assert.equal(bounded.text.format.schema.properties.sources.minItems, 3);
assert.equal(bounded.text.format.schema.properties.sources.maxItems, 24);
assert.equal(bounded.tool_choice, 'required');
assert.deepEqual(bounded.include, ['web_search_call.action.sources']);
assert.equal(nodeAt(bounded.text.format.schema, 'sources.items.properties.id').pattern, sourceProperties.id.pattern);
assert.equal(nodeAt(bounded.text.format.schema, 'sources.items.properties.publishedAt').pattern, sourceProperties.publishedAt.pattern);
assert.deepEqual(nodeAt(bounded.text.format.schema, 'catalysts.items.properties.date').enum, catalystWindow);

const deepFreeze = (value) => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};
assert.deepEqual(withSourceMetadata(deepFreeze(structuredClone(lengthRequest))), bounded);
const nextDayRequest = { ...lengthRequest, input: 'The bundle for 2026-08-21 failed validation.' };
const nextDay = withSourceMetadata(nextDayRequest);
assert.equal(nodeAt(nextDay.text.format.schema, 'catalysts.items.properties.date').enum[0], '2026-08-21');
assert.deepEqual(nodeAt(bounded.text.format.schema, 'catalysts.items.properties.date').enum, catalystWindow);
assert.notEqual(nextDay.text.format.schema, bounded.text.format.schema);

const boundedRepairInput = structuredClone(lengthRequest);
delete boundedRepairInput.tools;
delete boundedRepairInput.background;
boundedRepairInput.store = false;
boundedRepairInput.max_output_tokens = 9000;
boundedRepairInput.text.format.name = 'daily_usd_impact_bundle_repair';
const boundedRepair = withSourceMetadata(boundedRepairInput);
for (const [path] of textLimits) {
  assert.equal(nodeAt(boundedRepair.text.format.schema, path).pattern, nodeAt(bounded.text.format.schema, path).pattern);
}
assert.equal(boundedRepair.max_output_tokens, 9000);
assert.equal(boundedRepair.store, false);
assert.equal('tools' in boundedRepair, false);
assert.equal('tool_choice' in boundedRepair, false, 'Repairs must not gain research calls');
assert.equal('include' in boundedRepair, false);

for (const [path] of textLimits) {
  const conflict = structuredClone(lengthRequest);
  nodeAt(conflict.text.format.schema, path).pattern = '^existing-policy$';
  const before = structuredClone(conflict);
  assert.throws(() => withSourceMetadata(conflict), /different pattern; review required/);
  assert.deepEqual(conflict, before, 'Do not overwrite or partially mutate another constraint');
}
assert.doesNotThrow(() => withSourceMetadata({ input: 'No schema supplied.' }));
const nonText = structuredClone(lengthRequest);
nonText.text.format.schema.properties.summary = { type: 'object', additionalProperties: false };
assert.deepEqual(withSourceMetadata(nonText).text.format.schema.properties.summary, nonText.text.format.schema.properties.summary);

// JSON Schema code-point counting is not JS trimmed UTF-16 length validation.
const unicodeSummary = '\u{1f642}'.repeat(351);
assert.equal(new RegExp(nodeAt(bounded.text.format.schema, 'summary').pattern, 'u').test(unicodeSummary), true);
assert.equal(unicodeSummary.trim().length > 700, true, 'The existing server check must still reject this');
const newlineAtBoundary = 'x'.repeat(700) + '\n';
assert.equal(new RegExp(nodeAt(bounded.text.format.schema, 'summary').pattern).test(newlineAtBoundary), false);
assert.equal(newlineAtBoundary.trim().length, 700, 'Schema bounds raw text; server bounds trimmed text');
const padded = ' '.repeat(701) + 'x';
assert.equal(padded.trim().length, 1);
assert.equal(new RegExp(nodeAt(bounded.text.format.schema, 'summary').pattern).test(padded), false);
assert.equal(originalLengthRequest.input, lengthRequest.input, 'Never truncate output text or source URLs');
console.log(`daily text schema boundary cases: ${boundaryCases} PASS; isolation and policy preservation PASS`);

// #690: distinguish exact array membership from string substring matching.
function assertRequiredSearchDomain(allowedDomains) {
  assert.ok(Array.isArray(allowedDomains), 'Search allowed_domains must be an array');
  for (const domain of allowedDomains) {
    assert.equal(typeof domain, 'string', 'Every allowed_domains entry must be a string');
  }
  assert.ok(
    allowedDomains.some((domain) => domain === 'federalreserve.gov'),
    'Search allowed_domains must contain the exact Federal Reserve domain',
  );
}

const validDomainLists = [
  ['federalreserve.gov'],
  ['eia.gov', 'federalreserve.gov', 'bls.gov'],
  Object.freeze(['federalreserve.gov', 'eia.gov']),
];
for (const domains of validDomainLists) {
  const before = [...domains];
  assert.doesNotThrow(() => assertRequiredSearchDomain(domains));
  assert.deepEqual(domains, before, 'Domain assertions must not mutate their input');
}
const invalidDomainLists = [
  ['bare string instead of array', 'federalreserve.gov'],
  ['URL string instead of array', 'https://federalreserve.gov.example.test/'],
  ['missing value', undefined],
  ['null value', null],
  ['object imitating membership', { includes: () => true }],
  ['empty array', []],
  ['unrelated domain', ['eia.gov']],
  ['host prefix', ['not-federalreserve.gov']],
  ['host suffix', ['federalreserve.gov.example.test']],
  ['host prefix without separator', ['notfederalreserve.gov']],
  ['unrequested subdomain', ['www.federalreserve.gov']],
  ['URL instead of domain', ['https://federalreserve.gov/']],
  ['domain in path', ['https://example.test/federalreserve.gov']],
  ['domain in query', ['https://example.test/?host=federalreserve.gov']],
  ['domain in userinfo', ['https://federalreserve.gov@example.test/']],
  ['leading whitespace', [' federalreserve.gov']],
  ['trailing whitespace', ['federalreserve.gov ']],
  ['trailing newline', ['federalreserve.gov\n']],
  ['trailing dot', ['federalreserve.gov.']],
  ['case mismatch', ['FederalReserve.gov']],
  ['number mixed with exact domain', ['federalreserve.gov', 42]],
  ['null mixed with exact domain', ['federalreserve.gov', null]],
  ['nested array mixed with exact domain', ['federalreserve.gov', ['eia.gov']]],
  ['sparse array mixed with exact domain', Object.assign(new Array(2), { 0: 'federalreserve.gov' })],
];
for (const [label, domains] of invalidDomainLists) {
  assert.throws(() => assertRequiredSearchDomain(domains), { name: 'AssertionError' }, label);
}
console.log(`daily search domain assertion: ${validDomainLists.length + invalidDomainLists.length} fixtures PASS`);

// INTEGRATION: real application modules; all provider calls below are mocked.
const { readFile } = await import('node:fs/promises');
const { default: groundedHandler } = await import('../api/daily-news-grounded-background.js');
const { isRetryableGroundingFailure } = await import('./daily-news-retry-policy.mjs');
const sourceCode = await readFile(new URL('../api/daily-news-source.js', import.meta.url), 'utf8');
for (const [, limit, owner, field] of textLimits) {
  assert.ok(sourceCode.includes(`requiredString(${owner}, '${field}', ${limit})`), `${owner}.${field}: detect drift from unchanged server limit`);
}
const envNames = ['NEWSFEED_BEARER_TOKEN', 'OPENAI_API_KEY', 'OPENAI_NEWS_MODEL', 'OPENAI_NEWS_REPAIR_MODEL'];
const savedEnv = new Map(envNames.map((name) => [name, process.env[name]]));
const savedFetch = globalThis.fetch;
const savedError = console.error;
const calls = [];
const providerId = 'resp_synthetic_length_contract_687';
const recorder = () => ({
  statusCode: 200, body: '', headers: {},
  setHeader(name, value) { this.headers[name] = value; },
  end(value) { this.body = value; },
});
const incoming = (method) => ({
  method, url: `/api/daily-news-grounded-background?date=${editionDate}&response_id=${providerId}`,
  query: { date: editionDate, response_id: providerId },
  headers: { authorization: 'Bearer synthetic-endpoint-token' },
});
let responder;
try {
  process.env.NEWSFEED_BEARER_TOKEN = 'synthetic-endpoint-token';
  process.env.OPENAI_API_KEY = 'synthetic-not-a-provider-key';
  process.env.OPENAI_NEWS_MODEL = 'gpt-5-mini';
  process.env.OPENAI_NEWS_REPAIR_MODEL = 'gpt-5-mini';
  console.error = () => {}; // Suppress expected synthetic failures, never real service errors.
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://api.openai.com', 'No other network target is permitted in fixtures');
    assert.ok(url.pathname === '/v1/responses' || url.pathname === `/v1/responses/${providerId}`);
    const call = { method: options.method ?? 'GET', body: options.body ? JSON.parse(options.body) : null };
    calls.push(call);
    const result = responder(call);
    return new Response(JSON.stringify(result.body), { status: result.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  };
  const stub = globalThis.fetch;
  responder = () => ({ body: { id: providerId, status: 'queued', model: 'gpt-5-mini' } });
  const started = recorder();
  await groundedHandler(incoming('POST'), started);
  assert.equal(started.statusCode, 202);
  assert.equal(globalThis.fetch, stub, 'Nested overrides must restore the original mock');
  assert.equal(calls.length, 1);
  const sent = calls[0].body;
  assert.equal(calls[0].method, 'POST');
  assert.equal(sent.max_output_tokens, 16000);
  assert.equal(sent.background, true);
  assert.equal(sent.store, true);
  assert.equal(sent.model, 'gpt-5-mini');
  assert.deepEqual(sent.reasoning, { effort: 'low' });
  assert.equal(sent.tools[0].search_context_size, 'medium');
  assertRequiredSearchDomain(sent.tools[0].filters.allowed_domains);
  assert.equal(sent.tool_choice, 'required');
  assert.ok(sent.include.includes('web_search_call.action.sources'));
  assert.equal(sent.text.format.strict, true);
  for (const [path] of textLimits) {
    assert.equal(nodeAt(sent.text.format.schema, path).pattern, nodeAt(bounded.text.format.schema, path).pattern);
  }

  calls.length = 0;
  responder = () => ({ status: 400, body: { error: { code: 'invalid_json_schema', message: 'Synthetic incompatible schema' } } });
  const unsupported = recorder();
  await groundedHandler(incoming('POST'), unsupported);
  assert.equal(unsupported.statusCode, 502);
  assert.equal(calls.length, 1, 'No schema-stripping retry on a provider schema error');
  assert.equal(globalThis.fetch, stub);

  calls.length = 0;
  responder = () => ({ body: {
    id: providerId, status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' },
    usage: { input_tokens: 11141, output_tokens: 15906, output_tokens_details: { reasoning_tokens: 1472 }, total_tokens: 27047 },
    output: [{ type: 'message', content: [{ type: 'output_text', text: '{"summary":"synthetic-partial-do-not-publish' }] }],
  } });
  const exhausted = recorder();
  await groundedHandler(incoming('GET'), exhausted);
  assert.equal(exhausted.statusCode, 502);
  const failure = JSON.parse(exhausted.body);
  assert.equal(failure.status, 'incomplete');
  assert.equal(failure.reason, 'max_output_tokens');
  assert.deepEqual(failure.usage, { inputTokens: 11141, outputTokens: 15906, reasoningTokens: 1472, totalTokens: 27047 });
  assert.doesNotMatch(exhausted.body, /synthetic-partial|highlights|sources/);
  assert.equal(isRetryableGroundingFailure(failure), false);
  assert.deepEqual(calls.map((call) => call.method), ['GET'], 'No paid repair on incomplete output');

  calls.length = 0;
  const fixtureSources = [1, 2, 3].map((n) => ({
    id: `fixture-${n}`, title: `Synthetic source ${n}`, publishedAt: editionDate,
    url: `https://www.federalreserve.gov/newsevents/pressreleases/fixture-${n}.htm`,
  }));
  const longDraft = {
    marketRegime: 'fixture', summary: 'x'.repeat(701), body: 'Synthetic publication fixture.', catalysts: [],
    sources: fixtureSources,
    highlights: [1, 2, 3].map((n) => ({
      headline: `Synthetic fact ${n}`, development: 'Synthetic development.', whyItMatters: 'Conditional fixture.',
      assets: ['DXY'], importance: 'low', sourceIds: [`fixture-${n}`],
    })),
  };
  responder = (call) => call.method === 'GET' ? ({ body: {
    id: providerId, status: 'completed', output: [
      { type: 'web_search_call', action: { sources: fixtureSources.map(({ url }) => ({ url })) } },
      { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(longDraft) }] },
    ],
  } }) : ({ status: 400, body: { error: { code: 'invalid_json_schema', message: 'Synthetic repair schema rejection' } } });
  const repairFailed = recorder();
  await groundedHandler(incoming('GET'), repairFailed);
  assert.equal(repairFailed.statusCode, 502);
  assert.deepEqual(calls.map((call) => call.method), ['GET', 'POST']);
  const repairSent = calls[1].body;
  assert.equal(repairSent.max_output_tokens, 9000);
  assert.equal(repairSent.model, 'gpt-5-mini');
  assert.equal(repairSent.store, false);
  assert.deepEqual(repairSent.reasoning, { effort: 'low' });
  assert.equal('tools' in repairSent, false);
  assert.equal('tool_choice' in repairSent, false);
  assert.equal(repairSent.text.format.strict, true);
  for (const [path] of textLimits) {
    assert.equal(nodeAt(repairSent.text.format.schema, path).pattern, nodeAt(bounded.text.format.schema, path).pattern);
  }
  const repairFailure = JSON.parse(repairFailed.body);
  assert.equal(repairFailure.repairAttempts, 1);
  assert.match(repairFailure.initialValidationReason, /summary exceeds maximum length/);
  assert.equal(globalThis.fetch, stub);
  console.log('daily text schema mocked request/terminal/repair integration: 4 scenarios PASS');
} finally {
  globalThis.fetch = savedFetch;
  console.error = savedError;
  for (const [name, value] of savedEnv) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

console.log('daily grounded schema contract pass');
