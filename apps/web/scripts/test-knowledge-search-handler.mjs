import assert from 'node:assert/strict';
import { handleKnowledgeSearchRequest } from '../src/lib/knowledge-search-handler.js';
import { SESSION_COOKIE_NAMES } from '../src/lib/supabase-auth.js';

const originalFlag = process.env.KNOWLEDGE_SEARCH_ENABLED;
const accessToken = 'eyJhbGciOiJIUzI1NiJ9.knowledge-search-test-token.signature';

function request({
  method = 'POST',
  authenticated = false,
  body = { query: 'real yields gold' },
  json = true,
  crossSite = false,
} = {}) {
  return {
    method,
    url: '/api/knowledge-search',
    body,
    headers: {
      host: 'usd-impact-test.example',
      ...(authenticated ? { cookie: `${SESSION_COOKIE_NAMES.ACCESS}=${encodeURIComponent(accessToken)}` } : {}),
      ...(json ? { 'content-type': 'application/json' } : {}),
      'sec-fetch-site': crossSite ? 'cross-site' : 'same-origin',
    },
  };
}

function responseRecorder() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
    end(value = '') { this.body = value; },
  };
}

function row({ tier = 'open', content = 'Gold often responds to changes in real yields.' } = {}) {
  return {
    id: '123e4567-e89b-42d3-a456-426614174000',
    sourceType: tier === 'research' ? 'weekly_report' : 'lesson',
    sourceId: tier === 'research' ? 'weekly-2026-08-14' : 'gold-real-yields',
    sourcePath: tier === 'research' ? '/reports/weekly/2026-08-14/' : '/learn/gold-dollar-vs-real-yields/',
    title: tier === 'research' ? 'Weekly USD Impact Brief' : 'Gold and real yields',
    content,
    language: 'en',
    accessTier: tier,
    chunkIndex: 0,
    publishedAt: '2026-08-14T00:00:00.000Z',
    metadata: { privateInternalField: 'must not be returned' },
    rank: 0.91,
  };
}

try {
  delete process.env.KNOWLEDGE_SEARCH_ENABLED;
  const disabled = responseRecorder();
  await handleKnowledgeSearchRequest(request(), disabled);
  assert.equal(disabled.statusCode, 404);
  assert.equal(JSON.parse(disabled.body).code, 'KNOWLEDGE_SEARCH_DISABLED');

  process.env.KNOWLEDGE_SEARCH_ENABLED = 'true';

  const method = responseRecorder();
  await handleKnowledgeSearchRequest(request({ method: 'GET' }), method);
  assert.equal(method.statusCode, 405);
  assert.equal(method.getHeader('allow'), 'POST');

  const crossSite = responseRecorder();
  await handleKnowledgeSearchRequest(request({ crossSite: true }), crossSite);
  assert.equal(crossSite.statusCode, 403);

  const contentType = responseRecorder();
  await handleKnowledgeSearchRequest(request({ json: false }), contentType);
  assert.equal(contentType.statusCode, 415);

  let anonymousSearchArgs = null;
  const anonymous = responseRecorder();
  await handleKnowledgeSearchRequest(request(), anonymous, {
    searchKnowledge: async (args) => {
      anonymousSearchArgs = args;
      return [row({ content: `${'A'.repeat(1400)} end` })];
    },
  });
  assert.equal(anonymous.statusCode, 200);
  const anonymousPayload = JSON.parse(anonymous.body);
  assert.deepEqual(anonymousSearchArgs.allowedAccessTiers, ['open']);
  assert.equal(anonymousPayload.access, 'open');
  assert.equal(anonymousPayload.mode, 'retrieval');
  assert.equal(anonymousPayload.results.length, 1);
  assert.equal(anonymousPayload.results[0].accessTier, 'open');
  assert.ok(anonymousPayload.results[0].excerpt.length <= 1201);
  assert.equal(anonymousPayload.results[0].excerptTruncated, true);
  assert.equal('id' in anonymousPayload.results[0], false);
  assert.equal('rank' in anonymousPayload.results[0], false);
  assert.equal('metadata' in anonymousPayload.results[0], false);
  assert.equal('content' in anonymousPayload.results[0], false);

  let paidSearchArgs = null;
  const paid = responseRecorder();
  await handleKnowledgeSearchRequest(request({ authenticated: true }), paid, {
    readAccessState: async ({ accessToken: supplied }) => {
      assert.equal(supplied, accessToken);
      return { allowed: true, reason: 'active' };
    },
    searchKnowledge: async (args) => {
      paidSearchArgs = args;
      return [row({ tier: 'research' })];
    },
  });
  assert.equal(paid.statusCode, 200);
  assert.deepEqual(paidSearchArgs.allowedAccessTiers, ['open', 'research']);
  assert.equal(JSON.parse(paid.body).access, 'research');
  assert.equal(JSON.parse(paid.body).results[0].accessTier, 'research');

  let staleSearchArgs = null;
  const stale = responseRecorder();
  await handleKnowledgeSearchRequest(request({ authenticated: true }), stale, {
    readAccessState: async () => { throw new Error('expired session'); },
    searchKnowledge: async (args) => {
      staleSearchArgs = args;
      return [row()];
    },
  });
  assert.equal(stale.statusCode, 200);
  assert.deepEqual(staleSearchArgs.allowedAccessTiers, ['open']);
  assert.equal(JSON.parse(stale.body).access, 'open');

  const count = responseRecorder();
  await handleKnowledgeSearchRequest(request({ body: { query: 'gold', matchCount: 13 } }), count, {
    searchKnowledge: async () => [],
  });
  assert.equal(count.statusCode, 400);
  assert.equal(JSON.parse(count.body).code, 'INVALID_KNOWLEDGE_SEARCH');

  const invalidQuery = responseRecorder();
  await handleKnowledgeSearchRequest(request({ body: { query: 'x' } }), invalidQuery, {
    searchKnowledge: async () => { throw new TypeError('Knowledge query must be between 2 and 500 characters.'); },
  });
  assert.equal(invalidQuery.statusCode, 400);
  assert.equal(JSON.parse(invalidQuery.body).code, 'INVALID_KNOWLEDGE_SEARCH');

  console.log('Knowledge search HTTP boundary tests passed.');
} finally {
  if (originalFlag === undefined) delete process.env.KNOWLEDGE_SEARCH_ENABLED;
  else process.env.KNOWLEDGE_SEARCH_ENABLED = originalFlag;
}
