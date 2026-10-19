import test from 'node:test';
import assert from 'node:assert/strict';
import { handleScoreMembershipCheck } from '../src/lib/score-membership-handler.js';

function mockResponse() {
  return {
    statusCode: 0, headers: {}, body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body = '') { this.body = body; },
  };
}
async function check({ method = 'GET', session = { accessToken: 'opaque', value: { allowed: true } }, error = null } = {}) {
  const response = mockResponse();
  const calls = [];
  await handleScoreMembershipCheck({ method, headers: {} }, response, {
    resolveSessionWithRefresh: async ({ verifyAccessToken }) => {
      if (error) throw error;
      if (session) await verifyAccessToken('opaque');
      return session;
    },
    readAccountAccessState: async (args) => {
      calls.push(args);
      return session?.value;
    },
  });
  return { response, calls, payload: JSON.parse(response.body) };
}
test('active Research Membership returns allowed with no account identifiers', async () => {
  const { response, calls, payload } = await check();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(payload, { allowed: true, productId: 'research-membership' });
  assert.equal(calls[0].productId, 'research-membership');
  assert.equal(response.headers['cache-control'], 'no-store');
});
test('anonymous request is denied', async () => {
  const { response, payload } = await check({ session: null });
  assert.equal(response.statusCode, 401);
  assert.equal(payload.allowed, false);
});
test('no valid membership is denied', async () => {
  const { response, payload } = await check({ session: { accessToken: 'opaque', value: { allowed: false } } });
  assert.equal(response.statusCode, 403);
  assert.equal(payload.code, 'RESEARCH_MEMBERSHIP_REQUIRED');
});
test('unsupported method rejected', async () => {
  const { response } = await check({ method: 'POST' });
  assert.equal(response.statusCode, 405);
});
test('backend failure does not grant access', async () => {
  const { response, payload } = await check({ error: new Error('backend unavailable') });
  assert.equal(response.statusCode, 500);
  assert.equal(payload.allowed, false);
});
