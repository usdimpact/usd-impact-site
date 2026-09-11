import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../../../supabase/migrations/20260911204439_email_opt_in_confirmation_outbox_contract.sql', import.meta.url),
  'utf8',
);

assert.match(migration, /^begin;/i);
assert.match(migration, /drop constraint notification_outbox_payload_contract/i);
assert.match(migration, /template_id = 'marketing_opt_in_confirmation'/i);
assert.match(migration, /classification = 'operational'/i);
assert.match(migration, /not consent_required/i);
assert.match(migration, /weekly_newsletter/i);
assert.match(migration, /learning_progress_updates/i);
assert.match(migration, /payload ->> 'locale' = 'en'/i);
assert.match(migration, /payload \? 'userId'/i);
assert.doesNotMatch(migration, /security\s+definer/i);
assert.match(migration, /commit;\s*$/i);

console.log('Email opt-in migration contract passed.');
