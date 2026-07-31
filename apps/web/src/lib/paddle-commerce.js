import { randomUUID } from 'node:crypto';
import { PAID_PRODUCT_ID } from './paid-access.js';
import {
  readSupabaseServerConfig,
  SupabaseRequestError,
} from './supabase-server.js';
import { priceIdForTier, readPaddleApiConfig } from './paddle-api.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRANSACTION_ID_PATTERN = /^txn_[a-z\d]{26}$/;
const CUSTOMER_ID_PATTERN = /^ctm_[a-z\d]{26}$/;
const IDEMPOTENCY_INPUT_PATTERN = /^[a-zA-Z0-9._:-]{8,128}$/;

function jsonHeaders(config) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    apikey: config.secretKey,
    Authorization: `Bearer ${config.secretKey}`,
  };
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

async function serviceRpc({ name, body, environment, config, fetchImpl = fetch }) {
  const resolved = config || readSupabaseServerConfig(environment, { requireSecret: true });
  const response = await fetchImpl(`${resolved.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: jsonHeaders(resolved),
    body: JSON.stringify(body),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new SupabaseRequestError(
      payload?.message || payload?.error || `Supabase RPC ${name} failed.`,
      {
        status: response.status,
        code: payload?.code || 'PADDLE_COMMERCE_RPC_FAILED',
        details: payload,
      },
    );
  }
  return payload;
}

function normalizeIntent(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new SupabaseRequestError('Supabase returned an invalid purchase intent.', {
      code: 'INVALID_PURCHASE_INTENT_RESPONSE',
    });
  }
  return Object.freeze({
    id: payload.id,
    accountId: payload.account_id,
    productId: payload.product_id,
    status: payload.status,
    priceTier: payload.price_tier,
    amountCents: Number(payload.amount_cents),
    currency: payload.currency,
    offerTerms: payload.offer_terms,
    expiresAt: payload.expires_at,
  });
}

export function normalizeCheckoutRequestId(value = randomUUID()) {
  if (typeof value !== 'string' || !IDEMPOTENCY_INPUT_PATTERN.test(value)) {
    throw new TypeError('requestId must be 8-128 characters using letters, numbers, dot, underscore, colon, or dash.');
  }
  return value;
}

export async function reservePaddlePurchaseIntent({
  accountId,
  requestId,
  environment,
  config,
  fetchImpl,
  now = new Date().toISOString(),
}) {
  if (!UUID_PATTERN.test(accountId || '')) throw new TypeError('accountId must be a UUID.');
  const normalizedRequestId = normalizeCheckoutRequestId(requestId);
  const payload = await serviceRpc({
    name: 'reserve_paddle_purchase_intent',
    body: {
      p_account_id: accountId,
      p_idempotency_key: `paddle-checkout:${accountId}:${normalizedRequestId}`,
      p_now: now,
    },
    environment,
    config,
    fetchImpl,
  });
  return normalizeIntent(payload);
}

export async function attachPaddleTransaction({
  intentId,
  transactionId,
  environment,
  config,
  fetchImpl,
}) {
  if (!UUID_PATTERN.test(intentId || '')) throw new TypeError('intentId must be a UUID.');
  if (!TRANSACTION_ID_PATTERN.test(transactionId || '')) throw new TypeError('transactionId is invalid.');
  return serviceRpc({
    name: 'attach_paddle_transaction',
    body: {
      p_intent_id: intentId,
      p_transaction_id: transactionId,
    },
    environment,
    config,
    fetchImpl,
  });
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object.`);
  }
  return value;
}

function integerAmount(value, name) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new TypeError(`${name} must be an integer string.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new TypeError(`${name} is invalid.`);
  return parsed;
}

export function normalizeCompletedPaddleTransaction(event, environment = process.env) {
  if (event?.eventType !== 'transaction.completed') {
    throw new TypeError('Only transaction.completed events can grant access.');
  }
  const data = requireObject(event.data, 'event.data');
  if (data.status !== 'completed' || !TRANSACTION_ID_PATTERN.test(data.id || '')) {
    throw new TypeError('Completed Paddle transaction data is invalid.');
  }

  const custom = requireObject(data.custom_data, 'event.data.custom_data');
  if (!UUID_PATTERN.test(custom.account_id || '') || !UUID_PATTERN.test(custom.purchase_intent_id || '')) {
    throw new TypeError('Paddle custom data does not contain valid trusted references.');
  }
  if (custom.product_id !== PAID_PRODUCT_ID) {
    throw new TypeError('Paddle custom data references the wrong product.');
  }
  if (custom.price_tier !== 'launch' && custom.price_tier !== 'standard') {
    throw new TypeError('Paddle custom data has an invalid price tier.');
  }
  if (!Number.isSafeInteger(custom.amount_cents) || custom.amount_cents <= 0) {
    throw new TypeError('Paddle custom data has an invalid amount.');
  }
  if (typeof custom.currency !== 'string' || !/^[A-Z]{3}$/.test(custom.currency)) {
    throw new TypeError('Paddle custom data has an invalid currency.');
  }

  const config = readPaddleApiConfig(environment);
  const expectedPriceId = priceIdForTier(config, custom.price_tier);
  const matchingItems = Array.isArray(data.items)
    ? data.items.filter((item) => item?.price?.id === expectedPriceId && item?.quantity === 1)
    : [];
  if (matchingItems.length !== 1 || data.items.length !== 1) {
    throw new TypeError('Paddle transaction items do not match the reserved price.');
  }

  const totals = requireObject(data.details?.totals, 'event.data.details.totals');
  const subtotalCents = integerAmount(totals.subtotal, 'subtotal');
  const taxCents = integerAmount(totals.tax, 'tax');
  const totalCents = integerAmount(totals.total, 'total');
  if (subtotalCents !== custom.amount_cents || data.currency_code !== custom.currency) {
    throw new TypeError('Paddle transaction totals do not match the reserved intent.');
  }

  return Object.freeze({
    eventId: event.eventId,
    occurredAt: event.occurredAt || new Date().toISOString(),
    transactionId: data.id,
    customerId: CUSTOMER_ID_PATTERN.test(data.customer_id || '') ? data.customer_id : null,
    intentId: custom.purchase_intent_id,
    accountId: custom.account_id,
    productId: custom.product_id,
    priceId: expectedPriceId,
    priceTier: custom.price_tier,
    currency: custom.currency,
    subtotalCents,
    taxCents,
    totalCents,
    payload: event.payload,
  });
}

export async function completePaddlePurchase({
  event,
  environment,
  config,
  fetchImpl,
}) {
  const transaction = normalizeCompletedPaddleTransaction(event, environment);
  const result = await serviceRpc({
    name: 'complete_paddle_purchase',
    body: {
      p_event_id: transaction.eventId,
      p_occurred_at: transaction.occurredAt,
      p_transaction_id: transaction.transactionId,
      p_customer_id: transaction.customerId,
      p_intent_id: transaction.intentId,
      p_account_id: transaction.accountId,
      p_product_id: transaction.productId,
      p_price_id: transaction.priceId,
      p_price_tier: transaction.priceTier,
      p_currency: transaction.currency,
      p_subtotal_cents: transaction.subtotalCents,
      p_tax_cents: transaction.taxCents,
      p_total_cents: transaction.totalCents,
      p_payload: transaction.payload,
    },
    environment,
    config,
    fetchImpl,
  });
  return Object.freeze({ processed: true, ignored: false, result });
}

export async function markPaddleWebhookReceipt({
  eventId,
  status,
  lastError = null,
  environment,
  config,
  fetchImpl = fetch,
}) {
  const resolved = config || readSupabaseServerConfig(environment, { requireSecret: true });
  const query = new URLSearchParams({
    provider: 'eq.paddle',
    provider_event_id: `eq.${eventId}`,
  });
  const response = await fetchImpl(`${resolved.url}/rest/v1/webhook_receipts?${query}`, {
    method: 'PATCH',
    headers: {
      ...jsonHeaders(resolved),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      status,
      processed_at: status === 'processed' || status === 'ignored' ? new Date().toISOString() : null,
      last_error: lastError,
    }),
  });
  if (!response.ok) {
    const payload = await readJson(response);
    throw new SupabaseRequestError(payload?.message || 'Unable to update webhook receipt.', {
      status: response.status,
      code: payload?.code || 'PADDLE_RECEIPT_STATUS_FAILED',
      details: payload,
    });
  }
}

export async function processPaddleWebhookEvent({ event, environment, config, fetchImpl }) {
  if (event.eventType !== 'transaction.completed') {
    await markPaddleWebhookReceipt({
      eventId: event.eventId,
      status: 'ignored',
      environment,
      config,
      fetchImpl,
    });
    return Object.freeze({ processed: false, ignored: true });
  }

  const result = await completePaddlePurchase({ event, environment, config, fetchImpl });
  await markPaddleWebhookReceipt({
    eventId: event.eventId,
    status: 'processed',
    environment,
    config,
    fetchImpl,
  });
  return result;
}
