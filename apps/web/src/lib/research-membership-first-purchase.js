import { verifyLemonSqueezyWebhookSignature } from './lemon-squeezy-adapter-scaffold.js';
import { processResearchMembershipWebhook } from './research-membership-webhook-handler.js';
import { readSupabaseServerConfig } from './supabase-server.js';

const DEVELOPMENT_PROJECT_REF = 'ycstrcvshdluovtuasjc';
const PRODUCTION_PROJECT_REF = 'gjzetjugmnwanvjkchux';
const PRODUCT_ID = 'research-membership';
const PROVIDER = 'lemon-squeezy';
const PROVIDER_API_ROOT = 'https://api.lemonsqueezy.com/v1';
const MAX_BODY_BYTES = 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STABLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,254}$/;
const CHECKOUT_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,254}$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export class ResearchMembershipFirstPurchaseError extends Error {
  constructor(message, code = 'RESEARCH_FIRST_PURCHASE_REJECTED', status = 400) {
    super(message);
    this.name = 'ResearchMembershipFirstPurchaseError';
    this.code = code;
    this.status = status;
  }
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function enabled(value) {
  return text(String(value ?? '')).toLowerCase() === 'true';
}

function fail(message, code, status = 400) {
  throw new ResearchMembershipFirstPurchaseError(message, code, status);
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    fail(`${name} is invalid.`, 'RESEARCH_FIRST_PURCHASE_CONFIGURATION_INVALID', 503);
  }
  return parsed;
}

function stableIdentifier(value, name) {
  const normalized = text(String(value ?? ''));
  if (!STABLE_ID_PATTERN.test(normalized)) fail(`${name} is invalid.`, 'RESEARCH_FIRST_PURCHASE_IDENTIFIER_INVALID');
  return normalized;
}

function checkoutKey(value) {
  const normalized = text(String(value ?? ''));
  if (!CHECKOUT_KEY_PATTERN.test(normalized)) {
    fail('A valid Research Membership checkout idempotency key is required.', 'RESEARCH_CHECKOUT_IDEMPOTENCY_KEY_INVALID');
  }
  return normalized;
}

function accountId(value) {
  const normalized = text(String(value ?? ''));
  if (!UUID_PATTERN.test(normalized)) fail('Research Membership account id is invalid.', 'RESEARCH_FIRST_PURCHASE_ACCOUNT_INVALID');
  return normalized;
}

function emailAddress(value, name = 'email') {
  const normalized = text(String(value ?? '')).toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) fail(`${name} is invalid.`, 'RESEARCH_FIRST_PURCHASE_CONFIGURATION_INVALID', 503);
  return normalized;
}

function isoTimestamp(value, name) {
  const normalized = text(value);
  if (!normalized || Number.isNaN(Date.parse(normalized))) {
    fail(`${name} is invalid.`, 'RESEARCH_FIRST_PURCHASE_PAYLOAD_INVALID');
  }
  return new Date(normalized).toISOString();
}

function projectRef(value) {
  try {
    return new URL(value).hostname.split('.')[0] || '';
  } catch {
    return '';
  }
}

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${name} must be an object.`, 'RESEARCH_FIRST_PURCHASE_PAYLOAD_INVALID');
  }
  return value;
}

function rawBuffer(rawBody) {
  const body = Buffer.isBuffer(rawBody)
    ? rawBody
    : typeof rawBody === 'string'
      ? Buffer.from(rawBody, 'utf8')
      : null;
  if (!body) fail('Research Membership webhook body must be raw bytes.', 'RESEARCH_FIRST_PURCHASE_PAYLOAD_INVALID');
  if (body.length > MAX_BODY_BYTES) fail('Research Membership webhook body is too large.', 'REQUEST_BODY_TOO_LARGE', 413);
  return body;
}

function researchCatalog(environment = process.env, { forCheckout = false } = {}) {
  const vercelEnvironment = text(environment.VERCEL_ENV).toLowerCase();
  if (!enabled(environment.RESEARCH_MEMBERSHIP_WEBHOOK_ENABLED)) {
    fail('Research Membership webhook execution is disabled.', 'RESEARCH_WEBHOOK_DISABLED', 503);
  }

  let prefix;
  let testMode;
  let controlledQaOnly;
  if (vercelEnvironment === 'preview') {
    if (!enabled(environment.LEMON_SQUEEZY_RESEARCH_TEST_MODE)) {
      fail('Research Membership first-purchase execution requires Lemon Squeezy Test Mode.', 'RESEARCH_FIRST_PURCHASE_TEST_MODE_REQUIRED', 503);
    }
    if (projectRef(environment.SUPABASE_URL) !== DEVELOPMENT_PROJECT_REF) {
      fail('Research Membership first-purchase execution must target canonical Development Supabase.', 'RESEARCH_FIRST_PURCHASE_DATABASE_MISMATCH', 503);
    }
    prefix = 'LEMON_SQUEEZY_RESEARCH_TEST';
    testMode = true;
    controlledQaOnly = true;
  } else if (vercelEnvironment === 'production') {
    if (!enabled(environment.RESEARCH_MEMBERSHIP_PRODUCTION_ACTIVATION_APPROVED)) {
      fail('Research Membership Production activation is not approved.', 'RESEARCH_FIRST_PURCHASE_PRODUCTION_NOT_APPROVED', 503);
    }
    if (projectRef(environment.SUPABASE_URL) !== PRODUCTION_PROJECT_REF) {
      fail('Research Membership first-purchase execution must target canonical Production Supabase.', 'RESEARCH_FIRST_PURCHASE_DATABASE_MISMATCH', 503);
    }
    if (enabled(environment.LEMON_SQUEEZY_RESEARCH_PRODUCTION_TEST_MODE)) {
      fail('Research Membership Production first-purchase execution must reject Lemon Squeezy Test Mode.', 'RESEARCH_FIRST_PURCHASE_PRODUCTION_TEST_MODE_REJECTED', 503);
    }
    if (forCheckout && !enabled(environment.RESEARCH_MEMBERSHIP_PRODUCTION_CHECKOUT_ENABLED)) {
      fail('Research Membership Production checkout is disabled.', 'RESEARCH_CHECKOUT_DISABLED', 503);
    }
    prefix = 'LEMON_SQUEEZY_RESEARCH_PRODUCTION';
    testMode = false;
    controlledQaOnly = false;
  } else {
    fail(
      'Research Membership first-purchase execution is limited to Vercel Preview or Production.',
      'RESEARCH_FIRST_PURCHASE_ENVIRONMENT_REJECTED',
      403,
    );
  }

  const monthlyVariantId = positiveInteger(environment[`${prefix}_MONTHLY_VARIANT_ID`], 'Research monthly variant');
  const annualVariantId = positiveInteger(environment[`${prefix}_ANNUAL_VARIANT_ID`], 'Research annual variant');
  if (monthlyVariantId === annualVariantId) {
    fail('Research Membership recurring variants must be distinct.', 'RESEARCH_FIRST_PURCHASE_CONFIGURATION_INVALID', 503);
  }

  return Object.freeze({
    vercelEnvironment,
    testMode,
    controlledQaOnly,
    storeId: positiveInteger(environment[`${prefix}_STORE_ID`], 'Research store'),
    productId: positiveInteger(environment[`${prefix}_PRODUCT_ID`], 'Research product'),
    monthlyVariantId,
    annualVariantId,
    supabaseUrl: new URL(environment.SUPABASE_URL).origin,
    supabaseSecret: text(environment.SUPABASE_SECRET_KEY),
  });
}

export function readResearchMembershipCheckoutConfig(environment = process.env) {
  const catalog = researchCatalog(environment, { forCheckout: true });
  let supabase;
  try {
    supabase = readSupabaseServerConfig(environment, { requireSecret: true });
  } catch {
    fail('Research Membership checkout database configuration is invalid.', 'RESEARCH_CHECKOUT_CONFIGURATION_INVALID', 503);
  }
  const apiKey = text(catalog.testMode
    ? environment.LEMON_SQUEEZY_TEST_API_KEY
    : environment.LEMON_SQUEEZY_RESEARCH_PRODUCTION_API_KEY);
  if (apiKey.length < 16) fail('Research Membership checkout API key is invalid.', 'RESEARCH_CHECKOUT_CONFIGURATION_INVALID', 503);
  const qaEmail = catalog.controlledQaOnly
    ? emailAddress(environment.COMMERCE_SANDBOX_QA_EMAIL, 'COMMERCE_SANDBOX_QA_EMAIL')
    : null;
  return Object.freeze({ ...catalog, supabase, apiKey, qaEmail });
}

function variantForInterval(config, billingInterval) {
  const interval = text(billingInterval).toLowerCase();
  if (interval === 'monthly') return Object.freeze({ interval, variantId: config.monthlyVariantId });
  if (interval === 'annual') return Object.freeze({ interval, variantId: config.annualVariantId });
  fail('Research Membership billing interval must be monthly or annual.', 'RESEARCH_CHECKOUT_INTERVAL_INVALID');
}

export function buildResearchMembershipCheckoutRequest({
  config,
  user,
  billingInterval,
  idempotencyKey,
  now = new Date(),
}) {
  if (!config || typeof config.testMode !== 'boolean') {
    fail('Research Membership checkout requires an explicit environment configuration.', 'RESEARCH_CHECKOUT_CONFIGURATION_INVALID', 503);
  }
  const userId = accountId(user?.id);
  const userEmail = emailAddress(user?.email, 'Authenticated account email');
  if (config.controlledQaOnly && userEmail !== config.qaEmail) {
    fail('Research Membership Test checkout is restricted to the configured QA account.', 'RESEARCH_CHECKOUT_QA_ACCOUNT_REQUIRED', 403);
  }
  const selected = variantForInterval(config, billingInterval);
  const key = checkoutKey(idempotencyKey);
  const expiresAt = new Date(new Date(now).getTime() + 30 * 60 * 1000).toISOString();

  return Object.freeze({
    data: {
      type: 'checkouts',
      attributes: {
        product_options: {
          enabled_variants: [selected.variantId],
          receipt_button_text: 'Open USD Impact',
          receipt_link_url: 'https://www.usd-impact.com/account/',
          receipt_thank_you_note: 'Research access is linked to the authenticated USD Impact account used before checkout.',
        },
        checkout_options: {
          discount: false,
          skip_trial: true,
          subscription_preview: true,
          locale: 'en',
        },
        checkout_data: {
          email: userEmail,
          custom: {
            usd_impact_account_id: userId,
            usd_impact_research_product_id: PRODUCT_ID,
            usd_impact_research_billing_interval: selected.interval,
            usd_impact_research_checkout_key: key,
          },
          variant_quantities: [{ variant_id: selected.variantId, quantity: 1 }],
        },
        expires_at: expiresAt,
        test_mode: config.testMode,
      },
      relationships: {
        store: { data: { type: 'stores', id: String(config.storeId) } },
        variant: { data: { type: 'variants', id: String(selected.variantId) } },
      },
    },
  });
}

async function readJson(response) {
  const raw = await response.text();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function serviceHeaders(secretKey) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
  };
}

// Checkout eligibility is separate from authentication: a valid session can remain
// usable after an account has requested deletion. This read-only guard blocks the
// ordinary non-active path before we ask the merchant to issue a payment URL.
// It is NOT a transaction/lock against a deletion requested after this lookup;
// the final secure design must pair an issued checkout intent with lifecycle locks.
async function assertActiveResearchProfile({ config, userId, fetchImpl }) {
  const query = new URLSearchParams({
    select: 'account_id,status,deletion_requested_at,deleted_at',
    account_id: `eq.${userId}`,
    limit: '2',
  });
  let response;
  try {
    response = await fetchImpl(`${config.supabase.url}/rest/v1/profiles?${query}`, {
      headers: serviceHeaders(config.supabase.secretKey),
    });
  } catch {
    fail('Research Membership account eligibility lookup failed.', 'RESEARCH_CHECKOUT_PROFILE_LOOKUP_FAILED', 502);
  }
  let rows;
  try {
    rows = await readJson(response);
  } catch {
    fail('Research Membership account eligibility lookup failed.', 'RESEARCH_CHECKOUT_PROFILE_LOOKUP_FAILED', 502);
  }
  if (!response.ok || !Array.isArray(rows) || rows.length !== 1
    || text(rows[0]?.account_id).toLowerCase() !== userId.toLowerCase()
    || typeof rows[0]?.status !== 'string') {
    fail('Research Membership account eligibility lookup failed.', 'RESEARCH_CHECKOUT_PROFILE_LOOKUP_FAILED', 502);
  }
  if (rows[0].status !== 'active'
    || rows[0].deletion_requested_at != null
    || rows[0].deleted_at != null) {
    fail('Account is not eligible for Research Membership checkout.', 'RESEARCH_CHECKOUT_PROFILE_NOT_ACTIVE', 409);
  }
}

async function assertNoCurrentResearchSubscription({ config, userId, fetchImpl }) {
  const query = new URLSearchParams({
    select: 'id,state',
    account_id: `eq.${userId}`,
    product_id: `eq.${PRODUCT_ID}`,
    state: 'in.(pending,active,past_due,cancel_scheduled)',
    limit: '2',
  });
  const response = await fetchImpl(`${config.supabase.url}/rest/v1/subscriptions?${query}`, {
    headers: serviceHeaders(config.supabase.secretKey),
  });
  const rows = await readJson(response);
  if (!response.ok || !Array.isArray(rows)) {
    fail('Research Membership checkout eligibility lookup failed.', 'RESEARCH_CHECKOUT_DATABASE_LOOKUP_FAILED', 502);
  }
  if (rows.length > 0) {
    fail('A current Research Membership subscription already exists for this account.', 'RESEARCH_CHECKOUT_CURRENT_SUBSCRIPTION_EXISTS', 409);
  }
}

// An existing Research entitlement occupies the unique account/product row,
// even when revoked. Until a separately reviewed relink procedure exists,
// another paid checkout could charge the buyer but fail to activate Research.
// This is a precautionary non-atomic read, not a replacement for paid-intent
// custody and an account-first lifecycle lock.
async function assertNoExistingResearchEntitlement({ config, userId, fetchImpl }) {
  const query = new URLSearchParams({
    select: 'id',
    account_id: `eq.${userId}`,
    product_id: `eq.${PRODUCT_ID}`,
    limit: '2',
  });
  let response;
  try {
    response = await fetchImpl(`${config.supabase.url}/rest/v1/entitlements?${query}`, {
      headers: serviceHeaders(config.supabase.secretKey),
    });
  } catch {
    fail('Research Membership entitlement eligibility lookup failed.', 'RESEARCH_CHECKOUT_ENTITLEMENT_LOOKUP_FAILED', 502);
  }
  let rows;
  try {
    rows = await readJson(response);
  } catch {
    fail('Research Membership entitlement eligibility lookup failed.', 'RESEARCH_CHECKOUT_ENTITLEMENT_LOOKUP_FAILED', 502);
  }
  if (!response.ok || !Array.isArray(rows) || rows.length > 1
    || rows.some((row) => !row || !UUID_PATTERN.test(String(row.id ?? '')))) {
    fail('Research Membership entitlement eligibility lookup failed.', 'RESEARCH_CHECKOUT_ENTITLEMENT_LOOKUP_FAILED', 502);
  }
  if (rows.length !== 0) {
    fail('Existing Research Membership entitlement requires account support before another checkout.',
      'RESEARCH_CHECKOUT_ENTITLEMENT_CONFLICT', 409);
  }
}

// Research P1 checkout custody: a DB-issued attempt is recorded under a
// profile lock BEFORE the merchant call, and the merchant checkout id must be
// attached (profile still active) BEFORE any checkout URL leaves the server.
async function postServiceRpc({ config, name, body, fetchImpl }) {
  let response;
  try {
    response = await fetchImpl(`${config.supabase.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: serviceHeaders(config.supabase.secretKey),
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, payload: null };
  }
  let payload = null;
  try { payload = await readJson(response); } catch { payload = null; }
  return { ok: response.ok, status: response.status, payload };
}

async function createResearchCheckoutAttempt({ config, userId, checkoutKeyValue, interval, fetchImpl }) {
  const result = await postServiceRpc({
    config,
    name: 'create_research_checkout_attempt',
    body: { p_account_id: userId, p_checkout_key: checkoutKeyValue, p_billing_interval: interval },
    fetchImpl,
  });
  if (result.ok && typeof result.payload === 'string' && UUID_PATTERN.test(result.payload)) return result.payload;
  if (result.status >= 400 && result.status < 500) {
    fail('Account is not eligible for Research Membership checkout.', 'RESEARCH_CHECKOUT_ATTEMPT_REFUSED', 409);
  }
  fail('Research Membership checkout custody could not be recorded.', 'RESEARCH_CHECKOUT_ATTEMPT_FAILED', 502);
}

async function attachResearchCheckoutAttempt({ config, userId, attemptId, checkoutId, expiresAt, fetchImpl }) {
  const result = await postServiceRpc({
    config,
    name: 'attach_research_checkout_attempt',
    body: {
      p_attempt_id: attemptId,
      p_account_id: userId,
      p_provider_checkout_id: checkoutId,
      p_provider_expires_at: expiresAt,
    },
    fetchImpl,
  });
  if (result.ok && result.payload === true) return;
  if (result.ok && result.payload === false) {
    fail('Account is not eligible for Research Membership checkout.', 'RESEARCH_CHECKOUT_ATTACH_REFUSED', 409);
  }
  fail('Research Membership checkout custody could not be confirmed.', 'RESEARCH_CHECKOUT_ATTACH_FAILED', 502);
}

export async function createResearchMembershipCheckout({
  config,
  user,
  billingInterval,
  idempotencyKey,
  fetchImpl = fetch,
  now = new Date(),
}) {
  const requestBody = buildResearchMembershipCheckoutRequest({ config, user, billingInterval, idempotencyKey, now });
  const userId = accountId(user?.id);
  await assertActiveResearchProfile({ config, userId, fetchImpl });
  await assertNoCurrentResearchSubscription({ config, userId, fetchImpl });
  await assertNoExistingResearchEntitlement({ config, userId, fetchImpl });
  const checkoutAttributes = requestBody.data.attributes;
  const attemptId = await createResearchCheckoutAttempt({
    config,
    userId,
    checkoutKeyValue: checkoutAttributes.checkout_data.custom.usd_impact_research_checkout_key,
    interval: checkoutAttributes.checkout_data.custom.usd_impact_research_billing_interval,
    fetchImpl,
  });

  const response = await fetchImpl(`${PROVIDER_API_ROOT}/checkouts`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    fail('Research Membership checkout creation failed.', 'RESEARCH_CHECKOUT_PROVIDER_FAILED', 502);
  }
  const data = object(payload?.data, 'checkout response data');
  const attributes = object(data.attributes, 'checkout response attributes');
  const selected = variantForInterval(config, billingInterval);
  if (data.type !== 'checkouts'
      || attributes.test_mode !== config.testMode
      || String(attributes.store_id) !== String(config.storeId)
      || String(attributes.variant_id) !== String(selected.variantId)
      || !text(attributes.url).startsWith('https://')) {
    fail('Research Membership checkout response did not match the trusted catalog.', 'RESEARCH_CHECKOUT_PROVIDER_RESPONSE_INVALID', 502);
  }
  const checkoutId = stableIdentifier(data.id, 'checkout id');
  await attachResearchCheckoutAttempt({
    config,
    userId,
    attemptId,
    checkoutId,
    expiresAt: checkoutAttributes.expires_at,
    fetchImpl,
  });
  return Object.freeze({
    checkoutId,
    url: text(attributes.url),
    testMode: config.testMode,
    billingInterval: selected.interval,
  });
}

function readBootstrapConfig(environment = process.env) {
  const catalog = researchCatalog(environment);
  const secret = text(catalog.testMode
    ? environment.LEMON_SQUEEZY_RESEARCH_TEST_WEBHOOK_SECRET
    : environment.LEMON_SQUEEZY_RESEARCH_PRODUCTION_WEBHOOK_SECRET);
  if (secret.length < 16 || !catalog.supabaseSecret.startsWith('sb_secret_')) {
    fail('Research Membership first-purchase webhook credentials are invalid.', 'RESEARCH_FIRST_PURCHASE_CONFIGURATION_INVALID', 503);
  }
  return Object.freeze({ ...catalog, secret });
}

export function inspectResearchMembershipFirstPurchase({
  rawBody,
  signature,
  environment = process.env,
}) {
  const config = readBootstrapConfig(environment);
  const body = rawBuffer(rawBody);
  if (!verifyLemonSqueezyWebhookSignature({ rawBody: body, signature, secret: config.secret })) {
    fail('Research Membership first-purchase signature is invalid.', 'RESEARCH_WEBHOOK_SIGNATURE_INVALID', 401);
  }
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch {
    fail('Research Membership first-purchase JSON is invalid.', 'RESEARCH_FIRST_PURCHASE_PAYLOAD_INVALID');
  }
  const meta = object(payload?.meta, 'payload.meta');
  const data = object(payload?.data, 'payload.data');
  const attributes = object(data.attributes, 'payload.data.attributes');
  if (text(meta.event_name) !== 'subscription_created' || data.type !== 'subscriptions') {
    fail('Only subscription_created may establish a first Research Membership binding.', 'RESEARCH_FIRST_PURCHASE_EVENT_REQUIRED', 409);
  }
  if (attributes.test_mode !== config.testMode
      || String(attributes.store_id) !== String(config.storeId)
      || String(attributes.product_id) !== String(config.productId)) {
    fail('Research Membership first-purchase catalog or Test Mode evidence does not match.', 'RESEARCH_FIRST_PURCHASE_CATALOG_MISMATCH', 409);
  }

  const variantId = positiveInteger(attributes.variant_id, 'Research first-purchase variant');
  const expectedInterval = variantId === config.monthlyVariantId
    ? 'monthly'
    : variantId === config.annualVariantId
      ? 'annual'
      : null;
  if (!expectedInterval) fail('Research Membership first-purchase variant is not trusted.', 'RESEARCH_FIRST_PURCHASE_VARIANT_MISMATCH', 409);
  if (text(attributes.status).toLowerCase() !== 'active'
      || attributes.cancelled !== false
      || attributes.trial_ends_at != null) {
    fail('Research Membership first-purchase subscription state is inconsistent with the no-trial contract.', 'RESEARCH_FIRST_PURCHASE_STATE_INVALID', 409);
  }

  const custom = object(meta.custom_data, 'payload.meta.custom_data');
  const boundAccountId = accountId(custom.usd_impact_account_id);
  if (text(custom.usd_impact_research_product_id) !== PRODUCT_ID
      || text(custom.usd_impact_research_billing_interval).toLowerCase() !== expectedInterval) {
    fail('Research Membership checkout custom binding evidence does not match.', 'RESEARCH_FIRST_PURCHASE_CUSTOM_DATA_MISMATCH', 409);
  }
  const signedCheckoutKey = checkoutKey(custom.usd_impact_research_checkout_key);
  const createdAt = isoTimestamp(attributes.created_at, 'subscription created_at');
  const renewsAt = isoTimestamp(attributes.renews_at, 'subscription renews_at');
  if (Date.parse(renewsAt) <= Date.parse(createdAt)) {
    fail('Research Membership first-purchase renewal window is invalid.', 'RESEARCH_FIRST_PURCHASE_PERIOD_INVALID', 409);
  }

  return Object.freeze({
    accountId: boundAccountId,
    provider: PROVIDER,
    providerSubscriptionId: stableIdentifier(data.id, 'provider subscription id'),
    providerCustomerId: stableIdentifier(attributes.customer_id, 'provider customer id'),
    providerPriceId: String(variantId),
    billingInterval: expectedInterval,
    occurredAt: createdAt,
    metadata: Object.freeze({
      bindingSource: 'signed-subscription-created',
      checkoutKey: signedCheckoutKey,
      storeId: String(config.storeId),
      productId: String(config.productId),
      variantId: String(variantId),
      testMode: config.testMode,
    }),
  });
}

export async function bindResearchMembershipFirstPurchase({
  binding,
  environment = process.env,
  fetchImpl = fetch,
}) {
  const config = readBootstrapConfig(environment);
  const response = await fetchImpl(`${config.supabaseUrl}/rest/v1/rpc/bind_research_membership_subscription`, {
    method: 'POST',
    headers: serviceHeaders(config.supabaseSecret),
    body: JSON.stringify({
      p_account_id: accountId(binding?.accountId),
      p_provider: PROVIDER,
      p_provider_subscription_id: stableIdentifier(binding?.providerSubscriptionId, 'provider subscription id'),
      p_provider_customer_id: stableIdentifier(binding?.providerCustomerId, 'provider customer id'),
      p_provider_price_id: stableIdentifier(binding?.providerPriceId, 'provider price id'),
      p_billing_interval: variantForInterval(config, binding?.billingInterval).interval,
      p_occurred_at: isoTimestamp(binding?.occurredAt, 'binding occurred_at'),
      p_metadata: binding?.metadata || {},
    }),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    fail('Research Membership first-purchase binding failed.', 'RESEARCH_FIRST_PURCHASE_BINDING_FAILED', response.status >= 400 && response.status <= 599 ? response.status : 502);
  }
  if (!payload || !['created', 'existing'].includes(payload.action) || !UUID_PATTERN.test(text(payload.subscription_id))) {
    fail('Research Membership first-purchase binding returned an invalid result.', 'RESEARCH_FIRST_PURCHASE_BINDING_INVALID', 502);
  }
  return Object.freeze({ ...payload });
}


// Scope an exceptional signed first-purchase delivery to this exact merchant
// store, product, mode and event type BEFORE writing billing custody. This is
// intentionally narrower than a general parser: failed signatures or foreign
// catalog events must never hold an unrelated USD Impact account.
function signedResearchFirstPurchaseExceptionBinding({ rawBody, signature, environment }) {
  const config = readBootstrapConfig(environment);
  let body;
  try { body = rawBuffer(rawBody); } catch { return null; }
  if (!verifyLemonSqueezyWebhookSignature({ rawBody: body, signature, secret: config.secret })) return null;
  let parsed;
  try { parsed = JSON.parse(body.toString('utf8')); } catch { return null; }
  const meta = parsed?.meta;
  const data = parsed?.data;
  const attrs = data?.attributes;
  if (meta?.event_name !== 'subscription_created' || data?.type !== 'subscriptions'
      || !attrs || typeof attrs !== 'object' || Array.isArray(attrs)
      || attrs.test_mode !== config.testMode
      || String(attrs.store_id) !== String(config.storeId)
      || String(attrs.product_id) !== String(config.productId)) return null;
  let providerSubscriptionId;
  try { providerSubscriptionId = stableIdentifier(data.id, 'provider subscription id'); }
  catch { return null; }

  const custom = meta.custom_data && typeof meta.custom_data === 'object'
    && !Array.isArray(meta.custom_data) ? meta.custom_data : {};
  const claimed = text(custom.usd_impact_account_id);
  const rawKey = text(custom.usd_impact_research_checkout_key);
  return Object.freeze({
    accountId: UUID_PATTERN.test(claimed) ? claimed : null,
    providerSubscriptionId,
    metadata: Object.freeze({
      checkoutKey: CHECKOUT_KEY_PATTERN.test(rawKey) ? rawKey : null,
    }),
  });
}

export async function processResearchMembershipWebhookWithFirstPurchase({
  rawBody,
  signature,
  environment = process.env,
  fetchImpl = fetch,
  processImpl = processResearchMembershipWebhook,
}) {
  try {
    return await processImpl({ rawBody, signature, environment, fetchImpl });
  } catch (error) {
    if (error?.code !== 'RESEARCH_WEBHOOK_SUBSCRIPTION_NOT_FOUND') throw error;
  }

  let binding;
  try {
    binding = inspectResearchMembershipFirstPurchase({ rawBody, signature, environment });
  } catch (error) {
    const exceptionBinding = signedResearchFirstPurchaseExceptionBinding({
      rawBody, signature, environment,
    });
    if (exceptionBinding) {
      // A genuine subscription in the trusted Research catalog can still be
      // financially live when account/custom data or first-purchase state is
      // invalid. Persist minimal custody even if the account claim is absent.
      await recordResearchPaidBindingRefusal({
        binding: exceptionBinding, error, environment, fetchImpl,
      });
    }
    throw error;
  }
  try {
    await bindResearchMembershipFirstPurchase({ binding, environment, fetchImpl });
  } catch (error) {
    // Research P1 paid-but-unbound quarantine: the delivery is signed and
    // catalog-verified, so a refused binding means a merchant subscription may
    // be billing with no local subscription row. Record it durably (keeps the
    // claimed account's deletion on hold) before surfacing the refusal.
    await recordResearchPaidBindingRefusal({ binding, error, environment, fetchImpl });
    throw error;
  }
  return processImpl({ rawBody, signature, environment, fetchImpl });
}

export async function recordResearchPaidBindingRefusal({ binding, error, environment = process.env, fetchImpl = fetch }) {
  const config = readBootstrapConfig(environment);
  const reason = /^[A-Z0-9_]{1,80}$/.test(text(error?.code)) ? text(error.code) : 'RESEARCH_FIRST_PURCHASE_BINDING_FAILED';
  let response;
  try {
    response = await fetchImpl(`${config.supabaseUrl}/rest/v1/rpc/record_research_paid_binding_refusal`, {
      method: 'POST',
      headers: serviceHeaders(config.supabaseSecret),
      body: JSON.stringify({
        p_provider: PROVIDER,
        p_provider_subscription_id: stableIdentifier(binding?.providerSubscriptionId, 'provider subscription id'),
        p_claimed_account_id: binding?.accountId == null ? null : accountId(binding.accountId),
        p_checkout_key: text(binding?.metadata?.checkoutKey) || null,
        p_reason_code: reason,
      }),
    });
  } catch {
    response = null;
  }
  const payload = response ? await readJson(response).catch(() => null) : null;
  if (!response?.ok || !UUID_PATTERN.test(text(payload))) {
    fail('Research Membership refused binding could not be quarantined.', 'RESEARCH_FIRST_PURCHASE_QUARANTINE_FAILED', 503);
  }
  return payload;
}

export function publicResearchMembershipFirstPurchaseError(error) {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? error.status : 400;
  return Object.freeze({
    status,
    payload: Object.freeze({
      error: status >= 500 ? 'Research Membership checkout is unavailable.' : 'Research Membership checkout was rejected.',
      code: text(error?.code) || 'RESEARCH_FIRST_PURCHASE_REJECTED',
    }),
  });
}
