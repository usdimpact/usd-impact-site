import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {inspectResearchInvoiceCustodyReview as inspect} from './invoice_custody_review.mjs';
import {inspectResearchPaidEvidenceReview as inspectG} from '../research-ordering-stage-g/provider_paid_evidence_review.mjs';

// Synthetic only. Every network call must be injected by the fixture.
globalThis.fetch=async()=>{throw Error('STAGE_J_UNEXPECTED_REAL_NETWORK');};
const SECRET='synthetic-stage-j-signed-webhook-secret';
const API='synthetic-stage-j-bearer-never-live';
const b={accountId:'12345678-1234-4234-8234-123456789abc',storeId:'41',
  customerId:'78',orderId:'51',productId:'99',variantId:'313',
  subscriptionId:'217',testMode:true,currency:'USD'};
const invoiceBase={store_id:41,customer_id:78,subscription_id:217,test_mode:true,
  status:'paid',refunded:false,refunded_at:null,refunded_amount:0,
  billing_reason:'renewal',total:1299,currency:'USD',
  created_at:'2026-11-05T01:02:03.123455Z',updated_at:'2026-11-05T01:02:03.123456Z'};
const subBase={store_id:41,customer_id:78,order_id:51,product_id:99,
  variant_id:313,test_mode:true,status:'active',cancelled:false,
  updated_at:'2026-11-05T01:02:03.123456Z',
  renews_at:'2026-12-05T00:00:00.000000Z',ends_at:null};
const cycle={authority:'synthetic_external_reviewer_only',
  providerAuthenticated:false,invoiceId:'118',subscriptionId:'217',
  accountId:b.accountId,status:'active',
  periodStart:'2026-11-05T00:00:00.000000Z',periodEnd:subBase.renews_at};
const link={authority:'synthetic_invoice_cycle_link_only',providerAuthenticated:false,
  invoiceId:'118',subscriptionId:'217',accountId:b.accountId,
  periodStart:cycle.periodStart,periodEnd:cycle.periodEnd,billingReason:'renewal'};
const quote={source:'synthetic_durable_quote_review_only',accountId:b.accountId,
  storeId:'41',customerId:'78',subscriptionId:'217',invoiceId:'118',
  productId:'99',variantId:'313',currency:'USD',
  expectedTotalCents:1299,quoteId:'synthetic-quote-118',
  quoteKind:'issued_renewal_terms',priorEntitlementVersion:5,subscriptionVersion:3};
const transition={kind:'renewal',fromState:'active',toState:'active',subscriptionVersion:3};
const lv={subscription:3,entitlement:5,receipt:2};
function signed(eventName='subscription_payment_success'){
  const body=Buffer.from(JSON.stringify({meta:{event_name:eventName},
    data:{type:'subscription-invoices',id:'118',attributes:invoiceBase}}),'utf8');
  const signatureHeader=createHmac('sha256',SECRET).update(body).digest('hex');
  return {rawBody:body,signatureHeader,eventName};
}
let cases=0;
async function run(label,reason,{eventName='subscription_payment_success',
  invoiceChange=null,subChange=null, afterFirstRead=null, trustedQuote=quote,
  expectedTransition=transition, syntheticCycleLink=link, priorInvoiceReceipt=null,
  cycleEvidence=cycle, localBefore=lv,localAfter=lv,
  mutationOnSecondInvoice=false
}={}) {
  let invoice=structuredClone(invoiceBase);
  let sub=structuredClone(subBase);
  if(invoiceChange)invoiceChange(invoice);
  if(subChange)subChange(sub);
  let invoiceGets=0, calls=0;
  const fetchImpl=async(url,req)=>{
    calls++;
    assert.equal(req.method,'GET');
    assert.equal(req.redirect,'error');
    assert.equal(req.cache,'no-store');
    assert.equal(req.headers.Authorization,'Bearer '+API);
    if(url==='https://api.lemonsqueezy.com/v1/subscription-invoices/118') {
      invoiceGets++;
      const attrs=structuredClone(invoice);
      if(mutationOnSecondInvoice&&invoiceGets===2)attrs.total+=1;
      return new Response(JSON.stringify({data:{type:'subscription-invoices',
        id:'118',attributes:attrs}}),{headers:{'content-type':'application/vnd.api+json'}});
    }
    if(url==='https://api.lemonsqueezy.com/v1/subscriptions/217') {
      return new Response(JSON.stringify({data:{type:'subscriptions',
        id:'217',attributes:sub}}),{headers:{'content-type':'application/vnd.api+json'}});
    }
    throw Error('unmocked provider resource: '+url);
  };
  const stageGRequest={...signed(eventName),webhookSecret:SECRET,
    trustedBinding:b,apiKey:API,fetchImpl,
    existingPeriodEnd:'2026-11-07T00:00:00.000000Z'};
  const result=await inspect({stageHRequest:{
    stageGRequest,
    firstReadAt:'2026-11-05T01:05:00.000000Z',
    secondReadAt:'2026-11-05T01:05:01.000000Z',
    beforeLocalVersion:localBefore,afterLocalVersion:localAfter,
    cycleEvidence,
    afterFirstRead:async()=>{if(afterFirstRead)await afterFirstRead({invoice,sub});},
  },trustedQuote,expectedTransition,syntheticCycleLink,priorInvoiceReceipt});
  assert.equal(result.canMutate,false,label);
  assert.equal(result.providerSettlementProven,false,label);
  assert.equal(result.remoteAtomicityProven,false,label);
  assert.equal(result.providerCycleStartProven,false,label);
  assert(Object.isFrozen(result),label);
  assert.equal(result.reason,reason,label);
  assert(calls===0||calls===4||calls<4,label);
  cases++;
  return result;
}
const ok='synthetic_quote_transition_and_invoice_cycle_shapes_match';
const first=await run('matching synthetic quote+renewal+two GETs',ok);
assert.equal(first.disposition,'candidate_for_human_review_only');
assert.equal(first.canonicalInvoiceKey,'41:217:118');
assert.equal(first.invoiceTotalCents,1299);
assert.equal(first.invoiceBillingReason,'renewal');
assert.match(first.invoiceSnapshotDigest,/^[0-9a-f]{64}$/);
assert.equal(first.requiresDurableAtomicInvoiceCustody,true);

// NG1: documented success + recovered companion event for ONE paid invoice.
// Old Stage G has two distinct event keys; Stage J canonical invoice key must
// be identical, with a single original and separate delivery audit.
const successEvent=await inspectG({...signed(),webhookSecret:SECRET,trustedBinding:b,
  apiKey:API,existingPeriodEnd:'2026-11-07T00:00:00.000000Z',
  fetchImpl:async url=>{
    const isInvoice=url.includes('/subscription-invoices/');
    return new Response(JSON.stringify({data:{type:isInvoice?'subscription-invoices':'subscriptions',
      id:isInvoice?'118':'217',attributes:isInvoice?invoiceBase:subBase}}),
      {headers:{'content-type':'application/vnd.api+json'}});
  }});
const recoveredEvent=await inspectG({...signed('subscription_payment_recovered'),
  webhookSecret:SECRET,trustedBinding:b,apiKey:API,
  existingPeriodEnd:'2026-11-07T00:00:00.000000Z',
  fetchImpl:async url=>{
    const isInvoice=url.includes('/subscription-invoices/');
    return new Response(JSON.stringify({data:{type:isInvoice?'subscription-invoices':'subscriptions',
      id:isInvoice?'118':'217',attributes:isInvoice?invoiceBase:subBase}}),
      {headers:{'content-type':'application/vnd.api+json'}});
  }});
assert.notEqual(successEvent.eventKey,recoveredEvent.eventKey);
const recovered=await run('NG1 same invoice recovered companion deduped',
  'same_invoice_already_seen_no_second_effect',
  {eventName:'subscription_payment_recovered',priorInvoiceReceipt:first});
assert.equal(recovered.disposition,'duplicate_invoice_held');
assert.equal(recovered.canonicalInvoiceKey,first.canonicalInvoiceKey);
assert.equal(recovered.invoiceSnapshotDigest,first.invoiceSnapshotDigest);
const conflicting=await run('NG1 conflicting same invoice version quarantined',
  'same_invoice_key_conflicting_provider_evidence',
  {priorInvoiceReceipt:first,invoiceChange:i=>{i.updated_at='2026-11-05T01:02:03.123457Z';}});
assert.equal(conflicting.disposition,'quarantined_conflict');
await run('NG1 prior receipt with missing digest held','prior_invoice_custody_unverifiable',
  {priorInvoiceReceipt:{canonicalInvoiceKey:'41:217:118'}});
await run('NG1 prior receipt belongs to different invoice held','prior_invoice_custody_unverifiable',
  {priorInvoiceReceipt:{...first,canonicalInvoiceKey:'41:217:119'}});

// NG2: current subscription next-renewal date is NOT a certificate that an
// old invoice pays this current cycle. Synthetic link mismatch must hold.
await run('NG2 old invoice cannot claim new cycle without matching source',
 'invoice_to_current_paid_cycle_link_missing_or_inconsistent',
 {invoiceChange:i=>{i.created_at='2026-10-05T01:00:00.000000Z';},
  syntheticCycleLink:{...link,invoiceId:'117'}});
await run('NG2 synthetic cycle witness absent',
 'invoice_to_current_paid_cycle_link_missing_or_inconsistent',
 {syntheticCycleLink:null});
await run('NG2 synthetic cycle period start mismatched',
 'invoice_to_current_paid_cycle_link_missing_or_inconsistent',
 {syntheticCycleLink:{...link,periodStart:'2026-10-05T00:00:00.000000Z'}});
await run('NG2 fake real provider-authenticated flag not accepted',
 'invoice_to_current_paid_cycle_link_missing_or_inconsistent',
 {syntheticCycleLink:{...link,providerAuthenticated:true}});
await run('NG2 subscription paid horizon mismatch is rejected upstream',
 'stage_h_not_reconciled_paid_cycle_scope_or_authority_invalid',
 {cycleEvidence:{...cycle,periodEnd:'2027-01-05T00:00:00.000000Z'}});
await run('NG2 remote refund observed mid-window is held upstream',
 'stage_h_not_reconciled_second_snapshot_invoice_not_fully_paid_or_has_refund',
 {afterFirstRead:async({invoice})=>{invoice.status='refunded';invoice.refunded=true;invoice.refunded_amount=1299;}});
// NG3: a 1 cent invoice must not match a 1299 cent issued quote, but do not
// impose a magic hard minimum (legit discounts require authoritative quote).
await run('NG3 one-cent invoice versus issued 1299 quote',
 'invoice_amount_not_bound_to_issued_quote',
 {invoiceChange:i=>{i.total=1;}});
await run('NG3 zero-cent invoice screened by Stage G',
 'stage_h_not_reconciled_first_snapshot_invoice_amount_or_currency_requires_manual_review',
 {invoiceChange:i=>{i.total=0;}});
await run('NG3 wrong expected quote total',
 'invoice_amount_not_bound_to_issued_quote',
 {trustedQuote:{...quote,expectedTotalCents:1399}});
await run('NG3 missing durable quote',
 'durable_invoice_quote_or_scope_missing',{trustedQuote:null});
await run('NG3 forged quote account',
 'durable_invoice_quote_or_scope_missing',
 {trustedQuote:{...quote,accountId:'00000000-0000-4000-8000-000000000041'}});
await run('NG3 quote wrong invoice ID',
 'durable_invoice_quote_or_scope_missing',
 {trustedQuote:{...quote,invoiceId:'119'}});
await run('NG3 changed invoice amount across GETs with unchanged updated_at',
 'invoice_fields_changed_between_provider_reads',{mutationOnSecondInvoice:true});
const discounted=await run('NG3 1 cent exact local quote still cannot grant',
 ok,{invoiceChange:i=>{i.total=1;},trustedQuote:{...quote,expectedTotalCents:1}});
assert.equal(discounted.canMutate,false);

// NG4: billing reason must match the specific intended transition.
await run('NG4 initial invoice cannot silently count as renewal',
 'invoice_billing_reason_transition_mismatch',
 {invoiceChange:i=>{i.billing_reason='initial';}});
await run('NG4 updated/prorated invoice screened by Stage G',
 'stage_h_not_reconciled_first_snapshot_invoice_not_initial_or_renewal_settlement',
 {invoiceChange:i=>{i.billing_reason='updated';}});
await run('NG4 missing transition intent', 'transition_intent_missing',
 {expectedTransition:null});
await run('NG4 active renewal cannot be an initial activation',
 'initial_checkout_intent_not_eligible',
 {expectedTransition:{kind:'first_activation',fromState:'active',
    toState:'active',subscriptionVersion:3}});
await run('NG4 stale subscription version held', 'local_subscription_version_not_bound',
 {expectedTransition:{...transition,subscriptionVersion:4}});
await run('NG4 absent renewal quote prior entitlement version',
 'renewal_terms_or_version_missing',
 {trustedQuote:{...quote,priorEntitlementVersion:undefined}});
const initialQuote={...quote,quoteId:'synthetic-initial-quote-118',
  quoteKind:'issued_initial_checkout',issuedCheckoutIntentState:'pending',
  issuedCheckoutIntentId:'synthetic-intent-118'};
const initialTransition={kind:'first_activation',fromState:'pending',
  toState:'active',subscriptionVersion:3};
const init=await run('NG4 valid initial event only produces human review',ok,
 {invoiceChange:i=>{i.billing_reason='initial';},
  trustedQuote:initialQuote,expectedTransition:initialTransition,
  syntheticCycleLink:{...link,billingReason:'initial'}});
assert.equal(init.canMutate,false);

// Stage H negative proof remains: stale local versions, missing cycle, no real
// transport (external network blocked), every outcome strictly nonmutating.
await run('stale local entitlement version held',
 'stage_h_not_reconciled_local_versions_missing_or_mismatched',
 {localAfter:{...lv,entitlement:6}});
await run('provider cycle witness missing',
 'stage_h_not_reconciled_paid_cycle_start_provenance_missing',
 {cycleEvidence:null});
console.log('RESEARCH_STAGE_J_INVOICE_REVIEW_PASS '+cases+
 ' synthetic NG1-NG4 and negative checks, no provider/database I/O; canMutate=false always');
