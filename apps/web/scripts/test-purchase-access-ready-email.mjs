import assert from 'node:assert/strict';
import {
  PURCHASE_ACCESS_READY_EMAIL_BUSINESS_OBJECT_TYPE,
  PURCHASE_ACCESS_READY_EMAIL_MESSAGE_ID,
  createPurchaseAccessReadyEmailIntent,
  deliverPurchaseAccessReadyEmail,
} from '../src/lib/purchase-access-ready-email.js';

const accountId = '123e4567-e89b-42d3-a456-426614174000';
const purchaseId = '223e4567-e89b-42d3-a456-426614174000';
const entitlementId = '323e4567-e89b-42d3-a456-426614174000';
const accessResult = {
  profile: {
    account_id: accountId,
    email: 'Buyer@Example.com',
    status: 'active',
  },
  purchase: {
    id: purchaseId,
    account_id: accountId,
    status: 'completed',
    completed_at: '2026-09-02T14:41:47.000Z',
  },
  entitlement: {
    id: entitlementId,
    account_id: accountId,
    purchase_id: purchaseId,
    state: 'active',
    version: 1,
  },
};

const prepared = createPurchaseAccessReadyEmailIntent({ accessResult });
assert.equal(prepared.entitlementId, entitlementId);
assert.equal(prepared.intent.messageId, PURCHASE_ACCESS_READY_EMAIL_MESSAGE_ID);
assert.equal(
  prepared.intent.outboxRecord.business_object_type,
  PURCHASE_ACCESS_READY_EMAIL_BUSINESS_OBJECT_TYPE,
);
assert.equal(prepared.intent.outboxRecord.business_object_id, purchaseId);
assert.equal(prepared.intent.outboxRecord.state_version, 1);
assert.equal(prepared.intent.outboxRecord.recipient_email_normalized, 'buyer@example.com');
assert.equal(prepared.intent.outboxRecord.classification, 'transactional');
assert.deepEqual(prepared.intent.outboxRecord.payload, {});

let fetchCalled = false;
const disabled = await deliverPurchaseAccessReadyEmail({
  accessResult,
  environment: {},
  ledgerFetchImpl: async () => {
    fetchCalled = true;
    throw new Error('disabled delivery must not call the network');
  },
});
assert.equal(disabled.enabled, false);
assert.equal(fetchCalled, false);

assert.throws(
  () => createPurchaseAccessReadyEmailIntent({
    accessResult: {
      ...accessResult,
      entitlement: { ...accessResult.entitlement, account_id: '423e4567-e89b-42d3-a456-426614174000' },
    },
  }),
  (error) => error.code === 'PURCHASE_ACCESS_READY_IDENTITY_MISMATCH',
);
assert.throws(
  () => createPurchaseAccessReadyEmailIntent({
    accessResult: {
      ...accessResult,
      entitlement: { ...accessResult.entitlement, state: 'suspended' },
    },
  }),
  (error) => error.code === 'PURCHASE_ACCESS_READY_STATE_MISMATCH',
);
assert.throws(
  () => createPurchaseAccessReadyEmailIntent({
    accessResult: {
      ...accessResult,
      profile: { ...accessResult.profile, email: 'not-an-email' },
    },
  }),
  /email/i,
);

console.log('Purchase access-ready email tests passed.');
