import {
  readSupabaseServerConfig,
  SupabaseRequestError,
} from './supabase-server.js';

const ADJUSTMENT_ID_PATTERN = /^adj_[a-z\d]{26}$/;
const TRANSACTION_ID_PATTERN = /^txn_[a-z\d]{26}$/;
const REVOCATION_ACTIONS = new Set(['refund', 'chargeback']);

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

function integerAmount(value, name) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new TypeError(`${name} must be an integer string.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new TypeError(`${name} is invalid.`);
  }
  return parsed;
}

export function normalizePaddleAdjustment(event) {
  if (event?.eventType !== 'adjustment.created' && event?.eventType !== 'adjustment.updated') {
    throw new TypeError('Only Paddle adjustment events can be normalized.');
  }

  const data = requireObject(event.data, 'event.data');
  if (!ADJUSTMENT_ID_PATTERN.test(data.id || '')) {
    throw new TypeError('Paddle adjustment ID is invalid.');
  }
  if (!TRANSACTION_ID_PATTERN.test(data.transaction_id || '')) {
    throw new TypeError('Paddle adjustment transaction ID is invalid.');
  }

  const action = String(data.action || '');
  const status = String(data.status || '');
  const type = String(data.type || '');
  const totals = requireObject(data.totals, 'event.data.totals');
  const totalCents = integerAmount(totals.total, 'event.data.totals.total');
  const revocationCandidate = REVOCATION_ACTIONS.has(action) && status === 'approved';

  return Object.freeze({
    eventId: event.eventId,
    occurredAt: event.occurredAt || new Date().toISOString(),
    adjustmentId: data.id,
    transactionId: data.transaction_id,
    action,
    status,
    type,
    totalCents,
    revocationCandidate,
    payload: event.payload,
  });
}

export async function applyPaddleAdjustment({
  event,
  environment,
  config,
  fetchImpl = fetch,
}) {
  const adjustment = normalizePaddleAdjustment(event);
  if (!adjustment.revocationCandidate) {
    return Object.freeze({ processed: false, ignored: true, adjustment });
  }

  const resolved = config || readSupabaseServerConfig(environment, { requireSecret: true });
  const response = await fetchImpl(`${resolved.url}/rest/v1/rpc/apply_paddle_access_revocation`, {
    method: 'POST',
    headers: jsonHeaders(resolved),
    body: JSON.stringify({
      p_event_id: adjustment.eventId,
      p_occurred_at: adjustment.occurredAt,
      p_adjustment_id: adjustment.adjustmentId,
      p_transaction_id: adjustment.transactionId,
      p_action: adjustment.action,
      p_adjustment_total_cents: adjustment.totalCents,
      p_adjustment_type: adjustment.type,
      p_payload: adjustment.payload,
    }),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new SupabaseRequestError(
      payload?.message || payload?.error || 'Unable to apply Paddle access revocation.',
      {
        status: response.status,
        code: payload?.code || 'PADDLE_ADJUSTMENT_RPC_FAILED',
        details: payload,
      },
    );
  }

  const revoked = payload?.revoked === true;
  return Object.freeze({
    processed: revoked,
    ignored: !revoked,
    result: payload,
    adjustment,
  });
}
