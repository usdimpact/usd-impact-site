import { timingSafeEqual } from 'node:crypto';

const OPENAI_RESPONSES_API = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5';
const DEFAULT_TIMEOUT_MS = 180_000;
const MAX_OPENAI_RESPONSE_BYTES = 2_000_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const CATALYST_EVENT_TYPES = [
  'central-bank', 'inflation', 'labor', 'growth', 'liquidity', 'energy',
  'corporate', 'regulatory', 'geopolitical', 'other',
];

const ALLOWED_ASSETS = new Set([
  'DXY', 'USD', 'EURUSD', 'Fed', 'U.S. rates', 'Liquidity', 'WTI', 'Brent',
  'Henry Hub', 'TTF', 'LNG', 'XAUUSD', 'BTCUSD', 'S&P 500', 'Nasdaq',
  'Dow', 'Russell 2000', 'NVDA', 'MSFT', 'AAPL', 'AMZN', 'GOOGL', 'META', 'TSLA',
]);

const PRIMARY_PUBLISHERS = new Map([
  ['federalreserve.gov', 'Federal Reserve'],
  ['newyorkfed.org', 'Federal Reserve Bank of New York'],
  ['treasury.gov', 'U.S. Department of the Treasury'],
  ['bls.gov', 'U.S. Bureau of Labor Statistics'],
  ['bea.gov', 'U.S. Bureau of Economic Analysis'],
  ['census.gov', 'U.S. Census Bureau'],
  ['stlouisfed.org', 'Federal Reserve Bank of St. Louis'],
  ['eia.gov', 'U.S. Energy Information Administration'],
  ['energy.gov', 'U.S. Department of Energy'],
  ['ecb.europa.eu', 'European Central Bank'],
  ['europa.eu', 'European Union'],
  ['cmegroup.com', 'CME Group'],
  ['sec.gov', 'U.S. Securities and Exchange Commission'],
  ['opec.org', 'OPEC'],
  ['gold.org', 'World Gold Council'],
  ['imf.org', 'International Monetary Fund'],
  ['bis.org', 'Bank for International Settlements'],
  ['iea.org', 'International Energy Agency'],
  ['cbo.gov', 'Congressional Budget Office'],
  ['whitehouse.gov', 'The White House'],
  ['state.gov', 'U.S. Department of State'],
  ['defense.gov', 'U.S. Department of Defense'],
  ['nato.int', 'NATO'],
  ['worldbank.org', 'World Bank'],
  ['nvidia.com', 'NVIDIA'],
  ['microsoft.com', 'Microsoft'],
  ['apple.com', 'Apple'],
  ['amazon.com', 'Amazon'],
  ['abc.xyz', 'Alphabet'],
  ['meta.com', 'Meta'],
  ['fb.com', 'Meta'],
  ['tesla.com', 'Tesla'],
]);

const REPORTING_PUBLISHERS = new Map([
  ['reuters.com', 'Reuters'],
  ['apnews.com', 'Associated Press'],
  ['ft.com', 'Financial Times'],
  ['bloomberg.com', 'Bloomberg'],
  ['wsj.com', 'The Wall Street Journal'],
  ['cnbc.com', 'CNBC'],
  ['spglobal.com', 'S&P Global'],
  ['argusmedia.com', 'Argus Media'],
]);

const TRUSTED_DOMAINS = [...new Set([
  ...PRIMARY_PUBLISHERS.keys(),
  ...REPORTING_PUBLISHERS.keys(),
])];

const COMPLIANCE_NOTE = 'Educational and informational only. This content is not investment, financial, trading, legal, or tax advice and is not a recommendation to buy or sell any asset.';

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
          assets: { type: 'array', items: { type: 'string', enum: [...ALLOWED_ASSETS] } },
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
          assets: { type: 'array', items: { type: 'string', enum: [...ALLOWED_ASSETS] } },
          importance: { type: 'string', enum: ['high', 'medium', 'low'] },
          impactScore: { type: 'integer', minimum: 1, maximum: 5 },
          whyItMatters: { type: 'string' },
          sourceIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    sources: {
      type: 'array',
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

function requestHeader(request, name) {
  const headers = request.headers ?? {};
  if (typeof headers.get === 'function') return headers.get(name) ?? '';
  const value = headers[name.toLowerCase()] ?? headers[name];
  return Array.isArray(value) ? value[0] ?? '' : String(value ?? '');
}

function sendJson(response, body, status = 200, extraHeaders = {}) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);
  response.end(JSON.stringify(body));
}

function safeTokenEqual(actual, expected) {
  const actualBuffer = Buffer.from(String(actual ?? ''));
  const expectedBuffer = Buffer.from(String(expected ?? ''));
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function bearerToken(request) {
  const authorization = requestHeader(request, 'authorization');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? '';
}

function requestedDate(request) {
  const direct = request.query?.date;
  if (Array.isArray(direct)) return String(direct[0] ?? '').trim();
  if (direct) return String(direct).trim();
  try {
    const url = new URL(request.url ?? '/', 'https://usd-impact.com');
    return url.searchParams.get('date')?.trim() ?? '';
  } catch {
    return '';
  }
}

function utcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function isRealDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && utcDateString(date) === value;
}

function addUtcDays(date, days) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return utcDateString(parsed);
}

function domainMatch(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function sourceClassification(urlValue) {
  let url;
  try {
    url = new URL(urlValue);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  for (const [domain, publisher] of PRIMARY_PUBLISHERS) {
    if (domainMatch(hostname, domain)) return { sourceType: 'primary', publisher, domain };
  }
  for (const [domain, publisher] of REPORTING_PUBLISHERS) {
    if (domainMatch(hostname, domain)) return { sourceType: 'reporting', publisher, domain };
  }
  return null;
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
      if (content.type === 'refusal') throw new Error(`OpenAI refused the request: ${content.refusal ?? 'unknown reason'}`);
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
      // Ignore malformed provider metadata; model output still fails if it references it.
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

function requiredString(object, key, maxLength = 10_000) {
  const value = String(object?.[key] ?? '').trim();
  if (!value) throw new Error(`Missing required field: ${key}`);
  if (value.length > maxLength) throw new Error(`${key} exceeds maximum length`);
  return value;
}

function validateSourceDate(value, id) {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+-]+Z?)?$/.test(text)) {
    throw new Error(`Source ${id} has an invalid publishedAt value`);
  }
  if (!Number.isFinite(Date.parse(text.length === 10 ? `${text}T00:00:00Z` : text))) {
    throw new Error(`Source ${id} has an invalid publishedAt date`);
  }
  return text;
}

function validateAndNormalizeDraft(draft, groundedUrls, editionDate, generatedAt) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) throw new Error('OpenAI output must be an object');
  const rawSources = Array.isArray(draft.sources) ? draft.sources : [];
  if (rawSources.length < 2 || rawSources.length > 24) throw new Error('The bundle must contain 2-24 sources');

  const sourceIds = new Set();
  const sourceUrls = new Set();
  const sources = rawSources.map((source) => {
    const id = requiredString(source, 'id', 64);
    if (!SOURCE_ID_PATTERN.test(id)) throw new Error(`Invalid source id: ${id}`);
    if (sourceIds.has(id)) throw new Error(`Duplicate source id: ${id}`);
    sourceIds.add(id);
    const url = canonicalUrl(requiredString(source, 'url', 2000));
    if (!groundedUrls.has(url)) throw new Error(`Source ${id} was not returned by OpenAI web search`);
    if (sourceUrls.has(url)) throw new Error(`Duplicate source URL: ${url}`);
    sourceUrls.add(url);
    const classification = sourceClassification(url);
    if (!classification) throw new Error(`Source ${id} is not from an approved domain`);
    return {
      id,
      title: requiredString(source, 'title', 300),
      publisher: classification.publisher,
      url,
      publishedAt: validateSourceDate(source.publishedAt, id),
      sourceType: classification.sourceType,
      domain: classification.domain,
    };
  });

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const validateAssets = (assets, context, allowEmpty = false) => {
    if (!Array.isArray(assets) || (!allowEmpty && assets.length === 0)) throw new Error(`${context} requires assets`);
    const normalized = [...new Set(assets.map((asset) => String(asset).trim()))];
    for (const asset of normalized) {
      if (!ALLOWED_ASSETS.has(asset)) throw new Error(`${context} uses unsupported asset: ${asset}`);
    }
    return normalized;
  };
  const validateSourceIds = (ids, context) => {
    if (!Array.isArray(ids) || ids.length === 0) throw new Error(`${context} requires sourceIds`);
    const normalized = [...new Set(ids.map((id) => String(id).trim()))];
    for (const id of normalized) {
      if (!sourceById.has(id)) throw new Error(`${context} references unknown source: ${id}`);
    }
    return normalized;
  };

  const rawHighlights = Array.isArray(draft.highlights) ? draft.highlights : [];
  if (rawHighlights.length < 3 || rawHighlights.length > 7) throw new Error('The bundle must contain 3-7 highlights');
  const highlights = rawHighlights.map((highlight, index) => {
    const context = `Highlight ${index + 1}`;
    const ids = validateSourceIds(highlight.sourceIds, context);
    const referenced = ids.map((id) => sourceById.get(id));
    const hasPrimary = referenced.some((source) => source.sourceType === 'primary');
    const reportingDomains = new Set(
      referenced.filter((source) => source.sourceType === 'reporting').map((source) => source.domain),
    );
    if (!hasPrimary && reportingDomains.size < 2) {
      throw new Error(`${context} requires one primary source or two independent reporting domains`);
    }
    const importance = requiredString(highlight, 'importance', 10);
    if (!['high', 'medium', 'low'].includes(importance)) throw new Error(`${context} has invalid importance`);
    return {
      headline: requiredString(highlight, 'headline', 140),
      development: requiredString(highlight, 'development', 700),
      whyItMatters: requiredString(highlight, 'whyItMatters', 700),
      assets: validateAssets(highlight.assets, context),
      importance,
      verification: hasPrimary ? 'verified-primary' : 'verified-multiple',
      sourceIds: ids,
    };
  });

  const rawCatalysts = Array.isArray(draft.catalysts) ? draft.catalysts : [];
  if (rawCatalysts.length > 10) throw new Error('The bundle may contain at most 10 catalysts');
  const catalysts = rawCatalysts.map((catalyst, index) => {
    const context = `Catalyst ${index + 1}`;
    const date = requiredString(catalyst, 'date', 10);
    if (!isRealDate(date)) throw new Error(`${context} has invalid date`);
    if (date < editionDate || date > addUtcDays(editionDate, 7)) {
      throw new Error(`${context} must fall within the edition's next seven calendar days`);
    }
    const ids = validateSourceIds(catalyst.sourceIds, context);
    const referenced = ids.map((id) => sourceById.get(id));
    if (!referenced.some((source) => source.sourceType === 'primary')) {
      throw new Error(`${context} requires an authoritative primary schedule source`);
    }
    const eventType = requiredString(catalyst, 'eventType', 24);
    if (!CATALYST_EVENT_TYPES.includes(eventType)) throw new Error(`${context} has invalid eventType`);
    const importance = requiredString(catalyst, 'importance', 10);
    if (!['high', 'medium', 'low'].includes(importance)) throw new Error(`${context} has invalid importance`);
    const impactScore = Number(catalyst.impactScore);
    if (!Number.isInteger(impactScore) || impactScore < 1 || impactScore > 5) {
      throw new Error(`${context} impactScore must be an integer from 1 to 5`);
    }
    const assets = validateAssets(catalyst.assets, context, true);
    const extraBrief = importance === 'high' && impactScore >= 4 && assets.length >= 2;
    return {
      date,
      event: requiredString(catalyst, 'event', 240),
      eventType,
      assets,
      importance,
      impactScore,
      extraBrief,
      whyItMatters: requiredString(catalyst, 'whyItMatters', 500),
      sourceIds: ids,
    };
  });

  const assets = [...new Set(highlights.flatMap((highlight) => highlight.assets))];
  const summary = requiredString(draft, 'summary', 700);
  const titleDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(`${editionDate}T12:00:00Z`));
  return {
    date: editionDate,
    title: `Daily USD Impact — ${titleDate}`,
    metaTitle: `Daily USD Impact — ${titleDate} | USD Impact`,
    metaDescription: summary.slice(0, 300),
    generatedAt,
    lastReviewed: editionDate,
    marketRegime: requiredString(draft, 'marketRegime', 180),
    summary,
    featured: true,
    assets,
    highlights,
    catalysts,
    sources: sources.map(({ domain, ...source }) => source),
    complianceNote: COMPLIANCE_NOTE,
    body: requiredString(draft, 'body', 9000),
  };
}

function promptForDate(editionDate) {
  return `Prepare the source-backed Daily USD Impact research bundle for ${editionDate} (UTC).

Research the most material developments published or occurring in the prior 36 hours, plus confirmed catalysts over the next seven calendar days. Prioritize DXY and the U.S. dollar, EURUSD, Federal Reserve policy and U.S. rates, liquidity and risk conditions, WTI/Brent, Henry Hub/TTF/LNG, gold/XAUUSD, Bitcoin/BTCUSD, major U.S. indices, and the Magnificent Seven.

Rules:
- Use web search extensively and open the underlying pages.
- Prefer authoritative primary sources. A highlight without a primary source must use at least two independent high-quality reporting organizations.
- Use only source URLs from the web search results. Never invent or reconstruct a URL.
- Do not state an exact market price unless a trusted source provides the price and a clear timestamp or session date.
- Separate verified fact from conditional cross-asset interpretation.
- Use educational language: may, could, tends to, or is consistent with. Do not give investment advice, trading instructions, guaranteed outcomes, or personalized recommendations.
- Do not force coverage of an asset when no material verified development exists.
- Keep source IDs lowercase and hyphenated. Every highlight and catalyst must reference source IDs included in the source ledger.
- Every catalyst date must be confirmed by an authoritative primary schedule source and fall between ${editionDate} and ${addUtcDays(editionDate, 7)} inclusive.
- Classify every catalyst with an eventType, importance, 1-5 impactScore, and concise whyItMatters explanation. Score 4 or 5 only for genuinely high-impact events that could materially affect at least two covered assets.
- Reserve high 4-5 scores for decisions or releases such as major central-bank decisions, CPI/PCE, payrolls, material Treasury liquidity events, OPEC-level supply decisions, or exceptionally material index-heavy corporate events. Routine releases should remain medium or low. The server derives extra-publication eligibility deterministically.
- The body should be concise Markdown with an executive view, key drivers, catalysts, risks, and a watchlist. Do not repeat raw source URLs in the body.`;
}

async function openAiRequest(apiKey, model, editionDate, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const apiResponse = await fetch(OPENAI_RESPONSES_API, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        store: false,
        tools: [{
          type: 'web_search',
          search_context_size: 'high',
          filters: { allowed_domains: TRUSTED_DOMAINS },
        }],
        instructions: 'You are the USD Impact research engine. Accuracy, source traceability, recency, and compliance are mandatory. Return only the requested structured output.',
        input: promptForDate(editionDate),
        text: {
          format: {
            type: 'json_schema',
            name: 'daily_usd_impact_bundle',
            strict: true,
            schema: OUTPUT_SCHEMA,
          },
        },
        max_output_tokens: 12_000,
      }),
    });
    const raw = await apiResponse.text();
    if (raw.length > MAX_OPENAI_RESPONSE_BYTES) throw new Error('OpenAI response exceeded the size limit');
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error(`OpenAI returned invalid JSON with status ${apiResponse.status}`);
    }
    if (!apiResponse.ok) {
      const message = payload?.error?.message ?? `OpenAI request failed with status ${apiResponse.status}`;
      throw new Error(message);
    }
    if (payload.status && payload.status !== 'completed') {
      throw new Error(`OpenAI response did not complete: ${payload.status}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export {
  ALLOWED_ASSETS,
  COMPLIANCE_NOTE,
  TRUSTED_DOMAINS,
  canonicalUrl,
  collectGroundedUrls,
  collectOpenAiText,
  sourceClassification,
};

export const config = { maxDuration: 300 };

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return sendJson(response, { error: 'Method not allowed.' }, 405, { Allow: 'GET' });
  }
  const endpointToken = process.env.NEWSFEED_BEARER_TOKEN;
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!endpointToken || !openAiApiKey) {
    console.error('Daily news source configuration is incomplete.');
    return sendJson(response, { error: 'Daily news source is not configured.' }, 503);
  }
  if (!safeTokenEqual(bearerToken(request), endpointToken)) {
    return sendJson(response, { error: 'Unauthorized.' }, 401, { 'WWW-Authenticate': 'Bearer' });
  }
  const date = requestedDate(request) || utcDateString();
  if (!isRealDate(date)) return sendJson(response, { error: 'date must use YYYY-MM-DD.' }, 400);

  const model = String(process.env.OPENAI_NEWS_MODEL || DEFAULT_MODEL).trim();
  const timeoutMs = Number.parseInt(process.env.OPENAI_NEWS_TIMEOUT_MS || '', 10) || DEFAULT_TIMEOUT_MS;
  const generatedAt = new Date().toISOString();
  try {
    const openAiResponse = await openAiRequest(openAiApiKey, model, date, timeoutMs);
    const groundedUrls = collectGroundedUrls(openAiResponse);
    if (groundedUrls.size < 2) throw new Error('OpenAI web search returned fewer than two grounded source URLs');
    const outputText = collectOpenAiText(openAiResponse);
    if (!outputText) throw new Error('OpenAI returned no structured output text');
    let draft;
    try {
      draft = JSON.parse(outputText);
    } catch {
      throw new Error('OpenAI structured output was not valid JSON');
    }
    const bundle = validateAndNormalizeDraft(draft, groundedUrls, date, generatedAt);
    return sendJson(response, bundle, 200, {
      'X-USD-Impact-Model': model,
      'X-USD-Impact-Source-Count': String(bundle.sources.length),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`Daily news source failed: ${message}`);
    return sendJson(response, { error: 'Daily news source generation failed validation.' }, 502);
  }
}
