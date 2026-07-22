import { timingSafeEqual } from 'node:crypto';
import sourceHandler from './daily-news-source.js';

const OPENAI_RESPONSES_API = 'https://api.openai.com/v1/responses';
const RESPONSE_ID_PATTERN = /^resp_[A-Za-z0-9_-]{8,200}$/;
const ACTIVE_STATUSES = new Set(['queued', 'in_progress']);
const TERMINAL_FAILURE_STATUSES = new Set(['cancelled', 'failed', 'incomplete']);
const MAX_BACKGROUND_OUTPUT_TOKENS = 7_000;

let runtimeOverrideQueue = Promise.resolve();

function requestHeader(request, name) {
  const headers = request.headers ?? {};
  if (typeof headers.get === 'function') return headers.get(name) ?? '';
  const value = headers[name.toLowerCase()] ?? headers[name];
  return Array.isArray(value) ? value[0] ?? '' : String(value ?? '');
}

function bearerToken(request) {
  const authorization = requestHeader(request, 'authorization');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? '';
}

function safeTokenEqual(actual, expected) {
  const actualBuffer = Buffer.from(String(actual ?? ''));
  const expectedBuffer = Buffer.from(String(expected ?? ''));
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function queryParam(request, name) {
  const direct = request.query?.[name];
  if (Array.isArray(direct)) return String(direct[0] ?? '').trim();
  if (direct !== undefined && direct !== null) return String(direct).trim();
  try {
    const url = new URL(request.url ?? '/', 'https://usd-impact.com');
    return url.searchParams.get(name)?.trim() ?? '';
  } catch {
    return '';
  }
}

function utcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && utcDateString(date) === value;
}

function sendJson(response, body, status = 200, extraHeaders = {}) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);
  response.end(JSON.stringify(body));
}

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    },
    end(body = '') {
      this.body = String(body);
    },
  };
}

function sourceRequest(request, date) {
  return {
    method: 'GET',
    url: `/api/daily-news-source?date=${encodeURIComponent(date)}`,
    query: { date },
    headers: request.headers ?? {},
  };
}

async function withRuntimeOverride(makeFetch, suppressExpectedStatusError, task) {
  let release;
  const previous = runtimeOverrideQueue;
  runtimeOverrideQueue = new Promise((resolve) => {
    release = resolve;
  });
  await previous;

  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  globalThis.fetch = makeFetch(originalFetch);
  if (suppressExpectedStatusError) {
    console.error = (...args) => {
      const message = args.map((value) => String(value)).join(' ');
      if (!message.includes('OpenAI response did not complete:')) originalConsoleError(...args);
    };
  }

  try {
    return await task();
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    release();
  }
}

async function startBackgroundResponse(request, response, date) {
  let providerPayload = null;
  const recorder = responseRecorder();

  await withRuntimeOverride(
    (realFetch) => async (url, options = {}) => {
      if (String(url) !== OPENAI_RESPONSES_API) return realFetch(url, options);

      let body;
      try {
        body = JSON.parse(String(options.body ?? '{}'));
      } catch {
        return new Response(JSON.stringify({ error: { message: 'Invalid OpenAI request body.' } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      body.background = true;
      body.store = true;
      body.max_output_tokens = Math.min(
        Number.isFinite(body.max_output_tokens) ? body.max_output_tokens : MAX_BACKGROUND_OUTPUT_TOKENS,
        MAX_BACKGROUND_OUTPUT_TOKENS,
      );
      for (const tool of body.tools ?? []) {
        if (tool?.type === 'web_search') tool.search_context_size = 'medium';
      }

      const providerResponse = await realFetch(url, {
        ...options,
        body: JSON.stringify(body),
      });
      const raw = await providerResponse.text();
      try {
        providerPayload = JSON.parse(raw);
      } catch {
        providerPayload = null;
      }
      return new Response(raw, {
        status: providerResponse.status,
        headers: providerResponse.headers,
      });
    },
    true,
    () => sourceHandler(sourceRequest(request, date), recorder),
  );

  if (!providerPayload?.id || !RESPONSE_ID_PATTERN.test(providerPayload.id)) {
    console.error(`Daily news background start failed with source status ${recorder.statusCode}.`);
    return sendJson(response, { error: 'Daily news background generation could not be started.' }, 502);
  }

  return sendJson(response, {
    id: providerPayload.id,
    status: providerPayload.status ?? 'queued',
    date,
    model: providerPayload.model ?? process.env.OPENAI_NEWS_MODEL ?? 'gpt-5',
  }, 202, {
    'Retry-After': '20',
  });
}

async function retrieveOpenAiResponse(apiKey, responseId) {
  const providerResponse = await fetch(`${OPENAI_RESPONSES_API}/${encodeURIComponent(responseId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  const raw = await providerResponse.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error(`OpenAI returned invalid JSON with status ${providerResponse.status}`);
  }
  if (!providerResponse.ok) {
    throw new Error(payload?.error?.message ?? `OpenAI retrieval failed with status ${providerResponse.status}`);
  }
  return payload;
}

async function normalizeCompletedResponse(request, response, date, openAiResponse) {
  const recorder = responseRecorder();
  await withRuntimeOverride(
    () => async () => new Response(JSON.stringify(openAiResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
    false,
    () => sourceHandler(sourceRequest(request, date), recorder),
  );

  response.statusCode = recorder.statusCode;
  for (const [name, value] of Object.entries(recorder.headers)) response.setHeader(name, value);
  response.end(recorder.body);
}

export const config = { maxDuration: 60 };

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    return sendJson(response, { error: 'Method not allowed.' }, 405, { Allow: 'GET, POST' });
  }

  const endpointToken = process.env.NEWSFEED_BEARER_TOKEN;
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!endpointToken || !openAiApiKey) {
    console.error('Daily news background configuration is incomplete.');
    return sendJson(response, { error: 'Daily news background generation is not configured.' }, 503);
  }
  if (!safeTokenEqual(bearerToken(request), endpointToken)) {
    return sendJson(response, { error: 'Unauthorized.' }, 401, { 'WWW-Authenticate': 'Bearer' });
  }

  const date = queryParam(request, 'date') || utcDateString();
  if (!isRealDate(date)) return sendJson(response, { error: 'date must use YYYY-MM-DD.' }, 400);

  if (request.method === 'POST') {
    try {
      return await startBackgroundResponse(request, response, date);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error(`Daily news background start failed: ${message}`);
      return sendJson(response, { error: 'Daily news background generation could not be started.' }, 502);
    }
  }

  const responseId = queryParam(request, 'response_id');
  if (!RESPONSE_ID_PATTERN.test(responseId)) {
    return sendJson(response, { error: 'A valid response_id is required.' }, 400);
  }

  try {
    const openAiResponse = await retrieveOpenAiResponse(openAiApiKey, responseId);
    if (ACTIVE_STATUSES.has(openAiResponse.status)) {
      return sendJson(response, {
        id: responseId,
        status: openAiResponse.status,
        date,
      }, 202, {
        'Retry-After': '20',
      });
    }
    if (TERMINAL_FAILURE_STATUSES.has(openAiResponse.status)) {
      console.error(`Daily news background response ${responseId} ended with status ${openAiResponse.status}.`);
      return sendJson(response, { error: 'Daily news background generation did not complete.' }, 502);
    }
    if (openAiResponse.status !== 'completed') {
      console.error(`Daily news background response ${responseId} returned unknown status ${openAiResponse.status}.`);
      return sendJson(response, { error: 'Daily news background generation returned an unknown status.' }, 502);
    }
    return await normalizeCompletedResponse(request, response, date, openAiResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`Daily news background retrieval failed: ${message}`);
    return sendJson(response, { error: 'Daily news background generation could not be retrieved.' }, 502);
  }
}
