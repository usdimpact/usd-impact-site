import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { inspectResearchPaidEvidenceReview as inspect } from './provider_paid_evidence_review.mjs';

// Synthetic only. No production credentials, no customer data, no network.
const SECRET = 'synthetic-stage-g-webhook-secret-never-live';
const API_KEY = 'synthetic-stage-g-bearer-never-live';
const BIND = Object.freeze({
  accountId: '00000000-0000-4000-8000-000000000041',
  storeId: '41', customerId: '78', orderId: '155', productId: '99',
  variantId: '313', subscriptionId: '217', testMode: true, currency: 'USD',
});
const attrsEvent = {
  store_id: 41, customer_id: 78, subscription_id: 217, test_mode: true,
  status: 'paid', refunded: false, updated_at: '2026-11-05T01:02:03.123456Z',
};
const baseEvent = {
  meta: { event_name: 'subscription_payment_success', custom_data: { account_id: 'untrusted-do-not-use' } },
  data: { type: 'subscription-invoices', id: '517', attributes: attrsEvent },
};
const invoiceAttrs = {
  store_id: 41, customer_id: 78, subscription_id: 217, test_mode: true,
  status: 'paid', refunded: false, refunded_at: null, refunded_amount: 0,
  billing_reason: 'renewal', total: 1299, currency: 'USD',
  created_at: '2026-11-04T00:00:00.000000Z', updated_at: '2026-11-05T01:02:03.123456Z',
};
const subAttrs = {
  store_id: 41, customer_id: 78, order_id: 155, product_id: 99,
  variant_id: 313, test_mode: true, status: 'active', cancelled: false,
  updated_at: '2026-11-05T01:02:04.000001Z', renews_at: '2026-12-05T00:00:00.000000Z', ends_at: null,
};
const clone = (obj) => structuredClone(obj);
const sig = body => createHmac('sha256', SECRET).update(body).digest('hex');
const makeResponse = (type, id, attrs, status=200, contentType='application/vnd.api+json') =>
  new Response(JSON.stringify({ data: { type, id, attributes: attrs } }), { status, headers: { 'content-type': contentType } });

let checks = 0;
const touched = [];
globalThis.fetch = async () => { throw new Error('UNEXPECTED REAL NETWORK IN STAGE G'); };

async function scenario(name, reason, options = {}) {
  const ev = clone(baseEvent);
  if (options.eventChange) options.eventChange(ev);
  const body = options.body ?? Buffer.from(JSON.stringify(ev));
  const signature = options.signature ?? (Buffer.isBuffer(body) ? sig(body) : '0'.repeat(64));
  const eventName = options.eventName ?? ev.meta.event_name;
  let calls = [];
  const fetchImpl = async (url, req) => {
    calls.push(url);
    touched.push(url);
    assert.equal(req.method, 'GET', `${name} method`);
    assert.equal(req.redirect, 'error', `${name} no redirects`);
    assert.equal(req.cache, 'no-store', `${name} no caching`);
    assert.equal(req.headers.Accept, 'application/vnd.api+json', `${name} jsonapi`);
    assert.equal(req.headers.Authorization, `Bearer ${API_KEY}`, `${name} bearer`);
    assert.ok(/^https:\/\/api\.lemonsqueezy\.com\/v1\/(?:subscription-invoices|subscriptions)\/\d+$/.test(url), `${name} pinned API host`);
    if (options.fetchError) throw new Error('synthetic-offline-failure');
    if (url.endsWith('/subscription-invoices/517')) {
      if (options.invoiceResponse) return options.invoiceResponse;
      let invoice = clone(invoiceAttrs); if (options.invoiceChange) options.invoiceChange(invoice);
      return makeResponse('subscription-invoices', options.invoiceId ?? '517', invoice);
    }
    if (url.endsWith('/subscriptions/217')) {
      if (options.subscriptionResponse) return options.subscriptionResponse;
      let subscription = clone(subAttrs); if (options.subscriptionChange) options.subscriptionChange(subscription);
      return makeResponse('subscriptions', options.subscriptionId ?? '217', subscription);
    }
    throw new Error(`unexpected mocked resource ${url}`);
  };
  const r = await inspect({
    rawBody: body, signatureHeader: signature, eventName, webhookSecret: options.webhookSecret ?? SECRET,
    trustedBinding: Object.hasOwn(options, 'binding') ? options.binding : BIND, apiKey: options.apiKey ?? API_KEY,
    fetchImpl: options.fetchImpl ?? fetchImpl,
    existingPeriodEnd: options.existingPeriodEnd === undefined ? '2026-11-05T00:00:00.000000Z' : options.existingPeriodEnd,
  });
  assert.equal(Object.isFrozen(r), true, `${name}: immutable result`);
  assert.equal(r.canMutate, false, `${name}: NEVER authorizes DB writes`);
  assert.equal(r.reason, reason, `${name}: expected disposition reason`);
  if (reason === 'signed_delivery_and_current_paid_invoice_match_bound_subscription') {
    assert.equal(r.disposition, 'candidate_for_external_atomic_reconciliation');
    assert.equal(r.requiresProviderFreshnessAndDurableJournal, true);
    assert.equal(r.requiresProviderPeriodStartAuthority, true);
    assert.match(r.reviewDigest, /^[0-9a-f]{64}$/);
    assert.match(r.signedDeliveryHash, /^[0-9a-f]{64}$/);
    assert.equal(r.eventKey, `${eventName}:517`);
    assert.equal(r.subscriptionId, '217');
    assert.equal(calls.length, 2, `${name}: both provider GET resources required`);
    assert.deepEqual(calls, [
      'https://api.lemonsqueezy.com/v1/subscription-invoices/517',
      'https://api.lemonsqueezy.com/v1/subscriptions/217',
    ]);
  } else {
    assert.equal(r.disposition, 'pending_reconciliation');
  }
  if (options.expectedCalls !== undefined) assert.equal(calls.length, options.expectedCalls, `${name}: number of GETs`);
  checks++;
  return r;
}

const ok='signed_delivery_and_current_paid_invoice_match_bound_subscription';
const base=await scenario('signed raw webhook + two matching provider objects', ok);
assert.equal(base.reviewPeriodEnd, subAttrs.renews_at);
assert.equal(base.currentProviderStatus, 'active');
assert.equal(base.eventKey, 'subscription_payment_success:517');
await scenario('paid recovered event',ok,{eventChange:e=>{e.meta.event_name='subscription_payment_recovered';}});
await scenario('cancelled paid grace period',ok,{subscriptionChange:s=>{s.status='cancelled';s.cancelled=true;s.ends_at='2026-12-05T00:00:00.000000Z';}});
await scenario('untrusted webhook custom_data account is ignored',ok,{eventChange:e=>{e.meta.custom_data.account_id='another-account';}});
await scenario('no prior period known - still not mutating',ok,{existingPeriodEnd:null});

// Raw-body authenticity and event/resource typing: no remote calls permitted.
await scenario('missing raw bytes','raw_webhook_body_invalid',{body:'not-bytes',expectedCalls:0});
await scenario('too-large raw bytes','raw_webhook_body_invalid',{body:Buffer.alloc(131073,65),expectedCalls:0});
await scenario('empty raw bytes','raw_webhook_body_invalid',{body:Buffer.alloc(0),expectedCalls:0});
await scenario('signature absent','webhook_signature_missing_or_invalid',{signature:'',expectedCalls:0});
await scenario('signature non-hex','webhook_signature_missing_or_invalid',{signature:'G'.repeat(64),expectedCalls:0});
await scenario('signature length incorrect','webhook_signature_missing_or_invalid',{signature:'1'.repeat(62),expectedCalls:0});
await scenario('bad signature','webhook_signature_invalid',{signature:'0'.repeat(64),expectedCalls:0});
await scenario('wrong secret','webhook_signature_invalid',{webhookSecret:'different-webhook-secret-of-right-size',expectedCalls:0});
await scenario('invalid signing config','signing_configuration_unavailable',{webhookSecret:'short',expectedCalls:0});
await scenario('event header/body disagreement','webhook_event_header_body_mismatch',{eventName:'subscription_payment_recovered',expectedCalls:0});
await scenario('not an invoice paid-grant event','webhook_not_a_paid_invoice_grant_event',{eventChange:e=>e.meta.event_name='subscription_updated',expectedCalls:0});
await scenario('refund event never grants','webhook_not_a_paid_invoice_grant_event',{eventChange:e=>e.meta.event_name='subscription_payment_refunded',expectedCalls:0});
await scenario('failed payment never grants','webhook_not_a_paid_invoice_grant_event',{eventChange:e=>e.meta.event_name='subscription_payment_failed',expectedCalls:0});
await scenario('wrong event object type','signed_invoice_object_invalid',{eventChange:e=>e.data.type='subscriptions',expectedCalls:0});
await scenario('invalid invoice id','signed_invoice_object_invalid',{eventChange:e=>e.data.id='../517',expectedCalls:0});
await scenario('signed payload invalid JSON','signed_webhook_json_invalid',{body:Buffer.from('{bad'),expectedCalls:0});
await scenario('signed invoice store mismatch','signed_invoice_not_bound_to_internal_checkout',{eventChange:e=>e.data.attributes.store_id=42,expectedCalls:0});
await scenario('signed invoice subscription mismatch','signed_invoice_not_bound_to_internal_checkout',{eventChange:e=>e.data.attributes.subscription_id=218,expectedCalls:0});
await scenario('signed invoice test mode mismatch','signed_invoice_not_bound_to_internal_checkout',{eventChange:e=>e.data.attributes.test_mode=false,expectedCalls:0});
await scenario('signed delivery was not paid','signed_delivery_not_current_payment_proof',{eventChange:e=>e.data.attributes.status='pending',expectedCalls:0});
await scenario('signed invoice already refunded','signed_delivery_not_current_payment_proof',{eventChange:e=>e.data.attributes.refunded=true,expectedCalls:0});
await scenario('signed invoice clock invalid','signed_invoice_clock_invalid',{eventChange:e=>e.data.attributes.updated_at='yesterday',expectedCalls:0});
await scenario('no trusted checkout','trusted_checkout_binding_absent_or_invalid',{binding:null,expectedCalls:0});
await scenario('forged account id in caller config','trusted_checkout_binding_absent_or_invalid',{binding:{...BIND,accountId:'not-an-account'},expectedCalls:0});
await scenario('wrong trusted product identifier','trusted_checkout_binding_absent_or_invalid',{binding:{...BIND,productId:'../99'},expectedCalls:0});
await scenario('provider key missing','provider_get_credentials_or_transport_unavailable',{apiKey:'short',expectedCalls:0});

// Provider invoice GET is explicitly authenticated *by the future transport*.
await scenario('provider GET unavailable','invoice_provider_get_unavailable',{fetchError:true,expectedCalls:1});
await scenario('provider invoice 503','invoice_provider_get_not_successful',{invoiceResponse:makeResponse('subscription-invoices','517',invoiceAttrs,503),expectedCalls:1});
await scenario('provider invoice 200 bad content type','invoice_provider_get_content_type_invalid',{invoiceResponse:makeResponse('subscription-invoices','517',invoiceAttrs,200,'text/html'),expectedCalls:1});
await scenario('provider invoice JSON invalid','invoice_provider_get_json_invalid',{invoiceResponse:new Response('{bad',{headers:{'content-type':'application/json'}}),expectedCalls:1});
await scenario('provider invoice oversized','invoice_provider_get_response_too_large',{invoiceResponse:new Response(' '.repeat(197000),{headers:{'content-type':'application/json'}}),expectedCalls:1});
await scenario('provider invoice different ID','invoice_provider_get_resource_identity_invalid',{invoiceId:'518',expectedCalls:1});
await scenario('provider invoice cross-customer','current_invoice_scope_mismatch',{invoiceChange:i=>i.customer_id=100,expectedCalls:1});
await scenario('provider invoice cross-subscription','current_invoice_scope_mismatch',{invoiceChange:i=>i.subscription_id=218,expectedCalls:1});
await scenario('provider invoice wrong environment','current_invoice_scope_mismatch',{invoiceChange:i=>i.test_mode=false,expectedCalls:1});
await scenario('invoice no longer paid','invoice_not_fully_paid_or_has_refund',{invoiceChange:i=>i.status='pending',expectedCalls:1});
await scenario('invoice later fully refunded','invoice_not_fully_paid_or_has_refund',{invoiceChange:i=>{i.status='refunded';i.refunded=true;i.refunded_amount=1299;},expectedCalls:1});
await scenario('invoice later partially refunded','invoice_not_fully_paid_or_has_refund',{invoiceChange:i=>{i.status='partial_refund';i.refunded_amount=100;},expectedCalls:1});
await scenario('invoice refund metadata exists','invoice_not_fully_paid_or_has_refund',{invoiceChange:i=>i.refunded_at='2026-11-05T01:03:00Z',expectedCalls:1});
await scenario('invoice updated/prorated not initial renewal','invoice_not_initial_or_renewal_settlement',{invoiceChange:i=>i.billing_reason='updated',expectedCalls:1});
await scenario('invoice total zero requires review','invoice_amount_or_currency_requires_manual_review',{invoiceChange:i=>i.total=0,expectedCalls:1});
await scenario('invoice wrong currency requires review','invoice_amount_or_currency_requires_manual_review',{invoiceChange:i=>i.currency='EUR',expectedCalls:1});
await scenario('invoice fractional cents requires review','invoice_amount_or_currency_requires_manual_review',{invoiceChange:i=>i.total=10.5,expectedCalls:1});
await scenario('provider invoice earlier than signed delivery','provider_invoice_clock_inconsistent',{invoiceChange:i=>i.updated_at='2026-11-05T01:02:03.123455Z',expectedCalls:1});
await scenario('provider invoice before its creation','provider_invoice_clock_inconsistent',{invoiceChange:i=>i.created_at='2026-11-06T01:00:00Z',expectedCalls:1});

// Provider subscription must match separately trusted internal account binding.
await scenario('provider subscription 401','subscription_provider_get_not_successful',{subscriptionResponse:makeResponse('subscriptions','217',subAttrs,401),expectedCalls:2});
await scenario('provider subscription 429','subscription_provider_get_not_successful',{subscriptionResponse:makeResponse('subscriptions','217',subAttrs,429),expectedCalls:2});
await scenario('provider subscription wrong object id','subscription_provider_get_resource_identity_invalid',{subscriptionId:'218',expectedCalls:2});
await scenario('provider subscription wrong store','current_subscription_identity_or_catalog_mismatch',{subscriptionChange:s=>s.store_id=42,expectedCalls:2});
await scenario('provider subscription cross-customer','current_subscription_identity_or_catalog_mismatch',{subscriptionChange:s=>s.customer_id=55,expectedCalls:2});
await scenario('provider subscription cross-order','current_subscription_identity_or_catalog_mismatch',{subscriptionChange:s=>s.order_id=1000,expectedCalls:2});
await scenario('provider subscription wrong product','current_subscription_identity_or_catalog_mismatch',{subscriptionChange:s=>s.product_id=101,expectedCalls:2});
await scenario('provider subscription wrong variant','current_subscription_identity_or_catalog_mismatch',{subscriptionChange:s=>s.variant_id=101,expectedCalls:2});
await scenario('provider subscription changed to production mode','current_subscription_identity_or_catalog_mismatch',{subscriptionChange:s=>s.test_mode=false,expectedCalls:2});
await scenario('subscription past_due not grant','subscription_state_not_paid_access_candidate',{subscriptionChange:s=>s.status='past_due',expectedCalls:2});
await scenario('subscription expired not grant','subscription_state_not_paid_access_candidate',{subscriptionChange:s=>s.status='expired',expectedCalls:2});
await scenario('subscription trial not settlement','subscription_state_not_paid_access_candidate',{subscriptionChange:s=>s.status='on_trial',expectedCalls:2});
await scenario('subscription active but cancelled flag true','subscription_status_and_cancelled_flag_inconsistent',{subscriptionChange:s=>s.cancelled=true,expectedCalls:2});
await scenario('subscription cancelled but cancelled flag false','subscription_status_and_cancelled_flag_inconsistent',{subscriptionChange:s=>{s.status='cancelled';s.cancelled=false;s.ends_at='2026-12-05T00:00:00Z';},expectedCalls:2});
await scenario('paid term cannot shrink','subscription_period_or_clock_unverifiable',{existingPeriodEnd:'2027-01-05T00:00:00.000000Z',expectedCalls:2});
await scenario('no active renews_at','subscription_period_or_clock_unverifiable',{subscriptionChange:s=>s.renews_at=null,expectedCalls:2});
await scenario('invalid microsecond timestamp','subscription_period_or_clock_unverifiable',{subscriptionChange:s=>s.updated_at='2026-11-05T01:02:04.1234567Z',expectedCalls:2});
await scenario('invalid previous period','subscription_period_or_clock_unverifiable',{existingPeriodEnd:'bad time',expectedCalls:2});
await scenario('subscription paid end before invoice created','subscription_period_or_clock_unverifiable',{subscriptionChange:s=>s.renews_at='2026-11-03T00:00:00Z',expectedCalls:2});
await scenario('cancelled but no ends_at','subscription_period_or_clock_unverifiable',{subscriptionChange:s=>{s.status='cancelled';s.cancelled=true;s.ends_at=null;},expectedCalls:2});

// Stable signed deliveries vs untrusted replay journal; must persist and compare
// event key and raw digest in future authoritative storage before ANY mutation.
const once=await scenario('repeated identical delivery candidate',ok);
assert.equal(once.eventKey,base.eventKey);
assert.equal(once.signedDeliveryHash,base.signedDeliveryHash);
const changed=await scenario('different signed invoice body same event key',ok,{eventChange:e=>{e.meta.custom_data.memo='different-but-valid-hmac';}});
assert.equal(changed.eventKey,base.eventKey);
assert.notEqual(changed.signedDeliveryHash,base.signedDeliveryHash);
assert.equal(changed.canMutate,false);
assert.ok(touched.every(x=>x.startsWith('https://api.lemonsqueezy.com/v1/')));

console.log(`RESEARCH_STAGE_G_OFFLINE_PAID_EVIDENCE_PASS ${checks} offline synthetic cases; no provider or database traffic; all canMutate=false`);
