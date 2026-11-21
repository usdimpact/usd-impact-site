import { PAID_PRODUCT_ID } from './paid-access.js';
import { LEMON_SQUEEZY_PROVIDER } from './lemon-squeezy-adapter-scaffold.js';
import { createPurchaseAccessReadyEmailIntent } from './purchase-access-ready-email.js';

// DRAFT-ONLY: A pure, bounded PREVIEW over independent read-only snapshots.
// No API, outbox write, provider send, payment replay or runtime import.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ROWS = 500;
const MAX_CANDIDATES = 25;
function utc(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) {
    throw new TypeError(field + ' must be a canonical UTC timestamp.');
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== value) {
    throw new TypeError(field + ' must be a valid UTC timestamp.');
  }
  return ms;
}
function bounded(value, field) {
  if (!Array.isArray(value) || value.length > MAX_ROWS
    || value.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new TypeError(field + ' must be an explicitly bounded array of rows.');
  }
  return value;
}
function validUuid(value) { return typeof value === 'string' && UUID_RE.test(value); }
function result(state, reason, n, before, existing, held, candidates, codes) {
  return Object.freeze({
    state, reason, scanned: n, beforeCutover: before, existing, held,
    candidates: Object.freeze(candidates.map(c => Object.freeze(c))),
    reasons: Object.freeze({ ...codes }),
    canWrite: false, canDispatch: false, requiresOperatorApproval: true,
  });
}
function bump(codes, key) { codes[key] = (codes[key] || 0) + 1; }

export function previewPurchaseAccessReadyRecovery({
  purchases = null, purchaseIntents = null, entitlements = null, profiles = null,
  outboxRows = null, approvedCutoverAt = null, observedAt, snapshotCertified = false,
} = {}) {
  if (approvedCutoverAt == null) return result('hold', 'CUTOVER_NOT_APPROVED', 0, 0, 0, 0, [], {});
  const cutover = utc(approvedCutoverAt, 'approvedCutoverAt');
  const observed = utc(observedAt, 'observedAt');
  const ps = bounded(purchases, 'purchases');
  const intents = bounded(purchaseIntents, 'purchaseIntents');
  const ents = bounded(entitlements, 'entitlements');
  const users = bounded(profiles, 'profiles');
  const outbox = bounded(outboxRows, 'outboxRows');
  if (snapshotCertified !== true) {
    return result('hold', 'SNAPSHOT_NOT_CERTIFIED', ps.length, 0, 0, 0, [], {});
  }
  if (cutover > observed) return result('not_due', 'CUTOVER_IN_FUTURE', ps.length, 0, 0, 0, [], {});

  let before = 0, existing = 0, held = 0;
  const candidates = [], codes = {};
  const ordered = [...ps].sort((a, b) =>
    String(a.completed_at ?? '').localeCompare(String(b.completed_at ?? ''))
    || String(a.id ?? '').localeCompare(String(b.id ?? '')));
  for (const purchase of ordered) {
    if (purchase.status !== 'completed') continue;
    let completed;
    try { completed = utc(purchase.completed_at, 'purchase.completed_at'); }
    catch { held += 1; bump(codes, 'INVALID_PURCHASE_DATE'); continue; }
    if (completed < cutover) { before += 1; continue; }
    if (completed > observed) { held += 1; bump(codes, 'PURCHASE_DATE_IN_FUTURE'); continue; }
    if (!validUuid(purchase.id) || !validUuid(purchase.account_id)
      || !validUuid(purchase.purchase_intent_id)
      || purchase.product_id !== PAID_PRODUCT_ID
      || purchase.provider !== LEMON_SQUEEZY_PROVIDER
      || typeof purchase.provider_event_id !== 'string'
      || !purchase.provider_event_id.trim()
      || !Object.hasOwn(purchase, 'refunded_at')
      || !Object.hasOwn(purchase, 'disputed_at')
      || purchase.refunded_at != null || purchase.disputed_at != null
      || ordered.filter(x => x.id === purchase.id).length !== 1) {
      held += 1; bump(codes, 'PURCHASE_AUTHORITY_NOT_VERIFIED'); continue;
    }
    // Any prior purchase_access_ready row, even a failed or accepted one,
    // MUST prevent automated re-creation, regardless of its recipient.
    const prior = outbox.filter(x => x.message_id === 'purchase_access_ready'
      && x.business_object_id === purchase.id);
    if (prior.length) {
      existing += 1;
      if (prior.length > 1) bump(codes, 'MULTIPLE_EXISTING_OUTBOX_ROWS');
      continue;
    }
    const matches = intents.filter(x => x.id === purchase.purchase_intent_id);
    const grants = ents.filter(x => x.purchase_id === purchase.id);
    const accounts = users.filter(x => x.account_id === purchase.account_id);
    if (matches.length !== 1 || matches[0].status !== 'completed'
      || matches[0].account_id !== purchase.account_id || matches[0].product_id !== PAID_PRODUCT_ID
      || grants.length !== 1 || grants[0].account_id !== purchase.account_id
      || grants[0].product_id !== PAID_PRODUCT_ID || grants[0].state !== 'active'
      || accounts.length !== 1 || accounts[0].status !== 'active') {
      held += 1; bump(codes, 'ENTITLEMENT_OR_ACCOUNT_NOT_VERIFIED'); continue;
    }
    try {
      createPurchaseAccessReadyEmailIntent({
        accessResult: { profile: accounts[0], purchase, entitlement: grants[0] },
      });
    } catch {
      held += 1; bump(codes, 'NOTIFICATION_IDENTITY_INVALID'); continue;
    }
    // No emails or payment values leave the planner. No send permission.
    candidates.push({
      purchaseId: purchase.id, verdict: 'REVIEW_ONLY', locale: 'en',
      reason: 'MISSING_OUTBOX_AFTER_APPROVED_CUTOVER',
    });
    if (candidates.length > MAX_CANDIDATES) {
      return result('hold', 'CANDIDATE_LIMIT_EXCEEDED', ps.length, before, existing, held, [], codes);
    }
  }
  return result('review_only', 'NO_AUTOMATED_RECOVERY_APPROVED',
    ps.length, before, existing, held, candidates, codes);
}
