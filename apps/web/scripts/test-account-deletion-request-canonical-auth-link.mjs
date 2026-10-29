// Issue #950 — canonical Auth-link security fence, disposable PGlite only.
// Executes the exact review-only SQL against synthetic accounts; no network,
// real identities, provider secrets, live SQL, email or Auth Admin calls.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const file=relative=>readFileSync(new URL(relative,import.meta.url),'utf8');
const fixture=file('./fixtures/account-deletion-pg17-claim-schema.sql');
const claim=file('../../../docs/operations/candidates/account-deletion-atomic-claim.review.sql');
assert.match(claim,/and auth_user_id = caller_account_id/);
assert.match(claim,/and deleted_at is null/);
assert.doesNotMatch(claim,/delete\s+from\s+auth\.users/i);

const db=new PGlite();
const linked='11111111-2222-4333-8444-555555555555';
const detached='22222222-3333-4444-8555-666666666666';
const mismatched='33333333-4444-4555-8666-777777777777';
const previouslyDeleted='44444444-5555-4666-8777-888888888888';
const unrelated='55555555-6666-4777-8888-999999999999';
let checks=0;
async function row(sql,params=[]){
  return (await db.query(sql,params)).rows[0];
}
async function claimAs(id){
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??'']);
  return row('select (public.request_account_deletion()).status::text as status');
}
async function rejectAs(id,message){
  await assert.rejects(()=>claimAs(id),new RegExp(message));
  checks++;
}
async function profile(accountId){
  return row("select status::text,auth_user_id,deletion_request_id,deletion_requested_at,deletion_due_at,deleted_at from public.profiles where account_id=$1",[accountId]);
}
async function countRequests(accountId){
  const x=await row("select count(*)::integer as n from public.privacy_requests where account_id=$1",[accountId]);
  return x.n;
}
try{
  await db.exec(fixture);
  await db.exec(claim);
  // This fixture models a signed JWT through PostgreSQL's session GUC,
  // without issuing any Supabase Auth tokens.
  await db.exec("create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");

  const privileges=await row("select has_function_privilege('anon','public.request_account_deletion()','EXECUTE') as anon,has_function_privilege('authenticated','public.request_account_deletion()','EXECUTE') as authenticated,has_function_privilege('service_role','public.request_account_deletion()','EXECUTE') as service");
  assert.deepEqual(privileges,{anon:false,authenticated:true,service:false});
  checks++;
  await db.query("insert into public.profiles(account_id,email,status,auth_user_id) values ($1,'valid@example.invalid','active',$1)",[linked]);
  await db.query("insert into public.profiles(account_id,email,status,auth_user_id) values ($1,'detached@example.invalid','active',null)",[detached]);
  await db.query("insert into public.profiles(account_id,email,status,auth_user_id) values ($1,'mismatch@example.invalid','active',$2)",[mismatched,unrelated]);
  await db.query("insert into public.profiles(account_id,email,status,auth_user_id,deleted_at) values ($1,'previously-deleted@example.invalid','active',$1,now()-interval '1 day')",[previouslyDeleted]);

  await db.exec('set role authenticated');
  try{
    await rejectAs(null,'authentication is required');
    await rejectAs(detached,'account is not eligible');
    await rejectAs(mismatched,'account is not eligible');
    await rejectAs(previouslyDeleted,'account is not eligible');
    await rejectAs(unrelated,'account is not eligible');
    for(const id of [detached,mismatched,previouslyDeleted]){
      const p=await profile(id);
      assert.equal(p.status,'active');
      assert.equal(p.deletion_request_id,null);
      assert.equal(p.deletion_requested_at,null);
      assert.equal(p.deletion_due_at,null);
      assert.equal(await countRequests(id),0);
      checks+=5;
    }
    const good=await claimAs(linked);
    assert.equal(good.status,'deletion_pending');
    const p=await profile(linked);
    assert.equal(p.status,'deletion_pending');
    assert.ok(p.deletion_request_id);
    assert.ok(p.deletion_requested_at);
    assert.ok(p.deletion_due_at);
    assert.ok(new Date(p.deletion_due_at)>new Date(p.deletion_requested_at));
    assert.equal(p.auth_user_id,linked);
    assert.equal(await countRequests(linked),1);
    checks+=8;
    await rejectAs(linked,'account is not eligible');
    assert.equal(await countRequests(linked),1,'duplicate calls must not create additional privacy requests');
    checks++;
  }finally{
    await db.exec('reset role');
  }

  // Genuine non-member browser role does not get to invoke a SECURITY DEFINER
  // function even when a test claims to have a valid JWT subject.
  await db.exec('set role anon');
  try{
    await assert.rejects(()=>claimAs(linked),/permission denied/i);
    checks++;
  }finally{
    await db.exec('reset role');
  }
  assert.equal((await row("select count(*)::integer as n from public.privacy_requests")).n,1);
  checks++;
  console.log('Issue #950 canonical Auth-link request fence: '+checks+
    ' assertions PASS; no real account, JWT, SQL deployment or provider call.');
}finally{
  await db.close();
}
