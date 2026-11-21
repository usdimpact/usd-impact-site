// Issue #950 read-only review: in-memory PostgreSQL RLS behavior with
// a simulated still-valid auth.uid() after the profile's Auth link is detached.
// NOT real JWT revocation, network, Supabase Storage or live DB acceptance.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sql=readFileSync(
  new URL('../../../docs/operations/candidates/account-deletion-jwt-rls-fence.review.sql',import.meta.url),'utf8',
);
assert.match(sql,/REVIEW ONLY JWT\/RLS/);
const tables=[
  'bookmarks','entitlements','entitlement_events','learning_progress',
  'privacy_requests','purchase_intents','purchases',
  'subscription_events','subscriptions','support_requests',
];
const me='11111111-2222-4333-8444-555555555555';
const other='22222222-3333-4444-8555-666666666666';
const db=new PGlite();
let checks=0;
const rows=async(text,params=[]) => (await db.query(text,params)).rows;
const row=async(text,params=[]) => (await rows(text,params))[0];
const baseline=[
  "create role anon nologin;",
  "create role authenticated nologin;",
  "create role service_role nologin;",
  "create schema auth;",
  "grant usage on schema auth to authenticated;",
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(pg_catalog.current_setting('usdimpact.rls_uid',true),'')::uuid $$;",
  "create type public.account_status as enum ('active','suspended','deletion_pending','deleted');",
  "create table public.profiles (account_id uuid primary key,auth_user_id uuid,status public.account_status not null);",
  "alter table public.profiles enable row level security;",
  "grant select on public.profiles to authenticated;",
  "create policy profiles_select_own on public.profiles for select to authenticated using(account_id=(select auth.uid()));",
  ...tables.map(t=>"create table public."+t+" (account_id uuid primary key, label text);"),
  ...tables.map(t=>"alter table public."+t+" enable row level security;"),
  ...tables.map(t=>"grant select on public."+t+" to authenticated;"),
  "grant update,delete on public.bookmarks to authenticated;",
  "grant update on public.learning_progress to authenticated;",
  ...tables.map(t=>{
    const legacy=["entitlements","entitlement_events","purchase_intents","purchases"].includes(t)
      ? "account_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.account_id=(select auth.uid()) and p.status <> 'deleted'::public.account_status)"
      : "account_id=(select auth.uid())";
    return "create policy "+t+"_select_own on public."+t+
      " for select to authenticated using("+legacy+");";
  }),
  "create policy bookmarks_delete_own on public.bookmarks for delete to authenticated using(account_id=(select auth.uid()));",
  "create policy bookmarks_update_own on public.bookmarks for update to authenticated using(account_id=(select auth.uid())) with check(account_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.account_id=(select auth.uid()) and p.status='active'::public.account_status));",
  "create policy learning_progress_update_own on public.learning_progress for update to authenticated using(account_id=(select auth.uid())) with check(account_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.account_id=(select auth.uid()) and p.status='active'::public.account_status));",
].join('\n');
async function setUser(uid){
  await row("select set_config('usdimpact.rls_uid',$1,false)",[uid]);
}
async function readAsAuthenticated(table){
  await db.exec("set role authenticated");
  try {return await rows("select account_id from public."+table+" order by account_id");}
  finally {await db.exec("reset role");}
}
try{
  await db.exec(baseline);
  await db.query("insert into public.profiles(account_id,auth_user_id,status) values($1,$1,'active'),($2,$2,'active')",[me,other]);
  for(const t of tables){
    await db.query("insert into public."+t+"(account_id,label) values($1,'fixture-me'),($2,'fixture-other')",[me,other]);
  }
  await db.exec(sql);
  const audited=await rows("select tablename,policyname,qual from pg_policies where schemaname='public' order by tablename,policyname");
  assert.equal(audited.length,14);
  for(const p of audited)assert.match(p.qual,/auth_user_id/,p.policyname);
  checks+=14;
  await setUser(me);
  // Current active user still reads their own records, never the other account.
  for(const t of ['profiles',...tables]){
    const values=await readAsAuthenticated(t);
    assert.deepEqual(values.map(r=>r.account_id),[me],t+' active read');
    checks++;
  }
  // Existing 7-day pending user still has a canonical Auth link (no dispatch).
  await db.query("update public.profiles set status='deletion_pending' where account_id=$1",[me]);
  for(const t of ['profiles',...tables]){
    const values=await readAsAuthenticated(t);
    assert.deepEqual(values.map(r=>r.account_id),[me],t+' pre-claim read');
    checks++;
  }
  // Simulate a committed begin(): status remains pending, FK becomes NULL.
  // JWT/uid is deliberately unchanged; all direct SELECT policies must deny.
  await db.query("update public.profiles set auth_user_id=null where account_id=$1",[me]);
  for(const t of ['profiles',...tables]){
    const values=await readAsAuthenticated(t);
    assert.deepEqual(values,[],t+' stale JWT must be denied after FK detach');
    checks++;
  }
  // A still-active user's old JWT cannot access someone else's data.
  await setUser(other);
  for(const t of ['profiles',...tables]){
    const values=await readAsAuthenticated(t);
    assert.deepEqual(values.map(r=>r.account_id),[other]);
    checks++;
  }
  // Updating an authenticated user's progress while truly active still works;
  // after pending state (even before Auth detach), the write policy denies it.
  await db.exec("reset role");
  await setUser(other);
  await db.exec("set role authenticated");
  const activeWrite=await rows("update public.bookmarks set label='updated' where account_id=auth.uid() returning account_id");
  assert.equal(activeWrite.length,1);checks++;
  await db.exec("reset role");
  await db.query("update public.profiles set status='deletion_pending' where account_id=$1",[other]);
  await db.exec("set role authenticated");
  const pendingWrite=await rows("update public.bookmarks set label='wrong' where account_id=auth.uid() returning account_id");
  assert.equal(pendingWrite.length,0);checks++;
  const pendingDelete=await rows("delete from public.bookmarks where account_id=auth.uid() returning account_id");
  assert.equal(pendingDelete.length,0);checks++;
  await db.exec("reset role");
  console.log('Account deletion stale-JWT RLS candidate: '+checks+
    ' PGlite synthetic checks PASS; no actual JWT/session/Supabase writes.');
}finally{
  await db.close();
}
