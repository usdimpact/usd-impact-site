import assert from 'node:assert/strict';
import {
  PURCHASE_ACCESS_READY_EMAIL_BUSINESS_OBJECT_TYPE,
  PURCHASE_ACCESS_READY_EMAIL_MESSAGE_ID,
  createPurchaseAccessReadyEmailIntent,
  deliverPurchaseAccessReadyEmail,
} from '../src/lib/purchase-access-ready-email.js';
import { PURCHASE_ACCESS_READY_EMAIL_TEMPLATE_VERSION } from '../src/lib/launch-email-templates.js';

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
assert.equal(prepared.intent.outboxRecord.template_version, PURCHASE_ACCESS_READY_EMAIL_TEMPLATE_VERSION);
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

// When app-owned email is HOLD, malformed notification-only data must be inert.
const heldInvalidRecipient = await deliverPurchaseAccessReadyEmail({
  accessResult: {
    ...accessResult,
    profile: { ...accessResult.profile, email: 'not-an-email' },
  },
  environment: {},
  ledgerFetchImpl: async () => {
    throw new Error('held email must not call the ledger');
  },
  providerFetchImpl: async () => {
    throw new Error('held email must not call Resend');
  },
});
assert.equal(heldInvalidRecipient.enabled, false);
assert.equal(heldInvalidRecipient.state.enabled, false);


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

// Synthetic Production-approval negatives. These mock both database and provider;
// neither Production SQL nor Resend is contacted.
const syntheticProduction = {
  VERCEL_ENV: 'production',
  SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  EMAIL_READINESS_PRODUCTION_APPROVED: 'true',
  LAUNCH_EMAIL_DISPATCH_ENABLED: 'true',
  LAUNCH_EMAIL_PRODUCTION_APPROVED: 'false',
  RESEND_API_KEY: 're_fake_readonly_123456789012345',
  LAUNCH_EMAIL_FROM_EMAIL: 'USD Impact <support@usd-impact.com>',
};
const persistedOutbox = {
  ...prepared.intent.outboxRecord,
  id: '623e4567-e89b-42d3-a456-426614174000',
  status: 'queued',
  attempt_count: 0,
  created_at: '2026-09-02T14:41:47.000Z',
};
async function syntheticLedgerFetch(url, options = {}) {
  assert.match(url, /\/rest\/v1\/notification_outbox\?on_conflict=idempotency_key$/);
  assert.equal(options.method, 'POST');
  return new Response(JSON.stringify([persistedOutbox]), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
}
let attemptedResend = 0;
const blockResend = async () => {
  attemptedResend += 1;
  throw new Error('Synthetic safety failure: no real Resend request allowed.');
};
let syntheticOutboxWrites = 0;
const recordSyntheticWrite = async (...args) => {
  syntheticOutboxWrites += 1;
  return syntheticLedgerFetch(...args);
};
await assert.rejects(
  () => deliverPurchaseAccessReadyEmail({
    accessResult,
    environment: syntheticProduction,
    ledgerFetchImpl: recordSyntheticWrite,
    providerFetchImpl: blockResend,
  }),
  (error) => error?.code === 'PRODUCTION_DISPATCH_NOT_APPROVED',
  'E9c: disabled Production approval must reject provider dispatch after at most one outbox write',
);
assert.equal(syntheticOutboxWrites, 1);
assert.equal(attemptedResend, 0);

await assert.rejects(
  () => deliverPurchaseAccessReadyEmail({
    accessResult,
    environment: { ...syntheticProduction, RESEND_API_KEY: '', LAUNCH_EMAIL_PRODUCTION_APPROVED: 'true' },
    ledgerFetchImpl: recordSyntheticWrite,
    providerFetchImpl: blockResend,
  }),
  (error) => error?.code === 'RESEND_API_KEY_INVALID',
  'E13: missing Resend credential must not send a provider request',
);
assert.equal(syntheticOutboxWrites, 2);
assert.equal(attemptedResend, 0);

await assert.rejects(
  () => deliverPurchaseAccessReadyEmail({
    accessResult,
    environment: { ...syntheticProduction, EMAIL_READINESS_PRODUCTION_APPROVED: 'false' },
    ledgerFetchImpl: recordSyntheticWrite,
    providerFetchImpl: blockResend,
  }),
  (error) => error?.code === 'PRODUCTION_LEDGER_NOT_APPROVED',
  'E9: missing Production ledger authorization must reject before the outbox write',
);
assert.equal(syntheticOutboxWrites, 2);
assert.equal(attemptedResend, 0);

console.log('Purchase access-ready E9/E9c/E13 Production approval and missing-key negatives passed.');

console.log('Purchase access-ready email tests passed.');
