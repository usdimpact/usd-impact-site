import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL(
  '../../../supabase/migrations/20260826170000_commerce_reconciliation_runtime.sql',
  import.meta.url,
);
const indexMigrationUrl = new URL(
  '../../../supabase/migrations/20260826173000_commerce_reconciliation_purchase_intent_index.sql',
  import.meta.url,
);
const aclHardeningMigrationUrl = new URL(
  '../../../supabase/migrations/20260826174600_harden_public_table_defaults_and_commerce_acl.sql',
  import.meta.url,
);
const profileLockFixMigrationUrl = new URL(
  '../../../supabase/migrations/20260826205741_fix_commerce_profile_lock_privilege.sql',
  import.meta.url,
);
const terminalReplayMigrationUrl = new URL(
  '../../../supabase/migrations/20260826230126_allow_terminal_commerce_webhook_replay_delivery_variance.sql',
  import.meta.url,
);
const sql = await readFile(migrationUrl, 'utf8');
const indexSql = await readFile(indexMigrationUrl, 'utf8');
const aclHardeningSql = await readFile(aclHardeningMigrationUrl, 'utf8');
const profileLockFixSql = await readFile(profileLockFixMigrationUrl, 'utf8');
const terminalReplaySql = await readFile(terminalReplayMigrationUrl, 'utf8');

assert.match(sql, /create table if not exists public\.commerce_reconciliations/i);
assert.match(sql, /alter table public\.commerce_reconciliations enable row level security;/i);
assert.match(sql, /revoke all on public\.commerce_reconciliations from anon, authenticated;/i);
assert.match(sql, /grant select, insert, update on public\.commerce_reconciliations to service_role;/i);
assert.match(sql, /where disposition = 'tracking' and next_reconcile_at is not null/i);

assert.match(indexSql, /^begin;/i);
assert.match(
  indexSql,
  /create index if not exists commerce_reconciliations_purchase_intent_idx\s+on public\.commerce_reconciliations\(purchase_intent_id\);/i,
);
assert.match(indexSql, /commit;\s*$/i);
assert.doesNotMatch(indexSql, /\b(?:insert|update|delete|alter table|drop|grant|revoke)\b/i);

assert.match(aclHardeningSql, /^begin;/i);
assert.match(
  aclHardeningSql,
  /alter default privileges for role postgres in schema public\s+revoke all on tables\s+from public, anon, authenticated, service_role;/i,
);
assert.match(
  aclHardeningSql,
  /revoke all on public\.commerce_reconciliations\s+from public, anon, authenticated, service_role;/i,
);
assert.match(
  aclHardeningSql,
  /grant select, insert, update on public\.commerce_reconciliations to service_role;/i,
);
assert.match(aclHardeningSql, /pg_default_acl/i);
assert.match(aclHardeningSql, /aclexplode/i);
assert.match(aclHardeningSql, /defaults\.defaclobjtype = 'r'/i);
assert.match(aclHardeningSql, /grantee\.rolname in \('anon', 'authenticated', 'service_role'\)/i);
assert.match(aclHardeningSql, /acl\.privilege_type not in \('SELECT', 'INSERT', 'UPDATE'\)/i);
assert.match(aclHardeningSql, /has_table_privilege\([\s\S]*?'service_role'[\s\S]*?'public\.commerce_reconciliations'/i);
assert.match(aclHardeningSql, /commit;\s*$/i);
assert.doesNotMatch(aclHardeningSql, /\b(?:insert into|update\s+public\.|delete from|drop\s+(?:table|function|schema)|create\s+(?:table|function|schema)|security\s+definer)\b/i);
assert.doesNotMatch(aclHardeningSql, /grant[^;]+to\s+(?:public|anon|authenticated)/i);
assert.doesNotMatch(aclHardeningSql, /usd-impact-production|gjzetjugmnwanvjkchux/i);

assert.match(profileLockFixSql, /^begin;/i);
assert.match(profileLockFixSql, /create or replace function public\.reserve_commerce_purchase_intent\(/i);
assert.match(profileLockFixSql, /language plpgsql\s+security invoker\s+set search_path = public/i);
assert.match(
  profileLockFixSql,
  /select \* into v_profile\s+from public\.profiles\s+where account_id = p_account_id;/i,
);
assert.doesNotMatch(
  profileLockFixSql,
  /select \* into v_profile\s+from public\.profiles\s+where account_id = p_account_id\s+for update;/i,
);
assert.match(
  profileLockFixSql,
  /select state into v_entitlement_state[\s\S]*?from public\.entitlements[\s\S]*?for update;/i,
);
assert.match(
  profileLockFixSql,
  /select \* into v_open[\s\S]*?from public\.purchase_intents[\s\S]*?for update;/i,
);
assert.match(
  profileLockFixSql,
  /select \* into v_offer[\s\S]*?from public\.product_offers[\s\S]*?for update;/i,
);
assert.match(
  profileLockFixSql,
  /revoke all on function public\.reserve_commerce_purchase_intent\(uuid, text, timestamptz\)[\s\S]*?from public, anon, authenticated;/i,
);
assert.match(
  profileLockFixSql,
  /grant execute on function public\.reserve_commerce_purchase_intent\(uuid, text, timestamptz\)[\s\S]*?to service_role;/i,
);
assert.match(
  profileLockFixSql,
  /has_table_privilege\('service_role', 'public\.profiles', 'UPDATE'\)/i,
);
assert.doesNotMatch(profileLockFixSql, /grant\s+update\s+on\s+public\.profiles/i);
assert.doesNotMatch(profileLockFixSql, /security\s+definer/i);
assert.doesNotMatch(profileLockFixSql, /usd-impact-production|gjzetjugmnwanvjkchux/i);
assert.match(profileLockFixSql, /commit;\s*$/i);

assert.match(terminalReplaySql, /^begin;/i);
assert.match(
  terminalReplaySql,
  /create or replace function public\.begin_commerce_webhook_receipt\(\s*p_provider text,\s*p_provider_event_id text,\s*p_event_type text,\s*p_payload_sha256 text\s*\)/i,
);
assert.match(terminalReplaySql, /language plpgsql\s+security invoker\s+set search_path = public/i);
const terminalDuplicateStart = terminalReplaySql.indexOf("if v_receipt.status in ('processed', 'ignored') then");
const replayHashMismatchStart = terminalReplaySql.indexOf('elsif v_receipt.payload_sha256 <> p_payload_sha256 then');
const nonTerminalRetryUpdateStart = terminalReplaySql.indexOf('update public.webhook_receipts', replayHashMismatchStart);
assert.ok(
  terminalDuplicateStart > 0
  && replayHashMismatchStart > terminalDuplicateStart
  && nonTerminalRetryUpdateStart > replayHashMismatchStart,
);
const terminalDuplicateBlock = terminalReplaySql.slice(terminalDuplicateStart, replayHashMismatchStart);
assert.match(terminalDuplicateBlock, /v_should_process := false;/i);
assert.doesNotMatch(terminalDuplicateBlock, /\b(?:update|insert|delete)\b/i);
const nonTerminalHashMismatchBlock = terminalReplaySql.slice(replayHashMismatchStart, nonTerminalRetryUpdateStart);
assert.match(nonTerminalHashMismatchBlock, /webhook replay payload hash mismatch/i);
assert.match(nonTerminalHashMismatchBlock, /errcode = '42501'/i);
assert.match(
  terminalReplaySql,
  /revoke all on function public\.begin_commerce_webhook_receipt\(text, text, text, text\)[\s\S]*?from public, anon, authenticated;/i,
);
assert.match(
  terminalReplaySql,
  /grant execute on function public\.begin_commerce_webhook_receipt\(text, text, text, text\)[\s\S]*?to service_role;/i,
);
assert.doesNotMatch(terminalReplaySql, /security\s+definer/i);
assert.doesNotMatch(terminalReplaySql, /usd-impact-production|gjzetjugmnwanvjkchux/i);
assert.match(terminalReplaySql, /commit;\s*$/i);

assert.doesNotMatch(sql, /security\s+definer/i);
assert.ok((sql.match(/security\s+invoker/gi) ?? []).length >= 7);
assert.doesNotMatch(sql, /grant\s+execute[^;]+to\s+(?:public|anon|authenticated)/i);

for (const functionName of [
  'reserve_commerce_purchase_intent',
  'attach_commerce_checkout',
  'begin_commerce_webhook_receipt',
  'finish_commerce_webhook_receipt',
  'complete_commerce_purchase',
  'apply_commerce_reconciliation',
  'record_commerce_reconciliation_failure',
]) {
  assert.match(sql, new RegExp(`create or replace function public\\.${functionName}\\(`, 'i'));
  assert.match(sql, new RegExp(`revoke all on function public\\.${functionName}\\([\\s\\S]*?from public, anon, authenticated;`, 'i'));
  assert.match(sql, new RegExp(`grant execute on function public\\.${functionName}\\([\\s\\S]*?to service_role;`, 'i'));
}

const refundStart = sql.indexOf("elsif p_provider_status = 'refunded' then");
const fraudStart = sql.indexOf("elsif p_provider_status = 'fraudulent' then");
const partialStart = sql.indexOf("elsif p_provider_status = 'partial_refund' then");
const trailingElse = sql.indexOf('\n  else\n', partialStart);
assert.ok(refundStart > 0 && fraudStart > refundStart && partialStart > fraudStart && trailingElse > partialStart);

const refundBlock = sql.slice(refundStart, fraudStart);
assert.match(refundBlock, /update public\.purchases[\s\S]*status = 'refunded'/i);
assert.match(refundBlock, /update public\.entitlements[\s\S]*state = 'refunded'/i);
assert.match(refundBlock, /p_refunded_amount_cents <> v_purchase\.total_cents/i);

const fraudBlock = sql.slice(fraudStart, partialStart);
assert.match(fraudBlock, /state = 'revoked'/i);
assert.match(fraudBlock, /payment\.revoked/i);
assert.doesNotMatch(fraudBlock, /charged_back/i);
assert.doesNotMatch(fraudBlock, /update public\.purchases/i);

const partialBlock = sql.slice(partialStart, trailingElse);
assert.match(partialBlock, /full refunds only/i);
assert.match(partialBlock, /v_disposition := 'review'/i);
assert.doesNotMatch(partialBlock, /update public\.(?:purchases|entitlements)/i);
assert.doesNotMatch(partialBlock, /insert into public\.entitlement_events/i);

assert.match(sql, /paid provider state conflicts with terminal or non-active local state; no automatic restoration/i);
assert.match(sql, /no synthetic chargeback transition/i);
assert.match(sql, /provider_event_id,[\s\S]*?p_event_id,/i);
assert.match(sql, /unique \(provider, provider_transaction_id\)/i);
assert.match(sql, /unique \(purchase_id\)/i);

assert.match(sql, /idempotency key is no longer reusable/i);
assert.match(sql, /v_existing\.status not in \('pending', 'checkout_created', 'failed'\)/i);
assert.match(sql, /v_existing\.expires_at <= p_now/i);

console.log('Commerce reconciliation migration contract tests passed.');
