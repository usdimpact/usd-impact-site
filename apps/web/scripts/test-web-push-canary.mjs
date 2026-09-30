import assert from 'node:assert/strict';
import {
  readWebPushCanaryPayload,
  runWebPushOwnerCanary,
  WEB_PUSH_CANARY_CONFIRMATION,
} from '../src/lib/web-push-canary.js';

const baseEnvironment = {
  WEB_PUSH_CANARY_CONFIRMATION,
  WEB_PUSH_DELIVERY_ENABLED: 'true',
  WEB_PUSH_CANARY_TITLE: 'USD Impact test',
  WEB_PUSH_CANARY_BODY: 'Owner-only browser notification canary.',
  WEB_PUSH_CANARY_URL: '/account/notifications',
  WEB_PUSH_CANARY_TAG: 'owner-canary',
};

assert.deepEqual(readWebPushCanaryPayload(baseEnvironment), {
  title: 'USD Impact test',
  body: 'Owner-only browser notification canary.',
  url: '/account/notifications',
  tag: 'owner-canary',
});

await assert.rejects(
  () => runWebPushOwnerCanary({ environment: { ...baseEnvironment, WEB_PUSH_CANARY_CONFIRMATION: '' } }),
  /confirmation is required/,
);

await assert.rejects(
  () => runWebPushOwnerCanary({ environment: { ...baseEnvironment, WEB_PUSH_DELIVERY_ENABLED: 'false' } }),
  /must be explicitly enabled/,
);

let call;
const sendNotification = async () => true;
const result = await runWebPushOwnerCanary({
  environment: baseEnvironment,
  sendNotification,
  deliver: async (input) => {
    call = input;
    return Object.freeze({ attempted: 1, sent: 1, staleDisabled: 0, failed: 0, bookkeepingFailed: 0 });
  },
});
assert.equal(call.limit, 1);
assert.equal(call.environment, baseEnvironment);
assert.equal(call.sendNotification, sendNotification);
assert.deepEqual(call.payload, {
  title: 'USD Impact test',
  body: 'Owner-only browser notification canary.',
  url: '/account/notifications',
  tag: 'owner-canary',
});
assert.deepEqual(result, { attempted: 1, sent: 1, staleDisabled: 0, failed: 0, bookkeepingFailed: 0 });

console.log('Web Push owner canary contract verified.');
