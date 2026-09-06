import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL(
  '../../../supabase/migrations/20260830193000_harden_support_privacy_insert_integrity.sql',
  import.meta.url,
);
const researchPersistenceMigrationUrl = new URL(
  '../../../supabase/migrations/20260906004500_research_membership_transition_persistence.sql',
  import.meta.url,
);
const researchServiceRoleGrantsMigrationUrl = new URL(
  '../../../supabase/migrations/20260906180500_research_membership_service_role_grants.sql',
  import.meta.url,
);
const sql = await readFile(migrationUrl, 'utf8');
const researchPersistenceSql = await readFile(researchPersistenceMigrationUrl, 'utf8');
const researchServiceRoleGrantsSql = await readFile(researchServiceRoleGrantsMigrationUrl, 'utf8');

assert.match(sql, /^begin;/i);
assert.match(sql, /revoke insert on public\.support_requests from authenticated;/i);
assert.match(
  sql,
  /grant insert \(account_id, email, category, subject, message\)\s+on public\.support_requests\s+to authenticated;/i,
);
assert.match(sql, /drop policy if exists support_requests_insert_own/i);
assert.match(sql, /create policy support_requests_insert_own[\s\S]*?for insert[\s\S]*?to authenticated/i);
assert.match(sql, /account_id = \(select auth\.uid\(\)\)/i);
assert.match(sql, /p\.status = 'active'/i);
assert.match(sql, /p\.email = support_requests\.email/i);
for (const category of ['access', 'commerce', 'privacy', 'security', 'product', 'general']) {
  assert.match(sql, new RegExp(`'${category}'`, 'i'));
}
assert.match(sql, /char_length\(subject\) between 3 and 160/i);
assert.match(sql, /subject = btrim\(subject\)/i);
assert.match(sql, /char_length\(message\) between 10 and 5000/i);
assert.match(sql, /message = btrim\(message\)/i);
assert.match(sql, /revoke insert on public\.privacy_requests from authenticated;/i);
assert.match(sql, /drop policy if exists privacy_requests_insert_own/i);
assert.doesNotMatch(sql, /create policy privacy_requests_insert_own/i);
assert.match(sql, /has_column_privilege\([\s\S]*?'status'[\s\S]*?'INSERT'/i);
assert.match(sql, /has_column_privilege\([\s\S]*?'closed_at'[\s\S]*?'INSERT'/i);
assert.match(sql, /has_table_privilege\('authenticated', 'public\.privacy_requests', 'INSERT'\)/i);
assert.doesNotMatch(sql, /\b(?:insert into|update|delete from|truncate)\s+public\./i);
assert.doesNotMatch(sql, /usd-impact-production|gjzetjugmnwanvjkchux/i);
assert.match(sql, /commit;\s*$/i);

assert.match(researchPersistenceSql, /^begin;/i);
assert.match(researchPersistenceSql, /create or replace function public\.apply_research_membership_transition\(/i);
assert.match(researchPersistenceSql, /language plpgsql\s+security invoker\s+set search_path = public/i);
assert.match(researchPersistenceSql, /from public\.subscriptions[\s\S]*?for update;/i);
assert.match(researchPersistenceSql, /from public\.entitlements[\s\S]*?for update;/i);
assert.match(researchPersistenceSql, /insert into public\.subscription_events/i);
assert.match(researchPersistenceSql, /insert into public\.entitlement_events/i);
assert.match(researchPersistenceSql, /subscription state drift/i);
assert.match(researchPersistenceSql, /duplicate event key conflicts/i);
assert.match(researchPersistenceSql, /subscription product mismatch/i);
assert.match(researchPersistenceSql, /Research Membership entitlement subscription mismatch/i);
assert.match(
  researchPersistenceSql,
  /revoke all on function public\.apply_research_membership_transition\([\s\S]*?from public, anon, authenticated;/i,
);
assert.match(
  researchPersistenceSql,
  /grant execute on function public\.apply_research_membership_transition\([\s\S]*?to service_role;/i,
);
assert.doesNotMatch(researchPersistenceSql, /security\s+definer/i);
assert.doesNotMatch(researchPersistenceSql, /usd-impact-production|gjzetjugmnwanvjkchux/i);
assert.match(researchPersistenceSql, /commit;\s*$/i);

// This migration has a deliberately narrow SQL grammar. Ignore only full-line
// comments; unsupported syntax stays in the comparison and fails closed.
function assertResearchServiceRoleGrants(value) {
  const executableSql = value
    .split(/\r\n|\n|\r/)
    .filter((line) => !/^[ \t]*--/.test(line))
    .join('\n')
    .replace(/[ \t\r\n]+/g, ' ')
    .replace(/^ | $/g, '')
    .toLowerCase();
  assert.equal(executableSql, [
    'begin;',
    'grant select, update on table public.subscriptions to service_role;',
    'grant select, insert on table public.subscription_events to service_role;',
    'grant select, insert, update on table public.entitlements to service_role;',
    'grant insert on table public.entitlement_events to service_role;',
    'commit;',
  ].join(' '), 'Research persistence must contain exactly the approved grants');
}

assertResearchServiceRoleGrants(researchServiceRoleGrantsSql);
assertResearchServiceRoleGrants(`-- anon authenticated DELETE TRUNCATE are not granted\n${researchServiceRoleGrantsSql}`);
assertResearchServiceRoleGrants(researchServiceRoleGrantsSql.toUpperCase().replace(/\n/g, '\r\n'));
assert.doesNotMatch(researchServiceRoleGrantsSql, /usd-impact-production|gjzetjugmnwanvjkchux/i);

for (const statement of [
  'grant select on table public.subscriptions to anon;',
  'grant select on table public.subscriptions to authenticated;',
  'grant select on table public.subscriptions to public;',
  'grant all privileges on table public.subscriptions to service_role;',
  'grant delete on table public.subscriptions to service_role;',
  'grant truncate on table public.subscriptions to service_role;',
  'grant references on table public.subscriptions to service_role;',
  'grant trigger on table public.subscriptions to service_role;',
  'grant insert on table public.subscriptions to service_role;',
  'grant update on table public.subscription_events to service_role;',
  'grant select on table public.entitlement_events to service_role;',
  'grant select on table public.customers to service_role;',
  'grant usage on schema public to service_role;',
  'grant service_role to authenticated;',
  'grant select on table public.subscriptions to service_role with grant option;',
  'delete from public.subscriptions;',
  'truncate public.subscription_events;',
  'alter table public.subscriptions disable row level security;',
]) {
  assert.throws(
    () => assertResearchServiceRoleGrants(researchServiceRoleGrantsSql.replace(/commit;\s*$/i, `${statement}\ncommit;\n`)),
    assert.AssertionError,
    `Unexpected SQL must be rejected: ${statement}`,
  );
}
for (const statement of [
  'grant select, update on table public.subscriptions to service_role;',
  'grant select, insert on table public.subscription_events to service_role;',
  'grant select, insert, update on table public.entitlements to service_role;',
  'grant insert on table public.entitlement_events to service_role;',
]) {
  assert.throws(() => assertResearchServiceRoleGrants(researchServiceRoleGrantsSql.replace(statement, '')), assert.AssertionError);
  assert.throws(() => assertResearchServiceRoleGrants(researchServiceRoleGrantsSql.replace(statement, `-- ${statement}`)), assert.AssertionError);
}

await import('./test-research-membership-event-adapter.mjs');
await import('./test-research-membership-persistence.mjs');

console.log('Support/privacy and Research persistence migration contract tests passed.');
