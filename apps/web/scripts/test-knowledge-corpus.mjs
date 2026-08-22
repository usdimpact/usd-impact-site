import assert from 'node:assert/strict';
import { buildKnowledgeCorpus } from './build-knowledge-corpus.mjs';

const rows = await buildKnowledgeCorpus();
assert.ok(rows.length > 0, 'Expected at least one published knowledge chunk.');
assert.ok(rows.some((row) => row.source_type === 'daily' && row.access_tier === 'open'));
assert.ok(rows.some((row) => row.source_type === 'weekly_report' && row.access_tier === 'research'));

const identities = new Set();
for (const row of rows) {
  assert.ok(['open', 'library', 'research', 'internal'].includes(row.access_tier));
  assert.ok(['en', 'es'].includes(row.language));
  assert.ok(row.source_path.startsWith('/'));
  assert.ok(row.content.length >= 1 && row.content.length <= 6000);
  assert.ok(row.title.length >= 1 && row.title.length <= 500);
  assert.ok(row.source_id.length >= 1 && row.source_id.length <= 240);
  assert.notEqual(row.metadata.collection, 'products');
  assert.doesNotMatch(row.content, /^---\s*$/m, 'Frontmatter delimiter leaked into retrieval content.');
  const identity = [row.source_type, row.source_id, row.language, row.chunk_index].join('|');
  assert.equal(identities.has(identity), false, `Duplicate knowledge chunk identity: ${identity}`);
  identities.add(identity);
}

const sorted = [...rows].sort((a, b) =>
  a.source_type.localeCompare(b.source_type)
  || a.source_id.localeCompare(b.source_id)
  || a.language.localeCompare(b.language)
  || a.chunk_index - b.chunk_index);
assert.deepEqual(rows, sorted, 'Knowledge corpus ordering must remain deterministic.');

console.log(`Knowledge corpus contract verified: ${rows.length} chunks.`);
