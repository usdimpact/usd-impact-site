// Exact-head synthetic boundary tests only. Every HTTP request is intercepted.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { processLemonSqueezyWebhook, readLemonSqueezyCommerceRuntimeConfig } from '../src/lib/lemon-squeezy-commerce-runtime.js';

const account = '123e4567-e89b-42d3-a456-426614174000';
const intent = '223e4567-e89b-42d3-a456-426614174000';
const purchase = '423e4567-e89b-42d3-a456-426614174000';
const entitlement = '523e4567-e89b-42d3-a456-426614174000';
const receipt = '623e4567-e89b-42d3-a456-426614174000';
const now = new Date('2026-08-26T12:00:05.000Z');
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
const order = { type: 'orders', id: '7001', attributes: {
  store_id: 42, identifier: '104e18a2-d755-4d4b-80c4-a6c1dcbe1c10',
  currency: 'USD', subtotal: 4900, discount_total: 0, tax: 1000, total: 5900,
  refunded_amount: 0, status: 'paid', test_mode: true,
  updated_at: '2026-08-26T12:00:01.000Z',
  first_order_item: { product_id: 99, variant_id: 314, price: 5900, quantity: 1 },
}};
const item = { type: 'order-items', id: '9001', attributes: {
  order_id: 7001, product_id: 99, variant_id: 314, price: 5900, quantity: 1,
}};
const payload = { meta: { event_name: 'order_created', custom_data: {
  usd_impact_account_id: account, usd_impact_purchase_intent_id: intent,
}}, data: order };
const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
const signature = createHmac('sha256', config.webhookSecret).update(rawBody).digest('hex');
const respond = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json' },
});
const managed = [
  'VERCEL_ENV','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY',
  'EMAIL_READINESS_LEDGER_ENABLED','EMAIL_READINESS_PRODUCTION_APPROVED',
  'LAUNCH_EMAIL_DISPATCH_ENABLED','LAUNCH_EMAIL_PRODUCTION_APPROVED',
  'RESEND_API_KEY','LAUNCH_EMAIL_FROM_EMAIL',
];
const originals = Object.fromEntries(managed.map(k => [k, process.env[k]]));
const originalError = console.error;
const baseFlags = {
  VERCEL_ENV: 'preview',
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY,
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  EMAIL_READINESS_PRODUCTION_APPROVED: 'false',
  LAUNCH_EMAIL_DISPATCH_ENABLED: 'true',
  LAUNCH_EMAIL_PRODUCTION_APPROVED: 'false',
  RESEND_API_KEY: 're_synthetic_only_123456789012345',
  LAUNCH_EMAIL_FROM_EMAIL: 'USD Impact <support@usd-impact.com>',
};
async function scenario(name, { failure = null, flags = {}, retryAfterRecovery = false, duplicateAfter = false } = {}) {
  Object.assign(process.env, baseFlags, flags);
  if (flags.RESEND_API_KEY === '') delete process.env.RESEND_API_KEY;
  const state = {
    mode: failure,
    receiptStatuses: [], completedPurchaseCount: 0, completeRpcCalls: 0,
    outbox: null, insertCalls: 0, resendCalls: 0,
    signals: [], logs: [], emailIdempotencyKeys: [],
    processed: false,
  };
  console.error = (...args) => state.logs.push(JSON.stringify(args));
  const hanging = (init) => {
    assert.ok(init?.signal instanceof AbortSignal, name + ': notification fetch has an abort signal');
    state.signals.push(init.signal);
    return new Promise(() => {});
  };
  const fetchImpl = async (url, init = {}) => {
    if (url.includes('/rest/v1/purchase_intents?')) return respond([{
      id: intent, account_id: account, product_id: 'read-the-dollar-first-guided-interactive-edition',
      status: 'checkout_created', price_tier: 'standard', amount_cents: 4900,
      currency: 'USD', offer_terms: {}, provider_checkout_id: 'checkout7001',
      expires_at: '2026-08-27T12:00:00.000Z',
    }]);
    if (url.endsWith('/rest/v1/rpc/begin_commerce_webhook_receipt')) {
      return respond({ receipt_id: receipt, should_process: !state.processed,
        status: state.processed ? 'processed' : 'received' });
    }
    if (url.endsWith('/rest/v1/rpc/complete_commerce_purchase')) {
      state.completeRpcCalls += 1;
      if (state.completedPurchaseCount === 0) state.completedPurchaseCount = 1;
      return respond({ purchase_id: purchase, entitlement_id: entitlement });
    }
    if (url.endsWith('/rest/v1/rpc/finish_commerce_webhook_receipt')) {
      const next = JSON.parse(init.body).p_status;
      state.receiptStatuses.push(next);
      if (next === 'processed') state.processed = true;
      return respond({ receipt_id: receipt, status: next });
    }
    if (url.startsWith('https://api.lemonsqueezy.com/v1/orders/7001')) {
      return respond({ data: order });
    }
    if (url.startsWith('https://api.lemonsqueezy.com/v1/order-items?')) {
      return respond({ data: [item] });
    }
    if (url.includes('/rest/v1/profiles?')) {
      if (state.mode === 'lookup_hang') return hanging(init);
      return respond([{ account_id: account,
        email: state.mode === 'invalid_email' ? 'not-an-email' : 'qa@example.com',
        status: 'active' }]);
    }
    if (url.includes('/rest/v1/entitlements?')) {
      return respond([{ id: entitlement,
        account_id: state.mode === 'identity_conflict'
          ? '723e4567-e89b-42d3-a456-426614174000' : account,
        purchase_id: purchase, state: 'active', version: 1,
        product_id: 'read-the-dollar-first-guided-interactive-edition' }]);
    }
    if (url.includes('/rest/v1/notification_outbox')) {
      if (init.method === 'POST') {
        state.insertCalls += 1;
        if (state.mode === 'outbox_hang') return hanging(init);
        if (state.mode === 'outbox_503') return respond({ error: 'synthetic outage' }, 503);
        const body = JSON.parse(init.body);
        if (!state.outbox) state.outbox = {
          ...body, id: '823e4567-e89b-42d3-a456-426614174000',
          status: 'queued', attempt_count: 0,
          created_at: '2026-08-26T12:00:01.000Z',
          updated_at: '2026-08-26T12:00:01.000Z',
        };
        return respond([state.outbox], 201);
      }
      assert.ok(state.outbox, name + ': outbox must preexist before dispatch/reload');
      if (init.method === 'PATCH') {
        state.outbox = { ...state.outbox, ...JSON.parse(init.body) };
      }
      return respond([state.outbox]);
    }
    if (url === 'https://api.resend.com/emails') {
      state.resendCalls += 1;
      state.emailIdempotencyKeys.push(init.headers['Idempotency-Key']);
      if (state.mode === 'resend_hang') return hanging(init);
      return respond({ id: 'em_mock_fixture' });
    }
    throw new Error(name + ': unexpected URL ' + url);
  };
  const run = () => processLemonSqueezyWebhook({ config, rawBody, signature, fetchImpl, now });
  try {
    if (failure === 'lookup_hang' || failure === 'outbox_hang' || failure === 'outbox_503') {
      await assert.rejects(run, (err) => err?.code === 'PURCHASE_ACCESS_READY_INTENT_RETRY_REQUIRED'
        && err.status === 503, name + ': no false acknowledgment before durable intent');
      assert.deepEqual(state.receiptStatuses, ['failed'], name);
      assert.equal(state.completedPurchaseCount, 1);
      assert.equal(state.processed, false);
      if (failure.endsWith('_hang')) {
        assert.ok(state.signals.some(x => x.aborted), name + ': timed-out I/O aborted');
      }
      if (retryAfterRecovery) {
        state.mode = null;
        const retry = await run();
        assert.equal(retry.duplicate, false, name + ': failed receipt retry reprocessed');
        assert.deepEqual(state.receiptStatuses, ['failed','processed']);
        assert.equal(state.completedPurchaseCount, 1, name + ': purchase retained across retry');
        assert.equal(state.completeRpcCalls, 2, name + ': idempotent purchase RPC may be called again');
        assert.equal(state.insertCalls, 2, name + ': retried outbox insert');
        assert.equal(state.resendCalls, 1, name + ': one Resend send after recovery');
        assert.ok(state.outbox && state.outbox.status === 'accepted', name + ': persisted accepted intent');
      }
    } else {
      const result = await run();
      assert.equal(result.duplicate, false, name + ': first purchase delivered');
      assert.deepEqual(state.receiptStatuses, ['processed'], name);
      assert.equal(state.completedPurchaseCount, 1);
      if (failure === 'resend_hang') {
        assert.equal(state.resendCalls, 1);
        assert.equal(state.outbox?.status, 'sending', name + ': ambiguous provider status remains auditable');
        assert.ok(state.signals.some(x => x.aborted), name + ': Resend request aborted');
      }
    }
    if (duplicateAfter) {
      const beforeResend = state.resendCalls;
      const duplicate = await run();
      assert.equal(duplicate.duplicate, true, name + ': acknowledged webhook is replay-idempotent');
      assert.equal(state.resendCalls, beforeResend, name + ': provider not sent twice');
      assert.equal(state.completedPurchaseCount, 1);
    }
    assert.ok(state.logs.every(x => !/qa@example\.com|sb_secret_|re_synthetic_only_|not-an-email/.test(x)),
      name + ': logs must not expose buyer identity or credentials');
    return state;
  } finally {
    console.error = originalError;
  }
}

try {
  await scenario('H1 profile fetch hangs', { failure: 'lookup_hang' });
  await scenario('H2 outbox insert hangs', { failure: 'outbox_hang' });
  await scenario('H3 Resend request hangs', { failure: 'resend_hang', duplicateAfter: true });
  await scenario('C1r outbox outage then provider redelivery', {
    failure: 'outbox_503', retryAfterRecovery: true, duplicateAfter: true,
  });
  const e6 = await scenario('E6 invalid recipient deterministic acknowledgment', { failure: 'invalid_email' });
  assert.equal(e6.insertCalls, 0);
  const e10 = await scenario('E10 identity mismatch deterministic acknowledgment', { failure: 'identity_conflict' });
  assert.equal(e10.insertCalls, 0);
  const production = {
    VERCEL_ENV: 'production',
    SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
  };
  const e9 = await scenario('E9 Production ledger not approved', {
    flags: { ...production, EMAIL_READINESS_PRODUCTION_APPROVED: 'false' },
  });
  assert.equal(e9.insertCalls, 0);
  assert.equal(e9.resendCalls, 0);
  const e9c = await scenario('E9c Production dispatch not approved after enqueue', {
    flags: { ...production, EMAIL_READINESS_PRODUCTION_APPROVED: 'true',
      LAUNCH_EMAIL_PRODUCTION_APPROVED: 'false' },
  });
  assert.equal(e9c.insertCalls, 1);
  assert.equal(e9c.resendCalls, 0);
  const e13 = await scenario('E13 missing Resend key after enqueue', {
    flags: { ...production, EMAIL_READINESS_PRODUCTION_APPROVED: 'true',
      LAUNCH_EMAIL_PRODUCTION_APPROVED: 'true', RESEND_API_KEY: '' },
  });
  assert.equal(e13.insertCalls, 1);
  assert.equal(e13.resendCalls, 0);
  console.log('Purchase webhook H1/H2/H3/H3r/C1r/E6/E10/E9/E9c/E13 synthetic timeout/retry suite PASS.');
} finally {
  console.error = originalError;
  for (const [key, value] of Object.entries(originals)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
