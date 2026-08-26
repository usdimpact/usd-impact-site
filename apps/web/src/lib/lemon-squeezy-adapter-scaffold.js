import crypto from 'node:crypto';
import {
  CANONICAL_COMMERCE_EVENT_TYPES,
  COMMERCE_LIFECYCLE_MODELS,
} from './commerce-provider.js';
import { PAID_PRODUCT_ID } from './paid-access.js';

export const LEMON_SQUEEZY_PROVIDER = 'lemon-squeezy';
export const LEMON_SQUEEZY_ADAPTER_SCAFFOLD_VERSION = '0.3.0-scaffold';

export const LEMON_SQUEEZY_SCAFFOLD_CAPABILITIES = Object.freeze([
  'checkout.create',
  'webhook.verify-raw-body',
  'event.normalize',
  'payment.complete',
  'refund.complete',
  'order.retrieve',
  'order.reconcile',
  'payment.revoke-final-state',
  'mor.chargeback-managed',
]);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function positiveInteger(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new TypeError(`${fieldName} must be a positive integer.`);
  }
  return parsed;
}

function nonNegativeInteger(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new TypeError(`${fieldName} must be a non-negative integer.`);
  }
  return parsed;
}

function stableIdentifier(value, fieldName) {
  const normalized = text(String(value ?? ''));
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,254}$/.test(normalized)) {
    throw new TypeError(`${fieldName} must be a stable identifier.`);
  }
  return normalized;
}

function object(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${fieldName} must be an object.`);
  }
  return value;
}

function asRawBuffer(rawBody) {
  if (Buffer.isBuffer(rawBody)) return rawBody;
  if (typeof rawBody === 'string') return Buffer.from(rawBody, 'utf8');
  throw new TypeError('rawBody must be the exact webhook body as a string or Buffer.');
}

export function verifyLemonSqueezyWebhookSignature({ rawBody, signature, secret }) {
  const body = asRawBuffer(rawBody);
  const supplied = text(signature).toLowerCase();
  const signingSecret = text(secret);

  if (body.length === 0 || !signingSecret || !/^[0-9a-f]{64}$/.test(supplied)) return false;

  const expected = crypto.createHmac('sha256', signingSecret).update(body).digest();
  const received = Buffer.from(supplied, 'hex');
  return received.length === expected.length && crypto.timingSafeEqual(expected, received);
}

export function buildLemonSqueezyCheckoutRequest({
  storeId,
  variantId,
  accountId,
  purchaseIntentId,
  email = null,
  redirectUrl = null,
  testMode = true,
}) {
  const store = stableIdentifier(storeId, 'storeId');
  const variant = positiveInteger(variantId, 'variantId');
  const account = stableIdentifier(accountId, 'accountId');
  const intent = stableIdentifier(purchaseIntentId, 'purchaseIntentId');
  const customerEmail = email == null ? null : text(email);
  const redirect = redirectUrl == null ? null : text(redirectUrl);

  if (testMode !== true) {
    throw new TypeError('The scaffold only permits Lemon Squeezy Test Mode checkout creation.');
  }
  if (customerEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)) {
    throw new TypeError('email is invalid.');
  }
  if (redirect && !/^https:\/\//i.test(redirect)) {
    throw new TypeError('redirectUrl must use HTTPS.');
  }

  const productOptions = { enabled_variants: [variant] };
  if (redirect) productOptions.redirect_url = redirect;

  return Object.freeze({
    data: {
      type: 'checkouts',
      attributes: {
        product_options: productOptions,
        checkout_options: {
          discount: false,
        },
        checkout_data: {
          ...(customerEmail ? { email: customerEmail } : {}),
          custom: {
            usd_impact_account_id: account,
            usd_impact_purchase_intent_id: intent,
          },
          variant_quantities: [{ variant_id: variant, quantity: 1 }],
        },
        test_mode: true,
      },
      relationships: {
        store: { data: { type: 'stores', id: store } },
        variant: { data: { type: 'variants', id: String(variant) } },
      },
    },
  });
}

export async function createLemonSqueezyTestCheckout({
  apiKey,
  fetchImpl = globalThis.fetch,
  ...checkout
}) {
  const key = text(apiKey);
  if (!key) throw new TypeError('A Test Mode Lemon Squeezy API key is required.');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function.');

  const requestBody = buildLemonSqueezyCheckoutRequest({ ...checkout, testMode: true });
  const response = await fetchImpl('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response?.ok) {
    const status = Number.isInteger(response?.status) ? response.status : 502;
    const error = new Error(`Lemon Squeezy checkout creation failed with HTTP ${status}.`);
    error.code = 'LEMON_SQUEEZY_CHECKOUT_FAILED';
    error.status = status;
    throw error;
  }

  const body = await response.json();
  const checkoutData = object(body?.data, 'checkout response data');
  const attributes = object(checkoutData.attributes, 'checkout response attributes');
  const checkoutUrl = text(attributes.url);
  if (checkoutData.type !== 'checkouts' || !checkoutUrl.startsWith('https://')) {
    throw new TypeError('Lemon Squeezy returned an invalid checkout object.');
  }
  if (attributes.test_mode !== true) {
    throw new TypeError('The scaffold rejected a non-Test-Mode checkout response.');
  }

  return Object.freeze({
    provider: LEMON_SQUEEZY_PROVIDER,
    checkoutId: stableIdentifier(checkoutData.id, 'checkoutId'),
    url: checkoutUrl,
    testMode: true,
  });
}

function providerEventId(eventName, orderId, attributes) {
  const updatedAt = text(attributes.updated_at || attributes.created_at);
  if (eventName === 'order_refunded') {
    return stableIdentifier(
      `${LEMON_SQUEEZY_PROVIDER}:${eventName}:${orderId}:${positiveInteger(attributes.refunded_amount, 'refunded_amount')}:${updatedAt}`,
      'providerEventId',
    );
  }
  return stableIdentifier(`${LEMON_SQUEEZY_PROVIDER}:${eventName}:${orderId}:${updatedAt}`, 'providerEventId');
}

function validateTrustedOrder({
  attributes,
  item,
  expectedStoreId,
  expectedProductId,
  expectedVariantId,
  expectedSubtotalCents,
  expectedCurrency = 'USD',
  requireTestMode = true,
}) {
  if (requireTestMode && attributes.test_mode !== true) {
    throw new TypeError('The scaffold accepts Test Mode order state only.');
  }
  if (expectedStoreId != null && String(attributes.store_id) !== String(expectedStoreId)) {
    throw new TypeError('Lemon Squeezy store does not match the trusted configuration.');
  }
  if (expectedProductId != null && String(item.product_id) !== String(expectedProductId)) {
    throw new TypeError('Lemon Squeezy product does not match the trusted configuration.');
  }
  if (expectedVariantId != null && String(item.variant_id) !== String(expectedVariantId)) {
    throw new TypeError('Lemon Squeezy variant does not match the trusted configuration.');
  }
  if (item.quantity != null && Number(item.quantity) !== 1) {
    throw new TypeError('Lemon Squeezy order quantity must be exactly one.');
  }

  const currency = text(attributes.currency).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new TypeError('Order currency is invalid.');
  if (currency !== text(expectedCurrency).toUpperCase()) {
    throw new TypeError('Lemon Squeezy order currency does not match the trusted purchase intent.');
  }

  const subtotal = positiveInteger(attributes.subtotal, 'subtotal');
  const discountTotal = nonNegativeInteger(attributes.discount_total ?? 0, 'discount_total');
  const tax = nonNegativeInteger(attributes.tax ?? 0, 'tax');
  const total = positiveInteger(attributes.total, 'total');
  if (expectedSubtotalCents != null && subtotal !== positiveInteger(expectedSubtotalCents, 'expectedSubtotalCents')) {
    throw new TypeError('Lemon Squeezy order subtotal does not match the trusted purchase intent.');
  }
  if (discountTotal !== 0) {
    throw new TypeError('Discounted Lemon Squeezy orders are outside the approved Library Pass contract.');
  }
  if (total < subtotal) {
    throw new TypeError('Lemon Squeezy order total is inconsistent with the trusted base subtotal.');
  }

  return Object.freeze({ currency, subtotal, discountTotal, tax, total });
}

export function normalizeLemonSqueezyOrderEvent(payload, {
  expectedStoreId,
  expectedProductId,
  expectedVariantId,
  expectedSubtotalCents,
  expectedCurrency = 'USD',
  requireTestMode = true,
} = {}) {
  const root = object(payload, 'payload');
  const meta = object(root.meta, 'payload.meta');
  const data = object(root.data, 'payload.data');
  const attributes = object(data.attributes, 'payload.data.attributes');
  const item = object(attributes.first_order_item, 'first_order_item');
  const customData = object(meta.custom_data, 'payload.meta.custom_data');
  const eventName = text(meta.event_name);
  const orderId = stableIdentifier(data.id, 'orderId');

  if (data.type !== 'orders') throw new TypeError('Only Lemon Squeezy Order webhooks are supported.');
  if (!['order_created', 'order_refunded'].includes(eventName)) {
    throw new TypeError('The Lemon Squeezy scaffold only normalizes order_created and order_refunded.');
  }

  const commercial = validateTrustedOrder({
    attributes,
    item,
    expectedStoreId,
    expectedProductId,
    expectedVariantId,
    expectedSubtotalCents,
    expectedCurrency,
    requireTestMode,
  });

  const accountId = stableIdentifier(customData.usd_impact_account_id, 'accountId');
  const purchaseIntentId = stableIdentifier(customData.usd_impact_purchase_intent_id, 'purchaseIntentId');

  if (eventName === 'order_created' && attributes.status !== 'paid') {
    throw new TypeError('order_created can grant payment completion only when order status is paid.');
  }
  if (eventName === 'order_refunded' && !['refunded', 'partial_refund'].includes(attributes.status)) {
    throw new TypeError('order_refunded must carry a refunded or partial_refund order status.');
  }

  return Object.freeze({
    provider: LEMON_SQUEEZY_PROVIDER,
    providerEventId: providerEventId(eventName, orderId, attributes),
    eventType: eventName === 'order_created'
      ? CANONICAL_COMMERCE_EVENT_TYPES.PAYMENT_COMPLETED
      : CANONICAL_COMMERCE_EVENT_TYPES.REFUND_COMPLETED,
    occurredAt: text(attributes.updated_at || attributes.created_at),
    transactionId: orderId,
    customerId: attributes.customer_id == null ? null : stableIdentifier(attributes.customer_id, 'customerId'),
    checkoutId: null,
    accountId,
    purchaseIntentId,
    productId: PAID_PRODUCT_ID,
    priceId: String(item.variant_id),
    amountCents: eventName === 'order_refunded'
      ? positiveInteger(attributes.refunded_amount, 'refunded_amount')
      : commercial.subtotal,
    currency: commercial.currency,
    metadata: {
      lemonSqueezyOrderIdentifier: text(attributes.identifier) || null,
      lemonSqueezyOrderStatus: text(attributes.status),
      lemonSqueezyProductId: String(item.product_id),
      lemonSqueezyVariantId: String(item.variant_id),
      lemonSqueezyOrderItemPriceCents: item.price == null ? null : Number(item.price),
      lemonSqueezySubtotalCents: commercial.subtotal,
      lemonSqueezyDiscountTotalCents: commercial.discountTotal,
      lemonSqueezyTaxCents: commercial.tax,
      lemonSqueezyTaxInclusiveTotalCents: commercial.total,
      lemonSqueezyTestMode: attributes.test_mode === true,
      fullRefund: eventName === 'order_refunded' && attributes.status === 'refunded',
      partialRefund: eventName === 'order_refunded' && attributes.status === 'partial_refund',
    },
  });
}

export async function retrieveLemonSqueezyOrder({
  apiKey,
  orderId,
  fetchImpl = globalThis.fetch,
  requireTestMode = true,
}) {
  const key = text(apiKey);
  const id = stableIdentifier(orderId, 'orderId');
  if (!key) throw new TypeError('A Lemon Squeezy API key is required.');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function.');

  const response = await fetchImpl(`https://api.lemonsqueezy.com/v1/orders/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.api+json',
      Authorization: `Bearer ${key}`,
    },
  });
  if (!response?.ok) {
    const status = Number.isInteger(response?.status) ? response.status : 502;
    const error = new Error(`Lemon Squeezy order retrieval failed with HTTP ${status}.`);
    error.code = 'LEMON_SQUEEZY_ORDER_RETRIEVAL_FAILED';
    error.status = status;
    throw error;
  }

  const body = await response.json();
  const data = object(body?.data, 'order response data');
  const attributes = object(data.attributes, 'order response attributes');
  if (data.type !== 'orders') throw new TypeError('Lemon Squeezy returned a non-order object.');
  if (requireTestMode && attributes.test_mode !== true) {
    throw new TypeError('The scaffold rejected a non-Test-Mode order response.');
  }
  return Object.freeze({ data: structuredClone(data) });
}

export function reconcileLemonSqueezyOrder(orderResource, {
  expectedStoreId,
  expectedProductId,
  expectedVariantId,
  expectedSubtotalCents,
  expectedCurrency = 'USD',
  requireTestMode = true,
} = {}) {
  const resource = object(orderResource?.data ?? orderResource, 'order resource');
  const attributes = object(resource.attributes, 'order attributes');
  const item = object(attributes.first_order_item, 'first_order_item');
  const orderId = stableIdentifier(resource.id, 'orderId');
  if (resource.type !== 'orders') throw new TypeError('Only Lemon Squeezy Order resources can be reconciled.');

  const commercial = validateTrustedOrder({
    attributes,
    item,
    expectedStoreId,
    expectedProductId,
    expectedVariantId,
    expectedSubtotalCents,
    expectedCurrency,
    requireTestMode,
  });
  const status = text(attributes.status);
  if (!['pending', 'failed', 'paid', 'refunded', 'partial_refund', 'fraudulent'].includes(status)) {
    throw new TypeError('Lemon Squeezy order status is outside the reviewed reconciliation contract.');
  }

  let action = 'hold';
  let eventType = null;
  if (status === 'paid') action = 'retain';
  else if (status === 'refunded') {
    action = 'revoke';
    eventType = CANONICAL_COMMERCE_EVENT_TYPES.REFUND_COMPLETED;
  } else if (status === 'fraudulent') {
    action = 'revoke';
    eventType = CANONICAL_COMMERCE_EVENT_TYPES.PAYMENT_REVOKED;
  } else if (status === 'partial_refund') {
    action = 'review';
  }

  return Object.freeze({
    provider: LEMON_SQUEEZY_PROVIDER,
    transactionId: orderId,
    status,
    action,
    eventType,
    currency: commercial.currency,
    amountCents: commercial.total,
    reason: status === 'fraudulent'
      ? 'Authoritative Lemon Squeezy Order state is fraudulent; fail closed and revoke access.'
      : status === 'refunded'
        ? 'Authoritative Lemon Squeezy Order state is fully refunded; revoke access.'
        : status === 'partial_refund'
          ? 'Library Pass policy supports full refunds only; an unexpected partial refund requires review and never changes entitlement automatically.'
          : status === 'paid'
            ? 'Authoritative Lemon Squeezy Order state remains paid; retain current entitlement state.'
            : 'Non-final payment state cannot grant entitlement.',
  });
}

export const LEMON_SQUEEZY_ADAPTER_SCAFFOLD = Object.freeze({
  provider: LEMON_SQUEEZY_PROVIDER,
  version: LEMON_SQUEEZY_ADAPTER_SCAFFOLD_VERSION,
  lifecycleModel: COMMERCE_LIFECYCLE_MODELS.MOR_FINAL_STATE_RECONCILIATION,
  capabilities: LEMON_SQUEEZY_SCAFFOLD_CAPABILITIES,
  createCheckout: createLemonSqueezyTestCheckout,
  verifyWebhookSignature: verifyLemonSqueezyWebhookSignature,
  normalizeEvent: normalizeLemonSqueezyOrderEvent,
  retrieveOrder: retrieveLemonSqueezyOrder,
  reconcileTransaction: reconcileLemonSqueezyOrder,
  assessConfiguration() {
    return Object.freeze({
      ready: false,
      reason: 'Lemon Squeezy is selected, but this scaffold remains intentionally unregistered until Test Mode credentials/product mapping, Development migration verification, sandbox evidence, and release review are complete.',
    });
  },
});
