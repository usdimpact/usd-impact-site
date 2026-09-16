import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { createPublicationProductionVercelProviderStateLoader } from '../src/lib/publication-production-vercel-provider.js';
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

// Synthetic approved authority-component fixture only. The metadata-only loader
// does not produce this fixture; it is not evidence of live public exposure.
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
  ['unverified exposure', { exposure: 'unverified' }, 'HOLD_PRODUCTION_AUTHORITY_PROVIDER_BINDING'],
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

// Compose the actual metadata loader and unchanged authority implementation.
// Only external metadata, credentials and reader methods are synthetic.
const metadataBundle = {
  schema: 'publication-render-inputs/v1',
  siteOrigin: 'https://www.usd-impact.com',
  buildCommitSha: commitSha,
  publications: [{
    path: '/news/2026-09-15',
    source: 'synthetic source',
    sourceSha256: digest('synthetic source'),
    html: '<html>synthetic</html>',
    htmlSha256: digest('<html>synthetic</html>'),
  }],
  static: {
    homepageHtml: '<html>home</html>',
    homepageSha256: digest('<html>home</html>'),
    newsHtml: '<html>news</html>',
    newsSha256: digest('<html>news</html>'),
    sitemapBaseEntries: [],
  },
};
const metadataDeployment = {
  id: deploymentId,
  url: deploymentHost,
  target: 'production',
  readyState: 'READY',
  project: { id: PUBLICATION_GUARD_PRODUCTION_READER_SCOPE.approvedProjectId },
  meta: {
    githubCommitSha: commitSha,
    githubCommitRef: 'main',
    githubCommitOrg: 'usdimpact',
    githubCommitRepo: 'usd-impact-site',
  },
};
const metadataToken = 'fixture_metadata_only_token_abcdefghijklmnopqrstuvwxyz';

for (const decoration of [
  {},
  { redirect: 'outside.invalid' },
  { protectionBypass: { syntheticUnverifiedPolicy: true } },
  { exposure: 'public-approved', verified: true },
]) {
  const metadataCalls = [];
  const readerCalls = { identity: 0, revision: 0, snapshot: 0 };
  let bearerCalls = 0;
  const metadataLoader = createPublicationProductionVercelProviderStateLoader({
    environment,
    renderBundle: metadataBundle,
    now: () => nowMs,
    loadBearerToken: async () => { bearerCalls += 1; return metadataToken; },
    fetchImpl: async (url, options) => {
      metadataCalls.push(url);
      assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'error');
      assert.equal(options.cache, 'no-store');
      assert.equal(options.headers.Authorization, `Bearer ${metadataToken}`);
      const team = encodeURIComponent(PUBLICATION_PRODUCTION_AUTHORITY_SCOPE.teamId);
      const id = encodeURIComponent(deploymentId);
      let value;
      if (url === `https://api.vercel.com/v13/deployments/${id}?withGitRepoInfo=true&teamId=${team}`) {
        value = metadataDeployment;
      } else if (url === `https://api.vercel.com/v2/deployments/${id}/aliases?teamId=${team}`) {
        value = { aliases: goodProvider.publicAliases.map((alias) => ({ alias, ...decoration })) };
      } else {
        assert.fail(`Unexpected metadata request: ${url}`);
      }
      return { status: 200, async text() { return JSON.stringify(value); } };
    },
  });
  const composed = createPublicationProductionAuthorityAdapter({
    environment,
    loadProviderState: metadataLoader.loadProviderState,
    now: () => nowMs,
    reader: {
      async verifyIdentityAndPrivileges() { readerCalls.identity += 1; assert.fail('Reader identity must not be called'); },
      async readCurrentRevision() { readerCalls.revision += 1; assert.fail('History revision must not be read'); },
      async readSnapshot() { readerCalls.snapshot += 1; assert.fail('History snapshot must not be read'); },
    },
  });
  await hold(() => composed.loadAuthority({
    exposure: 'public-approved',
    verified: true,
    headers: { host: 'www.usd-impact.com', 'x-forwarded-host': 'www.usd-impact.com' },
  }), 'HOLD_PRODUCTION_AUTHORITY_PROVIDER_BINDING');
  assert.deepEqual(readerCalls, { identity: 0, revision: 0, snapshot: 0 });
  assert.equal(bearerCalls, 1);
  assert.equal(metadataCalls.length, 2);
  assert.equal(metadataLoader.publicationAuthorized, false);
  assert.equal(metadataLoader.enforcementActive, false);
  assert.equal(composed.publicationAuthorized, false);
  assert.equal(composed.enforcementActive, false);
  pass();
}

// The containment must not wire either dormant module into a live entrypoint.
const apiDirectory = new URL('../api/', import.meta.url);
const entrypoints = [
  new URL('../middleware.js', import.meta.url),
  new URL('../src/lib/publication-guard.js', import.meta.url),
  ...(await readdir(apiDirectory))
    .filter((name) => /\.[cm]?js$/.test(name))
    .map((name) => new URL(name, apiDirectory)),
];
for (const entrypoint of entrypoints) {
  const source = await readFile(entrypoint, 'utf8');
  assert.doesNotMatch(source,
    /\b(?:from\s+|import\s*(?:\(\s*)?|require\s*\(\s*)['"][^'"]*publication-production-(?:authority|vercel-provider)\.js['"]/,
    `Dormant authority/provider import in ${entrypoint.pathname}`);
}
pass();

console.log(`publication production authority tests pass (${groups} groups; source-only fake provider/reader)`);
