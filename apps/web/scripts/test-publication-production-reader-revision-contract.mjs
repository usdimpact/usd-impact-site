import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

let groups = 0;
const pass = () => { groups += 1; };
const migrationUrl = new URL('../../../supabase/migrations/20260915134556_publication_production_reader_revision_558.sql', import.meta.url);
const candidateUrl = new URL('../docs/sql/publication-production-reader-revision-contract-558.sql', import.meta.url);
const [sql, candidateSql] = await Promise.all([
  readFile(migrationUrl, 'utf8'),
  readFile(candidateUrl, 'utf8'),
]);
const normalizeSql = (value) => value.split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .trim();
const db = new PGlite();

async function test(name, work) {
  try { await work(); pass(); }
  catch (error) { console.error(`Failed production reader revision contract: ${name}`); throw error; }
}

async function rejects(target, text, pattern) {
  await assert.rejects(() => target.exec(text), (error) => pattern.test(error.message));
}

async function installFixture(target, membershipOptions) {
  await target.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create role fx558_reader_owner nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication noinherit;
    create role fx558_reader nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication noinherit;
    create role fx558_reader_login login inherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication connection limit 4;
    grant fx558_reader to fx558_reader_login;

    create schema publication_guard;
    create schema publication_guard_api;
    revoke all on schema publication_guard from public, anon, authenticated, service_role, fx558_reader, fx558_reader_login;
    revoke all on schema publication_guard_api from public, anon, authenticated, service_role, fx558_reader_login;

    create table publication_guard.history_state (
      singleton boolean primary key default true check (singleton),
      revision bigint not null default 0 check (revision >= 0)
    );
    insert into publication_guard.history_state values (true, 0);
    revoke all on publication_guard.history_state from public, anon, authenticated, service_role, fx558_reader, fx558_reader_login;

    grant usage on schema publication_guard to fx558_reader_owner;
    grant usage on schema publication_guard_api to fx558_reader_owner, fx558_reader;
    grant select on publication_guard.history_state to fx558_reader_owner;
    grant fx558_reader_owner to postgres with ${membershipOptions};
  `);
}

try {
  await test('repository migration matches reviewed SQL candidate apart from comments', async () => {
    assert.equal(normalizeSql(sql), normalizeSql(candidateSql));
  });

  await installFixture(db, 'admin true, inherit false, set false');

  await test('hosted-style inert postgres membership is present in fixture', async () => {
    const row = (await db.query(`
      select m.admin_option, m.inherit_option, m.set_option
      from pg_auth_members m
      join pg_roles role on role.oid=m.roleid
      join pg_roles member on member.oid=m.member
      where role.rolname='fx558_reader_owner' and member.rolname='postgres'
    `)).rows[0];
    assert.deepEqual(row, { admin_option: true, inherit_option: false, set_option: false });
  });

  await test('migration applies with hosted-style inert postgres membership', () => db.exec(sql));

  await test('function is stable security-definer owned by reader owner', async () => {
    const row = (await db.query(`
      select p.prosecdef, p.provolatile, o.rolname as owner
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      join pg_roles o on o.oid=p.proowner
      where n.nspname='publication_guard_api' and p.proname='read_current_revision'
    `)).rows[0];
    assert.deepEqual(row, { prosecdef: true, provolatile: 's', owner: 'fx558_reader_owner' });
  });

  await test('runtime reader can discover revision without direct table access', async () => {
    await db.exec('set role fx558_reader_login');
    try {
      const revision = (await db.query('select publication_guard_api.read_current_revision() as value')).rows[0].value;
      assert.equal(revision, '0');
      await assert.rejects(() => db.query('select revision from publication_guard.history_state'), /permission denied/i);
    } finally {
      await db.exec('reset role');
    }
  });

  await test('revision primitive reflects later history head exactly', async () => {
    await db.exec('update publication_guard.history_state set revision=7 where singleton');
    await db.exec('set role fx558_reader_login');
    try {
      const revision = (await db.query('select publication_guard_api.read_current_revision() as value')).rows[0].value;
      assert.equal(revision, '7');
    } finally {
      await db.exec('reset role');
    }
  });

  for (const role of ['anon', 'authenticated', 'service_role']) {
    await test(`${role} cannot execute current-revision primitive`, async () => {
      await db.exec(`set role ${role}`);
      try {
        await assert.rejects(() => db.query('select publication_guard_api.read_current_revision()'), /permission denied/i);
      } finally {
        await db.exec('reset role');
      }
    });
  }

  await test('reader login has no direct history table SELECT privilege', async () => {
    const row = (await db.query(`select has_table_privilege('fx558_reader_login','publication_guard.history_state','SELECT') as value`)).rows[0];
    assert.equal(row.value, false);
  });

  await test('temporary reader-owner schema CREATE privilege is removed', async () => {
    const row = (await db.query(`select has_schema_privilege('fx558_reader_owner','publication_guard_api','CREATE') as value`)).rows[0];
    assert.equal(row.value, false);
  });

  await test('ownership transfer leaves no effective postgres membership', async () => {
    const row = (await db.query(`
      select count(*) filter (where m.inherit_option or m.set_option)::int as effective
      from pg_auth_members m
      join pg_roles role on role.oid=m.roleid
      join pg_roles member on member.oid=m.member
      where role.rolname='fx558_reader_owner' and member.rolname='postgres'
    `)).rows[0];
    assert.equal(row.effective, 0);
  });

  await test('migration fails closed on effective postgres owner membership', async () => {
    const driftDb = new PGlite();
    try {
      await installFixture(driftDb, 'admin true, inherit true, set false');
      await rejects(driftDb, sql, /HOLD_PRODUCTION_REVISION_EFFECTIVE_OWNER_MEMBERSHIP/);
    } finally {
      await driftDb.close();
    }
  });

  await test('migration is fail-closed against accidental double install', () => rejects(db, sql, /HOLD_PRODUCTION_REVISION_ALREADY_PRESENT/));
} finally {
  await db.close();
}

console.log(`publication production reader revision contract tests pass (${groups} groups; repository migration + hosted-membership fixture + embedded PostgreSQL only)`);
