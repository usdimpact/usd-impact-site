import { PAID_PRODUCT_ID } from './paid-access.js';
import {
  readSupabaseServerConfig,
  SupabaseRequestError,
} from './supabase-server.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRANSACTION_ID_PATTERN = /^txn_[a-z\d]{26}$/;
const TRANSACTION_EVENTS = new Set([
  'transaction.updated',
  'transaction.ready',
  'transaction.paid',
  'transaction.payment_failed',
  'transaction.past_due',
  'transaction.canceled',
]);

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

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object.`);
  }
  return value;
}

function paymentErrorCode(data) {
  if (!Array.isArray(data.payments)) return null;
  const failed = data.payments.find((payment) =>
    payment && typeof payment === 'object' && typeof payment.error_code === 'string' && payment.error_code);
  return failed?.error_code?.slice(0, 200) || null;
}

export function paddleTransactionTransition(eventType, status) {
  if (eventType === 'transaction.payment_failed' || eventType === 'transaction.past_due') return 'failed';
  if (eventType === 'transaction.canceled' || status === 'canceled') return 'cancelled';
  if (status === 'past_due') return 'failed';
  if (eventType === 'transaction.ready' || eventType === 'transaction.paid') return 'pending';
  if (eventType === 'transaction.updated' && ['draft', 'ready', 'paid'].includes(status)) return 'pending';
  return null;
}

export function normalizePaddleTransactionLifecycleEvent(event) {
  if (!TRANSACTION_EVENTS.has(event?.eventType)) {
    throw new TypeError('Unsupported Paddle transaction lifecycle event.');
  }
  const data = requireObject(event.data, 'event.data');
  if (!TRANSACTION_ID_PATTERN.test(data.id || '')) {
    throw new TypeError('Paddle transaction ID is invalid.');
  }
  const custom = requireObject(data.custom_data, 'event.data.custom_data');
  if (!UUID_PATTERN.test(custom.account_id || '') || !UUID_PATTERN.test(custom.purchase_intent_id || '')) {
    throw new TypeError('Paddle custom data does not contain valid trusted references.');
  }
  if (custom.product_id !== PAID_PRODUCT_ID) {
    throw new TypeError('Paddle custom data references the wrong product.');
  }
  const status = String(data.status || '');
  if (!status || status.length > 64) {
    throw new TypeError('Paddle transaction status is invalid.');
  }

  return Object.freeze({
    eventId: event.eventId,
    eventType: event.eventType,
    occurredAt: event.occurredAt || new Date().toISOString(),
    transactionId: data.id,
    intentId: custom.purchase_intent_id,
    accountId: custom.account_id,
    productId: custom.product_id,
    providerStatus: status,
    transition: paddleTransactionTransition(event.eventType, status),
    paymentErrorCode: paymentErrorCode(data),
    payload: event.payload,
  });
}

export async function applyPaddleTransactionLifecycle({
  event,
  environment,
  config,
  fetchImpl = fetch,
}) {
  const transaction = normalizePaddleTransactionLifecycleEvent(event);
  const resolved = config || readSupabaseServerConfig(environment, { requireSecret: true });
  const response = await fetchImpl(`${resolved.url}/rest/v1/rpc/apply_paddle_transaction_lifecycle`, {
    method: 'POST',
    headers: jsonHeaders(resolved),
    body: JSON.stringify({
      p_event_id: transaction.eventId,
      p_event_type: transaction.eventType,
      p_occurred_at: transaction.occurredAt,
      p_transaction_id: transaction.transactionId,
      p_intent_id: transaction.intentId,
      p_account_id: transaction.accountId,
      p_product_id: transaction.productId,
      p_provider_status: transaction.providerStatus,
      p_transition: transaction.transition,
      p_payment_error_code: transaction.paymentErrorCode,
      p_payload: transaction.payload,
    }),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new SupabaseRequestError(
      payload?.message || payload?.error || 'Unable to apply Paddle transaction lifecycle.',
      {
        status: response.status,
        code: payload?.code || 'PADDLE_TRANSACTION_LIFECYCLE_RPC_FAILED',
        details: payload,
      },
    );
  }

  const handled = payload?.handled === true;
  return Object.freeze({
    processed: handled,
    ignored: !handled,
    transaction,
    result: payload,
  });
}
