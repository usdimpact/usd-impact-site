import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import handler from '../api/commerce.js';

const managedKeys = [
  'COMMERCE_MODE',
  'COMMERCE_PROVIDER',
  'VERCEL_ENV',
  'LEMON_SQUEEZY_TEST_MODE',
  'LEMON_SQUEEZY_TEST_API_KEY',
  'LEMON_SQUEEZY_TEST_WEBHOOK_SECRET',
  'LEMON_SQUEEZY_TEST_STORE_ID',
  'LEMON_SQUEEZY_TEST_PRODUCT_ID',
  'LEMON_SQUEEZY_TEST_LAUNCH_VARIANT_ID',
  'LEMON_SQUEEZY_TEST_STANDARD_VARIANT_ID',
  'LEMON_SQUEEZY_TEST_REDIRECT_URL',
  'LEMON_SQUEEZY_LIVE_API_KEY',
  'LEMON_SQUEEZY_LIVE_WEBHOOK_SECRET',
  'LEMON_SQUEEZY_LIVE_STORE_ID',
  'LEMON_SQUEEZY_LIVE_PRODUCT_ID',
  'LEMON_SQUEEZY_LIVE_LAUNCH_VARIANT_ID',
  'LEMON_SQUEEZY_LIVE_STANDARD_VARIANT_ID',
  'LEMON_SQUEEZY_LIVE_REDIRECT_URL',
  'COMMERCE_SANDBOX_QA_EMAIL',
  'COMMERCE_CONTROLLED_LIVE_QA_EMAIL',
  'COMMERCE_SANDBOX_VERIFIED',
  'COMMERCE_CONTROLLED_LIVE_VERIFIED',
  'COMMERCE_LIVE_APPROVED',
  'COMMERCE_TRADER_ADDRESS_PUBLIC',
  'COMMERCE_TAX_STATUS_PUBLIC',
  'COMMERCE_MERCHANT_OF_RECORD_NAME',
  'COMMERCE_MERCHANT_OF_RECORD_TERMS_URL',
  'COMMERCE_MERCHANT_OF_RECORD_PRIVACY_URL',
  'COMMERCE_TAX_CHECKOUT_PUBLIC',
  'COMMERCE_REFUND_SUPPORT_PUBLIC',
  'COMMERCE_SELLER_DISCLOSURE_APPROVED',
  'COMMERCE_RECONCILIATION_ENABLED',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
];
const original = Object.fromEntries(managedKeys.map((key) => [key, process.env[key]]));

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = String(value); },
    end(value = '') { this.body = String(value); },
  };
}

try {
  for (const key of managedKeys) delete process.env[key];

  Object.assign(process.env, {
    COMMERCE_MODE: 'sandbox',
    COMMERCE_PROVIDER: 'lemon-squeezy',
    VERCEL_ENV: 'preview',
    LEMON_SQUEEZY_TEST_MODE: 'true',
    SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
    SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
    COMMERCE_SANDBOX_QA_EMAIL: 'qa@example.com',
    LEMON_SQUEEZY_TEST_API_KEY: 'test_api_key_abcdefghijklmnopqrstuvwxyz',
    LEMON_SQUEEZY_TEST_WEBHOOK_SECRET: 'test_webhook_secret_abcdefghijklmnopqrstuvwxyz',
    LEMON_SQUEEZY_TEST_STORE_ID: '42',
    LEMON_SQUEEZY_TEST_PRODUCT_ID: '99',
    LEMON_SQUEEZY_TEST_LAUNCH_VARIANT_ID: '313',
    LEMON_SQUEEZY_TEST_STANDARD_VARIANT_ID: '314',
    LEMON_SQUEEZY_TEST_REDIRECT_URL: 'https://www.usd-impact.com/account/',
    COMMERCE_RECONCILIATION_ENABLED: 'false',
  });

  // Deliberately format the JSON so JSON.parse + JSON.stringify would change
  // the signed bytes. Vercel exposes a lazy parsed request.body helper for
  // application/json, but Lemon Squeezy requires HMAC verification over the
  // exact raw request body.
  const rawBody = '{\n  "meta": { "event_name": "order_created" },\n  "data": { "id": "7001" }\n}\n';
  const signature = crypto
    .createHmac('sha256', process.env.LEMON_SQUEEZY_TEST_WEBHOOK_SECRET)
    .update(Buffer.from(rawBody, 'utf8'))
    .digest('hex');

  let parsedBodyAccesses = 0;
  const parsedBody = JSON.parse(rawBody);
  const request = {
    method: 'POST',
    url: '/api/commerce?action=webhook',
    headers: {
      'content-type': 'application/json',
      'x-signature': signature,
    },
    get body() {
      parsedBodyAccesses += 1;
      return parsedBody;
    },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(rawBody, 'utf8');
    },
  };

  const response = responseRecorder();
  await handler(request, response);
  const payload = JSON.parse(response.body);

  assert.equal(parsedBodyAccesses, 0, 'webhook path must not access Vercel parsed request.body');
  assert.equal(response.statusCode, 400);
  assert.equal(payload.code, 'COMMERCE_IDENTIFIER_INVALID');
  assert.notEqual(payload.code, 'INVALID_COMMERCE_WEBHOOK_SIGNATURE');

  console.log('Lemon Squeezy Vercel raw-body webhook regression passed.');
} finally {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

await import('./test-lemon-squeezy-research-membership-adapter.mjs');
await import('./test-research-membership-webhook-execution.mjs');
