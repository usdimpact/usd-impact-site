import assert from 'node:assert/strict';
import {
  runOfflineFencedDeletion,
  FencedDeletionProtocolError,
} from '../src/lib/account-deletion-fenced-protocol-candidate.js';

const accountId='11111111-2222-4333-8444-555555555555';
const requestId='11111111-2222-4333-8444-777777777777';
const token='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const worker='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const url='https://ycstrcvshdluovtuasjc.supabase.co';
const config={mode:'offline_fixture',production:false,supabase:{url,secretKey:'sb_secret_'+('q'.repeat(32))}};
const candidate={
  account_id:accountId,deletion_request_id:requestId,status:'deletion_pending',
  deletion_requested_at:'2026-08-20T00:00:00.000Z',
  deletion_due_at:'2026-08-27T00:00:00.000Z',
};
const response=(status,body)=>new Response(body===undefined?null:JSON.stringify(body),
  {status,headers:{'content-type':'application/json'}});
const finalizeRow={account_id:accountId,recipient_email:'synthetic@example.invalid',
  deleted_at:'2026-08-28T00:00:00.000Z'};
let count=0;
function mock({claimStatus=200,claimBody,beginStatus=200,beginBody,
  authStatus=200,authError,confirmStatus=200,confirmBody,
  finalizeStatus=200,finalizeBody,markStatus=200,markBody,
  completionDurable=true}={}){
  let state='eligible',providerCalls=0,completionCalls=0;
  const calls=[];
  const fetchImpl=async (path,options)=>{
    assert.equal(new URL(path).origin,url);
    assert.equal(options.method,'POST');
    assert.equal(options.headers.apikey,config.supabase.secretKey);
    assert.equal(Object.hasOwn(options.headers,'Authorization'),false);
    const name=new URL(path).pathname.replace('/rest/v1/rpc/','');
    const payload=JSON.parse(options.body);
    calls.push({name,payload});
    if(name==='claim_due_account_deletion'){
      assert.equal(payload.claim_account_id,accountId);
      assert.equal(payload.claim_request_id,requestId);
      assert.equal(payload.claim_worker_nonce,worker);
      if(state!=='eligible') return response(409,{code:'55000'});
      if(claimStatus!==200) return response(claimStatus,{code:'55000'});
      state='claimed';
      return response(claimStatus,claimBody??[{
        claim_token:token,claim_generation:1,
        claimed_auth_user_id:accountId,claimed_request_id:requestId,
      }]);
    }
    if(name==='begin_claimed_auth_removal'){
      assert.equal(payload.begin_account_id,accountId);
      assert.equal(payload.begin_token,token);
      assert.equal(payload.begin_generation,1);
      if(state!=='claimed') return response(409,{code:'55000'});
      // Simulate a response lost AFTER DB dispatch commit.
      state='auth_dispatched';
      return beginStatus===204?response(204):response(beginStatus,beginBody??accountId);
    }
    if(name==='mark_claimed_auth_ambiguous'){
      assert.equal(state,'auth_dispatched');
      assert.equal(payload.ambiguous_account_id,accountId);
      assert.equal(payload.ambiguous_token,token);
      assert.match(payload.ambiguous_error_code,/^(timeout|network_error|auth_404|auth_409|auth_429|auth_503|auth_unexpected|response_lost)$/);
      if(markStatus===200)state='ambiguous';
      return response(markStatus,markBody??true);
    }
    if(name==='confirm_claimed_auth_soft_delete'){
      assert.equal(state,'auth_dispatched');
      assert.equal(payload.confirm_token,token);
      assert.equal(payload.confirm_http_status,200);
      if(confirmStatus===200)state='auth_confirmed';
      return response(confirmStatus,confirmBody??true);
    }
    if(name==='finalize_claimed_account_deletion'){
      assert.equal(state,'auth_confirmed');
      assert.equal(payload.finalize_token,token);
      assert.equal(payload.finalize_generation,1);
      if(finalizeStatus===200)state='finalized';
      return response(finalizeStatus,finalizeBody??[finalizeRow]);
    }
    assert.fail('Unexpected REST call: '+name);
  };
  const authSoftDelete=async ({accountId:received,authUserId,shouldSoftDelete})=>{
    providerCalls++;
    assert.equal(received,accountId);
    assert.equal(authUserId,accountId);
    assert.equal(shouldSoftDelete,true);
    assert.equal(state,'auth_dispatched','Auth cannot precede committed dispatch');
    if(authError) throw authError;
    return {status:authStatus};
  };
  const recordCompletion=async row=>{
    completionCalls++;
    assert.equal(state,'finalized','never acknowledge before DB completion');
    assert.equal(row.account_id,accountId);
    return {durable:completionDurable,reference:'offline-outbox'};
  };
  return {fetchImpl,authSoftDelete,recordCompletion,calls,
    get providerCalls(){return providerCalls;},
    get completionCalls(){return completionCalls;},
    get state(){return state;},
  };
}
async function run(choices={},overrides={}){
  const h=mock(choices);
  const promise=()=>runOfflineFencedDeletion({
    config,candidate,workerNonce:worker,
    fetchImpl:h.fetchImpl,authSoftDelete:h.authSoftDelete,
    recordCompletion:h.recordCompletion,...overrides,
  });
  return {h,promise};
}
async function expectCode(promise,code){
  await assert.rejects(promise,error=>
    error instanceof FencedDeletionProtocolError && error.code===code,code);
  count++;
}
// Success: claim -> one-shot begin -> single Auth -> confirm -> finalize -> outbox.
{
  const {h,promise}=await run();
  const result=await promise();
  assert.equal(result.status,'finalized');
  assert.equal(result.completionReference,'offline-outbox');
  assert.equal(h.providerCalls,1);
  assert.equal(h.completionCalls,1);
  assert.deepEqual(h.calls.map(x=>x.name),[
    'claim_due_account_deletion','begin_claimed_auth_removal',
    'confirm_claimed_auth_soft_delete','finalize_claimed_account_deletion',
  ]);
  count++;
}
// Default-off and Production hold have zero network and zero Auth.
for(const unsafe of [
  {config:{...config,production:true}},
  {config:{...config,mode:'live'}},
  {config:{...config,supabase:{...config.supabase,url:'https://example.invalid'}}},
  {workerNonce:'not-a-uuid'},
  {candidate:{...candidate,deletion_request_id:null}},
]) {
  const {h,promise}=await run({},unsafe);
  await expectCode(promise,
    unsafe.config?'CLAIM_PROTOCOL_OFFLINE_HOLD':
    unsafe.workerNonce?'CLAIM_WORKER_NONCE_INVALID':'CLAIM_SNAPSHOT_INVALID');
  assert.equal(h.calls.length,0);assert.equal(h.providerCalls,0);
}
// Absent/conflicting claim and malformed claim never touch Auth.
for(const [choices,code] of [
  [{claimStatus:409},'CLAIM_NOT_GRANTED'],
  [{claimStatus:503},'CLAIM_NOT_GRANTED'],
  [{claimBody:[]},'CLAIM_RESPONSE_INVALID'],
  [{claimBody:[{claim_token:token,claim_generation:2,claimed_auth_user_id:'wrong',claimed_request_id:requestId}]},'CLAIM_RESPONSE_INVALID'],
]) {
  const {h,promise}=await run(choices);
  await expectCode(promise,code);
  assert.equal(h.providerCalls,0);assert.equal(h.completionCalls,0);
}
// A lost begin response may follow a committed DB dispatch: never call Auth.
for(const choices of [{beginStatus:503},{beginStatus:204},{beginBody:'wrong-auth-user'}]){
  const {h,promise}=await run(choices);
  await expectCode(promise,'BEGIN_DISPATCH_UNCERTAIN');
  assert.equal(h.providerCalls,0);
  assert.equal(h.completionCalls,0);
}
// HTTP 404, 409, 429, 503, unknown and network exceptions are ambiguous.
for(const choices of [
  {authStatus:404},{authStatus:409},{authStatus:429},{authStatus:503},
  {authStatus:201},{authError:new Error('synthetic network failure')},
  {authError:Object.assign(new Error('synthetic timeout'),{name:'AbortError'})},
]) {
  const {h,promise}=await run(choices);
  await expectCode(promise,'AUTH_OUTCOME_UNVERIFIED');
  assert.equal(h.providerCalls,1);
  assert.equal(h.completionCalls,0);
  assert.equal(h.state,'ambiguous');
  assert.ok(!h.calls.some(x=>x.name==='finalize_claimed_account_deletion'));
}
// Failed ambiguity recording forbids finalization and requires escalation.
{
  const {h,promise}=await run({authStatus:404,markStatus:503});
  await expectCode(promise,'AUTH_AMBIGUITY_NOT_RECORDED');
  assert.equal(h.providerCalls,1);assert.equal(h.completionCalls,0);
}
// After an Auth success, confirmation uncertainty must not re-delete.
for(const choices of [{confirmStatus:503},{confirmBody:false}]){
  const {h,promise}=await run(choices);
  await expectCode(promise,'AUTH_CONFIRMATION_UNCERTAIN');
  assert.equal(h.providerCalls,1);assert.equal(h.completionCalls,0);
}
// Failed/empty finalization must never send completion acknowledgement.
for(const choices of [{finalizeStatus:503},{finalizeStatus:204},{finalizeBody:[]}]){
  const {h,promise}=await run(choices);
  await expectCode(promise,'CLAIMED_FINALIZATION_UNCERTAIN');
  assert.equal(h.providerCalls,1);assert.equal(h.completionCalls,0);
}
// Completion must be durably acknowledged by the future idempotent ledger.
{
  const {h,promise}=await run({completionDurable:false});
  await expectCode(promise,'COMPLETION_NOT_DURABLE');
  assert.equal(h.providerCalls,1);assert.equal(h.completionCalls,1);
}
// A shared state models 100 competing cron workers; only one can get the claim.
// This is a mock race, NOT a substitute for real multi-connection SQL acceptance.
{
  const h=mock();
  const runners=Array.from({length:100},()=>runOfflineFencedDeletion({
    config,candidate,workerNonce:worker,fetchImpl:h.fetchImpl,
    authSoftDelete:h.authSoftDelete,recordCompletion:h.recordCompletion,
  }));
  const results=await Promise.allSettled(runners);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.filter(x=>x.status==='rejected').length,99);
  assert.equal(h.providerCalls,1);
  assert.equal(h.completionCalls,1);count++;
}
console.log('Fenced deletion offline-only protocol: '+count+' synthetic assertions PASS; no network or real identity.');
