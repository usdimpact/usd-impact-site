// REVIEW-ONLY contract: this module is deliberately NOT wired into the live
// Research webhook or persistence RPC. It never permits a state mutation.
// An authorized DB migration must enforce these decisions under FOR UPDATE.
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ACCESS_STATES = new Set(['active', 'cancel_scheduled']);

function validUtc(value) {
  if (typeof value !== 'string' || !UTC_TIMESTAMP.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value ? time : null;
}

function decision(disposition, reason) {
  return Object.freeze({ disposition, reason, canMutate: false });
}

/**
 * Classify synthetic provider evidence without making a commercial decision.
 * Invoice.updated_at and subscription.updated_at are INCOMPARABLE clocks.
 * "candidate_for_atomic_review" is NOT approval to call the current unsafe RPC.
 * Database locking, identity checks, period invariants and durable audit are
 * required before any actual transition can be applied.
 */
export function classifyResearchSubscriptionOrder({
  eventKey,
  appliedEventKey = null,
  objectType,
  occurredAt,
  appliedSubscriptionOccurredAt = null,
  nextState,
  existingPeriodEnd = null,
  nextPeriodEnd = null,
  verifiedCurrentSubscriptionSnapshot = false,
} = {}) {
  if (typeof eventKey !== 'string' || !eventKey.trim()) {
    throw new TypeError('eventKey is required for signed-event audit.');
  }
  if (!['subscriptions', 'subscription-invoices'].includes(objectType)) {
    throw new TypeError('provider objectType is unsupported.');
  }

  // Even a signed invoice can be stale relative to the current subscription.
  // It must never directly suspend, recover or refund access from invoice time.
  if (objectType === 'subscription-invoices') {
    return decision('pending_reconciliation', 'invoice_is_not_subscription_state');
  }

  const newTime = validUtc(occurredAt);
  const oldTime = validUtc(appliedSubscriptionOccurredAt);
  if (newTime === null || oldTime === null) {
    return decision('pending_reconciliation', 'missing_or_unverified_subscription_watermark');
  }
  if (newTime < oldTime) {
    return decision('stale_ignored', 'older_subscription_object');
  }
  // Identical event-key replay must be checked against the full durable ledger
  // first. Equal timestamps for different keys are NEVER ordered by ID.
  if (newTime === oldTime) {
    return decision(
      'ordering_conflict',
      eventKey === appliedEventKey ? 'recheck_duplicate_evidence' : 'equal_subscription_object_clock',
    );
  }

  if (verifiedCurrentSubscriptionSnapshot !== true) {
    return decision('pending_reconciliation', 'current_provider_state_unverified');
  }

  if (ACCESS_STATES.has(nextState)) {
    const nextEnd = validUtc(nextPeriodEnd);
    const previousEnd = existingPeriodEnd == null ? null : validUtc(existingPeriodEnd);
    if (nextEnd === null) {
      return decision('pending_reconciliation', 'finite_paid_period_not_verified');
    }
    if (existingPeriodEnd != null && previousEnd === null) {
      return decision('pending_reconciliation', 'existing_paid_period_ambiguous');
    }
    if (previousEnd !== null && nextEnd < previousEnd) {
      return decision('pending_reconciliation', 'paid_period_would_shorten');
    }
  }

  return decision('candidate_for_atomic_review', 'requires_locked_database_authority');
}
