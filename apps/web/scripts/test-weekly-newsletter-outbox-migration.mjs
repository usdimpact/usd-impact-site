import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../../../supabase/migrations/20260911212204_weekly_newsletter_outbox_contract.sql', import.meta.url),
  'utf8',
);

assert.match(migration, /^begin;/i);
assert.match(migration, /\scommit;\s*$/i);
assert.match(
  migration,
  /alter table public\.notification_outbox\s+drop constraint notification_outbox_payload_contract;/i,
);
assert.match(
  migration,
  /template_id = 'weekly_newsletter'[\s\S]*?classification = 'marketing'/i,
);
assert.match(
  migration,
  /template_id = 'weekly_newsletter'[\s\S]*?consent_required[\s\S]*?consent_record_id is not null[\s\S]*?consent_purpose = 'weekly_newsletter'[\s\S]*?consent_checked_at is not null/i,
);
assert.match(
  migration,
  /payload \?& array\['weekEnding', 'editionChecksum'\]/i,
);
assert.match(
  migration,
  /payload - array\['weekEnding', 'editionChecksum'\] = '\{\}'::jsonb/i,
);
assert.match(
  migration,
  /payload ->> 'weekEnding' ~ '\^20\[0-9\]\{2\}-\[0-9\]\{2\}-\[0-9\]\{2\}\$'/i,
);
assert.match(
  migration,
  /payload ->> 'editionChecksum' ~ '\^\[0-9a-f\]\{64\}\$'/i,
);
assert.match(migration, /template_id = 'marketing_opt_in_confirmation'/i);
assert.match(migration, /template_id = 'purchase_receipt'/i);
assert.match(migration, /template_id = 'market_update'/i);
assert.match(migration, /\('waitlist_confirmation', 'operational'\)/i);
assert.doesNotMatch(migration, /security\s+definer/i);
assert.doesNotMatch(migration, /create\s+table/i);
assert.doesNotMatch(migration, /create\s+function/i);
assert.doesNotMatch(migration, /grant\s+/i);

console.log('Weekly Newsletter outbox migration contract passed.');
