import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const weeklyMigrationPath = new URL(
  '../../../supabase/migrations/20260911212204_weekly_newsletter_outbox_contract.sql',
  import.meta.url,
);
const progressMigrationPath = new URL(
  '../../../supabase/migrations/20260911222440_learning_progress_email_outbox_contract.sql',
  import.meta.url,
);
const weeklyMigration = readFileSync(weeklyMigrationPath, 'utf8');
const migration = readFileSync(progressMigrationPath, 'utf8');

assert(20260911222440 > 20260911212204, 'Progress migration must run after Weekly Newsletter outbox migration.');
assert.match(weeklyMigration, /template_id = 'weekly_newsletter'/i);
assert.match(migration, /notification_outbox_payload_contract/i);
assert.match(migration, /pg_get_expr\(conbin, conrelid\)/i);
assert.match(migration, /existing_expr is null/i);
assert.match(
  migration,
  /alter table public\.notification_outbox drop constraint notification_outbox_payload_contract/i,
);
assert.match(
  migration,
  /template_id = 'learning_progress_email'[\s\S]*?classification = 'marketing'/i,
);
assert.match(
  migration,
  /template_id = 'learning_progress_email'[\s\S]*?consent_required[\s\S]*?consent_record_id is not null[\s\S]*?consent_purpose = 'learning_progress_updates'[\s\S]*?consent_checked_at is not null/i,
);
assert.match(migration, /payload \?& array\['cohort', 'cycleKey'\]/i);
assert.match(
  migration,
  /payload - array\['cohort', 'cycleKey'\] = '\{\}'::jsonb/i,
);
assert.match(
  migration,
  /payload ->> 'cohort' in \('inactive_7d', 'inactive_14d', 'inactive_30d'\)/i,
);
assert.match(
  migration,
  /payload ->> 'cycleKey' ~ '\^\[0-9a-f\]\{64\}\$'/i,
);
assert.match(
  migration,
  /Allowlisted minimized payload and consent contracts[\s\S]*Learning Progress email/i,
);
assert.doesNotMatch(migration, /security\s+definer/i);
assert.doesNotMatch(migration, /create\s+table/i);
assert.doesNotMatch(migration, /create\s+function/i);
assert.doesNotMatch(migration, /create\s+policy/i);
assert.doesNotMatch(migration, /grant\s+/i);
assert.doesNotMatch(migration, /service_role/i);

console.log('Learning Progress email outbox migration contract passed.');
