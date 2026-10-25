import test from 'node:test';
import assert from 'node:assert/strict';
import { handleScoreEdgeBridge } from '../src/lib/score-edge-bridge.js';

const sharedSecret = 's'.repeat(64);
const token = 't'.repeat(43);
const ticket = 'k'.repeat(43);
const accountId = '00000000-0000-4000-8000-000000000001';

function response() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body = '') { this.body = body; },
  };
}

function request({
  method = 'POST',
  url = '/api/account?action=score-edge',
  secret = sharedSecret,
  contentType = 'application/json',
  body = { action: 'redeem', ticket },
  contentLength = null,
} = {}) {
  const headers = {
    'content-type': contentType,
    'x-score-edge-secret': secret,
  };
  if (contentLength !== null) headers['content-length'] = String(contentLength);
  return { method, url, headers, body };
}

function dependencies(overrides = {}) {
  return {
    environment: {
      VERCEL_ENV: 'production',
      SCORE_EDGE_BRIDGE_ENABLED: 'true',
      SCORE_EDGE_SHARED_SECRET: sharedSecret,
    },
    config: { url: 'https://example.supabase.co', secretKey: 'sb_secret_' + 'x'.repeat(32) },
    ticketStore: {},
    providers: {
      membership: { isActive: async () => true },
      sessions: {
        create: async () => ({ token, expiresAtMs: Date.now() + 60000 }),
        lookup: async () => ({ accountId, expiresAtMs: Date.now() + 60000 }),
      },
    },
    redeemScoreHandoff: async ({ ticket: supplied }) => ({
      allowed: supplied === ticket,
      token,
      path: '/en/',
      expiresAtMs: Date.now() + 60000,
    }),
    authorizeScoreSession: async ({ token: supplied }) => supplied === token,
    ...overrides,
  };
}

async function run(options = {}, deps = {}) {
  const res = response();
  await handleScoreEdgeBridge(request(options), res, dependencies(deps));
  return {
    status: res.statusCode,
    payload: JSON.parse(res.body || '{}'),
    headers: res.headers,
  };
}

test('Production bridge is disabled unless explicitly enabled', async () => {
  const result = await run({}, {
    environment: {
      VERCEL_ENV: 'production',
      SCORE_EDGE_BRIDGE_ENABLED: 'false',
      SCORE_EDGE_SHARED_SECRET: sharedSecret,
    },
  });
  assert.equal(result.status, 503);
  assert.equal(result.payload.code, 'SCORE_EDGE_DISABLED');
});

test('Preview environment cannot activate Production bridge', async () => {
  const result = await run({}, {
    environment: {
      VERCEL_ENV: 'preview',
      SCORE_EDGE_BRIDGE_ENABLED: 'true',
      SCORE_EDGE_SHARED_SECRET: sharedSecret,
    },
  });
  assert.equal(result.status, 503);
  assert.equal(result.payload.code, 'SCORE_EDGE_DISABLED');
});

test('only POST on exact account action route is accepted', async () => {
  assert.equal((await run({ method: 'GET' })).status, 405);
  assert.equal((await run({ url: '/api/account?action=score-edge&debug=1' })).status, 404);
  assert.equal((await run({ url: '/api/account?action=other' })).status, 404);
  assert.equal((await run({ url: '/api/score-edge?action=score-edge' })).status, 404);
});

test('wrong shared secret fails before redemption', async () => {
  let called = false;
  const result = await run({ secret: 'a'.repeat(64) }, {
    redeemScoreHandoff: async () => { called = true; return { allowed: true }; },
  });
  assert.equal(result.status, 403);
  assert.equal(result.payload.code, 'SCORE_EDGE_DENIED');
  assert.equal(called, false);
});

test('invalid media type and oversized body fail closed', async () => {
  assert.equal((await run({ contentType: 'text/plain' })).status, 415);
  assert.equal((await run({ contentLength: 513 })).status, 413);
  assert.equal((await run({ body: { action: 'redeem', ticket, pad: 'x'.repeat(600) } })).status, 413);
});

test('schema rejects extra keys and wrong token shapes', async () => {
  assert.equal((await run({ body: { action: 'redeem', ticket, extra: true } })).status, 400);
  assert.equal((await run({ body: { action: 'redeem', ticket: 'short' } })).status, 400);
  assert.equal((await run({ body: { action: 'validate', token: 'short' } })).status, 400);
});

test('redeem returns only bounded session fields', async () => {
  const result = await run();
  assert.equal(result.status, 200);
  assert.equal(result.payload.allowed, true);
  assert.equal(result.payload.token, token);
  assert.equal(result.payload.path, '/en/');
  assert.match(result.payload.expiresAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal('accountId' in result.payload, false);
  assert.equal(JSON.stringify(result.payload).includes(sharedSecret), false);
});

test('redeem denial stays generic', async () => {
  const result = await run({}, {
    redeemScoreHandoff: async () => ({ allowed: false, code: 'RESEARCH_MEMBERSHIP_REQUIRED' }),
  });
  assert.equal(result.status, 403);
  assert.deepEqual(result.payload, { allowed: false, code: 'SCORE_EDGE_DENIED' });
});

test('validate returns allow or generic deny', async () => {
  const allowed = await run({ body: { action: 'validate', token } });
  assert.equal(allowed.status, 200);
  assert.deepEqual(allowed.payload, { allowed: true });

  const denied = await run({ body: { action: 'validate', token } }, {
    authorizeScoreSession: async () => false,
  });
  assert.equal(denied.status, 403);
  assert.deepEqual(denied.payload, { allowed: false, code: 'SCORE_EDGE_DENIED' });
});

test('backend failures return generic 503 without provider details', async () => {
  const result = await run({}, {
    redeemScoreHandoff: async () => { throw new Error('provider secret detail'); },
  });
  assert.equal(result.status, 503);
  assert.deepEqual(result.payload, { allowed: false, code: 'SCORE_EDGE_UNAVAILABLE' });
  assert.equal(JSON.stringify(result.payload).includes('provider secret detail'), false);
});

test('security response headers are always present', async () => {
  const result = await run();
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.headers['referrer-policy'], 'no-referrer');
  assert.equal(result.headers['x-content-type-options'], 'nosniff');
});
