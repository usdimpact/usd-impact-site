// Synthetic only: no account, provider or Production requests.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  processLemonSqueezyWebhook,
  readLemonSqueezyCommerceRuntimeConfig,
} from '../src/lib/lemon-squeezy-commerce-runtime.js';

const account = '123e4567-e89b-42d3-a456-426614174000';
const intentId = '223e4567-e89b-42d3-a456-426614174000';
const purchaseId = '423e4567-e89b-42d3-a456-426614174000';
const entitlementId = '523e4567-e89b-42d3-a456-426614174000';
const receiptId = '623e4567-e89b-42d3-a456-426614174000';
const env = {
  COMMERCE_MODE: 'sandbox', COMMERCE_PROVIDER: 'lemon-squeezy',
  VERCEL_ENV: 'preview', LEMON_SQUEEZY_TEST_MODE: 'true',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
  COMMERCE_SANDBOX_QA_EMAIL: 'qa@example.com',
  LEMON_SQUEEZY_TEST_API_KEY: 'test_api_key_abcdefghijklmnopqrstuvwxyz',
  LEMON_SQUEEZY_TEST_WEBHOOK_SECRET: 'test_webhook_secret_abcdefghijklmnopqrstuvwxyz',
  LEMON_SQUEEZY_TEST_STORE_ID: '42', LEMON_SQUEEZY_TEST_PRODUCT_ID: '99',
  LEMON_SQUEEZY_TEST_LAUNCH_VARIANT_ID: '313',
  LEMON_SQUEEZY_TEST_STANDARD_VARIANT_ID: '314',
  LEMON_SQUEEZY_TEST_REDIRECT_URL: 'https://www.usd-impact.com/account/',
  COMMERCE_RECONCILIATION_ENABLED: 'false',
};
const config = readLemonSqueezyCommerceRuntimeConfig(env);
const order = {
  type: 'orders', id: '7001',
  attributes: {
    store_id: 42, identifier: '104e18a2-d755-4d4b-80c4-a6c1dcbe1c10',
    currency: 'USD', subtotal: 4900, discount_total: 0, tax: 1000,
    total: 5900, refunded_amount: 0, status: 'paid', test_mode: true,
    updated_at: '2026-08-26T12:00:01.000Z', customer_id: 'buyer7001',
    first_order_item: { product_id: 99, variant_id: 314, price: 5900, quantity: 1 },
  },
};
const item = {
  type: 'order-items', id: '9001',
  attributes: { order_id: 7001, product_id: 99, variant_id: 314, price: 5900, quantity: 1 },
};
const payload = {
  meta: { event_name: 'order_created', custom_data: {
    usd_impact_account_id: account, usd_impact_purchase_intent_id: intentId,
  } },
  data: order,
};
const rawBody = Buffer.from(JSON.stringify(payload));
const signature = crypto.createHmac('sha256', config.webhookSecret).update(rawBody).digest('hex');
const respond = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json' },
});
const controlled = [
  'VERCEL_ENV', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY',
  'EMAIL_READINESS_LEDGER_ENABLED', 'EMAIL_READINESS_PRODUCTION_APPROVED',
  'LAUNCH_EMAIL_DISPATCH_ENABLED', 'LAUNCH_EMAIL_PRODUCTION_APPROVED',
  'RESEND_API_KEY',
];
const original = Object.fromEntries(controlled.map((name) => [name, process.env[name]]));
const originalLog = console.error;

async function scenario({ name, ledger, email, mismatch = false, profileFailure = false, ledgerFailure = false, badOrder = false }) {
  Object.assign(process.env, {
    VERCEL_ENV: env.VERCEL_ENV,
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY,
    EMAIL_READINESS_LEDGER_ENABLED: ledger ? 'true' : 'false',
    LAUNCH_EMAIL_DISPATCH_ENABLED: 'false',
    EMAIL_READINESS_PRODUCTION_APPROVED: 'false',
    LAUNCH_EMAIL_PRODUCTION_APPROVED: 'false',
  });
  delete process.env.RESEND_API_KEY;
  const calls = { complete: 0, profile: 0, entitlement: 0, outbox: 0, receipt: [] };
  const errorCodes = [];
  let processed = false;
  console.error = (...args) => errorCodes.push(JSON.stringify(args));
  const fetchImpl = async (url, options = {}) => {
    if (url.includes('/rest/v1/purchase_intents?')) {
      return respond([{ id: intentId, account_id: account,
        product_id: 'read-the-dollar-first-guided-interactive-edition',
        status: 'checkout_created', price_tier: 'standard', amount_cents: 4900,
        currency: 'USD', offer_terms: {}, provider_checkout_id: 'checkout7001',
        expires_at: '2026-08-27T12:00:00.000Z' }]);
    }
    if (url.includes('/rest/v1/rpc/begin_commerce_webhook_receipt')) {
      return respond({ receipt_id: receiptId, should_process: !processed, status: processed ? 'processed' : 'processing' });
    }
    if (url.endsWith('/rest/v1/rpc/complete_commerce_purchase')) {
      calls.complete += 1;
      return respond({ purchase_id: purchaseId, entitlement_id: entitlementId });
    }
    if (url.endsWith('/rest/v1/rpc/finish_commerce_webhook_receipt')) {
      const status = JSON.parse(options.body).p_status;
      calls.receipt.push(status);
      if (status === 'processed') processed = true;
      return respond({ receipt_id: receiptId, status });
    }
    if (url.startsWith('https://api.lemonsqueezy.com/v1/orders/7001')) {
      return respond({ data: order });
    }
    if (url.startsWith('https://api.lemonsqueezy.com/v1/order-items?')) {
      return respond({ data: [badOrder ? {
        ...item, attributes: { ...item.attributes, variant_id: 999 },
      } : item] });
    }
    if (url.includes('/rest/v1/profiles?')) {
      calls.profile += 1;
      return profileFailure ? respond({ error: 'temporary provider outage' }, 503)
        : respond([{ account_id: account, email, status: 'active' }]);
    }
    if (url.includes('/rest/v1/entitlements?')) {
      calls.entitlement += 1;
      return respond([{
        id: entitlementId, account_id: mismatch ? '723e4567-e89b-42d3-a456-426614174000' : account,
        purchase_id: purchaseId, product_id: 'read-the-dollar-first-guided-interactive-edition',
        state: 'active', version: 1,
      }]);
    }
    if (url.includes('/rest/v1/notification_outbox')) {
      calls.outbox += 1;
      return ledgerFailure ? respond({ error: 'temporary outbox outage' }, 503) : respond([], 200);
    }
    throw new Error('Unexpected synthetic fetch route: ' + url);
  };
  try {
    if (badOrder) {
      await assert.rejects(() => processLemonSqueezyWebhook({
        config, rawBody, signature, fetchImpl, now: new Date('2026-08-26T12:00:00Z'),
      }), /Variant mismatch|Variant/i, name);
      assert.deepEqual(calls.receipt, ['failed'], name + ': real commerce failure must remain visible');
      assert.equal(calls.complete, 0);
    } else if (profileFailure || ledgerFailure) {
      // Before durable outbox creation, a transient outage MUST return a
      // retryable 503 even though the paid purchase RPC already succeeded.
      await assert.rejects(() => processLemonSqueezyWebhook({
        config, rawBody, signature, fetchImpl, now: new Date('2026-08-26T12:00:05Z'),
      }), (error) => error?.code === 'PURCHASE_ACCESS_READY_INTENT_RETRY_REQUIRED'
        && error.status === 503, name);
      assert.deepEqual(calls.receipt, ['failed'], name + ': signed-provider retry stays possible');
      assert.equal(calls.complete, 1, name + ': trusted purchase completes first');
      assert.equal(processed, false, name + ': no false processed receipt');
      assert.equal(errorCodes.length, 1, name + ': one sanitized retry log');
      assert.doesNotMatch(errorCodes[0], /qa@example\\.com|buyer7001|sb_secret_/);
    } else {
      const first = await processLemonSqueezyWebhook({
        config, rawBody, signature, fetchImpl, now: new Date('2026-08-26T12:00:00Z'),
      });
      assert.equal(first.duplicate, false, name);
      assert.deepEqual(calls.receipt, ['processed'], name + ': notification may not fail a paid receipt');
      assert.equal(calls.complete, 1, name + ': one committed purchase');
      const duplicate = await processLemonSqueezyWebhook({
        config, rawBody, signature, fetchImpl, now: new Date('2026-08-26T12:00:00Z'),
      });
      assert.equal(duplicate.duplicate, true, name);
      assert.equal(calls.complete, 1, name + ': duplicate delivery cannot replay purchase');
      assert.deepEqual(calls.receipt, ['processed'], name + ': duplicate receipt not finalized twice');
      if (!ledger) {
        assert.equal(calls.profile, 0, name + ': disabled email must not read profile');
        assert.equal(calls.entitlement, 0, name + ': disabled email must not read entitlement');
        assert.equal(calls.outbox, 0, name + ': disabled email must not write outbox');
        assert.equal(errorCodes.length, 0, name + ': disabled email should be inert');
      } else {
        assert.equal(calls.profile, 1, name + ': one notification lookup');
        assert.equal(errorCodes.length, 1, name + ': failure is sanitized and isolated');
        assert.doesNotMatch(errorCodes[0], /qa@example\.com|not-an-email|buyer7001|sb_secret_/);
      }
    }
    return { name, ...calls, errorCodes };
  } finally {
    console.error = originalLog;
  }
}

try {
  const results = [];
  results.push(await scenario({ name: 'E6b invalid recipient, all email flags off',
    ledger: false, email: 'not-an-email' }));
  results.push(await scenario({ name: 'E10b mismatched notification account, flags off',
    ledger: false, email: 'qa@example.com', mismatch: true }));
  results.push(await scenario({ name: 'E6 invalid recipient, ledger on',
    ledger: true, email: 'not-an-email' }));
  results.push(await scenario({ name: 'E10 notification account mismatch, ledger on',
    ledger: true, email: 'qa@example.com', mismatch: true }));
  results.push(await scenario({ name: 'E12 notification profile lookup outage, ledger on',
    ledger: true, email: 'qa@example.com', profileFailure: true }));
  results.push(await scenario({ name: 'E12 notification outbox outage, ledger on',
    ledger: true, email: 'qa@example.com', ledgerFailure: true }));
  results.push(await scenario({ name: 'real invalid order remains failed',
    ledger: false, email: 'qa@example.com', badOrder: true }));
  for (const row of results) {
    console.log(row.name + ': receipt=' + row.receipt.join(',') +
      ' completed=' + row.complete + ' outbox=' + row.outbox);
  }
  console.log('Purchase access-ready webhook synthetic acknowledgement and retry tests PASS (7 scenarios).');
} finally {
  console.error = originalLog;
  for (const [name, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
