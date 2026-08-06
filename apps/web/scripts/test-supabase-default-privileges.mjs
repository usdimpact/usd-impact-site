import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(
  new URL('../../../supabase/migrations/20260805194908_secure_future_public_object_defaults.sql', import.meta.url),
  'utf8',
);

assert.match(migration, /^begin;\s/i);
assert.match(migration, /\scommit;\s*$/i);

assert.match(
  migration,
  /alter default privileges for role postgres in schema public\s+revoke select, insert, update, delete on tables\s+from anon, authenticated, service_role;/i,
);
assert.match(
  migration,
  /alter default privileges for role postgres in schema public\s+revoke usage, select, update on sequences\s+from anon, authenticated, service_role;/i,
);
assert.match(
  migration,
  /alter default privileges for role postgres\s+revoke execute on functions\s+from public, anon, authenticated, service_role;/i,
);
assert.doesNotMatch(
  migration,
  /alter default privileges for role postgres in schema public\s+revoke execute on functions/i,
);

assert.match(migration, /namespace\.nspname = 'public'/i);
assert.match(migration, /relation\.relkind in \('r', 'p'\)/i);
assert.match(migration, /not relation\.relrowsecurity/i);
assert.match(migration, /raise exception 'public tables without row-level security: %'/i);

assert.doesNotMatch(migration, /revoke all on all tables in schema public/i);
assert.doesNotMatch(migration, /\b(?:grant|revoke)\b[^;]*\bon\s+(?:table|function|sequence)\s+public\./i);
assert.doesNotMatch(migration, /\b(?:drop|truncate|delete|update|insert)\b\s+(?:table\s+)?public\./i);

console.log('Supabase future-object default privilege tests passed.');
