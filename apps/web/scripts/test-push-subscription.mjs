import assert from 'node:assert/strict';
import {
  disableOwnPushSubscription,
  normalizePushSubscription,
  upsertOwnPushSubscription,
} from '../src/lib/push-subscription.js';

const config = {
  url: 'https://example.supabase.co',
  publishableKey: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  secretKey: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
};
const accessToken = 'abcdefghijklmnopqrstuvwxyz1234567890';
const userId = '123e4567-e89b-42d3-a456-426614174000';

function response({ ok = true, status = 200, payload = null } = {}) {
  return {
    ok,
    status,
    async text() {
      return payload === null ? '' : JSON.stringify(payload);
    },
  };
}

const normalized = normalizePushSubscription({
  endpoint: 'https://push.example.test/send/abc?token=123',
  expirationTime: null,
  keys: {
    p256dh: 'AbCdEf_123-xyz',
    auth: 'auth_123-XYZ',
  },
});
assert.equal(normalized.endpoint, 'https://push.example.test/send/abc?token=123');
assert.match(normalized.endpointHash, /^[a-f0-9]{64}$/);
assert.equal(normalized.expirationTime, null);
assert.throws(
  () => normalizePushSubscription({ endpoint: 'http://push.example.test/x', keys: { p256dh: 'abc', auth: 'def' } }),
  /HTTPS URL/,
);
assert.throws(
  () => normalizePushSubscription({ endpoint: 'https://push.example.test/x#fragment', keys: { p256dh: 'abc', auth: 'def' } }),
  /without credentials or fragments/,
);

const calls = [];
const fetchImpl = async (url, options = {}) => {
  calls.push({ url, options });
  if (url.endsWith('/auth/v1/user')) {
    return response({ payload: {
      id: userId,
      email: 'member@example.com',
      email_confirmed_at: '2026-08-01T00:00:00.000Z',
    } });
  }
  return response({ status: 204 });
};

const stored = await upsertOwnPushSubscription({
  accessToken,
  subscription: {
    endpoint: 'https://push.example.test/send/member',
    expirationTime: 1780000000000,
    keys: { p256dh: 'p256dh_ABC-123', auth: 'auth_ABC-123' },
  },
  config,
  fetchImpl,
  now: new Date('2026-08-22T02:45:00.000Z'),
});
assert.equal(stored.ok, true);
assert.equal(stored.enabled, true);
assert.equal(Object.hasOwn(stored, 'endpoint'), false);
assert.equal(calls.length, 2);
assert.match(calls[1].url, /\/rest\/v1\/push_subscriptions\?on_conflict=account_id,endpoint_hash$/);
const upsertBody = JSON.parse(calls[1].options.body);
assert.equal(upsertBody.account_id, userId);
assert.equal(upsertBody.endpoint, 'https://push.example.test/send/member');
assert.equal(upsertBody.enabled, true);
assert.match(upsertBody.endpoint_hash, /^[a-f0-9]{64}$/);
assert.equal(calls[1].options.headers.apikey, config.secretKey);

calls.length = 0;
const disabled = await disableOwnPushSubscription({
  accessToken,
  endpoint: 'https://push.example.test/send/member',
  config,
  fetchImpl,
  now: new Date('2026-08-22T03:00:00.000Z'),
});
assert.equal(disabled.ok, true);
assert.equal(disabled.enabled, false);
assert.equal(calls.length, 2);
assert.match(calls[1].url, /account_id=eq\.123e4567-e89b-42d3-a456-426614174000/);
assert.match(calls[1].url, /endpoint_hash=eq\.[a-f0-9]{64}$/);
assert.deepEqual(JSON.parse(calls[1].options.body), {
  enabled: false,
  updated_at: '2026-08-22T03:00:00.000Z',
});

console.log('Web Push subscription storage contract verified.');
