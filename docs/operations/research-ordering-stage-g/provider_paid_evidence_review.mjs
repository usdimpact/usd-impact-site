/**
 * Stage G REVIEW ONLY. Never imported by an app/route or installed in a DB.
 * Offline-testable HMAC + credentialed provider GET evidence screening.
 * Every result is non-authoritative: canMutate is ALWAYS false.
 *
 * Trusted account/checkout binding must be loaded from an internal durable
 * authority in a future app integration, NOT passed from webhook custom_data.
 * The injected fetch is ONLY for offline tests; it cannot certify actual TLS,
 * API-key custody, settlement freshness, or GET-to-DB-commit atomicity.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const ID_RE = /^[1-9][0-9]{0,17}$/;
const UTC_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIG_RE = /^[0-9a-fA-F]{64}$/;
const MAX_WEBHOOK = 131072;
const MAX_RESPONSE = 196608;
const INVOICE_EVENTS = new Set(['subscription_payment_success', 'subscription_payment_recovered']);

const pending = (reason) => Object.freeze({ disposition: 'pending_reconciliation', reason, canMutate: false });

function idString(value) {
  if (typeof value === 'string' && ID_RE.test(value)) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  return null;
}

function utcMicros(value) {
  if (typeof value !== 'string') return null;
  const match = UTC_RE.exec(value);
  if (!match) return null;
  const ms = Date.parse(`${match[1]}Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 19) !== match[1]) return null;
  return BigInt(ms) * 1000n + BigInt((match[2] || '').padEnd(6, '0'));
}

function validBinding(binding) {
  if (!binding || typeof binding !== 'object' || !UUID_RE.test(binding.accountId ?? '')) return false;
  const names = ['storeId', 'customerId', 'orderId', 'productId', 'variantId', 'subscriptionId'];
  if (names.some(name => !idString(binding[name]))) return false;
  if (typeof binding.testMode !== 'boolean') return false;
  if (typeof binding.currency !== 'string' || !/^[A-Z]{3}$/.test(binding.currency)) return false;
  return true;
}

function sameId(a, b) { return idString(a) !== null && idString(a) === idString(b); }
function sha256(input) { return createHash('sha256').update(input).digest('hex'); }

function parseSignedDelivery({ rawBody, signatureHeader, eventName, webhookSecret }) {
  if (!Buffer.isBuffer(rawBody) || rawBody.length < 2 || rawBody.length > MAX_WEBHOOK) {
    return { error: 'raw_webhook_body_invalid' };
  }
  if (typeof webhookSecret !== 'string' || webhookSecret.length < 16 || webhookSecret.length > 256) {
    return { error: 'signing_configuration_unavailable' };
  }
  if (typeof signatureHeader !== 'string' || !SIG_RE.test(signatureHeader)) {
    return { error: 'webhook_signature_missing_or_invalid' };
  }
  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest();
  const actual = Buffer.from(signatureHeader, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(expected, actual)) {
    return { error: 'webhook_signature_invalid' };
  }
  let body;
  try { body = JSON.parse(rawBody.toString('utf8')); }
  catch { return { error: 'signed_webhook_json_invalid' }; }
  if (typeof eventName !== 'string' || body?.meta?.event_name !== eventName) {
    return { error: 'webhook_event_header_body_mismatch' };
  }
  if (!INVOICE_EVENTS.has(eventName)) {
    return { error: 'webhook_not_a_paid_invoice_grant_event' };
  }
  if (body?.data?.type !== 'subscription-invoices' || !idString(body.data.id) ||
      !body.data.attributes || typeof body.data.attributes !== 'object') {
    return { error: 'signed_invoice_object_invalid' };
  }
  return { body, invoiceId: idString(body.data.id), fingerprint: sha256(rawBody), eventName };
}

async function fetchJsonApi({ id, resource, apiKey, fetchImpl }) {
  const url = `https://api.lemonsqueezy.com/v1/${resource}/${id}`;
  let result;
  try {
    result = await fetchImpl(url, {
      method: 'GET', redirect: 'error', cache: 'no-store',
      headers: { Accept: 'application/vnd.api+json', Authorization: `Bearer ${apiKey}` },
    });
  } catch { return { error: 'provider_get_unavailable' }; }
  if (!result || result.status !== 200 || result.ok !== true) return { error: 'provider_get_not_successful' };
  const ct = result.headers?.get?.('content-type') ?? '';
  if (!/^application\/(?:vnd\.api\+json|json)(?:\s*;|\s*$)/i.test(ct)) {
    return { error: 'provider_get_content_type_invalid' };
  }
  let bodyText;
  try { bodyText = await result.text(); }
  catch { return { error: 'provider_get_body_unavailable' }; }
  if (typeof bodyText !== 'string' || Buffer.byteLength(bodyText, 'utf8') > MAX_RESPONSE) {
    return { error: 'provider_get_response_too_large' };
  }
  let body;
  try { body = JSON.parse(bodyText); }
  catch { return { error: 'provider_get_json_invalid' }; }
  const expectedType = resource === 'subscriptions' ? 'subscriptions' : 'subscription-invoices';
  if (body?.data?.type !== expectedType || !sameId(body?.data?.id, id) ||
      !body.data.attributes || typeof body.data.attributes !== 'object') {
    return { error: 'provider_get_resource_identity_invalid' };
  }
  return { data: body.data };
}

/**
 * Accepts only synthetic/injected fetch in Stage G. Even a candidate result
 * requires separate durable journal, GET-to-commit reconciliation and owner
 * approval. NO live entitlement changes or remotely authenticated proof.
 */
export async function inspectResearchPaidEvidenceReview({
  rawBody, signatureHeader, eventName, webhookSecret,
  trustedBinding, apiKey, fetchImpl, existingPeriodEnd = null,
} = {}) {
  const event = parseSignedDelivery({ rawBody, signatureHeader, eventName, webhookSecret });
  if (event.error) return pending(event.error);
  if (!validBinding(trustedBinding)) return pending('trusted_checkout_binding_absent_or_invalid');
  if (typeof apiKey !== 'string' || apiKey.length < 16 || typeof fetchImpl !== 'function') {
    return pending('provider_get_credentials_or_transport_unavailable');
  }
  const a = event.body.data.attributes;
  const binding = trustedBinding;
  if (!sameId(a.store_id, binding.storeId) || !sameId(a.customer_id, binding.customerId) ||
      !sameId(a.subscription_id, binding.subscriptionId) || a.test_mode !== binding.testMode) {
    return pending('signed_invoice_not_bound_to_internal_checkout');
  }
  if (a.status !== 'paid' || a.refunded !== false) return pending('signed_delivery_not_current_payment_proof');
  const signedInvoiceUpdate = utcMicros(a.updated_at);
  if (signedInvoiceUpdate === null) return pending('signed_invoice_clock_invalid');

  const invoice = await fetchJsonApi({ id: event.invoiceId, resource: 'subscription-invoices', apiKey, fetchImpl });
  if (invoice.error) return pending(`invoice_${invoice.error}`);
  const inv = invoice.data.attributes;
  if (!sameId(inv.store_id, binding.storeId) || !sameId(inv.customer_id, binding.customerId) ||
      !sameId(inv.subscription_id, binding.subscriptionId) || inv.test_mode !== binding.testMode) {
    return pending('current_invoice_scope_mismatch');
  }
  if (inv.status !== 'paid' || inv.refunded !== false || inv.refunded_at != null ||
      inv.refunded_amount !== 0) {
    return pending('invoice_not_fully_paid_or_has_refund');
  }
  if (inv.billing_reason !== 'initial' && inv.billing_reason !== 'renewal') {
    return pending('invoice_not_initial_or_renewal_settlement');
  }
  if (!Number.isSafeInteger(inv.total) || inv.total <= 0 || inv.currency !== binding.currency) {
    return pending('invoice_amount_or_currency_requires_manual_review');
  }
  const invoiceTime = utcMicros(inv.updated_at);
  const invoiceCreated = utcMicros(inv.created_at);
  if (invoiceTime === null || invoiceCreated === null || invoiceTime < signedInvoiceUpdate || invoiceTime < invoiceCreated) {
    return pending('provider_invoice_clock_inconsistent');
  }

  const subscription = await fetchJsonApi({ id: idString(binding.subscriptionId), resource: 'subscriptions', apiKey, fetchImpl });
  if (subscription.error) return pending(`subscription_${subscription.error}`);
  const sub = subscription.data.attributes;
  if (!sameId(sub.store_id, binding.storeId) || !sameId(sub.customer_id, binding.customerId) ||
      !sameId(sub.order_id, binding.orderId) || !sameId(sub.product_id, binding.productId) ||
      !sameId(sub.variant_id, binding.variantId) || sub.test_mode !== binding.testMode) {
    return pending('current_subscription_identity_or_catalog_mismatch');
  }
  if (!['active', 'cancelled'].includes(sub.status)) return pending('subscription_state_not_paid_access_candidate');
  if ((sub.status === 'active' && sub.cancelled !== false) ||
      (sub.status === 'cancelled' && sub.cancelled !== true)) {
    return pending('subscription_status_and_cancelled_flag_inconsistent');
  }
  const subscriptionTime = utcMicros(sub.updated_at);
  const periodEnd = sub.status === 'cancelled' ? sub.ends_at : sub.renews_at;
  const horizon = utcMicros(periodEnd);
  const old = existingPeriodEnd == null ? null : utcMicros(existingPeriodEnd);
  if (subscriptionTime === null || horizon === null ||
      (existingPeriodEnd != null && old === null) || (old !== null && horizon < old) ||
      horizon <= invoiceCreated) {
    return pending('subscription_period_or_clock_unverifiable');
  }
  // A signed event and the authenticated-looking injected GETs are still not
  // provider settlement authority or an atomic remote snapshot. Stage G makes
  // no entitlement decision even for a complete, consistent candidate.
  return Object.freeze({
    disposition: 'candidate_for_external_atomic_reconciliation',
    reason: 'signed_delivery_and_current_paid_invoice_match_bound_subscription',
    canMutate: false,
    requiresProviderFreshnessAndDurableJournal: true,
    requiresProviderPeriodStartAuthority: true,
    eventKey: `${event.eventName}:${event.invoiceId}`,
    signedDeliveryHash: event.fingerprint,
    subscriptionId: idString(binding.subscriptionId),
    invoiceId: event.invoiceId,
    providerInvoiceVersion: inv.updated_at,
    providerSubscriptionVersion: sub.updated_at,
    reviewPeriodEnd: periodEnd,
    currentProviderStatus: sub.status,
    // Hash only derived IDs and public-ish status, never bearer/API keys or PII.
    reviewDigest: sha256(JSON.stringify({
      event: event.eventName, invoice: event.invoiceId, sub: idString(binding.subscriptionId),
      invoiceUpdated: inv.updated_at, subUpdated: sub.updated_at, status: sub.status,
      end: periodEnd,
    })),
  });
}
