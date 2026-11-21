// Issue #950: REAL independent PostgreSQL 17 connection concurrency in an
// ephemeral GitHub Actions service; synthetic UUIDs only, no Supabase project.
// This test can prove SQL row-lock serialization, NOT a real PostgREST/GoTrue
// cross-system exactly-once guarantee or a Production-safe deletion.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec=promisify(execFile);
assert.ok(['127.0.0.1','localhost'].includes(process.env.PGHOST));
assert.equal(String(process.env.PGPORT),'5432');
assert.equal(process.env.PGDATABASE,'postgres');
assert.equal(process.env.PGUSER,'postgres');
assert.equal(process.env.PGPASSWORD,'issue950-local-fixture-only');
let checks=0,connections=0;
const accounts=[
  '11111111-2222-4333-8444-555555555555', // first-claim
  '22222222-3333-4444-8555-666666666666', // pre-dispatch lease
  '33333333-4444-4555-8666-777777777777', // pre-claim cancellation
  '44444444-5555-4666-8777-888888888888', // simultaneous claim/cancellation
  '55555555-6666-4777-8888-999999999999', // not-due account
];
const accepted = value => String(value||'').trim();
async function psql(sql) {
  connections++;
  const value=await exec('psql',[
    '-X','-A','-t','-q','-v','ON_ERROR_STOP=1','-c',sql,
  ],{timeout:20_000,maxBuffer:512*1024,env:process.env});
  return accepted(value.stdout);
}
async function attempt(sql){
  try{return {ok:true,value:await psql(sql)};}
  catch(e){return {ok:false,error:accepted(e.stderr||e.message)};}
}
function expectedFailure(r,re,label){
  assert.equal(r.ok,false,label+' should fail');
  assert.match(r.error,re,label+' must be an SQL state rejection');
  checks++;
}
function claimSql(account,requestId,workerNonce=randomUUID()){
  return "select claim_token::text || '|' || claim_generation::text || '|' || claimed_auth_user_id::text from public.claim_due_account_deletion('"+
    account+"'::uuid,'"+requestId+"'::uuid,'"+workerNonce+"'::uuid)";
}
function beginSql(account,requestId,token,generation){
  return "select public.begin_claimed_auth_removal('"+account+"'::uuid,'"+
    requestId+"'::uuid,'"+token+"'::uuid,"+Number(generation)+"::bigint)";
}
function confirmSql(account,requestId,token,generation,status){
  return "select public.confirm_claimed_auth_soft_delete('"+account+"'::uuid,'"+
    requestId+"'::uuid,'"+token+"'::uuid,"+Number(generation)+"::bigint,"+
    Number(status)+"::integer)";
}
function finalizeSql(account,requestId,token,generation){
  return "select account_id::text from public.finalize_claimed_account_deletion('"+
    account+"'::uuid,'"+requestId+"'::uuid,'"+token+"'::uuid,"+
    Number(generation)+"::bigint)";
}
async function seed(account,daysUntilDue=-2){
  const now=new Date();
  const due=new Date(now.getTime()+daysUntilDue*86400_000).toISOString();
  const requested=new Date(now.getTime()-(daysUntilDue<0?9:1)*86400_000).toISOString();
  const id=randomUUID();
  await psql("insert into public.profiles(account_id,email,status,auth_user_id,deletion_request_id,deletion_requested_at,deletion_due_at) values ('"+
    account+"'::uuid,'synthetic@example.invalid','deletion_pending','"+
    account+"'::uuid,'"+id+"'::uuid,'"+requested+"'::timestamptz,'"+
    due+"'::timestamptz)");
  return id;
}
function parseClaim(res){
  assert.equal(res.ok,true,res.error||'one claim should succeed');
  const [token,generation,authId]=res.value.split('|');
  assert.match(token,/^[0-9a-f-]{36}$/i);
  assert.ok(Number.isSafeInteger(Number(generation))&&Number(generation)>0);
  assert.match(authId,/^[0-9a-f-]{36}$/i);
  return {token,generation:Number(generation),authId};
}

const ids=[];
for(const [index,account] of accounts.entries()){
  ids.push(await seed(account,index===4?2:-2));
}

// Real independent PostgreSQL connections must serialize on profile FOR UPDATE.
const wave1=await Promise.all(
  Array.from({length:24},()=>attempt(claimSql(accounts[0],ids[0]))),
);
const winners1=wave1.filter(x=>x.ok),losers1=wave1.filter(x=>!x.ok);
assert.equal(winners1.length,1,'only one of 24 real connections may claim');
assert.equal(losers1.length,23);
for(const r of losers1)assert.match(r.error,/already held or dispatched/);
checks+=2;
const first=parseClaim(winners1[0]);
assert.equal(first.generation,1);
assert.equal(first.authId,accounts[0]);checks+=2;
expectedFailure(await attempt(beginSql(accounts[0],ids[0],randomUUID(),1)),
  /dispatch fence rejected/,'forged token');
assert.equal(await psql("select auth_user_id::text from public.profiles where account_id='"+
  accounts[0]+"'::uuid"),accounts[0]);checks++;
assert.equal(await psql(beginSql(accounts[0],ids[0],first.token,first.generation)),accounts[0]);
checks++;
expectedFailure(await attempt(beginSql(accounts[0],ids[0],first.token,first.generation)),
  /dispatch fence rejected/,'duplicate irreversible begin');
assert.equal(await psql("select state from account_deletion_internal.attempts where account_id='"+
  accounts[0]+"'::uuid"),'auth_dispatched');
assert.equal(await psql("select count(*) from public.profiles where account_id='"+
  accounts[0]+"'::uuid and auth_user_id is null"),'1');
checks+=2;
expectedFailure(await attempt(claimSql(accounts[0],ids[0])),
  /not claimable|already held or dispatched/,'no second claim after dispatch');
expectedFailure(await attempt(confirmSql(accounts[0],ids[0],first.token,first.generation,404)),
  /confirmation fence rejected/,'404 must not mean confirmed');
assert.equal(await psql("select public.mark_claimed_auth_ambiguous('"+
  accounts[0]+"'::uuid,'"+ids[0]+"'::uuid,'"+first.token+"'::uuid,"+
  first.generation+"::bigint,'auth_404')"),'t');
checks++;
expectedFailure(await attempt(claimSql(accounts[0],ids[0])),
  /not claimable|already held or dispatched/,'unknown Auth state remains fenced');

// Pre-dispatch expiry permits exactly ONE new generation, never old token.
const before= parseClaim(await attempt(claimSql(accounts[1],ids[1])));
await psql("update account_deletion_internal.attempts set "+
  "claimed_at=clock_timestamp()-interval '10 minutes',"+
  "pre_dispatch_expires_at=clock_timestamp()-interval '1 second' "+
  "where account_id='"+accounts[1]+"'::uuid");
const wave2=await Promise.all(Array.from({length:16},()=>attempt(
  claimSql(accounts[1],ids[1]),
)));
assert.equal(wave2.filter(x=>x.ok).length,1);
assert.equal(wave2.filter(x=>!x.ok).length,15);
for(const r of wave2.filter(x=>!x.ok))assert.match(r.error,/already held or dispatched/);
checks+=2;
const after=parseClaim(wave2.find(x=>x.ok));
assert.equal(after.generation,before.generation+1);
assert.notEqual(after.token,before.token);checks+=2;
expectedFailure(await attempt(beginSql(accounts[1],ids[1],before.token,before.generation)),
  /dispatch fence rejected/,'expired owner cannot dispatch');
assert.equal(await psql(beginSql(accounts[1],ids[1],after.token,after.generation)),accounts[1]);
checks++;
expectedFailure(await attempt("update public.profiles set status='active' where account_id='"+
  accounts[1]+"'::uuid"),/claimed deletion forbids profile mutation/,'late cancellation');
assert.equal(await psql(confirmSql(accounts[1],ids[1],after.token,after.generation,200)),'t');
checks++;
expectedFailure(await attempt(finalizeSql(accounts[1],ids[1],first.token,first.generation)),
  /finalize fence rejected/,'different attempt token cannot finalize');
assert.equal(await psql(finalizeSql(accounts[1],ids[1],after.token,after.generation)),accounts[1]);
assert.equal(await psql("select status from public.profiles where account_id='"+
  accounts[1]+"'::uuid"),'deleted');
assert.equal(await psql("select state from account_deletion_internal.attempts where account_id='"+
  accounts[1]+"'::uuid"),'finalized');checks+=3;
expectedFailure(await attempt(finalizeSql(accounts[1],ids[1],after.token,after.generation)),
  /finalize fence rejected/,'no double finalization');
expectedFailure(await attempt("select * from public.finalize_account_deletion('"+
  accounts[1]+"'::uuid)"),/legacy unfenced.*disabled/,'old unfenced RPC disabled');

// Cancellation-before-claim invalidates old scan.
await psql("update public.profiles set status='active',deletion_request_id=null,"+
  "deletion_requested_at=null,deletion_due_at=null where account_id='"+
  accounts[2]+"'::uuid");
expectedFailure(await attempt(claimSql(accounts[2],ids[2])),
  /not claimable/,'cancelled request cannot claim');

// Actual two-connection claim-vs-cancellation race must allow ONE winner only.
const [claimRace,cancelRace]=await Promise.all([
  attempt(claimSql(accounts[3],ids[3])),
  attempt("update public.profiles set status='active' where account_id='"+
    accounts[3]+"'::uuid"),
]);
assert.notEqual(claimRace.ok,cancelRace.ok,'claim and cancellation cannot both succeed');
if(claimRace.ok){
  expectedFailure(cancelRace,/claimed deletion forbids profile mutation/,'claim winner fences cancellation');
  assert.equal(await psql("select status from public.profiles where account_id='"+
    accounts[3]+"'::uuid"),'deletion_pending');
}else{
  expectedFailure(claimRace,/not claimable/,'cancel winner fences claim');
  assert.equal(await psql("select status from public.profiles where account_id='"+
    accounts[3]+"'::uuid"),'active');
}
checks+=2;

// A request due in the future must never issue a worker token.
expectedFailure(await attempt(claimSql(accounts[4],ids[4])),
  /not claimable/,'not-due account');

// Restricted API roles cannot call privileged claim functions.
expectedFailure(await attempt("set role authenticated; select * from public.claim_due_account_deletion('"+
  accounts[4]+"'::uuid,'"+ids[4]+"'::uuid,'"+randomUUID()+"'::uuid)"),
  /permission denied for function/,'browser role cannot claim');
console.log('Issue #950 PostgreSQL 17 independent connections: '+checks+
  ' assertions PASS; '+connections+' psql connections; 24-worker and 16-worker races; no real Supabase/Auth/email.');
