import process from 'node:process';
import { createHash } from 'node:crypto';
import { buildKnowledgeCorpus } from './build-knowledge-corpus.mjs';

const PRODUCTION_PROJECT_REF = 'gjzetjugmnwanvjkchux';
const BATCH_SIZE = 50;
const STALE_DELETE_BATCH_SIZE = 100;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;

function parseArgs(argv) {
  return Object.freeze({ apply: argv.includes('--apply') });
}

function requireCommit(value, name) {
  const commit = String(value || '').trim().toLowerCase();
  if (!COMMIT_PATTERN.test(commit)) throw new Error(`${name} must be a 40-character Git commit SHA.`);
  return commit;
}

function requireProductionConfig(environment = process.env) {
  const urlValue = String(environment.SUPABASE_URL || '').trim();
  const secretKey = String(environment.SUPABASE_SECRET_KEY || '').trim();
  if (!urlValue) throw new Error('SUPABASE_URL is required.');

  let url;
  try {
    url = new URL(urlValue);
  } catch {
    throw new Error('SUPABASE_URL is invalid.');
  }
  if (url.protocol !== 'https:') throw new Error('SUPABASE_URL must use HTTPS.');

  const expectedHost = `${PRODUCTION_PROJECT_REF}.supabase.co`;
  if (url.hostname !== expectedHost) {
    throw new Error(`Production knowledge corpus promotion is locked to Supabase Production (${PRODUCTION_PROJECT_REF}).`);
  }
  if (!secretKey.startsWith('sb_secret_') || secretKey.length < 26) {
    throw new Error('SUPABASE_SECRET_KEY is missing or invalid.');
  }
  if (environment.KNOWLEDGE_SYNC_ALLOW_PRODUCTION !== 'true') {
    throw new Error('KNOWLEDGE_SYNC_ALLOW_PRODUCTION=true is required to write the Production corpus.');
  }

  const currentCommit = requireCommit(environment.KNOWLEDGE_SYNC_CURRENT_COMMIT, 'KNOWLEDGE_SYNC_CURRENT_COMMIT');
  const approvedCommit = requireCommit(environment.KNOWLEDGE_SYNC_APPROVED_COMMIT, 'KNOWLEDGE_SYNC_APPROVED_COMMIT');
  if (currentCommit !== approvedCommit) {
    throw new Error('Approved Production corpus commit does not match the current workflow commit.');
  }

  return Object.freeze({ url: url.origin, secretKey, currentCommit });
}

function batches(rows, size) {
  const output = [];
  for (let index = 0; index < rows.length; index += size) output.push(rows.slice(index, index + size));
  return output;
}

function corpusDigest(rows) {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

function identity(row) {
  return `${row.source_type}\u0000${row.source_id}\u0000${row.language}\u0000${row.chunk_index}`;
}

function stampRows(rows, corpusVersion) {
  return rows.map((row) => ({
    ...row,
    metadata: {
      ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
      corpusVersion,
    },
  }));
}

function countTiers(rows) {
  return rows.reduce((counts, row) => {
    const tier = String(row.access_tier || 'unknown');
    counts[tier] = (counts[tier] || 0) + 1;
    return counts;
  }, {});
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

async function requestJson({ config, path, method = 'GET', body, prefer, fetchImpl = fetch }) {
  const response = await fetchImpl(`${config.url}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      apikey: config.secretKey,
      Authorization: `Bearer ${config.secretKey}`,
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await readJsonSafely(response);
  if (!response.ok) {
    const detail = payload?.message || payload?.error || `HTTP ${response.status}`;
    throw new Error(`Production knowledge corpus request failed: ${detail}`);
  }
  return payload;
}

async function upsertRows({ config, rows, fetchImpl }) {
  for (const batch of batches(rows, BATCH_SIZE)) {
    await requestJson({
      config,
      path: '/rest/v1/knowledge_chunks?on_conflict=source_type,source_id,language,chunk_index',
      method: 'POST',
      body: batch,
      prefer: 'resolution=merge-duplicates,return=minimal',
      fetchImpl,
    });
  }
}

async function readCurrentRows({ config, fetchImpl }) {
  const payload = await requestJson({
    config,
    path: '/rest/v1/knowledge_chunks?select=id,source_type,source_id,language,access_tier,chunk_index,metadata&limit=5000',
    fetchImpl,
  });
  if (!Array.isArray(payload)) throw new Error('Production knowledge corpus scan returned an invalid response.');
  return payload;
}

async function pruneStaleRows({ config, desiredRows, fetchImpl }) {
  const desired = new Set(desiredRows.map(identity));
  const current = await readCurrentRows({ config, fetchImpl });
  const staleIds = current
    .filter((row) => !desired.has(identity(row)))
    .map((row) => String(row.id || '').trim())
    .filter((value) => /^[0-9a-f-]{36}$/i.test(value));

  for (const batch of batches(staleIds, STALE_DELETE_BATCH_SIZE)) {
    if (!batch.length) continue;
    await requestJson({
      config,
      path: `/rest/v1/knowledge_chunks?id=in.(${batch.join(',')})`,
      method: 'DELETE',
      prefer: 'return=minimal',
      fetchImpl,
    });
  }
  return staleIds.length;
}

async function searchTier({ config, tier, query, fetchImpl }) {
  const payload = await requestJson({
    config,
    path: '/rest/v1/rpc/search_knowledge_chunks',
    method: 'POST',
    body: {
      query_text: query,
      allowed_access_tiers: [tier],
      match_count: 5,
      query_language: 'en',
    },
    fetchImpl,
  });
  if (!Array.isArray(payload) || payload.length < 1) {
    throw new Error(`Production ${tier} knowledge retrieval verification returned no matches.`);
  }
  if (payload.some((row) => row?.access_tier !== tier)) {
    throw new Error(`Production ${tier} knowledge retrieval verification leaked another access tier.`);
  }
  return payload.length;
}

async function verifyProductionCorpus({ config, desiredRows, corpusVersion, fetchImpl }) {
  const current = await readCurrentRows({ config, fetchImpl });
  const desiredByIdentity = new Map(desiredRows.map((row) => [identity(row), row]));
  const currentIdentities = new Set(current.map(identity));

  if (current.length !== desiredRows.length || currentIdentities.size !== desiredRows.length) {
    throw new Error(`Production knowledge corpus verification expected ${desiredRows.length} exact rows, found ${current.length}/${currentIdentities.size}.`);
  }

  for (const row of current) {
    const expected = desiredByIdentity.get(identity(row));
    if (!expected) throw new Error('Production knowledge corpus verification found an unexpected row.');
    if (row.access_tier !== expected.access_tier) {
      throw new Error('Production knowledge corpus verification found an access-tier mismatch.');
    }
    if (row.metadata?.corpusVersion !== corpusVersion) {
      throw new Error('Production knowledge corpus verification found a stale or missing corpus version stamp.');
    }
  }

  const expectedCounts = countTiers(desiredRows);
  const actualCounts = countTiers(current);
  if (JSON.stringify(actualCounts) !== JSON.stringify(expectedCounts)) {
    throw new Error('Production knowledge corpus verification found a tier-count mismatch.');
  }

  const openHits = await searchTier({ config, tier: 'open', query: 'real yield', fetchImpl });
  const researchHits = await searchTier({ config, tier: 'research', query: 'DXY', fetchImpl });

  return Object.freeze({
    totalRows: current.length,
    uniqueRows: currentIdentities.size,
    tierCounts: actualCounts,
    openHits,
    researchHits,
  });
}

export async function promoteKnowledgeCorpusToProduction({
  apply = false,
  environment = process.env,
  fetchImpl = fetch,
} = {}) {
  const sourceRows = await buildKnowledgeCorpus();
  const digest = corpusDigest(sourceRows);
  const summaryBase = {
    projectRef: PRODUCTION_PROJECT_REF,
    rows: sourceRows.length,
    batches: Math.ceil(sourceRows.length / BATCH_SIZE),
    digest,
    apply: Boolean(apply),
  };

  if (!apply) return Object.freeze({ ...summaryBase, pruned: 0, corpusVersion: null, verification: null });

  const config = requireProductionConfig(environment);
  const rows = stampRows(sourceRows, config.currentCommit);

  // Additive-first: every desired row must upsert successfully before stale rows are considered for deletion.
  await upsertRows({ config, rows, fetchImpl });
  const pruned = await pruneStaleRows({ config, desiredRows: rows, fetchImpl });
  const verification = await verifyProductionCorpus({
    config,
    desiredRows: rows,
    corpusVersion: config.currentCommit,
    fetchImpl,
  });

  return Object.freeze({
    ...summaryBase,
    pruned,
    corpusVersion: config.currentCommit,
    verification,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await promoteKnowledgeCorpusToProduction({ apply: args.apply });
  console.log(JSON.stringify(result));
  if (!args.apply) {
    console.log('Dry run only. Production writes require --apply, exact Production credentials, an explicit allow flag, and matching approved/current Git commit SHAs.');
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}
