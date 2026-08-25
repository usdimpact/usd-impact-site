import assert from 'node:assert/strict';
import handler from '../api/account.js';

const managedKeys = [
  'COMMERCE_MODE',
  'COMMERCE_PROVIDER',
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
  'VERCEL_ENV',
  'PADDLE_API_KEY',
  'PADDLE_WEBHOOK_SECRET',
];
const originalEnvironment = Object.fromEntries(managedKeys.map((key) => [key, process.env[key]]));

function request({ method = 'GET', url = '/api/account?action=commerce-readiness' } = {}) {
  return { method, url, headers: {} };
}

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    },
    end(value = '') {
      this.body = String(value);
    },
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

  {
    const result = await invoke(request());
    assert.equal(result.status, 200);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.headers['x-robots-tag'], 'noindex, nofollow');
    assert.equal(result.json.ok, true);
    assert.equal(result.json.commerce.state, 'ready_for_provider_configuration');
    assert.equal(result.json.commerce.checkoutEnabled, false);
    assert.equal(result.json.commerce.provider, null);
    assert.equal(result.json.commerce.disclosuresComplete, false);
    assert.equal(result.json.commerce.sellerDisclosure, null);
    assert.match(result.json.commerce.message, /Public checkout remains disabled/i);
  }

  {
    process.env.PADDLE_API_KEY = 'legacy-key-that-must-not-leak';
    process.env.PADDLE_WEBHOOK_SECRET = 'legacy-secret-that-must-not-leak';
    const result = await invoke(request());
    assert.equal(result.status, 200);
    assert.equal(result.json.commerce.state, 'ready_for_provider_configuration');
    assert.equal('legacyProviderConfigurationIgnored' in result.json.commerce, false);
    assert.equal('liveApproved' in result.json.commerce, false);
    assert.doesNotMatch(JSON.stringify(result.json), /legacy-key|legacy-secret|paddle/i);
    delete process.env.PADDLE_API_KEY;
    delete process.env.PADDLE_WEBHOOK_SECRET;
  }

  {
    process.env.COMMERCE_MODE = 'live';
    process.env.COMMERCE_PROVIDER = 'replacement-provider';
    process.env.COMMERCE_SANDBOX_VERIFIED = 'true';
    process.env.COMMERCE_CONTROLLED_LIVE_VERIFIED = 'true';
    process.env.COMMERCE_LIVE_APPROVED = 'true';
    process.env.VERCEL_ENV = 'production';
    const result = await invoke(request());
    assert.equal(result.status, 200);
    assert.equal(result.json.commerce.state, 'blocked');
    assert.equal(result.json.commerce.checkoutEnabled, false);
    assert.equal(result.json.commerce.provider, null);
    assert.equal(result.json.commerce.disclosuresComplete, false);
    assert.equal(result.json.commerce.sellerDisclosure, null);
    assert.equal(result.json.commerce.message, 'Commerce configuration is not ready. Public checkout remains disabled.');
    assert.doesNotMatch(JSON.stringify(result.json), /registered application adapter|COMMERCE_TRADER_ADDRESS_PUBLIC/i);
    delete process.env.COMMERCE_MODE;
    delete process.env.COMMERCE_PROVIDER;
    delete process.env.COMMERCE_SANDBOX_VERIFIED;
    delete process.env.COMMERCE_CONTROLLED_LIVE_VERIFIED;
    delete process.env.COMMERCE_LIVE_APPROVED;
    delete process.env.VERCEL_ENV;
  }

  {
    process.env.COMMERCE_LIVE_APPROVED = 'yes';
    const result = await invoke(request());
    assert.equal(result.status, 503);
    assert.equal(result.json.ok, false);
    assert.equal(result.json.commerce.state, 'blocked');
    assert.equal(result.json.commerce.checkoutEnabled, false);
    assert.equal(result.json.commerce.disclosuresComplete, false);
    assert.equal(result.json.commerce.sellerDisclosure, null);
    assert.doesNotMatch(JSON.stringify(result.json), /true\/false|COMMERCE_LIVE_APPROVED/i);
    delete process.env.COMMERCE_LIVE_APPROVED;
  }

  {
    const result = await invoke(request({ method: 'POST' }));
    assert.equal(result.status, 405);
    assert.equal(result.headers.allow, 'GET');
  }

  {
    const result = await invoke(request({ url: '/api/account?action=commerce-checkout' }));
    assert.equal(result.status, 404);
    assert.equal(result.json.code, 'ACCOUNT_ACTION_NOT_FOUND');
  }

  console.log('Commerce readiness function tests passed.');
} finally {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
