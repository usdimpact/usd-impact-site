import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationDirectory = new URL('../../../supabase/migrations/', import.meta.url);
const migrationName = '20260819215648_email_consent_outbox_contracts.sql';
const migration = await readFile(new URL(migrationName, migrationDirectory), 'utf8');
const migrationFiles = (await readdir(migrationDirectory))
  .filter((name) => name.endsWith('.sql'))
  .sort();
const migrationChain = (
  await Promise.all(migrationFiles.map((name) => readFile(new URL(name, migrationDirectory), 'utf8')))
).join('\n');

assert.match(migration, /^begin;\s/i);
assert.match(migration, /\scommit;\s*$/i);

for (const table of ['marketing_consent_events', 'notification_outbox']) {
  assert.match(migration, new RegExp(`create table public\\.${table} \\(`, 'i'));
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`, 'i'));
  assert.match(
    migration,
    new RegExp(`revoke all on table public\\.${table}\\s+from public, anon, authenticated, service_role;`, 'i'),
  );
  assert.doesNotMatch(
    migrationChain,
    new RegExp(`create policy [^;]+ on public\\.${table}`, 'i'),
    `${table} must remain inaccessible to browser roles`,
  );
  assert.doesNotMatch(
    migrationChain,
    new RegExp(`grant [^;]+ on (?:table )?public\\.${table} to (?:anon|authenticated|public)`, 'i'),
    `${table} has an unreviewed browser grant`,
  );
}

assert.match(
  migration,
  /grant select on table public\.marketing_consent_events to service_role;/i,
);
assert.match(
  migration,
  /grant insert \([\s\S]*?idempotency_key,[\s\S]*?evidence_checksum[\s\S]*?\) on table public\.marketing_consent_events to service_role;/i,
);
assert.doesNotMatch(
  migration,
  /grant\s+(?:[^;]*\b)?(?:update|delete|truncate)(?:\b[^;]*)?on table public\.marketing_consent_events/i,
  'The consent ledger must be append-only for service-role application code',
);
assert.match(
  migration,
  /grant select on table public\.notification_outbox to service_role;/i,
);
assert.match(
  migration,
  /grant insert \([\s\S]*?idempotency_key,[\s\S]*?next_attempt_at[\s\S]*?\) on table public\.notification_outbox to service_role;/i,
);
assert.match(
  migration,
  /grant update \([\s\S]*?status,[\s\S]*?attempt_count,[\s\S]*?updated_at[\s\S]*?\) on table public\.notification_outbox to service_role;/i,
);
assert.doesNotMatch(
  migration,
  /grant\s+(?:[^;]*\b)?delete(?:\b[^;]*)?on table public\.notification_outbox/i,
  'The outbox must retain delivery evidence',
);

assert.match(migration, /constraint marketing_consent_events_idempotency_key_unique unique \(idempotency_key\)/i);
assert.match(migration, /constraint marketing_consent_events_withdrawal_relationship check/i);
assert.match(migration, /validate_marketing_consent_event_reference\(\)/i);
assert.match(migration, /withdrawal must reference a matching consent grant/i);
assert.match(migration, /source_event_id text not null/i);
assert.match(migration, /status text not null/i);
assert.match(migration, /captured_at timestamptz not null/i);
assert.match(migration, /withdrawn_at timestamptz/i);
assert.match(migration, /withdrawal_source text/i);
assert.match(migration, /evidence_checksum text not null/i);
assert.match(migration, /constraint marketing_consent_events_evidence_contract check/i);
assert.match(migration, /'campaignId',[\s\S]*?'consentCheckbox',[\s\S]*?'formVersion',[\s\S]*?'request'/i);
assert.match(migration, /constraint marketing_consent_events_evidence_checksum_format check/i);
assert.match(migration, /references auth\.users\(id\) on delete set null/i);
assert.match(migration, /marketing_consent_events_email_purpose_captured_idx/i);
assert.match(migration, /marketing_consent_events_user_id_idx/i);
assert.match(migration, /marketing_consent_events_related_grant_id_idx/i);

assert.match(migration, /constraint notification_outbox_idempotency_key_unique unique \(idempotency_key\)/i);
assert.match(migration, /constraint notification_outbox_business_state_unique unique \([\s\S]*?message_id,[\s\S]*?state_version,[\s\S]*?recipient_email_normalized[\s\S]*?\)/i);
assert.match(migration, /constraint notification_outbox_marketing_consent_required check/i);
assert.match(migration, /constraint notification_outbox_consent_reference_complete check/i);
assert.match(migration, /constraint notification_outbox_consent_checked_fresh check/i);
assert.match(migration, /validate_notification_outbox_consent_reference\(\)/i);
assert.match(migration, /notification must reference an active matching consent grant/i);
assert.match(migration, /constraint notification_outbox_payload_object check/i);
assert.match(migration, /constraint notification_outbox_payload_contract check/i);
for (const templateId of ['purchase_receipt', 'market_update', 'waitlist_confirmation']) {
  assert.match(migration, new RegExp(`template_id = '${templateId}'`, 'i'));
}
assert.match(migration, /notification_outbox_dispatch_idx[\s\S]*?where status in \('queued', 'retry_scheduled'\)/i);
assert.match(migration, /notification_outbox_consent_record_id_idx/i);

assert.doesNotMatch(migration, /security\s+definer/i);
assert.match(migration, /security\s+invoker/gi);
assert.match(
  migration,
  /revoke execute on function public\.validate_marketing_consent_event_reference\(\)[\s\S]*?from public, anon, authenticated, service_role;/i,
);
assert.match(
  migration,
  /revoke execute on function public\.validate_notification_outbox_consent_reference\(\)[\s\S]*?from public, anon, authenticated, service_role;/i,
);
assert.doesNotMatch(migration, /\b(?:SUPABASE|RESEND|OPENAI)_[A-Z0-9_]+\b/i);
assert.doesNotMatch(migration, /sb_(?:secret|publishable)_/i);
assert.doesNotMatch(migration, /bearer\s+[a-z0-9._-]+/i);

console.log('Supabase email readiness migration contract tests passed.');
