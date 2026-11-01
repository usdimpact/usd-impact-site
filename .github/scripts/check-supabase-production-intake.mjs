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
    const firstComments = readFileSync(join(migrationsDirectory, entry.name), 'utf8')
      .split(/\r?\n/)
      .slice(0, 12)
      .filter(line => /^\s*--/.test(line));
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
