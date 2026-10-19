import test from 'node:test';
import assert from 'node:assert/strict';
import { issueScoreTicket } from './score-handoff-ticket.js';
import { redeemScoreHandoff, authorizeScoreSession } from './score-redemption.js';

const accountId = '00000000-0000-4000-8000-000000000001';
const nowMs = 1800000000000;
const token = 'a'.repeat(43);
function setup(active = true) {
  const records = new Map();
  const ticketStore = {
    async insertIfAbsent(r) { if (records.has(r.digest)) return false; records.set(r.digest, r); return true; },
    async consume(d) { const r = records.get(d) || null; records.delete(d); return r; },
  };
  const membership = { isActive: async (id) => active && id === accountId };
  const sessions = {
    create: async ({ accountId: id }) => ({ token, accountId: id, expiresAtMs: nowMs + 120000 }),
    lookup: async (t) => t === token ? { accountId, expiresAtMs: nowMs + 120000 } : null,
  };
  return { ticketStore, membership, sessions };
}
test('redeems once and creates a distinct short-lived session', async () => {
  const deps = setup();
  const issued = await issueScoreTicket({ accountId, path: '/en/', store: deps.ticketStore, nowMs });
  const result = await redeemScoreHandoff({ ...deps, ticket: issued.ticket, nowMs });
  assert.equal(result.allowed, true);
  assert.notEqual(result.token, issued.ticket);
  assert.equal(await authorizeScoreSession({ ...deps, token: result.token, nowMs }), true);
  assert.equal((await redeemScoreHandoff({ ...deps, ticket: issued.ticket, nowMs })).allowed, false);
});
test('revoked membership burns ticket and denies session', async () => {
  const deps = setup(false);
  const issued = await issueScoreTicket({ accountId, path: '/es/', store: deps.ticketStore, nowMs });
  const result = await redeemScoreHandoff({ ...deps, ticket: issued.ticket, nowMs });
  assert.equal(result.code, 'RESEARCH_MEMBERSHIP_REQUIRED');
  assert.equal(await authorizeScoreSession({ ...deps, token, nowMs }), false);
});
test('expired session is denied', async () => {
  const deps = setup();
  assert.equal(await authorizeScoreSession({ ...deps, token, nowMs: nowMs + 120000 }), false);
});
test('session provider cannot reuse handoff ticket', async () => {
  const deps = setup();
  const issued = await issueScoreTicket({ accountId, path: '/en/', store: deps.ticketStore, nowMs });
  deps.sessions.create = async () => ({ token: issued.ticket, expiresAtMs: nowMs + 120000 });
  await assert.rejects(redeemScoreHandoff({ ...deps, ticket: issued.ticket, nowMs }), /unavailable/);
});
test('membership backend errors fail closed', async () => {
  const deps = setup();
  deps.membership.isActive = async () => { throw new Error('backend unavailable'); };
  await assert.rejects(authorizeScoreSession({ ...deps, token, nowMs }), /unavailable/);
});
