// Issue #950: real review-only wire adapter + existing fenced coordinator,
// executing ONLY injected in-memory transports with a fixed non-live secret.
import assert from 'node:assert/strict';
import {
  GOTRUE_WIRE_TEST_ORIGIN as origin,
  GOTRUE_WIRE_TEST_ACCOUNT as account,
  GOTRUE_WIRE_TEST_KEY as key,
  createOfflineAuthAdminSoftDelete,
  AuthAdminWireReviewError,
} from '../src/lib/account-deletion-gotrue-admin-wire.review.js';
import {
  runOfflineFencedDeletion,
  FencedDeletionProtocolError,
} from '../src/lib/account-deletion-fenced-protocol-candidate.js';

const request='22222222-3333-4444-8555-666666666666';
const token='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const worker='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const config={mode:'offline_fixture',production:false,
  supabase:{url:origin,secretKey:key}};
const candidate={
  account_id:account,auth_user_id:account,deletion_request_id:request,
  status:'deletion_pending',deletion_requested_at:'2026-10-01T00:00:00.000Z',
  deletion_due_at:'2026-10-08T00:00:00.000Z',deleted_at:null,
};
const json=(body,status=200)=>
  new Response(status===204?null:JSON.stringify(body),{
    status,headers:{'content-type':'application/json'},
  });
let assertions=0;
function fixture({adminStatus=200,adminError=null,beginStatus=200,
  confirmStatus=200,markStatus=200}={}){
  const stages=[];
  const transportCalls=[];
  let adminCalls=0,completionCalls=0;
  const wireFetch=async(path,opts)=>{
    adminCalls++;
    stages.push('auth_admin_delete');
    transportCalls.push({path,opts});
    const url=new URL(path);
    assert.equal(url.origin,origin);
    assert.equal(url.pathname,'/auth/v1/admin/users/'+account);
    assert.equal(url.search,'');
    assert.equal(opts.method,'DELETE');
    assert.equal(opts.redirect,'error');
    assert.equal(opts.cache,'no-store');
    assert.equal(opts.headers.apikey,key);
    assert.equal(opts.headers['Content-Type'],'application/json');
    assert.equal(Object.keys(opts.headers).some(x=>x.toLowerCase()==='authorization'),false);
    assert.deepEqual(JSON.parse(opts.body),{should_soft_delete:true});
    if(adminError)throw adminError;
    return {status:adminStatus};
  };
  const fetchImpl=async(url,opts)=>{
    assert.equal(new URL(url).origin,origin);
    assert.equal(opts.method,'POST');
    assert.equal(opts.headers.apikey,key);
    assert.equal(Object.keys(opts.headers).some(x=>x.toLowerCase()==='authorization'),false);
    const op=new URL(url).pathname.replace('/rest/v1/rpc/','');
    stages.push('rpc_'+op);
    const p=JSON.parse(opts.body);
    if(op==='claim_due_account_deletion'){
      assert.equal(p.claim_account_id,account);
      assert.equal(p.claim_request_id,request);
      assert.equal(p.claim_worker_nonce,worker);
      return json([{claim_token:token,claim_generation:1,
        claimed_auth_user_id:account,claimed_request_id:request}]);
    }
    if(op==='begin_claimed_auth_removal'){
      assert.equal(p.begin_account_id,account);
      assert.equal(p.begin_request_id,request);
      assert.equal(p.begin_token,token);
      assert.equal(p.begin_generation,1);
      return beginStatus===200?json(account):json({message:'simulated lost response'},beginStatus);
    }
    if(op==='mark_claimed_auth_ambiguous'){
      assert.equal(p.ambiguous_account_id,account);
      assert.equal(p.ambiguous_request_id,request);
      assert.equal(p.ambiguous_token,token);
      assert.equal(p.ambiguous_generation,1);
      assert.match(p.ambiguous_error_code,/^(auth_404|auth_409|auth_429|auth_503|auth_unexpected|network_error|timeout)$/);
      return json(true,markStatus);
    }
    if(op==='confirm_claimed_auth_soft_delete'){
      assert.equal(p.confirm_account_id,account);
      assert.equal(p.confirm_request_id,request);
      assert.equal(p.confirm_token,token);
      assert.equal(p.confirm_generation,1);
      assert.equal(p.confirm_http_status,adminStatus);
      return json(true,confirmStatus);
    }
    if(op==='finalize_claimed_account_deletion'){
      assert.equal(p.finalize_account_id,account);
      assert.equal(p.finalize_request_id,request);
      assert.equal(p.finalize_token,token);
      assert.equal(p.finalize_generation,1);
      return json([{
        account_id:account,recipient_email:'fixture@example.invalid',
        deletion_requested_at:'2026-10-01T00:00:00.000Z',
        deleted_at:'2026-10-18T00:00:00.000Z',
      }]);
    }
    assert.fail('unexpected synthetic RPC');
  };
  const authSoftDelete=createOfflineAuthAdminSoftDelete({config,wireFetch});
  const recordCompletion=async () => {completionCalls++;return {
    durable:true,reference:'synthetic-outbox-reference',
  }};
  const run=()=>runOfflineFencedDeletion({
    config,candidate,workerNonce:worker,fetchImpl,
    authSoftDelete,recordCompletion,
  });
  return {run,stages,transportCalls,get adminCalls(){return adminCalls},
    get completionCalls(){return completionCalls}};
}

for(const status of [200,204]){
  const f=fixture({adminStatus:status});
  const result=await f.run();
  assert.equal(result.status,'finalized');
  assert.equal(f.adminCalls,1);
  assert.equal(f.completionCalls,1);
  assert.deepEqual(f.stages,[
    'rpc_claim_due_account_deletion',
    'rpc_begin_claimed_auth_removal',
    'auth_admin_delete',
    'rpc_confirm_claimed_auth_soft_delete',
    'rpc_finalize_claimed_account_deletion',
  ]);
  assert.equal(f.transportCalls.length,1);
  assertions+=5;
}
// An error after dispatch leaves Auth state ambiguous and prevents SQL finalization.
for(const status of [404,409,429,503,201]){
  const f=fixture({adminStatus:status});
  await assert.rejects(f.run(),e=>
    e instanceof FencedDeletionProtocolError && e.code==='AUTH_OUTCOME_UNVERIFIED');
  assert.equal(f.adminCalls,1);
  assert.equal(f.completionCalls,0);
  assert.deepEqual(f.stages,[
    'rpc_claim_due_account_deletion',
    'rpc_begin_claimed_auth_removal',
    'auth_admin_delete',
    'rpc_mark_claimed_auth_ambiguous',
  ]);
  assertions+=4;
}
for(const error of [
  new Error('synthetic network error'),
  Object.assign(new Error('synthetic timeout'),{name:'AbortError'}),
]){
  const f=fixture({adminError:error});
  await assert.rejects(f.run(),e=>
    e instanceof FencedDeletionProtocolError && e.code==='AUTH_OUTCOME_UNVERIFIED');
  assert.equal(f.adminCalls,1);
  assert.equal(f.completionCalls,0);
  assert.equal(f.stages.at(-1),'rpc_mark_claimed_auth_ambiguous');
  assertions+=4;
}
{
  const f=fixture({beginStatus:503});
  await assert.rejects(f.run(),e=>
    e instanceof FencedDeletionProtocolError && e.code==='BEGIN_DISPATCH_UNCERTAIN');
  assert.equal(f.adminCalls,0,'lost begin response cannot produce GoTrue DELETE');
  assert.equal(f.completionCalls,0);
  assertions+=3;
}
{
  const f=fixture({adminStatus:404,markStatus:503});
  await assert.rejects(f.run(),e=>
    e instanceof FencedDeletionProtocolError && e.code==='AUTH_AMBIGUITY_NOT_RECORDED');
  assert.equal(f.adminCalls,1);
  assert.equal(f.completionCalls,0);
  assertions+=3;
}
{
  const f=fixture({adminStatus:204,confirmStatus:503});
  await assert.rejects(f.run(),e=>
    e instanceof FencedDeletionProtocolError && e.code==='AUTH_CONFIRMATION_UNCERTAIN');
  assert.equal(f.adminCalls,1,'confirmation uncertainty must not retry GoTrue DELETE');
  assert.equal(f.completionCalls,0);
  assertions+=3;
}
for(const [changes,code] of [
  [{config:{...config,production:true}},'AUTH_ADMIN_WIRE_REVIEW_HOLD'],
  [{config:{...config,mode:'live'}},'AUTH_ADMIN_WIRE_REVIEW_HOLD'],
  [{config:{...config,supabase:{...config.supabase,secretKey:'sb_secret_real_like_value'}}},'AUTH_ADMIN_WIRE_REVIEW_HOLD'],
  [{config:{...config,supabase:{...config.supabase,url:'https://gjzetjugmnwanvjkchux.supabase.co'}}},'AUTH_ADMIN_WIRE_REVIEW_HOLD'],
  [{wireFetch:globalThis.fetch},'AUTH_ADMIN_WIRE_REVIEW_HOLD'],
  [{wireFetch:undefined},'AUTH_ADMIN_WIRE_REVIEW_HOLD'],
]){
  let calls=0;
  const transport=async()=>{calls++;throw new Error('must not call')};
  assert.throws(()=>createOfflineAuthAdminSoftDelete({
    config,wireFetch:transport,...changes,
  }),e=>e instanceof AuthAdminWireReviewError && e.code === code,code);
  assert.equal(calls,0);
  assertions+=2;
}
{
  let calls=0;
  const adapter=createOfflineAuthAdminSoftDelete({
    config,wireFetch:async()=>{calls++;return {status:200}},
  });
  for(const inputs of [
    {accountId:'33333333-4444-4555-8666-777777777777',authUserId:account,shouldSoftDelete:true},
    {accountId:account,authUserId:'33333333-4444-4555-8666-777777777777',shouldSoftDelete:true},
    {accountId:account,authUserId:account,shouldSoftDelete:false},
    {accountId:account,authUserId:account},
  ]){
    await assert.rejects(adapter(inputs),e=>e instanceof AuthAdminWireReviewError
      && e.code==='AUTH_ADMIN_WIRE_SYNTHETIC_IDENTITY_REQUIRED');
    assert.equal(calls,0);
    assertions+=2;
  }
}
console.log('Issue #950 GoTrue soft-delete wire + claim protocol: '+assertions+
  ' assertions PASS; offline-only injected transports and non-live test key.');
