import process from 'node:process';
import { buildKnowledgeCorpus } from './build-knowledge-corpus.mjs';

const DEVELOPMENT_PROJECT_REF = 'ycstrcvshdluovtuasjc';
const BATCH_SIZE = 50;

function parseArgs(argv) {
  return Object.freeze({
    apply: argv.includes('--apply'),
  });
}

function requireDevelopmentConfig(environment = process.env) {
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
  const expectedHost = `${DEVELOPMENT_PROJECT_REF}.supabase.co`;
  if (url.hostname !== expectedHost) {
    throw new Error(`Knowledge corpus sync is locked to Supabase Development (${DEVELOPMENT_PROJECT_REF}).`);
  }
  if (!secretKey.startsWith('sb_secret_') || secretKey.length < 26) {
    throw new Error('SUPABASE_SECRET_KEY is missing or invalid.');
  }
  if (environment.KNOWLEDGE_SYNC_ALLOW_DEVELOPMENT !== 'true') {
    throw new Error('KNOWLEDGE_SYNC_ALLOW_DEVELOPMENT=true is required to write the corpus.');
  }
  return Object.freeze({ url: url.origin, secretKey });
}

function batches(rows, size = BATCH_SIZE) {
  const output = [];
  for (let index = 0; index < rows.length; index += size) output.push(rows.slice(index, index + size));
  return output;
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

async function upsertBatch({ config, rows, fetchImpl = fetch }) {
  const response = await fetchImpl(
    `${config.url}/rest/v1/knowledge_chunks?on_conflict=source_type,source_id,language,chunk_index`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        apikey: config.secretKey,
        Authorization: `Bearer ${config.secretKey}`,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    },
  );
  if (!response.ok) {
    const payload = await readJsonSafely(response);
    const detail = payload?.message || payload?.error || `HTTP ${response.status}`;
    throw new Error(`Knowledge corpus batch upsert failed: ${detail}`);
  }
}

export async function syncKnowledgeCorpus({
  apply = false,
  environment = process.env,
  fetchImpl = fetch,
} = {}) {
  const rows = await buildKnowledgeCorpus();
  const summary = Object.freeze({
    projectRef: DEVELOPMENT_PROJECT_REF,
    rows: rows.length,
    batches: Math.ceil(rows.length / BATCH_SIZE),
    apply: Boolean(apply),
  });

  if (!apply) return summary;
  const config = requireDevelopmentConfig(environment);
  for (const batch of batches(rows)) {
    await upsertBatch({ config, rows: batch, fetchImpl });
  }
  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await syncKnowledgeCorpus({ apply: args.apply });
  console.log(JSON.stringify(result));
  if (!args.apply) {
    console.log('Dry run only. Pass --apply plus Development-only credentials and KNOWLEDGE_SYNC_ALLOW_DEVELOPMENT=true to write.');
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}
