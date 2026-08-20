import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationDirectory = new URL('../../../supabase/migrations/', import.meta.url);
const migrationFiles = (await readdir(migrationDirectory))
  .filter((name) => name.endsWith('_expand_launch_email_outbox_contracts.sql'));

assert.equal(
  migrationFiles.length,
  1,
  'Exactly one launch email outbox contract migration must exist.',
);

const migration = await readFile(new URL(migrationFiles[0], migrationDirectory), 'utf8');

assert.match(migration, /^begin;\s/i);
assert.match(migration, /\scommit;\s*$/i);
assert.match(
  migration,
  /alter table public\.notification_outbox\s+drop constraint notification_outbox_payload_contract;/i,
);
assert.match(
  migration,
  /alter table public\.notification_outbox\s+add constraint notification_outbox_payload_contract check \(/i,
);
assert.match(migration, /comment on constraint notification_outbox_payload_contract/i);

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
  assert.match(migration, new RegExp(`'${templateId}'`, 'i'));
  assert.match(migration, new RegExp(`'${classification}'`, 'i'));
}

assert.doesNotMatch(migration, /auth_sign_in/i);
assert.match(
  migration,
  /\('waitlist_confirmation', 'operational'\)[\s\S]*?\('book_availability', 'marketing'\)[\s\S]*?and consent_required[\s\S]*?and consent_purpose = 'book_availability'[\s\S]*?and payload = '\{\}'::jsonb/i,
);
assert.match(
  migration,
  /\('purchase_pending', 'transactional_operational'\)[\s\S]*?\('support_case_received', 'operational'\)[\s\S]*?and not consent_required[\s\S]*?and consent_record_id is null[\s\S]*?and consent_purpose is null[\s\S]*?and consent_checked_at is null[\s\S]*?and payload = '\{\}'::jsonb/i,
);
assert.match(
  migration,
  /template_id = 'purchase_receipt'[\s\S]*?and not consent_required[\s\S]*?payload \?& array\['amountCents', 'currency'\]/i,
);
assert.match(
  migration,
  /template_id = 'market_update'[\s\S]*?classification = 'marketing'[\s\S]*?and consent_required[\s\S]*?payload \? 'editionId'/i,
);

assert.doesNotMatch(migration, /\b(?:insert|update|delete|truncate)\b/i);
assert.doesNotMatch(migration, /\b(?:grant|revoke|security\s+definer)\b/i);
assert.doesNotMatch(migration, /\b(?:SUPABASE|RESEND|OPENAI|PADDLE)_[A-Z0-9_]+\b/i);
assert.doesNotMatch(migration, /sb_(?:secret|publishable)_/i);
assert.doesNotMatch(migration, /bearer\s+[a-z0-9._-]+/i);

console.log('Launch email outbox migration contract tests passed.');
