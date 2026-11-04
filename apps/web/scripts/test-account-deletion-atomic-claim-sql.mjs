// Synthetic, no-network PostgreSQL-in-WASM acceptance for #950 SQL candidate.
// PGlite is in-process: apparent concurrent requests are NOT a live HTTP race.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const candidate = readFileSync(
  new URL('../../../docs/operations/candidates/account-deletion-atomic-claim.review.sql', import.meta.url), 'utf8',
);
assert.match(candidate, /REVIEW-ONLY SQL CANDIDATE/);
assert.match(candidate, /claim_token_sha256/);
assert.match(candidate, /set schema account_deletion_internal/i);
const db = new PGlite();
const fixture = [
  "create role anon nologin;",
  "create role authenticated nologin;",
  "create role service_role nologin;",
  "create schema auth;",
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(pg_catalog.current_setting('usdimpact.test_uid',true),'')::uuid $$;",
  "create type public.account_status as enum ('active','suspended','deletion_pending','deleted');",
  "create type public.request_status as enum ('open','in_progress','completed');",
  "create table public.profiles (account_id uuid primary key,email text not null,display_name text,status public.account_status not null default 'active',deletion_requested_at timestamptz,deletion_due_at timestamptz,deleted_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),auth_user_id uuid);",
  "create table public.privacy_requests (account_id uuid,email text,request_type text,status public.request_status,requested_at timestamptz,due_at timestamptz);",
  "create function public.request_account_deletion() returns public.profiles language plpgsql security definer set search_path='' as $$ begin raise exception 'unmigrated request'; end $$;",
  "revoke all on function public.request_account_deletion() from public,anon,service_role;",
  "grant execute on function public.request_account_deletion() to authenticated;",
  "create function public.prepare_account_deletion_auth_removal(prepare_account_id uuid) returns boolean language plpgsql security definer set search_path='' as $$ begin return true; end $$;",
  "revoke all on function public.prepare_account_deletion_auth_removal(uuid) from public,anon,authenticated;",
  "grant execute on function public.prepare_account_deletion_auth_removal(uuid) to service_role;",
  "create function public.finalize_account_deletion(finalize_account_id uuid) returns table (account_id uuid,recipient_email text,deletion_requested_at timestamptz,deleted_at timestamptz) language plpgsql security definer set search_path='' as $core$ declare p public.profiles; ts timestamptz := pg_catalog.clock_timestamp(); begin select x.* into p from public.profiles x where x.account_id=finalize_account_id for update; if p.account_id is null or p.status<>'deletion_pending' or p.auth_user_id is not null then raise exception 'unqualified finalization'; end if; update public.profiles x set status='deleted',deleted_at=ts,updated_at=ts,email='deleted+fixture@accounts.invalid' where x.account_id=p.account_id; return query select p.account_id,p.email,p.deletion_requested_at,ts; end $core$;",
  "revoke all on function public.finalize_account_deletion(uuid) from public,anon,authenticated;",
  "grant execute on function public.finalize_account_deletion(uuid) to service_role;",
].join('\n');
const now=Date.now(), requested=new Date(now-9*86400000).toISOString(), due=new Date(now-2*86400000).toISOString();
const a='11111111-2222-4333-8444-555555555555';
const b='22222222-3333-4444-8555-666666666666';
const c='33333333-4444-4555-8666-777777777777';
const d='44444444-5555-4666-8777-888888888888';
const e='55555555-6666-4777-8888-999999999999';
const workerA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const workerB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const row=async (sql,params=[]) => (await db.query(sql,params)).rows[0];
const reject=async(fn,regex,label)=>{await assert.rejects(fn,regex,label);checks++;};
let checks=0;
const insertPending=async id=>{
  await db.query("insert into public.profiles(account_id,email,status,auth_user_id,deletion_request_id,deletion_requested_at,deletion_due_at) values ($1,'fixture@example.invalid','deletion_pending',$1,pg_catalog.gen_random_uuid(),$2,$3)",[id,requested,due]);
  return (await row("select deletion_request_id from public.profiles where account_id=$1",[id])).deletion_request_id;
};
try {
  await db.exec(fixture);
  await db.query("insert into public.profiles(account_id,email,status,auth_user_id,deletion_requested_at,deletion_due_at) values ($1,'fixture@example.invalid','deletion_pending',$1,$2,$3)",[a,requested,due]);
  await db.exec(candidate);
  const requestA=(await row("select deletion_request_id from public.profiles where account_id=$1",[a])).deletion_request_id;
  assert.match(requestA,/^[a-f0-9-]{36}$/i);checks++;
  for(const name of [
    'claim_due_account_deletion(uuid,uuid,uuid)',
    'begin_claimed_auth_removal(uuid,uuid,uuid,bigint)',
    'confirm_claimed_auth_soft_delete(uuid,uuid,uuid,bigint,integer)',
    'mark_claimed_auth_ambiguous(uuid,uuid,uuid,bigint,text)',
    'finalize_claimed_account_deletion(uuid,uuid,uuid,bigint)',
  ]) {
    const v=await row("select has_function_privilege('anon',$1,'EXECUTE') as anon,has_function_privilege('authenticated',$1,'EXECUTE') as authenticated,has_function_privilege('service_role',$1,'EXECUTE') as service",['public.'+name]);
    assert.deepEqual(v,{anon:false,authenticated:false,service:true},name);checks++;
  }
  const v=await row("select has_schema_privilege('service_role','account_deletion_internal','USAGE') as service,has_schema_privilege('authenticated','account_deletion_internal','USAGE') as client");
  assert.deepEqual(v,{service:false,client:false});checks++;
  assert.equal((await row("select relrowsecurity as rls from pg_class where oid='account_deletion_internal.attempts'::regclass")).rls,true);checks++;
  const claimA=await row("select * from public.claim_due_account_deletion($1,$2,$3)",[a,requestA,workerA]);
  assert.equal(Number(claimA.claim_generation),1);assert.equal(claimA.claimed_auth_user_id,a);checks++;
  await reject(()=>row("select * from public.claim_due_account_deletion($1,$2,$3)",[a,requestA,workerB]),/already held or dispatched/,'second worker');
  await reject(()=>row("select public.begin_claimed_auth_removal($1,$2,$3,$4)",[a,requestA,workerB,1]),/fence rejected/,'forged token');
  assert.equal((await row("select auth_user_id from public.profiles where account_id=$1",[a])).auth_user_id,a);checks++;
  assert.equal((await row("select public.begin_claimed_auth_removal($1,$2,$3,$4) as auth_id",[a,requestA,claimA.claim_token,1])).auth_id,a);checks++;
  assert.equal((await row("select auth_user_id from public.profiles where account_id=$1",[a])).auth_user_id,null);checks++;
  await reject(()=>row("select public.begin_claimed_auth_removal($1,$2,$3,$4)",[a,requestA,claimA.claim_token,1]),/fence rejected/,'duplicate Auth handoff');
  await reject(()=>row("update public.profiles set status='active' where account_id=$1",[a]),/claimed deletion forbids profile mutation/,'late cancellation');
  await reject(()=>row("select public.confirm_claimed_auth_soft_delete($1,$2,$3,$4,$5)",[a,requestA,claimA.claim_token,1,404]),/confirmation fence rejected/,'404 cannot confirm');
  await row("select public.mark_claimed_auth_ambiguous($1,$2,$3,$4,$5)",[a,requestA,claimA.claim_token,1,'auth_404']);checks++;
  await reject(()=>row("select * from public.claim_due_account_deletion($1,$2,$3)",[a,requestA,workerB]),/not claimable|already held or dispatched/,'no auto retry after ambiguous Auth');

  const requestB=await insertPending(b);
  const claimB=await row("select * from public.claim_due_account_deletion($1,$2,$3)",[b,requestB,workerA]);
  await row("select public.begin_claimed_auth_removal($1,$2,$3,$4)",[b,requestB,claimB.claim_token,claimB.claim_generation]);
  await reject(()=>row("select * from public.finalize_claimed_account_deletion($1,$2,$3,$4)",[b,requestB,claimB.claim_token,claimB.claim_generation]),/finalize fence rejected/,'no pre-Auth finalization');
  assert.equal((await row("select public.confirm_claimed_auth_soft_delete($1,$2,$3,$4,$5) as ok",[b,requestB,claimB.claim_token,claimB.claim_generation,200])).ok,true);checks++;
  assert.equal((await row("select * from public.finalize_claimed_account_deletion($1,$2,$3,$4)",[b,requestB,claimB.claim_token,claimB.claim_generation])).account_id,b);checks++;
  assert.equal((await row("select status from public.profiles where account_id=$1",[b])).status,'deleted');checks++;
  assert.equal((await row("select state from account_deletion_internal.attempts where account_id=$1",[b])).state,'finalized');checks++;
  await reject(()=>row("select * from public.finalize_claimed_account_deletion($1,$2,$3,$4)",[b,requestB,claimB.claim_token,claimB.claim_generation]),/finalize fence rejected/,'no duplicate finalization');

  const requestC=await insertPending(c);
  const claimC=await row("select * from public.claim_due_account_deletion($1,$2,$3)",[c,requestC,workerA]);
  await db.query("update account_deletion_internal.attempts set claimed_at=clock_timestamp()-interval '10 minutes',pre_dispatch_expires_at=clock_timestamp()-interval '1 second' where account_id=$1",[c]);
  const claimC2=await row("select * from public.claim_due_account_deletion($1,$2,$3)",[c,requestC,workerB]);
  assert.equal(Number(claimC2.claim_generation),Number(claimC.claim_generation)+1);assert.notEqual(claimC2.claim_token,claimC.claim_token);checks++;
  await reject(()=>row("select public.begin_claimed_auth_removal($1,$2,$3,$4)",[c,requestC,claimC.claim_token,claimC.claim_generation]),/fence rejected/,'expired generation loses');
  assert.equal((await row("select auth_user_id from public.profiles where account_id=$1",[c])).auth_user_id,c);checks++;
  await row("select public.begin_claimed_auth_removal($1,$2,$3,$4)",[c,requestC,claimC2.claim_token,claimC2.claim_generation]);checks++;

  const requestD=await insertPending(d);
  await db.query("update public.profiles set status='active',deletion_request_id=null,deletion_requested_at=null,deletion_due_at=null where account_id=$1",[d]);
  await row("select set_config('usdimpact.test_uid',$1,false)",[d]);
  const renewed=await row("select (public.request_account_deletion()).deletion_request_id as request_id");
  assert.notEqual(requestD,renewed.request_id);checks++;
  await reject(()=>row("select * from public.claim_due_account_deletion($1,$2,$3)",[d,requestD,workerA]),/not claimable/,'ABA stale request');
  const requestE=await insertPending(e);
  const attempts=await Promise.allSettled(Array.from({length:100},(_,i)=>row("select * from public.claim_due_account_deletion($1,$2,$3)",[e,requestE,i%2?workerA:workerB])));
  assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(attempts.filter(x=>x.status==='rejected').length,99);checks++;
  await reject(()=>row("select public.prepare_account_deletion_auth_removal($1)",[e]),/legacy unfenced account deletion preparation is disabled/,'legacy prepare blocked');
  await reject(()=>row("select * from public.finalize_account_deletion($1)",[e]),/legacy unfenced account deletion finalization is disabled/,'legacy finalize blocked');
  console.log('Account deletion SQL candidate: '+checks+' PGlite offline checks PASS; no real database/network/Auth request.');
} finally {
  await db.close();
}
