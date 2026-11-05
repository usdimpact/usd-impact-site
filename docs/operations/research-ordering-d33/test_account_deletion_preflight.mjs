#!/usr/bin/env node
import assert from "node:assert/strict";
import { assertNoUnverifiedResearchBillingBeforeAuthDeletion, ResearchDeletionBillingHold }
  from "./account_deletion_research_preflight_review.mjs";

const accountId = "dddddddd-dddd-4ddd-8ddd-000000000001";
const cfg={supabase:{url:"https://synthetic.invalid",secretKey:"not-a-real-secret"}};
function reply(rows,{ok=true,throwResponse=false}={}) {
  let hits=0;
  return {
    get hits(){return hits;},
    fetch: async (url,opts)=>{
      hits++;
      assert.match(url,/\/rest\/v1\/subscriptions\?/);
      assert.match(url,/product_id=eq\.research-membership/);
      assert.match(url, /account_id=eq\.dddddddd-dddd-4ddd-8ddd-000000000001/);
      assert.equal(opts.method,"GET");
      assert.equal(opts.headers.Authorization,"Bearer not-a-real-secret");
      if(throwResponse)throw Error("synthetic network failure");
      return {ok,text:async()=>typeof rows==="string"?rows:JSON.stringify(rows)};
    }
  };
}
async function mockedDueRun(fetchImpl,operations) {
  await assertNoUnverifiedResearchBillingBeforeAuthDeletion({
    accountId,config:cfg,fetchImpl
  });
  operations.push("AUTH_DELETE");
  operations.push("DATABASE_FINALIZE");
}
async function blocked(row,expected) {
  const actions=[];
  const fetcher=reply(row);
  await assert.rejects(
    mockedDueRun(fetcher.fetch,actions),
    e=>e instanceof ResearchDeletionBillingHold && e.code===expected
  );
  assert.equal(fetcher.hits,1);
  assert.deepEqual(actions,[],"Auth must be intact on failed billing preflight");
}
const good=reply([]);
const actions=[];
await mockedDueRun(good.fetch,actions);
assert.equal(good.hits,1);
assert.deepEqual(actions,["AUTH_DELETE","DATABASE_FINALIZE"]);
console.log("D33_PREFLIGHT_NO_RESEARCH_SUBSCRIPTION_AUTH_ORDER_PASS");
for(const state of ["pending","active","past_due","cancel_scheduled",
                    "cancelled","refunded","charged_back","disputed"]) {
  await blocked([{account_id:accountId,product_id:"research-membership",state}],
    "RESEARCH_PROVIDER_CANCELLATION_NOT_VERIFIED");
}
console.log("D33_PREFLIGHT_ANY_RESEARCH_BILLING_PROVIDER_VERIFICATION_HOLD_PASS");
await blocked("not JSON","RESEARCH_DELETION_PREFLIGHT_MALFORMED");
await blocked([{account_id:"foreign",product_id:"research-membership",state:"active"}],
 "RESEARCH_DELETION_PREFLIGHT_MALFORMED");
const broken=reply([], {ok:false});
await assert.rejects(mockedDueRun(broken.fetch,[]),
 e=>e.code==="RESEARCH_DELETION_PREFLIGHT_UNAVAILABLE");
const down=reply([],{throwResponse:true});
await assert.rejects(mockedDueRun(down.fetch,[]),
 e=>e.code==="RESEARCH_DELETION_PREFLIGHT_UNAVAILABLE");
console.log("D33_PREFLIGHT_BAD_HTTP_BODY_AND_NETWORK_FAIL_CLOSED_PASS");
console.log("D33_RESEARCH_DELETION_AUTH_FIRST_GUARD_REVIEW_PASS (no runtime import)");
