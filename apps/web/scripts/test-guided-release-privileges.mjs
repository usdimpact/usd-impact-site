import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationDirectory = new URL('../../../supabase/migrations/', import.meta.url);
const migrationFiles = (await readdir(migrationDirectory))
  .filter((name) => name.endsWith('.sql'))
  .sort();

const correctiveMigrationIndex = migrationFiles.findIndex(
  (name) => name.endsWith('_restore_guided_release_service_role_select.sql'),
);
assert.ok(correctiveMigrationIndex >= 0, 'Guided release least-privilege migration is missing');

const correctiveMigrationName = migrationFiles[correctiveMigrationIndex];
const correctiveMigration = await readFile(
  new URL(correctiveMigrationName, migrationDirectory),
  'utf8',
);
const laterMigrationChain = (
  await Promise.all(
    migrationFiles
      .slice(correctiveMigrationIndex + 1)
      .map((name) => readFile(new URL(name, migrationDirectory), 'utf8')),
  )
).join('\n');

for (const table of ['guided_content_releases', 'guided_supplement_releases']) {
  assert.match(
    correctiveMigration,
    new RegExp(
      `revoke all on table public\\.${table}\\s+from public, anon, authenticated, service_role;`,
      'i',
    ),
    `${table} must revoke inherited application grants before restoring least privilege`,
  );
  assert.match(
    correctiveMigration,
    new RegExp(`grant select on table public\\.${table} to service_role;`, 'i'),
    `${table} must grant service_role SELECT only`,
  );
  assert.doesNotMatch(
    correctiveMigration,
    new RegExp(
      `grant\\s+(?:all|insert|update|delete|truncate|references|trigger)(?:\\s+privileges)?\\s+on(?:\\s+table)?\\s+public\\.${table}\\s+to\\s+service_role`,
      'i',
    ),
    `${table} corrective migration must not grant write or ownership-adjacent privileges`,
  );
  assert.doesNotMatch(
    laterMigrationChain,
    new RegExp(
      `grant\\s+[^;]*on(?:\\s+table)?\\s+public\\.${table}\\s+to\\s+(?:public|anon|authenticated|service_role)`,
      'i',
    ),
    `${table} has an unreviewed later privilege grant`,
  );
}

console.log('Guided Edition release-table least-privilege contract tests passed.');
