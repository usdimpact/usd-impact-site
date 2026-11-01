import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Known Development-applied versions that must never become Production migrations.
// This list is deliberately retained even if a file is renamed to remove '_dev'.
export const DEVELOPMENT_ONLY_VERSIONS = Object.freeze([
  '20261030214706', // UI-02 atomic purchase/access locale
  '20261030221037', // UI-02 account-language privacy lifecycle
  '20261030234009', // UI-34 media-language preference
]);

const blockedVersions = new Set(DEVELOPMENT_ONLY_VERSIONS);
const developmentFileName = /(?:^|[_-])(?:dev|development(?:[-_]only)?|preview[-_]only)\.sql$/i;
const developmentComment = /\bdevelopment[\s-]*only\b|\bnot\s+(?:a\s+)?production\s+migration\b/i;
/*
 * Object identifiers from the already-applied Development-only migrations.
 * A change of timestamp, filename and SQL header must not turn those existing
 * Development schemas/functions into a seemingly new Production migration.
 * These markers stay denied until a separately reviewed Production rollout.
 */
const developmentOnlySqlObjects = /\b(?:account_transactional_locale_preferences|purchase_access_ready_locale_snapshots|ui02_access_ready_activation|ui02_enqueue_access_ready_atomic|ui02_check_access_ready_dispatch|ui02_purge_transactional_locale_on_deletion|account_media_locale_preferences|ui03_version_media_locale|ui03_purge_media_locale_on_deletion)\b/i;

/**
 * Review only checked-out files; never connect to Supabase or modify databases.
 * A nonempty result must fail the CI job and block merge of the proposed source.
 */
export function scanProductionMigrationIntake(repositoryRoot) {
  const migrationsDirectory = join(resolve(repositoryRoot), 'supabase', 'migrations');
  if (!existsSync(migrationsDirectory)) {
    return [{ path: 'supabase/migrations', reason: 'Required migration directory is missing' }];
  }
  const violations = [];
  for (const entry of readdirSync(migrationsDirectory, { withFileTypes: true })) {
    if (!entry.name.toLowerCase().endsWith('.sql')) continue;
    const relativePath = 'supabase/migrations/' + entry.name;
    if (!entry.isFile()) {
      violations.push({ path: relativePath, reason: 'SQL entry is not a regular file' });
      continue;
    }
    const timestamp = /^(\d{14})_/.exec(entry.name)?.[1];
    if (timestamp && blockedVersions.has(timestamp)) {
      violations.push({ path: relativePath, reason: 'Known Development-applied migration version is forbidden in Production intake' });
      continue;
    }
    if (developmentFileName.test(entry.name)) {
      violations.push({ path: relativePath, reason: 'Development-only filename is forbidden in Production intake' });
      continue;
    }
    const sql = readFileSync(join(migrationsDirectory, entry.name), 'utf8');
    if (developmentOnlySqlObjects.test(sql)) {
      violations.push({ path: relativePath, reason: 'SQL contains a reserved Development-only UI-02/UI-34 object identifier' });
      continue;
    }
    const firstComments = sql.split(/\r?\n/)
      .slice(0, 20)
      .filter(line => /^\s*(?:--|\/\*|\*|\*\/)/.test(line));
    if (firstComments.some(line => developmentComment.test(line))) {
      violations.push({ path: relativePath, reason: 'SQL header declares Development-only scope' });
    }
  }
  return violations;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = scanProductionMigrationIntake(process.argv[2] ?? '.');
  if (violations.length) {
    console.error('FAIL: Supabase Production migration intake contains blocked entries:');
    for (const finding of violations) console.error('- ' + finding.path + ': ' + finding.reason);
    process.exitCode = 1;
  } else {
    console.log('PASS: No Development-only or blocked migration version is present in Production intake.');
  }
}
