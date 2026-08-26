import assert from 'node:assert/strict';
import handler, { config } from '../api/commerce.js';

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
  'COMMERCE_SANDBOX_QA_EMAIL',
  'COMMERCE_RECONCILIATION_ENABLED',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'CRON_SECRET',
];
const original = Object.fromEntries(managedKeys.map((key) => [key, process.env[key]]));

function request({ method = 'GET', action = '', headers = {}, body = '' } = {}) {
  return {
    method,
    url: `/api/commerce?action=${encodeURIComponent(action)}`,
    headers,
    body,
  };
}

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = String(value); },
    end(value = '') { this.body = String(value); },
  };
}

async function invoke(req) {
  const response = responseRecorder();
  await handler(req, response);
  return {
    status: response.statusCode,
    headers: response.headers,
    json: response.body ? JSON.parse(response.body) : null,
  };
}

try {
  for (const key of managedKeys) delete process.env[key];

  assert.equal(config.api.bodyParser, false);

  const missing = await invoke(request({ action: 'missing' }));
  assert.equal(missing.status, 404);
  assert.equal(missing.json.code, 'COMMERCE_ACTION_NOT_FOUND');
  assert.equal(missing.headers['cache-control'], 'no-store');
  assert.equal(missing.headers['x-robots-tag'], 'noindex, nofollow');

  const disabledCheckout = await invoke(request({
    method: 'POST',
    action: 'checkout',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
    body: JSON.stringify({ idempotencyKey: 'qa-request-12345678' }),
  }));
  assert.equal(disabledCheckout.status, 503);
  assert.equal(disabledCheckout.json.code, 'COMMERCE_SANDBOX_DISABLED');

  const crossSite = await invoke(request({
    method: 'POST',
    action: 'checkout',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' },
    body: '{}',
  }));
  assert.equal(crossSite.status, 403);
  assert.equal(crossSite.json.code, 'CROSS_SITE_REQUEST');

  const disabledWebhook = await invoke(request({ method: 'POST', action: 'webhook', body: '{}' }));
  assert.equal(disabledWebhook.status, 503);
  assert.equal(disabledWebhook.json.code, 'COMMERCE_SANDBOX_DISABLED');

  const unauthorizedReconcile = await invoke(request({ method: 'GET', action: 'reconcile' }));
  assert.equal(unauthorizedReconcile.status, 401);
  assert.equal(unauthorizedReconcile.json.code, 'CRON_AUTHORIZATION_REQUIRED');

  process.env.COMMERCE_MODE = 'sandbox';
  process.env.COMMERCE_PROVIDER = 'lemon-squeezy';
  process.env.VERCEL_ENV = 'production';
  process.env.LEMON_SQUEEZY_TEST_MODE = 'true';
  const productionBlocked = await invoke(request({ method: 'POST', action: 'webhook', body: '{}' }));
  assert.equal(productionBlocked.status, 503);
  assert.equal(productionBlocked.json.code, 'COMMERCE_SANDBOX_PRODUCTION_FORBIDDEN');
  assert.doesNotMatch(JSON.stringify(productionBlocked.json), /api.key|webhook.secret|supabase/i);

  console.log('Lemon Squeezy commerce function fail-closed tests passed.');
} finally {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
