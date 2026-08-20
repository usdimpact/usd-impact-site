import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationDirectory = new URL('../../../supabase/migrations/', import.meta.url);
const expectedMigrationFiles = Object.freeze([
  '20260820131237_expand_launch_email_outbox_contracts.sql',
  '20260820131244_expand_launch_email_outbox_contracts.sql',
]);
const migrationFiles = (await readdir(migrationDirectory))
  .filter((name) => name.endsWith('_expand_launch_email_outbox_contracts.sql'))
  .sort();

assert.deepEqual(
  migrationFiles,
  expectedMigrationFiles,
  'Launch email migration source must match the exact Development ledger versions.',
);

const [allowlistMigration, hardeningMigration] = await Promise.all(
  expectedMigrationFiles.map((name) => readFile(new URL(name, migrationDirectory), 'utf8')),
);
const migrationChain = `${allowlistMigration}\n${hardeningMigration}`;

for (const migration of [allowlistMigration, hardeningMigration]) {
  assert.match(migration, /^begin;\s/i);
  assert.match(migration, /\scommit;\s*$/i);
  assert.match(migration, /set local lock_timeout = '5s';/i);
  assert.match(migration, /set local statement_timeout = '30s';/i);
  assert.match(
    migration,
    /alter table public\.notification_outbox\s+drop constraint notification_outbox_payload_contract;/i,
  );
  assert.match(
    migration,
    /alter table public\.notification_outbox\s+add constraint notification_outbox_payload_contract check \(/i,
  );
  assert.match(migration, /comment on constraint notification_outbox_payload_contract/i);
  assert.doesNotMatch(migration, /\b(?:insert|update|delete|truncate)\b/i);
  assert.doesNotMatch(migration, /\b(?:grant|revoke|security\s+definer)\b/i);
  assert.doesNotMatch(migration, /\b(?:SUPABASE|RESEND|OPENAI|PADDLE)_[A-Z0-9_]+\b/i);
  assert.doesNotMatch(migration, /sb_(?:secret|publishable)_/i);
  assert.doesNotMatch(migration, /bearer\s+[a-z0-9._-]+/i);
  assert.doesNotMatch(migration, /auth_sign_in/i);
}

const templateClassifications = Object.freeze({
  purchase_receipt: 'transactional',
  market_update: 'marketing',
  purchase_pending: 'transactional_operational',
  purchase_access_ready: 'transactional',
  purchase_failed: 'transactional_operational',
  refund_approved: 'transactional',
  dispute_warning: 'transactional_operational',
  chargeback_revoked: 'transactional',
  dispute_reversal_restored: 'transactional',
  privacy_export_acknowledgement: 'transactional_operational',
  account_deletion_requested: 'transactional_operational',
  account_deletion_completed: 'transactional_operational',
  support_case_received: 'operational',
  waitlist_confirmation: 'operational',
  book_availability: 'marketing',
});

for (const [templateId, classification] of Object.entries(templateClassifications)) {
  assert.match(migrationChain, new RegExp(`'${templateId}'`, 'i'));
  assert.match(migrationChain, new RegExp(`'${classification}'`, 'i'));
}

assert.doesNotMatch(allowlistMigration, /message_id = template_id/i);
assert.match(hardeningMigration, /message_id = template_id/i);
assert.match(
  hardeningMigration,
  /template_id = 'waitlist_confirmation'[\s\S]*?classification = 'operational'[\s\S]*?consent_required[\s\S]*?consent_record_id is not null[\s\S]*?consent_purpose = 'book_availability'[\s\S]*?consent_checked_at is not null[\s\S]*?payload = '\{\}'::jsonb/i,
);
assert.match(
  hardeningMigration,
  /template_id = 'book_availability'[\s\S]*?classification = 'marketing'[\s\S]*?consent_required[\s\S]*?consent_record_id is not null[\s\S]*?consent_purpose = 'book_availability'[\s\S]*?consent_checked_at is not null[\s\S]*?payload = '\{\}'::jsonb/i,
);
assert.match(
  hardeningMigration,
  /template_id = 'purchase_pending'[\s\S]*?classification = 'transactional_operational'[\s\S]*?not consent_required[\s\S]*?payload = '\{\}'::jsonb/i,
);
assert.match(
  hardeningMigration,
  /template_id = 'support_case_received'[\s\S]*?classification = 'operational'[\s\S]*?not consent_required[\s\S]*?payload = '\{\}'::jsonb/i,
);
assert.match(
  hardeningMigration,
  /template_id = 'purchase_receipt'[\s\S]*?and not consent_required[\s\S]*?consent_record_id is null[\s\S]*?payload \?& array\['amountCents', 'currency'\]/i,
);
assert.match(
  hardeningMigration,
  /template_id = 'market_update'[\s\S]*?classification = 'marketing'[\s\S]*?consent_required[\s\S]*?consent_record_id is not null[\s\S]*?payload \? 'editionId'/i,
);

console.log('Launch email outbox migration provenance tests passed.');
