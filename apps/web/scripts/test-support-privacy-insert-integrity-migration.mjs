import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL(
  '../../../supabase/migrations/20260830193000_harden_support_privacy_insert_integrity.sql',
  import.meta.url,
);
const sql = await readFile(migrationUrl, 'utf8');

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

console.log('Support/privacy insert-integrity migration contract tests passed.');
