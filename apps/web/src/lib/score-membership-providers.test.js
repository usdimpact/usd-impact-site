import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreMembershipProviders } from './score-membership-providers.js';

const accountId = '00000000-0000-4000-8000-000000000001';
const config = { url: 'https://example.supabase.co', secretKey: 'sb_secret_' + 'x'.repeat(32) };
test('creates hashed session and looks it up without sending raw token', async () => {
  const requests = [];
  const providers = createScoreMembershipProviders({ config, fetchImpl: async (url, options) => {
    const body = JSON.parse(options.body);
    requests.push({ url, body });
    if (url.endsWith('score_session_create')) return { ok: true, json: async () => true };
    if (url.endsWith('score_session_lookup')) return {
      ok: true, json: async () => ({ account_id: accountId, expires_at: new Date(1800000900000).toISOString() }),
    };
    return { ok: true, json: async () => true };
  } });
  const session = await providers.sessions.create({ accountId, nowMs: 1800000000000 });
  assert.match(session.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(requests[0].body.p_digest.length, 64);
  assert.equal(JSON.stringify(requests[0]).includes(session.token), false);
  assert.equal((await providers.sessions.lookup(session.token)).accountId, accountId);
  assert.equal(requests[1].body.p_digest, requests[0].body.p_digest);
});
test('denies when membership RPC is false', async () => {
  const providers = createScoreMembershipProviders({ config, fetchImpl: async () => ({
    ok: true, json: async () => false,
  }) });
  assert.equal(await providers.membership.isActive(accountId), false);
});
test('refuses to issue session on database rejection', async () => {
  const providers = createScoreMembershipProviders({ config, fetchImpl: async () => ({
    ok: true, json: async () => false,
  }) });
  await assert.rejects(providers.sessions.create({ accountId }), /unavailable/);
});
test('backend failure never grants access', async () => {
  const providers = createScoreMembershipProviders({ config, fetchImpl: async () => ({ ok: false }) });
  await assert.rejects(providers.membership.isActive(accountId), /unavailable/);
});
test('requires server-only secret', () => {
  assert.throws(() => createScoreMembershipProviders({
    config: { ...config, secretKey: 'sb_publishable_' + 'x'.repeat(32) },
  }), TypeError);
});
