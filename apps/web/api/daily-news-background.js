import { timingSafeEqual } from 'node:crypto';
import sourceHandler from './daily-news-source.js';
import { emitGptUsageDiagnostic } from '../src/lib/gpt-usage-diagnostic.js';
import { validateEditorialBundle } from '../src/lib/daily-news-editorial-validation.js';
import { sourceDateAttributionIssue } from '../src/lib/source-date-basis.js';

const OPENAI_RESPONSES_API = 'https://api.openai.com/v1/responses';
const RESPONSE_ID_PATTERN = /^resp_[A-Za-z0-9_-]{8,200}$/;
const ACTIVE_STATUSES = new Set(['queued', 'in_progress']);
const TERMINAL_FAILURE_STATUSES = new Set(['cancelled', 'failed', 'incomplete']);
export const MAX_BACKGROUND_OUTPUT_TOKENS = 20_000;
const MAX_REPAIR_OUTPUT_TOKENS = 9_000;
const REPAIR_TIMEOUT_MS = 150_000;
const REPAIR_TOTAL_TIMEOUT_MS = 225_000;
const MAX_REPAIR_ATTEMPTS = 2;

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

const REQUEST_PARAM_HEADERS = Object.freeze({
  date: 'x-usd-impact-edition-date',
  response_id: 'x-usd-impact-response-id',
});

export function requestParam(request, name) {
  const headerName = REQUEST_PARAM_HEADERS[name];
  if (!headerName) return '';
  return requestHeader(request, headerName).trim();
}

function utcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date, days) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return utcDateString(parsed);
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && utcDateString(date) === value;
}

export function buildRepairOutputSchema(editionDate, permittedSourceUrls = null) {
  const catalystDates = Array.from({ length: 8 }, (_, index) => addUtcDays(editionDate, index));
  const sourceUrls = Array.isArray(permittedSourceUrls)
    ? [...new Set(permittedSourceUrls)]
    : null;
  return {
    ...OUTPUT_SCHEMA,
    properties: {
      ...OUTPUT_SCHEMA.properties,
      catalysts: {
        ...OUTPUT_SCHEMA.properties.catalysts,
        items: {
          ...OUTPUT_SCHEMA.properties.catalysts.items,
          properties: {
            ...OUTPUT_SCHEMA.properties.catalysts.items.properties,
            date: { type: 'string', enum: catalystDates },
          },
        },
      },
      ...(sourceUrls ? {
        sources: {
          ...OUTPUT_SCHEMA.properties.sources,
          items: {
            ...OUTPUT_SCHEMA.properties.sources.items,
            properties: {
              ...OUTPUT_SCHEMA.properties.sources.items.properties,
              url: { type: 'string', enum: sourceUrls },
            },
          },
        },
      } : {}),
    },
  };
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

// Supplemental diagnostics are advisory only: the existing full server validator
// remains the publication gate. Inspect all source URLs and editorial freshness
// before asking a model to repair a draft that may have multiple independent defects.
export function collectRepairEvidence(openAiResponse, editionDate) {
  let draft;
  try {
    draft = JSON.parse(collectOpenAiText(openAiResponse));
  } catch {
    return { permittedSourceUrls: [], issues: ['Original structured draft is not parseable.'] };
  }
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return { permittedSourceUrls: [], issues: ['Original structured draft must be an object.'] };
  }

  const groundedUrls = collectGroundedUrls(openAiResponse);
  const permitted = new Set();
  const missingIds = [];
  const blockedIds = [];
  for (const source of Array.isArray(draft.sources) ? draft.sources : []) {
    const safeId = /^[a-z0-9][a-z0-9-]{1,63}$/.test(String(source?.id ?? ''))
      ? source.id
      : '(invalid-id)';
    try {
      const url = canonicalUrl(source?.url);
      if (!groundedUrls.has(url)) missingIds.push(safeId);
      else if (sourceDateAttributionIssue(url)) blockedIds.push(safeId);
      else permitted.add(url);
    } catch {
      missingIds.push(safeId);
    }
  }

  const issues = [];
  if (blockedIds.length > 0) {
    issues.push(`Ineligible index or rolling-pointer source ids: ${blockedIds.join(', ')}. Their dates cannot be relabeled and their URLs cannot count toward a three-source repair.`);
  }
  if (missingIds.length > 0) {
    issues.push(`Ungrounded source ids in the full ledger: ${missingIds.join(', ')}`);
  }
  try {
    validateEditorialBundle({
      editionDate,
      sources: Array.isArray(draft.sources) ? draft.sources : [],
      highlights: Array.isArray(draft.highlights) ? draft.highlights : [],
      catalysts: Array.isArray(draft.catalysts) ? draft.catalysts : [],
      summary: draft.summary,
      body: draft.body,
    });
  } catch (error) {
    // These may include stale highlights even when the primary validator stopped
    // earlier at an ungrounded URL. Do not alter or waive either verdict.
    issues.push(String(error instanceof Error ? error.message : error).slice(0, 2_000));
  }

  return { permittedSourceUrls: [...permitted], issues };
}

function collectContextRepairSourceUrls(openAiResponse) {
  const urls = [];
  for (const url of collectGroundedUrls(openAiResponse)) {
    try {
      if (!sourceDateAttributionIssue(url)) urls.push(url);
    } catch {
      // Ignore malformed provider metadata; collectGroundedUrls already canonicalized it.
    }
  }
  return [...new Set(urls)];
}

// Pure, cost-free test of whether a bounded repair can reuse the stored grounded
// response context without opening a new web search. The response id is required
// so the repair can continue the exact provider context that produced these URLs.
export function assessBoundedRepairFeasibility(openAiResponse, editionDate) {
  const grounded = collectGroundedUrls(openAiResponse);
  const evidence = collectRepairEvidence(openAiResponse, editionDate);
  const contextSourceUrls = collectContextRepairSourceUrls(openAiResponse);
  const responseId = String(openAiResponse?.id ?? '').trim();
  return {
    canRepair: Boolean(collectOpenAiText(openAiResponse))
      && RESPONSE_ID_PATTERN.test(responseId)
      && grounded.size >= 3
      && contextSourceUrls.length >= 3,
    groundedCount: grounded.size,
    retainedCount: evidence.permittedSourceUrls.length,
  };
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

async function repairCompletedResponse(apiKey, date, openAiResponse, storedContextResponseId, initialReason, timeoutMs = REPAIR_TIMEOUT_MS) {
  const originalDraft = collectOpenAiText(openAiResponse);
  const groundedUrls = [...collectGroundedUrls(openAiResponse)];
  const contextSourceUrls = collectContextRepairSourceUrls(openAiResponse);
  const repairEvidence = collectRepairEvidence(openAiResponse, date);
  const previousResponseId = String(storedContextResponseId ?? '').trim();
  const catalystWindowEnd = addUtcDays(date, 7);
  if (!originalDraft) throw new Error('The completed response contained no draft text to repair.');
  if (!RESPONSE_ID_PATTERN.test(previousResponseId)) {
    throw new Error('The completed response cannot be used as stored repair context.');
  }
  if (groundedUrls.length < 3 || contextSourceUrls.length < 3) {
    throw new Error('The completed response contained fewer than three reusable grounded URLs.');
  }
  const audit = repairEvidence.issues.length > 0
    ? repairEvidence.issues.map((issue) => `- ${issue}`).join('\n').slice(0, 2_500)
    : '- No additional independent editorial defects detected.';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
        previous_response_id: previousResponseId,
        // Repair outputs remain non-persistent. Every bounded retry forks from the
        // original stored research response; the latest candidate is supplied in input.
        store: false,
        reasoning: { effort: 'low' },
        instructions: 'You repair a source-backed USD Impact research bundle. Preserve verified facts, remove unsupported claims and conversational assistant residue, and return only the requested complete JSON object. Perform a complete validation sweep after addressing the named error; do not stop after the first defect. Remove every source whose URL is absent from the permitted grounded-context URL list, then remove every dependent highlight, catalyst, summary sentence, and body sentence. After pruning any source or source id, re-evaluate every retained highlight: it must still cite a primary source or two independent reporting domains. Remove a highlight and every related summary or body sentence if it no longer meets that support rule; never leave it supported by only one reporting domain. Remove every Treasury refunding or 3-year, 10-year, or 30-year auction claim that lacks a current Treasury source published within the prior 14 days, together with related summary and body sentences. Never retain an unsupported claim or unused source merely to satisfy a minimum; fail closed rather than inventing a replacement.',
        input: `The bundle for ${date} failed validation with this exact error:\n${initialReason}\n\nINDEPENDENT FULL-BUNDLE PREFLIGHT ISSUES (advisory; all server checks remain mandatory):\n${audit}\n\nRepair the bundle using these rules:\n- Fix the named error, then perform a complete validation sweep over every source, highlight, catalyst, summary sentence, and body sentence. The named error may be only the first defect.\n- Use only the exact source URLs listed under PERMITTED GROUNDED CONTEXT URLS.\n- Do not perform a fresh web search or introduce a new research topic. Continue only from the stored previous response context.\n- Compare every source ledger URL against PERMITTED GROUNDED CONTEXT URLS. Remove every non-matching source, every highlight or catalyst that depends on it, and every related sentence from the summary and body. A URL may be corrected only by selecting an exact listed URL that the stored prior web-search context directly supports for the same retained claim; never reconstruct or guess a URL.\n- Keep at least three distinct permitted sources, including at least one authoritative primary source. Every retained source must be referenced by at least one retained highlight or catalyst; remove unused ledger padding.\n- Do not add facts, events, prices, or dates that are not already present in the original bundle. Do not add a source merely to reach the minimum; an exact grounded-context URL may enter the ledger only as a correction for an existing retained claim supported by the stored prior web-search context.\n- Every source id must be lowercase and hyphenated, unique, and referenced consistently.\n- Every highlight must cite either at least one authoritative primary source or two independent reporting domains. A non-schedule daily-development highlight must include a source published within the prior 14 days; remove a highlight supported only by a stale daily-development source, but retain 3-7 highlights.\n- Remove every unsupported absence claim from highlights, summary, and body, including claims that no new release, decision, or source was found or identified.\n- Quarterly refunding and 3-year, 10-year, or 30-year refunding-auction claims require a current Treasury refunding or auction source published within the prior 14 days. Remove a stale claim from highlights, catalysts, summary, and body rather than presenting an earlier quarter as current. Re-scan the complete bundle for this language after all edits.\n- Use only supported asset names from the schema.\n- Catalyst dates must use YYYY-MM-DD and fall inside the exact inclusive window ${date} through ${catalystWindowEnd}. The repair schema rejects every other date. Never move, shorten, or invent an event date to force it into this window. Remove every out-of-window catalyst and its forward-looking mentions from the summary, highlights, and body. Every retained catalyst must cite an authoritative primary schedule source.\n- Treat FOMC, Federal Reserve policy decision, or central-bank decision language as central-bank catalyst mentions; CPI, Consumer Price Index, PCE, or personal consumption expenditures language as inflation catalyst mentions; and Employment Situation, nonfarm payrolls, or payrolls language as labor catalyst mentions.\n- If the summary or any schedule-focused highlight uses one of those phrases while discussing a calendar, schedule, upcoming event, watchlist, or next catalyst, decision, event, major release, or test, retain the matching catalyst only when its unchanged confirmed date falls inside ${date} through ${catalystWindowEnd} and it is backed by an authoritative primary schedule source already present in the original bundle. If no supported matching catalyst can be retained, remove the forward-looking mention from the summary, highlight, and body instead of inventing a catalyst; an out-of-window event is not retainable.\n- Preserve each catalyst's eventType, importance, 1-5 impactScore, and whyItMatters explanation. Reserve high 4-5 scores for genuinely important events across at least two covered assets; the server derives extra-publication eligibility.\n- Return finished publication copy. Remove first-person offers, follow-up questions, "If you want" sections, and offers to rerun, expand, add, check, or provide more material.\n- Do not say an organization, calendar, release, or source was checked, used, or included unless its exact permitted URL remains in the source ledger and is referenced by a highlight or catalyst.\n- Keep the summary under 700 characters, each headline under 140 characters, each development and whyItMatters under 700 characters, and the body under 9,000 characters.\n- Return the complete corrected bundle, not a patch or explanation.\n\nPERMITTED GROUNDED CONTEXT URLS:\n${JSON.stringify(contextSourceUrls, null, 2)}\n\nORIGINAL BUNDLE:\n${originalDraft}`,
        text: {
          format: {
            type: 'json_schema',
            name: 'daily_usd_impact_bundle_repair',
            strict: true,
            schema: buildRepairOutputSchema(date, contextSourceUrls),
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
    emitGptUsageDiagnostic({ response: openAiResponse, stage: 'research', outcome: 'validated' });
    return forwardRecordedResponse(response, initial.recorder, {
      'X-USD-Impact-Repaired': 'false',
      'X-USD-Impact-Repair-Count': '0',
    });
  }

  emitGptUsageDiagnostic({ response: openAiResponse, stage: 'research', outcome: 'invalid', validationReason: initial.reason });
  console.error(`Daily news bundle requires bounded repair: ${initial.reason}`);
  const feasibility = assessBoundedRepairFeasibility(openAiResponse, date);
  if (!feasibility.canRepair) {
    // Do not pay for a repair unless the stored completed response carries at
    // least three exact reusable grounded URLs. Fail closed and let the existing
    // GitHub one-regeneration guard decide whether fresh source research is permitted.
    console.error(`Daily news grounded-context preflight HOLD: grounded=${feasibility.groundedCount}, retained-ledger=${feasibility.retainedCount}; no repair model requested.`);
    return sendJson(response, {
      code: 'insufficient-grounded-sources',
      error: 'The stored grounded research context cannot support a bounded repair.',
      initialValidationReason: initial.reason,
      groundedSourceCount: feasibility.groundedCount,
      usableSourceCount: feasibility.retainedCount,
      repairAttempts: 0,
    }, 502);
  }
  // The initial background response is stored explicitly and is the durable provider
  // context anchor. Repair responses use store:false, so a later bounded repair must
  // not chain to the immediately previous repair response id.
  const storedContextResponseId = String(openAiResponse?.id ?? '').trim();
  const repairStartedAt = Date.now();
  let candidate = openAiResponse;
  let currentReason = initial.reason;

  for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS; attempt += 1) {
    const remainingBudget = REPAIR_TOTAL_TIMEOUT_MS - (Date.now() - repairStartedAt);
    if (remainingBudget < 10_000) {
      return sendJson(response, {
        error: 'Daily news source generation exhausted its bounded repair budget.',
        initialValidationReason: initial.reason,
        repairValidationReason: currentReason,
        repairAttempts: attempt - 1,
      }, 502);
    }

    try {
      candidate = await repairCompletedResponse(
        apiKey,
        date,
        candidate,
        storedContextResponseId,
        currentReason,
        Math.min(REPAIR_TIMEOUT_MS, remainingBudget),
      );
      const repaired = await validateCompletedResponse(request, date, candidate);
      if (repaired.recorder.statusCode === 200) {
        emitGptUsageDiagnostic({ response: candidate, stage: 'repair', outcome: 'validated', repairAttempt: attempt });
        return forwardRecordedResponse(response, repaired.recorder, {
          'X-USD-Impact-Repaired': 'true',
          'X-USD-Impact-Repair-Count': String(attempt),
        });
      }
      currentReason = repaired.reason;
      emitGptUsageDiagnostic({ response: candidate, stage: 'repair', outcome: 'invalid', validationReason: currentReason, repairAttempt: attempt });
      console.error(`Daily news bundle repair attempt ${attempt} still failed validation: ${currentReason}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      emitGptUsageDiagnostic({ response: candidate, stage: 'repair', outcome: 'provider_failed', validationReason: message, repairAttempt: attempt });
      console.error(`Daily news bundle repair attempt ${attempt} failed: ${message}`);
      return sendJson(response, {
        error: 'Daily news source generation failed validation and could not be repaired.',
        initialValidationReason: initial.reason,
        repairValidationReason: currentReason,
        repairAttempts: attempt,
        repairError: message.slice(0, 1_000),
      }, 502);
    }
  }

  return sendJson(response, {
    error: 'Daily news source generation failed validation after two bounded repair attempts.',
    initialValidationReason: initial.reason,
    repairValidationReason: currentReason,
    repairAttempts: MAX_REPAIR_ATTEMPTS,
  }, 502);
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

  const date = requestParam(request, 'date') || utcDateString();
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

  const responseId = requestParam(request, 'response_id');
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
      emitGptUsageDiagnostic({ response: openAiResponse, stage: 'research', outcome: 'provider_failed', validationReason: details.reason });
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
