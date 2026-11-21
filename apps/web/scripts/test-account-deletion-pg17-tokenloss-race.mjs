// Issue #950: executable isolated PostgreSQL 17 DBA-only tokenloss recovery.
// Dedicated disposable local CI database only; NO Supabase, GoTrue or Resend.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec=promisify(execFile);
assert.equal(process.env.PGHOST,'127.0.0.1');
assert.equal(process.env.PGPORT,'5432');
assert.equal(process.env.PGUSER,'postgres');
assert.equal(process.env.PGDATABASE,'postgres');
assert.equal(process.env.PGPASSWORD,'issue950-local-fixture-only');

const accounts=[
  '11111111-2222-4333-8444-555555555555',
  '22222222-3333-4444-8555-666666666666',
  '33333333-4444-4555-8666-777777777777',
];
let checks=0,connections=0;
async function sql(query,timeout=20000){
  connections++;
  const out=await exec('psql',['-X','-A','-t','-q','-v','ON_ERROR_STOP=1','-c',query],
    {env:process.env,timeout,maxBuffer:512000});
  return out.stdout.trim();
}
async function attempt(query){
  try{return {ok:true,value:await sql(query)};}
  catch(e){return {ok:false,error:String(e.stderr||e.message)};}
}
async function denied(query,regexp,label){
  const result=await attempt(query);
  assert.equal(result.ok,false,label);
  assert.match(result.error,regexp,label);
  checks++;
}
function recoveryQuery(account,request,attemptId,generation){
  return "select account_deletion_internal.recover_confirmed_without_token('"+
    account+"'::uuid,'"+request+"'::uuid,'"+attemptId+"'::uuid,"+
    Number(generation)+"::bigint,'CHANGE-950-001','SECURITY-950-001')";
}
async function seed(index){
  const id=accounts[index];
  const request=randomUUID();
  await sql("insert into public.profiles(account_id,email,status,auth_user_id,deletion_request_id,deletion_requested_at,deletion_due_at) values ('"+
    id+"'::uuid,'synthetic"+index+"@example.invalid','deletion_pending','"+
    id+"'::uuid,'"+request+"'::uuid,now()-interval '9 days',now()-interval '2 days')");
  const claim=(await sql("select claim_token::text||'|'||claim_generation::text from public.claim_due_account_deletion('"+
    id+"'::uuid,'"+request+"'::uuid,'"+randomUUID()+"'::uuid)")).split('|');
  assert.equal(claim.length,2);
  const token=claim[0],gen=Number(claim[1]);
  assert.ok(gen>0);
  await sql("select public.begin_claimed_auth_removal('"+id+"'::uuid,'"+
    request+"'::uuid,'"+token+"'::uuid,"+gen+"::bigint)");
  const attemptId=await sql("select attempt_id::text from account_deletion_internal.attempts where account_id='"+
    id+"'::uuid");
  checks+=2;
  return {id,request,token,gen,attemptId};
}
const a=await seed(0);
assert.equal(await sql("select public.confirm_claimed_auth_soft_delete('"+
  a.id+"'::uuid,'"+a.request+"'::uuid,'"+a.token+"'::uuid,"+a.gen+"::bigint,200)"),'t');
checks++;

// Two genuinely independent psql sessions compete for one completed/confirmed
// account. One can finalize; the other must see finalized state after lock.
const contenders=await Promise.all([
  attempt(recoveryQuery(a.id,a.request,a.attemptId,a.gen)),
  attempt(recoveryQuery(a.id,a.request,a.attemptId,a.gen)),
]);
assert.equal(contenders.filter(x=>x.ok).length,1);
assert.equal(contenders.filter(x=>!x.ok).length,1);
assert.equal(contenders.find(x=>x.ok).value,'t');
assert.match(contenders.find(x=>!x.ok).error,/confirmed-state erasure fence rejected/);
checks+=4;
assert.equal(await sql("select status from public.profiles where account_id='"+
  a.id+"'::uuid"),'deleted');
assert.equal(await sql("select state from account_deletion_internal.attempts where account_id='"+
  a.id+"'::uuid"),'finalized');
assert.equal(await sql("select state from account_deletion_internal.completion_intents where account_id='"+
  a.id+"'::uuid"),'pending');
assert.equal(await sql("select count(*) from account_deletion_internal.confirmed_recovery_audit where account_id='"+
  a.id+"'::uuid"),'1');checks+=4;
await denied("set role service_role;"+recoveryQuery(a.id,a.request,a.attemptId,a.gen),
  /permission denied/,'application service role cannot execute DBA recovery');
await denied("set role authenticated;"+recoveryQuery(a.id,a.request,a.attemptId,a.gen),
  /permission denied/,'authenticated user cannot execute DBA recovery');

// Dispatched or ambiguous is not a confirmed external Auth result.
const b=await seed(1);
await denied(recoveryQuery(b.id,b.request,b.attemptId,b.gen),
  /confirmed-state erasure fence rejected/,'not confirmed');
assert.equal(await sql("select public.mark_claimed_auth_ambiguous('"+
  b.id+"'::uuid,'"+b.request+"'::uuid,'"+b.token+"'::uuid,"+b.gen+"::bigint,'auth_404')"),'t');
await denied(recoveryQuery(b.id,b.request,b.attemptId,b.gen),
  /confirmed-state erasure fence rejected/,'ambiguous cannot be force finalized');
checks++;

// Regular claim token route still works after factoring out shared helper.
const c=await seed(2);
await sql("select public.confirm_claimed_auth_soft_delete('"+
  c.id+"'::uuid,'"+c.request+"'::uuid,'"+c.token+"'::uuid,"+c.gen+"::bigint,204)");
const ordinary=await sql("select account_id::text from public.finalize_claimed_account_deletion('"+
  c.id+"'::uuid,'"+c.request+"'::uuid,'"+c.token+"'::uuid,"+c.gen+"::bigint)");
assert.equal(ordinary,c.id);
assert.equal(await sql("select count(*) from account_deletion_internal.confirmed_recovery_audit where account_id='"+
  c.id+"'::uuid"),'0');
checks+=2;
console.log('Issue #950 independent PostgreSQL 17 token-loss recovery: '+
  checks+' checks PASS over '+connections+' separate psql connections. No real user, Auth Admin, email or Supabase project.');
