import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// F2 preflight ONLY. Two synthetic accounts, PostgreSQL roles and mock JWT
// claims in local PGlite. NOT actual signed Supabase identities or remote RLS
// execution. No SQL, user, entitlement or migration is sent to a cloud project.
const migration = await readFile(new URL(
  '../../../supabase/migrations/20261030214706_ui02_atomic_purchase_access_locale_dev.sql',
  import.meta.url,
), 'utf8');
assert.equal(
  createHash('sha256').update(migration).digest('hex'),
  '3c1a88aa3f1a17c4a67fd0163026b0f2d8fda3da10b70fcbec66fb0ad719eb85',
  'The already Development-applied migration source MUST remain pinned.',
);
const start = migration.indexOf('create table public.account_transactional_locale_preferences');
const end = migration.indexOf('-- Immutable locale template snapshot', start);
assert.ok(start >= 0 && end > start, 'Expected exact UI-02 migration section');
const actualSourceDDL = migration.slice(start, end);
assert.match(actualSourceDDL, /create policy ui02_account_locale_read_own/i);
assert.match(actualSourceDDL, /create policy ui02_account_locale_insert_own/i);
assert.match(actualSourceDDL, /create policy ui02_account_locale_update_own/i);
assert.doesNotMatch(actualSourceDDL, /purchase_access_ready_locale_snapshots/i);

const A = '123e4567-e89b-42d3-a456-426614174000';
const B = '223e4567-e89b-42d3-a456-426614174000';
const C = '323e4567-e89b-42d3-a456-426614174000';
const database = new PGlite();
let passed = 0;
function pass(label, fn) {
  fn();
  passed += 1;
  console.log('PASS F2 ' + label);
}
async function denied(operation, regexp, label) {
  let caught;
  try {
    await operation();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, 'Expected a database denial: ' + label);
  assert.match(String(caught.message ?? caught), regexp, label);
  passed += 1;
  console.log('PASS F2 ' + label);
}
async function asIdentity(accountId, operation, options = {}) {
  const role = options.role ?? 'authenticated';
  assert.ok(['authenticated', 'anon'].includes(role), 'Only fake browser roles');
  const claim = {
    sub: accountId,
    role,
    is_anonymous: options.isAnonymous === true,
  };
  await database.query("select set_config('request.jwt.claim.sub', $1, false);", [accountId ?? '']);
  await database.query("select set_config('request.jwt.claims', $1, false);", [JSON.stringify(claim)]);
  await database.exec('set role ' + role + ';');
  try {
    return await operation();
  } finally {
    await database.exec('reset role;');
  }
}
async function selectAs(id, options = {}) {
  return asIdentity(id, () => database.query(
    'select account_id,preferred_locale,revision from public.account_transactional_locale_preferences order by account_id',
  ), options);
}
try {
  await database.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable
      as $$ select coalesce(
        nullif(current_setting('request.jwt.claims', true),'')::jsonb,
        '{}'::jsonb
      ) $$;
    create table public.profiles (
      account_id uuid primary key, status text not null
    );
    insert into public.profiles values
      ('123e4567-e89b-42d3-a456-426614174000','active'),
      ('223e4567-e89b-42d3-a456-426614174000','active'),
      ('323e4567-e89b-42d3-a456-426614174000','active');
    alter table public.profiles enable row level security;
    create policy f2_fake_profile_owner_read on public.profiles
      for select to authenticated using (account_id = auth.uid());
    grant usage on schema public,auth to authenticated,anon,service_role;
    grant select on public.profiles to authenticated;
  `);
  // Real UI-02 table definition, column-level grants, BEFORE trigger and
  // all three exact RLS policies, extracted from its pinned source file.
  await database.exec(actualSourceDDL);

  const policies = await database.query(`
    select polname,polcmd from pg_policy
    where polrelid='public.account_transactional_locale_preferences'::regclass
    order by polname;
  `);
  pass('three actual UI-02 select/insert/update policies installed', () => {
    assert.deepEqual(
      policies.rows.map(x => x.polname),
      ['ui02_account_locale_insert_own','ui02_account_locale_read_own','ui02_account_locale_update_own'],
    );
  });

  const acl = await database.query(`
    select
      has_column_privilege('authenticated',
        'public.account_transactional_locale_preferences','preferred_locale','UPDATE') as update_locale,
      has_column_privilege('authenticated',
        'public.account_transactional_locale_preferences','account_id','UPDATE') as update_owner,
      has_table_privilege('anon',
        'public.account_transactional_locale_preferences','SELECT') as anon_select,
      has_table_privilege('authenticated',
        'public.account_transactional_locale_preferences','DELETE') as auth_delete;
  `);
  pass('column-scoped write and anonymous privileges are restricted', () => {
    assert.equal(acl.rows[0].update_locale, true);
    assert.equal(acl.rows[0].update_owner, false);
    assert.equal(acl.rows[0].anon_select, false);
    assert.equal(acl.rows[0].auth_delete, false);
  });

  const ownA = await asIdentity(A, () => database.query(`
    insert into public.account_transactional_locale_preferences(account_id, preferred_locale)
    values ($1::uuid,'es')
    returning account_id,preferred_locale,revision,selection_provenance;
  `, [A]));
  pass('synthetic signed A can create ONLY own preference', () => {
    assert.equal(ownA.rows.length, 1);
    assert.equal(ownA.rows[0].account_id, A);
    assert.equal(ownA.rows[0].preferred_locale, 'es');
    assert.equal(ownA.rows[0].revision, 1);
    assert.equal(ownA.rows[0].selection_provenance, 'authenticated_account');
  });

  await denied(
    () => asIdentity(A, () => database.query(`
      insert into public.account_transactional_locale_preferences(account_id,preferred_locale)
      values ($1::uuid,'en');
    `,[B])),
    /row.level security|violates/i,
    'signed A cannot insert signed B preference',
  );

  const ownB = await asIdentity(B, () => database.query(`
    insert into public.account_transactional_locale_preferences(account_id, preferred_locale)
    values ($1::uuid,'en') returning account_id,preferred_locale;
  `,[B]));
  pass('synthetic signed B can create only B preference', () => {
    assert.equal(ownB.rows[0].account_id,B);
    assert.equal(ownB.rows[0].preferred_locale,'en');
  });

  const readA = await selectAs(A);
  const readB = await selectAs(B);
  pass('A and B SELECT only their respective row', () => {
    assert.deepEqual(readA.rows.map(x=>x.account_id),[A]);
    assert.deepEqual(readB.rows.map(x=>x.account_id),[B]);
  });

  const foreignUpdate = await asIdentity(A, () => database.query(`
    update public.account_transactional_locale_preferences
    set preferred_locale='es' where account_id=$1::uuid
    returning account_id;
  `,[B]));
  pass('A cannot update B preference, including with explicit foreign ID', () => {
    assert.equal(foreignUpdate.rows.length,0);
  });

  const updateA = await asIdentity(A, () => database.query(`
    update public.account_transactional_locale_preferences
    set preferred_locale='en' where account_id=$1::uuid
    returning account_id,preferred_locale,revision,selection_provenance;
  `,[A]));
  pass('A own update increments server revision and retains provenance', () => {
    assert.equal(updateA.rows.length,1);
    assert.equal(updateA.rows[0].account_id,A);
    assert.equal(updateA.rows[0].preferred_locale,'en');
    assert.equal(updateA.rows[0].revision,2);
    assert.equal(updateA.rows[0].selection_provenance,'authenticated_account');
  });

  await denied(
    () => asIdentity(A, () => database.query(`
      update public.account_transactional_locale_preferences
      set account_id=$2::uuid where account_id=$1::uuid;
    `,[A,B])),
    /permission denied/i,
    'authenticated caller cannot reassign account_id column',
  );
  await denied(
    () => asIdentity(A, () => database.query(`
      delete from public.account_transactional_locale_preferences where account_id=$1::uuid;
    `,[A])),
    /permission denied/i,
    'authenticated caller has no DELETE privilege',
  );

  await denied(
    () => selectAs(A,{role:'anon'}),
    /permission denied/i,
    'anon role has no locale-table read grant',
  );

  const anonymousRead = await selectAs(A,{isAnonymous:true});
  pass('authenticated database role with anonymous JWT sees zero rows',()=>{
    assert.equal(anonymousRead.rows.length,0);
  });

  await denied(
    () => asIdentity(C, () => database.query(`
      insert into public.account_transactional_locale_preferences(account_id, preferred_locale)
      values ($1::uuid,'es');
    `,[C]),{isAnonymous:true}),
    /row.level security|violates/i,
    'anonymous JWT on active C cannot insert own preference',
  );

  const noSubject = await selectAs(null);
  pass('missing auth.uid claim never returns locale preferences', () => {
    assert.equal(noSubject.rows.length,0);
  });

  await database.query("update public.profiles set status='deletion_pending' where account_id=$1::uuid;",[A]);
  await database.query("update public.profiles set status='deletion_pending' where account_id=$1::uuid;",[C]);
  const pendingRead = await selectAs(A);
  pass('deletion_pending A cannot SELECT even retained own preference',()=>{
    assert.equal(pendingRead.rows.length,0);
  });
  const pendingUpdate = await asIdentity(A, () => database.query(`
    update public.account_transactional_locale_preferences
    set preferred_locale='es' where account_id=$1::uuid returning account_id;
  `,[A]));
  pass('deletion_pending A cannot UPDATE retained own preference',()=>{
    assert.equal(pendingUpdate.rows.length,0);
  });
  await denied(
    () => asIdentity(C, () => database.query(`
      insert into public.account_transactional_locale_preferences(account_id,preferred_locale)
      values ($1::uuid,'en');
    `,[C])),
    /row.level security|violates/i,
    'deletion_pending C cannot INSERT new preference',
  );
  const bUnchanged = await selectAs(B);
  pass('pending-state change on A does not affect active B access',()=>{
    assert.deepEqual(bUnchanged.rows.map(x=>x.account_id),[B]);
  });
  console.log('RESULT F2: '+passed+'/'+passed+
    ' local real-policy PostgreSQL tests PASS; actual signed-user Supabase gate remains HOLD');
} finally {
  await database.close();
}
