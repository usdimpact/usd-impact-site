import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../../../supabase/migrations/20260803190000_guided_edition_launch_window.sql', import.meta.url);
const source = await readFile(migrationUrl, 'utf8');

assert.match(source, /begin;/i);
assert.match(source, /commit;/i);
assert.match(source, /for update;/i);
assert.match(source, /read-the-dollar-first-guided-interactive-edition/);
assert.match(source, /current_offer\.currency <> 'USD'/);
assert.match(source, /current_offer\.launch_price_cents <> 3900/);
assert.match(source, /current_offer\.standard_price_cents <> 4900/);
assert.match(source, /current_offer\.purchase_limit <> 100/);
assert.doesNotMatch(source, /2099-01/);

const timestamps = [...source.matchAll(/'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)'::timestamptz/g)]
  .map((match) => match[1]);
assert.equal(timestamps.length, 2);
const [start, end] = timestamps;
assert.ok(Number.isFinite(Date.parse(start)));
assert.ok(Number.isFinite(Date.parse(end)));
assert.equal(Date.parse(end) - Date.parse(start), 30 * 24 * 60 * 60 * 1_000);

console.log('Paid access launch-window migration tests passed.');
