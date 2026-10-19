import test from 'node:test';
import assert from 'node:assert/strict';
import { handleScoreEdgeRedeem } from '../api/score-edge-redeem.js';
import { handleScoreEdgeValidate } from '../api/score-edge-validate.js';

const secret = 'x'.repeat(48);
function response() {
  return { statusCode: 0, headers: {}, body: '',
    setHeader(k,v) { this.headers[k.toLowerCase()] = v; },
    end(v='') { this.body = v; },
  };
}
async function invoke(handler, { enabled = true, key = secret, body = {} } = {}, deps = {}) {
  const res = response();
  await handler({
    method: 'POST', headers: { 'x-score-edge-secret': key }, body,
  }, res, {
    environment: {
      SCORE_EDGE_SHARED_SECRET: secret,
      SCORE_EDGE_REDEMPTION_ENABLED: enabled ? 'true' : 'false',
      SCORE_EDGE_VALIDATION_ENABLED: enabled ? 'true' : 'false',
    },
    ...deps,
  });
  return { status: res.statusCode, payload: JSON.parse(res.body) };
}
test('redemption endpoint disabled by default', async () => {
  const result = await invoke(handleScoreEdgeRedeem, { enabled: false });
  assert.equal(result.status, 503);
});
test('redemption rejects invalid shared secret', async () => {
  const result = await invoke(handleScoreEdgeRedeem, { key: 'wrong' });
  assert.equal(result.status, 403);
});
test('redemption rejects malformed ticket', async () => {
  const result = await invoke(handleScoreEdgeRedeem, { body: { ticket: 'bad' } });
  assert.equal(result.status, 400);
});
test('validation rejects invalid shared secret', async () => {
  const result = await invoke(handleScoreEdgeValidate, { key: 'wrong' });
  assert.equal(result.status, 403);
});
test('validation rejects invalid session token', async () => {
  const result = await invoke(handleScoreEdgeValidate, { body: { token: 'bad' } });
  assert.equal(result.status, 400);
});
test('validation fails closed on backend outage', async () => {
  const result = await invoke(handleScoreEdgeValidate,
    { body: { token: 'a'.repeat(43) } },
    { providers: {
      sessions: { lookup: async () => { throw new Error('offline'); } },
      membership: { isActive: async () => true },
    } });
  assert.equal(result.status, 503);
  assert.equal(result.payload.allowed, false);
});
