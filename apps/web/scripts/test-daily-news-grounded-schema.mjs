import assert from 'node:assert/strict';
import { withSourceMetadata } from '../api/daily-news-grounded-background.js';

const request = {
  tools: [{ type: 'web_search' }],
  input: 'Generate the Daily USD Impact bundle.',
  text: {
    format: {
      schema: {
        type: 'object',
        properties: {
          highlights: {
            type: 'array',
            items: { type: 'object' },
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
const sourceProperties = hardened.text.format.schema.properties.sources.items.properties;

assert.equal(highlights.minItems, 3, 'grounded generation must require at least three highlights');
assert.equal(highlights.maxItems, 7, 'grounded generation must allow at most seven highlights');
assert.match(highlights.description, /3-7/);
assert.match(sourceProperties.id.pattern, /^\^/);
assert.match(sourceProperties.publishedAt.pattern, /^\^/);
assert.equal(hardened.tool_choice, 'required');
assert.ok(hardened.include.includes('web_search_call.action.sources'));

const repairRequest = {
  text: {
    format: {
      schema: {
        type: 'object',
        properties: {
          highlights: { type: 'array', minItems: 1, maxItems: 20 },
        },
      },
    },
  },
};
const repairedSchema = withSourceMetadata(repairRequest).text.format.schema.properties.highlights;
assert.equal(repairedSchema.minItems, 3, 'repair schemas must not be allowed to prune below three highlights');
assert.equal(repairedSchema.maxItems, 7, 'repair schemas must not exceed seven highlights');

console.log('daily grounded schema contract pass');
