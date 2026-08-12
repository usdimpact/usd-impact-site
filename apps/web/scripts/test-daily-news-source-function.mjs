import assert from 'node:assert/strict';
import handler, { applySystemicCatalystPolicy } from '../api/daily-news-source.js';

const originalFetch = globalThis.fetch;
const originalEnv = {
  NEWSFEED_BEARER_TOKEN: process.env.NEWSFEED_BEARER_TOKEN,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_NEWS_MODEL: process.env.OPENAI_NEWS_MODEL,
  OPENAI_NEWS_TIMEOUT_MS: process.env.OPENAI_NEWS_TIMEOUT_MS,
};

function request({ method = 'GET', token = 'endpoint-secret', date = '2026-07-23' } = {}) {
  return {
    method,
    url: `/api/daily-news-source?date=${encodeURIComponent(date)}`,
    query: { date },
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
}

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = String(value);
    },
    end(body = '') {
      this.body = String(body);
    },
  };
}

async function invoke(req) {
  const res = responseRecorder();
  await handler(req, res);
  return {
    status: res.statusCode,
    headers: res.headers,
    json: res.body ? JSON.parse(res.body) : null,
  };
}

assert.deepEqual(
  applySystemicCatalystPolicy({
    event: 'BLS Employment Situation for July 2026',
    eventType: 'other',
    importance: 'medium',
    impactScore: 2,
    assets: ['U.S. rates', 'DXY', 'S&P 500', 'Nasdaq'],
  }),
  { eventType: 'labor', importance: 'high', impactScore: 4 },
);
assert.deepEqual(
  applySystemicCatalystPolicy({
    event: 'BLS Consumer Price Index (CPI) for July 2026',
    eventType: 'other',
    importance: 'medium',
    impactScore: 2,
    assets: ['U.S. rates', 'DXY', 'XAUUSD'],
  }),
  { eventType: 'inflation', importance: 'high', impactScore: 4 },
);
assert.deepEqual(
  applySystemicCatalystPolicy({
    event: 'Routine weekly petroleum statistics',
    eventType: 'energy',
    importance: 'medium',
    impactScore: 2,
    assets: ['WTI', 'Brent'],
  }),
  { eventType: 'energy', importance: 'medium', impactScore: 2 },
);
assert.deepEqual(
  applySystemicCatalystPolicy({
    event: 'Payrolls update affecting one covered asset',
    eventType: 'labor',
    importance: 'medium',
    impactScore: 2,
    assets: ['DXY'],
  }),
  { eventType: 'labor', importance: 'medium', impactScore: 2 },
);

const sourceUrls = {
  fed: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260723a.htm',
  eia: 'https://www.eia.gov/petroleum/supply/weekly/',
  reuters: 'https://www.reuters.com/markets/us/dollar-rates-market-update-2026-07-23/',
  ap: 'https://apnews.com/article/markets-dollar-rates-2026-07-23',
  treasuryStale: 'https://home.treasury.gov/news/press-releases/sb0489',
};

function draft(overrides = {}) {
  return {
    marketRegime: 'Firm dollar and yields with energy-led inflation pressure',
    summary: 'The dollar and Treasury yields remain firm while energy risk tightens financial conditions across foreign exchange, commodities, crypto, and growth equities.',
    highlights: [
      {
        headline: 'Federal Reserve communication keeps rate sensitivity elevated',
        development: 'The Federal Reserve published updated policy communication that left markets focused on inflation persistence and the path of restrictive rates.',
        whyItMatters: 'A higher-for-longer rate path may support DXY while increasing the discount-rate pressure on gold, Bitcoin, and long-duration U.S. equities.',
        assets: ['Fed', 'U.S. rates', 'DXY', 'XAUUSD', 'BTCUSD', 'Nasdaq'],
        importance: 'high',
        sourceIds: ['fed-release'],
      },
      {
        headline: 'EIA data keeps physical oil balances in focus',
        development: 'The latest U.S. petroleum data provided a fresh view of inventories, refinery utilization, and product demand during a volatile energy session.',
        whyItMatters: 'Tighter physical balances could reinforce the inflation impulse from oil, with potential transmission into yields, the dollar, and consumer-sensitive equities.',
        assets: ['WTI', 'Brent', 'DXY', 'U.S. rates', 'S&P 500'],
        importance: 'high',
        sourceIds: ['eia-weekly'],
      },
      {
        headline: 'Risk markets remain sensitive to dollar and yield moves',
        development: 'Independent reporting described a session in which currency, bond, and equity markets reacted to the interaction between policy expectations and geopolitical risk.',
        whyItMatters: 'A firmer dollar combined with higher yields may constrain EURUSD and liquidity-sensitive assets even when headline equity indices remain resilient.',
        assets: ['DXY', 'EURUSD', 'Liquidity', 'BTCUSD', 'S&P 500'],
        importance: 'medium',
        sourceIds: ['reuters-market', 'ap-market'],
      },
    ],
    catalysts: [
      {
        date: '2026-07-29',
        event: 'Federal Reserve policy decision and press conference',
        eventType: 'central-bank',
        assets: ['Fed', 'U.S. rates', 'DXY', 'EURUSD', 'XAUUSD', 'BTCUSD'],
        importance: 'high',
        impactScore: 5,
        whyItMatters: 'The decision can materially reprice the expected policy path across rates, the dollar, and liquidity-sensitive assets.',
        sourceIds: ['fed-release'],
      },
    ],
    sources: [
      { id: 'fed-release', title: 'Federal Reserve policy communication', url: sourceUrls.fed, publishedAt: '2026-07-23' },
      { id: 'eia-weekly', title: 'Weekly Petroleum Status Report', url: sourceUrls.eia, publishedAt: '2026-07-23' },
      { id: 'reuters-market', title: 'Dollar and rates market update', url: sourceUrls.reuters, publishedAt: '2026-07-23T08:30:00Z' },
      { id: 'ap-market', title: 'Markets react to rates and geopolitical risk', url: sourceUrls.ap, publishedAt: '2026-07-23T09:00:00Z' },
    ],
    body: '## Executive view\n\nThe dominant transmission channel is the interaction between energy risk, inflation expectations, Treasury yields, and the U.S. dollar.\n\n## Watchlist\n\nMonitor DXY, the U.S. 10-year yield, oil inventories, and whether gold or Bitcoin attracts defensive demand.',
    ...overrides,
  };
}

function openAiResponse(bundle = draft(), grounded = Object.values(sourceUrls)) {
  return {
    id: 'resp_test',
    status: 'completed',
    output: [
      {
        type: 'web_search_call',
        status: 'completed',
        action: {
          type: 'search',
          sources: grounded.map((url) => ({ type: 'url', url })),
        },
      },
      {
        type: 'message',
        status: 'completed',
        content: [{ type: 'output_text', text: JSON.stringify(bundle), annotations: [] }],
      },
    ],
  };
}

function providerResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

try {
  process.env.NEWSFEED_BEARER_TOKEN = 'endpoint-secret';
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_NEWS_MODEL = 'gpt-5-test';
  process.env.OPENAI_NEWS_TIMEOUT_MS = '5000';

  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return providerResponse(openAiResponse());
  };

  const success = await invoke(request());
  assert.equal(success.status, 200);
  assert.equal(success.json.date, '2026-07-23');
  assert.equal(success.json.title, 'Daily USD Impact — July 23, 2026');
  assert.equal(success.json.highlights[0].verification, 'verified-primary');
  assert.equal(success.json.highlights[2].verification, 'verified-multiple');
  assert.equal(success.json.catalysts[0].extraBrief, true);
  assert.equal(success.json.catalysts[0].impactScore, 5);
  assert.equal(success.json.sources[0].sourceType, 'primary');
  assert.equal(success.json.sources[2].sourceType, 'reporting');
  assert.equal(success.json.sources[2].publisher, 'Reuters');
  assert.equal(success.headers['cache-control'], 'no-store');
  assert.equal(success.headers['x-content-type-options'], 'nosniff');
  assert.equal(success.headers['x-usd-impact-model'], 'gpt-5-test');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.openai.com/v1/responses');

  const requestBody = JSON.parse(calls[0].options.body);
  assert.equal(requestBody.model, 'gpt-5-test');
  assert.equal(requestBody.store, false);
  assert.equal(requestBody.tools[0].type, 'web_search');
  assert.equal(requestBody.text.format.type, 'json_schema');
  assert.equal(requestBody.text.format.strict, true);
  assert.equal(requestBody.text.format.schema.properties.sources.minItems, 3);
  assert.equal(requestBody.text.format.schema.properties.sources.maxItems, 24);
  assert.match(requestBody.input, /at least three distinct grounded sources/i);
  assert.ok(requestBody.tools[0].filters.allowed_domains.includes('federalreserve.gov'));
  assert.ok(requestBody.tools[0].filters.allowed_domains.includes('reuters.com'));

  const unauthorized = await invoke(request({ token: '' }));
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.headers['www-authenticate'], 'Bearer');

  const wrongToken = await invoke(request({ token: 'wrong' }));
  assert.equal(wrongToken.status, 401);

  const wrongMethod = await invoke(request({ method: 'POST' }));
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.allow, 'GET');

  const invalidDate = await invoke(request({ date: '2026-02-31' }));
  assert.equal(invalidDate.status, 400);

  delete process.env.OPENAI_API_KEY;
  const unconfigured = await invoke(request());
  assert.equal(unconfigured.status, 503);
  process.env.OPENAI_API_KEY = 'sk-test';

  const twoSourceBundle = draft({
    sources: [
      { id: 'fed-release', title: 'Federal Reserve policy communication', url: sourceUrls.fed, publishedAt: '2026-07-23' },
      { id: 'eia-weekly', title: 'Weekly Petroleum Status Report', url: sourceUrls.eia, publishedAt: '2026-07-23' },
    ],
  });
  twoSourceBundle.highlights[2].sourceIds = ['fed-release'];
  globalThis.fetch = async () => providerResponse(openAiResponse(twoSourceBundle, [
    sourceUrls.fed,
    sourceUrls.eia,
    sourceUrls.reuters,
  ]));
  assert.equal((await invoke(request())).status, 502);

  globalThis.fetch = async () => providerResponse(openAiResponse(
    draft({
      sources: [
        { id: 'fed-release', title: 'Federal Reserve policy communication', url: sourceUrls.fed, publishedAt: '2026-07-23' },
        { id: 'invented', title: 'Invented source', url: 'https://www.reuters.com/invented/not-returned-by-search', publishedAt: '2026-07-23' },
      ],
    }),
  ));
  const ungrounded = await invoke(request());
  assert.equal(ungrounded.status, 502);

  const weak = draft();
  weak.highlights[2].sourceIds = ['reuters-market'];
  globalThis.fetch = async () => providerResponse(openAiResponse(weak));
  const weakVerification = await invoke(request());
  assert.equal(weakVerification.status, 502);

  const unknownDomain = draft();
  unknownDomain.sources[0].url = 'https://example.com/fed-release';
  globalThis.fetch = async () => providerResponse(openAiResponse(unknownDomain, [
    'https://example.com/fed-release',
    sourceUrls.eia,
    sourceUrls.reuters,
    sourceUrls.ap,
  ]));
  const untrusted = await invoke(request());
  assert.equal(untrusted.status, 502);

  const staleTreasury = draft();
  staleTreasury.sources[0] = {
    id: 'fed-release',
    title: 'Earlier-quarter Treasury refunding statement',
    url: sourceUrls.treasuryStale,
    publishedAt: '2026-05-06',
  };
  staleTreasury.highlights[0] = {
    headline: 'Treasury confirmed the quarterly refunding announcement occurred yesterday',
    development: 'An earlier-quarter statement was used to describe the current refunding window.',
    whyItMatters: 'Current auction details may influence rates and dollar liquidity.',
    assets: ['U.S. rates', 'DXY', 'Liquidity'],
    importance: 'high',
    sourceIds: ['fed-release'],
  };
  globalThis.fetch = async () => providerResponse(openAiResponse(staleTreasury, [
    sourceUrls.treasuryStale,
    sourceUrls.eia,
    sourceUrls.reuters,
    sourceUrls.ap,
  ]));
  const staleTreasuryFailure = await invoke(request());
  assert.equal(staleTreasuryFailure.status, 502);

  const unusedSource = draft({
    sources: [
      ...draft().sources,
      { id: 'unused-treasury', title: 'Unused Treasury source', url: sourceUrls.treasuryStale, publishedAt: '2026-05-06' },
    ],
  });
  globalThis.fetch = async () => providerResponse(openAiResponse(unusedSource));
  assert.equal((await invoke(request())).status, 502);

  const conversationalBody = draft({
    body: 'I did not identify another release.\n\nIf you want, I can rerun the search.',
  });
  globalThis.fetch = async () => providerResponse(openAiResponse(conversationalBody));
  assert.equal((await invoke(request())).status, 502);

  globalThis.fetch = async () => providerResponse({ error: { message: 'rate limited' } }, 429);
  const providerFailure = await invoke(request());
  assert.equal(providerFailure.status, 502);

  console.log('daily news source function tests pass');
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
