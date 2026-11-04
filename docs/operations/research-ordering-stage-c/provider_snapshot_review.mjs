/**
 * REVIEW ONLY — not imported by the Research webhook or a deployable route.
 * This does not authenticate a checkout account, prove paid settlement, or
 * authorize subscription/entitlement writes. All results have canMutate=false.
 * The API credential remains the caller's responsibility and is never logged.
 */
import { createHash } from 'node:crypto';

const NUMERIC_ID = /^[1-9][0-9]{0,17}$/;
const UTC = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/;
const REVIEWABLE = new Set(['active', 'cancelled', 'past_due', 'expired']);
const MAX_JSON_BYTES = 196608;

function pending(reason) {
  return Object.freeze({ disposition: 'pending_reconciliation', reason, canMutate: false });
}

function requiredId(value, field) {
  const id = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof id !== 'string' || !NUMERIC_ID.test(id)) throw new TypeError(`${field} must be a positive numeric identifier`);
  return id;
}

function parseMicroseconds(value) {
  if (typeof value !== 'string') return null;
  const match = UTC.exec(value);
  if (!match) return null;
  const base = Date.parse(`${match[1]}Z`);
  if (!Number.isFinite(base) || new Date(base).toISOString().slice(0, 19) !== match[1]) return null;
  return BigInt(base) * 1000n + BigInt((match[2] || '').padEnd(6, '0'));
}

function finiteReviewHorizon(status, attributes, existingPeriodEnd) {
  const endText = status === 'cancelled' ? attributes.ends_at : attributes.renews_at;
  const end = parseMicroseconds(endText);
  if (end === null) return false;
  const old = existingPeriodEnd == null ? null : parseMicroseconds(existingPeriodEnd);
  if (existingPeriodEnd != null && old === null) return false;
  return old === null || end >= old;
}

function nonsecretFingerprint({ subscriptionId, status, updatedAt, storeId, variantId }) {
  return createHash('sha256').update(JSON.stringify({ subscriptionId, status, updatedAt, storeId, variantId })).digest('hex');
}

/**
 * Explicitly injected fetch: tests have zero network access. A future trusted
 * integration MUST authenticate the webhook, check durable account/checkout
 * binding and signed provider settlement independently before consuming this.
 */
export async function inspectResearchProviderSnapshotReview({
  subscriptionId,
  expectedBinding,
  signedEvent,
  apiKey,
  fetchImpl,
  existingPeriodEnd = null,
} = {}) {
  const sid = requiredId(subscriptionId, 'subscriptionId');
  if (!expectedBinding || typeof expectedBinding !== 'object') throw new TypeError('expectedBinding is required');
  const store = requiredId(expectedBinding.storeId, 'storeId');
  const customer = requiredId(expectedBinding.customerId, 'customerId');
  const product = requiredId(expectedBinding.productId, 'productId');
  const variant = requiredId(expectedBinding.variantId, 'variantId');
  if (typeof expectedBinding.testMode !== 'boolean') throw new TypeError('testMode must be boolean');
  if (!signedEvent || signedEvent.objectType !== 'subscriptions') {
    return pending('invoice_or_missing_subscription_object_not_comparable');
  }
  const signedTime = parseMicroseconds(signedEvent.occurredAt);
  if (signedTime === null) return pending('invalid_signed_subscription_clock');
  if (typeof apiKey !== 'string' || apiKey.length < 16 || typeof fetchImpl !== 'function') {
    throw new TypeError('review credentials and an explicit fetch implementation are required');
  }
  const url = `https://api.lemonsqueezy.com/v1/subscriptions/${sid}`;
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET', redirect: 'error',
      headers: { Accept: 'application/vnd.api+json', Authorization: `Bearer ${apiKey}` },
    });
  } catch {
    return pending('provider_fetch_unavailable');
  }
  if (!response || !response.ok) {
    return pending('provider_http_unavailable_or_rejected');
  }
  const contentType = response.headers?.get?.('content-type') || '';
  if (!/(?:application\/(?:vnd\.api\+)?json)/i.test(contentType)) return pending('provider_content_type_unexpected');
  let raw;
  try {
    raw = await response.text();
  } catch {
    return pending('provider_response_unreadable');
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_JSON_BYTES) return pending('provider_response_oversized');
  let body;
  try { body = JSON.parse(raw); } catch { return pending('provider_json_invalid'); }
  if (body?.data?.type !== 'subscriptions' || String(body?.data?.id) !== sid ||
      !body.data.attributes || typeof body.data.attributes !== 'object') {
    return pending('provider_snapshot_identity_mismatch');
  }
  const a = body.data.attributes;
  const idValue = (x) => (typeof x === 'number' && Number.isSafeInteger(x)) ? String(x) : x;
  if (idValue(a.store_id) !== store || idValue(a.customer_id) !== customer ||
      idValue(a.product_id) !== product || idValue(a.variant_id) !== variant ||
      a.test_mode !== expectedBinding.testMode) {
    return pending('provider_scope_or_catalog_binding_mismatch');
  }
  const observedTime = parseMicroseconds(a.updated_at);
  if (observedTime === null) return pending('provider_snapshot_clock_invalid');
  if (observedTime < signedTime) return pending('provider_snapshot_older_than_signed_event');
  if (observedTime > signedTime) return pending('provider_has_newer_state_than_delivery');
  if (typeof a.status !== 'string' || !REVIEWABLE.has(a.status)) return pending('provider_status_requires_explicit_policy');
  if (a.status === 'active' && a.cancelled !== false) return pending('active_cancelled_flag_inconsistent');
  if (a.status === 'cancelled' && a.cancelled !== true) return pending('cancelled_flag_inconsistent');
  if (['active','cancelled'].includes(a.status) && !finiteReviewHorizon(a.status, a, existingPeriodEnd)) {
    return pending('paid_horizon_unverified_or_shortened');
  }
  // This digest is *not* a signature or an account/settlement proof.
  return Object.freeze({
    disposition: 'candidate_for_locked_review',
    reason: 'current_subscription_object_matches_bound_provider_snapshot',
    canMutate: false,
    subscriptionId: sid,
    currentProviderStatus: a.status,
    providerClock: a.updated_at,
    reviewFingerprint: nonsecretFingerprint({subscriptionId:sid,status:a.status,updatedAt:a.updated_at,storeId:store,variantId:variant}),
  });
}
