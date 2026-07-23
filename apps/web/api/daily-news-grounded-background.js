import backgroundHandler from './daily-news-background.js';

const OPENAI_RESPONSES_API = 'https://api.openai.com/v1/responses';
const WEB_SEARCH_SOURCES_INCLUDE = 'web_search_call.action.sources';

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
  return {
    ...body,
    tool_choice: 'required',
    include: [...new Set([...include, WEB_SEARCH_SOURCES_INCLUDE])],
  };
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
      url.searchParams.append('include', WEB_SEARCH_SOURCES_INCLUDE);
      return realFetch(url, options);
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
