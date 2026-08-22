import assert from 'node:assert/strict';
import { promoteKnowledgeCorpusToProduction } from './sync-knowledge-corpus-production.mjs';

const productionUrl = 'https://gjzetjugmnwanvjkchux.supabase.co';
const developmentUrl = 'https://ycstrcvshdluovtuasjc.supabase.co';
const secretKey = 'sb_secret_abcdefghijklmnopqrstuvwxyz';
const commit = '5d0956b4183cc58eb9d3e7e20e0daaafcd267514';

const dryRun = await promoteKnowledgeCorpusToProduction({ apply: false });
assert.equal(dryRun.projectRef, 'gjzetjugmnwanvjkchux');
assert.equal(dryRun.rows, 442);
assert.equal(dryRun.batches, 9);
assert.equal(dryRun.apply, false);
assert.match(dryRun.digest, /^[0-9a-f]{64}$/);
assert.equal(dryRun.pruned, 0);
assert.equal(dryRun.corpusVersion, null);

await assert.rejects(
  () => promoteKnowledgeCorpusToProduction({
    apply: true,
    environment: {
      SUPABASE_URL: developmentUrl,
      SUPABASE_SECRET_KEY: secretKey,
      KNOWLEDGE_SYNC_ALLOW_PRODUCTION: 'true',
      KNOWLEDGE_SYNC_CURRENT_COMMIT: commit,
      KNOWLEDGE_SYNC_APPROVED_COMMIT: commit,
    },
    fetchImpl: async () => { throw new Error('Production project guard failed before network call.'); },
  }),
  /locked to Supabase Production/,
);

await assert.rejects(
  () => promoteKnowledgeCorpusToProduction({
    apply: true,
    environment: {
      SUPABASE_URL: productionUrl,
      SUPABASE_SECRET_KEY: secretKey,
      KNOWLEDGE_SYNC_ALLOW_PRODUCTION: 'false',
      KNOWLEDGE_SYNC_CURRENT_COMMIT: commit,
      KNOWLEDGE_SYNC_APPROVED_COMMIT: commit,
    },
    fetchImpl: async () => { throw new Error('Production allow guard failed before network call.'); },
  }),
  /KNOWLEDGE_SYNC_ALLOW_PRODUCTION=true/,
);

await assert.rejects(
  () => promoteKnowledgeCorpusToProduction({
    apply: true,
    environment: {
      SUPABASE_URL: productionUrl,
      SUPABASE_SECRET_KEY: secretKey,
      KNOWLEDGE_SYNC_ALLOW_PRODUCTION: 'true',
      KNOWLEDGE_SYNC_CURRENT_COMMIT: commit,
      KNOWLEDGE_SYNC_APPROVED_COMMIT: '74333d08aef2dd8f64041862b46cc863581125d7',
    },
    fetchImpl: async () => { throw new Error('Commit gate failed before network call.'); },
  }),
  /does not match the current workflow commit/,
);

const calls = [];
let desiredIdentity = null;
const applied = await promoteKnowledgeCorpusToProduction({
  apply: true,
  environment: {
    SUPABASE_URL: productionUrl,
    SUPABASE_SECRET_KEY: secretKey,
    KNOWLEDGE_SYNC_ALLOW_PRODUCTION: 'true',
    KNOWLEDGE_SYNC_CURRENT_COMMIT: commit,
    KNOWLEDGE_SYNC_APPROVED_COMMIT: commit,
  },
  fetchImpl: async (url, options = {}) => {
    calls.push({ url, options });
    if (options.method === 'POST') {
      const rows = JSON.parse(options.body);
      assert.ok(rows.length >= 1 && rows.length <= 50);
      assert.ok(rows.every((row) => row.metadata?.corpusVersion === commit));
      assert.ok(rows.every((row) => ['open', 'research'].includes(row.access_tier)));
      if (!desiredIdentity) {
        desiredIdentity = {
          id: '11111111-1111-4111-8111-111111111111',
          source_type: rows[0].source_type,
          source_id: rows[0].source_id,
          language: rows[0].language,
          chunk_index: rows[0].chunk_index,
        };
      }
      return { ok: true, status: 201, async text() { return ''; } };
    }
    if (options.method === 'DELETE') {
      assert.match(url, /knowledge_chunks\?id=in\.\(/);
      assert.match(url, /22222222-2222-4222-8222-222222222222/);
      return { ok: true, status: 204, async text() { return ''; } };
    }
    assert.match(url, /knowledge_chunks\?select=id,source_type,source_id,language,chunk_index&limit=5000$/);
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify([
          desiredIdentity,
          {
            id: '22222222-2222-4222-8222-222222222222',
            source_type: 'lesson',
            source_id: 'stale-source',
            language: 'en',
            chunk_index: 0,
          },
        ]);
      },
    };
  },
});

assert.equal(applied.apply, true);
assert.equal(applied.rows, 442);
assert.equal(applied.batches, 9);
assert.equal(applied.pruned, 1);
assert.equal(applied.corpusVersion, commit);
assert.equal(calls.filter((call) => call.options.method === 'POST').length, 9);
assert.equal(calls.filter((call) => !call.options.method).length, 1);
assert.equal(calls.filter((call) => call.options.method === 'DELETE').length, 1);

let failedPosts = 0;
let deleteAttempted = false;
await assert.rejects(
  () => promoteKnowledgeCorpusToProduction({
    apply: true,
    environment: {
      SUPABASE_URL: productionUrl,
      SUPABASE_SECRET_KEY: secretKey,
      KNOWLEDGE_SYNC_ALLOW_PRODUCTION: 'true',
      KNOWLEDGE_SYNC_CURRENT_COMMIT: commit,
      KNOWLEDGE_SYNC_APPROVED_COMMIT: commit,
    },
    fetchImpl: async (_url, options = {}) => {
      if (options.method === 'DELETE') deleteAttempted = true;
      if (options.method === 'POST') {
        failedPosts += 1;
        if (failedPosts === 2) {
          return { ok: false, status: 503, async text() { return JSON.stringify({ message: 'simulated failure' }); } };
        }
        return { ok: true, status: 201, async text() { return ''; } };
      }
      throw new Error('Identity scan must not occur after an upsert failure.');
    },
  }),
  /simulated failure/,
);
assert.equal(deleteAttempted, false);

console.log(`Production knowledge corpus promotion contract verified: ${applied.rows} rows, ${applied.batches} additive-first batches, stale pruning only after successful upserts.`);
