import assert from 'node:assert/strict';
import {canonicalInvoiceHandoffV1,inspectConsumedB5InitialReview} from './canonical_contract_review.mjs';
globalThis.fetch=async()=>{throw Error('STAGE_M_NETWORK_FORBIDDEN');};
const golden='ac468f71dbacfea1cb622e3f57a959f1c0a1560b0d31f1c0c107fa18b825c4e7';
const base={provider:'lemon-squeezy',storeId:'41',testMode:true,invoiceId:'118',
  subscriptionId:'217',invoiceSnapshotDigest:'1'.repeat(64),quoteDigest:'2'.repeat(64)};
const out=canonicalInvoiceHandoffV1(base);
assert.equal(out.canonicalBytes,'m1|lemon-squeezy|41|test|118|217|'+
 '1'.repeat(64)+'|'+'2'.repeat(64));
assert.equal(out.digest,golden);
assert.equal(out.canMutate,false);
assert(Object.isFrozen(out));
let cases=1;
for(const mutation of [
 {provider:'other'}, {storeId:'041'}, {storeId:'41|217'},
 {testMode:null}, {invoiceId:'0'}, {invoiceId:'118|119'},
 {subscriptionId:'not-id'}, {invoiceSnapshotDigest:'X'.repeat(64)},
 {quoteDigest:'not-a-hash'}
]){
 assert.throws(()=>canonicalInvoiceHandoffV1({...base,...mutation}),TypeError);
 cases++;
}
for(const mutation of [
 {testMode:false},{invoiceId:'119'},{subscriptionId:'218'},
 {invoiceSnapshotDigest:'3'.repeat(64)},{quoteDigest:'4'.repeat(64)}
]){
 const result=canonicalInvoiceHandoffV1({...base,...mutation});
 assert.notEqual(result.digest,golden);
 assert.equal(result.canMutate,false);
 cases++;
}
const intent={state:'consumed',productId:'research-membership',
 accountId:'12345678-1234-4234-8234-123456789abc',
 checkoutIntentId:'synthetic-consumed-intent-118',
 checkoutKey:'synthetic-checkout-idempotency-118',storeId:'41',
 variantId:'313',testMode:true};
const sub={productId:'research-membership',state:'pending',
 version:1,subscriptionId:'217',accountId:intent.accountId,
 providerSubscriptionId:'217',providerCustomerId:'78'};
const invoice={invoiceId:'118',subscriptionId:'217',customerId:'78',
 storeId:'41',testMode:true,billingReason:'initial',status:'paid',
 refunded:false,refundedAmountCents:0,totalCents:1299,currency:'USD',
 invoiceSnapshotDigest:'1'.repeat(64)};
const quote={checkoutIntentId:intent.checkoutIntentId,
 checkoutKey:intent.checkoutKey,accountId:intent.accountId,
 subscriptionId:'217',storeId:'41',variantId:'313',testMode:true,
 issuedTotalCents:1299,currency:'USD',issuedQuoteDigest:'2'.repeat(64)};
const req={intent,subscription:sub,researchEntitlementCount:0,invoice,quote};
function check(request,reason){
 const result=inspectConsumedB5InitialReview(request);
 assert.equal(result.reason,reason);
 assert.equal(result.canMutate,false);
 assert.equal(result.liveEntitlementEffect,false);
 assert.equal(result.paidCycleAuthority,false);
 assert.equal(result.realProviderSettlement,false);
 assert.equal(result.remoteCommitAtomicity,false);
 assert(Object.isFrozen(result));
 cases++;
 return result;
}
const match=check(req,'synthetic_b5_consumed_intent_matches_pending_first_purchase');
assert.equal(match.disposition,'candidate_for_human_review_only');
assert.equal(match.canonicalInvoiceKey,'lemon-squeezy:41:test:118');
assert.equal(match.requiresAuthoritativeCycleProof,true);
assert.equal(match.requiresRealIntentVerification,true);
const variants=[
 [{intent:{...intent,state:'pending'}},'b5_intent_not_consumed'],
 [{intent:{...intent,state:'issued'}},'b5_intent_not_consumed'],
 [{subscription:{...sub,state:'active'}},'b5_initial_subscription_or_absent_entitlement_mismatch'],
 [{researchEntitlementCount:1},'b5_initial_subscription_or_absent_entitlement_mismatch'],
 [{subscription:{...sub,version:0}},'b5_initial_subscription_or_absent_entitlement_mismatch'],
 [{intent:{...intent,productId:'library-pass'}},'b5_initial_subscription_or_absent_entitlement_mismatch'],
 [{intent:{...intent,accountId:'00000000-0000-4000-8000-000000000041'}},'b5_consumed_checkout_scope_or_quote_mismatch'],
 [{quote:{...quote,checkoutIntentId:'other-intent'}},'b5_consumed_checkout_scope_or_quote_mismatch'],
 [{quote:{...quote,checkoutKey:'unrelated-checkout'}},'b5_consumed_checkout_scope_or_quote_mismatch'],
 [{invoice:{...invoice,subscriptionId:'218'}},'b5_consumed_checkout_scope_or_quote_mismatch'],
 [{quote:{...quote,storeId:'42'}},'b5_consumed_checkout_scope_or_quote_mismatch'],
 [{intent:{...intent,testMode:false}},'b5_consumed_checkout_scope_or_quote_mismatch'],
 [{invoice:{...invoice,billingReason:'renewal'}},'b5_initial_invoice_status_or_reason_not_eligible'],
 [{invoice:{...invoice,status:'refunded'}},'b5_initial_invoice_status_or_reason_not_eligible'],
 [{invoice:{...invoice,refundedAmountCents:2}},'b5_initial_invoice_status_or_reason_not_eligible'],
 [{invoice:{...invoice,totalCents:1}},'b5_initial_invoice_quote_not_bound'],
 [{quote:{...quote,issuedTotalCents:1}},'b5_initial_invoice_quote_not_bound'],
 [{quote:{...quote,issuedQuoteDigest:'not-valid'}},'b5_initial_invoice_quote_not_bound'],
 [{invoice:{...invoice,currency:'EUR'}},'b5_initial_invoice_quote_not_bound'],
 [{intent:null},'b5_consumed_checkout_evidence_missing']
];
for(const [diff,reason] of variants)check({...req,...diff},reason);
console.log('RESEARCH_STAGE_M_JS_CONTRACT_PASS '+cases+
 ' synthetic J-2 consumed-intent and J-4 digest cases; canMutate=false; no IO');
