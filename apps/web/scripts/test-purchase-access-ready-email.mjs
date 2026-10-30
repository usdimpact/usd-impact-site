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

// P1 first-buyer closeout: prove the future buyer's access-ready outbox
// can be enqueued idempotently without enabling any provider call. This entire
// fixture is offline, never reads real customers or contacts Resend/Supabase.
const fixtureEnvironment = Object.freeze({
  VERCEL_ENV: 'preview',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  LAUNCH_EMAIL_DISPATCH_ENABLED: 'false',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
});
const fixtureRow = {
  id: '9ca40ee4-6477-4fcb-88cc-bf4488dd9adc',
  ...prepared.intent.outboxRecord,
  status: 'queued',
  attempt_count: 0,
  created_at: '2026-09-02T14:41:47.000Z',
  updated_at: '2026-09-02T14:41:47.000Z',
};
let fixturePosts = 0;
let fixtureReads = 0;
let providerCalls = 0;
const mockLedger = async (url, options = {}) => {
  assert.ok(String(url).startsWith('https://ycstrcvshdluovtuasjc.supabase.co/rest/v1/notification_outbox?'));
  if (options.method === 'POST') {
    fixturePosts += 1;
    const body = JSON.parse(options.body);
    assert.deepEqual(body.payload, {});
    assert.equal(body.status, undefined);
    assert.equal(body.attempt_count, undefined);
    assert.equal(body.message_id, 'purchase_access_ready');
    // First insert succeeds; duplicate on_conflict returns no row.
    return new Response(JSON.stringify(fixturePosts === 1 ? [fixtureRow] : []), {
      status: fixturePosts === 1 ? 201 : 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (options.method === 'GET') {
    fixtureReads += 1;
    return new Response(JSON.stringify([fixtureRow]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  throw new Error('Unexpected synthetic ledger operation');
};
const blockProvider = async () => {
  providerCalls += 1;
  throw new Error('Disabled dispatch must never contact a provider');
};
for (let attempt = 0; attempt < 2; attempt += 1) {
  const queued = await deliverPurchaseAccessReadyEmail({
    accessResult,
    environment: fixtureEnvironment,
    ledgerFetchImpl: mockLedger,
    providerFetchImpl: blockProvider,
  });
  assert.equal(queued.enabled, false);
  assert.equal(queued.state.enabled, true);
  assert.equal(queued.state.outbox.id, fixtureRow.id);
  assert.equal(queued.delivery, null);
}
assert.equal(fixturePosts, 2, 'same completed purchase may safely reattempt its idempotent insert');
assert.equal(fixtureReads, 1, 'the duplicate reuses its existing ledger identity');
assert.equal(providerCalls, 0, 'a disabled sender must not contact Resend');

let unapprovedProductionCalls = 0;
await assert.rejects(
  () => deliverPurchaseAccessReadyEmail({
    accessResult,
    environment: {
      ...fixtureEnvironment,
      VERCEL_ENV: 'production',
      SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
      // Deliberately omit EMAIL_READINESS_PRODUCTION_APPROVED.
    },
    ledgerFetchImpl: async () => {
      unapprovedProductionCalls += 1;
      throw new Error('Unapproved Production ledger must not contact Supabase');
    },
    providerFetchImpl: blockProvider,
  }),
  (error) => error?.code === 'PRODUCTION_LEDGER_NOT_APPROVED',
);
assert.equal(unapprovedProductionCalls, 0, 'production guard stops before network');
assert.equal(providerCalls, 0);

console.log('Purchase access-ready email tests passed.');
