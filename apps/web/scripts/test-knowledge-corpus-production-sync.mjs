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
assert.equal(dryRun.verification, null);

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
const uploadedRows = [];
let stalePresent = true;
let scanCount = 0;
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

    if (url.endsWith('/rest/v1/rpc/search_knowledge_chunks')) {
      assert.equal(options.method, 'POST');
      const body = JSON.parse(options.body);
      const tier = body.allowed_access_tiers?.[0];
      assert.ok(['open', 'research'].includes(tier));
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify([{
            source_type: tier === 'open' ? 'lesson' : 'weekly_report',
            source_id: `${tier}-result`,
            source_path: tier === 'open' ? '/learn/real-yield/' : '/reports/weekly/2026-08-14/',
            title: `${tier} result`,
            content: 'Verified test result.',
            language: 'en',
            access_tier: tier,
            chunk_index: 0,
            metadata: {},
            rank: 1,
          }]);
        },
      };
    }

    if (options.method === 'POST') {
      assert.match(url, /knowledge_chunks\?on_conflict=/);
      const rows = JSON.parse(options.body);
      assert.ok(rows.length >= 1 && rows.length <= 50);
      assert.ok(rows.every((row) => row.metadata?.corpusVersion === commit));
      assert.ok(rows.every((row) => ['open', 'research'].includes(row.access_tier)));
      uploadedRows.push(...rows);
      return { ok: true, status: 201, async text() { return ''; } };
    }

    if (options.method === 'DELETE') {
      assert.match(url, /knowledge_chunks\?id=in\.\(/);
      assert.match(url, /22222222-2222-4222-8222-222222222222/);
      stalePresent = false;
      return { ok: true, status: 204, async text() { return ''; } };
    }

    scanCount += 1;
    assert.match(url, /knowledge_chunks\?select=id,source_type,source_id,language,access_tier,chunk_index,metadata&limit=5000$/);
    const current = uploadedRows.map((row) => ({
      id: '11111111-1111-4111-8111-111111111111',
      source_type: row.source_type,
      source_id: row.source_id,
      language: row.language,
      access_tier: row.access_tier,
      chunk_index: row.chunk_index,
      metadata: row.metadata,
    }));
    if (stalePresent) {
      current.push({
        id: '22222222-2222-4222-8222-222222222222',
        source_type: 'lesson',
        source_id: 'stale-source',
        language: 'en',
        access_tier: 'open',
        chunk_index: 0,
        metadata: { corpusVersion: '74333d08aef2dd8f64041862b46cc863581125d7' },
      });
    }
    return { ok: true, status: 200, async text() { return JSON.stringify(current); } };
  },
});

assert.equal(applied.apply, true);
assert.equal(applied.rows, 442);
assert.equal(applied.batches, 9);
assert.equal(applied.pruned, 1);
assert.equal(applied.corpusVersion, commit);
assert.equal(applied.verification.totalRows, 442);
assert.equal(applied.verification.uniqueRows, 442);
assert.deepEqual(applied.verification.tierCounts, { open: 430, research: 12 });
assert.equal(applied.verification.openHits, 1);
assert.equal(applied.verification.researchHits, 1);
assert.equal(calls.filter((call) => call.url.includes('knowledge_chunks?on_conflict=')).length, 9);
assert.equal(calls.filter((call) => call.url.endsWith('/rest/v1/rpc/search_knowledge_chunks')).length, 2);
assert.equal(calls.filter((call) => !call.options.method).length, 2);
assert.equal(calls.filter((call) => call.options.method === 'DELETE').length, 1);
assert.equal(scanCount, 2);

let failedPosts = 0;
let deleteAttempted = false;
let scanAttempted = false;
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
    fetchImpl: async (url, options = {}) => {
      if (options.method === 'DELETE') deleteAttempted = true;
      if (!options.method) scanAttempted = true;
      if (options.method === 'POST' && url.includes('knowledge_chunks?on_conflict=')) {
        failedPosts += 1;
        if (failedPosts === 2) {
          return { ok: false, status: 503, async text() { return JSON.stringify({ message: 'simulated failure' }); } };
        }
        return { ok: true, status: 201, async text() { return ''; } };
      }
      throw new Error('No read, delete, or search may occur after an incomplete upsert sequence.');
    },
  }),
  /simulated failure/,
);
assert.equal(deleteAttempted, false);
assert.equal(scanAttempted, false);

console.log(`Production knowledge corpus promotion contract verified: ${applied.rows} rows, ${applied.batches} additive-first batches, exact post-write parity, and isolated Open/Research retrieval.`);
