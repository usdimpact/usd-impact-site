import { createHash } from 'node:crypto';
import {
  fingerprintResearchReceiptBusinessEvent,
  RESEARCH_RECEIPT_FINGERPRINT_VERSION,
} from './research-membership-receipt-business-fingerprint.js';
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
// Only the separately committed private database issuer may generate an intent
// proof. A correctly formatted client key is NEVER sufficient for binding.
const ISSUED_CHECKOUT_PROOF_PATTERN = /^[A-Za-z0-9_-]{43}$/;
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

function issuedCheckoutProof(value) {
  const normalized = text(value);
  if (!ISSUED_CHECKOUT_PROOF_PATTERN.test(normalized)) {
    fail('Research Membership checkout intent proof is invalid.', 'RESEARCH_CHECKOUT_INTENT_PROOF_INVALID', 409);
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
  expiresAt = null,
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
  const checkoutExpiresAt = expiresAt == null
    ? new Date(new Date(now).getTime() + 30 * 60 * 1000).toISOString()
    : isoTimestamp(expiresAt, 'checkout expires_at');

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
        expires_at: checkoutExpiresAt,
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

async function issueResearchMembershipCheckoutIntent({
  config, userId, variantId, billingInterval, clientRequestKey, fetchImpl, now,
}) {
  // This RPC is intentionally NOT present in the current database. Until the
  // D2-reviewed issuer is installed, no provider checkout may be created.
  const url = `${config.supabase.url}/rest/v1/rpc/issue_research_membership_checkout_intent`;
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: serviceHeaders(config.supabase.secretKey),
      body: JSON.stringify({
        p_account_id: userId,
        p_product_id: PRODUCT_ID,
        p_store_id: String(config.storeId),
        p_variant_id: String(variantId),
        p_billing_interval: billingInterval,
        p_test_mode: config.testMode,
        p_client_request_id: checkoutKey(clientRequestKey),
      }),
    });
  } catch {
    fail('Research Membership trusted checkout issuer is unavailable.', 'RESEARCH_CHECKOUT_INTENT_UNAVAILABLE', 503);
  }
  let data;
  try {
    data = await readJson(response);
  } catch {
    fail('Research Membership trusted checkout issuer is unavailable.', 'RESEARCH_CHECKOUT_INTENT_UNAVAILABLE', 503);
  }
  if (!response.ok) {
    fail('Research Membership trusted checkout issuer is unavailable.', 'RESEARCH_CHECKOUT_INTENT_UNAVAILABLE', 503);
  }
  if (!data || data.action !== 'reserved'
      || !UUID_PATTERN.test(text(data.intent_id))
      || !ISSUED_CHECKOUT_PROOF_PATTERN.test(text(data.checkout_key))
      || text(data.account_id).toLowerCase() !== userId.toLowerCase()
      || String(data.store_id) !== String(config.storeId)
      || String(data.variant_id) !== String(variantId)
      || data.test_mode !== config.testMode
      || text(data.billing_interval) !== billingInterval) {
    fail('Research Membership trusted checkout intent did not match the account and catalog.',
      'RESEARCH_CHECKOUT_INTENT_MISMATCH', 503);
  }
  let expiresAt;
  try {
    expiresAt = isoTimestamp(data.expires_at, 'checkout intent expires_at');
  } catch {
    fail('Research Membership checkout reservation expiry is invalid.',
      'RESEARCH_CHECKOUT_INTENT_EXPIRY_INVALID', 503);
  }
  const lifetime = Date.parse(expiresAt) - new Date(now).getTime();
  if (!Number.isFinite(lifetime) || lifetime <= 0 || lifetime > 30 * 60 * 1000) {
    fail('Research Membership checkout reservation expiry is invalid.',
      'RESEARCH_CHECKOUT_INTENT_EXPIRY_INVALID', 503);
  }
  return Object.freeze({
    id: text(data.intent_id),
    checkoutKey: issuedCheckoutProof(data.checkout_key),
    expiresAt,
  });
}

async function attachResearchMembershipCheckoutReference({ config, intent, checkoutId, fetchImpl }) {
  // Do not disclose a provider checkout URL until the reference is durably
  // attached to the previously committed account-bound checkout intent.
  const url = `${config.supabase.url}/rest/v1/rpc/attach_research_membership_checkout_intent`;
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: serviceHeaders(config.supabase.secretKey),
      body: JSON.stringify({
        p_intent_id: intent.id,
        p_checkout_proof: intent.checkoutKey,
        p_provider_checkout_id: checkoutId,
      }),
    });
  } catch {
    fail('Research Membership checkout reference could not be stored.', 'RESEARCH_CHECKOUT_INTENT_ATTACH_FAILED', 503);
  }
  let data;
  try {
    data = await readJson(response);
  } catch {
    fail('Research Membership checkout reference could not be stored.',
      'RESEARCH_CHECKOUT_INTENT_ATTACH_FAILED', 503);
  }
  if (!response.ok || data?.action !== 'attached'
      || text(data.intent_id) !== intent.id
      || text(data.provider_checkout_id) !== checkoutId) {
    fail('Research Membership checkout reference could not be stored.', 'RESEARCH_CHECKOUT_INTENT_ATTACH_FAILED', 503);
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
  const userId = accountId(user?.id);
  const selected = variantForInterval(config, billingInterval);
  // The public request key is only a replay hint; never send it to the provider
  // as the authoritative account-binding proof.
  await assertNoCurrentResearchSubscription({ config, userId, fetchImpl });
  const intent = await issueResearchMembershipCheckoutIntent({
    config, userId, variantId: selected.variantId, billingInterval: selected.interval,
    clientRequestKey: idempotencyKey, fetchImpl, now,
  });
  const requestBody = buildResearchMembershipCheckoutRequest({
    config, user, billingInterval, idempotencyKey: intent.checkoutKey, now,
    expiresAt: intent.expiresAt,
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
  if (data.type !== 'checkouts'
      || attributes.test_mode !== config.testMode
      || String(attributes.store_id) !== String(config.storeId)
      || String(attributes.variant_id) !== String(selected.variantId)
      || !text(attributes.url).startsWith('https://')) {
    fail('Research Membership checkout response did not match the trusted catalog.', 'RESEARCH_CHECKOUT_PROVIDER_RESPONSE_INVALID', 502);
  }
  const checkoutId = stableIdentifier(data.id, 'checkout id');
  await attachResearchMembershipCheckoutReference({
    config, intent, checkoutId, fetchImpl,
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
  allowUnbound = false,
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
  if (!expectedInterval && !allowUnbound) fail('Research Membership first-purchase variant is not trusted.', 'RESEARCH_FIRST_PURCHASE_VARIANT_MISMATCH', 409);
  if (text(attributes.status).toLowerCase() !== 'active'
      || attributes.cancelled !== false
      || attributes.trial_ends_at != null) {
    fail('Research Membership first-purchase subscription state is inconsistent with the no-trial contract.', 'RESEARCH_FIRST_PURCHASE_STATE_INVALID', 409);
  }

  // A signed active provider subscription can have missing, malformed or
  // purchaser-supplied custom_data (direct Share checkout). On the custody
  // path it must remain observable but NEVER become an account binding.
  const custom = meta.custom_data && typeof meta.custom_data === 'object'
      && !Array.isArray(meta.custom_data)
    ? meta.custom_data : {};
  const metadataMatches = text(custom.usd_impact_research_product_id) === PRODUCT_ID
    && text(custom.usd_impact_research_billing_interval).toLowerCase() === expectedInterval;
  const accountLooksValid = UUID_PATTERN.test(text(custom.usd_impact_account_id));
  const proofLooksValid = ISSUED_CHECKOUT_PROOF_PATTERN.test(text(custom.usd_impact_research_checkout_key));
  let boundAccountId = null;
  let signedCheckoutKey = null;
  if (allowUnbound) {
    if (metadataMatches && accountLooksValid && proofLooksValid) {
      boundAccountId = accountId(custom.usd_impact_account_id);
      signedCheckoutKey = issuedCheckoutProof(custom.usd_impact_research_checkout_key);
    }
  } else {
    boundAccountId = accountId(custom.usd_impact_account_id);
    if (!metadataMatches) {
      fail('Research Membership checkout custom binding evidence does not match.',
        'RESEARCH_FIRST_PURCHASE_CUSTOM_DATA_MISMATCH', 409);
    }
    signedCheckoutKey = issuedCheckoutProof(custom.usd_impact_research_checkout_key);
  }
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
      bindingSource: boundAccountId ? 'signed-subscription-created-unverified-claim' : 'signed-provider-unbound-pending-recovery',
      checkoutKey: signedCheckoutKey,
      catalogQuarantined: !expectedInterval,
      rawBodySha256: createHash('sha256').update(body).digest('hex'),
      businessFingerprintSha256: fingerprintResearchReceiptBusinessEvent(payload),
      businessFingerprintVersion: RESEARCH_RECEIPT_FINGERPRINT_VERSION,
      storeId: String(config.storeId),
      productId: String(config.productId),
      variantId: String(variantId),
      testMode: config.testMode,
    }),
  });
}

async function observeSignedResearchMembershipFirstPurchase({
  binding,
  rawBody,
  environment = process.env,
  fetchImpl = fetch,
}) {
  // The caller must have already verified the raw provider signature and exact
  // Live/Test catalog in inspectResearchMembershipFirstPurchase(allowUnbound).
  // The SQL writer independently commits this paid-event evidence BEFORE
  // attempting the separate, potentially failing binding transaction.
  const config = readBootstrapConfig(environment);
  const rawDigest = createHash('sha256').update(rawBuffer(rawBody)).digest('hex');
  const proofDigest = binding?.metadata?.checkoutKey
    ? createHash('sha256').update(issuedCheckoutProof(binding.metadata.checkoutKey)).digest('hex')
    : null;
  const url = `${config.supabaseUrl}/rest/v1/rpc/observe_signed_research_subscription_created`;
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: serviceHeaders(config.supabaseSecret),
      body: JSON.stringify({
        p_provider: PROVIDER,
        p_provider_subscription_id: stableIdentifier(binding?.providerSubscriptionId, 'provider subscription id'),
        p_provider_customer_id: stableIdentifier(binding?.providerCustomerId, 'provider customer id'),
        p_store_id: String(config.storeId),
        p_product_id: PRODUCT_ID,
        p_provider_price_id: stableIdentifier(binding?.providerPriceId, 'provider price id'),
        p_test_mode: config.testMode,
        p_occurred_at: isoTimestamp(binding?.occurredAt, 'occurred_at'),
        p_raw_body_sha256: rawDigest,
        p_claimed_account_id: binding?.accountId || null,
        p_claimed_checkout_proof_sha256: proofDigest,
        p_business_fingerprint_version: binding.metadata.businessFingerprintVersion,
        p_business_fingerprint_sha256: binding.metadata.businessFingerprintSha256,
      }),
    });
  } catch (error) {
    if (error instanceof ResearchMembershipFirstPurchaseError) throw error;
    fail('Research Membership signed-paid evidence is unavailable.',
      'RESEARCH_PAID_EVIDENCE_UNAVAILABLE', 503);
  }
  let data;
  try {
    data = await readJson(response);
  } catch {
    fail('Research Membership signed-paid evidence is unavailable.',
      'RESEARCH_PAID_EVIDENCE_UNAVAILABLE', 503);
  }
  if (!response.ok
      || !['recorded', 'already_recorded', 'conflict_recorded'].includes(data?.action)
      || text(data.provider_subscription_id) !== binding?.providerSubscriptionId
      || text(data.raw_body_sha256) !== rawDigest) {
    fail('Research Membership signed-paid evidence is unavailable.',
      'RESEARCH_PAID_EVIDENCE_UNAVAILABLE', 503);
  }
  // An unknown signed variant may be ACKed only after the committed SQL
  // explicitly confirms evidence-only quarantine; it cannot bind/grant.
  if (binding?.metadata?.catalogQuarantined && data.catalog_quarantined !== true) {
    fail('Research Membership catalog quarantine custody is unavailable.',
      'RESEARCH_PAID_EVIDENCE_UNAVAILABLE', 503);
  }
  return Object.freeze({ action: data.action, catalogQuarantined: data.catalog_quarantined === true });
}

export async function bindResearchMembershipFirstPurchase({
  binding,
  environment = process.env,
  fetchImpl = fetch,
}) {
  const config = readBootstrapConfig(environment);
  // Do not call the old bind_research_membership_subscription RPC: it checks
  // profile/subscription constraints but does not prove checkout issuance.
  // The replacement must consume a trusted intent AND bind atomically under
  // the DB writer's D2-approved privileges; until deployed, fail closed.
  let response;
  try {
    response = await fetchImpl(`${config.supabaseUrl}/rest/v1/rpc/bind_research_membership_with_checkout_intent`, {
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
      p_checkout_proof: issuedCheckoutProof(binding?.metadata?.checkoutKey),
      // Join the exact separately committed provider-signed observation,
      // not merely an account/variant or provider subscription identifier.
      p_raw_body_sha256: /^[a-f0-9]{64}$/.test(text(binding?.metadata?.rawBodySha256))
        ? text(binding.metadata.rawBodySha256)
        : fail('Research Membership signed observation identity is invalid.',
          'RESEARCH_FIRST_PURCHASE_OBSERVATION_INVALID', 503),
      p_store_id: String(config.storeId),
      p_product_id: PRODUCT_ID,
      p_test_mode: config.testMode,
      p_business_fingerprint_version: binding.metadata.businessFingerprintVersion,
      p_business_fingerprint_sha256: binding.metadata.businessFingerprintSha256,
    }),
    });
  } catch (error) {
    if (error instanceof ResearchMembershipFirstPurchaseError) throw error;
    fail('Research Membership trusted checkout binding is unavailable.',
      'RESEARCH_FIRST_PURCHASE_TRUSTED_BINDING_UNAVAILABLE', 503);
  }
  let payload;
  try {
    payload = await readJson(response);
  } catch {
    fail('Research Membership trusted checkout binding is unavailable.',
      'RESEARCH_FIRST_PURCHASE_TRUSTED_BINDING_UNAVAILABLE', 503);
  }
  if (!response.ok) {
    fail('Research Membership trusted checkout binding is unavailable.',
      'RESEARCH_FIRST_PURCHASE_TRUSTED_BINDING_UNAVAILABLE', 503);
  }
  // Only a *committed* and exact-observation-matched conflict may end the
  // webhook with a held outcome. This prevents repeated attempts from
  // masking a second paid subscription that could not be bound.
  if (payload?.action === 'conflict') {
    const safeCodes = new Set([
      'duplicate_paid_subscription', 'entitlement_conflict',
      'provider_subscription_in_use', 'account_unavailable',
      'unissued_checkout_key', 'expired_checkout_key',
      'checkout_consumed_by_other', 'provider_subscription_account_mismatch',
    ]);
    if (!safeCodes.has(text(payload.code))
        || !UUID_PATTERN.test(text(payload.conflict_evidence_id))
        || text(payload.raw_body_sha256) !== text(binding?.metadata?.rawBodySha256)) {
      fail('Research Membership first-purchase conflict evidence is invalid.',
        'RESEARCH_FIRST_PURCHASE_BINDING_INVALID', 502);
    }
    return Object.freeze({ action: 'conflict', code: text(payload.code) });
  }
  if (!payload || !['created', 'existing'].includes(payload.action)
      || !UUID_PATTERN.test(text(payload.subscription_id))
      || text(payload.raw_body_sha256) !== text(binding?.metadata?.rawBodySha256)) {
    fail('Research Membership first-purchase binding returned an invalid result.',
      'RESEARCH_FIRST_PURCHASE_BINDING_INVALID', 502);
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

  // Record *every* signed active subscription_created paid fact separately,
  // even for a direct provider Share link with no account metadata. The
  // durable observation must commit before any conditional account binding.
  const binding = inspectResearchMembershipFirstPurchase({
    rawBody, signature, environment, allowUnbound: true,
  });
  const observation = await observeSignedResearchMembershipFirstPurchase({
    binding, rawBody, environment, fetchImpl,
  });
  if (observation.action === 'conflict_recorded') {
    return Object.freeze({ action: 'held_paid_evidence_conflict' });
  }
  if (binding.metadata.catalogQuarantined) {
    return Object.freeze({ action: 'held_catalog_quarantine' });
  }
  if (!binding.accountId || !binding.metadata.checkoutKey) {
    return Object.freeze({ action: 'held_unbound' });
  }
  const bound = await bindResearchMembershipFirstPurchase({ binding, environment, fetchImpl });
  if (bound.action === 'conflict') {
    return Object.freeze({ action: 'held_paid_binding_conflict', reason: bound.code });
  }
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
