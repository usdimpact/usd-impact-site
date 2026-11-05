// Research P1 integrated candidate: offline regressions for checkout custody,
// paid-but-unbound quarantine and the pre-Auth billing hold. No network: every
// request goes to an in-process mock and any unmodelled request throws.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  createResearchMembershipCheckout,
  processResearchMembershipWebhookWithFirstPurchase,
  readResearchMembershipCheckoutConfig,
} from '../src/lib/research-membership-first-purchase.js';
import {
  finalizeOneDueAccount,
  readAccountDeletionFinalizerConfig,
  runDueAccountDeletionFinalizer,
} from '../src/lib/account-deletion-finalizer.js';

const accountId = '11111111-1111-4111-8111-111111111111';
const attemptId = '33333333-3333-4333-8333-333333333333';
const quarantineId = '44444444-4444-4444-8444-444444444444';
const SUPA = 'https://ycstrcvshdluovtuasjc.supabase.co';
const json = (status, body) => new Response(body === undefined ? '' : JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks += 1; };

// ---------------------------------------------------------------- checkout
const checkoutEnvironment = {
  VERCEL_ENV: 'preview',
  RESEARCH_MEMBERSHIP_WEBHOOK_ENABLED: 'true',
  LEMON_SQUEEZY_RESEARCH_TEST_MODE: 'true',
  LEMON_SQUEEZY_RESEARCH_TEST_WEBHOOK_SECRET: 'research-first-purchase-test-secret',
  LEMON_SQUEEZY_RESEARCH_TEST_STORE_ID: '42',
  LEMON_SQUEEZY_RESEARCH_TEST_PRODUCT_ID: '99',
  LEMON_SQUEEZY_RESEARCH_TEST_MONTHLY_VARIANT_ID: '314',
  LEMON_SQUEEZY_RESEARCH_TEST_ANNUAL_VARIANT_ID: '315',
  LEMON_SQUEEZY_TEST_API_KEY: 'test_api_key_abcdefghijklmnopqrstuvwxyz',
  COMMERCE_SANDBOX_QA_EMAIL: 'qa@example.com',
  SUPABASE_URL: SUPA,
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
};
const checkoutConfig = readResearchMembershipCheckoutConfig(checkoutEnvironment);
const user = { id: accountId, email: 'qa@example.com' };

function checkoutWorld({ attempt = () => json(200, attemptId), attach = () => json(200, true), provider } = {}) {
  const log = [];
  const bodies = {};
  const fetchImpl = async (url, init = {}) => {
    const href = String(url);
    if (href.startsWith(`${SUPA}/rest/v1/profiles?`)) {
      log.push('profile');
      return json(200, [{ account_id: accountId, status: 'active', deletion_requested_at: null, deleted_at: null }]);
    }
    if (href.startsWith(`${SUPA}/rest/v1/subscriptions?`)) { log.push('subscriptions'); return json(200, []); }
    if (href.startsWith(`${SUPA}/rest/v1/entitlements?`)) { log.push('entitlements'); return json(200, []); }
    if (href === `${SUPA}/rest/v1/rpc/create_research_checkout_attempt`) {
      log.push('attempt'); bodies.attempt = JSON.parse(init.body); return attempt();
    }
    if (href === `${SUPA}/rest/v1/rpc/attach_research_checkout_attempt`) {
      log.push('attach'); bodies.attach = JSON.parse(init.body); return attach();
    }
    if (href === 'https://api.lemonsqueezy.com/v1/checkouts') {
      log.push('provider');
      if (provider) return provider();
      return json(201, {
        data: {
          type: 'checkouts',
          id: 'checkout_p1',
          attributes: { store_id: 42, variant_id: 314, test_mode: true, url: 'https://example.lemonsqueezy.com/checkout/custom/p1' },
        },
      });
    }
    throw new Error(`Unexpected request ${init.method || 'GET'} ${href}`);
  };
  return { log, bodies, fetchImpl };
}
const runCheckout = (world) => createResearchMembershipCheckout({
  config: checkoutConfig,
  user,
  billingInterval: 'monthly',
  idempotencyKey: 'research-checkout-p1-0001',
  fetchImpl: world.fetchImpl,
  now: new Date('2026-11-05T19:00:00.000Z'),
});

{
  const world = checkoutWorld();
  const result = await runCheckout(world);
  eq(world.log, ['profile', 'subscriptions', 'entitlements', 'attempt', 'provider', 'attach'], 'K1 custody order');
  eq(world.bodies.attempt, { p_account_id: accountId, p_checkout_key: 'research-checkout-p1-0001', p_billing_interval: 'monthly' }, 'K1 attempt uses the signed checkout key');
  eq(world.bodies.attach, {
    p_attempt_id: attemptId,
    p_account_id: accountId,
    p_provider_checkout_id: 'checkout_p1',
    p_provider_expires_at: '2026-11-05T19:30:00.000Z',
  }, 'K1 attach binds merchant checkout id and expiry');
  ok(result.url.startsWith('https://') && result.checkoutId === 'checkout_p1', 'K1 URL returned only after attach');
}
for (const [label, attempt, code] of [
  ['K2 attempt refused (42501 -> 403)', () => json(403, { code: '42501' }), 'RESEARCH_CHECKOUT_ATTEMPT_REFUSED'],
  ['K3 attempt database error', () => json(500, { message: 'down' }), 'RESEARCH_CHECKOUT_ATTEMPT_FAILED'],
  ['K4 attempt network failure', () => { throw new Error('network'); }, 'RESEARCH_CHECKOUT_ATTEMPT_FAILED'],
  ['K5 attempt malformed id', () => json(200, 'not-a-uuid'), 'RESEARCH_CHECKOUT_ATTEMPT_FAILED'],
]) {
  const world = checkoutWorld({ attempt });
  await assert.rejects(() => runCheckout(world), { code }, label);
  ok(!world.log.includes('provider'), `${label}: no merchant checkout created`);
}
for (const [label, attach, code] of [
  ['K6 attach refused (profile no longer active)', () => json(200, false), 'RESEARCH_CHECKOUT_ATTACH_REFUSED'],
  ['K7 attach database error', () => json(500, {}), 'RESEARCH_CHECKOUT_ATTACH_FAILED'],
  ['K8 attach network failure', () => { throw new Error('network'); }, 'RESEARCH_CHECKOUT_ATTACH_FAILED'],
  ['K9 attach malformed result', () => json(200, 'true'), 'RESEARCH_CHECKOUT_ATTACH_FAILED'],
]) {
  const world = checkoutWorld({ attach });
  let returned = null;
  await assert.rejects(async () => { returned = await runCheckout(world); }, { code }, label);
  ok(returned === null && world.log.at(-1) === 'attach', `${label}: no URL leaves the server`);
}
{
  const world = checkoutWorld({ provider: () => json(500, {}) });
  await assert.rejects(() => runCheckout(world), { code: 'RESEARCH_CHECKOUT_PROVIDER_FAILED' }, 'K10');
  ok(!world.log.includes('attach'), 'K10 provider failure: nothing attached, attempt keeps hold window');
}

// ---------------------------------------------------------------- webhook quarantine
function signedCreated() {
  const value = {
    meta: {
      event_name: 'subscription_created',
      custom_data: {
        usd_impact_account_id: accountId,
        usd_impact_research_product_id: 'research-membership',
        usd_impact_research_billing_interval: 'monthly',
        usd_impact_research_checkout_key: 'research-checkout-p1-0001',
      },
    },
    data: {
      type: 'subscriptions',
      id: 'sub_p1_unbound',
      attributes: {
        store_id: 42, customer_id: 456, product_id: 99, variant_id: 314, status: 'active', cancelled: false,
        trial_ends_at: null, created_at: '2026-11-05T19:05:00.000Z', renews_at: '2026-12-05T19:05:00.000Z', test_mode: true,
      },
    },
  };
  const rawBody = Buffer.from(JSON.stringify(value));
  const signature = crypto.createHmac('sha256', checkoutEnvironment.LEMON_SQUEEZY_RESEARCH_TEST_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return { rawBody, signature };
}
const notFound = async () => {
  const error = new Error('missing');
  error.code = 'RESEARCH_WEBHOOK_SUBSCRIPTION_NOT_FOUND';
  error.status = 409;
  throw error;
};
async function webhook({ bind, quarantine }) {
  const log = [];
  let quarantineBody = null;
  const fetchImpl = async (url, init = {}) => {
    const href = String(url);
    if (href === `${SUPA}/rest/v1/rpc/bind_research_membership_subscription`) { log.push('bind'); return bind(); }
    if (href === `${SUPA}/rest/v1/rpc/record_research_paid_binding_refusal`) {
      log.push('quarantine'); quarantineBody = JSON.parse(init.body); return quarantine();
    }
    throw new Error(`Unexpected request ${href}`);
  };
  let outcome;
  try {
    outcome = { result: await processResearchMembershipWebhookWithFirstPurchase({
      ...signedCreated(), environment: checkoutEnvironment, fetchImpl, processImpl: notFound,
    }) };
  } catch (error) {
    outcome = { error };
  }
  return { log, quarantineBody, ...outcome };
}
{
  const w = await webhook({ bind: () => json(400, { code: 'P0001', message: 'Research Membership account is not an active profile' }), quarantine: () => json(200, quarantineId) });
  eq(w.log, ['bind', 'quarantine'], 'W1 refused binding is quarantined');
  eq(w.quarantineBody, {
    p_provider: 'lemon-squeezy',
    p_provider_subscription_id: 'sub_p1_unbound',
    p_claimed_account_id: accountId,
    p_checkout_key: 'research-checkout-p1-0001',
    p_reason_code: 'RESEARCH_FIRST_PURCHASE_BINDING_FAILED',
  }, 'W1 quarantine carries signed identifiers only');
  eq(w.error?.code, 'RESEARCH_FIRST_PURCHASE_BINDING_FAILED', 'W1 original refusal still surfaced (provider will see a non-2xx)');
}
{
  const w = await webhook({ bind: () => json(400, {}), quarantine: () => json(500, {}) });
  eq([w.error?.code, w.error?.status], ['RESEARCH_FIRST_PURCHASE_QUARANTINE_FAILED', 503], 'W2 quarantine write failure is a retryable 503');
}
{
  const w = await webhook({ bind: () => { throw new Error('network'); }, quarantine: () => json(200, quarantineId) });
  ok(w.log.includes('quarantine') && w.error, 'W3 binding transport failure is quarantined conservatively');
}
{
  const w = await webhook({ bind: () => json(400, {}), quarantine: () => json(200, 'garbage') });
  eq(w.error?.code, 'RESEARCH_FIRST_PURCHASE_QUARANTINE_FAILED', 'W4 malformed quarantine result fails closed');
}

// ---------------------------------------------------------------- pre-Auth billing hold
const deletionEnvironment = Object.freeze({
  VERCEL_ENV: 'preview',
  ACCOUNT_DELETION_FINALIZER_ENABLED: 'true',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  SUPABASE_URL: SUPA,
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
  CRON_SECRET: 'abcdefghijklmnopqrstuvwxyz0123456789',
});
const deletionConfig = readAccountDeletionFinalizerConfig(deletionEnvironment);
const profile = { account_id: accountId, email: 'member@invalid.example', status: 'deletion_pending' };

function deletionWorld(readiness, { support = () => json(201), mark = () => json(200, true) } = {}) {
  const log = [];
  const fetchImpl = async (url, init = {}) => {
    const href = String(url);
    if (href === `${SUPA}/rest/v1/rpc/check_research_deletion_billing_readiness`) {
      log.push('readiness');
      eq(JSON.parse(init.body), { p_account_id: accountId }, 'readiness asks for the due account only');
      return readiness();
    }
    if (href.includes('/auth/v1/admin/users/')) { log.push('AUTH_DELETE'); return json(200, { id: accountId }); }
    if (href.endsWith('/rest/v1/rpc/finalize_account_deletion')) { log.push('FINALIZE'); return json(200, []); }
    if (href.endsWith('/rest/v1/support_requests') && init.method === 'POST') {
      log.push('support'); const body = JSON.parse(init.body);
      if (/RESEARCH_DELETION_BILLING_HOLD/.test(body.message)) ok(body.account_id === null && !/sub_|chk_|456/.test(body.message), 'escalation message carries no billing identifiers');
      return support();
    }
    if (href === `${SUPA}/rest/v1/rpc/mark_research_deletion_hold_escalated`) {
      log.push('mark'); ok(/^ui-[0-9a-f]{16}$/.test(JSON.parse(init.body).p_reference), 'opaque escalation reference');
      return mark();
    }
    if (href.includes('/notification_outbox')) { log.push('EMAIL'); return json(500, {}); }
    if (href.includes('/rest/v1/profiles?account_id=')) { log.push('reload'); return json(200, []); }
    throw new Error(`Unexpected request ${init.method || 'GET'} ${href}`);
  };
  return { log, fetchImpl };
}
const finalize = (world) => finalizeOneDueAccount({ profile, config: deletionConfig, environment: deletionEnvironment, fetchImpl: world.fetchImpl });
const IRREVERSIBLE = ['AUTH_DELETE', 'FINALIZE', 'EMAIL'];
const holdCases = [
  ['H1 Research subscription present, first hold', () => json(200, { clear: false, reasons: ['research_subscription_present'], escalate: true }), ['readiness', 'support', 'mark'], true],
  ['H2 hold re-check, escalation already claimed', () => json(200, { clear: false, reasons: ['research_subscription_present'], escalate: false }), ['readiness'], true],
  ['H3 open checkout window', () => json(200, { clear: false, reasons: ['research_checkout_window_open'], escalate: false }), ['readiness'], true],
  ['H4 paid-binding quarantine', () => json(200, { clear: false, reasons: ['research_paid_binding_quarantined'], escalate: true }), ['readiness', 'support', 'mark'], true],
  ['H5 readiness RPC 500', () => json(500, {}), ['readiness'], false],
  ['H6 readiness RPC 404 (migration not deployed)', () => json(404, {}), ['readiness'], false],
  ['H7 readiness network failure', () => { throw new Error('network'); }, ['readiness'], false],
  ['H8 malformed JSON', () => new Response('{', { status: 200 }), ['readiness'], false],
  ['H9 clear as string', () => json(200, { clear: 'true', reasons: [] }), ['readiness'], false],
  ['H10 clear with reasons (inconsistent)', () => json(200, { clear: true, reasons: ['x'] }), ['readiness'], true],
  ['H11 empty body', () => json(200), ['readiness'], false],
];
for (const [label, readiness, expectedLog, durable] of holdCases) {
  const world = deletionWorld(readiness);
  const result = await finalize(world);
  eq(result.status, 'billing_hold', `${label}: held`);
  eq(world.log, expectedLog, `${label}: call sequence`);
  ok(!IRREVERSIBLE.some((step) => world.log.includes(step)), `${label}: zero Auth deletions, finalizations or completion emails`);
  eq(result.durable, durable, `${label}: durability reported`);
}
{
  const world = deletionWorld(() => json(200, { clear: false, reasons: ['research_subscription_present'], escalate: true }), { support: () => json(500, {}) });
  const result = await finalize(world);
  ok(result.status === 'billing_hold' && result.escalated === false && !world.log.includes('AUTH_DELETE') && !world.log.includes('mark'), 'H12 escalation failure still withholds Auth deletion; claim left to expire for retry');
}
{
  const world = deletionWorld(() => json(200, { clear: false, reasons: ['research_subscription_present'], escalate: true }), { mark: () => json(500, {}) });
  const result = await finalize(world);
  ok(result.status === 'billing_hold' && !world.log.includes('AUTH_DELETE'), 'H13 mark failure still withholds Auth deletion');
}
{
  const world = deletionWorld(() => json(200, { clear: true, reasons: [], escalate: false }));
  await finalize(world).catch(() => null);
  eq(world.log.slice(0, 3), ['readiness', 'AUTH_DELETE', 'FINALIZE'], 'H14 clear readiness: billing check precedes the irreversible Auth step');
}
{
  const log = [];
  const fetchImpl = async (url, init = {}) => {
    const href = String(url);
    if (href.includes('/rest/v1/support_requests?category=eq.privacy')) return json(200, []);
    if (href.includes('/rest/v1/profiles?status=eq.deletion_pending')) return json(200, [profile, { ...profile, account_id: '55555555-5555-4555-8555-555555555555' }]);
    if (href.endsWith('/rpc/check_research_deletion_billing_readiness')) {
      log.push('readiness');
      return json(200, { clear: false, reasons: ['research_entitlement_present'], escalate: false });
    }
    throw new Error(`Unexpected request ${init.method || 'GET'} ${href}`);
  };
  const result = await runDueAccountDeletionFinalizer({ environment: deletionEnvironment, fetchImpl, batchSize: 5 });
  eq([result.scanned, result.billingHeld, result.finalized, result.failed], [2, 2, 0, 0], 'H15 run summary counts holds separately and does not fail the cron');
}

console.log(`Research P1 billing-safe custody regressions passed (${checks} checks).`);
