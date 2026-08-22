import assert from 'node:assert/strict';
import {
  deliverWebPushBatch,
  normalizeWebPushPayload,
  readWebPushTransportConfig,
  WebPushDeliveryError,
} from '../src/lib/web-push-delivery.js';

const config = {
  url: 'https://example.supabase.co',
  publishableKey: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  secretKey: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
};
const vapidPublicKey = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString('base64url');
const vapidPrivateKey = Buffer.alloc(32, 9).toString('base64url');
const enabledEnvironment = {
  WEB_PUSH_DELIVERY_ENABLED: 'true',
  WEB_PUSH_VAPID_PUBLIC_KEY: vapidPublicKey,
  WEB_PUSH_VAPID_PRIVATE_KEY: vapidPrivateKey,
  WEB_PUSH_VAPID_SUBJECT: 'mailto:support@usd-impact.com',
};
const rows = [
  {
    id: '123e4567-e89b-42d3-a456-426614174001',
    endpoint: 'https://push.example.test/send/one',
    p256dh: 'p256dh_ONE-123',
    auth_secret: 'auth_ONE-123',
    expiration_time: null,
  },
  {
    id: '123e4567-e89b-42d3-a456-426614174002',
    endpoint: 'https://push.example.test/send/two',
    p256dh: 'p256dh_TWO-123',
    auth_secret: 'auth_TWO-123',
    expiration_time: 1780000000000,
  },
  {
    id: '123e4567-e89b-42d3-a456-426614174003',
    endpoint: 'https://push.example.test/send/three',
    p256dh: 'p256dh_THREE-123',
    auth_secret: 'auth_THREE-123',
    expiration_time: null,
  },
  {
    id: '123e4567-e89b-42d3-a456-426614174004',
    endpoint: 'https://push.example.test/send/four',
    p256dh: 'p256dh_FOUR-123',
    auth_secret: 'auth_FOUR-123',
    expiration_time: null,
  },
];

function response({ ok = true, status = 200, payload = null } = {}) {
  return {
    ok,
    status,
    async text() {
      return payload === null ? '' : JSON.stringify(payload);
    },
  };
}

const normalized = normalizeWebPushPayload({
  title: 'Daily USD Impact',
  body: 'Your new learning card is ready.',
  url: '/learn/daily-card/',
  tag: 'daily-card',
});
assert.deepEqual(normalized, {
  title: 'Daily USD Impact',
  body: 'Your new learning card is ready.',
  url: '/learn/daily-card/',
  tag: 'daily-card',
});
assert.throws(() => normalizeWebPushPayload({ url: 'https://evil.example/x' }), /same-origin relative path/);
assert.throws(() => normalizeWebPushPayload({ url: '//evil.example/x' }), /same-origin relative path/);
assert.throws(() => normalizeWebPushPayload({ title: 'x'.repeat(81) }), /Push title is invalid/);
assert.deepEqual(readWebPushTransportConfig(enabledEnvironment), {
  subject: 'mailto:support@usd-impact.com',
  publicKey: vapidPublicKey,
  privateKey: vapidPrivateKey,
});
assert.throws(
  () => readWebPushTransportConfig({ ...enabledEnvironment, WEB_PUSH_VAPID_PRIVATE_KEY: 'invalid' }),
  /WEB_PUSH_VAPID_PRIVATE_KEY is missing or invalid/,
);

let disabledRead = false;
await assert.rejects(
  () => deliverWebPushBatch({
    payload: {},
    sendNotification: async () => {},
    environment: {},
    config,
    fetchImpl: async () => {
      disabledRead = true;
      return response({ payload: [] });
    },
  }),
  (error) => error instanceof WebPushDeliveryError && error.code === 'WEB_PUSH_DELIVERY_DISABLED',
);
assert.equal(disabledRead, false);

const calls = [];
const fetchImpl = async (url, options = {}) => {
  calls.push({ url, options });
  assert.equal(options.headers.apikey, config.secretKey);
  assert.equal(Object.hasOwn(options.headers, 'Authorization'), false);
  if (options.method === undefined || options.method === 'GET') return response({ payload: rows });
  if (url.includes('174004')) {
    return response({ ok: false, status: 500, payload: { message: 'Bookkeeping unavailable' } });
  }
  return response({ status: 204 });
};
const deliveries = [];
const result = await deliverWebPushBatch({
  payload: {
    title: 'Daily USD Impact',
    body: 'A new card is ready.',
    url: '/learn/',
    tag: 'daily-card',
  },
  sendNotification: async ({ subscription, payload, vapid }) => {
    deliveries.push({ subscription, payload: JSON.parse(payload), vapid });
    if (subscription.endpoint.endsWith('/two')) {
      const error = new Error('Gone');
      error.statusCode = 410;
      throw error;
    }
    if (subscription.endpoint.endsWith('/three')) {
      const error = new Error('Temporary transport failure');
      error.statusCode = 503;
      throw error;
    }
  },
  environment: enabledEnvironment,
  config,
  fetchImpl,
  now: new Date('2026-08-22T14:30:00.000Z'),
});
assert.deepEqual(result, { attempted: 4, sent: 2, staleDisabled: 1, failed: 1, bookkeepingFailed: 1 });
assert.equal(deliveries.length, 4);
assert.equal(deliveries[0].subscription.keys.auth, 'auth_ONE-123');
assert.equal(deliveries[0].payload.url, '/learn/');
assert.equal(deliveries[0].vapid.privateKey, vapidPrivateKey);
assert.equal(calls.length, 4);
assert.match(calls[0].url, /enabled=eq\.true/);
assert.match(calls[0].url, /limit=50$/);
assert.deepEqual(JSON.parse(calls[1].options.body), {
  last_used_at: '2026-08-22T14:30:00.000Z',
});
assert.deepEqual(JSON.parse(calls[2].options.body), {
  enabled: false,
  updated_at: '2026-08-22T14:30:00.000Z',
});
assert.deepEqual(JSON.parse(calls[3].options.body), {
  last_used_at: '2026-08-22T14:30:00.000Z',
});

console.log('Web Push delivery orchestration contract verified.');
