import assert from 'node:assert/strict';
import handler from '../api/catalyst-brief-source.js';

const originalFetch = globalThis.fetch;
const originalEnv = {
  NEWSFEED_BEARER_TOKEN: process.env.NEWSFEED_BEARER_TOKEN,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_NEWS_MODEL: process.env.OPENAI_NEWS_MODEL,
};

const urls = {
  bls: 'https://www.bls.gov/schedule/2026/08_sched.htm',
  reuters: 'https://www.reuters.com/markets/us/jobs-preview-2026-08-06/',
  ap: 'https://apnews.com/article/jobs-economy-2026-preview',
};
const inventedBlsUrl = 'https://www.bls.gov/news.release/empsit.nr0.htm';

const candidate = {
  phase: 'preview',
  asOf: '2026-08-05',
  sourceEditionDate: '2026-08-05',
  eventDate: '2026-08-07',
  event: 'BLS Employment Situation — July 2026',
  eventType: 'labor',
  assets: ['DXY', 'U.S. rates', 'S&P 500'],
  importance: 'high',
  impactScore: 5,
  whyItMatters: 'Payrolls and unemployment can materially reprice the expected Federal Reserve path.',
};

const draft = {
  publishable: true,
  holdReason: '',
  statusLabel: 'scheduled-confirmed',
  summary: 'The official BLS calendar confirms the July Employment Situation release for August 7, with rates and dollar sensitivity concentrated around payrolls and unemployment.',
  verifiedFacts: [
    { statement: 'BLS schedules the July Employment Situation release for August 7, 2026.', sourceIds: ['bls-schedule'] },
    { statement: 'Independent reporting describes the release as an important input for rates expectations.', sourceIds: ['reuters-preview', 'ap-preview'] },
  ],
  transmissionChannels: [
    { channel: 'U.S. rates and DXY', conditionalImpact: 'A result that changes the expected policy path could transmit first through Treasury yields and the dollar.' },
    { channel: 'Gold and risk assets', conditionalImpact: 'Changes in real-rate and liquidity expectations may affect gold and rate-sensitive equities.' },
  ],
  whatToWatch: ['Payroll growth', 'Unemployment rate', 'Average hourly earnings'],
  sources: [
    { id: 'bls-schedule', title: 'BLS release calendar', url: urls.bls, publishedAt: '2026-08-05' },
    { id: 'reuters-preview', title: 'U.S. jobs preview', url: urls.reuters, publishedAt: '2026-08-05' },
    { id: 'ap-preview', title: 'Employment report preview', url: urls.ap, publishedAt: '2026-08-05' },
  ],
  body: '## Event map\n\nThe event matters because labor data can change the expected policy path.\n\n## Risk controls\n\nInterpret the release with revisions and participation data rather than one headline figure.',
};

function openAiResponse(bundle = draft, grounded = Object.values(urls)) {
  return {
    id: 'resp_catalyst_test',
    status: 'completed',
    output: [
      { type: 'web_search_call', action: { sources: grounded.map((url) => ({ type: 'url', url })) } },
      { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(bundle), annotations: [] }] },
    ],
  };
}

function request({ token = 'endpoint-secret', body = { candidate }, method = 'POST' } = {}) {
  return {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body,
  };
}

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = String(value); },
    end(body = '') { this.body = String(body); },
  };
}

async function invoke(req) {
  const response = responseRecorder();
  await handler(req, response);
  return { status: response.statusCode, headers: response.headers, json: JSON.parse(response.body) };
}

try {
  process.env.NEWSFEED_BEARER_TOKEN = 'endpoint-secret';
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_NEWS_MODEL = 'gpt-5-test';
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify(openAiResponse()), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const success = await invoke(request());
  assert.equal(success.status, 200);
  assert.equal(success.json.publishable, true);
  assert.equal(success.json.phase, 'preview');
  assert.equal(success.json.statusLabel, 'scheduled-confirmed');
  assert.equal(success.json.verifiedFacts[0].verification, 'verified-primary');
  assert.equal(success.json.verifiedFacts[1].verification, 'verified-multiple');
  assert.match(success.json.slug, /^\/news\/catalysts\/2026-08-07-/);
  assert.equal(success.headers['x-usd-impact-model'], 'gpt-5-test');
  const providerBody = JSON.parse(calls[0].options.body);
  assert.equal(providerBody.tool_choice, 'required');
  assert.ok(providerBody.include.includes('web_search_call.action.sources'));
  assert.ok(providerBody.tools[0].filters.allowed_domains.includes('bls.gov'));
  assert.match(providerBody.input, /Copy every sources\[\]\.url exactly/);

  assert.equal((await invoke(request({ token: '' }))).status, 401);
  assert.equal((await invoke(request({ method: 'GET' }))).status, 405);
  assert.equal((await invoke(request({ body: { candidate: { ...candidate, impactScore: 3 } } }))).status, 502);

  globalThis.fetch = async () => new Response(JSON.stringify(openAiResponse(draft, [urls.reuters, urls.ap])), { status: 200 });
  assert.equal((await invoke(request())).status, 502);

  const ungroundedDraft = {
    ...draft,
    sources: draft.sources.map((source) => (
      source.id === 'bls-schedule' ? { ...source, url: inventedBlsUrl } : source
    )),
  };
  const repairedLedger = {
    publishable: true,
    holdReason: '',
    sources: draft.sources.map(({ id, url }) => ({ id, url })),
    verifiedFactSourceIds: draft.verifiedFacts.map(({ sourceIds }) => sourceIds),
  };
  const repairCalls = [];
  globalThis.fetch = async (url, options) => {
    repairCalls.push({ url: String(url), options });
    const payload = repairCalls.length === 1
      ? openAiResponse(ungroundedDraft)
      : openAiResponse(repairedLedger, []);
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const repaired = await invoke(request());
  assert.equal(repaired.status, 200);
  assert.equal(repaired.json.sources[0].url, urls.bls);
  assert.equal(repairCalls.length, 2);
  const repairBody = JSON.parse(repairCalls[1].options.body);
  assert.equal(repairBody.model, 'gpt-5-mini');
  assert.equal(repairBody.tools, undefined);
  assert.equal(repairBody.max_output_tokens, 4_000);
  assert.ok(repairBody.input.includes(urls.bls));
  assert.match(repairBody.input, /Use only source IDs already present/);

  const inventedLedger = {
    ...repairedLedger,
    sources: repairedLedger.sources.map((source) => (
      source.id === 'bls-schedule' ? { ...source, url: inventedBlsUrl } : source
    )),
  };

  let failedRepairCalls = 0;
  globalThis.fetch = async () => {
    failedRepairCalls += 1;
    const payload = failedRepairCalls === 1 ? openAiResponse(ungroundedDraft) : openAiResponse(inventedLedger, []);
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  assert.equal((await invoke(request())).status, 502);
  assert.equal(failedRepairCalls, 2);

  console.log('catalyst brief source function tests pass');
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
