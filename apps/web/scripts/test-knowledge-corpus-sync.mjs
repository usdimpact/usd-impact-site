import assert from 'node:assert/strict';
import { syncKnowledgeCorpus } from './sync-knowledge-corpus.mjs';

const dryRun = await syncKnowledgeCorpus({ apply: false });
assert.equal(dryRun.projectRef, 'ycstrcvshdluovtuasjc');
assert.ok(dryRun.rows > 0);
assert.ok(dryRun.batches > 0);
assert.equal(dryRun.apply, false);

await assert.rejects(
  () => syncKnowledgeCorpus({
    apply: true,
    environment: {
      SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
      KNOWLEDGE_SYNC_ALLOW_DEVELOPMENT: 'true',
    },
    fetchImpl: async () => { throw new Error('Production guard failed before network call.'); },
  }),
  /locked to Supabase Development/,
);

await assert.rejects(
  () => syncKnowledgeCorpus({
    apply: true,
    environment: {
      SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
      KNOWLEDGE_SYNC_ALLOW_DEVELOPMENT: 'false',
    },
    fetchImpl: async () => { throw new Error('Write guard failed before network call.'); },
  }),
  /KNOWLEDGE_SYNC_ALLOW_DEVELOPMENT=true/,
);

const calls = [];
const applied = await syncKnowledgeCorpus({
  apply: true,
  environment: {
    SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
    KNOWLEDGE_SYNC_ALLOW_DEVELOPMENT: 'true',
  },
  fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 201,
      async text() { return ''; },
    };
  },
});
assert.equal(applied.apply, true);
assert.equal(calls.length, applied.batches);
assert.ok(calls.length >= 1);
for (const call of calls) {
  assert.equal(call.url, 'https://ycstrcvshdluovtuasjc.supabase.co/rest/v1/knowledge_chunks?on_conflict=source_type,source_id,language,chunk_index');
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.headers.Prefer, 'resolution=merge-duplicates,return=minimal');
  assert.equal(call.options.headers.apikey, 'sb_secret_abcdefghijklmnopqrstuvwxyz');
  const rows = JSON.parse(call.options.body);
  assert.ok(rows.length >= 1 && rows.length <= 50);
  assert.ok(rows.every((row) => ['open', 'research'].includes(row.access_tier)));
}

console.log(`Knowledge corpus sync contract verified: ${applied.rows} rows in ${applied.batches} development-only batches.`);
