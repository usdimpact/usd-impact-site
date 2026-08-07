import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(
  new URL('../../../supabase/diagnostics/public_metadata_snapshot.sql', import.meta.url),
  'utf8',
);

const withoutComments = sql.replace(/--.*$/gm, '');
const withoutStrings = withoutComments.replace(/'(?:''|[^'])*'/g, "''");

assert.match(
  withoutStrings,
  /^\s*begin\s+transaction\s+isolation\s+level\s+repeatable\s+read\s+read\s+only\s*;/i,
);
assert.match(withoutStrings, /set\s+local\s+statement_timeout\s*=/i);
assert.match(withoutStrings, /set\s+local\s+lock_timeout\s*=/i);
assert.match(withoutStrings, /\brollback\s*;\s*$/i);

assert.doesNotMatch(
  withoutStrings,
  /\b(?:insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|copy|call|do|vacuum|analyze|reindex|cluster|refresh|lock)\b/i,
);
assert.doesNotMatch(withoutStrings, /\b(?:public|auth|storage|supabase_migrations)\s*\./i);

for (const catalog of [
  'pg_namespace',
  'pg_class',
  'pg_attribute',
  'pg_attrdef',
  'pg_constraint',
  'pg_type',
  'pg_enum',
  'pg_proc',
  'pg_language',
  'pg_trigger',
  'pg_policy',
  'pg_index',
  'pg_sequence',
  'pg_extension',
  'pg_default_acl',
]) {
  assert.match(withoutStrings, new RegExp(`pg_catalog\\.${catalog}\\b`, 'i'));
}

for (const requiredField of [
  'row_security_enabled',
  'row_security_forced',
  'security_definer',
  'configuration',
  'definition',
  'using_expression',
  'check_expression',
  'default_privileges',
]) {
  assert.match(sql, new RegExp(`\\b${requiredField}\\b`, 'i'));
}

assert.match(sql, /pg_get_functiondef\s*\(/i);
assert.match(sql, /pg_get_triggerdef\s*\(/i);
assert.match(sql, /pg_get_constraintdef\s*\(/i);
assert.match(sql, /pg_get_indexdef\s*\(/i);
assert.match(sql, /pg_catalog\.acldefault\s*\(/i);
assert.match(
  sql,
  /pg_catalog\.acldefault\(\s*case\s+when\s+relation\.relkind\s*=\s*'S'\s+then\s+'s'::"char"\s+else\s+'r'::"char"\s+end,\s*relation\.relowner\s*\)/,
);
assert.doesNotMatch(
  sql,
  /when\s+relation\.relkind\s*=\s*'S'\s+then\s+'S'/,
);
assert.match(sql, /jsonb_agg\s*\([^)]*order\s+by/is);
assert.doesNotMatch(sql, /current_timestamp|clock_timestamp|now\s*\(/i);

console.log('Supabase metadata snapshot safety tests passed.');
