const PRICE_ID_PATTERN = /^pri_[a-z\d]{26}$/;
const TRANSACTION_ID_PATTERN = /^txn_[a-z\d]{26}$/;

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

export function priceIdForTier(config, priceTier) {
  if (priceTier === 'launch') return config.launchPriceId;
  if (priceTier === 'standard') return config.standardPriceId;
  throw new TypeError('priceTier must be launch or standard.');
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

  const response = await fetchImpl(`${resolved.baseUrl}/transactions`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resolved.apiKey}`,
      'Paddle-Version': '1',
    },
    body: JSON.stringify(body),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new PaddleApiError(
      payload?.error?.detail || payload?.error?.type || payload?.message || 'Unable to create Paddle transaction.',
      {
        status: response.status,
        code: payload?.error?.code || 'PADDLE_TRANSACTION_CREATE_FAILED',
        details: payload,
      },
    );
  }

  const transaction = payload?.data;
  if (!TRANSACTION_ID_PATTERN.test(transaction?.id || '')) {
    throw new PaddleApiError('Paddle returned an invalid transaction.', {
      code: 'PADDLE_INVALID_TRANSACTION_RESPONSE',
      details: payload,
    });
  }

  return Object.freeze({
    id: transaction.id,
    status: transaction.status || 'draft',
    checkoutUrl: typeof transaction.checkout?.url === 'string' ? transaction.checkout.url : null,
    priceId,
  });
}
