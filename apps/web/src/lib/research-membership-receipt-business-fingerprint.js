// Stage B-1 review-only, versioned Research receipt fingerprint.
// This module performs NO I/O and grants NO authority to apply a transition.
// Its sole current caller is the default-OFF Research receipt evidence path.
import { createHash } from 'node:crypto';

const VERSION = 'research-receipt-business-v2';
const RESEARCH_CUSTOM_KEYS = Object.freeze([
  'usd_impact_account_id',
  'usd_impact_research_product_id',
  'usd_impact_research_billing_interval',
  'usd_impact_research_checkout_key',
]);
const SUBSCRIPTION_FIELDS = Object.freeze([
  'store_id', 'product_id', 'variant_id', 'customer_id',
  'status', 'cancelled', 'trial_ends_at', 'renews_at',
  'ends_at', 'created_at', 'updated_at', 'test_mode',
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
      ? source[key] : { __research_receipt_missing_v2: true };
  }
  return result;
}
// Nested subscription attributes have their own presence and type contract.
// Pause carries lifecycle-relevant fields; keep its complete signed object so
// future pause changes cannot silently bypass review. Item pricing is projected
// to the fields used for the invoice/access contract, excluding display URLs.
function projectOptionalNested(source, key, allowedKeys = null) {
  if (!Object.prototype.hasOwnProperty.call(source, key)) {
    return { __research_receipt_missing_v2: true };
  }
  const value = source[key];
  if (value === null) return null;
  const object = requireObject(value, 'data.attributes.' + key);
  return allowedKeys === null ? object : project(object, allowedKeys);
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
  // Missing, explicit null and empty custom_data carry different binding
  // evidence; a future webhook reconciliation must not collapse them.
  const customState = !Object.prototype.hasOwnProperty.call(meta, 'custom_data')
    ? 'missing' : meta.custom_data === null ? 'null' : 'object';
  const custom = customState === 'object'
    ? requireObject(meta.custom_data, 'meta.custom_data') : {};
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
      custom_data_state: customState,
      custom_data: project(custom, RESEARCH_CUSTOM_KEYS),
    },
    data: {
      type: data.type,
      id: data.id,
      attributes: {
        ...project(attrs, isSubscription ? SUBSCRIPTION_FIELDS : INVOICE_FIELDS),
        ...(isSubscription ? {
          pause: projectOptionalNested(attrs, 'pause'),
          first_subscription_item: projectOptionalNested(
            attrs, 'first_subscription_item', ['price_id', 'quantity'],
          ),
        } : {}),
      },
    },
  };
  return createHash('sha256').update(JSON.stringify(canonicalize(projected))).digest('hex');
}

export const RESEARCH_RECEIPT_FINGERPRINT_VERSION = VERSION;
