import assert from 'node:assert/strict';
import { OUTCOME } from './integrity-watchdog-policy.mjs';
import { resendContracts } from './integrity-watchdog-resend.mjs';

const reply = (body, status = 200, url = '') => {
  const response = new Response(body, { status });
  if (url) Object.defineProperty(response, 'url', { value: url });
  return response;
};

const testKey = 're_watchdog_test_key_not_real';

let blockedCalled = false;
const blocked = await resendContracts({
  env: { USDIMPACT_WATCHDOG_RESEND_API_KEY: testKey },
  fetchImpl: async () => {
    blockedCalled = true;
    throw new Error('Resend must remain blocked without explicit full-access approval.');
  },
});
assert.equal(blocked[0].outcome, OUTCOME.UNKNOWN);
assert.equal(blockedCalled, false);

const methods = [];
const liveShape = await resendContracts({
  env: {
    USDIMPACT_WATCHDOG_RESEND_API_KEY: testKey,
    USDIMPACT_WATCHDOG_RESEND_FULL_ACCESS_APPROVED: 'true',
    USDIMPACT_WATCHDOG_RESEND_WEBHOOK_ENDPOINT: 'https://www.usd-impact.com/api/resend-webhook',
  },
  fetchImpl: async (url, options = {}) => {
    methods.push(options.method || 'GET');
    if (String(url).endsWith('/domains')) {
      return reply(JSON.stringify({ data: [{ name: 'updates.usd-impact.com', status: 'verified', region: 'us-east-1' }] }), 200, String(url));
    }
    return reply(JSON.stringify({ data: [
      {
        status: 'enabled',
        endpoint: 'https://www.usd-impact.com/api/resend-webhook',
        events: ['email.sent', 'email.delivered', 'email.delivery_delayed', 'email.bounced', 'email.complained', 'email.failed', 'email.suppressed'],
      },
      {
        status: 'disabled',
        endpoint: 'https://legacy.example.invalid/probe?token=credential-like-value',
        events: ['email.delivered', 'email.bounced', 'email.complained', 'email.suppressed'],
      },
    ] }), 200, String(url));
  },
});
assert.equal(liveShape[0].outcome, OUTCOME.PASS);
assert.equal(liveShape[0].evidence[0].expected_domain, 'updates.usd-impact.com');
assert.equal(liveShape[0].evidence[0].enabled_webhook_count, 1);
assert.equal(liveShape[0].evidence[0].disabled_webhook_count, 1);
assert.equal(liveShape[0].evidence[0].matching_enabled_webhook_count, 1);
assert.equal(liveShape[0].evidence[0].webhook_urls_collected, false);
assert.deepEqual(methods, ['GET', 'GET']);
assert.doesNotMatch(JSON.stringify(liveShape), /credential-like-value/);

const disabledOnly = await resendContracts({
  env: {
    USDIMPACT_WATCHDOG_RESEND_API_KEY: testKey,
    USDIMPACT_WATCHDOG_RESEND_FULL_ACCESS_APPROVED: 'true',
    USDIMPACT_WATCHDOG_RESEND_DOMAIN: 'updates.usd-impact.com',
    USDIMPACT_WATCHDOG_RESEND_WEBHOOK_ENDPOINT: 'https://www.usd-impact.com/api/resend-webhook',
  },
  fetchImpl: async (url) => {
    if (String(url).endsWith('/domains')) {
      return reply(JSON.stringify({ data: [{ name: 'updates.usd-impact.com', status: 'verified' }] }), 200, String(url));
    }
    return reply(JSON.stringify({ data: [{
      status: 'disabled',
      endpoint: 'https://www.usd-impact.com/api/resend-webhook',
      events: ['email.delivered', 'email.bounced', 'email.complained', 'email.suppressed'],
    }] }), 200, String(url));
  },
});
assert.equal(disabledOnly[0].outcome, OUTCOME.WARN);
assert.equal(disabledOnly[0].evidence[0].matching_enabled_webhook_count, 0);

console.log('USD Impact Resend watchdog regression tests passed.');
