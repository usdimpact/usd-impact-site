import { createHash } from 'node:crypto';
import {
  DEFAULT_CURRENCY,
  DEFAULT_LAUNCH_PRICE_CENTS,
  DEFAULT_STANDARD_PRICE_CENTS,
  PAID_PRODUCT_ID,
} from './paid-access.js';
import {
  LEMON_SQUEEZY_PROVIDER,
  buildLemonSqueezyCheckoutRequest,
  normalizeLemonSqueezyOrderEvent,
  verifyLemonSqueezyWebhookSignature,
} from './lemon-squeezy-adapter-scaffold.js';
import { readSupabaseServerConfig } from './supabase-server.js';

const DEVELOPMENT_PROJECT_REF = 'ycstrcvshdluovtuasjc';
const MAX_RECONCILIATION_BATCH = 25;
const PROVIDER_API_ROOT = 'https://api.lemonsqueezy.com/v1';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STABLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,254}$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const REVIEWED_ORDER_STATUSES = new Set([
  'pending',
  'failed',
  'paid',
  'refunded',
  'partial_refund',
  'fraudulent',
]);

export class LemonSqueezyCommerceRuntimeError extends Error {
  constructor(message, code = 'LEMON_SQUEEZY_COMMERCE_RUNTIME_ERROR', status = 500) {
    super(message);
    this.name = 'LemonSqueezyCommerceRuntimeError';
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

function requireText(value, name, minimum = 1, maximum = 4096) {
  const normalized = text(String(value ?? ''));
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new LemonSqueezyCommerceRuntimeError(
      `${name} is missing or invalid.`,
      'COMMERCE_SANDBOX_CONFIGURATION_INVALID',
      503,
    );
  }
  return normalized;
}

function requirePositiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new LemonSqueezyCommerceRuntimeError(
      `${name} is missing or invalid.`,
      'COMMERCE_SANDBOX_CONFIGURATION_INVALID',
      503,
    );
  }
  return parsed;
}

function requireStableId(value, name) {
  const normalized = requireText(value, name, 1, 255);
  if (!STABLE_ID_PATTERN.test(normalized)) {
    throw new LemonSqueezyCommerceRuntimeError(`${name} is invalid.`, 'COMMERCE_IDENTIFIER_INVALID', 400);
  }
  return normalized;
}

function requireUuid(value, name) {
  const normalized = text(value);
  if (!UUID_PATTERN.test(normalized)) {
    throw new LemonSqueezyCommerceRuntimeError(`${name} is invalid.`, 'COMMERCE_IDENTIFIER_INVALID', 400);
  }
  return normalized;
}

function projectRefFromUrl(url) {
  try {
    return new URL(url).hostname.split('.')[0] || '';
  } catch {
    return '';
  }
}

function requireSandboxRedirect(value) {
  const raw = requireText(value, 'LEMON_SQUEEZY_TEST_REDIRECT_URL', 8, 2048);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new LemonSqueezyCommerceRuntimeError(
      'LEMON_SQUEEZY_TEST_REDIRECT_URL is invalid.',
      'COMMERCE_SANDBOX_CONFIGURATION_INVALID',
      503,
    );
  }
  if (parsed.protocol !== 'https:') {
    throw new LemonSqueezyCommerceRuntimeError(
      'LEMON_SQUEEZY_TEST_REDIRECT_URL must use HTTPS.',
      'COMMERCE_SANDBOX_CONFIGURATION_INVALID',
      503,
    );
  }
  return parsed.toString();
}

export function readLemonSqueezyCommerceRuntimeConfig(environment = process.env) {
  const mode = text(environment.COMMERCE_MODE).toLowerCase();
  const provider = text(environment.COMMERCE_PROVIDER).toLowerCase();
  if (mode !== 'sandbox' || provider !== LEMON_SQUEEZY_PROVIDER) {
    return Object.freeze({
      enabled: false,
      reason: 'Lemon Squeezy commerce runtime is disabled outside the explicitly configured sandbox.',
    });
  }

  if (text(environment.VERCEL_ENV).toLowerCase() === 'production') {
    throw new LemonSqueezyCommerceRuntimeError(
      'Lemon Squeezy sandbox runtime cannot execute in Production.',
      'COMMERCE_SANDBOX_PRODUCTION_FORBIDDEN',
      503,
    );
  }
  if (!enabled(environment.LEMON_SQUEEZY_TEST_MODE)) {
    throw new LemonSqueezyCommerceRuntimeError(
      'Lemon Squeezy Test Mode must be explicitly enabled.',
      'COMMERCE_SANDBOX_TEST_MODE_REQUIRED',
      503,
    );
  }

  let supabase;
  try {
    supabase = readSupabaseServerConfig(environment, { requireSecret: true });
  } catch {
    throw new LemonSqueezyCommerceRuntimeError(
      'The commerce sandbox database configuration is missing or invalid.',
      'COMMERCE_SANDBOX_CONFIGURATION_INVALID',
      503,
    );
  }
  const projectRef = projectRefFromUrl(supabase.url);
  if (projectRef !== DEVELOPMENT_PROJECT_REF) {
    throw new LemonSqueezyCommerceRuntimeError(
      'Commerce sandbox must target the canonical Development Supabase project.',
      'COMMERCE_SANDBOX_PROJECT_MISMATCH',
      503,
    );
  }

  const qaEmail = requireText(environment.COMMERCE_SANDBOX_QA_EMAIL, 'COMMERCE_SANDBOX_QA_EMAIL', 3, 254)
    .toLowerCase();
  if (!EMAIL_PATTERN.test(qaEmail)) {
    throw new LemonSqueezyCommerceRuntimeError(
      'COMMERCE_SANDBOX_QA_EMAIL is invalid.',
      'COMMERCE_SANDBOX_CONFIGURATION_INVALID',
      503,
    );
  }

  const launchVariantId = requirePositiveInteger(
    environment.LEMON_SQUEEZY_TEST_LAUNCH_VARIANT_ID,
    'LEMON_SQUEEZY_TEST_LAUNCH_VARIANT_ID',
  );
  const standardVariantId = requirePositiveInteger(
    environment.LEMON_SQUEEZY_TEST_STANDARD_VARIANT_ID,
    'LEMON_SQUEEZY_TEST_STANDARD_VARIANT_ID',
  );
  if (launchVariantId === standardVariantId) {
    throw new LemonSqueezyCommerceRuntimeError(
      'Launch and standard Lemon Squeezy variants must be distinct fixed-price variants.',
      'COMMERCE_SANDBOX_VARIANTS_NOT_DISTINCT',
      503,
    );
  }

  return Object.freeze({
    enabled: true,
    mode: 'sandbox',
    provider: LEMON_SQUEEZY_PROVIDER,
    testMode: true,
    supabase,
    projectRef,
    qaEmail,
    apiKey: requireText(environment.LEMON_SQUEEZY_TEST_API_KEY, 'LEMON_SQUEEZY_TEST_API_KEY', 16, 4096),
    webhookSecret: requireText(
      environment.LEMON_SQUEEZY_TEST_WEBHOOK_SECRET,
      'LEMON_SQUEEZY_TEST_WEBHOOK_SECRET',
      16,
      4096,
    ),
    storeId: requirePositiveInteger(environment.LEMON_SQUEEZY_TEST_STORE_ID, 'LEMON_SQUEEZY_TEST_STORE_ID'),
    productId: requirePositiveInteger(environment.LEMON_SQUEEZY_TEST_PRODUCT_ID, 'LEMON_SQUEEZY_TEST_PRODUCT_ID'),
    launchVariantId,
    standardVariantId,
    redirectUrl: requireSandboxRedirect(environment.LEMON_SQUEEZY_TEST_REDIRECT_URL),
    reconciliationEnabled: enabled(environment.COMMERCE_RECONCILIATION_ENABLED),
  });
}

export function selectTrustedLemonSqueezyVariant(purchaseIntent, config) {
  if (!purchaseIntent || typeof purchaseIntent !== 'object' || Array.isArray(purchaseIntent)) {
    throw new LemonSqueezyCommerceRuntimeError('A trusted purchase intent is required.', 'TRUSTED_PURCHASE_INTENT_REQUIRED', 409);
  }
  if (purchaseIntent.product_id !== PAID_PRODUCT_ID) {
    throw new LemonSqueezyCommerceRuntimeError('Purchase intent product mismatch.', 'PURCHASE_INTENT_PRODUCT_MISMATCH', 409);
  }
  if (purchaseIntent.currency !== DEFAULT_CURRENCY) {
    throw new LemonSqueezyCommerceRuntimeError('Purchase intent currency mismatch.', 'PURCHASE_INTENT_CURRENCY_MISMATCH', 409);
  }

  if (purchaseIntent.price_tier === 'launch') {
    if (Number(purchaseIntent.amount_cents) !== DEFAULT_LAUNCH_PRICE_CENTS) {
      throw new LemonSqueezyCommerceRuntimeError('Launch purchase intent amount mismatch.', 'PURCHASE_INTENT_AMOUNT_MISMATCH', 409);
    }
    return Object.freeze({
      variantId: config.launchVariantId,
      priceTier: 'launch',
      expectedSubtotalCents: DEFAULT_LAUNCH_PRICE_CENTS,
      currency: DEFAULT_CURRENCY,
    });
  }

  if (purchaseIntent.price_tier === 'standard') {
    if (Number(purchaseIntent.amount_cents) !== DEFAULT_STANDARD_PRICE_CENTS) {
      throw new LemonSqueezyCommerceRuntimeError('Standard purchase intent amount mismatch.', 'PURCHASE_INTENT_AMOUNT_MISMATCH', 409);
    }
    return Object.freeze({
      variantId: config.standardVariantId,
      priceTier: 'standard',
      expectedSubtotalCents: DEFAULT_STANDARD_PRICE_CENTS,
      currency: DEFAULT_CURRENCY,
    });
  }

  throw new LemonSqueezyCommerceRuntimeError('Purchase intent price tier is invalid.', 'PURCHASE_INTENT_PRICE_TIER_INVALID', 409);
}

function jsonHeaders(secretKey) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
  };
}

async function readJson(response) {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { message: raw.slice(0, 500) };
  }
}

async function serviceRequest({ config, path, method = 'GET', body, headers = {}, fetchImpl = fetch }) {
  const response = await fetchImpl(`${config.supabase.url}${path}`, {
    method,
    headers: {
      ...jsonHeaders(config.supabase.secretKey),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    const error = new LemonSqueezyCommerceRuntimeError(
      'The commerce database operation failed.',
      payload?.code || 'COMMERCE_DATABASE_OPERATION_FAILED',
      response.status >= 400 && response.status < 600 ? response.status : 500,
    );
    error.details = payload;
    throw error;
  }
  return payload;
}

function firstRow(payload) {
  return Array.isArray(payload) ? payload[0] || null : payload;
}

async function callRpc({ config, name, body, fetchImpl }) {
  return serviceRequest({
    config,
    path: `/rest/v1/rpc/${encodeURIComponent(name)}`,
    method: 'POST',
    body,
    fetchImpl,
  });
}

export async function reserveCommercePurchaseIntent({ config, accountId, idempotencyKey, fetchImpl, now = new Date() }) {
  return firstRow(await callRpc({
    config,
    name: 'reserve_commerce_purchase_intent',
    body: {
      p_account_id: requireUuid(accountId, 'accountId'),
      p_idempotency_key: requireStableId(idempotencyKey, 'idempotencyKey'),
      p_now: new Date(now).toISOString(),
    },
    fetchImpl,
  }));
}

export async function attachCommerceCheckout({ config, intentId, checkoutId, fetchImpl }) {
  return firstRow(await callRpc({
    config,
    name: 'attach_commerce_checkout',
    body: {
      p_intent_id: requireUuid(intentId, 'intentId'),
      p_provider: LEMON_SQUEEZY_PROVIDER,
      p_checkout_id: requireStableId(checkoutId, 'checkoutId'),
    },
    fetchImpl,
  }));
}

export async function readCommercePurchaseIntent({ config, intentId, fetchImpl }) {
  const id = requireUuid(intentId, 'intentId');
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/purchase_intents?id=eq.${encodeURIComponent(id)}&select=id,account_id,product_id,status,price_tier,amount_cents,currency,offer_terms,provider_checkout_id,expires_at&limit=1`,
    fetchImpl,
  });
  const row = firstRow(rows);
  if (!row) {
    throw new LemonSqueezyCommerceRuntimeError('Trusted purchase intent not found.', 'TRUSTED_PURCHASE_INTENT_NOT_FOUND', 404);
  }
  return Object.freeze({ ...row });
}

export function commerceWebhookPayloadSha256(rawBody) {
  const buffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ''), 'utf8');
  return createHash('sha256').update(buffer).digest('hex');
}

export async function beginCommerceWebhookReceipt({ config, providerEventId, eventType, rawBody, fetchImpl }) {
  return firstRow(await callRpc({
    config,
    name: 'begin_commerce_webhook_receipt',
    body: {
      p_provider: LEMON_SQUEEZY_PROVIDER,
      p_provider_event_id: requireStableId(providerEventId, 'providerEventId'),
      p_event_type: requireStableId(eventType, 'eventType'),
      p_payload_sha256: commerceWebhookPayloadSha256(rawBody),
    },
    fetchImpl,
  }));
}

export async function finishCommerceWebhookReceipt({ config, receiptId, status, lastError = null, fetchImpl }) {
  return firstRow(await callRpc({
    config,
    name: 'finish_commerce_webhook_receipt',
    body: {
      p_receipt_id: requireUuid(receiptId, 'receiptId'),
      p_status: status,
      p_last_error: lastError,
    },
    fetchImpl,
  }));
}

function providerHeaders(apiKey) {
  return {
    Accept: 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
    Authorization: `Bearer ${apiKey}`,
  };
}

async function providerJsonRequest({ config, path, method = 'GET', body, fetchImpl = fetch }) {
  const response = await fetchImpl(`${PROVIDER_API_ROOT}${path}`, {
    method,
    headers: providerHeaders(config.apiKey),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new LemonSqueezyCommerceRuntimeError(
      'The Lemon Squeezy Test Mode API request failed.',
      'LEMON_SQUEEZY_TEST_API_REQUEST_FAILED',
      response.status >= 400 && response.status < 600 ? response.status : 502,
    );
  }
  return payload;
}

export async function createLockedLemonSqueezyTestCheckout({
  config,
  accountId,
  purchaseIntentId,
  variantId,
  email,
  fetchImpl,
}) {
  const requestBody = structuredClone(buildLemonSqueezyCheckoutRequest({
    storeId: config.storeId,
    variantId,
    accountId,
    purchaseIntentId,
    email,
    redirectUrl: config.redirectUrl,
    testMode: true,
  }));
  requestBody.data.attributes.checkout_options = { discount: false };

  const payload = await providerJsonRequest({
    config,
    path: '/checkouts',
    method: 'POST',
    body: requestBody,
    fetchImpl,
  });
  const data = payload?.data;
  const attributes = data?.attributes;
  if (
    data?.type !== 'checkouts'
    || !STABLE_ID_PATTERN.test(String(data?.id || ''))
    || attributes?.test_mode !== true
    || typeof attributes?.url !== 'string'
    || !attributes.url.startsWith('https://')
  ) {
    throw new LemonSqueezyCommerceRuntimeError('Lemon Squeezy returned an invalid Test Mode checkout.', 'INVALID_TEST_CHECKOUT', 502);
  }
  return Object.freeze({
    provider: LEMON_SQUEEZY_PROVIDER,
    checkoutId: String(data.id),
    url: attributes.url,
    testMode: true,
  });
}

export async function retrieveAuthoritativeLemonSqueezyOrder({ config, orderId, fetchImpl }) {
  const id = requireStableId(orderId, 'orderId');
  const [orderPayload, itemPayload] = await Promise.all([
    providerJsonRequest({ config, path: `/orders/${encodeURIComponent(id)}`, fetchImpl }),
    providerJsonRequest({
      config,
      path: `/order-items?filter[order_id]=${encodeURIComponent(id)}&page[size]=10`,
      fetchImpl,
    }),
  ]);
  if (orderPayload?.data?.type !== 'orders' || String(orderPayload?.data?.id || '') !== id) {
    throw new LemonSqueezyCommerceRuntimeError('Lemon Squeezy returned an invalid order resource.', 'INVALID_ORDER_RESOURCE', 502);
  }
  if (!Array.isArray(itemPayload?.data)) {
    throw new LemonSqueezyCommerceRuntimeError('Lemon Squeezy returned invalid order items.', 'INVALID_ORDER_ITEMS', 502);
  }
  return Object.freeze({
    order: structuredClone(orderPayload.data),
    orderItems: structuredClone(itemPayload.data),
  });
}

function integer(value, fieldName, minimum = 0) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new LemonSqueezyCommerceRuntimeError(`${fieldName} is invalid.`, 'LEMON_SQUEEZY_ORDER_INVARIANT_FAILED', 409);
  }
  return parsed;
}

export function validateLemonSqueezyOrderCommercialTerms({
  order,
  orderItems,
  config,
  expectedVariantId,
  expectedSubtotalCents,
  expectedCurrency = DEFAULT_CURRENCY,
}) {
  const attributes = order?.attributes;
  if (order?.type !== 'orders' || !attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    throw new LemonSqueezyCommerceRuntimeError('Order resource is malformed.', 'LEMON_SQUEEZY_ORDER_INVARIANT_FAILED', 409);
  }
  if (attributes.test_mode !== true) {
    throw new LemonSqueezyCommerceRuntimeError('Non-Test-Mode order rejected.', 'LEMON_SQUEEZY_ORDER_INVARIANT_FAILED', 409);
  }
  if (String(attributes.store_id) !== String(config.storeId)) {
    throw new LemonSqueezyCommerceRuntimeError('Order Store mismatch.', 'LEMON_SQUEEZY_ORDER_INVARIANT_FAILED', 409);
  }
  if (text(attributes.currency).toUpperCase() !== expectedCurrency) {
    throw new LemonSqueezyCommerceRuntimeError('Order currency mismatch.', 'LEMON_SQUEEZY_ORDER_INVARIANT_FAILED', 409);
  }

  const subtotal = integer(attributes.subtotal, 'order.subtotal', 1);
  const discountTotal = integer(attributes.discount_total, 'order.discount_total', 0);
  const tax = integer(attributes.tax, 'order.tax', 0);
  const total = integer(attributes.total, 'order.total', 1);
  const refundedAmount = integer(attributes.refunded_amount ?? 0, 'order.refunded_amount', 0);
  if (subtotal !== expectedSubtotalCents) {
    throw new LemonSqueezyCommerceRuntimeError('Order subtotal does not match the trusted purchase intent.', 'LEMON_SQUEEZY_ORDER_SUBTOTAL_MISMATCH', 409);
  }
  if (discountTotal !== 0) {
    throw new LemonSqueezyCommerceRuntimeError('Discounted orders are outside the approved Library Pass contract.', 'LEMON_SQUEEZY_ORDER_DISCOUNT_FORBIDDEN', 409);
  }
  if (total < subtotal) {
    throw new LemonSqueezyCommerceRuntimeError('Order total is inconsistent with the trusted base price.', 'LEMON_SQUEEZY_ORDER_TOTAL_INVALID', 409);
  }

  if (!Array.isArray(orderItems) || orderItems.length !== 1) {
    throw new LemonSqueezyCommerceRuntimeError('Order must contain exactly one item.', 'LEMON_SQUEEZY_ORDER_ITEM_COUNT_MISMATCH', 409);
  }
  const item = orderItems[0];
  const itemAttributes = item?.attributes;
  if (item?.type !== 'order-items' || !itemAttributes || typeof itemAttributes !== 'object') {
    throw new LemonSqueezyCommerceRuntimeError('Order item is malformed.', 'LEMON_SQUEEZY_ORDER_INVARIANT_FAILED', 409);
  }
  if (String(itemAttributes.order_id) !== String(order.id)) {
    throw new LemonSqueezyCommerceRuntimeError('Order item does not belong to the order.', 'LEMON_SQUEEZY_ORDER_INVARIANT_FAILED', 409);
  }
  if (String(itemAttributes.product_id) !== String(config.productId)) {
    throw new LemonSqueezyCommerceRuntimeError('Order Product mismatch.', 'LEMON_SQUEEZY_ORDER_INVARIANT_FAILED', 409);
  }
  if (String(itemAttributes.variant_id) !== String(expectedVariantId)) {
    throw new LemonSqueezyCommerceRuntimeError('Order Variant mismatch.', 'LEMON_SQUEEZY_ORDER_INVARIANT_FAILED', 409);
  }
  if (integer(itemAttributes.quantity, 'order_item.quantity', 1) !== 1) {
    throw new LemonSqueezyCommerceRuntimeError('Order quantity must be exactly one.', 'LEMON_SQUEEZY_ORDER_QUANTITY_MISMATCH', 409);
  }
  integer(itemAttributes.price, 'order_item.price', 1);

  const status = text(attributes.status);
  if (!REVIEWED_ORDER_STATUSES.has(status)) {
    throw new LemonSqueezyCommerceRuntimeError('Order status is outside the reviewed contract.', 'LEMON_SQUEEZY_ORDER_STATUS_UNREVIEWED', 409);
  }

  return Object.freeze({
    orderId: requireStableId(order.id, 'orderId'),
    status,
    subtotalCents: subtotal,
    discountTotalCents: discountTotal,
    taxCents: tax,
    totalCents: total,
    refundedAmountCents: refundedAmount,
    currency: expectedCurrency,
    variantId: Number(expectedVariantId),
  });
}

function minimizedOrderMetadata(order, commercial) {
  const attributes = order.attributes || {};
  return Object.freeze({
    lemonSqueezyOrderIdentifier: text(attributes.identifier) || null,
    lemonSqueezyOrderStatus: commercial.status,
    lemonSqueezyStoreId: String(attributes.store_id),
    lemonSqueezyVariantId: String(commercial.variantId),
    lemonSqueezySubtotalCents: commercial.subtotalCents,
    lemonSqueezyDiscountTotalCents: commercial.discountTotalCents,
    lemonSqueezyTaxCents: commercial.taxCents,
    lemonSqueezyTaxInclusiveTotalCents: commercial.totalCents,
    lemonSqueezyRefundedAmountCents: commercial.refundedAmountCents,
    lemonSqueezyTestMode: attributes.test_mode === true,
    lemonSqueezyUpdatedAt: text(attributes.updated_at || attributes.created_at) || null,
  });
}

export function nextCommerceReconciliationAt({ attemptCount = 0, now = new Date() } = {}) {
  const attempts = Number.isSafeInteger(Number(attemptCount)) && Number(attemptCount) >= 0
    ? Number(attemptCount)
    : 0;
  const delayMs = attempts < 2
    ? 24 * 60 * 60 * 1000
    : attempts < 4
      ? 3 * 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;
  return new Date(new Date(now).getTime() + delayMs).toISOString();
}

export function reconciliationEvidenceId(order) {
  const status = text(order?.attributes?.status) || 'unknown';
  const updatedAt = text(order?.attributes?.updated_at || order?.attributes?.created_at) || 'unknown';
  return requireStableId(`lemon-squeezy:reconcile:${order?.id}:${status}:${updatedAt}`, 'reconciliationEvidenceId');
}

export async function completeCommercePurchase({
  config,
  event,
  purchaseIntent,
  commercial,
  metadata,
  fetchImpl,
  now = new Date(),
}) {
  return firstRow(await callRpc({
    config,
    name: 'complete_commerce_purchase',
    body: {
      p_provider: LEMON_SQUEEZY_PROVIDER,
      p_event_id: event.providerEventId,
      p_occurred_at: event.occurredAt || new Date(now).toISOString(),
      p_transaction_id: event.transactionId,
      p_customer_id: event.customerId || null,
      p_intent_id: purchaseIntent.id,
      p_account_id: purchaseIntent.account_id,
      p_product_id: PAID_PRODUCT_ID,
      p_provider_price_id: String(commercial.variantId),
      p_currency: commercial.currency,
      p_subtotal_cents: commercial.subtotalCents,
      p_tax_cents: commercial.taxCents,
      p_total_cents: commercial.totalCents,
      p_metadata: metadata,
      p_next_reconcile_at: nextCommerceReconciliationAt({ attemptCount: 0, now }),
    },
    fetchImpl,
  }));
}

export async function applyCommerceReconciliation({
  config,
  transactionId,
  evidenceId,
  commercial,
  metadata,
  attemptCount = 0,
  fetchImpl,
  now = new Date(),
}) {
  const next = commercial.status === 'paid'
    ? nextCommerceReconciliationAt({ attemptCount, now })
    : null;
  return firstRow(await callRpc({
    config,
    name: 'apply_commerce_reconciliation',
    body: {
      p_provider: LEMON_SQUEEZY_PROVIDER,
      p_transaction_id: transactionId,
      p_evidence_id: evidenceId,
      p_provider_status: commercial.status,
      p_occurred_at: text(metadata.lemonSqueezyUpdatedAt) || new Date(now).toISOString(),
      p_refunded_amount_cents: commercial.refundedAmountCents,
      p_metadata: metadata,
      p_next_reconcile_at: next,
    },
    fetchImpl,
  }));
}

export async function recordCommerceReconciliationFailure({
  config,
  transactionId,
  errorCode,
  attemptCount = 0,
  fetchImpl,
  now = new Date(),
}) {
  return firstRow(await callRpc({
    config,
    name: 'record_commerce_reconciliation_failure',
    body: {
      p_provider: LEMON_SQUEEZY_PROVIDER,
      p_transaction_id: transactionId,
      p_error_code: requireStableId(errorCode, 'errorCode'),
      p_next_reconcile_at: nextCommerceReconciliationAt({ attemptCount, now }),
    },
    fetchImpl,
  }));
}

export async function listDueCommerceReconciliations({ config, fetchImpl, now = new Date(), limit = MAX_RECONCILIATION_BATCH }) {
  const bounded = Math.min(Math.max(Number.parseInt(limit, 10) || 1, 1), MAX_RECONCILIATION_BATCH);
  const due = encodeURIComponent(new Date(now).toISOString());
  const path = `/rest/v1/commerce_reconciliations?provider=eq.${LEMON_SQUEEZY_PROVIDER}&disposition=eq.tracking&next_reconcile_at=lte.${due}&select=id,provider_transaction_id,purchase_id,purchase_intent_id,account_id,product_id,provider_price_id,price_tier,expected_subtotal_cents,currency,provider_status,attempt_count,next_reconcile_at&order=next_reconcile_at.asc&limit=${bounded}`;
  const rows = await serviceRequest({ config, path, fetchImpl });
  return Array.isArray(rows) ? rows.map((row) => Object.freeze({ ...row })) : [];
}

export async function createSandboxCommerceCheckout({
  config,
  user,
  idempotencyKey,
  fetchImpl,
  now = new Date(),
}) {
  if (!config?.enabled) {
    throw new LemonSqueezyCommerceRuntimeError('Commerce sandbox is disabled.', 'COMMERCE_SANDBOX_DISABLED', 503);
  }
  const email = text(user?.email).toLowerCase();
  if (!UUID_PATTERN.test(text(user?.id)) || email !== config.qaEmail) {
    throw new LemonSqueezyCommerceRuntimeError('This sandbox checkout is restricted to the configured QA account.', 'COMMERCE_SANDBOX_QA_ONLY', 403);
  }

  const intent = await reserveCommercePurchaseIntent({
    config,
    accountId: user.id,
    idempotencyKey,
    fetchImpl,
    now,
  });
  const nowMs = new Date(now).getTime();
  const expiresAtMs = Date.parse(String(intent?.expires_at || ''));
  if (
    !['pending', 'checkout_created', 'failed'].includes(intent?.status)
    || !Number.isFinite(expiresAtMs)
    || expiresAtMs <= nowMs
  ) {
    throw new LemonSqueezyCommerceRuntimeError(
      'The trusted purchase intent is no longer open for checkout.',
      'COMMERCE_PURCHASE_INTENT_NOT_OPEN',
      409,
    );
  }
  const trusted = selectTrustedLemonSqueezyVariant(intent, config);
  const checkout = await createLockedLemonSqueezyTestCheckout({
    config,
    accountId: user.id,
    purchaseIntentId: intent.id,
    variantId: trusted.variantId,
    email,
    fetchImpl,
  });
  await attachCommerceCheckout({ config, intentId: intent.id, checkoutId: checkout.checkoutId, fetchImpl });

  return Object.freeze({
    checkout,
    purchaseIntent: Object.freeze({
      id: intent.id,
      priceTier: trusted.priceTier,
      amountCents: trusted.expectedSubtotalCents,
      currency: trusted.currency,
    }),
  });
}

function webhookIdentity(payload) {
  const custom = payload?.meta?.custom_data;
  return Object.freeze({
    eventName: text(payload?.meta?.event_name),
    orderId: requireStableId(payload?.data?.id, 'orderId'),
    accountId: requireUuid(custom?.usd_impact_account_id, 'accountId'),
    purchaseIntentId: requireUuid(custom?.usd_impact_purchase_intent_id, 'purchaseIntentId'),
  });
}

export async function processLemonSqueezyWebhook({
  config,
  rawBody,
  signature,
  fetchImpl,
  now = new Date(),
}) {
  if (!config?.enabled) {
    throw new LemonSqueezyCommerceRuntimeError('Commerce sandbox is disabled.', 'COMMERCE_SANDBOX_DISABLED', 503);
  }
  if (!verifyLemonSqueezyWebhookSignature({ rawBody, signature, secret: config.webhookSecret })) {
    throw new LemonSqueezyCommerceRuntimeError('Webhook signature is invalid.', 'INVALID_COMMERCE_WEBHOOK_SIGNATURE', 401);
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
  } catch {
    throw new LemonSqueezyCommerceRuntimeError('Webhook payload is invalid JSON.', 'INVALID_COMMERCE_WEBHOOK_BODY', 400);
  }

  const identity = webhookIdentity(payload);
  const purchaseIntent = await readCommercePurchaseIntent({ config, intentId: identity.purchaseIntentId, fetchImpl });
  if (purchaseIntent.account_id !== identity.accountId) {
    throw new LemonSqueezyCommerceRuntimeError('Webhook account does not match trusted purchase intent.', 'WEBHOOK_PURCHASE_INTENT_ACCOUNT_MISMATCH', 409);
  }
  const trusted = selectTrustedLemonSqueezyVariant(purchaseIntent, config);

  const event = normalizeLemonSqueezyOrderEvent(payload, {
    expectedStoreId: config.storeId,
    expectedProductId: config.productId,
    expectedVariantId: trusted.variantId,
    expectedSubtotalCents: trusted.expectedSubtotalCents,
    expectedCurrency: trusted.currency,
    requireTestMode: true,
  });

  const receipt = await beginCommerceWebhookReceipt({
    config,
    providerEventId: event.providerEventId,
    eventType: identity.eventName,
    rawBody,
    fetchImpl,
  });
  if (receipt?.should_process === false) {
    return Object.freeze({ duplicate: true, receiptId: receipt.receipt_id, status: receipt.status });
  }

  try {
    const authoritative = await retrieveAuthoritativeLemonSqueezyOrder({ config, orderId: identity.orderId, fetchImpl });
    const commercial = validateLemonSqueezyOrderCommercialTerms({
      order: authoritative.order,
      orderItems: authoritative.orderItems,
      config,
      expectedVariantId: trusted.variantId,
      expectedSubtotalCents: trusted.expectedSubtotalCents,
      expectedCurrency: trusted.currency,
    });
    const metadata = minimizedOrderMetadata(authoritative.order, commercial);

    let result;
    if (identity.eventName === 'order_created') {
      if (commercial.status !== 'paid') {
        throw new LemonSqueezyCommerceRuntimeError(
          'Authoritative order is no longer paid; entitlement was not granted.',
          'ORDER_CREATED_NOT_AUTHORITATIVELY_PAID',
          409,
        );
      }
      result = await completeCommercePurchase({
        config,
        event,
        purchaseIntent,
        commercial,
        metadata,
        fetchImpl,
        now,
      });
    } else if (identity.eventName === 'order_refunded') {
      if (commercial.status === 'paid') {
        throw new LemonSqueezyCommerceRuntimeError(
          'Refund webhook conflicts with current paid state and requires review.',
          'REFUND_WEBHOOK_AUTHORITATIVE_STATE_CONFLICT',
          409,
        );
      }
      result = await applyCommerceReconciliation({
        config,
        transactionId: identity.orderId,
        evidenceId: event.providerEventId,
        commercial,
        metadata,
        fetchImpl,
        now,
      });
    } else {
      throw new LemonSqueezyCommerceRuntimeError('Unsupported webhook event.', 'UNSUPPORTED_COMMERCE_WEBHOOK_EVENT', 400);
    }

    await finishCommerceWebhookReceipt({
      config,
      receiptId: receipt.receipt_id,
      status: 'processed',
      fetchImpl,
    });
    return Object.freeze({ duplicate: false, receiptId: receipt.receipt_id, result });
  } catch (error) {
    try {
      await finishCommerceWebhookReceipt({
        config,
        receiptId: receipt.receipt_id,
        status: 'failed',
        lastError: typeof error?.code === 'string' ? error.code : 'COMMERCE_WEBHOOK_PROCESSING_FAILED',
        fetchImpl,
      });
    } catch (receiptError) {
      console.error('Commerce webhook receipt failure could not be recorded.', {
        code: typeof receiptError?.code === 'string' ? receiptError.code : 'COMMERCE_RECEIPT_FINALIZATION_FAILED',
      });
    }
    throw error;
  }
}

function trustedFromReconciliationRow(row, config) {
  if (row.product_id !== PAID_PRODUCT_ID || row.currency !== DEFAULT_CURRENCY) {
    throw new LemonSqueezyCommerceRuntimeError('Reconciliation row commercial terms are invalid.', 'RECONCILIATION_TERMS_INVALID', 409);
  }
  const expectedSubtotalCents = Number(row.expected_subtotal_cents);
  const variantId = Number(row.provider_price_id);
  if (row.price_tier === 'launch') {
    if (expectedSubtotalCents !== DEFAULT_LAUNCH_PRICE_CENTS || variantId !== config.launchVariantId) {
      throw new LemonSqueezyCommerceRuntimeError('Launch reconciliation terms mismatch.', 'RECONCILIATION_TERMS_INVALID', 409);
    }
  } else if (row.price_tier === 'standard') {
    if (expectedSubtotalCents !== DEFAULT_STANDARD_PRICE_CENTS || variantId !== config.standardVariantId) {
      throw new LemonSqueezyCommerceRuntimeError('Standard reconciliation terms mismatch.', 'RECONCILIATION_TERMS_INVALID', 409);
    }
  } else {
    throw new LemonSqueezyCommerceRuntimeError('Reconciliation price tier is invalid.', 'RECONCILIATION_TERMS_INVALID', 409);
  }
  return Object.freeze({ variantId, expectedSubtotalCents, currency: DEFAULT_CURRENCY });
}

export async function runDueLemonSqueezyReconciliation({
  config,
  fetchImpl,
  now = new Date(),
  limit = MAX_RECONCILIATION_BATCH,
}) {
  if (!config?.enabled || !config.reconciliationEnabled) {
    return Object.freeze({ enabled: false, scanned: 0, tracking: 0, reviewed: 0, terminal: 0, failed: 0 });
  }
  const rows = await listDueCommerceReconciliations({ config, fetchImpl, now, limit });
  let tracking = 0;
  let reviewed = 0;
  let terminal = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const trusted = trustedFromReconciliationRow(row, config);
      const authoritative = await retrieveAuthoritativeLemonSqueezyOrder({
        config,
        orderId: row.provider_transaction_id,
        fetchImpl,
      });
      const commercial = validateLemonSqueezyOrderCommercialTerms({
        order: authoritative.order,
        orderItems: authoritative.orderItems,
        config,
        expectedVariantId: trusted.variantId,
        expectedSubtotalCents: trusted.expectedSubtotalCents,
        expectedCurrency: trusted.currency,
      });
      const metadata = minimizedOrderMetadata(authoritative.order, commercial);
      const result = await applyCommerceReconciliation({
        config,
        transactionId: row.provider_transaction_id,
        evidenceId: reconciliationEvidenceId(authoritative.order),
        commercial,
        metadata,
        attemptCount: Number(row.attempt_count) || 0,
        fetchImpl,
        now,
      });
      if (result?.disposition === 'tracking') tracking += 1;
      else if (result?.disposition === 'review') reviewed += 1;
      else terminal += 1;
    } catch (error) {
      failed += 1;
      try {
        await recordCommerceReconciliationFailure({
          config,
          transactionId: row.provider_transaction_id,
          errorCode: typeof error?.code === 'string' ? error.code : 'COMMERCE_RECONCILIATION_FAILED',
          attemptCount: Number(row.attempt_count) || 0,
          fetchImpl,
          now,
        });
      } catch (recordError) {
        console.error('Commerce reconciliation failure state could not be recorded.', {
          code: typeof recordError?.code === 'string' ? recordError.code : 'COMMERCE_RECONCILIATION_FAILURE_RECORD_FAILED',
        });
      }
    }
  }

  return Object.freeze({
    enabled: true,
    scanned: rows.length,
    tracking,
    reviewed,
    terminal,
    failed,
  });
}

export function publicCommerceRuntimeError(error) {
  if (error instanceof LemonSqueezyCommerceRuntimeError) {
    const safeStatus = error.status >= 400 && error.status < 600 ? error.status : 500;
    return Object.freeze({
      status: safeStatus,
      payload: {
        error: safeStatus >= 500 ? 'Commerce sandbox is temporarily unavailable.' : error.message,
        code: error.code,
      },
    });
  }
  console.error(error);
  return Object.freeze({
    status: 500,
    payload: { error: 'Commerce sandbox is temporarily unavailable.', code: 'COMMERCE_INTERNAL_ERROR' },
  });
}
