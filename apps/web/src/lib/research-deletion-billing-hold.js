// D33 R01: review-gated billing safety, disabled by default.
// NO provider cancellation, refunds, credential logging or Production activation.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES = new Set(['open', 'manual_review']);
const REASONS = new Set([
  'subscription_present', 'lookup_unavailable', 'lookup_malformed', 'existing_hold',
]);
const PRODUCT = 'research-membership';

export class ResearchDeletionBillingHoldError extends Error {
  constructor(code) {
    super('Research billing requires manual reconciliation before account deletion.');
    this.name = 'ResearchDeletionBillingHoldError';
    this.code = code;
  }
}

const isTrue = (value) => String(value || '').trim().toLowerCase() === 'true';

export function researchDeletionHoldReviewGate(environment = {}, config = {}) {
  if (!isTrue(environment.RESEARCH_DELETION_HOLD_V1_ENABLED)) return false;
  if (
    !isTrue(environment.RESEARCH_DELETION_HOLD_V1_REVIEW_APPROVED)
    || config?.production !== false
  ) {
    throw new ResearchDeletionBillingHoldError(
      'RESEARCH_DELETION_HOLD_REVIEW_NOT_APPROVED',
    );
  }
  return true;
}

function headers(key) {
  return Object.freeze({
    Accept: 'application/json',
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: 'Bearer ' + key,
  });
}

function requiredConfig(config, accountId, fetchImpl) {
  const base = String(config?.supabase?.url || '');
  const key = String(config?.supabase?.secretKey || '');
  if (
    !UUID.test(String(accountId || ''))
    || !base.startsWith('https://')
    || !key
    || typeof fetchImpl !== 'function'
  ) {
    throw new ResearchDeletionBillingHoldError(
      'RESEARCH_DELETION_HOLD_INVALID_CONFIG',
    );
  }
  return { base, key };
}

async function guardedReadRows({ url, accountId, fetchImpl, key, validator }) {
  let result;
  try {
    const response = await fetchImpl(url, { method: 'GET', headers: headers(key) });
    if (!response?.ok) return { reason: 'lookup_unavailable' };
    result = JSON.parse(await response.text());
  } catch {
    return { reason: 'lookup_unavailable' };
  }
  if (
    !Array.isArray(result)
    || result.length > 2
    || result.some((row) => !validator(row, accountId))
  ) {
    return { reason: 'lookup_malformed' };
  }
  return { rows: result };
}

async function persistHold({ accountId, reason, base, key, fetchImpl }) {
  if (!REASONS.has(reason)) {
    throw new ResearchDeletionBillingHoldError('RESEARCH_DELETION_HOLD_BAD_REASON');
  }
  let result;
  try {
    const response = await fetchImpl(
      base + '/rest/v1/rpc/record_research_deletion_billing_hold',
      {
        method: 'POST',
        headers: headers(key),
        body: JSON.stringify({
          p_account_id: accountId,
          p_reason_code: reason,
        }),
      },
    );
    if (!response?.ok) {
      throw new Error('billing hold was not acknowledged');
    }
    result = JSON.parse(await response.text());
  } catch {
    // No safe fallback to Auth removal if the durable ledger is unavailable.
    throw new ResearchDeletionBillingHoldError(
      'RESEARCH_DELETION_HOLD_NOT_DURABLE',
    );
  }
  if (
    !result
    || typeof result !== 'object'
    || Array.isArray(result)
    || !STATES.has(result.hold_state)
    || result.reason_code !== reason
    || !Number.isInteger(result.attempt_count)
    || result.attempt_count < 1
    || !Number.isFinite(Date.parse(result.next_check_at))
    || !Number.isFinite(Date.parse(result.escalate_at))
  ) {
    throw new ResearchDeletionBillingHoldError(
      'RESEARCH_DELETION_HOLD_ACK_INVALID',
    );
  }
  return Object.freeze({
    decision: 'hold',
    holdState: result.hold_state,
    reason,
    attemptCount: result.attempt_count,
    nextCheckAt: result.next_check_at,
    escalateAt: result.escalate_at,
  });
}

/**
 * Review-gated preflight. An existing hold can never be cleared by a transient
 * empty subscription read. Release of a hold requires a separate approved,
 * provider-verified and audited reconciliation workflow (not implemented).
 *
 * No merchant API is called. No account/auth/entitlement status is modified.
 */
export async function reviewResearchBillingBeforeAuthDeletion({
  config,
  accountId,
  fetchImpl = fetch,
}) {
  const { base, key } = requiredConfig(config, accountId, fetchImpl);
  const escaped = encodeURIComponent(accountId);
  const held = await guardedReadRows({
    url: base + '/rest/v1/research_deletion_billing_holds?account_id=eq.'
      + escaped + '&select=account_id,hold_state&limit=2',
    accountId, fetchImpl, key,
    validator: (row, id) =>
      row?.account_id === id && STATES.has(row.hold_state),
  });

  let reason;
  if (held.reason) {
    reason = held.reason;
  } else if (held.rows.length > 0) {
    reason = 'existing_hold';
  } else {
    const subscriptions = await guardedReadRows({
      url: base + '/rest/v1/subscriptions?account_id=eq.' + escaped
        + '&product_id=eq.' + PRODUCT + '&select=account_id,product_id,state&limit=2',
      accountId, fetchImpl, key,
      validator: (row, id) =>
        row?.account_id === id
        && row.product_id === PRODUCT
        && typeof row.state === 'string'
        && row.state.length > 0,
    });
    if (subscriptions.reason) {
      reason = subscriptions.reason;
    } else if (subscriptions.rows.length > 0) {
      reason = 'subscription_present';
    }
  }

  if (!reason) {
    // Only a clean authoritative local lookup with no previous hold clears
    // this first-stage review gate. The database finalizer must independently
    // enforce lifecycle invariants against subsequent races.
    return Object.freeze({ decision: 'clear' });
  }
  return persistHold({ accountId, reason, base, key, fetchImpl });
}
