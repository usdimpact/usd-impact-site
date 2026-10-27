import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migrations = [
  '20261019010000_score_handoff_tickets.sql',
  '20261019020000_score_member_sessions.sql',
  '20261019030000_score_handoff_account_indexes.sql',
  '20261027005205_score_member_assets_private_html.sql',
];
const migrationDirectory = new URL('../../../supabase/migrations/', import.meta.url);
const database = new PGlite();
const accountId = '00000000-0000-4000-8000-000000000001';

async function expectSqlError(operation, expectedMessage) {
  try {
    await operation();
    assert.fail(`Expected SQL error matching ${expectedMessage}.`);
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    assert.match(String(error?.message ?? error), expectedMessage);
  }
}

async function asRole(role, operation) {
  await database.exec(`set role ${role};`);
  try {
    return await operation();
  } finally {
    await database.exec('reset role;');
  }
}

try {
  await database.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;

    create schema auth;
    create table auth.users (
      id uuid primary key
    );

    create table public.profiles (
      account_id uuid primary key references auth.users(id) on delete cascade,
      status text not null,
      deleted_at timestamptz
    );

    create table public.entitlements (
      id uuid primary key,
      account_id uuid not null references auth.users(id) on delete cascade,
      product_id text not null,
      state text not null,
      starts_at timestamptz not null,
      ends_at timestamptz
    );

    grant select on public.profiles, public.entitlements to service_role;
  `);

  for (const name of migrations) {
    const sql = await readFile(new URL(name, migrationDirectory), 'utf8');
    await database.exec(sql);
  }

  const relations = await database.query(`
    select relname, relrowsecurity
    from pg_class
    where oid in (
      'public.score_handoff_tickets'::regclass,
      'public.score_member_sessions'::regclass,
      'public.score_member_assets'::regclass
    )
    order by relname;
  `);
  assert.deepEqual(relations.rows, [
    { relname: 'score_handoff_tickets', relrowsecurity: true },
    { relname: 'score_member_assets', relrowsecurity: true },
    { relname: 'score_member_sessions', relrowsecurity: true },
  ]);

  for (const role of ['anon', 'authenticated']) {
    await asRole(role, async () => {
      await expectSqlError(
        () => database.query('select * from public.score_handoff_tickets;'),
        /permission denied/i,
      );
      await expectSqlError(
        () => database.query('select * from public.score_member_sessions;'),
        /permission denied/i,
      );
      await expectSqlError(
        () => database.query('select * from public.score_member_assets;'),
        /permission denied/i,
      );
      await expectSqlError(
        () => database.query(
          `select public.score_membership_active('${accountId}'::uuid);`,
        ),
        /permission denied/i,
      );
    });
  }

  const functions = await database.query(`
    select proname, prosecdef,
      has_function_privilege('anon', p.oid, 'execute') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
      has_function_privilege('service_role', p.oid, 'execute') as service_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'score_ticket_issue_atomic',
        'score_ticket_consume_atomic',
        'score_membership_active',
        'score_session_create',
        'score_session_lookup'
      )
    order by proname;
  `);
  assert.equal(functions.rows.length, 5);
  for (const row of functions.rows) {
    assert.equal(row.prosecdef, false, row.proname + ' must remain SECURITY INVOKER');
    assert.equal(row.anon_execute, false, row.proname + ' anon execute');
    assert.equal(row.authenticated_execute, false, row.proname + ' authenticated execute');
    assert.equal(row.service_execute, true, row.proname + ' service_role execute');
  }

  const indexes = await database.query(`
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'score_handoff_tickets_expiry_idx',
        'score_handoff_tickets_account_id_idx',
        'score_member_sessions_expiry_idx',
        'score_member_sessions_account_id_idx'
      )
    order by indexname;
  `);
  assert.deepEqual(indexes.rows.map((row) => row.indexname), [
    'score_handoff_tickets_account_id_idx',
    'score_handoff_tickets_expiry_idx',
    'score_member_sessions_account_id_idx',
    'score_member_sessions_expiry_idx',
  ]);

  await asRole('service_role', async () => {
    await database.query(`
      insert into public.score_member_assets(path, content_type, body, source_commit, source_sha)
      values (
        '/en/', 'text/html; charset=utf-8', '<!doctype html><title>Score</title>',
        $1, $2
      );
    `, ['d'.repeat(40), 'e'.repeat(40)]);
    const asset = await database.query(`
      select path, content_type, source_commit, source_sha
      from public.score_member_assets
      where path = '/en/';
    `);
    assert.deepEqual(asset.rows, [{
      path: '/en/',
      content_type: 'text/html; charset=utf-8',
      source_commit: 'd'.repeat(40),
      source_sha: 'e'.repeat(40),
    }]);
  });

  await database.query('insert into auth.users(id) values ($1);', [accountId]);
  await database.query(
    `insert into public.profiles(account_id, status, deleted_at)
     values ($1, 'active', null);`,
    [accountId],
  );
  await database.query(
    `insert into public.entitlements(
       id, account_id, product_id, state, starts_at, ends_at
     ) values (
       '00000000-0000-4000-8000-000000000002'::uuid,
       $1, 'research-membership', 'active', now() - interval '1 minute',
       now() + interval '1 day'
     );`,
    [accountId],
  );

  const ticketDigest = 'a'.repeat(64);
  const issued = await asRole('service_role', () => database.query(`
    select public.score_ticket_issue_atomic(
      $1, $2::uuid, 'score.usd-impact.com', '/en/', now() + interval '30 seconds'
    ) as allowed;
  `, [ticketDigest, accountId]));
  assert.equal(issued.rows[0].allowed, true);

  const consumed = await asRole('service_role', () => database.query(`
    select public.score_ticket_consume_atomic($1) as record;
  `, [ticketDigest]));
  assert.equal(consumed.rows[0].record.account_id, accountId);
  assert.equal(consumed.rows[0].record.audience, 'score.usd-impact.com');
  assert.equal(consumed.rows[0].record.path, '/en/');

  const replay = await asRole('service_role', () => database.query(`
    select public.score_ticket_consume_atomic($1) as record;
  `, [ticketDigest]));
  assert.equal(replay.rows[0].record, null);

  const sessionDigest = 'b'.repeat(64);
  const sessionCreated = await asRole('service_role', () => database.query(`
    select public.score_session_create(
      $1, $2::uuid, now() + interval '5 minutes'
    ) as created;
  `, [sessionDigest, accountId]));
  assert.equal(sessionCreated.rows[0].created, true);

  const sessionAllowed = await asRole('service_role', () => database.query(`
    select public.score_session_lookup($1) as record;
  `, [sessionDigest]));
  assert.equal(sessionAllowed.rows[0].record.account_id, accountId);

  await database.query(
    `update public.entitlements
     set state = 'revoked'
     where account_id = $1 and product_id = 'research-membership';`,
    [accountId],
  );

  const revoked = await asRole('service_role', () => database.query(`
    select public.score_session_lookup($1) as record;
  `, [sessionDigest]));
  assert.equal(revoked.rows[0].record, null);

  const newSessionWhileRevoked = await asRole('service_role', () => database.query(`
    select public.score_session_create(
      $1, $2::uuid, now() + interval '5 minutes'
    ) as created;
  `, ['c'.repeat(64), accountId]));
  assert.equal(newSessionWhileRevoked.rows[0].created, false);

  console.log('Score Production migration integration contract passed.');
} finally {
  await database.close();
}
