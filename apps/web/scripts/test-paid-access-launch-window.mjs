import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../../../supabase/migrations/20260803190000_guided_edition_launch_window.sql', import.meta.url);
const source = await readFile(migrationUrl, 'utf8');

const start = '2026-08-17T13:00:00Z';
const end = '2026-09-16T13:00:00Z';

assert.match(source, /begin;/i);
assert.match(source, /commit;/i);
assert.match(source, /for update;/i);
assert.match(source, /read-the-dollar-first-guided-interactive-edition/);
assert.match(source, /current_offer\.currency <> 'USD'/);
assert.match(source, /current_offer\.launch_price_cents <> 3900/);
assert.match(source, /current_offer\.standard_price_cents <> 4900/);
assert.match(source, /current_offer\.purchase_limit <> 100/);
assert.match(source, new RegExp(start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(source, new RegExp(end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.doesNotMatch(source, /2099-01/);
assert.equal(Date.parse(end) - Date.parse(start), 30 * 24 * 60 * 60 * 1_000);

console.log('Paid access launch-window migration tests passed.');
