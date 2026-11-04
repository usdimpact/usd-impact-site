// Research B-2: OFFLINE DESIGN MODEL, not actual SQL/PostgreSQL tests.
// These tests do NOT demonstrate real CAS, locks, migration safety or delivery.
import assert from 'node:assert/strict';
import {
  fingerprintResearchReceiptBusinessEvent,
  RESEARCH_RECEIPT_FINGERPRINT_VERSION,
} from '../src/lib/research-membership-receipt-business-fingerprint.js';

const clone = (value) => structuredClone(value);
const sub = {
  meta: {
    event_name: 'subscription_created', webhook_id: 'delivery-1',
    custom_data: {
      usd_impact_account_id: '123e4567-e89b-42d3-a456-426614174000',
      usd_impact_research_product_id: 'research-membership',
      usd_impact_research_billing_interval: 'monthly',
      usd_impact_research_checkout_key: 'research-checkout-1234',
    },
  },
  data: {
    type: 'subscriptions', id: 'sub_123',
    attributes: {
      store_id: 42, product_id: 99, variant_id: 314, customer_id: 456,
      status: 'active', cancelled: false, trial_ends_at: null,
      billing_reason: 'subscription_created',
      renews_at: '2026-12-01T00:00:00Z', ends_at: null,
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-04T00:00:00Z', test_mode: true,
      user_email: 'synthetic@example.invalid',
      user_name: 'Synthetic User',
      urls: {
        customer_portal: 'https://example.invalid/portal?expires=1&signature=alpha',
        update_payment_method: 'https://example.invalid/billing?expires=1',
      },
    },
  },
};
assert.equal(RESEARCH_RECEIPT_FINGERPRINT_VERSION, 'research-receipt-business-v1');
const original = fingerprintResearchReceiptBusinessEvent(sub);
assert.match(original, /^[a-f0-9]{64}$/);

function changes(mutator) {
  const x = clone(sub);
  mutator(x);
  return fingerprintResearchReceiptBusinessEvent(x);
}
for (const [name, mutation] of [
  ['rotated portal URL', x => { x.data.attributes.urls.customer_portal = 'https://example.invalid/portal?expires=2&signature=beta'; }],
  ['rotated payment method URL', x => { x.data.attributes.urls.update_payment_method = 'https://example.invalid/billing?expires=2'; }],
  ['changed webhook ID', x => { x.meta.webhook_id = 'delivery-2'; }],
  ['different buyer email', x => { x.data.attributes.user_email = 'other@example.invalid'; }],
  ['different buyer name', x => { x.data.attributes.user_name = 'Different Name'; }],
  ['unknown signed presentation metadata', x => { x.meta.delivery_trace = 'other-destination'; }],
]) {
  assert.equal(changes(mutation), original, name + ' must not block business-identical retry');
}
const reorder = {
  data: {
    attributes: Object.fromEntries(Object.entries(sub.data.attributes).reverse()),
    id: sub.data.id, type: sub.data.type,
  },
  meta: {
    custom_data: Object.fromEntries(Object.entries(sub.meta.custom_data).reverse()),
    webhook_id: sub.meta.webhook_id,
    event_name: sub.meta.event_name,
  },
};
assert.equal(fingerprintResearchReceiptBusinessEvent(reorder), original, 'key order must not change fingerprint');

for (const [name, mutator] of [
  ['account binding', x => { x.meta.custom_data.usd_impact_account_id = '223e4567-e89b-42d3-a456-426614174000'; }],
  ['product binding', x => { x.meta.custom_data.usd_impact_research_product_id = 'other'; }],
  ['billing interval binding', x => { x.meta.custom_data.usd_impact_research_billing_interval = 'annual'; }],
  ['checkout key binding', x => { x.meta.custom_data.usd_impact_research_checkout_key = 'other'; }],
  ['store', x => { x.data.attributes.store_id = 41; }],
  ['product', x => { x.data.attributes.product_id = 98; }],
  ['variant', x => { x.data.attributes.variant_id = 315; }],
  ['customer', x => { x.data.attributes.customer_id = 4567; }],
  ['status', x => { x.data.attributes.status = 'past_due'; }],
  ['billing reason', x => { x.data.attributes.billing_reason = 'subscription_updated'; }],
  ['cancelled', x => { x.data.attributes.cancelled = true; }],
  ['trial end', x => { x.data.attributes.trial_ends_at = '2026-11-02T00:00:00Z'; }],
  ['renewal date', x => { x.data.attributes.renews_at = '2027-01-01T00:00:00Z'; }],
  ['access end date', x => { x.data.attributes.ends_at = '2026-11-20T00:00:00Z'; }],
  ['creation time', x => { x.data.attributes.created_at = '2026-11-02T00:00:00Z'; }],
  ['update time', x => { x.data.attributes.updated_at = '2026-11-05T00:00:00Z'; }],
  ['test mode', x => { x.data.attributes.test_mode = false; }],
  ['event name', x => { x.meta.event_name = 'subscription_cancelled'; }],
  ['provider object id', x => { x.data.id = 'sub_999'; }],
]) {
  assert.notEqual(changes(mutator), original, name + ' is protected business evidence');
}
assert.notEqual(changes(x => { delete x.data.attributes.ends_at; }), original, 'missing versus explicit null');
assert.notEqual(changes(x => { delete x.data.attributes.billing_reason; }), original, 'missing billing reason must differ from signed billing reason');
assert.throws(() => changes(x => { x.meta.custom_data.usd_impact_future_account_binding = 'secret'; }), TypeError);
assert.throws(() => fingerprintResearchReceiptBusinessEvent({ data: sub.data }), TypeError);

const invoice = {
  meta: { event_name: 'subscription_payment_refunded', custom_data: {} },
  data: {
    type: 'subscription-invoices', id: 'inv_1',
    attributes: {
      store_id: 42, test_mode: true, subscription_id: 'sub_123',
      status: 'refunded', refunded: true, total: 3900, refunded_amount: 3900,
      billing_reason: 'renewal',
      refunded_at: '2026-11-04T12:00:00Z', created_at: '2026-11-04T11:00:00Z',
      updated_at: '2026-11-04T12:00:00Z', currency: 'USD',
      urls: { invoice: 'https://example.invalid/signed?key=1' },
    },
  },
};
const invoiceHash = fingerprintResearchReceiptBusinessEvent(invoice);
const altUrl = clone(invoice); altUrl.data.attributes.urls.invoice = 'https://example.invalid/signed?key=2';
assert.equal(fingerprintResearchReceiptBusinessEvent(altUrl), invoiceHash);
for (const key of ['subscription_id','status','refunded','total','refunded_amount','refunded_at','created_at','updated_at','currency','store_id','test_mode','billing_reason']) {
  const altered = clone(invoice);
  const prior = altered.data.attributes[key];
  altered.data.attributes[key] = typeof prior === 'number' ? prior + 1 : typeof prior === 'boolean' ? !prior : String(prior) + '2';
  assert.notEqual(fingerprintResearchReceiptBusinessEvent(altered), invoiceHash, 'invoice ' + key + ' must be fingerprinted');
}

const missingInvoiceBillingReason = clone(invoice);
delete missingInvoiceBillingReason.data.attributes.billing_reason;
assert.notEqual(fingerprintResearchReceiptBusinessEvent(missingInvoiceBillingReason), invoiceHash,
  'invoice missing billing reason must be distinct from signed billing reason');

// Prospective B-2 DESIGN MODEL ONLY; this does not execute the real DB.
// The current shared SQL is known to violate these properties.
const events = [];
const state = { status: null, payloadHash: null, attempt: 0, lease: null };
function begin(hash, lease) {
  if (state.payloadHash && hash !== state.payloadHash) {
    events.push({kind:'payload_conflict', attempt:state.attempt});
    return {status:'conflict', shouldProcess:false};
  }
  if (['processed','ignored'].includes(state.status)) {
    return {status:'duplicate', shouldProcess:false};
  }
  if (state.lease !== null) {
    return {status:'in_progress', shouldProcess:false};
  }
  state.attempt += 1;
  state.status = 'received';
  state.payloadHash = hash;
  state.lease = lease;
  return {status:'received', shouldProcess:true, attempt:state.attempt, lease};
}
function finish(receipt, result, errorCode = null) {
  // Proposed compare-and-swap: a stale worker cannot alter terminal evidence.
  if (!receipt.shouldProcess || receipt.attempt !== state.attempt ||
    receipt.lease !== state.lease || state.status !== 'received') return false;
  state.status = result;
  state.lease = null;
  if (errorCode) events.push({kind:'failed', code:errorCode, attempt:receipt.attempt});
  return true;
}
const a = begin(original, 'lease-A');
assert.equal(a.shouldProcess,true);
assert.equal(begin(original, 'lease-B').status,'in_progress', 'RC1: second worker must not process');
assert.equal(finish(a,'processed'),true);
assert.equal(finish(a,'failed','DUPLICATE_PAID_SUBSCRIPTION'),false,'RC2: stale finish cannot overwrite success');
assert.equal(state.status,'processed');
assert.equal(begin(original,'lease-C').status,'duplicate');
assert.equal(begin(changes(x=>{x.data.attributes.status='past_due';}), 'lease-D').status,'conflict');
assert.equal(state.status,'processed','terminal semantic conflict must not be accepted');

const second = {status:null, payloadHash:null, attempt:0, lease:null};
function simulatedFailureAndRetry() {
  second.attempt = 1; second.status = 'failed';
  events.push({kind:'failed', code:'DUPLICATE_PAID_SUBSCRIPTION', attempt:1});
  second.attempt = 2; second.status = 'received';
  // Worker dies before finish. Append-only evidence still exists.
  assert.ok(events.some(x=>x.code==='DUPLICATE_PAID_SUBSCRIPTION'),'RC8: failure not erased');
}
simulatedFailureAndRetry();
assert.equal(second.status,'received');
console.log('Research B-2 offline fingerprint and CAS/journal DESIGN MODEL passed (NOT SQL or PostgreSQL concurrency evidence).');
