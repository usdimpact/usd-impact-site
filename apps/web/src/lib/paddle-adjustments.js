import {
  readSupabaseServerConfig,
  SupabaseRequestError,
} from './supabase-server.js';

const ADJUSTMENT_ID_PATTERN = /^adj_[a-z\d]{26}$/;
const TRANSACTION_ID_PATTERN = /^txn_[a-z\d]{26}$/;
const LIFECYCLE_ACTIONS = new Set([
  'refund',
  'chargeback_warning',
  'chargeback_warning_reverse',
  'chargeback',
  'chargeback_reverse',
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

function normalizeReason(value) {
  if (value == null) return null;
  if (typeof value !== 'string') throw new TypeError('event.data.reason must be a string or null.');
  return value.slice(0, 1000);
}

export function paddleAdjustmentTransition(action, status) {
  if (action === 'refund' && status === 'approved') return 'refund';
  if (action === 'chargeback_warning' && status === 'approved') return 'chargeback_warning';
  if (action === 'chargeback' && status === 'approved') return 'chargeback';
  if (action === 'chargeback_warning_reverse' && status === 'approved') {
    return 'chargeback_warning_reverse';
  }
  if (action === 'chargeback_reverse' && status === 'approved') return 'chargeback_reverse';
  if (action === 'chargeback_warning' && status === 'reversed') {
    return 'chargeback_warning_reverse';
  }
  if (action === 'chargeback' && status === 'reversed') return 'chargeback_reverse';
  return null;
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
  const type = data.type == null ? null : String(data.type);
  const totals = requireObject(data.totals, 'event.data.totals');
  const totalCents = integerAmount(totals.total, 'event.data.totals.total');
  const transition = paddleAdjustmentTransition(action, status);
  const lifecycleCandidate = LIFECYCLE_ACTIONS.has(action);

  return Object.freeze({
    eventId: event.eventId,
    occurredAt: event.occurredAt || new Date().toISOString(),
    adjustmentId: data.id,
    transactionId: data.transaction_id,
    action,
    status,
    type,
    reason: normalizeReason(data.reason),
    totalCents,
    transition,
    lifecycleCandidate,
    revocationCandidate: transition === 'refund' || transition === 'chargeback',
    suspensionCandidate: transition === 'chargeback_warning',
    restorationCandidate:
      transition === 'chargeback_warning_reverse' || transition === 'chargeback_reverse',
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
  if (!adjustment.lifecycleCandidate) {
    return Object.freeze({ processed: false, ignored: true, adjustment });
  }

  const resolved = config || readSupabaseServerConfig(environment, { requireSecret: true });
  const response = await fetchImpl(`${resolved.url}/rest/v1/rpc/apply_paddle_adjustment_lifecycle`, {
    method: 'POST',
    headers: jsonHeaders(resolved),
    body: JSON.stringify({
      p_event_id: adjustment.eventId,
      p_occurred_at: adjustment.occurredAt,
      p_adjustment_id: adjustment.adjustmentId,
      p_transaction_id: adjustment.transactionId,
      p_action: adjustment.action,
      p_status: adjustment.status,
      p_adjustment_total_cents: adjustment.totalCents,
      p_adjustment_type: adjustment.type,
      p_reason: adjustment.reason,
      p_payload: adjustment.payload,
    }),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new SupabaseRequestError(
      payload?.message || payload?.error || 'Unable to apply Paddle adjustment lifecycle.',
      {
        status: response.status,
        code: payload?.code || 'PADDLE_ADJUSTMENT_RPC_FAILED',
        details: payload,
      },
    );
  }

  const handled = payload?.handled === true;
  return Object.freeze({
    processed: handled,
    ignored: !handled,
    stateChanged: payload?.state_changed === true,
    result: payload,
    adjustment,
  });
}
