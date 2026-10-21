import assert from 'node:assert/strict';
import {
  extractEditionDate,
  withSourceMetadata,
} from '../api/daily-news-grounded-background.js';
import backgroundHandler, { assessBoundedRepairFeasibility, MAX_BACKGROUND_OUTPUT_TOKENS } from '../api/daily-news-background.js';

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



// Regression: an incomplete original ledger may contain many search-result URLs,
// but the bounded repair model may not invent new dated sources. Fail before
// spending a single repair request. The pre-existing GitHub one-regeneration
// budget is the only allowed fresh-research recovery route.
const testSourceUrls = [
  'https://www.bls.gov/news.release/test-a.htm',
  'https://www.federalreserve.gov/newsevents/pressreleases/test-b.htm',
  'https://www.eia.gov/todayinenergy/detail.php?id=12345',
];
const makeFakeProvider = (urlsInLedger, metadata = testSourceUrls) => ({
  id: 'resp_test1234567',
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
  canRepair: false, groundedCount: 3, retainedCount: 2,
});
assert.deepEqual(assessBoundedRepairFeasibility(normal, '2026-10-22'), {
  canRepair: true, groundedCount: 3, retainedCount: 3,
});
assert.deepEqual(assessBoundedRepairFeasibility(ungrounded, '2026-10-22'), {
  canRepair: false, groundedCount: 3, retainedCount: 2,
});
assert.deepEqual(assessBoundedRepairFeasibility(makeFakeProvider(testSourceUrls, testSourceUrls.slice(0, 2)), '2026-10-22'), {
  canRepair: false, groundedCount: 2, retainedCount: 2,
});

const oldFetch = globalThis.fetch;
const oldToken = process.env.NEWSFEED_BEARER_TOKEN;
const oldKey = process.env.OPENAI_API_KEY;
const providerCalls = [];
try {
  process.env.NEWSFEED_BEARER_TOKEN = 'test-bearer-only';
  process.env.OPENAI_API_KEY = 'test-dummy-key-only';
  globalThis.fetch = async (url, options = {}) => {
    providerCalls.push({ url: String(url), method: options.method ?? 'GET' });
    assert.match(String(url), /\/v1\/responses\/resp_test1234567$/);
    assert.equal(options.method, 'GET', 'no mini repair or new generation may be purchased');
    return new Response(JSON.stringify(incomplete), {
      status: 200, headers: { 'Content-Type': 'application/json' },
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
  assert.equal(body.code, 'insufficient-grounded-sources');
  assert.equal(body.repairAttempts, 0);
  assert.equal(body.groundedSourceCount, 3);
  assert.equal(body.usableSourceCount, 2);
  assert.equal(providerCalls.length, 1, 'GET-only: no paid bounded repair request');
} finally {
  globalThis.fetch = oldFetch;
  if (oldToken == null) delete process.env.NEWSFEED_BEARER_TOKEN;
  else process.env.NEWSFEED_BEARER_TOKEN = oldToken;
  if (oldKey == null) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = oldKey;
}

console.log('daily grounded schema contract pass');
