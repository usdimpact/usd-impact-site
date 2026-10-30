import assert from 'node:assert/strict';
import {
  attemptNonBlockingPurchaseAccessReadyEmail,
} from '../src/lib/purchase-access-ready-email.js';
import {
  renderPurchaseAccessReadyLocalePreview,
  resolveVerifiedAccessReadyLocale,
} from '../src/lib/purchase-access-ready-locale-preview.js';
import { readFile } from 'node:fs/promises';
import { assertPurchaseAccessReadySendGate } from '../src/lib/purchase-access-ready-send-gate.js';
import { verifyPurchaseAccessReadyAtomicPair } from '../src/lib/purchase-access-ready-atomic-pair-review.js';
import {
  prepareAccessReadyLocaleSnapshot,
  assertUnchangedAccessReadyLocaleSnapshot,
} from '../src/lib/purchase-access-ready-locale-contract.js';
import { previewPurchaseAccessReadyRecovery } from '../src/lib/purchase-access-ready-recovery-preview.js';
import {
  PURCHASE_ACCESS_READY_EMAIL_BUSINESS_OBJECT_TYPE,
  PURCHASE_ACCESS_READY_EMAIL_MESSAGE_ID,
  createPurchaseAccessReadyEmailIntent,
  deliverPurchaseAccessReadyEmail,
} from '../src/lib/purchase-access-ready-email.js';
import { PURCHASE_ACCESS_READY_EMAIL_TEMPLATE_VERSION } from '../src/lib/launch-email-templates.js';
import { dispatchEnqueuedLaunchEmail } from '../src/lib/launch-email-dispatch.js';

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
  PURCHASE_ACCESS_READY_ATOMIC_LEDGER_ENABLED: 'true',
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
const mockFreeze = prepareAccessReadyLocaleSnapshot({
  accessResult, snapshotAt: '2026-10-30T20:50:00.000Z',
});
const mockSnapshot = {
  outbox_id: fixtureRow.id,
  purchase_id: purchaseId,
  account_id: accountId,
  render_locale: 'en',
  locale_source: 'english_fallback',
  preference_revision: null,
  template_version: prepared.intent.outboxRecord.template_version,
  recipient_sha256: mockFreeze.recipientSha256,
  snapshot_identity: mockFreeze.snapshotIdentity,
};
let fixturePosts = 0;
let fixtureReads = 0;
let providerCalls = 0;
const mockLedger = async (url, options = {}) => {
  assert.equal(
    String(url),
    'https://ycstrcvshdluovtuasjc.supabase.co/rest/v1/rpc/ui02_enqueue_access_ready_atomic',
  );
  assert.equal(options.method, 'POST');
  fixturePosts += 1;
  assert.deepEqual(JSON.parse(options.body), { p_purchase_id: purchaseId });
  return new Response(JSON.stringify({
    state: 'atomic_pair_verified', outbox: fixtureRow, snapshot: mockSnapshot,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
assert.equal(fixturePosts, 2, 'same purchase may retry the atomic RPC safely');
assert.equal(fixtureReads, 0, 'no generic outbox-only lookup may be used');
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

// Disabled Production ledger is the outer fail-closed boundary, even if a
// delivery flag is accidentally enabled. No persistence or provider call.
let disabledProductionNetworkCalls = 0;
const disabledProduction = await deliverPurchaseAccessReadyEmail({
  accessResult,
  environment: {
    ...fixtureEnvironment,
    VERCEL_ENV: 'production',
    SUPABASE_URL: 'https://gjzetjugmnwanvjkchux.supabase.co',
    EMAIL_READINESS_LEDGER_ENABLED: 'false',
    EMAIL_READINESS_PRODUCTION_APPROVED: 'true',
    LAUNCH_EMAIL_DISPATCH_ENABLED: 'true',
    LAUNCH_EMAIL_PRODUCTION_APPROVED: 'true',
  },
  ledgerFetchImpl: async () => {
    disabledProductionNetworkCalls += 1;
    throw new Error('Disabled Production ledger must never write');
  },
  providerFetchImpl: async () => {
    disabledProductionNetworkCalls += 1;
    throw new Error('Disabled Production ledger must never send');
  },
});
assert.equal(disabledProduction.enabled, false);
assert.equal(disabledProduction.state.enabled, false);
assert.equal(disabledProductionNetworkCalls, 0);


// Atomic purchase-ledger is independently disabled, even if the generic
// email ledger is enabled. It never falls back to unpaired writes.
let unsafeLegacyRequests = 0;
const disabledAtomic = await deliverPurchaseAccessReadyEmail({
  accessResult,
  environment: {
    ...fixtureEnvironment, PURCHASE_ACCESS_READY_ATOMIC_LEDGER_ENABLED: 'false',
  },
  ledgerFetchImpl: async () => {
    unsafeLegacyRequests += 1;
    throw new Error('Legacy writer unexpectedly used');
  },
  providerFetchImpl: blockProvider,
});
assert.equal(disabledAtomic.enabled, false);
assert.equal(disabledAtomic.state.enabled, false);
assert.equal(unsafeLegacyRequests, 0);
for (const fakeResponse of [
  new Response('not json', { status: 200 }),
  new Response(JSON.stringify({ state: 'atomic_pair_verified', outbox: fixtureRow }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }),
  new Response(JSON.stringify({
    state: 'atomic_pair_verified',
    outbox: fixtureRow,
    snapshot: { ...mockSnapshot, snapshot_identity: '0'.repeat(64) },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  new Response('{}', { status: 404 }),
]) {
  await assert.rejects(
    () => deliverPurchaseAccessReadyEmail({
      accessResult, environment: fixtureEnvironment,
      ledgerFetchImpl: async () => fakeResponse, providerFetchImpl: blockProvider,
    }),
    error => [
      'PURCHASE_ACCESS_READY_ATOMIC_RESPONSE_HOLD',
      'PURCHASE_ACCESS_READY_ATOMIC_PAIR_HOLD',
      'PURCHASE_ACCESS_READY_ATOMIC_RPC_HOLD',
    ].includes(error.code),
  );
}
assert.equal(providerCalls, 0);

// An independent Production send-approval gate is mandatory even after a
// durable outbox state exists. This is an offline state fixture, not a real
// Production ledger, account, key, mail provider or message.
let unapprovedDispatchNetworkCalls = 0;
await assert.rejects(
  () => dispatchEnqueuedLaunchEmail({
    state: {
      enabled: true,
      intent: prepared.intent,
      outbox: fixtureRow,
      config: {
        url: 'https://gjzetjugmnwanvjkchux.supabase.co',
        secretKey: 'synthetic-not-a-real-key',
      },
    },
    environment: {
      VERCEL_ENV: 'production',
      LAUNCH_EMAIL_DISPATCH_ENABLED: 'true',
      LAUNCH_EMAIL_PRODUCTION_APPROVED: 'false',
    },
    fetchImpl: async () => {
      unapprovedDispatchNetworkCalls += 1;
      throw new Error('Unapproved Production dispatcher must not read/write');
    },
    providerAdapter: {
      id: 'resend',
      async send() {
        unapprovedDispatchNetworkCalls += 1;
        throw new Error('Unapproved Production dispatcher must not send');
      },
    },
  }),
  (error) => error?.code === 'PRODUCTION_DISPATCH_NOT_APPROVED',
);
assert.equal(unapprovedDispatchNetworkCalls, 0);
assert.equal(providerCalls, 0);



// Owner-approved contract: a secondary notification must not turn an already
// verified and granted purchase into a failed webhook receipt. Synthetic only.
const errorsLogged = [];
const heldNotification = await attemptNonBlockingPurchaseAccessReadyEmail({
  accessResult,
  deliveryImpl: async () => {
    const error = new Error('recipient and secret values must never enter the log');
    error.code = 'PRODUCTION_LEDGER_NOT_APPROVED';
    throw error;
  },
  reportImpl: (message, metadata) => errorsLogged.push({ message, metadata }),
});
assert.deepEqual(heldNotification, { status: 'hold', code: 'PRODUCTION_LEDGER_NOT_APPROVED' });
assert.equal(errorsLogged.length, 1);
assert.deepEqual(errorsLogged[0].metadata, { code: 'PRODUCTION_LEDGER_NOT_APPROVED' });
assert.doesNotMatch(JSON.stringify(errorsLogged), /recipient and secret values/);

const unreachableLogger = await attemptNonBlockingPurchaseAccessReadyEmail({
  accessResult,
  deliveryImpl: async () => {
    throw new Error('unknown provider failure');
  },
  reportImpl: () => { throw new Error('logger unavailable'); },
});
assert.deepEqual(unreachableLogger, {
  status: 'hold',
  code: 'PURCHASE_ACCESS_READY_NOTIFICATION_UNAVAILABLE',
});

const nonBlockingDisabled = await attemptNonBlockingPurchaseAccessReadyEmail({
  accessResult,
  environment: {},
  ledgerFetchImpl: async () => { throw new Error('disabled must not call a network'); },
  providerFetchImpl: async () => { throw new Error('disabled must not call a network'); },
  reportImpl: () => { throw new Error('disabled must not warn'); },
});
assert.deepEqual(nonBlockingDisabled, { status: 'dispatch_disabled' });

const acceptedButNotDelivered = await attemptNonBlockingPurchaseAccessReadyEmail({
  accessResult,
  deliveryImpl: async () => ({ enabled: true, state: { enabled: true }, delivery: { action: 'accepted' } }),
  reportImpl: () => { throw new Error('accepted result must not warn'); },
});
assert.deepEqual(acceptedButNotDelivered, { status: 'delivery_attempted' });


// The final provider handoff has a *separate*, default-disabled gate.
const gatedState = {
  enabled: true,
  intent: prepared.intent,
  projectRef: 'ycstrcvshdluovtuasjc',
  config: {
    url: 'https://ycstrcvshdluovtuasjc.supabase.co',
    secretKey: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
  },
  outbox: fixtureRow,
};
let proofCalls = 0;
await assert.rejects(
  () => assertPurchaseAccessReadySendGate({
    state: gatedState, environment: { VERCEL_ENV: 'preview' },
    fetchImpl: async () => { proofCalls++; throw new Error('disabled must not fetch'); },
  }),
  error => error.code === 'PURCHASE_ACCESS_READY_DISPATCH_HOLD',
);
assert.equal(proofCalls, 0);
const approvedSyntheticProofEnv = {
  VERCEL_ENV: 'preview', PURCHASE_ACCESS_READY_ATOMIC_DISPATCH_ENABLED: 'true',
};
const checkedProof = await assertPurchaseAccessReadySendGate({
  state: gatedState,
  environment: approvedSyntheticProofEnv,
  fetchImpl: async (url, request) => {
    proofCalls++;
    assert.equal(String(url),
      'https://ycstrcvshdluovtuasjc.supabase.co/rest/v1/rpc/ui02_check_access_ready_dispatch');
    assert.deepEqual(JSON.parse(request.body), {
      p_outbox_id: fixtureRow.id,
      p_idempotency_key: prepared.intent.outboxRecord.idempotency_key,
    });
    return new Response(JSON.stringify({
      verified: true, locale: 'en',
      outboxId: fixtureRow.id,
      idempotencyKey: prepared.intent.outboxRecord.idempotency_key,
      templateVersion: fixtureRow.template_version,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});
assert.deepEqual(checkedProof, { checked: true, verified: true, locale: 'en' });
assert.equal(proofCalls, 1);
for (const fakeResult of [
  new Response('{}', { status: 404 }),
  new Response('bad JSON', { status: 200 }),
  new Response(JSON.stringify({ verified: false }), { status: 200 }),
  new Response(JSON.stringify({
    verified: true, locale: 'es', outboxId: fixtureRow.id,
    idempotencyKey: fixtureRow.idempotency_key,
    templateVersion: fixtureRow.template_version,
  }), { status: 200 }),
  new Response(JSON.stringify({
    verified: true, locale: 'en', outboxId: fixtureRow.id,
    idempotencyKey: 'notification:v1:' + '0'.repeat(64),
    templateVersion: fixtureRow.template_version,
  }), { status: 200 }),
]) {
  await assert.rejects(
    () => assertPurchaseAccessReadySendGate({
      state: gatedState, environment: approvedSyntheticProofEnv,
      fetchImpl: async () => fakeResult,
    }),
    error => error.code === 'PURCHASE_ACCESS_READY_DISPATCH_PROOF_HOLD',
  );
}
let productionProofCalls = 0;
await assert.rejects(
  () => assertPurchaseAccessReadySendGate({
    state: {
      ...gatedState, projectRef: 'gjzetjugmnwanvjkchux',
      config: { ...gatedState.config, url: 'https://gjzetjugmnwanvjkchux.supabase.co' },
    },
    environment: {
      VERCEL_ENV: 'production',
      PURCHASE_ACCESS_READY_ATOMIC_DISPATCH_ENABLED: 'true',
      PURCHASE_ACCESS_READY_PRODUCTION_APPROVED: 'false',
    },
    fetchImpl: async () => { productionProofCalls++; throw new Error('unapproved fetch'); },
  }),
  error => error.code === 'PURCHASE_ACCESS_READY_PRODUCTION_HOLD',
);
assert.equal(productionProofCalls, 0);
assert.equal(providerCalls, 0);

// Read/identity verification remains OUTSIDE the secondary email failure
// boundary: it is required before invoking the non-blocking notification.
const commerceRuntimeSource = await readFile(
  new URL('../src/lib/lemon-squeezy-commerce-runtime.js', import.meta.url),
  'utf8',
);
assert.match(
  commerceRuntimeSource,
  /const accessResult = await readCommerceAccessReadyResult\([\s\S]*?await attemptNonBlockingPurchaseAccessReadyEmail\(/,
);
assert.doesNotMatch(commerceRuntimeSource, /await deliverPurchaseAccessReadyEmail\(/);

// Localized copy is REVIEW ONLY; there is currently no verified customer
// language column and no locale snapshot in the durable outbox.
assert.deepEqual(resolveVerifiedAccessReadyLocale(), {
  state: 'fallback', locale: 'en', reason: 'no_verified_preference',
});
assert.deepEqual(resolveVerifiedAccessReadyLocale({ locale: 'es-419', source: 'verified_account' }), {
  state: 'ready', locale: 'es', reason: 'verified_account',
});
assert.deepEqual(resolveVerifiedAccessReadyLocale({ locale: 'en-US', source: 'verified_account' }), {
  state: 'ready', locale: 'en', reason: 'verified_account',
});
assert.deepEqual(resolveVerifiedAccessReadyLocale({ locale: 'pt-BR', source: 'verified_account' }), {
  state: 'hold', locale: null, reason: 'portuguese_publication_hold',
});
assert.throws(
  () => resolveVerifiedAccessReadyLocale({ locale: 'es', source: 'resend_segment' }),
  (error) => error.code === 'UNTRUSTED_PURCHASE_LOCALE_SOURCE',
);
assert.throws(
  () => resolveVerifiedAccessReadyLocale({ locale: 'de-DE', source: 'verified_account' }),
  (error) => error.code === 'UNSUPPORTED_PURCHASE_LOCALE',
);
const englishPreview = renderPurchaseAccessReadyLocalePreview({ reference: 'PURCHASE_01' });
assert.equal(englishPreview.locale, 'en');
assert.equal(englishPreview.previewOnly, true);
assert.equal(englishPreview.canDispatch, false);
assert.match(englishPreview.html, /<html lang="en">/);

const spanishPreview = renderPurchaseAccessReadyLocalePreview({
  reference: 'PURCHASE_02', locale: 'es-MX', source: 'verified_account',
});
assert.equal(spanishPreview.locale, 'es');
assert.equal(spanishPreview.previewOnly, true);
assert.equal(spanishPreview.canDispatch, false);
assert.equal(spanishPreview.classification, 'transactional');
assert.match(spanishPreview.html, /<html lang="es">/);
assert.match(spanishPreview.text, /Tu acceso al Library Pass está listo/);
assert.match(spanishPreview.html, /https:\/\/www\.usd-impact\.com\/account\//);
assert.doesNotMatch(spanishPreview.html, /List-Unsubscribe|siguiendoeldollar\.com|seguindoodolar\.com/i);
assert.doesNotMatch(spanishPreview.text, /suscríbete|promoción|oferta limitada/i);
assert.equal('headers' in spanishPreview, false);
assert.deepEqual(
  renderPurchaseAccessReadyLocalePreview({
    reference: 'PURCHASE_03', locale: 'pt', source: 'verified_account',
  }),
  {
    previewOnly: true, canDispatch: false, state: 'hold',
    locale: null, reason: 'portuguese_publication_hold',
  },
);
assert.throws(
  () => renderPurchaseAccessReadyLocalePreview({
    reference: '<script>', locale: 'es', source: 'verified_account',
  }),
  (error) => error.code === 'INVALID_PURCHASE_REFERENCE',
);


// Read-only recovery cases: historical purchases, outbox suppression and
// failed notification may NOT trigger a replay of a commercial webhook.
const nextPurchase = {
  id: '523e4567-e89b-42d3-a456-426614174000',
  account_id: accountId,
  purchase_intent_id: '623e4567-e89b-42d3-a456-426614174000',
  product_id: 'read-the-dollar-first-guided-interactive-edition',
  provider: 'lemon-squeezy',
  provider_event_id: 'lemon-squeezy:fixture-event',
  status: 'completed', completed_at: '2026-11-03T12:30:00.000Z',
  refunded_at: null, disputed_at: null,
};
const nextEntitlement = {
  ...accessResult.entitlement, id: '723e4567-e89b-42d3-a456-426614174000',
  account_id: accountId, purchase_id: nextPurchase.id, state: 'active',
  product_id: nextPurchase.product_id, version: 1,
};
const nextIntent = {
  id: nextPurchase.purchase_intent_id, account_id: accountId,
  status: 'completed', product_id: nextPurchase.product_id,
};
const scannerFixture = {
  observedAt: '2026-11-03T13:00:00.000Z',
  purchases: [nextPurchase], purchaseIntents: [nextIntent],
  entitlements: [nextEntitlement], profiles: [accessResult.profile], outboxRows: [],
  snapshotCertified: true,
};
const noneApproved = previewPurchaseAccessReadyRecovery(scannerFixture);
assert.deepEqual(noneApproved.candidates, []);
assert.equal(noneApproved.reason, 'CUTOVER_NOT_APPROVED');
assert.equal(noneApproved.canDispatch, false);
const allowedFixture = { ...scannerFixture, approvedCutoverAt: '2026-11-02T00:00:00.000Z' };
const oneMissing = previewPurchaseAccessReadyRecovery(allowedFixture);
assert.equal(oneMissing.state, 'review_only');
assert.deepEqual(oneMissing.candidates, [{
  purchaseId: nextPurchase.id, verdict: 'REVIEW_ONLY', locale: 'en',
  reason: 'MISSING_OUTBOX_AFTER_APPROVED_CUTOVER',
}]);
assert.equal(oneMissing.canDispatch, false);
assert.equal(oneMissing.canWrite, false);
assert.deepEqual(oneMissing, previewPurchaseAccessReadyRecovery(allowedFixture));
assert.doesNotMatch(JSON.stringify(oneMissing), /buyer@example.com|lemon-squeezy:fixture-event/);
const historicalOnly = previewPurchaseAccessReadyRecovery({
  ...scannerFixture, approvedCutoverAt: '2026-11-04T00:00:00.000Z',
  observedAt: '2026-11-05T00:00:00.000Z',
});
assert.equal(historicalOnly.beforeCutover, 1);
assert.deepEqual(historicalOnly.candidates, []);
const existingEmail = previewPurchaseAccessReadyRecovery({
  ...allowedFixture, outboxRows: [{
    message_id: 'purchase_access_ready', business_object_type: 'purchase',
    business_object_id: nextPurchase.id, status: 'terminal_failed',
    recipient_email_normalized: 'stale@example.com',
  }],
});
assert.equal(existingEmail.existing, 1);
assert.deepEqual(existingEmail.candidates, []);
const invalidEntitlement = previewPurchaseAccessReadyRecovery({
  ...allowedFixture, entitlements: [{
    ...nextEntitlement, account_id: '823e4567-e89b-42d3-a456-426614174000',
  }],
});
assert.equal(invalidEntitlement.held, 1);
assert.deepEqual(invalidEntitlement.candidates, []);
const duplicateEntitlement = previewPurchaseAccessReadyRecovery({
  ...allowedFixture, entitlements: [nextEntitlement, { ...nextEntitlement }],
});
assert.equal(duplicateEntitlement.held, 1);
const invalidRecipient = previewPurchaseAccessReadyRecovery({
  ...allowedFixture, profiles: [{ ...accessResult.profile, email: 'not-an-email' }],
});
assert.equal(invalidRecipient.held, 1);
for (const edit of [
  { status: 'refunded' }, { provider: 'untrusted' },
  { provider_event_id: null },
  { refunded_at: '2026-11-03T12:40:00.000Z' },
  { disputed_at: '2026-11-03T12:40:00.000Z' },
]) {
  const invalid = previewPurchaseAccessReadyRecovery({
    ...allowedFixture, purchases: [{ ...nextPurchase, ...edit }],
  });
  assert.deepEqual(invalid.candidates, []);
}

const incompleteSnapshot = previewPurchaseAccessReadyRecovery({
  ...allowedFixture, snapshotCertified: false,
});
assert.equal(incompleteSnapshot.state, 'hold');
assert.equal(incompleteSnapshot.reason, 'SNAPSHOT_NOT_CERTIFIED');
assert.deepEqual(incompleteSnapshot.candidates, []);
assert.throws(
  () => previewPurchaseAccessReadyRecovery({
    ...allowedFixture, outboxRows: undefined,
  }),
  /bounded array/,
);
for (const field of ['refunded_at', 'disputed_at']) {
  const incomplete = { ...nextPurchase };
  delete incomplete[field];
  const unsafeSnapshot = previewPurchaseAccessReadyRecovery({
    ...allowedFixture, purchases: [incomplete],
  });
  assert.equal(unsafeSnapshot.held, 1, field + ' missing must fail closed');
  assert.deepEqual(unsafeSnapshot.candidates, []);
}
const mislabeledExistingOutbox = previewPurchaseAccessReadyRecovery({
  ...allowedFixture, outboxRows: [{
    message_id: 'purchase_access_ready',
    business_object_type: 'unknown',
    business_object_id: nextPurchase.id,
    status: 'accepted',
  }],
});
assert.equal(mislabeledExistingOutbox.existing, 1);
assert.deepEqual(mislabeledExistingOutbox.candidates, []);

assert.throws(() => previewPurchaseAccessReadyRecovery({
  ...scannerFixture, approvedCutoverAt: '2026-11-02',
}), /canonical UTC/);
assert.throws(() => previewPurchaseAccessReadyRecovery({
  ...allowedFixture, purchases: Array.from({ length: 501 }, () => nextPurchase),
}), /bounded array/);
const twentySix = Array.from({ length: 26 }, (_, i) => {
  const suffix = i.toString(16).padStart(12, '0');
  return {
    ...nextPurchase,
    id: '523e4567-e89b-42d3-a456-' + suffix,
    purchase_intent_id: '623e4567-e89b-42d3-a456-' + suffix,
  };
});
const overflow = previewPurchaseAccessReadyRecovery({
  ...allowedFixture, purchases: twentySix,
  purchaseIntents: twentySix.map(x => ({ ...nextIntent, id: x.purchase_intent_id })),
  entitlements: twentySix.map(x => ({ ...nextEntitlement, purchase_id: x.id })),
});
assert.equal(overflow.state, 'hold');
assert.equal(overflow.reason, 'CANDIDATE_LIMIT_EXCEEDED');
assert.deepEqual(overflow.candidates, []);



// UI-02 authenticated account-language and immutable rendering contract.
// All values are synthetic. Nothing is sent or persisted.
const snapshotFixture = {
  accessResult,
  snapshotAt: '2026-10-30T20:50:00.000Z',
};
const fallbackSnapshot = prepareAccessReadyLocaleSnapshot(snapshotFixture);
assert.equal(fallbackSnapshot.locale, 'en');
assert.equal(fallbackSnapshot.localeSource, 'english_fallback');
assert.equal(fallbackSnapshot.preferenceRevision, null);
assert.equal(fallbackSnapshot.compatibleWithCurrentOutbox, true);
assert.equal(fallbackSnapshot.canDispatch, false);
assert.equal(fallbackSnapshot.canWrite, false);
assert.ok(Object.isFrozen(fallbackSnapshot));
assert.equal(fallbackSnapshot.recipientSha256.length, 64);
assert.doesNotMatch(JSON.stringify(fallbackSnapshot), /Buyer@Example.com|buyer@example.com/);
assert.deepEqual(fallbackSnapshot, prepareAccessReadyLocaleSnapshot(snapshotFixture));
const verifiedSpanishPreference = {
  account_id: accountId, preferred_locale: 'es',
  selection_provenance: 'authenticated_account',
  revision: 2,
  updated_at: '2026-10-30T20:35:00.000Z',
};
const spanishSnapshot = prepareAccessReadyLocaleSnapshot({
  ...snapshotFixture,
  accountPreference: verifiedSpanishPreference,
});
assert.equal(spanishSnapshot.locale, 'es');
assert.equal(spanishSnapshot.localeSource, 'verified_account');
assert.equal(spanishSnapshot.preferenceRevision, 2);
assert.equal(spanishSnapshot.compatibleWithCurrentOutbox, false);
assert.equal(spanishSnapshot.disposition, 'HOLD_OUTBOX_TEMPLATE_VERSION_MISMATCH');
assert.equal(spanishSnapshot.canDispatch, false);
assert.notEqual(spanishSnapshot.snapshotIdentity, fallbackSnapshot.snapshotIdentity);
assert.deepEqual(assertUnchangedAccessReadyLocaleSnapshot(spanishSnapshot, { ...spanishSnapshot }), {
  verified: true, canDispatch: false,
});
const changedPreference = prepareAccessReadyLocaleSnapshot({
  ...snapshotFixture,
  accountPreference: {
    ...verifiedSpanishPreference,
    preferred_locale: 'en',
    revision: 3,
  },
});
assert.equal(changedPreference.locale, 'en');
assert.throws(
  () => assertUnchangedAccessReadyLocaleSnapshot(spanishSnapshot, changedPreference),
  error => error.code === 'LOCALE_SNAPSHOT_IDENTITY_MISMATCH',
);
for (const preference of [
  { ...verifiedSpanishPreference, account_id: '423e4567-e89b-42d3-a456-426614174000' },
  { ...verifiedSpanishPreference, selection_provenance: 'resend_segment' },
  { ...verifiedSpanishPreference, selection_provenance: 'browser_locale' },
]) {
  assert.throws(
    () => prepareAccessReadyLocaleSnapshot({ ...snapshotFixture, accountPreference: preference }),
    error => error.code === 'UNVERIFIED_ACCOUNT_PREFERENCE',
  );
}
for (const unsupported of ['pt', 'pt-BR', 'de', 'es-MX', '']) {
  assert.throws(
    () => prepareAccessReadyLocaleSnapshot({
      ...snapshotFixture,
      accountPreference: { ...verifiedSpanishPreference, preferred_locale: unsupported },
    }),
    error => error.code === 'UNSUPPORTED_ACCOUNT_PREFERENCE_LOCALE',
  );
}
for (const badRevision of [0, -1, 1.5, Number.MAX_SAFE_INTEGER, '3']) {
  assert.throws(
    () => prepareAccessReadyLocaleSnapshot({
      ...snapshotFixture,
      accountPreference: { ...verifiedSpanishPreference, revision: badRevision },
    }),
    error => error.code === 'PREFERENCE_REVISION_INVALID',
  );
}
assert.throws(
  () => prepareAccessReadyLocaleSnapshot({
    ...snapshotFixture,
    accountPreference: { ...verifiedSpanishPreference, updated_at: '2026-10-31T20:35:00.000Z' },
  }),
  error => error.code === 'PREFERENCE_FROM_FUTURE',
);
assert.throws(
  () => prepareAccessReadyLocaleSnapshot({
    ...snapshotFixture, snapshotAt: '2026-09-01T20:50:00.000Z',
  }),
  error => error.code === 'SNAPSHOT_BEFORE_PURCHASE',
);


// Only synthetic immutable pair verification; no outbound requests.
const persistedPair = {
  outbox_id: fixtureRow.id,
  purchase_id: purchaseId,
  account_id: accountId,
  render_locale: 'en',
  locale_source: 'english_fallback',
  preference_revision: null,
  template_version: prepared.intent.outboxRecord.template_version,
  recipient_sha256: fallbackSnapshot.recipientSha256,
  snapshot_identity: fallbackSnapshot.snapshotIdentity,
};
const pair = verifyPurchaseAccessReadyAtomicPair({
  accessResult, outbox: fixtureRow, snapshot: persistedPair,
});
assert.equal(pair.state, 'MATCHED_REVIEW_ONLY');
assert.equal(pair.canDispatch, false);
assert.equal(pair.canWrite, false);
assert.doesNotMatch(JSON.stringify(pair), /buyer@example.com/);
for (const [broken, code] of [
  [null, 'MISSING_ATOMIC_PAIR'],
  [{ ...persistedPair, outbox_id: '923e4567-e89b-42d3-a456-426614174000' }, 'ATOMIC_LINK_MISMATCH'],
  [{ ...persistedPair, account_id: '923e4567-e89b-42d3-a456-426614174000' }, 'ATOMIC_LINK_MISMATCH'],
  [{ ...persistedPair, render_locale: 'pt' }, 'ATOMIC_LOCALE_UNAPPROVED'],
  [{ ...persistedPair, locale_source: 'resend_segment' }, 'ATOMIC_PROVENANCE_MISMATCH'],
  [{ ...persistedPair, template_version: 'altered-v1' }, 'ATOMIC_TEMPLATE_MISMATCH'],
  [{ ...persistedPair, recipient_sha256: '0'.repeat(64) }, 'ATOMIC_RECIPIENT_MISMATCH'],
  [{ ...persistedPair, snapshot_identity: '0'.repeat(64) }, 'ATOMIC_SNAPSHOT_MISMATCH'],
  [{ ...persistedPair, preference_revision: 1 }, 'ATOMIC_PROVENANCE_MISMATCH'],
]) {
  assert.throws(
    () => verifyPurchaseAccessReadyAtomicPair({
      accessResult, outbox: fixtureRow, snapshot: broken,
    }),
    error => error.code === code,
  );
}
assert.throws(
  () => verifyPurchaseAccessReadyAtomicPair({
    accessResult,
    outbox: { ...fixtureRow, recipient_email_normalized: 'wrong@example.com' },
    snapshot: persistedPair,
  }),
  error => error.code === 'ATOMIC_OUTBOX_MISMATCH',
);
assert.throws(
  () => verifyPurchaseAccessReadyAtomicPair({
    accessResult, outbox: fixtureRow,
    snapshot: {
      ...persistedPair, render_locale: 'es',
      locale_source: 'verified_account', preference_revision: 2,
      template_version: spanishSnapshot.templateVersion,
      snapshot_identity: spanishSnapshot.snapshotIdentity,
    },
  }),
  error => error.code === 'ATOMIC_TEMPLATE_MISMATCH',
);

console.log('Purchase access-ready email tests passed.');
