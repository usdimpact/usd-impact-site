import { createHash, randomUUID } from 'node:crypto';
import { readSessionAccessToken } from './supabase-auth.js';
import {
  getVerifiedSupabaseUser,
  safeSupabaseError,
  sendJson,
  SupabaseRequestError,
} from './supabase-server.js';
import {
  attachPaddleTransaction,
  normalizeCheckoutRequestId,
  reservePaddlePurchaseIntent,
} from './paddle-commerce.js';
import {
  cancelPaddleTransaction,
  createPaddleTransaction,
  getPaddleTransaction,
  PaddleApiError,
  PaddleConfigurationError,
} from './paddle-api.js';
import { isPaddleCheckoutEnabled } from './paddle-deployment-config.js';

function header(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? '' : String(value ?? '');
}

function parseBody(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string' || Buffer.isBuffer(request.body)) return JSON.parse(request.body.toString());
  return {};
}

function requireSameSiteJson(request, response) {
  if (header(request, 'sec-fetch-site') === 'cross-site') {
    sendJson(response, 403, { error: 'Cross-site requests are not allowed.', code: 'CROSS_SITE_REQUEST' });
    return false;
  }
  if (!header(request, 'content-type').toLowerCase().includes('application/json')) {
    sendJson(response, 415, { error: 'Content type must be application/json.', code: 'INVALID_CONTENT_TYPE' });
    return false;
  }
  return true;
}

function safeRequestId(value) {
  if (value == null || value === '') return randomUUID();
  return normalizeCheckoutRequestId(String(value).trim());
}

function publicCheckoutError(error) {
  if (error instanceof PaddleConfigurationError) {
    console.error(error.message);
    return { status: 503, payload: { error: 'Checkout is temporarily unavailable.', code: error.code } };
  }
  if (error instanceof PaddleApiError) {
    console.error('Paddle transaction request failed.', { status: error.status, code: error.code });
    return { status: 502, payload: { error: 'Checkout could not be created.', code: error.code } };
  }
  if (error instanceof SupabaseRequestError) {
    const message = String(error.message || '').toLowerCase();
    if (message.includes('already entitled') || message.includes('active entitlement')) {
      return { status: 409, payload: { error: 'This account already has access.', code: 'ALREADY_ENTITLED' } };
    }
    if (message.includes('not eligible for checkout')) {
      return { status: 409, payload: { error: 'This account cannot purchase this product again.', code: 'CHECKOUT_NOT_ELIGIBLE' } };
    }
    if (message.includes('profile is not active')) {
      return { status: 409, payload: { error: 'This account cannot start checkout.', code: 'ACCOUNT_NOT_ACTIVE' } };
    }
  }
  return null;
}

function checkoutResponse({ intent, transaction, reused }) {
  const responseToken = createHash('sha256')
    .update(`${intent.id}:${transaction.id}`)
    .digest('hex')
    .slice(0, 24);
  return {
    ok: true,
    reused,
    checkout: {
      transactionId: transaction.id,
      url: transaction.checkoutUrl,
      status: transaction.status,
      token: responseToken,
    },
    intent: {
      id: intent.id,
      productId: intent.productId,
      priceTier: intent.priceTier,
      amountCents: intent.amountCents,
      currency: intent.currency,
      expiresAt: intent.expiresAt,
      status: intent.status,
    },
  };
}

export function createPaddleCheckoutHandler({
  environment = process.env,
  checkoutEnabled = isPaddleCheckoutEnabled,
  readAccessToken = readSessionAccessToken,
  getUser = getVerifiedSupabaseUser,
  reserveIntent = reservePaddlePurchaseIntent,
  createTransaction = createPaddleTransaction,
  getTransaction = getPaddleTransaction,
  cancelTransaction = cancelPaddleTransaction,
  attachTransaction = attachPaddleTransaction,
} = {}) {
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
    }
    if (!requireSameSiteJson(request, response)) return;

    if (!checkoutEnabled(environment)) {
      return sendJson(response, 503, {
        error: 'Checkout is temporarily unavailable.',
        code: 'CHECKOUT_DISABLED',
      });
    }

    const accessToken = readAccessToken(request);
    if (!accessToken) {
      return sendJson(response, 401, { error: 'Authentication is required.', code: 'AUTHENTICATION_REQUIRED' });
    }

    let payload;
    try {
      payload = parseBody(request);
    } catch {
      return sendJson(response, 400, { error: 'Invalid request body.', code: 'INVALID_REQUEST_BODY' });
    }

    let requestId;
    try {
      requestId = safeRequestId(payload.requestId);
    } catch {
      return sendJson(response, 400, { error: 'Invalid checkout request ID.', code: 'INVALID_CHECKOUT_REQUEST_ID' });
    }

    try {
      const account = await getUser(accessToken);
      const intent = await reserveIntent({ accountId: account.id, requestId });

      if (intent.providerTransactionId) {
        const existingTransaction = await getTransaction({ transactionId: intent.providerTransactionId });
        return sendJson(response, 200, checkoutResponse({
          intent,
          transaction: existingTransaction,
          reused: true,
        }));
      }

      const createdTransaction = await createTransaction({ intent, account });
      const attachment = await attachTransaction({
        intentId: intent.id,
        transactionId: createdTransaction.id,
      });

      if (attachment.transactionId !== createdTransaction.id) {
        try {
          await cancelTransaction({ transactionId: createdTransaction.id });
        } catch (cancelError) {
          console.error('Unable to cancel a superseded Paddle transaction.', {
            code: cancelError?.code || 'PADDLE_TRANSACTION_CANCEL_FAILED',
          });
        }
        const existingTransaction = await getTransaction({ transactionId: attachment.transactionId });
        return sendJson(response, 200, checkoutResponse({
          intent: { ...intent, providerTransactionId: attachment.transactionId },
          transaction: existingTransaction,
          reused: true,
        }));
      }

      return sendJson(response, 201, checkoutResponse({
        intent,
        transaction: createdTransaction,
        reused: false,
      }));
    } catch (error) {
      const checkoutError = publicCheckoutError(error);
      if (checkoutError) return sendJson(response, checkoutError.status, checkoutError.payload);
      const safe = safeSupabaseError(error);
      return sendJson(response, safe.status, safe.payload);
    }
  };
}
