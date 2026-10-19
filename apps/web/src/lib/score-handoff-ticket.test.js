import test from 'node:test';
import assert from 'node:assert/strict';
import { issueScoreTicket, consumeScoreTicket, scoreTicketDigest, scoreTicketPath } from './score-handoff-ticket.js';

const accountId = '00000000-0000-4000-8000-000000000001';
const nowMs = 1_800_000_000_000;
function store() {
  const records = new Map();
  return {
    records,
    async insertIfAbsent(record) {
      if (records.has(record.digest)) return false;
      records.set(record.digest, record);
      return true;
    },
    async consume(digest) {
      const value = records.get(digest) || null;
      records.delete(digest);
      return value;
    },
  };
}
test('issues an opaque ticket and stores digest only', async () => {
  const db = store();
  const issued = await issueScoreTicket({ accountId, path: '/en/', store: db, nowMs });
  assert.match(issued.ticket, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(db.records.has(scoreTicketDigest(issued.ticket)), true);
  assert.equal(JSON.stringify([...db.records.values()]).includes(issued.ticket), false);
  assert.equal(issued.expiresAtMs, nowMs + 60_000);
});
test('consumes only once', async () => {
  const db = store();
  const { ticket } = await issueScoreTicket({ accountId, path: '/archive/en/', store: db, nowMs });
  assert.deepEqual(await consumeScoreTicket({ ticket, store: db, nowMs }), { accountId, path: '/archive/en/' });
  assert.equal(await consumeScoreTicket({ ticket, store: db, nowMs }), null);
});
test('expires after 60 seconds', async () => {
  const db = store();
  const { ticket } = await issueScoreTicket({ accountId, path: '/es/', store: db, nowMs });
  assert.equal(await consumeScoreTicket({ ticket, store: db, nowMs: nowMs + 60_000 }), null);
});
test('rejects malformed tokens and untrusted return paths', async () => {
  const db = store();
  assert.equal(await consumeScoreTicket({ ticket: 'invalid', store: db, nowMs }), null);
  for (const path of ['//attacker.test', 'https://attacker.test', '/en/?redirect=/', '/admin/', '/en/../admin']) {
    assert.equal(scoreTicketPath(path), null);
    await assert.rejects(issueScoreTicket({ accountId, path, store: db, nowMs }), TypeError);
  }
});
test('storage failure never issues a usable ticket', async () => {
  await assert.rejects(issueScoreTicket({ accountId, path: '/en/', store: {
    insertIfAbsent: async () => false,
  }, nowMs }), /unavailable/);
});
test('rejects wrong audience even with matching digest', async () => {
  const db = store();
  const { ticket } = await issueScoreTicket({ accountId, path: '/en/', store: db, nowMs });
  const digest = scoreTicketDigest(ticket);
  db.records.set(digest, { ...db.records.get(digest), audience: 'attacker.test' });
  assert.equal(await consumeScoreTicket({ ticket, store: db, nowMs }), null);
});
