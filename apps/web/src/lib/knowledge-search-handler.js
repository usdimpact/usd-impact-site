import { readSessionAccessToken } from './supabase-auth.js';
import { searchKnowledgeChunks } from './knowledge-retrieval.js';
import { readAccountAccessState, safeSupabaseError, sendJson } from './supabase-server.js';

const MAX_BODY_BYTES = 4_096;
const MAX_EXCERPT_CHARS = 1_200;
const DEFAULT_MATCH_COUNT = 8;
const MAX_MATCH_COUNT = 12;

function header(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? '' : String(value ?? '');
}

function parseBody(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    const encoded = JSON.stringify(request.body);
    if (Buffer.byteLength(encoded, 'utf8') > MAX_BODY_BYTES) throw new TypeError('Request body is too large.');
    return request.body;
  }
  if (typeof request.body === 'string' || Buffer.isBuffer(request.body)) {
    const text = request.body.toString();
    if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) throw new TypeError('Request body is too large.');
    return JSON.parse(text);
  }
  return {};
}

function normalizeMatchCount(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_MATCH_COUNT;
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > MAX_MATCH_COUNT) {
    throw new TypeError(`Knowledge result count must be between 1 and ${MAX_MATCH_COUNT}.`);
  }
  return count;
}

function normalizeLanguage(value) {
  if (value === undefined || value === null || value === '') return 'en';
  const language = String(value).trim().toLowerCase();
  if (!['en', 'es'].includes(language)) throw new TypeError('Knowledge query language is invalid.');
  return language;
}

function excerpt(value) {
  const content = String(value || '').trim();
  if (content.length <= MAX_EXCERPT_CHARS) return Object.freeze({ text: content, truncated: false });
  const sliced = content.slice(0, MAX_EXCERPT_CHARS);
  const boundary = Math.max(sliced.lastIndexOf('\n'), sliced.lastIndexOf('. '), sliced.lastIndexOf(' '));
  const text = (boundary >= 700 ? sliced.slice(0, boundary + 1) : sliced).trimEnd();
  return Object.freeze({ text: `${text}…`, truncated: true });
}

function publicResult(row) {
  const summary = excerpt(row.content);
  return Object.freeze({
    title: row.title,
    sourcePath: row.sourcePath,
    sourceType: row.sourceType,
    accessTier: row.accessTier,
    chunkIndex: row.chunkIndex,
    publishedAt: row.publishedAt,
    excerpt: summary.text,
    excerptTruncated: summary.truncated,
  });
}

async function authorizedTiers({ accessToken, readAccessState }) {
  if (!accessToken) return Object.freeze({ tiers: ['open'], paid: false });
  try {
    const state = await readAccessState({ accessToken });
    if (state.allowed) return Object.freeze({ tiers: ['open', 'research'], paid: true });
  } catch {
    // A stale or invalid optional session must never widen access. Public search
    // remains available at the open tier while paid access fails closed.
  }
  return Object.freeze({ tiers: ['open'], paid: false });
}

export async function handleKnowledgeSearchRequest(request, response, options = {}) {
  if (process.env.KNOWLEDGE_SEARCH_ENABLED !== 'true') {
    return sendJson(response, 404, {
      error: 'Knowledge search is not enabled.',
      code: 'KNOWLEDGE_SEARCH_DISABLED',
    });
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }
  if (header(request, 'sec-fetch-site') === 'cross-site') {
    return sendJson(response, 403, { error: 'Cross-site requests are not allowed.', code: 'CROSS_SITE_REQUEST' });
  }
  if (!header(request, 'content-type').includes('application/json')) {
    return sendJson(response, 415, { error: 'Content type must be application/json.', code: 'INVALID_CONTENT_TYPE' });
  }

  let payload;
  try {
    payload = parseBody(request);
  } catch (error) {
    return sendJson(response, 400, {
      error: error instanceof Error ? error.message : 'Invalid request body.',
      code: 'INVALID_REQUEST_BODY',
    });
  }

  try {
    const matchCount = normalizeMatchCount(payload.matchCount);
    const language = normalizeLanguage(payload.language);
    const accessToken = readSessionAccessToken(request);
    const access = await authorizedTiers({
      accessToken,
      readAccessState: options.readAccessState || readAccountAccessState,
    });
    const rows = await (options.searchKnowledge || searchKnowledgeChunks)({
      query: payload.query,
      allowedAccessTiers: access.tiers,
      matchCount,
      language,
    });
    return sendJson(response, 200, {
      ok: true,
      mode: 'retrieval',
      access: access.paid ? 'research' : 'open',
      query: String(payload.query || '').trim(),
      results: rows.map(publicResult),
      notice: 'Source retrieval only. Results are excerpts from the USD Impact corpus, not a generated investment recommendation.',
    });
  } catch (error) {
    if (error instanceof TypeError || error instanceof SyntaxError) {
      return sendJson(response, 400, {
        error: error.message,
        code: 'INVALID_KNOWLEDGE_SEARCH',
      });
    }
    const safe = safeSupabaseError(error);
    return sendJson(response, safe.status, safe.payload);
  }
}
