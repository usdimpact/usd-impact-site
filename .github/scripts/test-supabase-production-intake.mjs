import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DEVELOPMENT_ONLY_VERSIONS, scanProductionMigrationIntake } from './check-supabase-production-intake.mjs';

function withSyntheticRepository(run) {
  const root = mkdtempSync(join(tmpdir(), 'usd-impact-migration-guard-'));
  try {
    const path = join(root, 'supabase', 'migrations');
    mkdirSync(path, { recursive: true });
    run({ root, path, add: (file, sql = '-- regular reviewed migration\nselect 1;\n') => writeFileSync(join(path, file), sql) });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const versions = [
  '20261030214706_ui02_atomic_purchase_access_locale_dev.sql',
  '20261030221037_ui02_language_privacy_lifecycle_dev.sql',
  '20261030234009_ui03_account_media_locale_preview_dev.sql',
];

test('regular Production migration is accepted; unrelated files are ignored', () => {
  withSyntheticRepository(({ root, add }) => {
    add('20261027005205_score_member_assets_private_html.sql');
    add('README.md');
    assert.deepEqual(scanProductionMigrationIntake(root), []);
  });
});

test('all three previously Development-applied migrations are refused', () => {
  withSyntheticRepository(({ root, add }) => {
    for (const file of versions) add(file);
    assert.equal(scanProductionMigrationIntake(root).length, 3);
  });
});

test('renaming a known Development-only version does not bypass the guard', () => {
  withSyntheticRepository(({ root, add }) => {
    for (const version of DEVELOPMENT_ONLY_VERSIONS) add(version + '_sanitized_name.sql');
    assert.equal(scanProductionMigrationIntake(root).length, 3);
  });
});

test('new filenames ending in _dev.sql are refused without a known version', () => {
  withSyntheticRepository(({ root, add }) => {
    add('20300101120000_new_language_dev.sql');
    assert.match(scanProductionMigrationIntake(root)[0].reason, /filename/i);
  });
});

test('renamed Dev-only SQL with a Development-only header is refused', () => {
  withSyntheticRepository(({ root, add }) => {
    add('20300101120000_innocent_title.sql', '-- Development-only: never deploy to Production\nselect 1;');
    assert.match(scanProductionMigrationIntake(root)[0].reason, /header/i);
  });
});

test('header NOT a Production migration is refused', () => {
  withSyntheticRepository(({ root, add }) => {
    add('20300101120000_friendly.sql', '-- NOT a Production migration.\nselect 1;');
    assert.equal(scanProductionMigrationIntake(root).length, 1);
  });
});

test('missing migration directory fails closed', () => {
  const root = mkdtempSync(join(tmpdir(), 'usd-impact-missing-migrations-'));
  try {
    assert.match(scanProductionMigrationIntake(root)[0].reason, /missing/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
