// Stage B-1 review-only, versioned Research receipt fingerprint.
// This module performs NO I/O and grants NO authority to apply a transition.
// Its sole current caller is the default-OFF Research receipt evidence path.
import { createHash } from 'node:crypto';

const VERSION = 'research-receipt-business-v1';
const RESEARCH_CUSTOM_KEYS = Object.freeze([
  'usd_impact_account_id',
  'usd_impact_research_product_id',
  'usd_impact_research_billing_interval',
  'usd_impact_research_checkout_key',
]);
const SUBSCRIPTION_FIELDS = Object.freeze([
  'store_id', 'product_id', 'variant_id', 'customer_id',
  'status', 'cancelled', 'trial_ends_at', 'renews_at',
  'ends_at', 'created_at', 'updated_at', 'test_mode', 'billing_reason',
]);
const INVOICE_FIELDS = Object.freeze([
  'subscription_id', 'store_id', 'test_mode', 'status', 'refunded',
  'total', 'refunded_amount', 'refunded_at', 'created_at', 'updated_at',
  'currency', 'subtotal', 'tax', 'billing_reason',
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function requireObject(value, label) {
  if (!isObject(value)) throw new TypeError(label + ' must be an object.');
  return value;
}
function project(source, keys) {
  const result = {};
  for (const key of keys) {
    // Missing and explicit null remain distinct. This avoids silently treating
    // a malformed signed object as equivalent to a complete one.
    result[key] = Object.prototype.hasOwnProperty.call(source, key)
      ? source[key] : { __research_receipt_missing_v1: true };
  }
  return result;
}
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isObject(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  if (value === null || ['string', 'boolean', 'number'].includes(typeof value)) {
    return value;
  }
  throw new TypeError('Unsupported Research receipt field type.');
}

/**
 * Compute a privacy-minimized, HMAC-validated-event fingerprint.
 *
 * Callers MUST independently verify provider HMAC, store/product/test mode,
 * object type and subscriber authority before calling this helper. An equal
 * fingerprint is not permission to alter, acknowledge, or grant access.
 *
 * Signed portal URLs, recipient fields and webhook delivery metadata are NOT
 * billing or access evidence; changing those fields must not block retries.
 * Any future business-relevant provider field requires a reviewed VERSION bump.
 */
export function fingerprintResearchReceiptBusinessEvent(payload) {
  const root = requireObject(payload, 'payload');
  const meta = requireObject(root.meta, 'meta');
  const data = requireObject(root.data, 'data');
  const attrs = requireObject(data.attributes, 'data.attributes');
  if (typeof meta.event_name !== 'string' || !meta.event_name.trim()) {
    throw new TypeError('Research receipt event name is missing.');
  }
  const isSubscription = data.type === 'subscriptions';
  const isInvoice = data.type === 'subscription-invoices';
  if (!isSubscription && !isInvoice) {
    throw new TypeError('Research receipt object type is unsupported.');
  }
  const custom = meta.custom_data == null ? {} : requireObject(meta.custom_data, 'meta.custom_data');
  const unknownBindingKeys = Object.keys(custom).filter(
    (k) => k.startsWith('usd_impact_') && !RESEARCH_CUSTOM_KEYS.includes(k),
  );
  if (unknownBindingKeys.length) {
    // Fail closed if the app adds a new binding field that this fingerprint
    // would otherwise discard; no raw field names enter a persisted receipt.
    throw new TypeError('A Research binding field requires a fingerprint version review.');
  }
  const projected = {
    version: VERSION,
    meta: {
      event_name: meta.event_name,
      custom_data: project(custom, RESEARCH_CUSTOM_KEYS),
    },
    data: {
      type: data.type,
      id: data.id,
      attributes: project(attrs, isSubscription ? SUBSCRIPTION_FIELDS : INVOICE_FIELDS),
    },
  };
  return createHash('sha256').update(JSON.stringify(canonicalize(projected))).digest('hex');
}

export const RESEARCH_RECEIPT_FINGERPRINT_VERSION = VERSION;
