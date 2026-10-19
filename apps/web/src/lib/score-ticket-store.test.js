import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreTicketStore } from './score-ticket-store.js';

const digest = 'a'.repeat(64);
const record = { digest, accountId: 'account', audience: 'score.usd-impact.com',
  path: '/en/', expiresAtMs: 1800000060000 };

test('store adapter accepts exact atomic insert success', async () => {
  const store = createScoreTicketStore({ insert: async () => true, consume: async () => record });
  assert.equal(await store.insertIfAbsent(record), true);
  assert.deepEqual(await store.consume(digest), record);
});
test('ambiguous insert result fails closed', async () => {
  const store = createScoreTicketStore({ insert: async () => ({ inserted: true }), consume: async () => null });
  assert.equal(await store.insertIfAbsent(record), false);
});
test('invalid digest never reaches storage', async () => {
  let calls = 0;
  const store = createScoreTicketStore({ insert: async () => true, consume: async () => { calls++; return record; } });
  assert.equal(await store.consume('invalid'), null);
  assert.equal(calls, 0);
});
test('mismatched digest is not accepted', async () => {
  const store = createScoreTicketStore({ insert: async () => true, consume: async () => ({ ...record, digest: 'b'.repeat(64) }) });
  assert.equal(await store.consume(digest), null);
});
test('missing atomic operations rejected', () => {
  assert.throws(() => createScoreTicketStore({ insert: async () => true }), TypeError);
});
