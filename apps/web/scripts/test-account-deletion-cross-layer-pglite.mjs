// Issue #950: Cross-layer PostgreSQL-WASM + dormant finalizer contract.
// This test runs two proposed SQL review files in a disposable in-memory
// PGlite database. All HTTP is mocked; NO real network, Auth, user, email,
// Supabase project, schema migration, or Production flag is touched.
// PGlite serializes DB access: this is NOT live multi-connection proof.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { runOfflineFencedDeletion } from '../src/lib/account-deletion-fenced-protocol-candidate.js';

const claimSQL=readFileSync(
  new URL('../../../docs/operations/candidates/account-deletion-atomic-claim.review.sql',import.meta.url),'utf8');
const rlsSQL=readFileSync(
  new URL('../../../docs/operations/candidates/account-deletion-jwt-rls-fence.review.sql',import.meta.url),'utf8');
assert.match(claimSQL,/REVIEW-ONLY SQL CANDIDATE/);
assert.match(rlsSQL,/REVIEW ONLY JWT\/RLS/);
const origin='https://ycstrcvshdluovtuasjc.supabase.co';
const config={mode:'offline_fixture',production:false,supabase:{
  url:origin,secretKey:'sb_secret_'+('x'.repeat(32)),
}};
const accounts=[
  '11111111-2222-4333-8444-555555555555',
  '22222222-3333-4444-8555-666666666666',
  '33333333-4444-4555-8666-777777777777',
  '44444444-5555-4666-8777-888888888888',
  '55555555-6666-4777-8888-999999999999',
  '66666666-7777-4888-8999-aaaaaaaaaaaa',
];
const requested=new Date(Date.now()-9*86400_000).toISOString();
const due=new Date(Date.now()-2*86400_000).toISOString();
const db=new PGlite();
let checks=0, authAttempts=0, outboxWrites=0;
const outbox=new Map();
const single=async(sql,params=[]) => (await db.query(sql,params)).rows[0];
const query=async(sql,params=[]) => (await db.query(sql,params)).rows;
const json=(status,data)=>{
  const body=data===undefined?null:JSON.stringify(data,(_key,value)=>{
    if(typeof value==='bigint') return Number(value);
    return value;
  });
  return new Response(body,{status,headers:{'Content-Type':'application/json'}});
};

const tables=[
  'bookmarks','entitlements','entitlement_events','learning_progress',
  'privacy_requests','purchase_intents','purchases','subscription_events',
  'subscriptions','support_requests',
];
const fixture=[
  'create role anon nologin;',
  'create role authenticated nologin;',
  'create role service_role nologin;',
  'create schema auth;',
  'grant usage on schema auth to authenticated;',
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(pg_catalog.current_setting('usdimpact.rls_uid',true),'')::uuid $$;",
  "create type public.account_status as enum ('active','suspended','deletion_pending','deleted');",
  "create type public.request_status as enum ('open','in_progress','completed');",
  'create table public.profiles (account_id uuid primary key,email text not null,display_name text,status public.account_status not null default \'active\',deletion_requested_at timestamptz,deletion_due_at timestamptz,deleted_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),auth_user_id uuid);',
  'create table public.privacy_requests (account_id uuid primary key,email text,request_type text,status public.request_status,requested_at timestamptz,due_at timestamptz);',
  "create function public.request_account_deletion() returns public.profiles language plpgsql security definer set search_path='' as $$ begin raise exception 'unmigrated request'; end $$;",
  'revoke all on function public.request_account_deletion() from public,anon,service_role;',
  'grant execute on function public.request_account_deletion() to authenticated;',
  "create function public.prepare_account_deletion_auth_removal(prepare_account_id uuid) returns boolean language plpgsql security definer set search_path='' as $$ begin return true; end $$;",
  'revoke all on function public.prepare_account_deletion_auth_removal(uuid) from public,anon,authenticated;',
  'grant execute on function public.prepare_account_deletion_auth_removal(uuid) to service_role;',
  "create function public.finalize_account_deletion(finalize_account_id uuid) returns table (account_id uuid,recipient_email text,deletion_requested_at timestamptz,deleted_at timestamptz) language plpgsql security definer set search_path='' as $core$ declare p public.profiles; ts timestamptz:=pg_catalog.clock_timestamp(); begin select x.* into p from public.profiles x where x.account_id=finalize_account_id for update; if p.account_id is null or p.status<>'deletion_pending' or p.auth_user_id is not null then raise exception 'unqualified finalization'; end if; update public.profiles x set status='deleted',deleted_at=ts,updated_at=ts,email='deleted+fixture@accounts.invalid' where x.account_id=p.account_id; return query select p.account_id,p.email,p.deletion_requested_at,ts; end $core$;",
  'revoke all on function public.finalize_account_deletion(uuid) from public,anon,authenticated;',
  'grant execute on function public.finalize_account_deletion(uuid) to service_role;',
  'alter table public.profiles enable row level security;',
  'grant select on public.profiles to authenticated;',
  "create policy profiles_select_own on public.profiles for select to authenticated using(account_id=(select auth.uid()));",
  ...tables.filter(t=>t!=='privacy_requests').map(t=>
    'create table public.'+t+' (account_id uuid primary key,label text);'),
  ...tables.map(t=>'alter table public.'+t+' enable row level security;'),
  ...tables.map(t=>'grant select on public.'+t+' to authenticated;'),
  'grant update,delete on public.bookmarks to authenticated;',
  'grant update on public.learning_progress to authenticated;',
  ...tables.map(t=>{
    const legacy=['entitlements','entitlement_events','purchase_intents','purchases'].includes(t)
      ? "account_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.account_id=(select auth.uid()) and p.status <> 'deleted'::public.account_status)"
      : 'account_id=(select auth.uid())';
    return 'create policy '+t+'_select_own on public.'+t+
      ' for select to authenticated using('+legacy+');';
  }),
  "create policy bookmarks_delete_own on public.bookmarks for delete to authenticated using(account_id=(select auth.uid()));",
  "create policy bookmarks_update_own on public.bookmarks for update to authenticated using(account_id=(select auth.uid())) with check(account_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.account_id=(select auth.uid()) and p.status='active'::public.account_status));",
  "create policy learning_progress_update_own on public.learning_progress for update to authenticated using(account_id=(select auth.uid())) with check(account_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.account_id=(select auth.uid()) and p.status='active'::public.account_status));",
].join('\n');

const apiCalls=[];
async function apiRpc(url,options={}){
  const u=new URL(url);
  assert.equal(u.origin,origin);
  assert.equal(options.method,'POST');
  assert.equal(options.headers?.apikey,config.supabase.secretKey);
  assert.equal(Object.hasOwn(options.headers,'Authorization'),false);
  assert.equal(options.headers?.['Content-Type'],'application/json');
  const path=u.pathname;
  assert.ok(path.startsWith('/rest/v1/rpc/'));
  const name=path.slice('/rest/v1/rpc/'.length);
  const arg=JSON.parse(options.body);
  apiCalls.push({name,account:String(Object.values(arg)[0]??'')});
  try{
    switch(name){
      case 'claim_due_account_deletion':
        return json(200,await query(
          'select * from public.claim_due_account_deletion($1::uuid,$2::uuid,$3::uuid)',
          [arg.claim_account_id,arg.claim_request_id,arg.claim_worker_nonce],
        ));
      case 'begin_claimed_auth_removal':{
        const value=await single(
          'select public.begin_claimed_auth_removal($1::uuid,$2::uuid,$3::uuid,$4::bigint) as identity',
          [arg.begin_account_id,arg.begin_request_id,arg.begin_token,arg.begin_generation],
        );
        return json(200,value.identity);
      }
      case 'mark_claimed_auth_ambiguous':{
        const value=await single(
          'select public.mark_claimed_auth_ambiguous($1::uuid,$2::uuid,$3::uuid,$4::bigint,$5::text) as ok',
          [arg.ambiguous_account_id,arg.ambiguous_request_id,arg.ambiguous_token,
            arg.ambiguous_generation,arg.ambiguous_error_code],
        );
        return json(200,value.ok);
      }
      case 'confirm_claimed_auth_soft_delete':{
        const value=await single(
          'select public.confirm_claimed_auth_soft_delete($1::uuid,$2::uuid,$3::uuid,$4::bigint,$5::integer) as ok',
          [arg.confirm_account_id,arg.confirm_request_id,arg.confirm_token,
            arg.confirm_generation,arg.confirm_http_status],
        );
        return json(200,value.ok);
      }
      case 'finalize_claimed_account_deletion':
        return json(200,await query(
          'select * from public.finalize_claimed_account_deletion($1::uuid,$2::uuid,$3::uuid,$4::bigint)',
          [arg.finalize_account_id,arg.finalize_request_id,arg.finalize_token,arg.finalize_generation],
        ));
      default:assert.fail('Unexpected real-data or provider request: '+name);
    }
  }catch(error){
    // Local adapter models an HTTP RPC conflict; the caller must fail closed.
    return json(409,{code:'FENCE_CONFLICT',message:'synthetic RPC rejected'});
  }
}
async function candidate(accountId){
  const profile=await single(
    'select account_id,deletion_request_id,status,deletion_requested_at,deletion_due_at from public.profiles where account_id=$1',[accountId],
  );
  return {
    ...profile,
    deletion_requested_at:new Date(profile.deletion_requested_at).toISOString(),
    deletion_due_at:new Date(profile.deletion_due_at).toISOString(),
  };
}
async function stateOf(accountId){
  return single('select p.status,p.auth_user_id,a.state as claim_state from public.profiles p left join account_deletion_internal.attempts a on a.account_id=p.account_id where p.account_id=$1',[accountId]);
}
async function runOne(account,provider,{fetchImpl=apiRpc,completion}={}){
  return runOfflineFencedDeletion({
    config,candidate:await candidate(account),workerNonce:randomUUID(),
    fetchImpl,authSoftDelete:provider,
    recordCompletion:completion??(async row=>{
      if(outbox.has(row.account_id)) assert.fail('Duplicate completion intent');
      outboxWrites++;outbox.set(row.account_id,row);
      return {durable:true,reference:'synthetic-outbox'};
    }),
  });
}
async function assertRejected(fn,code){
  await assert.rejects(fn,error=>error?.code===code,code);checks++;
}
async function setUser(uid){await single('select set_config($1,$2,false)', ['usdimpact.rls_uid',uid]);}
async function readAsUser(table){
  await db.exec('set role authenticated');
  try{return await query('select account_id from public.'+table+' order by account_id');}
  finally{await db.exec('reset role');}
}

try {
  await db.exec(fixture);
  await db.exec(claimSQL);
  await db.exec(rlsSQL);
  for(const account of accounts){
    await db.query("insert into public.profiles(account_id,email,status,auth_user_id,deletion_request_id,deletion_requested_at,deletion_due_at) values($1,'fixture@example.invalid','deletion_pending',$1,pg_catalog.gen_random_uuid(),$2,$3)",[account,requested,due]);
    await db.query("insert into public.bookmarks(account_id,label) values($1,'private')",[account]);
    await db.query("insert into public.learning_progress(account_id,label) values($1,'private')",[account]);
  }
  checks++;

  // A. A linked, due profile can still read its own records before claiming.
  await setUser(accounts[0]);
  assert.deepEqual((await readAsUser('profiles')).map(r=>r.account_id),[accounts[0]]);
  assert.deepEqual((await readAsUser('bookmarks')).map(r=>r.account_id),[accounts[0]]);
  checks+=2;

  // A. The actual SQL begin() must detach and fence before the ONLY fake Auth.
  const success=await runOne(accounts[0],async ({accountId,authUserId,shouldSoftDelete})=>{
    authAttempts++;
    assert.equal(accountId,accounts[0]);
    assert.equal(authUserId,accounts[0]);
    assert.equal(shouldSoftDelete,true);
    const row=await stateOf(accounts[0]);
    assert.equal(row.status,'deletion_pending');
    assert.equal(row.auth_user_id,null);
    assert.equal(row.claim_state,'auth_dispatched');
    await setUser(accounts[0]); // JWT identity is still valid in fixture.
    assert.deepEqual(await readAsUser('profiles'),[]);
    assert.deepEqual(await readAsUser('bookmarks'),[]);
    assert.deepEqual(await readAsUser('learning_progress'),[]);
    checks+=3;
    return {status:200};
  });
  assert.equal(success.status,'finalized');
  assert.equal((await stateOf(accounts[0])).claim_state,'finalized');
  assert.equal(outbox.has(accounts[0]),true);
  assert.equal(authAttempts,1);checks+=4;

  // B. 100 concurrent mock API clients contend for real PG claim SQL, and
  // at most ONE may enter simulated Auth (PGlite is serial, not distributed).
  let providerB=0;
  const callers=await Promise.allSettled(
    Array.from({length:100},()=>runOne(accounts[1],async()=>{
      providerB++;authAttempts++;
      return {status:200};
    })),
  );
  assert.equal(callers.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(callers.filter(r=>r.status==='rejected').length,99);
  assert.equal(providerB,1);
  assert.equal((await stateOf(accounts[1])).claim_state,'finalized');
  assert.equal(outbox.has(accounts[1]),true);checks+=5;

  // C. Commit the SQL dispatch and then lose the RPC response. The client
  // must NOT issue an Auth DELETE or try a second begin, even after a retry.
  let cAuth=0;
  const dropBegin=async (url,options)=>{
    const result=await apiRpc(url,options);
    if(new URL(url).pathname.endsWith('/begin_claimed_auth_removal')){
      assert.equal(result.status,200);
      return json(204);
    }
    return result;
  };
  await assertRejected(
    ()=>runOne(accounts[2],async()=>{cAuth++;return {status:200};},{fetchImpl:dropBegin}),
    'BEGIN_DISPATCH_UNCERTAIN',
  );
  assert.equal(cAuth,0);
  assert.equal(outbox.has(accounts[2]),false);
  assert.deepEqual(
    await stateOf(accounts[2]),
    {status:'deletion_pending',auth_user_id:null,claim_state:'auth_dispatched'},
  );
  await assertRejected(
    ()=>runOne(accounts[2],async()=>{cAuth++;return {status:200};}),
    'CLAIM_NOT_GRANTED',
  );
  assert.equal(cAuth,0);checks+=4;

  // D. A fake Auth 404 is NOT a verified soft-delete; SQL records ambiguous
  // and refuses both finalization and any second attempt.
  let dAuth=0;
  await assertRejected(()=>runOne(accounts[3],async()=>{
    dAuth++;authAttempts++;return {status:404};
  }),'AUTH_OUTCOME_UNVERIFIED');
  assert.equal(dAuth,1);
  assert.equal((await stateOf(accounts[3])).claim_state,'auth_ambiguous');
  assert.equal(outbox.has(accounts[3]),false);checks+=3;
  await assertRejected(()=>runOne(accounts[3],async()=>{
    dAuth++;return {status:200};
  }),'CLAIM_NOT_GRANTED');
  assert.equal(dAuth,1);checks++;

  // E. A cancellation BEFORE claim invalidates the old due snapshot at the
  // SQL boundary. No Auth/notification may follow.
  const obsoleteE=await candidate(accounts[4]);
  await db.query("update public.profiles set status='active',deletion_requested_at=null,deletion_due_at=null,deletion_request_id=null where account_id=$1",[accounts[4]]);
  let eAuth=0;
  await assertRejected(()=>runOfflineFencedDeletion({
    config,candidate:obsoleteE,workerNonce:randomUUID(),fetchImpl:apiRpc,
    authSoftDelete:async()=>{eAuth++;return {status:200};},
    recordCompletion:async()=>{assert.fail('Cancelled account must not send completion');},
  }),'CLAIM_NOT_GRANTED');
  assert.equal(eAuth,0);checks++;

  // F. A cancellation AFTER successful claim is blocked even before Auth.
  const snapshotF=await candidate(accounts[5]);
  const claimF=await single(
    'select * from public.claim_due_account_deletion($1::uuid,$2::uuid,$3::uuid)',
    [accounts[5],snapshotF.deletion_request_id,randomUUID()],
  );
  assert.ok(claimF?.claim_token);
  await assert.rejects(
    ()=>db.query("update public.profiles set status='active' where account_id=$1",[accounts[5]]),
    /claimed deletion forbids profile mutation/,
  );
  const stateF=await stateOf(accounts[5]);
  assert.equal(stateF.status,'deletion_pending');
  assert.equal(stateF.auth_user_id,accounts[5]);
  assert.equal(stateF.claim_state,'claimed');
  checks+=4;

  // No code path may emit a non-injected network request or real email.
  assert.equal(authAttempts,3); // A=200, B=200, D=404. C/E/F=zero.
  assert.equal(outboxWrites,2);
  assert.equal(apiCalls.some(x=>x.name==='prepare_account_deletion_auth_removal'),false);
  assert.equal(apiCalls.some(x=>x.name==='finalize_account_deletion'),false);
  checks+=4;
  console.log('Issue #950 cross-layer SQL/RLS/adapter: '+checks+
    ' assertions PASS; '+apiCalls.length+' isolated RPC calls, 0 real network/Auth/database/email operations.');
} finally {
  await db.close();
}
