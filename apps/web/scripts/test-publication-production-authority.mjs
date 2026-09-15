import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  PUBLICATION_PRODUCTION_AUTHORITY_SCOPE,
  PublicationProductionAuthorityError,
  createPublicationProductionAuthorityAdapter,
} from '../src/lib/publication-production-authority.js';
import { PUBLICATION_GUARD_PRODUCTION_READER_SCOPE } from '../src/lib/publication-production-reader-database.js';

let groups = 0;
const pass = () => { groups += 1; };
const digest = (value) => createHash('sha256').update(value).digest('hex');
const nowMs = Date.parse('2026-09-15T13:30:00.000Z');
const deploymentId = 'dpl_ProductionAuthorityFixtureA';
const deploymentHost = 'usd-impact-site-productionfixture.vercel.app';
const commitSha = 'a'.repeat(40);
const artifactSha256 = 'b'.repeat(64);
const entries = Object.freeze([
  Object.freeze({ path: '/news/2026-09-15', sourceSha256: 'c'.repeat(64) }),
  Object.freeze({ path: '/news/catalysts/cpi-september', sourceSha256: 'd'.repeat(64) }),
]);
const manifestSha256 = digest(JSON.stringify([...entries].sort((a, b) => a.path.localeCompare(b.path))));

const environment = Object.freeze({
  VERCEL: '1',
  VERCEL_ENV: 'production',
  VERCEL_TARGET_ENV: 'production',
  VERCEL_PROJECT_ID: PUBLICATION_GUARD_PRODUCTION_READER_SCOPE.approvedProjectId,
  VERCEL_GIT_PROVIDER: 'github',
  VERCEL_GIT_REPO_OWNER: 'usdimpact',
  VERCEL_GIT_REPO_SLUG: 'usd-impact-site',
  VERCEL_GIT_COMMIT_REF: 'main',
  VERCEL_GIT_COMMIT_SHA: commitSha,
  VERCEL_DEPLOYMENT_ID: deploymentId,
  VERCEL_URL: deploymentHost,
});

const goodProvider = Object.freeze({
  schema: PUBLICATION_PRODUCTION_AUTHORITY_SCOPE.providerSchema,
  repository: PUBLICATION_GUARD_PRODUCTION_READER_SCOPE.approvedRepository,
  projectId: PUBLICATION_GUARD_PRODUCTION_READER_SCOPE.approvedProjectId,
  teamId: PUBLICATION_PRODUCTION_AUTHORITY_SCOPE.teamId,
  target: 'production',
  exposure: 'public-approved',
  source: 'git',
  deploymentId,
  deploymentHost,
  commitSha,
  artifactSha256,
  manifestSha256,
  entries,
  publicAliases: PUBLICATION_PRODUCTION_AUTHORITY_SCOPE.approvedPublicAliases,
  observedAt: '2026-09-15T13:29:59.000Z',
  validUntil: '2026-09-15T13:30:05.000Z',
});

function makeReader(overrides = {}) {
  return {
    async verifyIdentityAndPrivileges() {
      return {
        role: PUBLICATION_GUARD_PRODUCTION_READER_SCOPE.readerLogin,
        database: 'postgres',
        ssl: true,
        readCurrentRevision: true,
        readSnapshot: true,
        writePrivileges: false,
        projectRef: PUBLICATION_GUARD_PRODUCTION_READER_SCOPE.projectRef,
        ...(overrides.identity ?? {}),
      };
    },
    async readCurrentRevision() { return overrides.revision ?? '0'; },
    async readSnapshot({ revision, entries: requested }) {
      if (overrides.snapshotError) throw overrides.snapshotError;
      return overrides.snapshot ?? {
        revision,
        records: requested.map((entry) => ({ ...entry, record: null })),
      };
    },
    ...overrides.methods,
  };
}

function providerSequence(values) {
  let index = 0;
  return async () => {
    const selected = values[Math.min(index, values.length - 1)];
    index += 1;
    if (selected instanceof Error) throw selected;
    return selected;
  };
}

async function hold(work, code) {
  await assert.rejects(
    work,
    (error) => error instanceof PublicationProductionAuthorityError
      && error.code === code && error.policyCode === code,
  );
  pass();
}

assert.equal(PUBLICATION_PRODUCTION_AUTHORITY_SCOPE.authoritySchema, 'publication-serving-authority/v1');
assert.equal(PUBLICATION_PRODUCTION_AUTHORITY_SCOPE.providerSchema, 'publication-production-provider-state/v1');
assert.equal(PUBLICATION_PRODUCTION_AUTHORITY_SCOPE.publicationAuthorized, false);
assert.equal(PUBLICATION_PRODUCTION_AUTHORITY_SCOPE.enforcementActive, false);
assert.deepEqual(PUBLICATION_PRODUCTION_AUTHORITY_SCOPE.approvedPublicAliases, [
  'usd-impact-site-git-main-usd-impact.vercel.app',
  'usd-impact-site-usd-impact.vercel.app',
  'usd-impact-site.vercel.app',
  'usd-impact.com',
  'www.usd-impact.com',
]);
pass();

const reader = makeReader();
const adapter = createPublicationProductionAuthorityAdapter({
  environment,
  reader,
  loadProviderState: providerSequence([goodProvider, goodProvider]),
  now: () => nowMs,
});
assert.equal(adapter.publicationAuthorized, false);
assert.equal(adapter.enforcementActive, false);
assert.equal(adapter.runtime.deploymentId, deploymentId);
pass();

const authority = await adapter.loadAuthority({
  headers: { host: 'attacker.example', 'x-forwarded-host': 'attacker.example' },
});
assert.deepEqual(authority, {
  schema: 'publication-serving-authority/v1',
  repository: 'usdimpact/usd-impact-site',
  projectId: PUBLICATION_GUARD_PRODUCTION_READER_SCOPE.approvedProjectId,
  teamId: PUBLICATION_PRODUCTION_AUTHORITY_SCOPE.teamId,
  target: 'production',
  exposure: 'public-approved',
  deploymentId,
  commitSha,
  artifactSha256,
  manifestSha256,
  historyRevision: '0',
  entries: [...entries].sort((a, b) => a.path.localeCompare(b.path)),
  legacyBaseline: null,
  observedAt: '2026-09-15T13:29:59.000Z',
  validUntil: '2026-09-15T13:30:05.000Z',
});
assert.equal(JSON.stringify(authority).includes('attacker.example'), false);
pass();

const history = await adapter.readHistory({ revision: '0', entries });
assert.equal(history.revision, '0');
assert.equal(history.records.length, 2);
assert.equal(history.records.every((row) => row.record === null), true);
pass();

await hold(
  async () => createPublicationProductionAuthorityAdapter({
    environment: { ...environment, VERCEL_ENV: 'preview' },
    reader,
    loadProviderState: providerSequence([goodProvider]),
    now: () => nowMs,
  }),
  'HOLD_PRODUCTION_AUTHORITY_CONTEXT',
);

await hold(
  async () => createPublicationProductionAuthorityAdapter({
    environment: { ...environment, VERCEL_DEPLOYMENT_ID: 'bad' },
    reader,
    loadProviderState: providerSequence([goodProvider]),
    now: () => nowMs,
  }),
  'HOLD_PRODUCTION_AUTHORITY_CONTEXT',
);

for (const [name, patch, code] of [
  ['deployment mismatch', { deploymentId: 'dpl_OtherProductionFixture' }, 'HOLD_PRODUCTION_AUTHORITY_PROVIDER_BINDING'],
  ['commit mismatch', { commitSha: 'e'.repeat(40) }, 'HOLD_PRODUCTION_AUTHORITY_PROVIDER_BINDING'],
  ['manifest mismatch', { manifestSha256: 'f'.repeat(64) }, 'HOLD_PRODUCTION_AUTHORITY_MANIFEST'],
  ['extra alias', { publicAliases: [...goodProvider.publicAliases, 'other.example.com'] }, 'HOLD_PRODUCTION_AUTHORITY_PUBLIC_EXPOSURE'],
  ['missing alias', { publicAliases: goodProvider.publicAliases.slice(1) }, 'HOLD_PRODUCTION_AUTHORITY_PUBLIC_EXPOSURE'],
  ['stale provider', { observedAt: '2026-09-15T13:29:40.000Z' }, 'HOLD_PRODUCTION_AUTHORITY_FRESHNESS'],
  ['expired provider', { validUntil: '2026-09-15T13:30:00.000Z' }, 'HOLD_PRODUCTION_AUTHORITY_FRESHNESS'],
]) {
  void name;
  const candidate = { ...goodProvider, ...patch };
  const instance = createPublicationProductionAuthorityAdapter({
    environment,
    reader,
    loadProviderState: providerSequence([candidate, candidate]),
    now: () => nowMs,
  });
  await hold(() => instance.loadAuthority(), code);
}

const drifted = { ...goodProvider, artifactSha256: 'e'.repeat(64) };
const driftAdapter = createPublicationProductionAuthorityAdapter({
  environment,
  reader,
  loadProviderState: providerSequence([goodProvider, drifted]),
  now: () => nowMs,
});
await hold(() => driftAdapter.loadAuthority(), 'HOLD_PRODUCTION_AUTHORITY_DRIFT');

const writeReader = makeReader({ identity: { writePrivileges: true } });
const writeAdapter = createPublicationProductionAuthorityAdapter({
  environment,
  reader: writeReader,
  loadProviderState: providerSequence([goodProvider, goodProvider]),
  now: () => nowMs,
});
await hold(() => writeAdapter.loadAuthority(), 'HOLD_PRODUCTION_AUTHORITY_READER');

const badRevisionReader = makeReader({ revision: '-1' });
const badRevisionAdapter = createPublicationProductionAuthorityAdapter({
  environment,
  reader: badRevisionReader,
  loadProviderState: providerSequence([goodProvider, goodProvider]),
  now: () => nowMs,
});
await hold(() => badRevisionAdapter.loadAuthority(), 'HOLD_PRODUCTION_AUTHORITY_REVISION');

const providerFailure = createPublicationProductionAuthorityAdapter({
  environment,
  reader,
  loadProviderState: providerSequence([new Error('provider token leaked here')]),
  now: () => nowMs,
});
await hold(() => providerFailure.loadAuthority(), 'HOLD_PRODUCTION_AUTHORITY_PROVIDER');

const badHistory = createPublicationProductionAuthorityAdapter({
  environment,
  reader: makeReader({ snapshot: { revision: '0', records: [] } }),
  loadProviderState: providerSequence([goodProvider, goodProvider]),
  now: () => nowMs,
});
await hold(() => badHistory.readHistory({ revision: '0', entries }), 'HOLD_PRODUCTION_AUTHORITY_HISTORY');

console.log(`publication production authority tests pass (${groups} groups; source-only fake provider/reader)`);
