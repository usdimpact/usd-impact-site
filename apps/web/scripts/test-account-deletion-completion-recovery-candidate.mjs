import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { runOfflineCompletionRecovery } from '../src/lib/account-deletion-completion-recovery-candidate.js';

const a='11111111-2222-4333-8444-555555555555';
const b='22222222-3333-4444-8555-666666666666';
const reqA=randomUUID(),reqB=randomUUID();
const origin='https://ycstrcvshdluovtuasjc.supabase.co';
const config={mode:'offline_fixture',production:false,supabase:{
  url:origin,secretKey:'sb_secret_'+('z'.repeat(32)),
}};
const deletionRequested='2026-10-01T00:00:00.000Z';
const deletionCompleted='2026-10-20T00:00:00.000Z';
const samples=[
  {account_id:a,deletion_request_id:reqA,recipient_email_normalized:'recipient.a@example.invalid',
   deletion_requested_at:deletionRequested,deleted_at:deletionCompleted},
  {account_id:b,deletion_request_id:reqB,recipient_email_normalized:'recipient.b@example.invalid',
   deletion_requested_at:deletionRequested,deleted_at:deletionCompleted},
];
const response=(status,body)=>new Response(body===undefined?null:JSON.stringify(body),
  {status,headers:{'Content-Type':'application/json'}});
let checks=0;
async function denied(action,code){
  await assert.rejects(action,error=>error?.code===code,code);checks++;
}
function fixture({rows=samples,ackFail=false,scanFail=false,dropResponse=false,
  incorrectOutboxFor=null,disabledFor=null}={}){
  const records=new Map();
  const acked=new Set();
  let queued=0,ackCalls=0,scanCalls=0;
  const fetchImpl=async(path,options)=>{
    const u=new URL(path);
    assert.equal(u.origin,origin);
    assert.equal(options.headers.apikey,config.supabase.secretKey);
    assert.equal(Object.hasOwn(options.headers,'Authorization'),false);
    assert.equal(options.method,'POST');
    const name=u.pathname.replace('/rest/v1/rpc/','');
    const payload=JSON.parse(options.body);
    if(name==='list_account_deletion_completion_recoveries'){
      scanCalls++;
      assert.equal(payload.max_items,2);
      if(scanFail)return response(503,{message:'fixture-down'});
      return response(200,rows.filter(x=>!acked.has(x.account_id)));
    }
    if(name==='confirm_account_deletion_completion_outbox'){
      ackCalls++;
      const outbox=records.get(payload.recorded_account_id);
      assert.ok(outbox);
      assert.equal(payload.recorded_outbox_id,outbox.id);
      if(ackFail)return response(503,{message:'fixture-ack-down'});
      acked.add(payload.recorded_account_id);
      if(dropResponse)return response(204);
      return response(200,true);
    }
    assert.fail('Unexpected API/RPC path '+u.pathname);
  };
  const enqueueCompletion=async intent=>{
    queued++;
    const id=intent.outboxRecord.business_object_id;
    assert.ok(id===a||id===b);
    assert.equal(intent.messageId,'account_deletion_completed');
    assert.equal(intent.outboxRecord.classification,'transactional_operational');
    assert.equal(intent.outboxRecord.payload&&Object.keys(intent.outboxRecord.payload).length,0);
    assert.match(intent.outboxRecord.idempotency_key,/^notification:v1:[0-9a-f]{64}$/);
    const old=records.get(id);
    if(disabledFor===id)return {enabled:false};
    const record=old || {...intent.outboxRecord,id:randomUUID(),status:'queued'};
    records.set(id,record);
    if(incorrectOutboxFor===id) return {
      enabled:true,outbox:{...record,recipient_email_normalized:'imposter@example.invalid'},
    };
    return {enabled:true,outbox:record};
  };
  return {fetchImpl,enqueueCompletion,records,acked,
    get queued(){return queued;},get ackCalls(){return ackCalls;},get scanCalls(){return scanCalls;}};
}
async function execute(f,maxItems=2){
  return runOfflineCompletionRecovery({
    config,fetchImpl:f.fetchImpl,enqueueCompletion:f.enqueueCompletion,maxItems,
  });
}
{
  const f=fixture({incorrectOutboxFor:b});
  const got=await execute(f);
  assert.deepEqual({scanned:got.scanned,recorded:got.recorded,manualReview:got.manualReview},
    {scanned:2,recorded:1,manualReview:1});
  assert.equal(got.outcomes[0].state,'outbox_recorded');
  assert.equal(got.outcomes[1].state,'manual_review');
  assert.equal(got.outcomes[1].code,'COMPLETION_RECOVERY_OUTBOX_IDENTITY_MISMATCH');
  assert.equal(f.queued,2);
  assert.equal(f.ackCalls,1);
  assert.equal(f.acked.size,1);
  assert.equal(JSON.stringify(got).includes('recipient.'),false);
  assert.equal(JSON.stringify(got).includes(a),false);
  assert.equal(JSON.stringify(got).includes(b),false);
  assert.equal(JSON.stringify(got).includes(reqA),false);
  assert.equal(JSON.stringify(got).includes(config.supabase.secretKey),false);
  checks+=11;
}
{
  const f=fixture();
  const result=await execute(f);
  assert.equal(result.recorded,2);
  assert.equal(result.manualReview,0);
  assert.equal(f.acked.size,2);
  const again=await execute(f);
  assert.equal(again.scanned,0);
  assert.equal(again.recorded,0);
  assert.equal(f.queued,2);
  checks+=6;
}
for(const [options,expectedCode,queued,acks] of [
  [{ackFail:true},'COMPLETION_RECOVERY_ACK_UNCERTAIN',2,2],
  [{dropResponse:true},'COMPLETION_RECOVERY_ACK_UNCERTAIN',2,2],
  [{disabledFor:a},'COMPLETION_RECOVERY_OUTBOX_NOT_DURABLE',2,1],
]){
  const f=fixture(options);
  const got=await execute(f);
  assert.equal(got.recorded,options.disabledFor?1:0);
  assert.equal(got.manualReview,options.disabledFor?1:2);
  assert.ok(got.outcomes.some(x=>x.code===expectedCode));
  assert.equal(f.queued,queued);
  assert.equal(f.ackCalls,acks);
  checks+=5;
}
{
  const f=fixture({rows:[samples[0],samples[0]]});
  await denied(()=>execute(f),'COMPLETION_RECOVERY_DUPLICATE_ACCOUNT');
  assert.equal(f.queued,0);
  assert.equal(f.ackCalls,0);checks+=2;
}
// Explicit bad snapshot goes through prepare() BEFORE callbacks.
for(const invalid of [
  {...samples[0],recipient_email_normalized:'Bad@Example.invalid'},
  {...samples[0],deleted_at:'not-a-date'},
  {...samples[0],deletion_request_id:'invalid'},
  {...samples[0],deleted_at:'2026-09-01T00:00:00.000Z'},
]){
  const f=fixture({rows:[invalid]});
  await denied(()=>execute(f),'COMPLETION_RECOVERY_ROW_INVALID');
  assert.equal(f.queued,0);
  checks++;
}
{
  const f=fixture({scanFail:true});
  await denied(()=>execute(f),'COMPLETION_RECOVERY_SCAN_FAILED');
  assert.equal(f.queued,0);checks++;
}
for(const [cfg,limit,code] of [
  [{...config,production:true},2,'COMPLETION_RECOVERY_OFFLINE_HOLD'],
  [{...config,mode:'live'},2,'COMPLETION_RECOVERY_OFFLINE_HOLD'],
  [{...config,supabase:{...config.supabase,url:'https://gjzetjugmnwanvjkchux.supabase.co'}},2,'COMPLETION_RECOVERY_OFFLINE_HOLD'],
  [config,0,'COMPLETION_RECOVERY_LIMIT_INVALID'],
  [config,6,'COMPLETION_RECOVERY_LIMIT_INVALID'],
]){
  const f=fixture();
  await denied(()=>runOfflineCompletionRecovery({
    config:cfg,fetchImpl:f.fetchImpl,enqueueCompletion:f.enqueueCompletion,maxItems:limit,
  }),code);
  assert.equal(f.scanCalls,0);assert.equal(f.queued,0);
  checks+=2;
}
console.log('Issue #950 dormant completion recovery adapter: '+checks+
  ' offline assertions PASS, exact existing notification identity and no direct provider sends.');
