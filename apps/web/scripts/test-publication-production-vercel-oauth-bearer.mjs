import assert from 'node:assert/strict';
import {
  PUBLICATION_PRODUCTION_VERCEL_CONNECT_SCOPE,
  PUBLICATION_PRODUCTION_VERCEL_OAUTH_SCOPE,
  PublicationProductionVercelConnectBearerError,
  PublicationProductionVercelOAuthBearerError,
  createPublicationProductionVercelConnectBearerSupplier,
  createPublicationProductionVercelOAuthBearerSupplier,
  loadPublicationProductionVercelConnectCredential,
  loadPublicationProductionVercelOAuthClientCredentials,
} from '../src/lib/publication-production-vercel-oauth-bearer.js';

let groups = 0;
const pass = () => { groups += 1; };
const start = Date.parse('2026-09-15T20:30:00.000Z');
const connectorId = 'scl_fixtureConnector123456789';
const oidcToken = 'oidc_fixture_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const accessOne = 'vca_fixture_access_one_abcdefghijklmnopqrstuvwxyz0123456789';

const response = (value, status = 200) => ({ status, async text() { return JSON.stringify(value); } });

function fixture({
  status = 200,
  body = null,
  currentConnectorId = connectorId,
  currentOidcToken = oidcToken,
  load = null,
  nowValues = null,
} = {}) {
  const calls = [];
  let clockIndex = 0;
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return response(body ?? { token: accessOne, expiresAt: start + 3_600_000 }, status);
  };
  const now = () => {
    if (!nowValues) return start;
    const value = nowValues[Math.min(clockIndex, nowValues.length - 1)];
    clockIndex += 1;
    return value;
  };
  const loadConnectCredential = load ?? (async () => ({
    connectorId: currentConnectorId,
    oidcToken: currentOidcToken,
  }));
  return {
    calls,
    supplier: createPublicationProductionVercelConnectBearerSupplier({
      fetchImpl,
      loadConnectCredential,
      now,
    }),
  };
}

async function hold(work, code) {
  await assert.rejects(work, (error) => error instanceof PublicationProductionVercelConnectBearerError
    && error.code === code && error.policyCode === code && error.message === code);
  pass();
}

assert.equal(PUBLICATION_PRODUCTION_VERCEL_CONNECT_SCOPE.schema, 'publication-production-vercel-connect-bearer/v1');
assert.equal(PUBLICATION_PRODUCTION_VERCEL_CONNECT_SCOPE.projectId, 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7');
assert.deepEqual(PUBLICATION_PRODUCTION_VERCEL_CONNECT_SCOPE.requiredProviderScopes, ['read:deployment', 'read:project']);
assert.equal(PUBLICATION_PRODUCTION_VERCEL_CONNECT_SCOPE.connectorIdEnvKey, 'PUBLICATION_GUARD_VERCEL_CONNECTOR_ID');
assert.equal(PUBLICATION_PRODUCTION_VERCEL_CONNECT_SCOPE.oidcTokenEnvKey, 'VERCEL_OIDC_TOKEN');
assert.equal(PUBLICATION_PRODUCTION_VERCEL_CONNECT_SCOPE.credentialMode, 'vercel-connect-project-oidc');
assert.equal(PUBLICATION_PRODUCTION_VERCEL_CONNECT_SCOPE.connectorEnvironmentLink, 'production');
assert.equal(PUBLICATION_PRODUCTION_VERCEL_CONNECT_SCOPE.providerTokenDurableStorage, false);
assert.equal(PUBLICATION_PRODUCTION_VERCEL_CONNECT_SCOPE.legacyClientSecretRequired, false);
assert.equal(PUBLICATION_PRODUCTION_VERCEL_CONNECT_SCOPE.legacyRefreshStoreRequired, false);
assert.equal(PUBLICATION_PRODUCTION_VERCEL_CONNECT_SCOPE.publicationAuthorized, false);
assert.equal(PUBLICATION_PRODUCTION_VERCEL_CONNECT_SCOPE.enforcementActive, false);
assert.equal(PUBLICATION_PRODUCTION_VERCEL_OAUTH_SCOPE, PUBLICATION_PRODUCTION_VERCEL_CONNECT_SCOPE);
assert.equal(PublicationProductionVercelOAuthBearerError, PublicationProductionVercelConnectBearerError);
assert.equal(createPublicationProductionVercelOAuthBearerSupplier, createPublicationProductionVercelConnectBearerSupplier);
pass();

const productionEnvironment = {
  VERCEL: '1',
  VERCEL_ENV: 'production',
  VERCEL_TARGET_ENV: 'production',
  VERCEL_PROJECT_ID: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7',
  VERCEL_GIT_PROVIDER: 'github',
  VERCEL_GIT_REPO_OWNER: 'usdimpact',
  VERCEL_GIT_REPO_SLUG: 'usd-impact-site',
  VERCEL_GIT_COMMIT_REF: 'main',
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  PUBLICATION_GUARD_VERCEL_CONNECTOR_ID: connectorId,
  VERCEL_OIDC_TOKEN: oidcToken,
};
const loaded = loadPublicationProductionVercelConnectCredential(productionEnvironment);
assert.deepEqual(loaded, { connectorId, oidcToken });
assert.equal(Object.isFrozen(loaded), true);
pass();

for (const patch of [
  { VERCEL: '0' },
  { VERCEL_ENV: 'preview' },
  { VERCEL_TARGET_ENV: 'preview' },
  { VERCEL_PROJECT_ID: 'prj_other' },
  { VERCEL_GIT_PROVIDER: 'gitlab' },
  { VERCEL_GIT_REPO_OWNER: 'other' },
  { VERCEL_GIT_REPO_SLUG: 'other' },
  { VERCEL_GIT_COMMIT_REF: 'feature' },
  { VERCEL_GIT_COMMIT_SHA: 'bad' },
]) {
  assert.throws(
    () => loadPublicationProductionVercelConnectCredential({ ...productionEnvironment, ...patch }),
    (error) => error instanceof PublicationProductionVercelConnectBearerError
      && error.code === 'HOLD_PRODUCTION_VERCEL_CONNECT_CONTEXT',
  );
  pass();
}

for (const patch of [
  { PUBLICATION_GUARD_VERCEL_CONNECTOR_ID: 'bad' },
  { PUBLICATION_GUARD_VERCEL_CONNECTOR_ID: undefined },
]) {
  assert.throws(
    () => loadPublicationProductionVercelConnectCredential({ ...productionEnvironment, ...patch }),
    (error) => error.code === 'HOLD_PRODUCTION_VERCEL_CONNECT_CONNECTOR',
  );
  pass();
}
for (const patch of [
  { VERCEL_OIDC_TOKEN: 'short' },
  { VERCEL_OIDC_TOKEN: undefined },
]) {
  assert.throws(
    () => loadPublicationProductionVercelConnectCredential({ ...productionEnvironment, ...patch }),
    (error) => error.code === 'HOLD_PRODUCTION_VERCEL_CONNECT_OIDC',
  );
  pass();
}

assert.throws(
  () => loadPublicationProductionVercelOAuthClientCredentials(),
  (error) => error.code === 'HOLD_PRODUCTION_VERCEL_CONNECT_LEGACY_OAUTH_DISABLED',
);
pass();

const good = fixture();
assert.equal(await good.supplier.loadBearerToken(), accessOne);
assert.equal(good.calls.length, 1);
const call = good.calls[0];
assert.equal(call.url, `${PUBLICATION_PRODUCTION_VERCEL_CONNECT_SCOPE.tokenEndpointOrigin}${encodeURIComponent(connectorId)}`);
assert.equal(call.options.method, 'POST');
assert.equal(call.options.headers.Authorization, `Bearer ${oidcToken}`);
assert.equal(call.options.headers.Accept, 'application/json');
assert.equal(call.options.headers['Content-Type'], 'application/json');
assert.equal(call.options.redirect, 'error');
assert.equal(call.options.cache, 'no-store');
assert.ok(call.options.signal instanceof AbortSignal);
assert.deepEqual(JSON.parse(call.options.body), {
  subject: { type: 'app' },
  scopes: ['read:deployment', 'read:project'],
});
pass();

assert.equal(await good.supplier.loadBearerToken(), accessOne);
assert.equal(good.calls.length, 1);
pass();

const concurrent = fixture();
const tokens = await Promise.all(Array.from({ length: 8 }, () => concurrent.supplier.loadBearerToken()));
assert.deepEqual(tokens, Array(8).fill(accessOne));
assert.equal(concurrent.calls.length, 1);
pass();

const secondsExpiry = fixture({ body: { token: accessOne, expiresAt: Math.floor((start + 3_600_000) / 1_000) } });
assert.equal(await secondsExpiry.supplier.loadBearerToken(), accessOne);
pass();

assert.throws(
  () => createPublicationProductionVercelConnectBearerSupplier({ fetchImpl: null }),
  (error) => error.code === 'HOLD_PRODUCTION_VERCEL_CONNECT_CONFIG',
);
pass();

for (const candidate of [
  async () => ({ connectorId: 'bad', oidcToken }),
  async () => ({ connectorId, oidcToken: 'short' }),
  async () => { throw new Error(`do not leak ${oidcToken}`); },
]) {
  const f = fixture({ load: candidate });
  await hold(() => f.supplier.loadBearerToken(), 'HOLD_PRODUCTION_VERCEL_CONNECT_CREDENTIAL');
}

for (const malformed of [
  {},
  { token: 'short', expiresAt: start + 3_600_000 },
  { token: accessOne, expiresAt: start + 30_000 },
  { token: accessOne, expiresAt: start + 3 * 60 * 60 * 1_000 },
  { token: accessOne, expiresAt: 'bad' },
]) {
  const f = fixture({ body: malformed });
  await hold(() => f.supplier.loadBearerToken(), 'HOLD_PRODUCTION_VERCEL_CONNECT_TOKEN');
}

const httpFailure = fixture({ status: 503 });
await hold(() => httpFailure.supplier.loadBearerToken(), 'HOLD_PRODUCTION_VERCEL_CONNECT_TOKEN');

const secretFailure = createPublicationProductionVercelConnectBearerSupplier({
  fetchImpl: async () => { throw new Error(`${oidcToken}:${accessOne}`); },
  loadConnectCredential: async () => ({ connectorId, oidcToken }),
  now: () => start,
});
await hold(() => secretFailure.loadBearerToken(), 'HOLD_PRODUCTION_VERCEL_CONNECT_TOKEN');

const rollback = fixture({ nowValues: [start, start, start - 1] });
await hold(async () => {
  await rollback.supplier.loadBearerToken();
  await rollback.supplier.loadBearerToken();
}, 'HOLD_PRODUCTION_VERCEL_CONNECT_CLOCK');

console.log(`publication production Vercel Connect bearer tests pass (${groups} groups; source-only fake Connect broker)`);
