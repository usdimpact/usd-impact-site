// Draft B-1 Research webhook receipt tests, entirely synthetic.
// No real database, provider, customer or mail network access.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  processResearchMembershipWebhookWithFirstPurchase,
} from '../src/lib/research-membership-first-purchase.js';
import {
  inspectSignedResearchWebhookReceiptEnvelope,
} from '../src/lib/research-membership-webhook-handler.js';
import {
  researchReceiptEvidenceEnabled,
} from '../src/lib/research-membership-receipt-evidence.js';

const accountId = '123e4567-e89b-42d3-a456-426614174000';
const receiptId = '223e4567-e89b-42d3-a456-426614174000';
const env = {
  VERCEL_ENV: 'preview',
  RESEARCH_WEBHOOK_RECEIPTS_ENABLED: 'true',
  RESEARCH_MEMBERSHIP_WEBHOOK_ENABLED: 'true',
  LEMON_SQUEEZY_RESEARCH_TEST_MODE: 'true',
  LEMON_SQUEEZY_RESEARCH_TEST_WEBHOOK_SECRET: 'research_test_webhook_secret_abcdefghijklmnopqrstuvwxyz',
  LEMON_SQUEEZY_RESEARCH_TEST_STORE_ID: '42',
  LEMON_SQUEEZY_RESEARCH_TEST_PRODUCT_ID: '99',
  LEMON_SQUEEZY_RESEARCH_TEST_MONTHLY_VARIANT_ID: '314',
  LEMON_SQUEEZY_RESEARCH_TEST_ANNUAL_VARIANT_ID: '315',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
};
const prod = {
  VERCEL_ENV: 'production',
  RESEARCH_WEBHOOK_RECEIPTS_ENABLED: 'true',
  RESEARCH_MEMBERSHIP_WEBHOOK_ENABLED: 'true',
  RESEARCH_MEMBERSHIP_PRODUCTION_ACTIVATION_APPROVED: 'true',
  LEMON_SQUEEZY_RESEARCH_PRODUCTION_TEST_MODE: 'false',
  LEMON_SQUEEZY_RESEARCH_PRODUCTION_WEBHOOK_SECRET: 'research_prod_webhook_secret_abcdefghijklmnopqrstuvwxyz',
  LEMON_SQUEEZY_RESEARCH_PRODUCTION_STORE_ID: '142',
  LEMON_SQUEEZY_RESEARCH_PRODUCTION_PRODUCT_ID: '199',
  LEMON_SQUEEZY_RESEARCH_PRODUCTION_MONTHLY_VARIANT_ID: '1314',
  LEMON_SQUEEZY_RESEARCH_PRODUCTION_ANNUAL_VARIANT_ID: '1315',
  SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
};
function event(environment = env, metaChanges = {}, attrChanges = {}) {
  return {
    meta: {
      event_name: 'subscription_created',
      webhook_id: 'delivery_a',
      custom_data: {
        usd_impact_account_id: accountId,
        usd_impact_research_product_id: 'research-membership',
        usd_impact_research_billing_interval: 'monthly',
        usd_impact_research_checkout_key: 'research-checkout-1234',
      },
      ...metaChanges,
    },
    data: {
      type: 'subscriptions',
      id: 'sub_first_1',
      attributes: {
        store_id: environment === prod ? 142 : 42,
        customer_id: 456,
        product_id: environment === prod ? 199 : 99,
        variant_id: environment === prod ? 1314 : 314,
        test_mode: environment === env,
        status: 'active', cancelled: false,
        trial_ends_at: null,
        created_at: '2026-09-07T15:45:00.000Z',
        renews_at: '2026-10-07T15:45:00.000Z',
        ...attrChanges,
      },
    },
  };
}
function sign(body, environment = env) {
  const rawBody = Buffer.from(JSON.stringify(body));
  const secret = environment === prod
    ? environment.LEMON_SQUEEZY_RESEARCH_PRODUCTION_WEBHOOK_SECRET
    : environment.LEMON_SQUEEZY_RESEARCH_TEST_WEBHOOK_SECRET;
  const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
  return { rawBody, signature };
}
const respond = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status, headers: { 'content-type': 'application/json' },
});
assert.equal(researchReceiptEvidenceEnabled({}), false, 'missing flag defaults OFF');
assert.equal(researchReceiptEvidenceEnabled({ RESEARCH_WEBHOOK_RECEIPTS_ENABLED: 'TRUE' }), false);
assert.equal(researchReceiptEvidenceEnabled(env), true);

for (const environment of [env, prod]) {
  const first = sign(event(environment), environment);
  const delivery = sign(event(environment, { webhook_id: 'delivery_b' }), environment);
  const semanticChange = sign(event(environment, {}, { renews_at: '2026-10-08T15:45:00.000Z' }), environment);
  const identity = inspectSignedResearchWebhookReceiptEnvelope({ ...first, environment });
  const metadataOnly = inspectSignedResearchWebhookReceiptEnvelope({ ...delivery, environment });
  const changed = inspectSignedResearchWebhookReceiptEnvelope({ ...semanticChange, environment });
  assert.equal(identity.providerEventId, metadataOnly.providerEventId, 'same semantic event ID');
  assert.equal(identity.semanticSha256, metadataOnly.semanticSha256, 'delivery-only ID excluded');
  assert.notEqual(identity.semanticSha256, changed.semanticSha256, 'change in paid period protected');
  assert.match(identity.semanticSha256, /^[a-f0-9]{64}$/);
  assert.equal(identity.providerSubscriptionId, 'sub_first_1');

  let calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
    assert.ok(url.startsWith(environment.SUPABASE_URL + '/rest/v1/rpc/'));
    assert.equal(init.headers.apikey, environment.SUPABASE_SECRET_KEY);
    assert.equal(init.headers.Authorization, undefined, 'secret key must not masquerade as JWT');
    if (url.endsWith('/begin_commerce_webhook_receipt')) {
      assert.equal(calls.at(-1).body.p_provider, 'lemon-squeezy-research');
      assert.equal(calls.at(-1).body.p_provider_event_id, identity.providerEventId);
      assert.equal(calls.at(-1).body.p_payload_sha256, identity.semanticSha256);
      return respond({ receipt_id: receiptId, status: 'received', should_process: true, attempt_count: 1 });
    }
    if (url.endsWith('/finish_commerce_webhook_receipt')) {
      assert.equal(calls.at(-1).body.p_status, 'processed');
      assert.equal(calls.at(-1).body.p_last_error, null);
      return respond({ receipt_id: receiptId, status: 'processed', attempt_count: 1 });
    }
    throw new Error('Unexpected test request ' + url);
  };
  const result = await processResearchMembershipWebhookWithFirstPurchase({
    ...first, environment, fetchImpl,
    processImpl: async () => ({ action: 'applied', eventKey: 'mock' }),
  });
  assert.equal(result.action, 'applied');
  assert.equal(calls.length, 2, 'begin then finish in separate committed RPCs');
  calls = [];
  const duplicate = await processResearchMembershipWebhookWithFirstPurchase({
    ...delivery, environment,
    fetchImpl: async (url) => {
      calls.push(url);
      assert.ok(url.endsWith('/begin_commerce_webhook_receipt'));
      return respond({ receipt_id: receiptId, status: 'processed', should_process: false, attempt_count: 1 });
    },
    processImpl: async () => { throw new Error('duplicate must not re-run business mutation'); },
  });
  assert.equal(duplicate.action, 'duplicate');
  assert.equal(calls.length, 1, 'already processed event never finishes again');

  let unauthorizedFetches = 0;
  await assert.rejects(
    () => processResearchMembershipWebhookWithFirstPurchase({
      ...first, signature: '0'.repeat(64), environment,
      fetchImpl: async () => { unauthorizedFetches++; throw new Error('no fetch on bad signature'); },
    }),
    (error) => /SIGNATURE_INVALID/.test(error.code),
  );
  assert.equal(unauthorizedFetches, 0);
  await assert.rejects(
    () => processResearchMembershipWebhookWithFirstPurchase({
      ...sign(event(environment, {}, { product_id: 999 }), environment),
      environment,
      fetchImpl: async () => { unauthorizedFetches++; throw new Error('no fetch on bad store/product'); },
    }),
    { code: 'RESEARCH_WEBHOOK_RECEIPT_CATALOG_INVALID' },
  );
  assert.equal(unauthorizedFetches, 0);
}

// Signed duplicate paid subscription: first processing reports not found;
// the trusted bind RPC raises the existing exact SQL conflict; receipt remains
// FAILED and categorised, not falsely processed. No customer PII persisted.
let processCount = 0;
let receiptStates = [];
const signed = sign(event());
const conflictResult = () => processResearchMembershipWebhookWithFirstPurchase({
  ...signed,
  environment: env,
  processImpl: async () => {
    processCount++;
    const error = new Error('missing');
    error.code = 'RESEARCH_WEBHOOK_SUBSCRIPTION_NOT_FOUND';
    error.status = 409;
    throw error;
  },
  fetchImpl: async (url, init = {}) => {
    const body = JSON.parse(init.body);
    if (url.endsWith('/begin_commerce_webhook_receipt')) {
      return respond({ receipt_id: receiptId, status: 'received', should_process: true, attempt_count: 1 });
    }
    if (url.endsWith('/bind_research_membership_subscription')) {
      assert.equal(body.p_account_id, accountId);
      assert.equal(body.p_provider_subscription_id, 'sub_first_1');
      return respond({ code: 'P0001', message: 'Research Membership account already has a current subscription' }, 409);
    }
    if (url.endsWith('/finish_commerce_webhook_receipt')) {
      receiptStates.push(body);
      return respond({ receipt_id: receiptId, status: body.p_status, attempt_count: 1 });
    }
    throw new Error('Unexpected conflict test request');
  },
});
await assert.rejects(conflictResult, { code: 'RESEARCH_DUPLICATE_PAID_SUBSCRIPTION', status: 409 });
assert.equal(processCount, 1);
assert.deepEqual(receiptStates.map(x => [x.p_status, x.p_last_error]), [
  ['failed', 'RESEARCH_DUPLICATE_PAID_SUBSCRIPTION'],
]);
assert.ok(!JSON.stringify(receiptStates).includes(accountId));

receiptStates = [];
await assert.rejects(
  () => processResearchMembershipWebhookWithFirstPurchase({
    ...signed, environment: env,
    processImpl: async () => {
      throw Object.assign(new Error('Research Membership entitlement subscription mismatch'), {
        code: 'P0001', status: 409,
      });
    },
    fetchImpl: async (url, init = {}) => {
      if (url.endsWith('/begin_commerce_webhook_receipt')) {
        return respond({ receipt_id: receiptId, status: 'received', should_process: true });
      }
      assert.ok(url.endsWith('/finish_commerce_webhook_receipt'));
      const body = JSON.parse(init.body);
      receiptStates.push(body.p_last_error);
      return respond({ receipt_id: receiptId, status: body.p_status });
    },
  }),
  { code: 'RESEARCH_ENTITLEMENT_CONFLICT', status: 409 },
);
assert.deepEqual(receiptStates, ['RESEARCH_ENTITLEMENT_CONFLICT']);

let mutated = false;
await assert.rejects(
  () => processResearchMembershipWebhookWithFirstPurchase({
    ...signed, environment: env,
    processImpl: async () => { mutated = true; return { action: 'applied' }; },
    fetchImpl: async () => respond({ message: 'DB temporarily unavailable' }, 503),
  }),
  { code: 'RESEARCH_WEBHOOK_RECEIPT_RPC_FAILED', status: 503 },
);
assert.equal(mutated, false, 'failed begin must prevent processing');

await assert.rejects(
  () => processResearchMembershipWebhookWithFirstPurchase({
    ...signed, environment: env,
    processImpl: async () => ({ action: 'applied' }),
    fetchImpl: async (url) => {
      if (url.endsWith('/begin_commerce_webhook_receipt')) {
        return respond({ receipt_id: receiptId, status: 'received', should_process: true });
      }
      return respond({ message: 'failed to finish receipt' }, 503);
    },
  }),
  { code: 'RESEARCH_WEBHOOK_RECEIPT_RPC_FAILED', status: 503 },
);

console.log('Research receipt B-1 opt-in signed evidence, conflict and fail-closed synthetic tests passed.');
