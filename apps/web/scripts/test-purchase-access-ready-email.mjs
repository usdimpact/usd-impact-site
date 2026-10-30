import assert from 'node:assert/strict';
import {
  attemptNonBlockingPurchaseAccessReadyEmail,
} from '../src/lib/purchase-access-ready-email.js';
import {
  renderPurchaseAccessReadyLocalePreview,
  resolveVerifiedAccessReadyLocale,
} from '../src/lib/purchase-access-ready-locale-preview.js';
import { readFile } from 'node:fs/promises';
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

console.log('Purchase access-ready email tests passed.');
