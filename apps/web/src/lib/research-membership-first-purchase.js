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
  await assertNoCurrentResearchSubscription({ config, userId, fetchImpl });

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
  return Object.freeze({
    checkoutId: stableIdentifier(data.id, 'checkout id'),
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

  const binding = inspectResearchMembershipFirstPurchase({ rawBody, signature, environment });
  await bindResearchMembershipFirstPurchase({ binding, environment, fetchImpl });
  return processImpl({ rawBody, signature, environment, fetchImpl });
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
