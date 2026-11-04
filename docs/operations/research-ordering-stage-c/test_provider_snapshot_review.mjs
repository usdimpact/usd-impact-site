import assert from 'node:assert/strict';
import { inspectResearchProviderSnapshotReview as inspect } from './provider_snapshot_review.mjs';

const base = {
  subscriptionId: '217',
  expectedBinding: {storeId:'41',customerId:'78',productId:'99',variantId:'313',testMode:true},
  signedEvent: {objectType:'subscriptions',occurredAt:'2026-11-05T01:02:03.123456Z'},
  apiKey:'synthetic-review-key-no-real-provider',
  existingPeriodEnd:'2026-12-05T01:02:03.123456Z',
};
const attrs = {
  store_id:41, customer_id:78, product_id:99, variant_id:313, test_mode:true,
  status:'active', cancelled:false, updated_at:base.signedEvent.occurredAt,
  renews_at:'2027-01-05T00:00:00.000000Z', ends_at:null,
};
let calls=[];
function response(a=attrs, status=200, contentType='application/vnd.api+json',subscription='217') {
  return new Response(JSON.stringify({data:{type:'subscriptions',id:subscription,attributes:a}}),
    {status,headers:{'content-type':contentType}});
}
function withProvider(a=attrs) {
  return async (url,opts) => {
    calls.push({url,opts});
    assert.equal(url,'https://api.lemonsqueezy.com/v1/subscriptions/217');
    assert.equal(opts.method,'GET');
    assert.equal(opts.redirect,'error');
    assert.equal(opts.headers.Accept,'application/vnd.api+json');
    assert.equal(opts.headers.Authorization,`Bearer ${base.apiKey}`);
    return response(a);
  };
}
let count=0;
async function check(name,delta,reason,fetch=withProvider()) {
  calls=[];
  const p=await inspect({...base,...delta,fetchImpl:fetch});
  assert.equal(p.canMutate,false,name);
  assert.equal(Object.isFrozen(p),true,name);
  assert.equal(p.reason,reason,name);
  count++;
  return p;
}
let pass=await check('matching signed current snapshot',{},'current_subscription_object_matches_bound_provider_snapshot');
assert.equal(pass.disposition,'candidate_for_locked_review');
assert.match(pass.reviewFingerprint,/^[0-9a-f]{64}$/);
assert.equal(calls.length,1);
await check('invoice unrelated clocks',{signedEvent:{objectType:'subscription-invoices',occurredAt:base.signedEvent.occurredAt}},'invoice_or_missing_subscription_object_not_comparable',async()=>{throw new Error('no fetch expected');});
assert.equal(calls.length,0);
await check('signed event invalid clock',{signedEvent:{objectType:'subscriptions',occurredAt:'nonsense'}},'invalid_signed_subscription_clock',async()=>{throw new Error('no fetch expected');});
await check('old provider state',{},'provider_snapshot_older_than_signed_event',withProvider({...attrs,updated_at:'2026-11-05T01:02:03.123455Z'}));
await check('newer provider state',{},'provider_has_newer_state_than_delivery',withProvider({...attrs,updated_at:'2026-11-05T01:02:03.123457Z'}));
await check('store id mismatch',{},'provider_scope_or_catalog_binding_mismatch',withProvider({...attrs,store_id:12}));
await check('customer id mismatch',{},'provider_scope_or_catalog_binding_mismatch',withProvider({...attrs,customer_id:55}));
await check('product mismatch',{},'provider_scope_or_catalog_binding_mismatch',withProvider({...attrs,product_id:5}));
await check('variant mismatch',{},'provider_scope_or_catalog_binding_mismatch',withProvider({...attrs,variant_id:5}));
await check('test mode mismatch',{},'provider_scope_or_catalog_binding_mismatch',withProvider({...attrs,test_mode:false}));
await check('unsupported paid status',{},'provider_status_requires_explicit_policy',withProvider({...attrs,status:'free'}));
await check('active flag mismatch',{},'active_cancelled_flag_inconsistent',withProvider({...attrs,cancelled:true}));
await check('cancelled flag mismatch',{},'cancelled_flag_inconsistent',withProvider({...attrs,status:'cancelled',cancelled:false,ends_at:'2027-01-05T00:00:00.000Z'}));
await check('missing active horizon',{},'paid_horizon_unverified_or_shortened',withProvider({...attrs,renews_at:null}));
await check('shortened horizon',{},'paid_horizon_unverified_or_shortened',withProvider({...attrs,renews_at:'2026-11-15T00:00:00.000Z'}));
await check('invalid current horizon',{existingPeriodEnd:'not-an-iso'},'paid_horizon_unverified_or_shortened');
await check('provider 503',{},'provider_http_unavailable_or_rejected',async()=>response(attrs,503));
await check('provider fetch throws',{},'provider_fetch_unavailable',async()=>{throw new Error('offline');});
await check('provider JSON invalid',{},'provider_json_invalid',async()=>new Response('{bad',{headers:{'content-type':'application/json'}}));
await check('content type invalid',{},'provider_content_type_unexpected',async()=>response(attrs,200,'text/html'));
await check('payload identity mismatch',{},'provider_snapshot_identity_mismatch',async()=>response(attrs,200,'application/vnd.api+json','218'));
await check('oversized response',{},'provider_response_oversized',async()=>new Response(' '.repeat(200000),{headers:{'content-type':'application/json'}}));
await check('clock invalid',{},'provider_snapshot_clock_invalid',withProvider({...attrs,updated_at:'2026-11-05'}));
await check('cancelled correct',{},'current_subscription_object_matches_bound_provider_snapshot',withProvider({...attrs,status:'cancelled',cancelled:true,ends_at:'2027-01-05T00:00:00.000000Z'}));
for (const bad of ['sub_217','../217','0','100000000000000000000']) {
  await assert.rejects(()=>inspect({...base,subscriptionId:bad,fetchImpl:withProvider()}),TypeError);
  count++;
}
await assert.rejects(()=>inspect({...base,apiKey:'short',fetchImpl:withProvider()}),TypeError);
count++;
assert.equal(calls.length,1,'no new network on invalid subscription identifiers');
console.log(`RESEARCH_STAGE_C_PROVIDER_SNAPSHOT_REVIEW_PASS ${count} synthetic negative/positive tests; no merchant traffic`);
