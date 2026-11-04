import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { inspectResearchProviderWindowReview as inspect } from './provider_window_review.mjs';

// Never permit real network from this executable. All GETs are synthetic.
globalThis.fetch = async () => { throw new Error('NETWORK_FORBIDDEN_STAGE_H'); };
const secret = 'synthetic-webhook-secret-stage-h-test';
const binding = {
  accountId:'12345678-1234-4234-8234-123456789abc',storeId:'41',customerId:'78',
  orderId:'51',productId:'99',variantId:'313',subscriptionId:'217',testMode:true,currency:'USD',
};
const attrs = {
  store_id:41,customer_id:78,subscription_id:217,test_mode:true,
  status:'paid',refunded:false,refunded_at:null,refunded_amount:0,
  total:999,currency:'USD',billing_reason:'renewal',
  created_at:'2026-11-05T01:02:03.123455Z',updated_at:'2026-11-05T01:02:03.123456Z',
};
const sub = {
  store_id:41,customer_id:78,order_id:51,product_id:99,variant_id:313,test_mode:true,
  status:'active',cancelled:false,updated_at:'2026-11-05T01:02:03.123456Z',
  renews_at:'2026-12-05T00:00:00.000000Z',ends_at:null,
};
const webhook = Buffer.from(JSON.stringify({meta:{event_name:'subscription_payment_success'},
  data:{type:'subscription-invoices',id:'118',attributes:{...attrs}}}),'utf8');
const signature = createHmac('sha256',secret).update(webhook).digest('hex');
const time1 = '2026-11-05T01:05:00.000000Z';
const time2 = '2026-11-05T01:05:01.000000Z';
const lv = {subscription:3,entitlement:5,receipt:2};
const cycle = {authority:'synthetic_external_reviewer_only',providerAuthenticated:false,
  invoiceId:'118',subscriptionId:'217',accountId:binding.accountId,status:'active',
  periodStart:'2026-11-05T00:00:00.000000Z',periodEnd:sub.renews_at};
let invoice = {...attrs};let subscription = {...sub};let calls=[];
const fetchMock = async (url,options) => {
  calls.push({url,options});
  assert.equal(options.method,'GET');
  assert.equal(options.redirect,'error');
  assert.equal(options.cache,'no-store');
  assert.equal(options.headers.Authorization,'Bearer synthetic-no-real-provider-key');
  if(url==='https://api.lemonsqueezy.com/v1/subscription-invoices/118' && invoice === null) throw Error('synthetic offline');
  if(url==='https://api.lemonsqueezy.com/v1/subscription-invoices/118')
    return new Response(JSON.stringify({data:{type:'subscription-invoices',id:'118',attributes:{...invoice}}}),
      {headers:{'content-type':'application/vnd.api+json'}});
  if(url==='https://api.lemonsqueezy.com/v1/subscriptions/217')
    return new Response(JSON.stringify({data:{type:'subscriptions',id:'217',attributes:{...subscription}}}),
      {headers:{'content-type':'application/vnd.api+json'}});
  throw Error('unexpected URL');
};
const stageGRequest={rawBody:webhook,signatureHeader:signature,
  eventName:'subscription_payment_success',webhookSecret:secret,trustedBinding:binding,
  apiKey:'synthetic-no-real-provider-key',fetchImpl:fetchMock,
  existingPeriodEnd:'2026-11-07T00:00:00.000000Z'};
const base={stageGRequest,firstReadAt:time1,secondReadAt:time2,
  beforeLocalVersion:lv,afterLocalVersion:lv,cycleEvidence:cycle};
let cases=0;
async function expect(reason,patch={},mutator=null){
  invoice={...attrs};subscription={...sub};calls=[];
  const outcome=await inspect({...base,...patch,
    afterFirstRead:mutator??patch.afterFirstRead??(async()=>{})});
  assert.equal(outcome.canMutate,false,reason);
  assert(Object.isFrozen(outcome));
  assert.equal(outcome.reason,reason);
  cases++;return outcome;
}
const positive=await expect('two_mock_provider_reads_equal_and_synthetic_period_start_coherent');
assert.equal(positive.disposition,'candidate_for_human_review_only');
assert.equal(calls.length,4);
assert.equal(positive.remoteAtomicityProven,false);
assert.equal(positive.requiresRealProviderPeriodStartProof,true);
assert.match(positive.evidenceDigest,/^[0-9a-f]{64}$/);
const pending=await expect('paid_cycle_start_provenance_missing',{cycleEvidence:null});
assert.equal(pending.disposition,'pending_reconciliation');
const mutations=[
  ['invoice refunded','second_snapshot_invoice_not_fully_paid_or_has_refund',()=>{invoice.status='refunded';invoice.refunded=true;invoice.refunded_amount=999;}],
  ['invoice partial refund','second_snapshot_invoice_not_fully_paid_or_has_refund',()=>{invoice.refunded_amount=25;}],
  ['invoice new version','provider_evidence_changed_between_reads',()=>{invoice.updated_at='2026-11-05T01:02:05.123456Z';}],
  ['subscription cancelled','provider_evidence_changed_between_reads',()=>{subscription.status='cancelled';subscription.cancelled=true;subscription.ends_at=sub.renews_at;}],
  ['subscription past due','second_snapshot_subscription_state_not_paid_access_candidate',()=>{subscription.status='past_due';}],
  ['subscription end shorter','second_snapshot_subscription_period_or_clock_unverifiable',()=>{subscription.renews_at='2026-11-06T00:00:00.000000Z';}],
  ['subscription different variant','second_snapshot_current_subscription_identity_or_catalog_mismatch',()=>{subscription.variant_id=12;}],
  ['subscription newer version','provider_evidence_changed_between_reads',()=>{subscription.updated_at='2026-11-05T01:02:05.123456Z';}],
  ['invoice query unavailable','second_snapshot_invoice_provider_get_unavailable',()=>{invoice=null;}],
];
for (const [label,reason,change] of mutations){
  const out=await expect(reason,{},async()=>{change();});
  assert(out.disposition==='pending_reconciliation',label);
}
await expect('review_window_clock_invalid_or_too_old',{secondReadAt:'2026-11-05T01:05:15.000000Z'});
await expect('review_window_clock_invalid_or_too_old',{secondReadAt:'2026-11-05T01:04:00.000000Z'});
await expect('review_window_clock_invalid_or_too_old',{firstReadAt:'broken'});
await expect('local_versions_missing_or_mismatched',{afterLocalVersion:{...lv,entitlement:6}});
await expect('local_versions_missing_or_mismatched',{beforeLocalVersion:{...lv,receipt:-1}});
await expect('paid_cycle_scope_or_authority_invalid',{cycleEvidence:{...cycle,accountId:'98765432-1234-4234-8234-123456789abc'}});
await expect('paid_cycle_scope_or_authority_invalid',{cycleEvidence:{...cycle,providerAuthenticated:true}});
await expect('paid_cycle_scope_or_authority_invalid',{cycleEvidence:{...cycle,periodEnd:'2026-12-06T00:00:00.000000Z'}});
await expect('paid_cycle_scope_or_authority_invalid',{cycleEvidence:{...cycle,invoiceId:'999'}});
await expect('paid_cycle_range_invalid',{cycleEvidence:{...cycle,periodStart:'2026-12-06T00:00:00.000000Z'}});
await expect('paid_cycle_range_invalid',{cycleEvidence:{...cycle,periodStart:'bad'}});
await expect('provider_interread_hook_unavailable',{},async()=>{throw Error('synthetic interrupted');});
await expect('review_input_or_transport_missing',{stageGRequest:null});
// This is the irreducible vulnerability in a two-GET protocol: a remote change
// after the FINAL GET cannot be observed locally. The candidate stays NON-MUTATING.
invoice={...attrs};subscription={...sub};
const tooLate=await inspect({...base});
invoice={...attrs,status:'refunded',refunded:true,refunded_amount:999};
assert.equal(tooLate.disposition,'candidate_for_human_review_only');
assert.equal(tooLate.canMutate,false);
assert.equal(tooLate.remoteAtomicityProven,false);
cases++;
// For additional test breadth, alter each mandatory local version independently.
for (const field of ['subscription','entitlement','receipt']) {
  await expect('local_versions_missing_or_mismatched',{afterLocalVersion:{...lv,[field]:lv[field]+1}});
  await expect('local_versions_missing_or_mismatched',{beforeLocalVersion:{...lv,[field]:null}});
}
console.log(`RESEARCH_STAGE_H_PROVIDER_WINDOW_REVIEW_PASS ${cases} offline synthetic scenarios; no remote atomicity or live payment proof`);
