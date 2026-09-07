import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  inspectLemonSqueezyResearchMembershipWebhook,
  normalizeLemonSqueezyResearchMembershipWebhook,
  prepareLemonSqueezyResearchMembershipTransition,
} from '../src/lib/lemon-squeezy-research-membership-adapter.js';

const secret = 'development-signing-secret-123';
const accountId = '11111111-1111-4111-8111-111111111111';
const baseSubscription = {
  accountId,
  productId: 'research-membership',
  provider: 'lemon-squeezy',
  providerSubscriptionId: '98765',
  state: 'active',
  currentPeriodStart: '2026-09-01T00:00:00.000Z',
  currentPeriodEnd: '2026-10-01T00:00:00.000Z',
};

function sign(rawBody) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

function subscriptionPayload(eventName, overrides = {}) {
  return {
    meta: {
      event_name: eventName,
      custom_data: { usd_impact_account_id: accountId },
    },
    data: {
      type: 'subscriptions',
      id: '98765',
      attributes: {
        store_id: 123,
        customer_id: 456,
        product_id: 789,
        variant_id: 1001,
        status: 'active',
        cancelled: false,
        renews_at: '2026-11-01T00:00:00.000Z',
        ends_at: null,
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-10-01T00:00:01.000Z',
        test_mode: true,
        ...overrides,
      },
    },
  };
}

function invoicePayload(eventName, overrides = {}) {
  return {
    meta: {
      event_name: eventName,
      custom_data: { usd_impact_account_id: accountId },
    },
    data: {
      type: 'subscription-invoices',
      id: 'invoice_1',
      attributes: {
        store_id: 123,
        subscription_id: 98765,
        customer_id: 456,
        billing_reason: 'renewal',
        status: 'paid',
        created_at: '2026-10-01T00:00:00.000Z',
        updated_at: '2026-10-01T00:00:01.000Z',
        test_mode: true,
        ...overrides,
      },
    },
  };
}

function signedOptions(payload, existingSubscription = baseSubscription) {
  const rawBody = JSON.stringify(payload);
  return {
    rawBody,
    signature: sign(rawBody),
    secret,
    existingSubscription,
    expectedStoreId: 123,
    expectedProductId: 789,
    expectedVariantIds: [1001, 1002],
    expectedTestMode: true,
  };
}

const renewed = prepareLemonSqueezyResearchMembershipTransition(
  signedOptions(subscriptionPayload('subscription_updated')),
);
assert.equal(renewed.action, 'apply');
assert.equal(renewed.subscriptionPatch.state, 'active');
assert.equal(renewed.subscriptionPatch.currentPeriodStart, '2026-10-01T00:00:00.000Z');
assert.equal(renewed.subscriptionPatch.currentPeriodEnd, '2026-11-01T00:00:00.000Z');
assert.equal(renewed.entitlementPatch.state, 'active');
assert.match(renewed.eventKey, /^lemon-squeezy:/);

const cancelled = prepareLemonSqueezyResearchMembershipTransition(
  signedOptions(subscriptionPayload('subscription_cancelled', {
    status: 'cancelled',
    cancelled: true,
    renews_at: null,
    ends_at: '2026-10-01T00:00:00.000Z',
  })),
);
assert.equal(cancelled.subscriptionPatch.state, 'cancel_scheduled');
assert.equal(cancelled.subscriptionPatch.cancelAtPeriodEnd, true);
assert.equal(cancelled.entitlementPatch.state, 'active');
assert.equal(cancelled.entitlementPatch.endsAt, '2026-10-01T00:00:00.000Z');

const resumed = prepareLemonSqueezyResearchMembershipTransition(
  signedOptions(
    subscriptionPayload('subscription_resumed', {
      status: 'active',
      cancelled: false,
      renews_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-09-15T00:00:00.000Z',
    }),
    { ...baseSubscription, state: 'cancel_scheduled' },
  ),
);
assert.equal(resumed.subscriptionPatch.state, 'active');

const failed = prepareLemonSqueezyResearchMembershipTransition(
  signedOptions(invoicePayload('subscription_payment_failed', { status: 'pending' })),
);
assert.equal(failed.subscriptionPatch.state, 'past_due');
assert.equal(failed.entitlementPatch.state, 'suspended');

const recovered = prepareLemonSqueezyResearchMembershipTransition(
  signedOptions(
    invoicePayload('subscription_payment_recovered'),
    { ...baseSubscription, state: 'past_due' },
  ),
);
assert.equal(recovered.subscriptionPatch.state, 'active');
assert.equal(recovered.entitlementPatch.state, 'active');

const ordinaryPaymentSuccess = normalizeLemonSqueezyResearchMembershipWebhook(
  signedOptions(invoicePayload('subscription_payment_success')),
);
assert.equal(ordinaryPaymentSuccess.action, 'ignore');
assert.match(ordinaryPaymentSuccess.reason, /subscription_updated/);

const currentFullRefundPayload = invoicePayload('subscription_payment_refunded', {
  status: 'refunded',
  refunded: true,
  refunded_at: '2026-09-15T12:00:00.000Z',
  total: 2900,
  refunded_amount: 2900,
  created_at: '2026-09-15T11:59:59.000Z',
  updated_at: '2026-09-15T12:00:00.000Z',
});
const currentFullRefund = prepareLemonSqueezyResearchMembershipTransition(
  signedOptions(currentFullRefundPayload),
);
assert.equal(currentFullRefund.action, 'apply');
assert.equal(currentFullRefund.subscriptionPatch.state, 'refunded');
assert.equal(currentFullRefund.entitlementPatch.state, 'refunded');
assert.equal(currentFullRefund.entitlementPatch.endsAt, '2026-09-15T12:00:00.000Z');

for (const partialStatus of ['partial_refund', 'paid']) {
  const partialRefund = normalizeLemonSqueezyResearchMembershipWebhook(
    signedOptions(invoicePayload('subscription_payment_refunded', {
      status: partialStatus,
      refunded: false,
      refunded_at: null,
      total: 2900,
      refunded_amount: 500,
      created_at: '2026-09-15T11:59:59.000Z',
      updated_at: '2026-09-15T12:00:00.000Z',
    })),
  );
  assert.equal(partialRefund.action, 'ignore');
  assert.match(partialRefund.reason, /partial subscription invoice refund/i);
}

const historicalFullRefund = normalizeLemonSqueezyResearchMembershipWebhook(
  signedOptions(invoicePayload('subscription_payment_refunded', {
    status: 'refunded',
    refunded: true,
    refunded_at: '2026-09-15T12:00:00.000Z',
    total: 2900,
    refunded_amount: 2900,
    created_at: '2026-08-15T00:00:00.000Z',
    updated_at: '2026-09-15T12:00:00.000Z',
  })),
);
assert.equal(historicalFullRefund.action, 'ignore');
assert.match(historicalFullRefund.reason, /historical subscription invoice/i);

const periodlessFullRefund = prepareLemonSqueezyResearchMembershipTransition(
  signedOptions(currentFullRefundPayload, {
    ...baseSubscription,
    currentPeriodStart: null,
    currentPeriodEnd: null,
  }),
);
assert.equal(periodlessFullRefund.subscriptionPatch.state, 'refunded');
assert.equal(periodlessFullRefund.entitlementPatch.state, 'refunded');

assert.throws(
  () => normalizeLemonSqueezyResearchMembershipWebhook(
    signedOptions(invoicePayload('subscription_payment_refunded', {
      status: 'refunded',
      refunded: true,
      refunded_at: '2026-09-15T12:00:00.000Z',
      total: 2900,
      refunded_amount: 500,
      created_at: '2026-09-15T11:59:59.000Z',
      updated_at: '2026-09-15T12:00:00.000Z',
    })),
  ),
  /refund payload is inconsistent/i,
);

assert.throws(
  () => normalizeLemonSqueezyResearchMembershipWebhook(
    signedOptions(invoicePayload('subscription_payment_refunded', {
      status: 'refunded',
      refunded: true,
      refunded_at: '2026-09-15T12:00:00.000Z',
      total: 2900,
      refunded_amount: 3000,
      created_at: '2026-09-15T11:59:59.000Z',
      updated_at: '2026-09-15T12:00:00.000Z',
    })),
  ),
  /refund amount exceeds invoice total/i,
);

assert.throws(
  () => normalizeLemonSqueezyResearchMembershipWebhook(
    signedOptions(invoicePayload('subscription_payment_refunded', {
      status: 'refunded',
      refunded: true,
      refunded_at: '2026-10-01T00:00:01.000Z',
      total: 2900,
      refunded_amount: 2900,
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:01.000Z',
    })),
  ),
  /outside the current billing period/i,
);

const fullRefundInspection = inspectLemonSqueezyResearchMembershipWebhook(
  signedOptions(currentFullRefundPayload),
);
const changedAmountFullRefundInspection = inspectLemonSqueezyResearchMembershipWebhook(
  signedOptions(invoicePayload('subscription_payment_refunded', {
    status: 'refunded',
    refunded: true,
    refunded_at: '2026-09-15T12:00:00.000Z',
    total: 3000,
    refunded_amount: 3000,
    created_at: '2026-09-15T11:59:59.000Z',
    updated_at: '2026-09-15T12:00:00.000Z',
  })),
);
assert.equal(fullRefundInspection.providerEventId, changedAmountFullRefundInspection.providerEventId);
assert.notEqual(
  fullRefundInspection.metadata.replayFingerprint,
  changedAmountFullRefundInspection.metadata.replayFingerprint,
);
assert.equal(fullRefundInspection.metadata.replayFingerprintVersion, 1);

const expired = prepareLemonSqueezyResearchMembershipTransition(
  signedOptions(subscriptionPayload('subscription_expired', {
    status: 'expired',
    cancelled: true,
    renews_at: null,
    ends_at: '2026-10-01T00:00:00.000Z',
  })),
);
assert.equal(expired.subscriptionPatch.state, 'cancelled');
assert.equal(expired.entitlementPatch.state, 'revoked');

const duplicateOptions = signedOptions(subscriptionPayload('subscription_updated'));
const first = prepareLemonSqueezyResearchMembershipTransition(duplicateOptions);
const duplicate = prepareLemonSqueezyResearchMembershipTransition({
  ...duplicateOptions,
  processedEventKeys: [first.eventKey],
});
assert.equal(duplicate.action, 'duplicate');

assert.throws(
  () => normalizeLemonSqueezyResearchMembershipWebhook({
    ...signedOptions(subscriptionPayload('subscription_updated')),
    signature: '0'.repeat(64),
  }),
  /Invalid Lemon Squeezy webhook signature/,
);

assert.throws(
  () => normalizeLemonSqueezyResearchMembershipWebhook(
    signedOptions(subscriptionPayload('subscription_updated', { product_id: 999 })),
  ),
  /product mismatch/i,
);

assert.throws(
  () => normalizeLemonSqueezyResearchMembershipWebhook(
    signedOptions(subscriptionPayload('subscription_updated', { variant_id: 9999 })),
  ),
  /variant mismatch/i,
);

assert.throws(
  () => normalizeLemonSqueezyResearchMembershipWebhook({
    ...signedOptions(subscriptionPayload('subscription_updated')),
    expectedTestMode: false,
  }),
  /Test\/Live mode mismatch/,
);

assert.throws(
  () => normalizeLemonSqueezyResearchMembershipWebhook(
    signedOptions(subscriptionPayload('subscription_paused', { status: 'paused' })),
  ),
  /not approved/,
);

console.log('Lemon Squeezy Research Membership recurring adapter matrix passed.');
