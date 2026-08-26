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
const sql = await readFile(migrationUrl, 'utf8');
const indexSql = await readFile(indexMigrationUrl, 'utf8');

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
