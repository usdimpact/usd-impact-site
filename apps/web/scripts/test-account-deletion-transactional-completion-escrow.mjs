// Issue #950: test actual claim SQL + completion escrow SQL in PGlite.
// Isolated in-memory synthetic PostgreSQL. No real Supabase, Auth or Resend.
// No external network, credentials, user records or email sends.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const source=name=>readFileSync(
  new URL('../../../docs/operations/candidates/'+name,import.meta.url),'utf8');
const claims=source('account-deletion-atomic-claim.review.sql');
const escrow=source('account-deletion-transactional-completion-escrow.review.sql');
assert.match(escrow,/REVIEW ONLY transactional/);
assert.match(escrow,/insert into account_deletion_internal\.completion_intents/);
assert.doesNotMatch(escrow,/delete\s+from\s+auth\.users/i);

const db=new PGlite();
const first='11111111-2222-4333-8444-555555555555';
const second='22222222-3333-4444-8555-666666666666';
const worker=randomUUID();
const requested='2026-10-01T00:00:00Z';
const due='2026-10-08T00:00:00Z';
let checks=0;
const read=async(q,params=[]) => (await db.query(q,params)).rows;
const row=async(q,params=[]) => (await read(q,params))[0];
async function denied(fn,pattern,label){
  await assert.rejects(fn,pattern,label);
  checks++;
}
const setup=[
  "create role anon nologin;",
  "create role authenticated nologin;",
  "create role service_role nologin;",
  "create schema auth;",
  "create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;",
  "create type public.account_status as enum ('active','suspended','deletion_pending','deleted');",
  "create type public.request_status as enum ('open','in_progress','completed');",
  "create table public.profiles(account_id uuid primary key,email text not null,display_name text,status public.account_status default 'active',auth_user_id uuid,deletion_requested_at timestamptz,deletion_due_at timestamptz,deleted_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());",
  "create table public.privacy_requests(account_id uuid,email text,request_type text,status public.request_status,requested_at timestamptz,due_at timestamptz);",
  "create table public.notification_outbox(id uuid primary key default gen_random_uuid(),message_id text,business_object_type text,business_object_id text,state_version integer,recipient_email_normalized text,template_id text,classification text,consent_required boolean default false,payload jsonb default '{}'::jsonb);",
  "create function public.request_account_deletion() returns public.profiles language plpgsql security definer set search_path='' as $$ begin raise exception 'unmigrated request'; end $$;",
  "revoke all on function public.request_account_deletion() from public,anon,service_role;",
  "grant execute on function public.request_account_deletion() to authenticated;",
  "create function public.prepare_account_deletion_auth_removal(prepare_account_id uuid) returns boolean language plpgsql security definer set search_path='' as $$ begin return true; end $$;",
  "revoke all on function public.prepare_account_deletion_auth_removal(uuid) from public,anon,authenticated;",
  "grant execute on function public.prepare_account_deletion_auth_removal(uuid) to service_role;",
  "create function public.finalize_account_deletion(finalize_account_id uuid) returns table(account_id uuid,recipient_email text,deletion_requested_at timestamptz,deleted_at timestamptz) language plpgsql security definer set search_path='' as $core$ declare p public.profiles; ts timestamptz:=clock_timestamp(); begin select x.* into p from public.profiles x where x.account_id=finalize_account_id for update; if p.account_id is null or p.status<>'deletion_pending' or p.auth_user_id is not null then raise exception 'unqualified finalization'; end if; update public.profiles x set status='deleted',deleted_at=ts,updated_at=ts,email='deleted+fixture@accounts.invalid' where x.account_id=p.account_id; return query select p.account_id,p.email,p.deletion_requested_at,ts; end $core$;",
  "revoke all on function public.finalize_account_deletion(uuid) from public,anon,authenticated;",
  "grant execute on function public.finalize_account_deletion(uuid) to service_role;",
].join('\n');
async function seed(account,email){
  await db.query("insert into public.profiles(account_id,email,status,auth_user_id,deletion_request_id,deletion_requested_at,deletion_due_at) values($1,$2,'deletion_pending',$1,gen_random_uuid(),$3,$4)",[account,email,requested,due]);
  return (await row("select deletion_request_id from public.profiles where account_id=$1",[account])).deletion_request_id;
}
async function authorize(account,requestId){
  const claimed=await row("select * from public.claim_due_account_deletion($1,$2,$3)",[account,requestId,worker]);
  assert.ok(claimed.claim_token);
  assert.equal(claimed.claimed_auth_user_id,account);
  await row("select public.begin_claimed_auth_removal($1,$2,$3,$4)",[
    account,requestId,claimed.claim_token,claimed.claim_generation,
  ]);
  const confirmed=await row("select public.confirm_claimed_auth_soft_delete($1,$2,$3,$4,200) as ok",[
    account,requestId,claimed.claim_token,claimed.claim_generation,
  ]);
  assert.equal(confirmed.ok,true);
  checks+=3;
  return claimed;
}
async function finalize(account,requestId,claim){
  return row("select * from public.finalize_claimed_account_deletion($1,$2,$3,$4)",[
    account,requestId,claim.claim_token,claim.claim_generation,
  ]);
}
async function inventory(){
  return read("select * from public.list_account_deletion_completion_recoveries(5)");
}
try {
  await db.exec(setup);
  await db.exec(claims);
  await db.exec(escrow);
  for (const name of [
    'list_account_deletion_completion_recoveries(integer)',
    'confirm_account_deletion_completion_outbox(uuid,uuid,uuid)',
  ]){
    const permissions=await row("select has_function_privilege('anon',$1,'EXECUTE') as anon,has_function_privilege('authenticated',$1,'EXECUTE') as signed_in,has_function_privilege('service_role',$1,'EXECUTE') as service",['public.'+name]);
    assert.deepEqual(permissions,{anon:false,signed_in:false,service:true});
    checks++;
  }
  const own=await row("select has_schema_privilege('authenticated','account_deletion_internal','USAGE') as client,has_schema_privilege('service_role','account_deletion_internal','USAGE') as service");
  assert.deepEqual(own,{client:false,service:false});
  checks++;
  assert.equal((await row("select relrowsecurity as enabled from pg_class where oid='account_deletion_internal.completion_intents'::regclass")).enabled,true);
  checks++;

  const requestA=await seed(first,'Reader.One@Example.invalid');
  const claimA=await authorize(first,requestA);
  const finalizedA=await finalize(first,requestA,claimA);
  assert.equal(finalizedA.account_id,first);
  assert.equal(finalizedA.recipient_email,'Reader.One@Example.invalid');
  const persisted=await row("select state,recipient_email_normalized,outbox_id from account_deletion_internal.completion_intents where account_id=$1",[first]);
  assert.deepEqual(persisted,{state:'pending',recipient_email_normalized:'reader.one@example.invalid',outbox_id:null});
  assert.equal((await row("select status from public.profiles where account_id=$1",[first])).status,'deleted');
  assert.equal((await row("select state from account_deletion_internal.attempts where account_id=$1",[first])).state,'finalized');
  checks+=4;
  const lostProcess=await inventory();
  assert.equal(lostProcess.length,1,'after app crash, durable recipient remains recoverable');
  assert.equal(lostProcess[0].account_id,first);
  assert.equal(lostProcess[0].recipient_email_normalized,'reader.one@example.invalid');
  checks+=3;
  await denied(()=>row("select * from public.list_account_deletion_completion_recoveries(0)"),/between 1 and 5/,'unbounded inventory');
  await denied(()=>row("select * from public.list_account_deletion_completion_recoveries(6)"),/between 1 and 5/,'too-large inventory');

  const randomId=randomUUID();
  await denied(()=>row("select public.confirm_account_deletion_completion_outbox($1,$2,$3)",[
    first,requestA,randomId,
  ]),/outbox record identity is unverified/,'cannot scrub email before durable outbox');
  assert.equal((await inventory()).length,1);
  checks++;

  const wrongId=randomUUID();
  const deletedAt=finalizedA.deleted_at;
  const stateVersion=Math.floor(Date.parse(deletedAt)/60000);
  await db.query("insert into public.notification_outbox(id,message_id,business_object_type,business_object_id,state_version,recipient_email_normalized,template_id,classification,consent_required,payload) values($1,'account_deletion_completed','account_deletion_request',$2,$3,'other@example.invalid','account_deletion_completed','transactional_operational',false,'{}'::jsonb)",[wrongId,first,stateVersion]);
  await denied(()=>row("select public.confirm_account_deletion_completion_outbox($1,$2,$3)",[
    first,requestA,wrongId,
  ]),/outbox record identity is unverified/,'wrong recipient cannot consume escrow');
  assert.equal((await inventory()).length,1);
  checks++;

  const rightId=randomUUID();
  await db.query("insert into public.notification_outbox(id,message_id,business_object_type,business_object_id,state_version,recipient_email_normalized,template_id,classification,consent_required,payload) values($1,'account_deletion_completed','account_deletion_request',$2,$3,'reader.one@example.invalid','account_deletion_completed','transactional_operational',false,'{}'::jsonb)",[rightId,first,stateVersion]);
  const ack=await row("select public.confirm_account_deletion_completion_outbox($1,$2,$3) as ok",[first,requestA,rightId]);
  assert.equal(ack.ok,true);
  assert.equal((await inventory()).length,0);
  const scrubbed=await row("select state,recipient_email_normalized,outbox_id,recorded_at is not null as recorded from account_deletion_internal.completion_intents where account_id=$1",[first]);
  assert.deepEqual(scrubbed,{state:'outbox_recorded',recipient_email_normalized:null,outbox_id:rightId,recorded:true});
  checks+=3;
  assert.equal((await row("select public.confirm_account_deletion_completion_outbox($1,$2,$3) as ok",[first,requestA,rightId])).ok,true);
  checks++;
  await denied(()=>row("select public.confirm_account_deletion_completion_outbox($1,$2,$3)",[first,requestA,wrongId]),/different identity/,'different outbox ID cannot replace recorded one');
  await denied(()=>finalize(first,requestA,claimA),/finalize fence rejected/,'no repeat finalization');

  // Force a transaction-local AFTER-ERASURE error: the old core's profile
  // scrub MUST rollback when the escrow INSERT cannot complete.
  const requestB=await seed(second,'Second.Reader@Example.invalid');
  const claimB=await authorize(second,requestB);
  await db.exec("create function account_deletion_internal.reject_test_escrow() returns trigger language plpgsql as $$ begin raise exception 'synthetic escrow unavailable'; end $$;");
  await db.exec("create trigger reject_escrow_before_insert before insert on account_deletion_internal.completion_intents for each row execute function account_deletion_internal.reject_test_escrow();");
  await denied(()=>finalize(second,requestB,claimB),/synthetic escrow unavailable/,'erasure must rollback if durable recovery record unavailable');
  const preRetry=await row("select status,auth_user_id,email from public.profiles where account_id=$1",[second]);
  assert.deepEqual(preRetry,{status:'deletion_pending',auth_user_id:null,email:'Second.Reader@Example.invalid'});
  assert.equal((await row("select state from account_deletion_internal.attempts where account_id=$1",[second])).state,'auth_confirmed');
  assert.equal((await row("select count(*)::integer as n from account_deletion_internal.completion_intents where account_id=$1",[second])).n,0);
  checks+=3;
  await db.exec("drop trigger reject_escrow_before_insert on account_deletion_internal.completion_intents;");
  const finalizedB=await finalize(second,requestB,claimB);
  assert.equal(finalizedB.account_id,second);
  assert.equal((await inventory()).length,1);
  checks+=2;

  console.log('Issue #950 transactional completion escrow: '+checks+
    ' in-memory PostgreSQL checks PASS; atomic scrub/escrow rollback, access controls, recovery and idempotent acknowledgment.');
} finally {
  await db.close();
}
