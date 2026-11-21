import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  runOfflineDueDeletionBatch,
  scanOfflineDueDeletionCandidates,
} from '../src/lib/account-deletion-due-batch-candidate.js';

const a='11111111-2222-4333-8444-555555555555';
const b='22222222-3333-4444-8555-666666666666';
const c='33333333-4444-4555-8666-777777777777';
const idFromAccount={ [a]:randomUUID(),[b]:randomUUID(),[c]:randomUUID() };
const origin='https://ycstrcvshdluovtuasjc.supabase.co';
const config={mode:'offline_fixture',production:false,supabase:{
  url:origin,secretKey:'sb_secret_'+('x'.repeat(32)),
}};
const requested='2026-08-20T00:00:00.000Z';
const due='2026-08-27T00:00:00.000Z';
const now=new Date('2026-08-28T00:00:00.000Z');
const row=account=>({
  account_id:account,status:'deletion_pending',
  deletion_request_id:idFromAccount[account],
  deletion_requested_at:requested,
  deletion_due_at:due,
  deleted_at:null,
  auth_user_id:account,
});
const original=[row(a),row(b),row(c)];
const response=(status,payload)=>new Response(
  payload===undefined?null:JSON.stringify(payload),
  {status,headers:{'Content-Type':'application/json'}},
);
let checks=0;
const stage=new Map([[a,'eligible'],[b,'eligible'],[c,'taken']]);
let authCount=0,completionCount=0,scanCount=0;
const calls=[];
async function fetchImpl(url,options){
  const u=new URL(url);
  assert.equal(u.origin,origin);
  assert.equal(options.headers.apikey,config.supabase.secretKey);
  assert.equal(Object.hasOwn(options.headers,'Authorization'),false);
  const path=u.pathname;
  if(path==='/rest/v1/profiles'){
    assert.equal(options.method,'GET');
    assert.equal(u.searchParams.get('status'),'eq.deletion_pending');
    assert.equal(u.searchParams.get('auth_user_id'),'not.is.null');
    assert.equal(u.searchParams.get('limit'),'3');
    assert.ok(u.searchParams.get('select').includes('deletion_request_id'));
    scanCount++;
    return response(200,original);
  }
  assert.equal(options.method,'POST');
  assert.equal(options.headers['Content-Type'],'application/json');
  assert.ok(path.startsWith('/rest/v1/rpc/'));
  const method=path.replace('/rest/v1/rpc/','');
  const body=JSON.parse(options.body);
  const id=String(Object.values(body)[0]);
  calls.push({method,id});
  if(method==='claim_due_account_deletion'){
    if(stage.get(id)!=='eligible')return response(409,{code:'55000'});
    stage.set(id,'claimed');
    return response(200,[{
      claim_token:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      claim_generation:1,
      claimed_auth_user_id:id,
      claimed_request_id:idFromAccount[id],
    }]);
  }
  if(method==='begin_claimed_auth_removal'){
    assert.equal(stage.get(id),'claimed');
    stage.set(id,'dispatched');
    return response(200,id);
  }
  if(method==='mark_claimed_auth_ambiguous'){
    assert.equal(body.ambiguous_error_code,'auth_404');
    assert.equal(stage.get(id),'dispatched');
    stage.set(id,'ambiguous');
    return response(200,true);
  }
  if(method==='confirm_claimed_auth_soft_delete'){
    assert.equal(body.confirm_http_status,200);
    assert.equal(stage.get(id),'dispatched');
    stage.set(id,'confirmed');
    return response(200,true);
  }
  if(method==='finalize_claimed_account_deletion'){
    assert.equal(stage.get(id),'confirmed');
    stage.set(id,'finalized');
    return response(200,[{
      account_id:id,recipient_email:'synthetic@example.invalid',
      deletion_requested_at:requested,
      deleted_at:now.toISOString(),
    }]);
  }
  assert.fail('Unexpected RPC '+method);
}
async function authSoftDelete({accountId,authUserId,shouldSoftDelete}){
  authCount++;
  assert.equal(accountId,authUserId);
  assert.equal(stage.get(accountId),'dispatched');
  assert.equal(shouldSoftDelete,true);
  return {status:accountId===a?200:404};
}
async function recordCompletion(row){
  completionCount++;
  assert.equal(row.account_id,a);
  assert.equal(stage.get(row.account_id),'finalized');
  return {durable:true,reference:'offline-outbox'};
}

const first=await runOfflineDueDeletionBatch({
  config,fetchImpl,authSoftDelete,recordCompletion,now,limit:3,
});
assert.deepEqual(
  {
    mode:first.mode,scanned:first.scanned,finalized:first.finalized,
    conflicts:first.conflicts,manualReview:first.manualReview,
  },
  {mode:'offline_fixture',scanned:3,finalized:1,conflicts:1,manualReview:1},
);
assert.deepEqual(first.outcomes.map(x=>x.state),
  ['finalized','manual_review','conflict']);
assert.equal(first.outcomes[1].code,'AUTH_OUTCOME_UNVERIFIED');
assert.equal(first.outcomes[2].code,'CLAIM_NOT_GRANTED');
assert.equal(authCount,2);
assert.equal(completionCount,1);
assert.equal(scanCount,1);
assert.equal(calls.filter(x=>x.method==='claim_due_account_deletion').length,3);
assert.equal(calls.filter(x=>x.method==='begin_claimed_auth_removal').length,2);
assert.equal(calls.filter(x=>x.method==='mark_claimed_auth_ambiguous').length,1);
assert.equal(calls.filter(x=>x.method==='finalize_claimed_account_deletion').length,1);
assert.equal(JSON.stringify(first).includes('synthetic@example.invalid'),false);
assert.equal(JSON.stringify(first).includes(config.supabase.secretKey),false);
for(const account of [a,b,c]){
  assert.equal(JSON.stringify(first).includes(account),false,
    'no raw UUID in batch outcome');
}
checks+=15;

// A stale due scan can never trigger a repeat Auth attempt; actual SQL claim
// would reject dispatched/deleted/ambiguous states even if scan is stale.
const second=await runOfflineDueDeletionBatch({
  config,fetchImpl,authSoftDelete,recordCompletion,now,limit:3,
});
assert.equal(second.finalized,0);
assert.equal(second.conflicts,3);
assert.equal(second.manualReview,0);
assert.equal(authCount,2);
assert.equal(completionCount,1);
checks+=5;

async function rejected(fn,code){
  await assert.rejects(fn,error=>error?.code===code,code);
  checks++;
}
const forbidden=()=>{assert.fail('No downstream provider, DB claim or outbox allowed');};
let invalidCalls=0;
const invalidFetch=rows=>async(url,options)=>{
  invalidCalls++;
  assert.equal(options.method,'GET');
  assert.equal(new URL(url).pathname,'/rest/v1/profiles');
  return response(200,rows);
};
// A malformed list must fail before ANY claim, Auth or email.
for(const [label,invalid,code] of [
  ['missing request ID',[{...row(a),deletion_request_id:null}],'CLAIM_BATCH_SNAPSHOT_INVALID'],
  ['changed Auth link',[{...row(a),auth_user_id:b}],'CLAIM_BATCH_SNAPSHOT_INVALID'],
  ['detached Auth link',[{...row(a),auth_user_id:null}],'CLAIM_BATCH_SNAPSHOT_INVALID'],
  ['future due',[{...row(a),deletion_due_at:'2026-09-10T00:00:00Z'}],'CLAIM_BATCH_SNAPSHOT_INVALID'],
  ['already deleted',[{...row(a),deleted_at:'2026-08-27T00:00:00Z'}],'CLAIM_BATCH_SNAPSHOT_INVALID'],
  ['duplicate accounts',[row(a),row(a)],'CLAIM_BATCH_DUPLICATE_ACCOUNT'],
  ['oversized list',[row(a),row(b)],'CLAIM_BATCH_SCAN_INVALID'],
  ['not a list',{rows:[row(a)]},'CLAIM_BATCH_SCAN_INVALID'],
]){
  const rows=invalid;
  await rejected(()=>runOfflineDueDeletionBatch({
    config,fetchImpl:invalidFetch(rows),authSoftDelete:forbidden,
    recordCompletion:forbidden,now,limit:label==='oversized list'?1:3,
  }),code);
}
assert.equal(invalidCalls,8);checks++;

// Before any scan: hard OFF for Production, unexpected origin, invalid
// clock, bad batch, missing injected functions or a non-fixture mode.
for(const [conf,limit,time,code] of [
  [{...config,production:true},1,now,'CLAIM_BATCH_OFFLINE_HOLD'],
  [{...config,mode:'live'},1,now,'CLAIM_BATCH_OFFLINE_HOLD'],
  [{...config,supabase:{...config.supabase,url:'https://gjzetjugmnwanvjkchux.supabase.co'}},1,now,'CLAIM_BATCH_OFFLINE_HOLD'],
  [config,0,now,'CLAIM_BATCH_LIMIT_INVALID'],
  [config,6,now,'CLAIM_BATCH_LIMIT_INVALID'],
  [config,1,new Date('invalid'),'CLAIM_BATCH_TIME_INVALID'],
]){
  await rejected(()=>runOfflineDueDeletionBatch({
    config:conf,fetchImpl:forbidden,
    authSoftDelete:forbidden,recordCompletion:forbidden,
    now:time,limit,
  }),code);
}
// Failed due GET must fail before a claim or Auth operation.
await rejected(()=>scanOfflineDueDeletionCandidates({
  config,fetchImpl:async()=>response(503,{error:'synthetic down'}),now,limit:1,
}),'CLAIM_BATCH_SCAN_FAILED');
await rejected(()=>scanOfflineDueDeletionCandidates({
  config,fetchImpl:async()=>new Response('not-json',{status:200}),now,limit:1,
}),'CLAIM_BATCH_SCAN_INVALID');

console.log('Issue #950 dormant offline due-batch coordinator: '+checks+
  ' assertions PASS; zero real network/DB/identity/email.');
