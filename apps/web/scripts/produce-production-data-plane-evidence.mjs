import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const shaPattern = /^[0-9a-f]{40}$/;
const refPattern = /^[A-Za-z0-9][A-Za-z0-9._:/#-]{2,199}$/;
const allowedSnapshotKeys = new Set([
  'provider',
  'authenticated',
  'readOnly',
  'valuesExposed',
  'source',
  'ref',
  'observedAt',
  'project',
  'invariants',
]);
const allowedProjectKeys = new Set(['id', 'name', 'region', 'status']);
const allowedInvariantKeys = new Set([
  'hasPrivilegeMigration',
  'hasAccountRpcMigration',
  'guidedContentRlsForced',
  'guidedSupplementRlsForced',
  'serviceRoleContentSelect',
  'serviceRoleSupplementSelect',
  'anonContentSelect',
  'authenticatedContentSelect',
  'anonSupplementSelect',
  'authenticatedSupplementSelect',
  'libraryBucketPrivate',
  'audiobookMp3Count',
  'audiobookMediaBytes',
  'publishedChapterCount',
  'publishedSupplementCount',
]);

function assertExactKeys(value, allowed, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  assert.deepEqual(unexpected, [], `${label} contains unsupported fields: ${unexpected.join(', ')}`);
}

function assertSnapshot(snapshot) {
  assertExactKeys(snapshot, allowedSnapshotKeys, 'Production data-plane snapshot');
  assert.equal(snapshot.provider, 'supabase', 'Production data-plane provider mismatch');
  assert.equal(snapshot.authenticated, true, 'Production data-plane audit must be authenticated');
  assert.equal(snapshot.readOnly, true, 'Production data-plane audit must be read-only');
  assert.equal(snapshot.valuesExposed, false, 'Production data-plane audit must not expose secret values');
  assert.ok(['supabase-api', 'github-audit'].includes(snapshot.source), 'Unsupported Production data-plane source');
  assert.match(snapshot.ref, refPattern, 'Production data-plane ref format is invalid');
  assert.ok(Number.isFinite(Date.parse(snapshot.observedAt)), 'Production data-plane observedAt must be a valid timestamp');

  assertExactKeys(snapshot.project, allowedProjectKeys, 'Production data-plane project');
  assert.equal(snapshot.project.id, 'gjzetjugmnwanvjkchux', 'Unexpected Production Supabase project id');
  assert.equal(snapshot.project.name, 'usd-impact-production', 'Unexpected Production Supabase project name');
  assert.equal(snapshot.project.region, 'eu-central-1', 'Unexpected Production Supabase project region');
  assert.equal(snapshot.project.status, 'ACTIVE_HEALTHY', 'Production Supabase project is not healthy');

  assertExactKeys(snapshot.invariants, allowedInvariantKeys, 'Production data-plane invariants');
  const invariants = snapshot.invariants;
  assert.equal(invariants.hasPrivilegeMigration, true, 'Required privilege migration is not applied');
  assert.equal(invariants.hasAccountRpcMigration, true, 'Required account RPC migration is not applied');
  assert.equal(invariants.guidedContentRlsForced, true, 'guided_content_releases must have forced RLS');
  assert.equal(invariants.guidedSupplementRlsForced, true, 'guided_supplement_releases must have forced RLS');
  assert.equal(invariants.serviceRoleContentSelect, true, 'service_role must have SELECT on guided_content_releases');
  assert.equal(invariants.serviceRoleSupplementSelect, true, 'service_role must have SELECT on guided_supplement_releases');
  assert.equal(invariants.anonContentSelect, false, 'anon must not have SELECT on guided_content_releases');
  assert.equal(invariants.authenticatedContentSelect, false, 'authenticated must not have SELECT on guided_content_releases');
  assert.equal(invariants.anonSupplementSelect, false, 'anon must not have SELECT on guided_supplement_releases');
  assert.equal(invariants.authenticatedSupplementSelect, false, 'authenticated must not have SELECT on guided_supplement_releases');
  assert.equal(invariants.libraryBucketPrivate, true, 'library-pass-assets must remain private');
  assert.equal(invariants.audiobookMp3Count, 20, 'Unexpected Production audiobook MP3 count');
  assert.equal(String(invariants.audiobookMediaBytes), '372647590', 'Unexpected Production audiobook media bytes');
  assert.equal(invariants.publishedChapterCount, 13, 'Unexpected published Guided Edition chapter count');
  assert.equal(invariants.publishedSupplementCount, 3, 'Unexpected published Guided Edition supplement count');
}

export function produceProductionDataPlaneEvidence(snapshot, { releaseHead, now = Date.now() } = {}) {
  assert.match(releaseHead ?? '', shaPattern, 'releaseHead must be a full lowercase SHA');
  assertSnapshot(snapshot);

  const observed = Date.parse(snapshot.observedAt);
  const age = now - observed;
  assert.ok(age >= -5 * 60 * 1000, 'Production data-plane audit is too far in the future');
  assert.ok(age <= 24 * 60 * 60 * 1000, 'Production data-plane audit is stale');

  return {
    gate: 'production-data-plane',
    status: 'verified',
    source: snapshot.source,
    ref: snapshot.ref,
    observed_at: snapshot.observedAt,
    release_head: releaseHead,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    args[key.slice(2)] = value;
    index += 1;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const snapshot = JSON.parse(await readFile(args.snapshot, 'utf8'));
  const record = produceProductionDataPlaneEvidence(snapshot, { releaseHead: args['release-head'] });
  process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`Production data-plane evidence generation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
