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
const repaired = withSourceMetadata(repairRequest).text.format.schema.properties;
assert.equal(repaired.highlights.minItems, 3, 'repair schemas must not prune below three highlights');
assert.equal(repaired.highlights.maxItems, 7, 'repair schemas must not exceed seven highlights');
assert.deepEqual(repaired.catalysts.items.properties.date.enum, catalystWindow);
assert.equal('pattern' in repaired.catalysts.items.properties.date, false);

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

console.log('daily grounded schema contract pass');
