import assert from 'node:assert/strict';
import './test-daily-news-discovery-contract.mjs';
import groundedHandler, {
  extractEditionDate,
  withSourceMetadata,
} from '../api/daily-news-grounded-background.js';
import backgroundHandler, {
  assessBoundedRepairFeasibility,
  buildRepairOutputSchema,
  MAX_BACKGROUND_OUTPUT_TOKENS,
} from '../api/daily-news-background.js';

const editionDate = '2026-08-20';
assert.equal(
  MAX_BACKGROUND_OUTPUT_TOKENS,
  20_000,
  'background generation must retain bounded headroom above the observed 16k truncation ceiling',
);
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

const requestBefore = structuredClone(request);
const hardened = withSourceMetadata(request);
assert.deepEqual(request, requestBefore, 'shared schema must not be mutated');
assert.deepEqual(Object.keys(hardened.text.format.schema.properties), ['sources', 'catalysts', 'highlights']);
assert.deepEqual(withSourceMetadata(hardened), hardened, 'request preparation is idempotent');
const nextDay = withSourceMetadata({ ...request, input: 'Prepare the research bundle for 2026-08-21 (UTC).' });
assert.equal(nextDay.text.format.schema.properties.catalysts.items.properties.date.enum[0], '2026-08-21');
assert.equal(hardened.text.format.schema.properties.catalysts.items.properties.date.enum[0], editionDate);
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
assert.match(hardened.input, /three individually dated publisher documents/i);
assert.match(hardened.input, /release-specific dated EIA document/i);
assert.match(hardened.input, /unsupported absence claims/i);
assert.match(hardened.input, /in-window primary-sourced catalyst/i);
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
assert.doesNotMatch(repairedRequest.input, /DAILY SOURCE-FIRST DISCOVERY CONTRACT/, 'repairs cannot start fresh source discovery');
assert.equal('tools' in repairedRequest, false);

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



// Regression: an incomplete draft ledger may still have enough exact URLs in the
// stored provider web-search context to support one bounded source-ledger repair.
// The repair must continue that stored response, use no fresh web-search tool and
// remain constrained to exact URLs that the original response already returned.
const testSourceUrls = [
  'https://www.bls.gov/news.release/test-a.htm',
  'https://www.federalreserve.gov/newsevents/pressreleases/test-b.htm',
  'https://www.eia.gov/todayinenergy/detail.php?id=12345',
];
const makeFakeProvider = (urlsInLedger, metadata = testSourceUrls, id = 'resp_test1234567') => ({
  id,
  status: 'completed',
  output: [
    { type: 'web_search_call', action: { sources: metadata.map((url) => ({ url })) } },
    { type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
      marketRegime: 'Synthetic test only',
      summary: 'Synthetic test only.',
      highlights: [],
      catalysts: [],
      sources: urlsInLedger.map((url, index) => ({
        id: 'synthetic-' + (index + 1),
        title: 'Synthetic source ' + (index + 1),
        url,
        publishedAt: '2026-10-22',
      })),
      body: 'Synthetic test copy.',
    }) }] },
  ],
});
const incomplete = makeFakeProvider(testSourceUrls.slice(0, 2));
const normal = makeFakeProvider(testSourceUrls);
const ungrounded = makeFakeProvider([...testSourceUrls.slice(0, 2), 'https://example.invalid/not-searched']);
assert.deepEqual(assessBoundedRepairFeasibility(incomplete, '2026-10-22'), {
  canRepair: true, groundedCount: 3, retainedCount: 2,
});
assert.deepEqual(assessBoundedRepairFeasibility(normal, '2026-10-22'), {
  canRepair: true, groundedCount: 3, retainedCount: 3,
});
assert.deepEqual(assessBoundedRepairFeasibility(ungrounded, '2026-10-22'), {
  canRepair: true, groundedCount: 3, retainedCount: 2,
});
assert.deepEqual(assessBoundedRepairFeasibility(makeFakeProvider(testSourceUrls, testSourceUrls.slice(0, 2)), '2026-10-22'), {
  canRepair: false, groundedCount: 2, retainedCount: 2,
});
assert.deepEqual(assessBoundedRepairFeasibility(makeFakeProvider(testSourceUrls.slice(0, 2), testSourceUrls, 'not-stored'), '2026-10-22'), {
  canRepair: false, groundedCount: 3, retainedCount: 2,
});

const overflowContextUrls = Array.from(
  { length: 26 },
  (_, index) => `https://www.bls.gov/news.release/archives/synthetic_${String(index + 1).padStart(2, '0')}222026.htm`,
);
const overflow = makeFakeProvider([], overflowContextUrls, 'resp_oct26overflow');
assert.deepEqual(assessBoundedRepairFeasibility(overflow, '2026-10-22'), {
  canRepair: true, groundedCount: 26, retainedCount: 0,
});
const overflowRepairSchema = buildRepairOutputSchema('2026-10-22', overflowContextUrls);
assert.equal(overflowRepairSchema.properties.sources.maxItems, 24);
assert.equal(overflowRepairSchema.properties.sources.items.properties.url.enum.length, 26);

const oldFetch = globalThis.fetch;
const oldToken = process.env.NEWSFEED_BEARER_TOKEN;
const oldKey = process.env.OPENAI_API_KEY;
const providerCalls = [];
const repairBodies = [];
try {
  process.env.NEWSFEED_BEARER_TOKEN = 'test-bearer-only';
  process.env.OPENAI_API_KEY = 'test-dummy-key-only';
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    const method = options.method ?? 'GET';
    providerCalls.push({ url: target, method });
    if (method === 'GET') {
      assert.match(target, /\/v1\/responses\/resp_test1234567$/);
      return new Response(JSON.stringify(incomplete), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    assert.equal(target, 'https://api.openai.com/v1/responses');
    assert.equal(method, 'POST');
    repairBodies.push(JSON.parse(String(options.body ?? '{}')));
    return new Response(JSON.stringify({ error: { message: 'synthetic repair stop after request inspection' } }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  };
  const req = {
    method: 'GET',
    url: '/api/daily-news-background',
    headers: {
      authorization: 'Bearer test-bearer-only',
      'x-usd-impact-edition-date': '2026-10-22',
      'x-usd-impact-response-id': 'resp_test1234567',
    },
  };
  const recorded = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; },
    end(value) { this.body = value; },
  };
  await backgroundHandler(req, recorded);
  assert.equal(recorded.statusCode, 502);
  const body = JSON.parse(recorded.body);
  assert.equal(body.repairAttempts, 1);
  assert.match(body.repairError, /synthetic repair stop/);
  assert.equal(providerCalls.length, 2, 'one retrieval plus one bounded context-linked repair');
  assert.equal(repairBodies.length, 1);
  const repairBody = repairBodies[0];
  assert.equal(repairBody.previous_response_id, 'resp_test1234567');
  assert.equal('tools' in repairBody, false, 'bounded repair must not open a fresh web search');
  assert.deepEqual(
    repairBody.text.format.schema.properties.sources.items.properties.url.enum,
    testSourceUrls,
    'repair source enum must be exact URLs from the stored grounded response',
  );
  assert.match(repairBody.input, /PERMITTED GROUNDED CONTEXT URLS/);
  assert.match(repairBody.input, /Do not perform a fresh web search/);
  assert.doesNotMatch(repairBody.input, /example\.invalid/);
  // Test the real nested generation wrappers with one synthetic provider POST.
  // All calls are intercepted; this is not a live generator acceptance test.
  const generationBodies = [];
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(String(url), 'https://api.openai.com/v1/responses');
    assert.equal(options.method, 'POST');
    generationBodies.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ id: 'resp_test1234567', status: 'queued' }), { status: 200 });
  };
  const started = { statusCode: 0, headers: {}, body: '',
    setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = value; } };
  await groundedHandler({ method: 'POST', headers: {
    authorization: 'Bearer test-bearer-only', 'x-usd-impact-edition-date': '2026-10-23',
  } }, started);
  assert.equal(started.statusCode, 202);
  assert.equal(generationBodies.length, 1, 'no additional discovery/model request');
  const sent = generationBodies[0];
  assert.deepEqual(Object.keys(sent.text.format.schema.properties), ['sources', 'catalysts', 'highlights', 'marketRegime', 'summary', 'body']);
  assert.match(sent.input, /^DAILY SOURCE-FIRST DISCOVERY CONTRACT: 2026-10-23/);
  assert.equal(sent.max_output_tokens, 20_000);
  assert.equal(sent.reasoning.effort, 'low');
  assert.equal(sent.background, true);
  assert.equal(sent.store, true);
  assert.equal(sent.tools[0].search_context_size, 'medium');
  assert.equal(sent.tool_choice, 'required');
  assert.equal(sent.text.format.schema.properties.sources.minItems, 3);
  assert.equal(sent.text.format.schema.properties.sources.maxItems, 24);
  assert.equal(sent.text.format.schema.properties.highlights.minItems, 3);
  assert.equal(sent.text.format.schema.properties.highlights.maxItems, 7);

} finally {
  globalThis.fetch = oldFetch;
  if (oldToken == null) delete process.env.NEWSFEED_BEARER_TOKEN;
  else process.env.NEWSFEED_BEARER_TOKEN = oldToken;
  if (oldKey == null) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = oldKey;
}

console.log('daily grounded schema contract pass');
