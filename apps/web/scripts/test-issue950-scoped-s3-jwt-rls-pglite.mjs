// Issue #950: disposable PGlite proves JWT-scoped Storage RLS candidate
// source read-only, restore scoped upsert and exact-policy rollback.
// No real Supabase, Auth, S3, user token, keys, network or private file bytes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {privateAudiobookTracks} from '../src/lib/private-audiobook.js';
import {privateBookDocument} from '../src/lib/private-book.js';

const src=n=>readFileSync(new URL('../../../docs/operations/candidates/'+n,import.meta.url),'utf8');
const sql=side=>src('issue950-s3-jwt-session-'+side+'.review.sql');
const undo=side=>src('issue950-s3-jwt-session-'+side+'-rollback.review.sql');
const uuids={
  source:'11111111-2222-4333-8444-555555555555',
  restore:'22222222-3333-4444-8555-666666666666',
  stranger:'33333333-4444-4555-8666-777777777777',
};
const expires=(hours=2)=>new Date(Date.now()+hours*3600000).toISOString();
const audio=privateAudiobookTracks.map(t=>t.objectPath);
const book=privateBookDocument.objectPath;
const paths=[...audio,book];
assert.equal(audio.length,20);
assert.equal(new Set(paths).size,21);
let checks=2;
const proposals={source:sql('source'),restore:sql('restore')};
for(const side of ['source','restore']){
  const template=proposals[side];
  assert.match(template,/REVIEW ONLY - NOT A MIGRATION/);
  assert.match(template,/__ISSUE950_EXPIRES_AT_UTC__/);
  assert.match(template,new RegExp('__ISSUE950_'+side.toUpperCase()+'_SERVER_HOST_MD5__'));
  assert.match(template,/md5\(inet_server_addr\(\)::text\)/);
  assert.match(template,/inet_server_addr\(\) is null/);
  assert.ok(template.includes("approved_host_md5 !~ '^[0-9a-f]{32}$'"),
    'expected exact anchored hex hash format in source SQL');
  assert.equal(template.split('do $issue950_preflight$').length-1,1,
    'review SQL must have exactly one preflight');
  assert.equal(template.split('create policy ').length-1,side==='source'?2:4,
    'review SQL must contain only exact expected policy definitions');
  assert.match(template,/__ISSUE950_APPROVED_TEST_EMAIL__/);
  assert.match(template,/raw_app_meta_data/);
  assert.match(template,/p\.status::text='suspended'/);
  assert.doesNotMatch(template,/\bu\.raw_user_meta_data\b|\bauth\.jwt\(\).*raw_user_meta_data/i);
  assert.match(template,new RegExp('__ISSUE950_'+side.toUpperCase()+'_SYNTHETIC_UUID__'));
  assert.doesNotMatch(template,/drop policy|delete from|truncate|service_role|sb_secret_/i);
  for(const name of paths)assert.ok(template.includes("'"+name+"'"),'missing immutable manifest '+side);
  const rollback=undo(side);
  assert.match(rollback,/drop policy if exists issue950_/);
  assert.match(rollback,/do \$issue950_rollback_preflight\$/);
  assert.match(rollback,new RegExp('__ISSUE950_'+side.toUpperCase()+'_SERVER_HOST_MD5__'));
  assert.match(rollback,new RegExp('__ISSUE950_'+side.toUpperCase()+'_SYNTHETIC_UUID__'));
  assert.match(rollback,/unexpected policy identity or shape/);
  assert.doesNotMatch(rollback,/delete from|truncate|drop table|drop schema|purge/i);
  checks+=11+paths.length;
}
assert.doesNotMatch(proposals.source,/for insert to authenticated|for update to authenticated|for delete to authenticated/i);
assert.match(proposals.restore,/for insert to authenticated/);
assert.match(proposals.restore,/for update to authenticated/);
assert.doesNotMatch(proposals.restore,/for delete to authenticated/i);
checks+=4;
function render(side,subject=uuids[side],until=expires(),overrideHostMd5=null){
  // This substitution is ONLY for a disposable PGlite connection with no
  // real remote server address. Never copy the synthetic host into real SQL.
  const fakeHost=side==='source'?'192.0.2.11':'198.51.100.11';
  const expectedHostMd5=overrideHostMd5??createHash('md5').update(fakeHost).digest('hex');
  return proposals[side]
    .replaceAll('__ISSUE950_'+side.toUpperCase()+'_SYNTHETIC_UUID__',subject)
    .replaceAll('__ISSUE950_EXPIRES_AT_UTC__',until)
    .replaceAll('__ISSUE950_APPROVED_TEST_EMAIL__','issue950-s3-'+side+'@example.invalid')
    .replaceAll('__ISSUE950_'+side.toUpperCase()+'_SERVER_HOST_MD5__',expectedHostMd5)
    .replaceAll('inet_server_addr()',"'"+fakeHost+"'");
}
function renderUndo(side,overrideHostMd5=null){
  const fakeHost=side==='source'?'192.0.2.11':'198.51.100.11';
  const expectedHostMd5=overrideHostMd5??createHash('md5').update(fakeHost).digest('hex');
  return undo(side)
    .replaceAll('__ISSUE950_'+side.toUpperCase()+'_SERVER_HOST_MD5__',expectedHostMd5)
    .replaceAll('__ISSUE950_'+side.toUpperCase()+'_SYNTHETIC_UUID__',uuids[side])
    .replaceAll('inet_server_addr()',"'"+fakeHost+"'");
}
const schema=[
  'create role authenticated nologin;',
  'create role anon nologin;',
  'create schema auth;',
  'create schema storage;',
  "create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb not null default '{}'::jsonb);",
  "create function auth.uid() returns uuid language sql stable as $uid$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $uid$;",
  "create table public.profiles(account_id uuid primary key,auth_user_id uuid,email text,status text not null default 'active',deleted_at timestamptz,deletion_requested_at timestamptz,deletion_due_at timestamptz);",
  "create table public.entitlements(account_id uuid not null);",
  "create function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path to '' as $fn$ begin insert into public.profiles(account_id,auth_user_id,email) values(new.id,new.id,coalesce(new.email,'')); return new; end $fn$;",
  "create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();",
  'create table storage.buckets(id text primary key,public boolean not null);',
  "create table storage.objects(bucket_id text not null,name text not null,metadata text default '',primary key(bucket_id,name));",
  'alter table storage.buckets enable row level security;',
  'alter table storage.objects enable row level security;',
  'grant usage on schema auth,storage to authenticated,anon;',
  'grant select,insert,update,delete on storage.objects,storage.buckets to authenticated;',
  'grant select on storage.objects,storage.buckets to anon;',
].join('\n');
async function makeDb(side,settings={}){
  const db=new PGlite();
  await db.exec(schema);
  const subject=uuids[side];
  if(!settings.noAuthUser){
    const appMetadata={issue950_scoped_s3:settings.wrongMarker?'unrelated':side};
    await db.query("insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3::jsonb)",
      [subject,'issue950-s3-'+side+'@example.invalid',JSON.stringify(appMetadata)]);
    // Exact production trigger creates ACTIVE profile by default. Explicit
    // approved operator change to SUSPENDED is required before any policy.
    if(!settings.activeProfile)
      await db.query("update public.profiles set status='suspended' where account_id=$1",[subject]);
    if(settings.wrongEmail)
      await db.query("update public.profiles set email='mismatched@example.invalid' where account_id=$1",[subject]);
    if(settings.entitledUser)
      await db.query("insert into public.entitlements(account_id) values($1)",[subject]);
  }
  await db.query("insert into storage.buckets values ('library-pass-assets',false),('library-pass-books',$1),('unrelated-private',false)",[Boolean(settings.publicBucket)]);
  for(const key of audio)await db.query("insert into storage.objects(bucket_id,name) values('library-pass-assets',$1)",[key]);
  await db.query("insert into storage.objects(bucket_id,name) values('library-pass-books',$1)",[book]);
  await db.query("insert into storage.objects(bucket_id,name) values('unrelated-private','outside/private/file.bin')");
  if(settings.extra)await db.query("insert into storage.objects(bucket_id,name) values('library-pass-assets','audiobook/read-the-dollar-first/v1/unlisted.mp3')");

  if(settings.existingPolicy)await db.exec("create policy unexpected_existing_bucket_policy on storage.buckets for select to authenticated using(true)");
  return db;
}
async function rows(db,q,p=[]){return (await db.query(q,p)).rows;}
async function count(db,q,p=[]){return Number((await rows(db,q,p))[0].n);}
async function as(db,role,subject,fn){
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[subject]);
  await db.exec('set role '+role);
  try{return await fn();}
  finally{await db.exec('reset role');}
}
async function happy(side){
  const db=await makeDb(side);
  const subject=uuids[side];
  try{
    await assert.rejects(db.exec(proposals[side]),/invalid input syntax|invalid input/i);
    await db.exec('rollback');
    assert.equal(await count(db,"select count(*) as n from pg_policies where schemaname='storage'"),0);
    checks+=2;
    await db.exec(render(side));
    const policyNames=(await rows(db,"select policyname from pg_policies where schemaname='storage' order by policyname")).map(x=>x.policyname);
    assert.equal(policyNames.length,side==='source'?2:4);
    assert.ok(policyNames.every(x=>x.startsWith('issue950_'+side+'_session_')));
    checks+=2;
    const permitted=(q,p=[])=>as(db,'authenticated',subject,()=>rows(db,q,p));
    assert.equal((await permitted("select name from storage.objects order by name")).length,21);
    assert.equal((await permitted("select id from storage.buckets")).length,2);
    assert.equal((await as(db,'authenticated',uuids.stranger,()=>rows(db,"select name from storage.objects"))).length,0);
    assert.equal((await as(db,'anon',subject,()=>rows(db,"select name from storage.objects"))).length,0);
    assert.equal((await as(db,'authenticated',uuids.stranger,()=>rows(db,"select id from storage.buckets"))).length,0);
    assert.equal((await permitted("select name from storage.objects where bucket_id='unrelated-private'")).length,0);
    checks+=6;
    assert.equal((await permitted("delete from storage.objects where bucket_id='library-pass-books' returning name")).length,0);
    checks++;
    if(side==='source'){
      assert.equal((await permitted("update storage.objects set metadata='tamper' where bucket_id='library-pass-books' returning name")).length,0);
      await assert.rejects(permitted("insert into storage.objects(bucket_id,name) values('library-pass-assets',$1)",[audio[0]]),
        /row-level security|permission denied|duplicate key/i);
      checks+=2;
    }else{
      const updated=await permitted("update storage.objects set metadata='fixture' where bucket_id='library-pass-books' returning name");
      assert.equal(updated.length,1);
      assert.equal(updated[0].name,book);
      await assert.rejects(permitted("update storage.objects set name='outside/new.pdf' where bucket_id='library-pass-books' returning name"),
        /row-level security|permission denied/i);
      await assert.rejects(permitted("insert into storage.objects(bucket_id,name) values('library-pass-assets','outside/new.mp3')"),
        /row-level security|permission denied/i);
      checks+=4;
      // Disposable fixture only: remove one metadata row as DBA to exercise
      // approved INSERT path, never delete objects or rows on real projects.
      await db.query("delete from storage.objects where bucket_id='library-pass-assets' and name=$1",[audio[0]]);
      assert.equal((await permitted("insert into storage.objects(bucket_id,name) values('library-pass-assets',$1) returning name",[audio[0]])).length,1);
      checks++;
    }
    await assert.rejects(db.exec(undo(side)),/invalid input syntax|invalid input/i);
    await db.exec('rollback');
    await assert.rejects(db.exec(renderUndo(side,'0'.repeat(32))),/project host binding not verified/);
    await db.exec('rollback');
    assert.equal(await count(db,"select count(*) as n from pg_policies where schemaname='storage'"),side==='source'?2:4);
    checks+=3;
    await db.exec(renderUndo(side));
    // A subsequent cleanup is idempotent on the same verified host.
    await db.exec(renderUndo(side));
    checks+=1;
    assert.equal((await as(db,'authenticated',subject,()=>rows(db,"select name from storage.objects"))).length,0);
    assert.equal(await count(db,"select count(*) as n from pg_policies where schemaname='storage'"),0);
    assert.equal(await count(db,"select count(*) as n from storage.objects where bucket_id in('library-pass-assets','library-pass-books')"),21);
    checks+=3;
  }finally{await db.close();}
}
await happy('source');
await happy('restore');
for(const side of ['source','restore']){
  for(const [reason,settings,pattern] of [
    ['unexpected-object',{extra:true},/exact 21-key/],
    ['public-bucket',{publicBucket:true},/exact two private buckets/],
    ['unexpected-policy',{existingPolicy:true},/unexpected pre-existing Storage policies/],
    ['active-triggered-profile',{activeProfile:true},/synthetic Auth\/profile isolation proof missing/],
    ['wrong-admin-marker',{wrongMarker:true},/synthetic Auth\/profile isolation proof missing/],
    ['mismatched-email',{wrongEmail:true},/synthetic Auth\/profile isolation proof missing/],
    ['paid-entitlement',{entitledUser:true},/synthetic user has paid entitlements/],
    ['absent-auth-subject',{noAuthUser:true},/synthetic Auth\/profile isolation proof missing/],
  ]){
    const db=await makeDb(side,settings);
    try{
      await assert.rejects(db.exec(render(side)),pattern,side+':'+reason);
      await db.exec('rollback');
      assert.equal(await count(db,"select count(*) as n from pg_policies where schemaname='storage'"),settings.existingPolicy?1:0);
      checks+=2;
    }finally{await db.close();}
  }
  {
    const db=await makeDb(side);
    try{
      // Correct Auth/manifest/candidate but wrong host binding must abort
      // *before* the first CREATE POLICY and leave no partial privilege.
      await assert.rejects(db.exec(render(side,uuids[side],expires(),'0'.repeat(32))),
        /project host binding not verified/);
      await db.exec('rollback');
      assert.equal(await count(db,"select count(*) as n from pg_policies where schemaname='storage'"),0);
      checks+=2;
    }finally{await db.close();}
  }
  {
    const db=await makeDb(side);
    try{
      await assert.rejects(db.exec(render(side,uuids[side],expires(9))),/expiry must be future and <=8h/);
      await db.exec('rollback');
      checks++;
    }finally{await db.close();}
  }
}
console.log('Issue #950 S3 JWT scoped recovery review: '+checks+
  ' synthetic SQL assertions PASS; no real S3, JWT, Auth, user, provider, private file or deployed SQL.');
