import { timingSafeEqual } from 'node:crypto';
import sourceHandler from './daily-news-source.js';

const OPENAI_RESPONSES_API = 'https://api.openai.com/v1/responses';
const RESPONSE_ID_PATTERN = /^resp_[A-Za-z0-9_-]{8,200}$/;
const ACTIVE_STATUSES = new Set(['queued', 'in_progress']);
const TERMINAL_FAILURE_STATUSES = new Set(['cancelled', 'failed', 'incomplete']);
const MAX_BACKGROUND_OUTPUT_TOKENS = 16_000;
const MAX_REPAIR_OUTPUT_TOKENS = 9_000;
const REPAIR_TIMEOUT_MS = 150_000;

const ALLOWED_ASSETS = [
  'DXY', 'USD', 'EURUSD', 'Fed', 'U.S. rates', 'Liquidity', 'WTI', 'Brent',
  'Henry Hub', 'TTF', 'LNG', 'XAUUSD', 'BTCUSD', 'S&P 500', 'Nasdaq',
  'Dow', 'Russell 2000', 'NVDA', 'MSFT', 'AAPL', 'AMZN', 'GOOGL', 'META', 'TSLA',
];
const CATALYST_EVENT_TYPES = [
  'central-bank', 'inflation', 'labor', 'growth', 'liquidity', 'energy',
  'corporate', 'regulatory', 'geopolitical', 'other',
];

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['marketRegime', 'summary', 'highlights', 'catalysts', 'sources', 'body'],
  properties: {
    marketRegime: { type: 'string' },
    summary: { type: 'string' },
    highlights: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['headline', 'development', 'whyItMatters', 'assets', 'importance', 'sourceIds'],
        properties: {
          headline: { type: 'string' },
          development: { type: 'string' },
          whyItMatters: { type: 'string' },
          assets: { type: 'array', items: { type: 'string', enum: ALLOWED_ASSETS } },
          importance: { type: 'string', enum: ['high', 'medium', 'low'] },
          sourceIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    catalysts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'date', 'event', 'eventType', 'assets', 'importance', 'impactScore',
          'whyItMatters', 'sourceIds',
        ],
        properties: {
          date: { type: 'string' },
          event: { type: 'string' },
          eventType: { type: 'string', enum: CATALYST_EVENT_TYPES },
          assets: { type: 'array', items: { type: 'string', enum: ALLOWED_ASSETS } },
          importance: { type: 'string', enum: ['high', 'medium', 'low'] },
          impactScore: { type: 'integer', minimum: 1, maximum: 5 },
          whyItMatters: { type: 'string' },
          sourceIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    sources: {
      type: 'array',
      minItems: 3,
      maxItems: 24,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'url', 'publishedAt'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          url: { type: 'string' },
          publishedAt: { type: 'string' },
        },
      },
    },
    body: { type: 'string' },
  },
};

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

function canonicalUrl(value) {
  const url = new URL(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|gclid$|fbclid$|mc_)/i.test(key)) url.searchParams.delete(key);
  }
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

function collectOpenAiText(openAiResponse) {
  const parts = [];
  for (const item of openAiResponse.output ?? []) {
    if (item.type !== 'message') continue;
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('').trim();
}

function collectGroundedUrls(openAiResponse) {
  const urls = new Set();
  const add = (value) => {
    if (typeof value !== 'string') return;
    try {
      urls.add(canonicalUrl(value));
    } catch {
      // Ignore malformed provider metadata.
    }
  };
  for (const item of openAiResponse.output ?? []) {
    if (item.type === 'web_search_call') {
      add(item.action?.url);
      for (const source of item.action?.sources ?? []) add(source?.url);
    }
    if (item.type === 'message') {
      for (const content of item.content ?? []) {
        for (const annotation of content.annotations ?? []) {
          add(annotation?.url);
          add(annotation?.url_citation?.url);
        }
      }
    }
  }
  return urls;
}

function groundingOutputItems(openAiResponse) {
  const items = [];
  for (const item of openAiResponse.output ?? []) {
    if (item.type === 'web_search_call') {
      items.push(item);
      continue;
    }
    if (item.type !== 'message') continue;
    const content = (item.content ?? [])
      .filter((part) => Array.isArray(part.annotations) && part.annotations.length > 0)
      .map((part) => ({ ...part, text: '' }));
    if (content.length > 0) items.push({ ...item, content });
  }
  return items;
}

function validationReason(messages) {
  const prefix = 'Daily news source failed:';
  const match = [...messages].reverse().find((message) => message.includes(prefix));
  if (!match) return 'Unknown validation error';
  return match.slice(match.indexOf(prefix) + prefix.length).trim().slice(0, 1_000);
}

function terminalFailureDetails(openAiResponse) {
  const reason = String(
    openAiResponse?.incomplete_details?.reason
      ?? openAiResponse?.error?.code
      ?? openAiResponse?.error?.type
      ?? 'unknown',
  );
  const providerMessage = typeof openAiResponse?.error?.message === 'string'
    ? openAiResponse.error.message.slice(0, 500)
    : null;
  const usage = openAiResponse?.usage
    ? {
        inputTokens: openAiResponse.usage.input_tokens ?? null,
        outputTokens: openAiResponse.usage.output_tokens ?? null,
        reasoningTokens: openAiResponse.usage.output_tokens_details?.reasoning_tokens ?? null,
        totalTokens: openAiResponse.usage.total_tokens ?? null,
      }
    : null;
  return { reason, providerMessage, usage };
}

async function withRuntimeOverride(makeFetch, suppressExpectedStatusError, task, capturedErrors = null) {
  let release;
  const previous = runtimeOverrideQueue;
  runtimeOverrideQueue = new Promise((resolve) => {
    release = resolve;
  });
  await previous;

  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  globalThis.fetch = makeFetch(originalFetch);
  if (suppressExpectedStatusError || capturedErrors) {
    console.error = (...args) => {
      const message = args.map((value) => String(value)).join(' ');
      if (capturedErrors) capturedErrors.push(message);
      if (!suppressExpectedStatusError || !message.includes('OpenAI response did not complete:')) {
        originalConsoleError(...args);
      }
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
      body.reasoning = {
        ...(body.reasoning ?? {}),
        effort: 'low',
      };
      body.max_output_tokens = MAX_BACKGROUND_OUTPUT_TOKENS;
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
    reasoningEffort: 'low',
    maxOutputTokens: MAX_BACKGROUND_OUTPUT_TOKENS,
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

async function validateCompletedResponse(request, date, openAiResponse) {
  const recorder = responseRecorder();
  const errors = [];
  await withRuntimeOverride(
    () => async () => new Response(JSON.stringify(openAiResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
    false,
    () => sourceHandler(sourceRequest(request, date), recorder),
    errors,
  );
  return {
    recorder,
    reason: recorder.statusCode === 200 ? null : validationReason(errors),
  };
}

async function repairCompletedResponse(apiKey, date, openAiResponse, initialReason) {
  const originalDraft = collectOpenAiText(openAiResponse);
  const groundedUrls = [...collectGroundedUrls(openAiResponse)];
  if (!originalDraft) throw new Error('The completed response contained no draft text to repair.');
  if (groundedUrls.length < 3) throw new Error('The completed response contained fewer than three grounded URLs.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REPAIR_TIMEOUT_MS);
  try {
    const repairModel = String(process.env.OPENAI_NEWS_REPAIR_MODEL || 'gpt-5-mini').trim();
    const providerResponse = await fetch(OPENAI_RESPONSES_API, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: repairModel,
        store: false,
        reasoning: { effort: 'low' },
        instructions: 'You repair a source-backed USD Impact research bundle. Preserve verified facts, remove unsupported claims, and return only the requested complete JSON object. Remove every Treasury refunding or 3-year, 10-year, or 30-year auction highlight that lacks a current Treasury source published within the prior 14 days, together with related summary and body sentences. Never retain an unsupported claim merely to satisfy the highlight minimum; fail closed rather than inventing a replacement.',
        input: `The bundle for ${date} failed validation with this exact error:\n${initialReason}\n\nRepair the bundle using these rules:\n- Use only the exact source URLs listed under PERMITTED SOURCE URLS.\n- Keep at least three distinct permitted sources, including at least one authoritative primary source.\n- Do not add facts, events, prices, dates, or sources that are not already present in the original bundle.\n- Every source id must be lowercase and hyphenated, unique, and referenced consistently.\n- Every highlight must cite either at least one authoritative primary source or two independent reporting domains. A non-schedule daily-development highlight must include a source published within the prior 14 days; remove a highlight supported only by a stale daily-development source, but retain 3-7 highlights.\n- Remove any highlight whose main claim is an unsupported absence claim that no new release, decision, or source was found.\n- Quarterly refunding and 3-year, 10-year, or 30-year refunding-auction claims require a current Treasury refunding or auction source published within the prior 14 days. Remove a stale claim rather than presenting an earlier quarter as current.\n- Use only supported asset names from the schema.\n- Catalyst dates must use YYYY-MM-DD, stay within the requested seven-day window, and cite an authoritative primary schedule source. Remove an unsupported catalyst rather than inventing evidence.\n- If the summary or a schedule-focused highlight mentions an upcoming Employment Situation, CPI, PCE, or FOMC event, retain the matching catalyst entry.\n- Preserve each catalyst's eventType, importance, 1-5 impactScore, and whyItMatters explanation. Reserve high 4-5 scores for genuinely important events across at least two covered assets; the server derives extra-publication eligibility.\n- Keep the summary under 700 characters, each headline under 140 characters, each development and whyItMatters under 700 characters, and the body under 9,000 characters.\n- Return the complete corrected bundle, not a patch or explanation.\n\nPERMITTED SOURCE URLS:\n${JSON.stringify(groundedUrls, null, 2)}\n\nORIGINAL BUNDLE:\n${originalDraft}`,
        text: {
          format: {
            type: 'json_schema',
            name: 'daily_usd_impact_bundle_repair',
            strict: true,
            schema: OUTPUT_SCHEMA,
          },
        },
        max_output_tokens: MAX_REPAIR_OUTPUT_TOKENS,
      }),
    });

    const raw = await providerResponse.text();
    let repairPayload;
    try {
      repairPayload = JSON.parse(raw);
    } catch {
      throw new Error(`OpenAI repair returned invalid JSON with status ${providerResponse.status}`);
    }
    if (!providerResponse.ok) {
      throw new Error(repairPayload?.error?.message ?? `OpenAI repair failed with status ${providerResponse.status}`);
    }
    if (repairPayload.status && repairPayload.status !== 'completed') {
      throw new Error(`OpenAI repair did not complete: ${repairPayload.status}`);
    }

    return {
      ...repairPayload,
      status: 'completed',
      output: [
        ...groundingOutputItems(openAiResponse),
        ...(repairPayload.output ?? []),
      ],
    };
  } finally {
    clearTimeout(timeout);
  }
}

function forwardRecordedResponse(response, recorder, extraHeaders = {}) {
  response.statusCode = recorder.statusCode;
  for (const [name, value] of Object.entries(recorder.headers)) response.setHeader(name, value);
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);
  response.end(recorder.body);
}

async function normalizeCompletedResponse(request, response, date, openAiResponse, apiKey) {
  const initial = await validateCompletedResponse(request, date, openAiResponse);
  if (initial.recorder.statusCode === 200) {
    return forwardRecordedResponse(response, initial.recorder, { 'X-USD-Impact-Repaired': 'false' });
  }

  console.error(`Daily news bundle requires one repair attempt: ${initial.reason}`);
  try {
    const repairedResponse = await repairCompletedResponse(apiKey, date, openAiResponse, initial.reason);
    const repaired = await validateCompletedResponse(request, date, repairedResponse);
    if (repaired.recorder.statusCode === 200) {
      return forwardRecordedResponse(response, repaired.recorder, { 'X-USD-Impact-Repaired': 'true' });
    }
    return sendJson(response, {
      error: 'Daily news source generation failed validation after one repair attempt.',
      initialValidationReason: initial.reason,
      repairValidationReason: repaired.reason,
    }, 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown repair error';
    console.error(`Daily news bundle repair failed: ${message}`);
    return sendJson(response, {
      error: 'Daily news source generation failed validation and could not be repaired.',
      initialValidationReason: initial.reason,
      repairError: message.slice(0, 1_000),
    }, 502);
  }
}

export const config = { maxDuration: 300 };

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
      const details = terminalFailureDetails(openAiResponse);
      console.error(
        `Daily news background response ${responseId} ended with status ${openAiResponse.status}; reason ${details.reason}; usage ${JSON.stringify(details.usage)}.`,
      );
      return sendJson(response, {
        error: 'Daily news background generation did not complete.',
        status: openAiResponse.status,
        reason: details.reason,
        providerMessage: details.providerMessage,
        usage: details.usage,
      }, 502);
    }
    if (openAiResponse.status !== 'completed') {
      console.error(`Daily news background response ${responseId} returned unknown status ${openAiResponse.status}.`);
      return sendJson(response, {
        error: 'Daily news background generation returned an unknown status.',
        status: openAiResponse.status ?? 'unknown',
      }, 502);
    }
    return await normalizeCompletedResponse(request, response, date, openAiResponse, openAiApiKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`Daily news background retrieval failed: ${message}`);
    return sendJson(response, { error: 'Daily news background generation could not be retrieved.' }, 502);
  }
}
