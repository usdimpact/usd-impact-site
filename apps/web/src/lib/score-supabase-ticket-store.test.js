import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseScoreTicketStore } from './score-supabase-ticket-store.js';

const config = { url: 'https://example.supabase.co', secretKey: 'sb_secret_' + 'x'.repeat(32) };
const record = { digest: 'a'.repeat(64), accountId: '00000000-0000-4000-8000-000000000001',
  audience: 'score.usd-impact.com', path: '/en/', expiresAtMs: 1800000060000 };

test('issues via server-only RPC and returns exact success', async () => {
  const calls = [];
  const store = createSupabaseScoreTicketStore({ config, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => true };
  } });
  assert.equal(await store.insertIfAbsent(record), true);
  assert.match(calls[0].url, /score_ticket_issue_atomic$/);
  assert.equal(JSON.parse(calls[0].options.body).p_digest, record.digest);
  assert.equal(calls[0].options.headers.apikey, config.secretKey);
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[0].options.redirect, 'error');
});
test('atomic consumption maps database fields', async () => {
  const store = createSupabaseScoreTicketStore({ config, fetchImpl: async () => ({
    ok: true, json: async () => ({
      digest: record.digest, account_id: record.accountId, audience: record.audience,
      path: record.path, expires_at: new Date(record.expiresAtMs).toISOString(),
    }),
  }) });
  assert.deepEqual(await store.consume(record.digest), record);
});
test('RPC failure denies instead of returning a ticket', async () => {
  const store = createSupabaseScoreTicketStore({ config, fetchImpl: async () => ({
    ok: false, status: 503,
  }) });
  await assert.rejects(store.insertIfAbsent(record), /unavailable/);
});
test('public key cannot configure privileged adapter', () => {
  assert.throws(() => createSupabaseScoreTicketStore({
    config: { ...config, secretKey: 'sb_publishable_' + 'x'.repeat(32) },
  }), TypeError);
});
