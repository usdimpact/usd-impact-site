import assert from 'node:assert/strict';
import { searchKnowledgeChunks } from '../src/lib/knowledge-retrieval.js';

const config = {
  url: 'https://example.supabase.co',
  publishableKey: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  secretKey: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
};

function response({ ok = true, status = 200, payload = [] } = {}) {
  return {
    ok,
    status,
    async text() {
      return JSON.stringify(payload);
    },
  };
}

const calls = [];
const results = await searchKnowledgeChunks({
  query: 'real yields gold',
  allowedAccessTiers: ['open', 'research', 'open'],
  matchCount: 5,
  language: 'en',
  config,
  fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return response({ payload: [{
      id: '123e4567-e89b-42d3-a456-426614174000',
      source_type: 'lesson',
      source_id: 'gold-real-yields',
      source_path: '/gold/usd-gold/',
      title: 'Gold and real yields',
      content: 'Gold often responds to changes in real yields.',
      language: 'en',
      access_tier: 'open',
      chunk_index: 0,
      published_at: '2026-08-01T00:00:00.000Z',
      metadata: { section: 'drivers' },
      rank: 0.82,
    }] });
  },
});

assert.equal(calls.length, 1);
assert.equal(calls[0].url, 'https://example.supabase.co/rest/v1/rpc/search_knowledge_chunks');
assert.equal(calls[0].options.method, 'POST');
assert.equal(calls[0].options.headers.apikey, config.secretKey);
assert.deepEqual(JSON.parse(calls[0].options.body), {
  query_text: 'real yields gold',
  allowed_access_tiers: ['open', 'research'],
  match_count: 5,
  query_language: 'en',
});
assert.deepEqual(results.map((row) => [row.sourceId, row.accessTier, row.rank]), [
  ['gold-real-yields', 'open', 0.82],
]);

await assert.rejects(
  () => searchKnowledgeChunks({
    query: 'gold',
    allowedAccessTiers: ['open'],
    config,
    fetchImpl: async () => response({ payload: [{
      id: 'x',
      source_type: 'book',
      source_id: 'paid',
      source_path: '/book/',
      title: 'Paid',
      content: 'Paid content',
      language: 'en',
      access_tier: 'research',
      chunk_index: 0,
      metadata: {},
      rank: 1,
    }] }),
  }),
  (error) => error?.code === 'KNOWLEDGE_RESULT_INVALID',
);

await assert.rejects(
  () => searchKnowledgeChunks({
    query: 'gold',
    allowedAccessTiers: ['open'],
    config,
    fetchImpl: async () => response({ ok: false, status: 503, payload: { code: 'TEMPORARY_FAILURE' } }),
  }),
  (error) => error?.code === 'TEMPORARY_FAILURE' && error?.status === 503,
);

assert.throws(() => searchKnowledgeChunks({ query: 'x', config }), /between 2 and 500/);
assert.throws(() => searchKnowledgeChunks({ query: 'gold', allowedAccessTiers: ['admin'], config }), /access tier is invalid/);
assert.throws(() => searchKnowledgeChunks({ query: 'gold', matchCount: 21, config }), /between 1 and 20/);
assert.throws(() => searchKnowledgeChunks({ query: 'gold', language: 'fr', config }), /language is invalid/);

console.log('Knowledge retrieval contract verified.');
