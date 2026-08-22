import {
  readSupabaseServerConfig,
  SupabaseConfigurationError,
  SupabaseRequestError,
} from './supabase-server.js';

const ACCESS_TIERS = new Set(['open', 'library', 'research', 'internal']);
const LANGUAGES = new Set(['en', 'es']);

function normalizeQuery(value) {
  const query = String(value || '').trim();
  if (query.length < 2 || query.length > 500) {
    throw new TypeError('Knowledge query must be between 2 and 500 characters.');
  }
  return query;
}

function normalizeTiers(values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 4) {
    throw new TypeError('At least one authorized knowledge access tier is required.');
  }
  const tiers = [...new Set(values.map((value) => String(value || '').trim().toLowerCase()))];
  if (tiers.some((tier) => !ACCESS_TIERS.has(tier))) {
    throw new TypeError('Knowledge access tier is invalid.');
  }
  return tiers;
}

function normalizeLanguage(value) {
  if (value === null || value === undefined || value === '') return null;
  const language = String(value).trim().toLowerCase();
  if (!LANGUAGES.has(language)) throw new TypeError('Knowledge query language is invalid.');
  return language;
}

function normalizeMatchCount(value) {
  const count = Number(value ?? 8);
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new TypeError('Knowledge match count must be between 1 and 20.');
  }
  return count;
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

function normalizeResult(row, allowedTiers) {
  if (!row || typeof row !== 'object' || !allowedTiers.has(row.access_tier)) {
    throw new SupabaseRequestError('Knowledge search returned an unauthorized or invalid row.', {
      status: 502,
      code: 'KNOWLEDGE_RESULT_INVALID',
    });
  }
  return Object.freeze({
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourcePath: row.source_path,
    title: row.title,
    content: row.content,
    language: row.language,
    accessTier: row.access_tier,
    chunkIndex: row.chunk_index,
    publishedAt: row.published_at ?? null,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    rank: Number(row.rank ?? 0),
  });
}

export async function searchKnowledgeChunks({
  query,
  allowedAccessTiers = ['open'],
  matchCount = 8,
  language = null,
  environment,
  config,
  fetchImpl = fetch,
} = {}) {
  const normalizedQuery = normalizeQuery(query);
  const tiers = normalizeTiers(allowedAccessTiers);
  const count = normalizeMatchCount(matchCount);
  const normalizedLanguage = normalizeLanguage(language);
  const resolvedConfig = config || readSupabaseServerConfig(environment, { requireSecret: true });
  if (!resolvedConfig.secretKey) {
    throw new SupabaseConfigurationError('SUPABASE_SECRET_KEY is required for knowledge retrieval.');
  }

  const response = await fetchImpl(`${resolvedConfig.url}/rest/v1/rpc/search_knowledge_chunks`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: resolvedConfig.secretKey,
      Authorization: `Bearer ${resolvedConfig.secretKey}`,
    },
    body: JSON.stringify({
      query_text: normalizedQuery,
      allowed_access_tiers: tiers,
      match_count: count,
      query_language: normalizedLanguage,
    }),
  });
  const payload = await readJsonSafely(response);
  if (!response.ok) {
    throw new SupabaseRequestError(
      payload?.message || payload?.error || 'Knowledge retrieval failed.',
      {
        status: response.status,
        code: payload?.code || 'KNOWLEDGE_RETRIEVAL_FAILED',
        details: payload,
      },
    );
  }
  if (!Array.isArray(payload)) {
    throw new SupabaseRequestError('Knowledge retrieval returned an invalid response.', {
      status: 502,
      code: 'KNOWLEDGE_RESPONSE_INVALID',
    });
  }
  const allowed = new Set(tiers);
  return Object.freeze(payload.map((row) => normalizeResult(row, allowed)));
}
