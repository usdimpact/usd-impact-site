import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createPublicationProductionVercelOAuthStore } from '../src/lib/publication-production-vercel-oauth-store.js';

let groups = 0;
const pass = () => { groups += 1; };
const migrationUrl = new URL('../../../supabase/migrations/20260915160900_publication_production_vercel_oauth_store_558.sql', import.meta.url);
const candidateUrl = new URL('../docs/sql/publication-production-vercel-oauth-store-558.sql', import.meta.url);
const [sql, candidateSql] = await Promise.all([
  readFile(migrationUrl, 'utf8'),
  readFile(candidateUrl, 'utf8'),
]);
const normalizeSql = (value) => value.split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .trim();
const db = new PGlite();
const storeTable = 'publication_provider_credential.vercel_oauth_refresh_state';
const storeLogin = 'fx558_oauth_store_login';

async function test(name, work) {
  try { await work(); pass(); }
  catch (error) { console.error(`Failed production Vercel OAuth store migration contract: ${name}`); throw error; }
}

async function rejects(target, text, pattern) {
  await assert.rejects(() => target.exec(text), (error) => pattern.test(error.message));
}

async function installFixture(target) {
  await target.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;

    create schema vault;
    create table vault.secrets (id uuid primary key);
    create view vault.decrypted_secrets as select id from vault.secrets;

    create schema publication_guard_api;

    create function publication_guard_api.read_current_revision()
    returns text language sql as $$ select '0'::text $$;

    create function publication_guard_api.read_snapshot(text,jsonb)
    returns jsonb language sql as $$ select '{}'::jsonb $$;

    create function publication_guard_api.authorize_release(uuid,text,text,text,text,timestamptz)
    returns void language sql as $$ select null::void $$;

    create function publication_guard_api.prepare_admission(uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz)
    returns void language sql as $$ select null::void $$;

    create function publication_guard_api.record_verified_receipt(uuid,text,text,text)
    returns void language sql as $$ select null::void $$;

    create function publication_guard_api.revoke_release(uuid)
    returns void language sql as $$ select null::void $$;

    create function publication_guard_api.revoke_admission(uuid,text,text)
    returns void language sql as $$ select null::void $$;

    revoke all on function publication_guard_api.read_current_revision() from public;
    revoke all on function publication_guard_api.read_snapshot(text,jsonb) from public;
    revoke all on function publication_guard_api.authorize_release(uuid,text,text,text,text,timestamptz) from public;
    revoke all on function publication_guard_api.prepare_admission(uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz) from public;
    revoke all on function publication_guard_api.record_verified_receipt(uuid,text,text,text) from public;
    revoke all on function publication_guard_api.revoke_release(uuid) from public;
    revoke all on function publication_guard_api.revoke_admission(uuid,text,text) from public;
  `);
}

function environment() {
  const password = 'store_password_abcdefghijklmnopqrstuvwxyz0123456789';
  return {
    VERCEL: '1',
    VERCEL_ENV: 'production',
    VERCEL_TARGET_ENV: 'production',
    VERCEL_PROJECT_ID: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7',
    VERCEL_GIT_PROVIDER: 'github',
    VERCEL_GIT_REPO_OWNER: 'usdimpact',
    VERCEL_GIT_REPO_SLUG: 'usd-impact-site',
    VERCEL_GIT_COMMIT_REF: 'main',
    VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
    PUBLICATION_GUARD_VERCEL_OAUTH_STORE_DATABASE_URL:
      `postgresql://${storeLogin}.edkdqncrreouzmxqeypm:${password}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require`,
    PUBLICATION_GUARD_PRODUCTION_READER_DATABASE_CA_CERT:
      `-----BEGIN CERTIFICATE-----\n${'A'.repeat(256)}\n-----END CERTIFICATE-----`,
    PUBLICATION_GUARD_VERCEL_OAUTH_STORE_KEY: '11'.repeat(32),
  };
}

try {
  await test('repository migration matches reviewed SQL candidate apart from comments', async () => {
    assert.equal(normalizeSql(sql), normalizeSql(candidateSql));
  });

  await installFixture(db);

  await test('migration applies to hardened fixture', () => db.exec(sql));

  await test('store roles have only intended role attributes', async () => {
    const rows = (await db.query(`
      select rolname, rolcanlogin, rolinherit, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
      from pg_roles
      where rolname in ('fx558_oauth_store','fx558_oauth_store_login')
      order by rolname
    `)).rows;
    assert.deepEqual(rows, [
      {
        rolname: 'fx558_oauth_store',
        rolcanlogin: false,
        rolinherit: false,
        rolsuper: false,
        rolcreaterole: false,
        rolcreatedb: false,
        rolreplication: false,
        rolbypassrls: false,
      },
      {
        rolname: 'fx558_oauth_store_login',
        rolcanlogin: true,
        rolinherit: true,
        rolsuper: false,
        rolcreaterole: false,
        rolcreatedb: false,
        rolreplication: false,
        rolbypassrls: false,
      },
    ]);
  });

  await test('membership inherits store privileges without SET or ADMIN capability', async () => {
    const row = (await db.query(`
      select m.admin_option, m.inherit_option, m.set_option
      from pg_auth_members m
      join pg_roles role on role.oid=m.roleid
      join pg_roles member on member.oid=m.member
      where role.rolname='fx558_oauth_store' and member.rolname='fx558_oauth_store_login'
    `)).rows[0];
    assert.deepEqual(row, { admin_option: false, inherit_option: true, set_option: false });
  });

  await test('future login remains passwordless after migration', async () => {
    const row = (await db.query(`
      select rolpassword is null as password_is_null
      from pg_authid
      where rolname='fx558_oauth_store_login'
    `)).rows[0];
    assert.equal(row.password_is_null, true);
  });

  await test('store table is private with forced RLS and no seeded row', async () => {
    const flags = (await db.query(`
      select relrowsecurity, relforcerowsecurity
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='publication_provider_credential' and c.relname='vercel_oauth_refresh_state'
    `)).rows[0];
    assert.deepEqual(flags, { relrowsecurity: true, relforcerowsecurity: true });
    const count = (await db.query(`select count(*)::int as count from ${storeTable}`)).rows[0].count;
    assert.equal(count, 0);
  });

  await test('login inherits schema usage but never schema create', async () => {
    const row = (await db.query(`
      select
        has_schema_privilege('${storeLogin}','publication_provider_credential','USAGE') as usage,
        has_schema_privilege('${storeLogin}','publication_provider_credential','CREATE') as create
    `)).rows[0];
    assert.deepEqual(row, { usage: true, create: false });
  });

  await test('SELECT is column-scoped across the complete ciphertext record', async () => {
    const row = (await db.query(`
      select
        has_table_privilege('${storeLogin}','${storeTable}','SELECT') as table_select,
        has_column_privilege('${storeLogin}','${storeTable}','singleton','SELECT') as singleton,
        has_column_privilege('${storeLogin}','${storeTable}','version','SELECT') as version,
        has_column_privilege('${storeLogin}','${storeTable}','key_fingerprint','SELECT') as key_fingerprint,
        has_column_privilege('${storeLogin}','${storeTable}','nonce','SELECT') as nonce,
        has_column_privilege('${storeLogin}','${storeTable}','ciphertext','SELECT') as ciphertext,
        has_column_privilege('${storeLogin}','${storeTable}','auth_tag','SELECT') as auth_tag,
        has_column_privilege('${storeLogin}','${storeTable}','updated_at','SELECT') as updated_at
    `)).rows[0];
    assert.deepEqual(row, {
      table_select: false,
      singleton: true,
      version: true,
      key_fingerprint: true,
      nonce: true,
      ciphertext: true,
      auth_tag: true,
      updated_at: true,
    });
  });

  await test('UPDATE is limited to CAS mutation columns only', async () => {
    const row = (await db.query(`
      select
        has_table_privilege('${storeLogin}','${storeTable}','UPDATE') as table_update,
        has_column_privilege('${storeLogin}','${storeTable}','singleton','UPDATE') as singleton,
        has_column_privilege('${storeLogin}','${storeTable}','key_fingerprint','UPDATE') as key_fingerprint,
        has_column_privilege('${storeLogin}','${storeTable}','version','UPDATE') as version,
        has_column_privilege('${storeLogin}','${storeTable}','nonce','UPDATE') as nonce,
        has_column_privilege('${storeLogin}','${storeTable}','ciphertext','UPDATE') as ciphertext,
        has_column_privilege('${storeLogin}','${storeTable}','auth_tag','UPDATE') as auth_tag,
        has_column_privilege('${storeLogin}','${storeTable}','updated_at','UPDATE') as updated_at
    `)).rows[0];
    assert.deepEqual(row, {
      table_update: false,
      singleton: false,
      key_fingerprint: false,
      version: true,
      nonce: true,
      ciphertext: true,
      auth_tag: true,
      updated_at: true,
    });
  });

  await test('login has no INSERT DELETE or TRUNCATE privilege', async () => {
    const row = (await db.query(`
      select
        has_any_column_privilege('${storeLogin}','${storeTable}','INSERT') as insert_any,
        has_table_privilege('${storeLogin}','${storeTable}','DELETE') as delete_table,
        has_table_privilege('${storeLogin}','${storeTable}','TRUNCATE') as truncate_table
    `)).rows[0];
    assert.deepEqual(row, { insert_any: false, delete_table: false, truncate_table: false });
  });

  await test('login has no Vault or publication-guard authority', async () => {
    const row = (await db.query(`
      select
        has_table_privilege('${storeLogin}','vault.secrets','SELECT') as vault_secrets,
        has_table_privilege('${storeLogin}','vault.decrypted_secrets','SELECT') as vault_decrypted,
        has_function_privilege('${storeLogin}','publication_guard_api.read_current_revision()','EXECUTE') as read_revision,
        has_function_privilege('${storeLogin}','publication_guard_api.read_snapshot(text,jsonb)','EXECUTE') as read_snapshot,
        has_function_privilege('${storeLogin}','publication_guard_api.authorize_release(uuid,text,text,text,text,timestamptz)','EXECUTE') as authorize_release,
        has_function_privilege('${storeLogin}','publication_guard_api.prepare_admission(uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz)','EXECUTE') as prepare_admission,
        has_function_privilege('${storeLogin}','publication_guard_api.record_verified_receipt(uuid,text,text,text)','EXECUTE') as record_receipt,
        has_function_privilege('${storeLogin}','publication_guard_api.revoke_release(uuid)','EXECUTE') as revoke_release,
        has_function_privilege('${storeLogin}','publication_guard_api.revoke_admission(uuid,text,text)','EXECUTE') as revoke_admission
    `)).rows[0];
    assert.deepEqual(row, {
      vault_secrets: false,
      vault_decrypted: false,
      read_revision: false,
      read_snapshot: false,
      authorize_release: false,
      prepare_admission: false,
      record_receipt: false,
      revoke_release: false,
      revoke_admission: false,
    });
  });

  await test('runtime login can read the empty store and update only allowed columns', async () => {
    await db.exec(`set role ${storeLogin}`);
    try {
      const selected = await db.query(`select version from ${storeTable}`);
      assert.equal(selected.rows.length, 0);
      const updated = await db.query(`
        update ${storeTable}
        set updated_at=transaction_timestamp()
        where singleton
        returning version
      `);
      assert.equal(updated.rows.length, 0);
      await assert.rejects(
        () => db.query(`update ${storeTable} set key_fingerprint=repeat('b',64) where singleton`),
        /permission denied/i,
      );
      await assert.rejects(
        () => db.query(`insert into ${storeTable} (version) values (0)`),
        /permission denied/i,
      );
    } finally {
      await db.exec('reset role');
    }
  });

  await test('runtime adapter accepts the exact migrated column privilege boundary', async () => {
    class RolePool {
      constructor() {}
      async query({ text, values = [] }) {
        await db.exec(`set role ${storeLogin}`);
        try { return await db.query(text, values); }
        finally { await db.exec('reset role'); }
      }
      async end() {}
    }
    const store = createPublicationProductionVercelOAuthStore({
      environment: environment(),
      PoolClass: RolePool,
    });
    try {
      const verified = await store.verifyIdentityAndPrivileges();
      assert.equal(verified.role, storeLogin);
      assert.equal(verified.storeSelect, true);
      assert.equal(verified.storeUpdate, true);
      assert.equal(verified.insertDeleteCreate, false);
      assert.equal(verified.vaultAccess, false);
      assert.equal(verified.publicationGuardAccess, false);
    } finally {
      await store.close();
    }
  });

  await test('migration is fail-closed against accidental double install', () =>
    rejects(db, sql, /HOLD_PRODUCTION_VERCEL_OAUTH_STORE_SCHEMA_PRESENT/));
} finally {
  await db.close();
}

console.log(`publication production Vercel OAuth store migration contract tests pass (${groups} groups; repository migration + exact column privileges + embedded PostgreSQL only)`);
