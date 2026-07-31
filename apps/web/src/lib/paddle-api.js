const PRICE_ID_PATTERN = /^pri_[a-z\d]{26}$/;
const TRANSACTION_ID_PATTERN = /^txn_[a-z\d]{26}$/;
const ADJUSTMENT_ID_PATTERN = /^adj_[a-z\d]{26}$/;

export class PaddleConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PaddleConfigurationError';
    this.code = 'PADDLE_CONFIGURATION_ERROR';
  }
}

export class PaddleApiError extends Error {
  constructor(message, { status = 502, code = 'PADDLE_API_ERROR', details = null } = {}) {
    super(message);
    this.name = 'PaddleApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function requireString(value, name, { prefix = '', pattern = null } = {}) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new PaddleConfigurationError(`${name} is missing.`);
  }
  const normalized = value.trim();
  if (prefix && !normalized.startsWith(prefix)) {
    throw new PaddleConfigurationError(`${name} is invalid.`);
  }
  if (pattern && !pattern.test(normalized)) {
    throw new PaddleConfigurationError(`${name} is invalid.`);
  }
  return normalized;
}

export function readPaddleApiConfig(environment = process.env) {
  const mode = String(environment.PADDLE_ENVIRONMENT || 'sandbox').trim().toLowerCase();
  if (mode !== 'sandbox' && mode !== 'production') {
    throw new PaddleConfigurationError('PADDLE_ENVIRONMENT must be sandbox or production.');
  }
  const apiKey = requireString(environment.PADDLE_API_KEY, 'PADDLE_API_KEY', { prefix: 'pdl_' });
  const launchPriceId = requireString(environment.PADDLE_LAUNCH_PRICE_ID, 'PADDLE_LAUNCH_PRICE_ID', {
    pattern: PRICE_ID_PATTERN,
  });
  const standardPriceId = requireString(environment.PADDLE_STANDARD_PRICE_ID, 'PADDLE_STANDARD_PRICE_ID', {
    pattern: PRICE_ID_PATTERN,
  });
  const checkoutUrl = environment.PADDLE_CHECKOUT_URL == null || environment.PADDLE_CHECKOUT_URL === ''
    ? null
    : new URL(environment.PADDLE_CHECKOUT_URL).toString();

  return Object.freeze({
    mode,
    apiKey,
    launchPriceId,
    standardPriceId,
    checkoutUrl,
    baseUrl: mode === 'sandbox' ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com',
  });
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

function apiHeaders(config) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
    'Paddle-Version': '1',
  };
}

async function paddleRequest({ path, method = 'GET', body, config, fetchImpl = fetch }) {
  const response = await fetchImpl(`${config.baseUrl}${path}`, {
    method,
    headers: apiHeaders(config),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new PaddleApiError(
      payload?.error?.detail || payload?.error?.type || payload?.message || 'Paddle API request failed.',
      {
        status: response.status,
        code: payload?.error?.code || 'PADDLE_API_REQUEST_FAILED',
        details: payload,
      },
    );
  }
  return payload;
}

export function priceIdForTier(config, priceTier) {
  if (priceTier === 'launch') return config.launchPriceId;
  if (priceTier === 'standard') return config.standardPriceId;
  throw new TypeError('priceTier must be launch or standard.');
}

function normalizeTransactionResponse(payload, { expectedId = null, priceId = null } = {}) {
  const transaction = payload?.data;
  if (!TRANSACTION_ID_PATTERN.test(transaction?.id || '')) {
    throw new PaddleApiError('Paddle returned an invalid transaction.', {
      code: 'PADDLE_INVALID_TRANSACTION_RESPONSE',
      details: payload,
    });
  }
  if (expectedId && transaction.id !== expectedId) {
    throw new PaddleApiError('Paddle returned the wrong transaction.', {
      code: 'PADDLE_TRANSACTION_RESPONSE_MISMATCH',
      details: payload,
    });
  }
  return Object.freeze({
    id: transaction.id,
    status: transaction.status || 'draft',
    checkoutUrl: typeof transaction.checkout?.url === 'string' ? transaction.checkout.url : null,
    priceId,
    raw: transaction,
  });
}

export async function createPaddleTransaction({
  intent,
  account,
  environment,
  config,
  fetchImpl = fetch,
}) {
  if (!intent?.id || !intent?.productId || !intent?.priceTier) {
    throw new TypeError('A reserved purchase intent is required.');
  }
  if (!account?.id || !account?.email) {
    throw new TypeError('A verified account is required.');
  }

  const resolved = config || readPaddleApiConfig(environment);
  const priceId = priceIdForTier(resolved, intent.priceTier);
  const body = {
    items: [{ price_id: priceId, quantity: 1 }],
    collection_mode: 'automatic',
    custom_data: {
      account_id: account.id,
      purchase_intent_id: intent.id,
      product_id: intent.productId,
      price_tier: intent.priceTier,
      amount_cents: intent.amountCents,
      currency: intent.currency,
    },
    ...(resolved.checkoutUrl ? { checkout: { url: resolved.checkoutUrl } } : {}),
  };

  const payload = await paddleRequest({
    path: '/transactions',
    method: 'POST',
    body,
    config: resolved,
    fetchImpl,
  });
  return normalizeTransactionResponse(payload, { priceId });
}

export async function getPaddleTransaction({
  transactionId,
  environment,
  config,
  fetchImpl = fetch,
}) {
  if (!TRANSACTION_ID_PATTERN.test(transactionId || '')) {
    throw new TypeError('transactionId is invalid.');
  }
  const resolved = config || readPaddleApiConfig(environment);
  const payload = await paddleRequest({
    path: `/transactions/${encodeURIComponent(transactionId)}`,
    config: resolved,
    fetchImpl,
  });
  return normalizeTransactionResponse(payload, { expectedId: transactionId });
}

export async function cancelPaddleTransaction({
  transactionId,
  environment,
  config,
  fetchImpl = fetch,
}) {
  if (!TRANSACTION_ID_PATTERN.test(transactionId || '')) {
    throw new TypeError('transactionId is invalid.');
  }
  const resolved = config || readPaddleApiConfig(environment);
  const payload = await paddleRequest({
    path: `/transactions/${encodeURIComponent(transactionId)}`,
    method: 'PATCH',
    body: { status: 'canceled' },
    config: resolved,
    fetchImpl,
  });
  return normalizeTransactionResponse(payload, { expectedId: transactionId });
}

function normalizeAdjustmentResponse(payload, { reused = false } = {}) {
  const adjustment = payload?.data;
  if (!ADJUSTMENT_ID_PATTERN.test(adjustment?.id || '') || adjustment.action !== 'refund') {
    throw new PaddleApiError('Paddle returned an invalid refund adjustment.', {
      code: 'PADDLE_INVALID_ADJUSTMENT_RESPONSE',
      details: payload,
    });
  }
  return Object.freeze({
    id: adjustment.id,
    transactionId: adjustment.transaction_id,
    action: adjustment.action,
    type: adjustment.type,
    status: adjustment.status,
    reused,
    raw: adjustment,
  });
}

export async function createPaddleFullRefund({
  transactionId,
  reason = 'duplicate purchase for the same account and product',
  environment,
  config,
  fetchImpl = fetch,
}) {
  if (!TRANSACTION_ID_PATTERN.test(transactionId || '')) {
    throw new TypeError('transactionId is invalid.');
  }
  if (typeof reason !== 'string' || !reason.trim()) {
    throw new TypeError('reason is required.');
  }
  const resolved = config || readPaddleApiConfig(environment);
  const payload = await paddleRequest({
    path: '/adjustments',
    method: 'POST',
    body: {
      action: 'refund',
      type: 'full',
      transaction_id: transactionId,
      reason: reason.trim().slice(0, 1000),
    },
    config: resolved,
    fetchImpl,
  });
  return normalizeAdjustmentResponse(payload);
}

export async function listPaddleRefundsForTransaction({
  transactionId,
  environment,
  config,
  fetchImpl = fetch,
}) {
  if (!TRANSACTION_ID_PATTERN.test(transactionId || '')) {
    throw new TypeError('transactionId is invalid.');
  }
  const resolved = config || readPaddleApiConfig(environment);
  const query = new URLSearchParams({
    transaction_id: transactionId,
    action: 'refund',
    per_page: '50',
  });
  const payload = await paddleRequest({
    path: `/adjustments?${query}`,
    config: resolved,
    fetchImpl,
  });
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return Object.freeze(rows
    .filter((row) => ADJUSTMENT_ID_PATTERN.test(row?.id || '') && row.action === 'refund')
    .map((row) => normalizeAdjustmentResponse({ data: row }, { reused: true })));
}

export async function ensurePaddleDuplicateRefund({
  transactionId,
  environment,
  config,
  fetchImpl = fetch,
}) {
  const resolved = config || readPaddleApiConfig(environment);
  let createError = null;
  try {
    return await createPaddleFullRefund({
      transactionId,
      environment,
      config: resolved,
      fetchImpl,
    });
  } catch (error) {
    createError = error;
  }

  try {
    const existing = await listPaddleRefundsForTransaction({
      transactionId,
      environment,
      config: resolved,
      fetchImpl,
    });
    const matching = existing.find((adjustment) =>
      adjustment.transactionId === transactionId
      && adjustment.type === 'full'
      && ['pending_approval', 'approved'].includes(adjustment.status));
    if (matching) return matching;
  } catch (lookupError) {
    if (!(createError instanceof PaddleApiError)) throw lookupError;
  }

  throw createError;
}
