import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// Local PGlite only. This does not connect to Supabase, invoke a Data API,
// create customers, apply migrations or access any account record.
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [legacy, ui02, app] = await Promise.all([
  read('../../../supabase/migrations/20260729203000_paid_access_foundation.sql'),
  read('../../../supabase/migrations/20261030221037_ui02_language_privacy_lifecycle_dev.sql'),
  read('../src/lib/supabase-server.js'),
]);

function extracted(source, expression, description) {
  const matches = [...source.matchAll(expression)];
  assert.equal(matches.length, 1, 'Expected exactly one ' + description);
  return matches[0][0];
}
const legacyFn = extracted(legacy,
  /create or replace function public\.account_export\(export_account_id uuid\)[\s\S]*?\$\$;/gi,
  'original one-parameter account export');
const ui02Fn = extracted(ui02,
  /create or replace function public\.account_export\(\)[\s\S]*?\$function\$;/gi,
  'Development zero-parameter export');

const ui02Sha = createHash('sha256').update(ui02).digest('hex');
assert.equal(ui02Sha, 'b741bd787610b412cc2b1439e1f74dc0bfb5b64e35e071f9400177a451217eb3');
assert.match(legacyFn, /security definer/i);
assert.match(legacyFn, /where export_account_id = auth\.uid\(\)/i);
assert.doesNotMatch(ui02Fn, /security definer/i);
assert.match(app, /path:\s*'\/rest\/v1\/rpc\/account_export'/);
assert.match(app, /body:\s*\{\s*export_account_id:\s*user\.id\s*\}/);

const a = '123e4567-e89b-42d3-a456-426614174000';
const b = '223e4567-e89b-42d3-a456-426614174000';
const pg = new PGlite();
let passed = 0;
function checked(label, assertion) {
  assertion();
  passed += 1;
  console.log('PASS F4 ' + label);
}
async function asRole(role, accountId, sql, params = []) {
  await pg.query('select set_config($1, $2, false)', [
    'request.jwt.claim.sub', accountId ?? '',
  ]);
  await pg.exec('set role ' + role + ';');
  try {
    return await pg.query(sql, params);
  } finally {
    await pg.exec('reset role;');
  }
}
function payload(result) {
  const value = result.rows[0]?.payload ?? null;
  return typeof value === 'string' ? JSON.parse(value) : value;
}

try {
  await pg.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    create table public.profiles (
      account_id uuid primary key, email text, status text not null
    );
    create table public.purchases (
      account_id uuid not null, completed_at timestamptz not null default now()
    );
    create table public.entitlements (
      account_id uuid not null, created_at timestamptz not null default now()
    );
    create table public.learning_progress (
      account_id uuid not null, content_id text not null
    );
    create table public.bookmarks (
      account_id uuid not null, created_at timestamptz not null default now()
    );
    create table public.support_requests (
      account_id uuid not null, created_at timestamptz not null default now()
    );
    create table public.privacy_requests (
      account_id uuid not null, requested_at timestamptz not null default now()
    );
    create table public.account_transactional_locale_preferences (
      account_id uuid primary key, preferred_locale text not null
    );
    insert into public.profiles values
      ('123e4567-e89b-42d3-a456-426614174000', 'a@invalid.test', 'active'),
      ('223e4567-e89b-42d3-a456-426614174000', 'b@invalid.test', 'active');
    insert into public.purchases(account_id) values
      ('123e4567-e89b-42d3-a456-426614174000'),
      ('223e4567-e89b-42d3-a456-426614174000');
    insert into public.account_transactional_locale_preferences values
      ('123e4567-e89b-42d3-a456-426614174000', 'es'),
      ('223e4567-e89b-42d3-a456-426614174000', 'en');
    alter table public.account_transactional_locale_preferences enable row level security;
    create policy f4_active_pref on public.account_transactional_locale_preferences
      for select to authenticated
      using (
        account_id = auth.uid()
        and exists(select 1 from public.profiles p
                   where p.account_id=auth.uid() and p.status='active')
      );
    grant usage on schema public, auth to authenticated, anon;
    grant select on all tables in schema public to authenticated;
  `);
  // Execute the ORIGINAL function body copied from repository source,
  // not a synthetic approximation of its argument signature.
  await pg.exec(legacyFn);
  await pg.exec(`
    revoke all on function public.account_export(uuid) from public, anon;
    grant execute on function public.account_export(uuid) to authenticated;
  `);
  const selfBefore = payload(await asRole('authenticated', a,
    'select public.account_export($1::uuid) as payload', [a]));
  checked('legacy one-arg owner export returns all seven legacy fields', () => {
    assert.ok(selfBefore);
    assert.deepEqual(Object.keys(selfBefore).sort(), [
      'bookmarks', 'entitlements', 'learningProgress', 'privacyRequests',
      'profile', 'purchases', 'supportRequests',
    ].sort());
    assert.equal(selfBefore.profile.account_id, a);
  });
  checked('legacy function rejects cross-account export', () => {
    // The actual cross-user SQL call is executed below.
    assert.equal(legacyFn.includes('where export_account_id = auth.uid()'), true);
  });
  const forbidden = payload(await asRole('authenticated', a,
    'select public.account_export($1::uuid) as payload', [b]));
  checked('signed actor A cannot export actor B', () => assert.equal(forbidden, null));

  // Execute the ACTUAL already-Development-applied UI-02 function
  // definition. Different arguments create a second overload, not a fix.
  await pg.exec(ui02Fn);
  const catalog = await pg.query(`
    select pronargs as count, prosecdef as is_definer,
           pg_get_function_identity_arguments(oid) as args
    from pg_proc
    where pronamespace = 'public'::regnamespace and proname = 'account_export'
    order by pronargs;
  `);
  checked('PostgreSQL reports two distinct account_export identities', () => {
    assert.equal(catalog.rows.length, 2);
    assert.deepEqual(catalog.rows.map(row => Number(row.count)), [0, 1]);
    assert.deepEqual(catalog.rows.map(row => row.is_definer), [false, true]);
    assert.match(catalog.rows[1].args, /export_account_id uuid/);
  });
  const privileged = await pg.query(`
    select
      has_function_privilege('anon', 'public.account_export(uuid)', 'EXECUTE') as anon_one_arg,
      has_function_privilege('authenticated', 'public.account_export(uuid)', 'EXECUTE') as auth_one_arg,
      has_function_privilege('anon', 'public.account_export()', 'EXECUTE') as anon_zero_arg;
  `);
  checked('original security grants and new PUBLIC default differ', () => {
    assert.equal(privileged.rows[0].anon_one_arg, false);
    assert.equal(privileged.rows[0].auth_one_arg, true);
    assert.equal(privileged.rows[0].anon_zero_arg, true);
  });
  const oneAfter = payload(await asRole('authenticated', a,
    'select public.account_export($1::uuid) as payload', [a]));
  checked('named-argument client still selects old export (missing preference)', () => {
    assert.deepEqual(oneAfter, selfBefore);
    assert.equal(Object.hasOwn(oneAfter, 'transactionalLanguagePreference'), false);
  });
  const zeroAfter = payload(await asRole('authenticated', a,
    'select public.account_export() as payload'));
  checked('zero-arg invoker export contains the new preference instead', () => {
    assert.equal(zeroAfter.profile.account_id, a);
    assert.equal(zeroAfter.transactionalLanguagePreference.preferred_locale, 'es');
    assert.equal(Object.hasOwn(zeroAfter, 'mediaLanguagePreference'), false);
  });
  const otherZero = payload(await asRole('authenticated', b,
    'select public.account_export() as payload'));
  checked('zero-arg invoker observes caller B own preference', () => {
    assert.equal(otherZero.profile.account_id, b);
    assert.equal(otherZero.transactionalLanguagePreference.preferred_locale, 'en');
  });

  // Read-only source-policy simulation. This DOES NOT prescribe which
  // deletion_pending export policy the owner must approve.
  await pg.query('update public.profiles set status=$2 where account_id=$1::uuid',
    [a, 'deletion_pending']);
  const pending = payload(await asRole('authenticated', a,
    'select public.account_export() as payload'));
  checked('active-only RLS hides preference during deletion_pending', () => {
    assert.equal(pending.profile.status, 'deletion_pending');
    assert.equal(pending.transactionalLanguagePreference, null);
  });
  const legacyPending = payload(await asRole('authenticated', a,
    'select public.account_export($1::uuid) as payload', [a]));
  checked('legacy one-arg export still exposes legacy keys for self', () => {
    assert.equal(legacyPending.profile.status, 'deletion_pending');
    assert.equal(Object.hasOwn(legacyPending, 'transactionalLanguagePreference'), false);
  });
  const anonPermission = await pg.query(`
    select has_function_privilege('anon','public.account_export(uuid)','EXECUTE') as allowed;
  `);
  checked('one-arg RPC remains unavailable to anon', () => {
    assert.equal(anonPermission.rows[0].allowed, false);
  });
  // Mechanical candidate ONLY, assembled in this disposable PGlite database.
  // It does not create a migration, grant real access or settle F3 policy.
  // Its active-only behavior is a TEST OPTION and requires privacy approval.
  await pg.exec(`
    create table public.account_media_locale_preferences (
      account_id uuid primary key, preferred_media_locale text not null
    );
    insert into public.account_media_locale_preferences values
      ('123e4567-e89b-42d3-a456-426614174000', 'es');
  `);
  const oidBefore = (await pg.query(`
    select oid::text as oid from pg_proc
    where oid = 'public.account_export(uuid)'::regprocedure;
  `)).rows[0].oid;
  const marker = "    'profile', (select to_jsonb(p) - 'email'";
  assert.equal(legacyFn.split(marker).length, 2, 'Pinned original JSON contract changed');
  const localeFields = `    'transactionalLanguagePreference', (
      select to_jsonb(pref) from public.account_transactional_locale_preferences pref
      where pref.account_id = export_account_id
        and exists (select 1 from public.profiles prof
                    where prof.account_id = export_account_id and prof.status = 'active')
    ),
    'mediaLanguagePreference', (
      select to_jsonb(pref) from public.account_media_locale_preferences pref
      where pref.account_id = export_account_id
        and exists (select 1 from public.profiles prof
                    where prof.account_id = export_account_id and prof.status = 'active')
    ),
`;
  const mechanicalCandidate = legacyFn.replace(marker, localeFields + marker)
    .replace('set search_path = public', "set search_path = ''");
  assert.notEqual(mechanicalCandidate, legacyFn);
  assert.match(mechanicalCandidate, /where export_account_id = auth\.uid\(\)/i);
  await pg.exec(mechanicalCandidate);
  const oidAfter = (await pg.query(`
    select oid::text as oid from pg_proc
    where oid = 'public.account_export(uuid)'::regprocedure;
  `)).rows[0].oid;
  checked('one-arg CREATE OR REPLACE preserves function OID', () => {
    assert.equal(oidAfter, oidBefore);
  });
  await pg.query('update public.profiles set status=$2 where account_id=$1::uuid',
    [a, 'active']);
  const patchedSelf = payload(await asRole('authenticated', a,
    'select public.account_export($1::uuid) as payload', [a]));
  checked('synthetic one-arg prototype preserves all legacy keys and adds both locales', () => {
    assert.deepEqual(Object.keys(patchedSelf).sort(), [
      ...Object.keys(selfBefore), 'transactionalLanguagePreference', 'mediaLanguagePreference',
    ].sort());
    assert.equal(patchedSelf.transactionalLanguagePreference.preferred_locale, 'es');
    assert.equal(patchedSelf.mediaLanguagePreference.preferred_media_locale, 'es');
    assert.equal(patchedSelf.profile.account_id, a);
  });
  const deniedAfter = payload(await asRole('authenticated', a,
    'select public.account_export($1::uuid) as payload', [b]));
  checked('synthetic one-arg prototype keeps self-account denial', () => {
    assert.equal(deniedAfter, null);
  });
  const aclAfter = (await pg.query(`
    select has_function_privilege('anon','public.account_export(uuid)','EXECUTE') as anon,
           has_function_privilege('authenticated','public.account_export(uuid)','EXECUTE') as user;
  `)).rows[0];
  checked('synthetic one-arg prototype preserves existing grants', () => {
    assert.equal(aclAfter.anon, false);
    assert.equal(aclAfter.user, true);
  });
  await pg.query('update public.profiles set status=$2 where account_id=$1::uuid',
    [a, 'deletion_pending']);
  const pendingCandidate = payload(await asRole('authenticated', a,
    'select public.account_export($1::uuid) as payload', [a]));
  checked('synthetic active-only option withholds locale fields when pending', () => {
    assert.equal(pendingCandidate.transactionalLanguagePreference, null);
    assert.equal(pendingCandidate.mediaLanguagePreference, null);
    assert.equal(pendingCandidate.profile.status, 'deletion_pending');
  });

  // Alternative F3 decision option: permit the *same authenticated account*
  // to export retained locale metadata during deletion_pending, but never
  // broaden table RLS or permit pending writes. NO PRIVACY DECISION IS MADE.
  // The original self-only SECURITY DEFINER contract and all legacy keys stay.
  const pendingReadableLocaleFields = localeFields.replaceAll(
    "prof.status = 'active'",
    "prof.status in ('active', 'deletion_pending')",
  );
  assert.notEqual(pendingReadableLocaleFields, localeFields);
  assert.equal((pendingReadableLocaleFields.match(/deletion_pending/g) ?? []).length, 2);
  const originalIdentityGuard = 'where export_account_id = auth.uid()';
  assert.equal(legacyFn.split(originalIdentityGuard).length, 2,
    'The pinned self-account identity predicate has changed');
  const pendingReadablePrototype = legacyFn.replace(
    marker, pendingReadableLocaleFields + marker,
  ).replace(
    originalIdentityGuard,
    `where export_account_id = auth.uid()
      and exists (
        select 1 from public.profiles owner_profile
        where owner_profile.account_id = export_account_id
          and owner_profile.status in ('active', 'deletion_pending')
      )`,
  ).replace('set search_path = public', "set search_path = ''");
  await pg.exec(pendingReadablePrototype);
  const pendingOwn = payload(await asRole('authenticated', a,
    'select public.account_export($1::uuid) as payload', [a]));
  checked('F3 option B: pending owner can self-export both retained locale fields', () => {
    assert.equal(pendingOwn.profile.status, 'deletion_pending');
    assert.deepEqual(Object.keys(pendingOwn).sort(), [
      ...Object.keys(selfBefore), 'transactionalLanguagePreference', 'mediaLanguagePreference',
    ].sort());
    assert.equal(pendingOwn.transactionalLanguagePreference.preferred_locale, 'es');
    assert.equal(pendingOwn.mediaLanguagePreference.preferred_media_locale, 'es');
  });
  const pendingDirect = await asRole('authenticated', a,
    'select account_id from public.account_transactional_locale_preferences');
  checked('F3 option B does not weaken direct table RLS for pending account', () => {
    assert.deepEqual(pendingDirect.rows, []);
  });
  const crossPending = payload(await asRole('authenticated', a,
    'select public.account_export($1::uuid) as payload', [b]));
  const crossActive = payload(await asRole('authenticated', b,
    'select public.account_export($1::uuid) as payload', [a]));
  checked('F3 option B preserves both directions of cross-account isolation', () => {
    assert.equal(crossPending, null);
    assert.equal(crossActive, null);
  });
  const afterOptionsAcl = (await pg.query(`
    select oid::text as oid, prosecdef as definer,
      has_function_privilege('anon',oid,'EXECUTE') as anon,
      has_function_privilege('authenticated',oid,'EXECUTE') as authenticated
    from pg_proc where oid = 'public.account_export(uuid)'::regprocedure;
  `)).rows[0];
  checked('F3 option B keeps original function OID, definer and grants', () => {
    assert.equal(afterOptionsAcl.oid, oidBefore);
    assert.equal(afterOptionsAcl.definer, true);
    assert.equal(afterOptionsAcl.anon, false);
    assert.equal(afterOptionsAcl.authenticated, true);
  });
  await pg.query('update public.profiles set status=$2 where account_id=$1::uuid',
    [a, 'deleted']);
  const fullyDeleted = payload(await asRole('authenticated', a,
    'select public.account_export($1::uuid) as payload', [a]));
  checked('F3 option B denies the complete export for deleted accounts', () => {
    assert.equal(fullyDeleted, null,
      'A stale matching synthetic JWT must not get old profile or locale fields');
  });
  const unaffectedOwner = payload(await asRole('authenticated', b,
    'select public.account_export($1::uuid) as payload', [b]));
  checked('F3 option B keeps unaffected active owners eligible for own export', () => {
    assert.equal(unaffectedOwner.profile.account_id, b);
    assert.equal(unaffectedOwner.profile.status, 'active');
  });
  // This synthetic guard is a defense-in-depth candidate, not a substitute
  // for real Auth session revocation or final deletion verification.

  console.log('RESULT F4: ' + passed + '/' + passed +
    ' isolated PostgreSQL source/contract checks passed; RELEASE DEFECT REMAINS.');
} finally {
  await pg.close();
}
