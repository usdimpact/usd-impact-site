// Issue #950: REAL candidate modules composed via a synthetic PostgREST
// adapter, without real Supabase, Auth, Storage, email, keys or migrations.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { runOfflineCoordinatedDeletion } from '../src/lib/account-deletion-coordinated-offline-candidate.js';

const A='11111111-2222-4333-8444-555555555555';
const B='22222222-3333-4444-8555-666666666666';
const C='33333333-4444-4555-8666-777777777777';
const R='44444444-5555-4666-8777-888888888888';
const ids=Object.fromEntries([A,B,C,R].map(a=>[a,randomUUID()]));
const origin='https://ycstrcvshdluovtuasjc.supabase.co';
const config={mode:'offline_fixture',production:false,supabase:{
  url:origin,secretKey:'sb_secret_'+('u'.repeat(32)),
}};
const requested='2026-10-01T00:00:00.000Z';
const due='2026-10-08T00:00:00.000Z';
const deleted='2026-10-20T00:00:00.000Z';
const now=new Date('2026-10-29T00:00:00.000Z');
const row=a=>({
  account_id:a,deletion_request_id:ids[a],auth_user_id:a,
  status:'deletion_pending',deletion_requested_at:requested,
  deletion_due_at:due,deleted_at:null,
});
const reply=(status,data)=>new Response(data===undefined?null:JSON.stringify(data),
  {status,headers:{'content-type':'application/json'}});
let assertions=0;
function fixture({badRecovery=false,firstAckFailureFor=null}={}){
  const stages=new Map([[A,'eligible'],[B,'eligible'],[C,'taken'],[R,'finalized']]);
  const escrows=new Map([[R,{
    account_id:R,deletion_request_id:ids[R],
    recipient_email_normalized:'reader.r@example.invalid',
    deletion_requested_at:requested,deleted_at:deleted,
  }]]);
  const outbox=new Map();
  const acked=new Set();
  const attempts=[];
  let authCalls=0,scans=0,recoveryScans=0,enqueueCalls=0,ackCalls=0;
  const failedOnce=new Set();
  const fetchImpl=async(path,options)=>{
    const u=new URL(path);
    assert.equal(u.origin,origin);
    assert.equal(options.headers.apikey,config.supabase.secretKey);
    assert.equal(Object.hasOwn(options.headers,'Authorization'),false);
    const isProfiles=u.pathname==='/rest/v1/profiles';
    if(isProfiles){
      assert.equal(options.method,'GET');
      assert.equal(u.searchParams.get('auth_user_id'),'not.is.null');
      scans++;
      return reply(200,[row(A),row(B),row(C)]);
    }
    assert.equal(options.method,'POST');
    assert.equal(options.headers['Content-Type'],'application/json');
    assert.ok(u.pathname.startsWith('/rest/v1/rpc/'));
    const name=u.pathname.replace('/rest/v1/rpc/','');
    const args=JSON.parse(options.body);
    attempts.push(name);
    if(name==='list_account_deletion_completion_recoveries'){
      recoveryScans++;
      const rows=[...escrows.values()].filter(r=>!acked.has(r.account_id));
      return reply(200,rows.slice(0,args.max_items));
    }
    const accountId=Object.values(args)[0];
    assert.ok([A,B,C,R].includes(accountId));
    if(name==='confirm_account_deletion_completion_outbox'){
      ackCalls++;
      const saved=[...outbox.values()].find(o=>o.id===args.recorded_outbox_id);
      assert.ok(saved,'must be a durable outbox record');
      assert.equal(saved.business_object_id,accountId);
      assert.equal(args.recorded_request_id,ids[accountId]);
      assert.equal(saved.recipient_email_normalized,
        escrows.get(accountId)?.recipient_email_normalized);
      if(firstAckFailureFor===accountId && !failedOnce.has(accountId)){
        failedOnce.add(accountId);
        return reply(503,{message:'synthetic response failure'});
      }
      acked.add(accountId);
      return reply(200,true);
    }
    if(name==='claim_due_account_deletion'){
      if(stages.get(accountId)!=='eligible')return reply(409,{code:'55000'});
      stages.set(accountId,'claimed');
      return reply(200,[{
        claim_token:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        claim_generation:1,claimed_auth_user_id:accountId,
        claimed_request_id:ids[accountId],
      }]);
    }
    if(name==='begin_claimed_auth_removal'){
      assert.equal(stages.get(accountId),'claimed');
      stages.set(accountId,'auth_dispatched');return reply(200,accountId);
    }
    if(name==='mark_claimed_auth_ambiguous'){
      assert.equal(stages.get(accountId),'auth_dispatched');
      assert.equal(args.ambiguous_error_code,'auth_404');
      stages.set(accountId,'auth_ambiguous');return reply(200,true);
    }
    if(name==='confirm_claimed_auth_soft_delete'){
      assert.equal(stages.get(accountId),'auth_dispatched');
      assert.equal(args.confirm_http_status,200);
      stages.set(accountId,'auth_confirmed');return reply(200,true);
    }
    if(name==='finalize_claimed_account_deletion'){
      assert.equal(stages.get(accountId),'auth_confirmed');
      stages.set(accountId,'finalized');
      const result={
        account_id:accountId,recipient_email:'reader.a@example.invalid',
        deletion_requested_at:requested,deleted_at:deleted,
      };
      escrows.set(accountId,{
        account_id:accountId,deletion_request_id:ids[accountId],
        recipient_email_normalized:'reader.a@example.invalid',
        deletion_requested_at:requested,deleted_at:deleted,
      });
      return reply(200,[result]);
    }
    assert.fail('Unexpected database call: '+name);
  };
  const enqueueCompletion=async intent=>{
    enqueueCalls++;
    const record=intent.outboxRecord;
    const accountId=record.business_object_id;
    assert.equal(record.message_id,'account_deletion_completed');
    assert.equal(record.business_object_type,'account_deletion_request');
    assert.equal(record.classification,'transactional_operational');
    assert.equal(record.consent_required,false);
    assert.deepEqual(record.payload,{});
    assert.match(record.idempotency_key,/^notification:v1:[0-9a-f]{64}$/);
    const already=outbox.get(record.idempotency_key);
    const value=already??{...record,id:randomUUID(),status:'queued'};
    outbox.set(record.idempotency_key,value);
    if(badRecovery && accountId===R){
      return {enabled:true,outbox:{...value,recipient_email_normalized:'wrong@example.invalid'}};
    }
    return {enabled:true,outbox:value};
  };
  const authSoftDelete=async({accountId,authUserId,shouldSoftDelete})=>{
    authCalls++;
    assert.equal(accountId,authUserId);
    assert.equal(shouldSoftDelete,true);
    assert.equal(stages.get(accountId),'auth_dispatched');
    return {status:accountId===B?404:200};
  };
  const run=(limit=5)=>runOfflineCoordinatedDeletion({
    config,fetchImpl,enqueueCompletion,authSoftDelete,now,limit,
    workerNonceFactory:randomUUID,
  });
  return {run,attempts,stages,acked,outbox,escrows,
    get authCalls(){return authCalls;},get scans(){return scans;},
    get recoveryScans(){return recoveryScans;},
    get enqueueCalls(){return enqueueCalls;},get ackCalls(){return ackCalls;}
  };
}

{
  const f=fixture();
  const result=await f.run();
  assert.equal(result.recovery.scanned,1);
  assert.equal(result.recovery.recorded,1);
  assert.equal(result.recovery.manualReview,0);
  assert.equal(result.due.scanned,3);
  assert.equal(result.due.finalized,1);
  assert.equal(result.due.conflicts,1);
  assert.equal(result.due.manualReview,1);
  assert.equal(result.due.outcomes[1].code,'AUTH_OUTCOME_UNVERIFIED');
  assert.equal(result.newAuthWorkBlocked,false);
  assert.equal(f.authCalls,2);
  assert.equal(f.outbox.size,2);
  assert.deepEqual([...f.acked].sort(),[A,R].sort());
  assert.equal(f.stages.get(A),'finalized');
  assert.equal(f.stages.get(B),'auth_ambiguous');
  assert.equal(f.attempts[0],'list_account_deletion_completion_recoveries');
  assert.equal(f.attempts.filter(n=>n==='confirm_account_deletion_completion_outbox').length,2);
  assert.equal(JSON.stringify(result).includes('reader.'),false);
  for(const a of [A,B,C,R])assert.equal(JSON.stringify(result).includes(a),false);
  assert.equal(JSON.stringify(result).includes(config.supabase.secretKey),false);
  assertions+=21;
  const again=await f.run();
  assert.equal(again.recovery.scanned,0);
  assert.equal(again.due.finalized,0);
  assert.equal(again.due.conflicts,3);
  assert.equal(f.authCalls,2,'no repeated external Auth call');
  assert.equal(f.outbox.size,2,'no duplicate durable outbox');
  assertions+=5;
}
{
  const f=fixture({firstAckFailureFor:A});
  const first=await f.run();
  assert.equal(first.due.finalized,0);
  assert.equal(first.due.manualReview,2);
  assert.equal(first.due.outcomes[0].code,'COMPLETION_RECOVERY_ACK_UNCERTAIN');
  assert.equal(f.stages.get(A),'finalized');
  assert.equal(f.acked.has(A),false);
  assert.equal(f.outbox.size,2);
  assert.equal(f.authCalls,2);
  const second=await f.run();
  assert.equal(second.recovery.scanned,1);
  assert.equal(second.recovery.recorded,1);
  assert.equal(f.acked.has(A),true);
  assert.equal(f.outbox.size,2,'outbox idempotency reuses existing entry');
  assert.equal(f.authCalls,2,'Auth must not replay during recovery');
  assert.equal(second.due.finalized,0);
  assertions+=13;
}
{
  const f=fixture({badRecovery:true});
  const result=await f.run();
  assert.equal(result.recovery.manualReview,1);
  assert.equal(result.newAuthWorkBlocked,true);
  assert.equal(result.due.scanned,0,'do not authorize new Auth with unresolved recovery');
  assert.equal(f.authCalls,0);
  assert.equal(f.scans,0);
  assert.equal(f.acked.size,0);
  assert.equal(result.recovery.outcomes[0].code,'COMPLETION_RECOVERY_OUTBOX_IDENTITY_MISMATCH');
  assertions+=7;
}
for (const [overrides,code] of [
  [{config:{...config,production:true}},'COORDINATED_DELETION_OFFLINE_HOLD'],
  [{config:{...config,mode:'live'}},'COORDINATED_DELETION_OFFLINE_HOLD'],
  [{config:{...config,supabase:{...config.supabase,url:'https://gjzetjugmnwanvjkchux.supabase.co'}}},'COORDINATED_DELETION_OFFLINE_HOLD'],
  [{limit:0},'COORDINATED_DELETION_LIMIT_INVALID'],
  [{limit:6},'COORDINATED_DELETION_LIMIT_INVALID'],
  [{now:new Date('invalid')},'COORDINATED_DELETION_CLOCK_INVALID'],
]){
  let ioCalls=0;
  const fail=async()=>{ioCalls++;throw new Error('No IO allowed');};
  await assert.rejects(()=>runOfflineCoordinatedDeletion({
    config,fetchImpl:fail,authSoftDelete:fail,
    enqueueCompletion:fail,limit:1,now,...overrides,
  }),error=>error?.code===code,code);
  assert.equal(ioCalls,0);
  assertions++;
}
console.log('Issue #950 offline recovery-first coordinated finalizer: '+
  assertions+' assertions PASS; no live Auth, Supabase, mail, or migration.');
