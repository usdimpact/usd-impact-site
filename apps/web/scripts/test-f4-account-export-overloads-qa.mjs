import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// CURRENT-CHAIN QA ONLY: isolated local PostgreSQL, fake JWT subjects, no
// network, Supabase connection, schema write or real account.
// This replaces the stale July-only test that omitted August 12 hardening.
const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');
const [july, august, october, app] = await Promise.all([
  read('../../../supabase/migrations/20260729203000_paid_access_foundation.sql'),
  read('../../../supabase/migrations/20260812180308_harden_account_rpcs.sql'),
  read('../../../supabase/migrations/20261030221037_ui02_language_privacy_lifecycle_dev.sql'),
  read('../src/lib/supabase-server.js'),
]);
const gitBlob = (s) => createHash('sha1')
  .update('blob ' + Buffer.byteLength(s, 'utf8') + '\0' + s).digest('hex');
assert.equal(gitBlob(august), 'a1a84d4d97f7a5713371aba2c9c3bcdad0100aa0');
assert.equal(gitBlob(october), '0df302812a95982b7c0d9dbdbe5fc983849ccc5a');
assert.match(app, /body:\s*\{\s*export_account_id:\s*user\.id\s*\}/);
function extract(s, regex, description) {
  const found = [...s.matchAll(regex)];
  assert.equal(found.length, 1, description + ' source match count');
  return found[0][0];
}
const julyOne = extract(july,
  /create or replace function public\.account_export\(export_account_id uuid\)[\s\S]*?\$\$;/gi,
  'original one-arg function');
const augZero = extract(august,
  /create or replace function public\.account_export\(\)[\s\S]*?\$\$;/gi,
  'August zero-arg canonical function');
const augOne = extract(august,
  /create or replace function public\.account_export\(export_account_id uuid\)[\s\S]*?\$\$;/gi,
  'August one-arg compatibility wrapper');
const zeroGrants = extract(august,
  /revoke all on function public\.account_export\(\)[\s\S]*?grant execute on function public\.account_export\(\) to authenticated;/gi,
  'August zero-arg grants');
const oneGrants = extract(august,
  /revoke all on function public\.account_export\(uuid\)[\s\S]*?grant execute on function public\.account_export\(uuid\) to authenticated;/gi,
  'August one-arg grants');
const octZero = extract(october,
  /create or replace function public\.account_export\(\)[\s\S]*?\$function\$;/gi,
  'October UI02 zero-arg replacement');
assert.match(julyOne, /security definer/i);
assert.match(augZero, /security invoker/i);
assert.match(augOne, /security invoker/i);
assert.match(augOne, /select public\.account_export\(\)/i);
assert.doesNotMatch(octZero, /security definer/i);
const A='123e4567-e89b-42d3-a456-426614174000';
const B='223e4567-e89b-42d3-a456-426614174000';
const pg = new PGlite();
let checks = 0;
const check=(name,fn)=>{fn();checks++;console.log('PASS F4-CURRENT '+name);};
async function asRole(role,subject,sql,params=[]) {
  await pg.query("select set_config('request.jwt.claim.sub', $1, false);",[subject??'']);
  await pg.exec('set role '+role+';');
  try {return await pg.query(sql,params);}
  finally {await pg.exec('reset role;');}
}
const one=(subject,target,role='authenticated')=>
  asRole(role,subject,'select public.account_export($1::uuid) as payload',[target]);
const zero=(subject,role='authenticated')=>
  asRole(role,subject,'select public.account_export() as payload');
const obj=(r)=>r.rows[0]?.payload??null;
const catalog=()=>pg.query(`
  select oid::text as oid,pronargs,prosecdef as definer,
    has_function_privilege('anon',oid,'EXECUTE') as anon,
    has_function_privilege('authenticated',oid,'EXECUTE') as member
  from pg_proc where pronamespace='public'::regnamespace
     and proname='account_export' order by pronargs;
`);
try {
  await pg.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.profiles (
      account_id uuid primary key,email text,status text not null
    );
    create table public.purchases (
      account_id uuid,completed_at timestamptz not null default now()
    );
    create table public.entitlements (
      account_id uuid,created_at timestamptz not null default now()
    );
    create table public.learning_progress (account_id uuid,content_id text);
    create table public.bookmarks (
      account_id uuid,created_at timestamptz not null default now()
    );
    create table public.support_requests (
      account_id uuid,created_at timestamptz not null default now()
    );
    create table public.privacy_requests (
      account_id uuid,requested_at timestamptz not null default now()
    );
    create table public.account_transactional_locale_preferences (
      account_id uuid primary key,preferred_locale text not null
    );
    insert into public.profiles values
      ('123e4567-e89b-42d3-a456-426614174000','a@invalid.test','active'),
      ('223e4567-e89b-42d3-a456-426614174000','b@invalid.test','active');
    insert into public.purchases(account_id) values
      ('123e4567-e89b-42d3-a456-426614174000'),
      ('223e4567-e89b-42d3-a456-426614174000');
    insert into public.account_transactional_locale_preferences values
      ('123e4567-e89b-42d3-a456-426614174000','es'),
      ('223e4567-e89b-42d3-a456-426614174000','en');
    alter table public.profiles enable row level security;
    create policy fake_profile_self on public.profiles for select to authenticated
      using(account_id=auth.uid());
    alter table public.account_transactional_locale_preferences enable row level security;
    create policy fake_locale_self on public.account_transactional_locale_preferences
      for select to authenticated
      using(account_id=auth.uid() and exists(
        select 1 from public.profiles p
        where p.account_id=auth.uid() and p.status='active'));
    grant usage on schema public,auth to authenticated,anon;
    grant select on all tables in schema public to authenticated;
  `);
  await pg.exec(julyOne);
  const julyA=obj(await one(A,A));
  check('July-only function demonstrates why previous simulation was misleading',()=>{
    assert.equal(julyA.profile.account_id,A);
    assert.equal(Object.hasOwn(julyA,'transactionalLanguagePreference'),false);
  });
  const julyOID=(await catalog()).rows[0].oid;
  await pg.exec(augZero);
  await pg.exec(zeroGrants);
  await pg.exec(augOne);
  await pg.exec(oneGrants);
  const augustCat=(await catalog()).rows;
  check('August hardening preserves one-arg OID and creates zero-arg canonical function',()=>{
    assert.equal(augustCat.length,2);
    assert.deepEqual(augustCat.map(r=>Number(r.pronargs)),[0,1]);
    assert.equal(augustCat[1].oid,julyOID);
  });
  check('August hardening removes SECURITY DEFINER from both exports',()=>{
    assert.deepEqual(augustCat.map(r=>r.definer),[false,false]);
  });
  check('August hardening has authenticated-only execute for both overloads',()=>{
    for(const r of augustCat){assert.equal(r.anon,false);assert.equal(r.member,true);}
  });
  const augA=obj(await one(A,A));
  check('August compatibility wrapper returns seven legacy fields',()=>{
    assert.deepEqual(Object.keys(augA).sort(),[
      'profile','purchases','entitlements','learningProgress',
      'bookmarks','supportRequests','privacyRequests',
    ].sort());
    assert.equal(augA.profile.account_id,A);
  });
  check('August wrapper delegates exactly to canonical zero-arg RPC',()=>{
    assert.deepEqual(augA,obj(await zero(A)));
  });
  const beforeCross=obj(await one(A,B));
  check('August named-arg cross-owner call denied',()=>{
    assert.equal(beforeCross,null);
  });
  await pg.exec(octZero);
  const octoberCat=(await catalog()).rows;
  check('UI02 updates existing zero-arg function OID without changing grants',()=>{
    assert.equal(octoberCat[0].oid,augustCat[0].oid);
    assert.equal(octoberCat[1].oid,augustCat[1].oid);
    assert.deepEqual(octoberCat.map(r=>r.definer),[false,false]);
    for(const r of octoberCat){assert.equal(r.anon,false);assert.equal(r.member,true);}
  });
  const octA=obj(await one(A,A));
  check('APP actual named-arg call NOW routes to UI02 locale field',()=>{
    assert.equal(octA.profile.account_id,A);
    assert.equal(octA.transactionalLanguagePreference.preferred_locale,'es');
    assert.deepEqual(Object.keys(octA).sort(),[
      ...Object.keys(augA),'transactionalLanguagePreference',
    ].sort());
  });
  check('Direct canonical zero-arg and one-arg wrapper agree after UI02',()=>{
    assert.deepEqual(octA,obj(await zero(A)));
  });
  const octB=obj(await one(B,B));
  check('Other owner B gets only their own locale',()=>{
    assert.equal(octB.profile.account_id,B);
    assert.equal(octB.transactionalLanguagePreference.preferred_locale,'en');
  });
  const forbidden=obj(await one(A,B));
  check('Named-arg caller A never exports B',()=>assert.equal(forbidden,null));
  const noIdentity=obj(await one(null,A));
  check('Missing authenticated subject returns no export',()=>assert.equal(noIdentity,null));
  let anonymousError;
  try {await one(A,A,'anon');}
  catch(e){anonymousError=e;}
  check('Anon cannot execute the named-arg RPC',()=>{
    assert.ok(anonymousError);
    assert.match(String(anonymousError.message),/permission denied/i);
  });
  await pg.query("update public.profiles set status='deletion_pending' where account_id=$1::uuid",[A]);
  const pending=obj(await one(A,A));
  check('Pending-state locale is hidden by active-only table RLS',()=>{
    assert.equal(pending.profile.status,'deletion_pending');
    assert.equal(pending.transactionalLanguagePreference,null);
  });
  await pg.query("update public.profiles set status='deleted' where account_id=$1::uuid",[A]);
  const deleted=obj(await one(A,A));
  check('Source-only deleted-state guard is NOT established',()=>{
    assert.equal(deleted?.profile?.status,'deleted');
  });
  console.log('RESULT F4-CURRENT '+checks+'/'+checks+
    ' migration-chain checks PASS. Source wrapper correct; real PostgREST and F3 remain HOLD.');
} finally {await pg.close();}
