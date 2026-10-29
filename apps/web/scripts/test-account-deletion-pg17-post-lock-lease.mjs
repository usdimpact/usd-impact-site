// Issue #950: independent PostgreSQL 17 lock-wait regression.
// Real local container PostgreSQL connections, NO Supabase/GoTrue/Resend.
// The worker starts BEFORE expiry, waits behind a transaction until AFTER
// expiry. Both claim renewal and begin dispatch MUST use post-lock time.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec=promisify(execFile);
assert.equal(process.env.PGHOST,'127.0.0.1');
assert.equal(process.env.PGPORT,'5432');
assert.equal(process.env.PGDATABASE,'postgres');
assert.equal(process.env.PGUSER,'postgres');
assert.equal(process.env.PGPASSWORD,'issue950-local-fixture-only');
let checks=0,connections=0;
const accounts=[
  '11111111-2222-4333-8444-555555555555',
  '22222222-3333-4444-8555-666666666666',
];
const start=Date.now();
function runSql(sql,timeout=25_000){
  connections++;
  return exec('psql',['-X','-A','-t','-q','-v','ON_ERROR_STOP=1','-c',sql],{
    timeout,maxBuffer:512_000,env:process.env,
  }).then(x=>x.stdout.trim());
}
async function trySql(sql){
  try{return {ok:true,value:await runSql(sql)};}
  catch(error){return {ok:false,error:String(error.stderr||error.message)};}
}
async function assertRejected(sql,match){
  const x=await trySql(sql);
  assert.equal(x.ok,false);
  assert.match(x.error,match);
  checks++;
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const req=accounts.map(()=>randomUUID());
for(let i=0;i<accounts.length;i++){
  await runSql("insert into public.profiles(account_id,email,status,auth_user_id,deletion_request_id,deletion_requested_at,deletion_due_at) values ('"+
    accounts[i]+"'::uuid,'test@example.invalid','deletion_pending','"+
    accounts[i]+"'::uuid,'"+req[i]+"'::uuid,now()-interval '9 days',now()-interval '2 days')");
}
function claimSql(i){
  return "select claim_token::text||'|'||claim_generation::text from public.claim_due_account_deletion('"+
    accounts[i]+"'::uuid,'"+req[i]+"'::uuid,'"+randomUUID()+"'::uuid)";
}
function parseClaim(v){
  const [token,generation]=v.split('|');
  assert.match(token,/^[0-9a-f-]{36}$/i);
  assert.ok(Number.isInteger(Number(generation)));
  return {token,generation:Number(generation)};
}
async function grantShortLease(i){
  await runSql("update account_deletion_internal.attempts set pre_dispatch_expires_at=clock_timestamp()+interval '3 seconds' where account_id='"+
    accounts[i]+"'::uuid");
}
async function holdProfileUntilAfterExpiry(i,advisory){
  // Advisory lock is acquired AFTER the profile row lock. A separate probe
  // detects the advisory lock to prove the row is already locked.
  const holding=runSql(
    "begin; select account_id from public.profiles where account_id='"+
      accounts[i]+"'::uuid for update; select pg_advisory_xact_lock("+
      advisory+"::bigint); select pg_sleep(5); commit;",
    15_000,
  );
  let locked=false;
  for(let attempts=0;attempts<35;attempts++){
    const result=await runSql("select pg_try_advisory_lock("+advisory+"::bigint)");
    if(result==='f'){locked=true;break;}
    await pause(65);
  }
  assert.equal(locked,true,'must prove profile row lock before start');
  checks++;
  return holding;
}

// Case A: "begin" starts during a valid pre-dispatch lease but waits until
// after expiration. It may NEVER detach the FK or signal Auth dispatch.
const originalA=parseClaim(await runSql(claimSql(0)));
await grantShortLease(0);
const holderA=await holdProfileUntilAfterExpiry(0,950301);
// A function entry made now sees unexpired lease; source before fix would
// compute v_now here and authorize after a five-second wait.
const begunAt=Date.now();
await assertRejected(
  "select public.begin_claimed_auth_removal('"+accounts[0]+"'::uuid,'"+
    req[0]+"'::uuid,'"+originalA.token+"'::uuid,"+originalA.generation+"::bigint)",
  /deletion dispatch fence rejected/,
);
await holderA;
assert.ok(Date.now()-begunAt>=3000,'must have passed lease deadline while blocked');
assert.equal(await runSql("select state from account_deletion_internal.attempts where account_id='"+
  accounts[0]+"'::uuid"),'claimed');
assert.equal(await runSql("select auth_user_id::text from public.profiles where account_id='"+
  accounts[0]+"'::uuid"),accounts[0]);
checks+=3;

// Case B: "claim" starts before expiry and waits behind a profile lock.
// Once released, it MUST see expiry and issue a new generation, not reject
// using the stale function-entry timestamp.
const originalB=parseClaim(await runSql(claimSql(1)));
await grantShortLease(1);
const holderB=await holdProfileUntilAfterExpiry(1,950302);
const renewedAt=Date.now();
const renewal=parseClaim(await runSql(claimSql(1)));
await holderB;
assert.ok(Date.now()-renewedAt>=3000,'reclaim must be delayed past expiry');
assert.equal(renewal.generation,originalB.generation+1);
assert.notEqual(renewal.token,originalB.token);
assert.equal(await runSql("select auth_user_id::text from public.profiles where account_id='"+
  accounts[1]+"'::uuid"),accounts[1]);
checks+=4;
await assertRejected(
  "select public.begin_claimed_auth_removal('"+accounts[1]+"'::uuid,'"+
    req[1]+"'::uuid,'"+originalB.token+"'::uuid,"+originalB.generation+"::bigint)",
  /deletion dispatch fence rejected/,
);
const success=await runSql("select public.begin_claimed_auth_removal('"+
  accounts[1]+"'::uuid,'"+req[1]+"'::uuid,'"+renewal.token+"'::uuid,"+
  renewal.generation+"::bigint)");
assert.equal(success,accounts[1]);checks++;
assert.equal(await runSql("select state from account_deletion_internal.attempts where account_id='"+
  accounts[1]+"'::uuid"),'auth_dispatched');checks++;
console.log('Issue #950 post-lock clock: '+checks+
  ' real PG17 assertions PASS over '+connections+
  ' independent psql connections; no real Supabase/Auth/PII.');
