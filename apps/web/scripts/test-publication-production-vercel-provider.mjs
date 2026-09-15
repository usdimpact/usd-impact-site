import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  PUBLICATION_PRODUCTION_VERCEL_PROVIDER_SCOPE,
  PublicationProductionVercelProviderError,
  createPublicationProductionVercelProviderStateLoader,
} from '../src/lib/publication-production-vercel-provider.js';

let groups = 0;
const pass = () => { groups += 1; };
const hash = (value) => createHash('sha256').update(value).digest('hex');
const nowMs = Date.parse('2026-09-15T14:45:00.000Z');
const deploymentId = 'dpl_ProductionProviderFixtureA';
const deploymentHost = 'usd-impact-site-productionprovider.vercel.app';
const commitSha = 'a'.repeat(40);
const token = 'vca_fixture_token_abcdefghijklmnopqrstuvwxyz0123456789';

const environment = Object.freeze({
  VERCEL: '1',
  VERCEL_ENV: 'production',
  VERCEL_TARGET_ENV: 'production',
  VERCEL_PROJECT_ID: PUBLICATION_PRODUCTION_VERCEL_PROVIDER_SCOPE.projectId,
  VERCEL_GIT_PROVIDER: 'github',
  VERCEL_GIT_REPO_OWNER: 'usdimpact',
  VERCEL_GIT_REPO_SLUG: 'usd-impact-site',
  VERCEL_GIT_COMMIT_REF: 'main',
  VERCEL_GIT_COMMIT_SHA: commitSha,
  VERCEL_DEPLOYMENT_ID: deploymentId,
  VERCEL_URL: deploymentHost,
});

const sources = ['alpha source', 'beta source'];
const html = ['<html>alpha</html>', '<html>beta</html>'];
const renderBundle = Object.freeze({
  schema: 'publication-render-inputs/v1',
  siteOrigin: 'https://www.usd-impact.com',
  buildCommitSha: commitSha,
  publications: Object.freeze([
    Object.freeze({ path: '/news/2026-09-15', source: sources[0], sourceSha256: hash(sources[0]), html: html[0], htmlSha256: hash(html[0]) }),
    Object.freeze({ path: '/news/catalysts/cpi-september', source: sources[1], sourceSha256: hash(sources[1]), html: html[1], htmlSha256: hash(html[1]) }),
  ]),
  static: Object.freeze({
    homepageHtml: '<html>home</html>',
    homepageSha256: hash('<html>home</html>'),
    newsHtml: '<html>news</html>',
    newsSha256: hash('<html>news</html>'),
    sitemapBaseEntries: Object.freeze(['<url><loc>https://www.usd-impact.com/score</loc></url>']),
  }),
});

const deployment = Object.freeze({
  id: deploymentId,
  url: deploymentHost,
  target: 'production',
  readyState: 'READY',
  project: Object.freeze({ id: PUBLICATION_PRODUCTION_VERCEL_PROVIDER_SCOPE.projectId }),
  meta: Object.freeze({
    githubCommitSha: commitSha,
    githubCommitRef: 'main',
    githubCommitOrg: 'usdimpact',
    githubCommitRepo: 'usd-impact-site',
  }),
});
const aliasPayload = Object.freeze({
  aliases: PUBLICATION_PRODUCTION_VERCEL_PROVIDER_SCOPE.approvedPublicAliases.map((alias) => Object.freeze({ alias })),
});
const response = (value, status = 200) => ({ status, async text() { return JSON.stringify(value); } });

function makeFetch({ deploymentValue = deployment, aliasesValue = aliasPayload, deploymentStatus = 200, aliasStatus = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/v13/deployments/')) return response(deploymentValue, deploymentStatus);
    if (url.includes('/v2/deployments/')) return response(aliasesValue, aliasStatus);
    throw new Error('unexpected URL');
  };
  return { calls, fetchImpl };
}

async function hold(work, code) {
  await assert.rejects(work, (error) => error instanceof PublicationProductionVercelProviderError
    && error.code === code && error.policyCode === code);
  pass();
}

assert.equal(PUBLICATION_PRODUCTION_VERCEL_PROVIDER_SCOPE.schema, 'publication-production-provider-state/v1');
assert.equal(PUBLICATION_PRODUCTION_VERCEL_PROVIDER_SCOPE.credentialMode, 'trusted-bearer-supplier');
assert.equal(Object.hasOwn(PUBLICATION_PRODUCTION_VERCEL_PROVIDER_SCOPE, 'tokenEnvironmentKey'), false);
assert.equal(PUBLICATION_PRODUCTION_VERCEL_PROVIDER_SCOPE.publicationAuthorized, false);
assert.equal(PUBLICATION_PRODUCTION_VERCEL_PROVIDER_SCOPE.enforcementActive, false);
pass();

let credentialCalls = 0;
const loadBearerToken = async () => { credentialCalls += 1; return token; };
const good = makeFetch();
const adapter = createPublicationProductionVercelProviderStateLoader({ environment, fetchImpl: good.fetchImpl, renderBundle, loadBearerToken, now: () => nowMs });
assert.equal(adapter.publicationAuthorized, false);
assert.equal(adapter.enforcementActive, false);
assert.equal(adapter.runtime.deploymentId, deploymentId);
pass();

const state = await adapter.loadProviderState({ headers: { host: 'attacker.example' } });
const expectedEntries = renderBundle.publications.map(({ path, sourceSha256 }) => ({ path, sourceSha256 })).sort((a, b) => a.path.localeCompare(b.path));
assert.deepEqual(state, {
  schema: 'publication-production-provider-state/v1',
  repository: 'usdimpact/usd-impact-site',
  projectId: PUBLICATION_PRODUCTION_VERCEL_PROVIDER_SCOPE.projectId,
  teamId: PUBLICATION_PRODUCTION_VERCEL_PROVIDER_SCOPE.teamId,
  target: 'production',
  exposure: 'public-approved',
  source: 'git',
  deploymentId,
  deploymentHost,
  commitSha,
  artifactSha256: hash(JSON.stringify(renderBundle)),
  manifestSha256: hash(JSON.stringify(expectedEntries)),
  entries: expectedEntries,
  publicAliases: [...PUBLICATION_PRODUCTION_VERCEL_PROVIDER_SCOPE.approvedPublicAliases],
  observedAt: '2026-09-15T14:45:00.000Z',
  validUntil: '2026-09-15T14:45:05.000Z',
});
assert.equal(JSON.stringify(state).includes('attacker.example'), false);
assert.equal(credentialCalls, 1);
pass();

assert.equal(good.calls.length, 2);
for (const call of good.calls) {
  assert.equal(call.options.method, 'GET');
  assert.equal(call.options.headers.Authorization, `Bearer ${token}`);
  assert.equal(call.options.headers.Accept, 'application/json');
  assert.equal(call.options.redirect, 'error');
  assert.equal(call.options.cache, 'no-store');
  assert.ok(call.options.signal instanceof AbortSignal);
  assert.ok(call.url.includes(`teamId=${encodeURIComponent(PUBLICATION_PRODUCTION_VERCEL_PROVIDER_SCOPE.teamId)}`));
}
assert.ok(good.calls[0].url.includes('/v13/deployments/'));
assert.ok(good.calls[1].url.includes('/v2/deployments/'));
pass();

for (const patch of [
  { VERCEL_ENV: 'preview' },
  { VERCEL_TARGET_ENV: 'preview' },
  { VERCEL_PROJECT_ID: 'prj_other' },
  { VERCEL_GIT_COMMIT_REF: 'other' },
  { VERCEL_DEPLOYMENT_ID: 'bad' },
]) {
  await hold(async () => createPublicationProductionVercelProviderStateLoader({
    environment: { ...environment, ...patch }, fetchImpl: good.fetchImpl, renderBundle, loadBearerToken, now: () => nowMs,
  }), 'HOLD_PRODUCTION_PROVIDER_CONTEXT');
}

await hold(async () => createPublicationProductionVercelProviderStateLoader({
  environment, fetchImpl: good.fetchImpl, renderBundle, now: () => nowMs,
}), 'HOLD_PRODUCTION_PROVIDER_CONFIG');

const staticTokenOnlyEnvironment = { ...environment, PUBLICATION_GUARD_VERCEL_PROVIDER_TOKEN: token };
await hold(async () => createPublicationProductionVercelProviderStateLoader({
  environment: staticTokenOnlyEnvironment, fetchImpl: good.fetchImpl, renderBundle, now: () => nowMs,
}), 'HOLD_PRODUCTION_PROVIDER_CONFIG');

for (const badSupplier of [
  async () => '',
  async () => 'short',
  async () => 'bad token with spaces 1234567890',
  async () => { throw new Error(`do not leak ${token}`); },
]) {
  const instance = createPublicationProductionVercelProviderStateLoader({ environment, fetchImpl: good.fetchImpl, renderBundle, loadBearerToken: badSupplier, now: () => nowMs });
  await hold(() => instance.loadProviderState(), 'HOLD_PRODUCTION_PROVIDER_CREDENTIAL');
}

await hold(async () => createPublicationProductionVercelProviderStateLoader({
  environment,
  fetchImpl: good.fetchImpl,
  renderBundle: { ...renderBundle, buildCommitSha: 'b'.repeat(40) },
  loadBearerToken,
  now: () => nowMs,
}), 'HOLD_PRODUCTION_PROVIDER_ARTIFACT');

for (const patch of [
  { id: 'dpl_OtherProviderFixture' },
  { url: 'other-provider.vercel.app' },
  { target: 'preview' },
  { readyState: 'ERROR' },
  { project: { id: 'prj_other' } },
  { meta: { ...deployment.meta, githubCommitSha: 'b'.repeat(40) } },
  { meta: { ...deployment.meta, githubCommitRef: 'other' } },
  { meta: { ...deployment.meta, githubCommitRepo: 'other' } },
]) {
  const candidate = makeFetch({ deploymentValue: { ...deployment, ...patch } });
  const instance = createPublicationProductionVercelProviderStateLoader({ environment, fetchImpl: candidate.fetchImpl, renderBundle, loadBearerToken, now: () => nowMs });
  await hold(() => instance.loadProviderState(), 'HOLD_PRODUCTION_PROVIDER_BINDING');
}

for (const aliases of [
  { aliases: aliasPayload.aliases.slice(1) },
  { aliases: [...aliasPayload.aliases, { alias: 'other.example.com' }] },
  { aliases: [...aliasPayload.aliases, aliasPayload.aliases[0]] },
]) {
  const candidate = makeFetch({ aliasesValue: aliases });
  const instance = createPublicationProductionVercelProviderStateLoader({ environment, fetchImpl: candidate.fetchImpl, renderBundle, loadBearerToken, now: () => nowMs });
  await hold(() => instance.loadProviderState(), 'HOLD_PRODUCTION_PROVIDER_ALIASES');
}

const deploymentFailure = makeFetch({ deploymentStatus: 503 });
const deploymentFailureAdapter = createPublicationProductionVercelProviderStateLoader({ environment, fetchImpl: deploymentFailure.fetchImpl, renderBundle, loadBearerToken, now: () => nowMs });
await hold(() => deploymentFailureAdapter.loadProviderState(), 'HOLD_PRODUCTION_PROVIDER_DEPLOYMENT');

const secretFailureAdapter = createPublicationProductionVercelProviderStateLoader({
  environment,
  fetchImpl: async () => { throw new Error(`do not leak ${token}`); },
  renderBundle,
  loadBearerToken,
  now: () => nowMs,
});
await hold(() => secretFailureAdapter.loadProviderState(), 'HOLD_PRODUCTION_PROVIDER_DEPLOYMENT');

let clock = nowMs;
const clockAdapter = createPublicationProductionVercelProviderStateLoader({
  environment,
  fetchImpl: makeFetch().fetchImpl,
  renderBundle,
  loadBearerToken,
  now: () => { const value = clock; clock -= 1; return value; },
});
await clockAdapter.loadProviderState();
await hold(() => clockAdapter.loadProviderState(), 'HOLD_PRODUCTION_PROVIDER_CLOCK');

console.log(`publication production Vercel provider tests pass (${groups} groups; source-only fake provider)`);
