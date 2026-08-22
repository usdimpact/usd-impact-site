import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../../../supabase/migrations/20260822143000_daily_card_dispatches.sql', import.meta.url), 'utf8');

assert.match(sql, /create table if not exists public\.daily_card_dispatches/i);
assert.match(sql, /unique \(publish_date, card_id, channel, destination_hash\)/i);
assert.match(sql, /alter table public\.daily_card_dispatches enable row level security/i);
assert.match(sql, /revoke all on table public\.daily_card_dispatches from public, anon, authenticated/i);
assert.match(sql, /grant select, insert, update on table public\.daily_card_dispatches to service_role/i);
assert.match(sql, /create or replace function public\.claim_daily_card_dispatch/i);
assert.match(sql, /on conflict \(publish_date, card_id, channel, destination_hash\) do nothing/i);
assert.match(sql, /'payload_mismatch'::text/i);
assert.match(sql, /revoke all on function public\.claim_daily_card_dispatch\(date, text, text, text, text\) from public, anon, authenticated/i);
assert.match(sql, /grant execute on function public\.claim_daily_card_dispatch\(date, text, text, text, text\) to service_role/i);
assert.doesNotMatch(sql, /grant .* to anon/i);
assert.doesNotMatch(sql, /grant .* to authenticated/i);

console.log('Daily Card dispatch ledger RLS and at-most-once claim contract verified.');
