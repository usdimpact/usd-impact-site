import backgroundHandler from './daily-news-background.js';
import {
  SOURCE_DATE_RULES,
  SOURCE_DATE_SCHEMA_PATTERN,
  normalizeBundleDraft,
} from './daily-news-validation.js';

const OPENAI_RESPONSES_API = 'https://api.openai.com/v1/responses';
const WEB_SEARCH_SOURCES_INCLUDE = 'web_search_call.action.sources';
const GROUNDED_SOURCE_RULES = [
  'Use web search results from at least two distinct source URLs before producing the bundle.',
  'The source ledger must contain at least two distinct URLs returned by the web search tool metadata.',
  'Do not finish the response with only one grounded URL; continue researching across approved domains.',
  'Never invent, reconstruct, or substitute a URL that was not returned by web search.',
].join(' ');

let runtimeOverrideQueue = Promise.resolve();

function requestUrl(input) {
  if (typeof input === 'string' || input instanceof URL) return new URL(input);
  if (input && typeof input.url === 'string') return new URL(input.url);
  return null;
}

function requestMethod(input, options) {
  return String(options?.method ?? input?.method ?? 'GET').toUpperCase();
}

function includesWebSearch(body) {
  return Array.isArray(body?.tools) && body.tools.some((tool) => tool?.type === 'web_search');
}

function withSourceMetadata(body) {
  const include = Array.isArray(body.include) ? body.include : [];
  const next = {
    ...body,
    tool_choice: 'required',
    include: [...new Set([...include, WEB_SEARCH_SOURCES_INCLUDE])],
  };

  if (typeof next.input === 'string') {
    const additions = [];
    if (!next.input.includes(SOURCE_DATE_RULES)) additions.push(SOURCE_DATE_RULES);
    if (!next.input.includes(GROUNDED_SOURCE_RULES)) additions.push(GROUNDED_SOURCE_RULES);
    if (additions.length > 0) next.input = `${next.input}\n- ${additions.join('\n- ')}`;
  }

  const sourceDateSchema = next.text?.format?.schema?.properties?.sources?.items?.properties?.publishedAt;
  if (sourceDateSchema && typeof sourceDateSchema === 'object') {
    sourceDateSchema.pattern = SOURCE_DATE_SCHEMA_PATTERN;
    sourceDateSchema.description = 'Verified source publication date in YYYY-MM-DD format.';
  }

  return next;
}

function normalizeOutputText(openAiResponse) {
  if (!openAiResponse || typeof openAiResponse !== 'object') return openAiResponse;

  return {
    ...openAiResponse,
    output: (openAiResponse.output ?? []).map((item) => {
      if (item?.type !== 'message') return item;
      return {
        ...item,
        content: (item.content ?? []).map((part) => {
          if (part?.type !== 'output_text' || typeof part.text !== 'string') return part;
          try {
            const draft = JSON.parse(part.text);
            return { ...part, text: JSON.stringify(normalizeBundleDraft(draft)) };
          } catch {
            return part;
          }
        }),
      };
    }),
  };
}

async function normalizeProviderResponse(providerResponse) {
  const raw = await providerResponse.text();
  let payload;
  try {
    payload = normalizeOutputText(JSON.parse(raw));
  } catch {
    return new Response(raw, {
      status: providerResponse.status,
      headers: providerResponse.headers,
    });
  }

  return new Response(JSON.stringify(payload), {
    status: providerResponse.status,
    headers: providerResponse.headers,
  });
}

function groundedFetch(realFetch) {
  return async (input, options = {}) => {
    const url = requestUrl(input);
    if (!url || url.origin !== 'https://api.openai.com') return realFetch(input, options);

    const method = requestMethod(input, options);
    if (method === 'POST' && url.pathname === '/v1/responses') {
      let body;
      try {
        body = JSON.parse(String(options.body ?? '{}'));
      } catch {
        return realFetch(input, options);
      }

      if (!includesWebSearch(body)) return realFetch(input, options);
      return realFetch(input, {
        ...options,
        body: JSON.stringify(withSourceMetadata(body)),
      });
    }

    if (method === 'GET' && /^\/v1\/responses\/resp_[A-Za-z0-9_-]+$/.test(url.pathname)) {
      url.searchParams.append('include[]', WEB_SEARCH_SOURCES_INCLUDE);
      const providerResponse = await realFetch(url, options);
      return normalizeProviderResponse(providerResponse);
    }

    return realFetch(input, options);
  };
}

export const config = { maxDuration: 300 };

export default async function handler(request, response) {
  let release;
  const previous = runtimeOverrideQueue;
  runtimeOverrideQueue = new Promise((resolve) => {
    release = resolve;
  });
  await previous;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = groundedFetch(originalFetch);
  try {
    return await backgroundHandler(request, response);
  } finally {
    globalThis.fetch = originalFetch;
    release();
  }
}
