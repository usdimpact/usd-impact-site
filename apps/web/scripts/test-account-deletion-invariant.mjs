import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = JSON.parse(
  fs.readFileSync(
    new URL('../../../docs/operations/hardening-account-deletion-invariant-2026-10-23.json', import.meta.url),
    'utf8',
  ),
);
const migration = fs.readFileSync(
  new URL('../../../supabase/migrations/20260812180308_harden_account_rpcs.sql', import.meta.url),
  'utf8',
);

assert.equal(manifest.version, 1);
assert.equal(manifest.status, 'read_only_attested');
assert.equal(manifest.function, 'public.request_account_deletion()');
assert.equal(manifest.intended_role, 'authenticated');
assert.equal(manifest.invariants.public_or_anon_execute_allowed, false);
assert.equal(manifest.invariants.service_role_execute_allowed, false);
assert.equal(manifest.invariants.caller_identity_from_auth_uid, true);
assert.equal(manifest.invariants.empty_search_path_required, true);
assert.equal(manifest.invariants.production_mutation_authorized, false);
assert.equal(manifest.invariants.function_rewrite_authorized, false);

for (const [environment, state] of Object.entries(manifest.projects)) {
  assert.equal(state.security_definer, true, `${environment}: intentional SECURITY DEFINER invariant changed`);
  assert.equal(state.search_path, '', `${environment}: search_path must remain empty`);
  assert.equal(state.anon_execute, false, `${environment}: anon must not execute deletion RPC`);
  assert.equal(state.authenticated_execute, true, `${environment}: authenticated execution must remain available`);
  assert.equal(state.service_role_execute, false, `${environment}: service_role direct execution is not part of the customer boundary`);
  assert.equal(state.references_auth_uid, true, `${environment}: caller identity must remain auth.uid()-derived`);
}

const start = migration.indexOf('create or replace function public.request_account_deletion()');
assert.ok(start >= 0, 'Hardened request_account_deletion definition is missing');
const sql = migration.slice(start);

assert.match(sql, /language plpgsql[\s\S]*security definer/i);
assert.match(sql, /set search_path = ''/i);
assert.match(sql, /caller_account_id uuid := auth\.uid\(\)/i);
assert.match(sql, /if caller_account_id is null then[\s\S]*authentication is required/i);
assert.match(sql, /where account_id = caller_account_id[\s\S]*and status = 'active'/i);
assert.match(
  sql,
  /revoke all on function public\.request_account_deletion\(\)[\s\S]*from public, anon, authenticated, service_role;/i,
);
assert.match(
  sql,
  /grant execute on function public\.request_account_deletion\(\) to authenticated;/i,
);
assert.doesNotMatch(
  sql,
  /grant\s+execute\s+on\s+function\s+public\.request_account_deletion\(\)\s+to\s+[^;]*\b(?:public|anon|service_role)\b/i,
);

console.log('Account deletion SECURITY DEFINER attestation contract passed.');
