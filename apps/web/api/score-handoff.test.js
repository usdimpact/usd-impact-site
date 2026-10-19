import test from 'node:test';
import assert from 'node:assert/strict';
import { handleScoreHandoff } from './score-handoff.js';

const userId = '00000000-0000-4000-8000-000000000001';
function response() {
  return { statusCode: 0, headers: {}, body: '',
    setHeader(k,v) { this.headers[k.toLowerCase()] = v; },
    end(body='') { this.body = body; },
  };
}
async function run({ enabled = 'true', method = 'POST', origin = 'https://www.usd-impact.com',
  path = '/en/', session = { value: { allowed: true, user: { id: userId } } },
  contentType = 'application/json', store } = {}) {
  const res = response();
  await handleScoreHandoff({
    method, body: { path },
    headers: { host: 'www.usd-impact.com', origin, 'x-forwarded-proto': 'https',
      'content-type': contentType, 'sec-fetch-site': 'same-origin' },
  }, res, {
    environment: { SCORE_HANDOFF_ISSUANCE_ENABLED: enabled },
    resolveSessionWithRefresh: async () => session,
    store: store || { insertIfAbsent: async () => true },
  });
  return { status: res.statusCode, payload: JSON.parse(res.body) };
}
test('feature disabled by default', async () => {
  const result = await run({ enabled: 'false' });
  assert.equal(result.status, 503);
  assert.equal(result.payload.code, 'SCORE_HANDOFF_DISABLED');
});
test('same-origin entitled request gets a short-lived ticket', async () => {
  const result = await run();
  assert.equal(result.status, 200);
  assert.match(result.payload.ticket, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(result.payload.path, '/en/');
});
test('unentitled request fails', async () => {
  const result = await run({ session: { value: { allowed: false, user: { id: userId } } } });
  assert.equal(result.status, 403);
});
test('cross-origin request fails', async () => {
  const result = await run({ origin: 'https://attacker.test' });
  assert.equal(result.status, 403);
});
test('invalid path fails', async () => {
  const result = await run({ path: '//attacker.test' });
  assert.equal(result.status, 400);
});
test('storage error never issues a ticket', async () => {
  const result = await run({ store: { insertIfAbsent: async () => false } });
  assert.equal(result.status, 500);
  assert.equal(result.payload.allowed, false);
});
test('wrong method and content type rejected', async () => {
  assert.equal((await run({ method: 'GET' })).status, 405);
  assert.equal((await run({ contentType: 'text/plain' })).status, 415);
});
