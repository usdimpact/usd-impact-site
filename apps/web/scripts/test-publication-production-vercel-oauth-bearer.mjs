import assert from 'node:assert/strict';
import {
  PUBLICATION_PRODUCTION_VERCEL_OAUTH_SCOPE,
  PublicationProductionVercelOAuthBearerError,
  createPublicationProductionVercelOAuthBearerSupplier,
  loadPublicationProductionVercelOAuthClientCredentials,
} from '../src/lib/publication-production-vercel-oauth-bearer.js';

let groups = 0;
const pass = () => { groups += 1; };
const start = Date.parse('2026-09-15T15:30:00.000Z');
const clientId = 'cl_fixtureClient123456789';
const clientSecret = 'client_secret_fixture_abcdefghijklmnopqrstuvwxyz';
const refreshOne = 'vcr_fixture_refresh_one_abcdefghijklmnopqrstuvwxyz0123456789';
const refreshTwo = 'vcr_fixture_refresh_two_abcdefghijklmnopqrstuvwxyz0123456789';
const accessOne = 'vca_fixture_access_one_abcdefghijklmnopqrstuvwxyz0123456789';
const accessTwo = 'vca_fixture_access_two_abcdefghijklmnopqrstuvwxyz0123456789';

const response = (value, status = 200) => ({ status, async text() { return JSON.stringify(value); } });

function fixture({
  tokenStatus = 200,
  introspectionStatus = 200,
  exchange = null,
  inspect = null,
  replace = null,
  currentRefresh = refreshOne,
  currentVersion = 'r1',
  nowValues = null,
} = {}) {
  const calls = [];
  const replacements = [];
  let tokenCount = 0;
  let clockIndex = 0;
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url === PUBLICATION_PRODUCTION_VERCEL_OAUTH_SCOPE.tokenEndpoint) {
      tokenCount += 1;
      const accessToken = tokenCount === 1 ? accessOne : accessTwo;
      const refreshToken = refreshTwo;
      return response(exchange ?? {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 3600,
      }, tokenStatus);
    }
    if (url === PUBLICATION_PRODUCTION_VERCEL_OAUTH_SCOPE.introspectionEndpoint) {
      const body = new URLSearchParams(options.body);
      const token = body.get('token');
      return response(inspect ?? {
        active: true,
        client_id: clientId,
        token_type: 'bearer',
        exp: Math.floor((start + 3_600_000) / 1000),
        iat: Math.floor(start / 1000),
        token,
      }, introspectionStatus);
    }
    throw new Error('unexpected URL');
  };
  const replaceRefreshCredential = replace ?? (async ({ expectedVersion, nextToken }) => {
    replacements.push({ expectedVersion, nextToken });
    return { stored: true, version: 'r2' };
  });
  const now = () => {
    if (!nowValues) return start;
    const value = nowValues[Math.min(clockIndex, nowValues.length - 1)];
    clockIndex += 1;
    return value;
  };
  return {
    calls,
    replacements,
    supplier: createPublicationProductionVercelOAuthBearerSupplier({
      fetchImpl,
      loadClientCredentials: async () => ({ clientId, clientSecret }),
      loadRefreshCredential: async () => ({ token: currentRefresh, version: currentVersion }),
      replaceRefreshCredential,
      now,
    }),
  };
}

async function hold(work, code) {
  await assert.rejects(work, (error) => error instanceof PublicationProductionVercelOAuthBearerError
    && error.code === code && error.policyCode === code && error.message === code);
  pass();
}

assert.equal(PUBLICATION_PRODUCTION_VERCEL_OAUTH_SCOPE.schema, 'publication-production-vercel-oauth-bearer/v1');
assert.equal(PUBLICATION_PRODUCTION_VERCEL_OAUTH_SCOPE.projectId, 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7');
assert.deepEqual(PUBLICATION_PRODUCTION_VERCEL_OAUTH_SCOPE.requiredInstallationPermissions, ['read:deployment', 'read:project']);
assert.equal(PUBLICATION_PRODUCTION_VERCEL_OAUTH_SCOPE.clientIdEnvKey, 'PUBLICATION_GUARD_VERCEL_OAUTH_CLIENT_ID');
assert.equal(PUBLICATION_PRODUCTION_VERCEL_OAUTH_SCOPE.clientSecretEnvKey, 'PUBLICATION_GUARD_VERCEL_OAUTH_CLIENT_SECRET');
assert.equal(PUBLICATION_PRODUCTION_VERCEL_OAUTH_SCOPE.credentialMode, 'project-scoped-readonly-oauth-refresh');
assert.equal(PUBLICATION_PRODUCTION_VERCEL_OAUTH_SCOPE.aliasReadPermissionProof, 'live-rehearsal-required');
assert.equal(PUBLICATION_PRODUCTION_VERCEL_OAUTH_SCOPE.publicationAuthorized, false);
assert.equal(PUBLICATION_PRODUCTION_VERCEL_OAUTH_SCOPE.enforcementActive, false);
pass();

const productionClientEnvironment = {
  VERCEL: '1',
  VERCEL_ENV: 'production',
  VERCEL_TARGET_ENV: 'production',
  VERCEL_PROJECT_ID: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7',
  VERCEL_GIT_PROVIDER: 'github',
  VERCEL_GIT_REPO_OWNER: 'usdimpact',
  VERCEL_GIT_REPO_SLUG: 'usd-impact-site',
  VERCEL_GIT_COMMIT_REF: 'main',
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  PUBLICATION_GUARD_VERCEL_OAUTH_CLIENT_ID: clientId,
  PUBLICATION_GUARD_VERCEL_OAUTH_CLIENT_SECRET: clientSecret,
};
const loadedClientCredentials = loadPublicationProductionVercelOAuthClientCredentials(productionClientEnvironment);
assert.deepEqual(loadedClientCredentials, { clientId, clientSecret });
assert.equal(Object.isFrozen(loadedClientCredentials), true);
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
    () => loadPublicationProductionVercelOAuthClientCredentials({ ...productionClientEnvironment, ...patch }),
    (error) => error instanceof PublicationProductionVercelOAuthBearerError
      && error.code === 'HOLD_PRODUCTION_VERCEL_OAUTH_CLIENT_CONTEXT'
      && error.message === 'HOLD_PRODUCTION_VERCEL_OAUTH_CLIENT_CONTEXT',
  );
  pass();
}

for (const patch of [
  { PUBLICATION_GUARD_VERCEL_OAUTH_CLIENT_ID: 'bad' },
  { PUBLICATION_GUARD_VERCEL_OAUTH_CLIENT_SECRET: 'short' },
  { PUBLICATION_GUARD_VERCEL_OAUTH_CLIENT_ID: undefined },
  { PUBLICATION_GUARD_VERCEL_OAUTH_CLIENT_SECRET: undefined },
]) {
  assert.throws(
    () => loadPublicationProductionVercelOAuthClientCredentials({ ...productionClientEnvironment, ...patch }),
    (error) => error instanceof PublicationProductionVercelOAuthBearerError
      && error.code === 'HOLD_PRODUCTION_VERCEL_OAUTH_CLIENT'
      && error.message === 'HOLD_PRODUCTION_VERCEL_OAUTH_CLIENT',
  );
  pass();
}

const good = fixture();
assert.equal(await good.supplier.loadBearerToken(), accessOne);
assert.equal(good.calls.length, 2);
assert.equal(good.replacements.length, 1);
assert.deepEqual(good.replacements[0], { expectedVersion: 'r1', nextToken: refreshTwo });
for (const call of good.calls) {
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.headers.Accept, 'application/json');
  assert.equal(call.options.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(call.options.redirect, 'error');
  assert.equal(call.options.cache, 'no-store');
  assert.ok(call.options.signal instanceof AbortSignal);
}
const refreshBody = new URLSearchParams(good.calls[0].options.body);
assert.equal(refreshBody.get('grant_type'), 'refresh_token');
assert.equal(refreshBody.get('client_id'), clientId);
assert.equal(refreshBody.get('client_secret'), clientSecret);
assert.equal(refreshBody.get('refresh_token'), refreshOne);
const inspectBody = new URLSearchParams(good.calls[1].options.body);
assert.equal(inspectBody.get('token'), accessOne);
pass();

assert.equal(await good.supplier.loadBearerToken(), accessOne);
assert.equal(good.calls.length, 2);
pass();

const concurrent = fixture();
const tokens = await Promise.all(Array.from({ length: 8 }, () => concurrent.supplier.loadBearerToken()));
assert.deepEqual(tokens, Array(8).fill(accessOne));
assert.equal(concurrent.calls.length, 2);
assert.equal(concurrent.replacements.length, 1);
pass();

const sameRefresh = fixture({ exchange: {
  access_token: accessOne,
  refresh_token: refreshOne,
  token_type: 'Bearer',
  expires_in: 3600,
} });
assert.equal(await sameRefresh.supplier.loadBearerToken(), accessOne);
assert.equal(sameRefresh.replacements.length, 0);
pass();

for (const patch of [
  {},
  { fetchImpl: null, loadClientCredentials: async () => ({}), loadRefreshCredential: async () => ({}), replaceRefreshCredential: async () => ({}) },
]) {
  if (Object.keys(patch).length === 0) {
    assert.throws(() => createPublicationProductionVercelOAuthBearerSupplier(), (error) => error.code === 'HOLD_PRODUCTION_VERCEL_OAUTH_CONFIG');
  } else {
    assert.throws(() => createPublicationProductionVercelOAuthBearerSupplier(patch), (error) => error.code === 'HOLD_PRODUCTION_VERCEL_OAUTH_CONFIG');
  }
  pass();
}

for (const loader of [
  async () => ({ clientId: 'bad', clientSecret }),
  async () => ({ clientId, clientSecret: 'short' }),
  async () => { throw new Error(`do not leak ${clientSecret}`); },
]) {
  const supplier = createPublicationProductionVercelOAuthBearerSupplier({
    fetchImpl: async () => response({}),
    loadClientCredentials: loader,
    loadRefreshCredential: async () => ({ token: refreshOne, version: 'r1' }),
    replaceRefreshCredential: async () => ({ stored: true, version: 'r2' }),
    now: () => start,
  });
  await hold(() => supplier.loadBearerToken(), 'HOLD_PRODUCTION_VERCEL_OAUTH_CLIENT');
}

for (const loader of [
  async () => ({ token: 'short', version: 'r1' }),
  async () => ({ token: refreshOne, version: '' }),
  async () => { throw new Error(`do not leak ${refreshOne}`); },
]) {
  const supplier = createPublicationProductionVercelOAuthBearerSupplier({
    fetchImpl: async () => response({}),
    loadClientCredentials: async () => ({ clientId, clientSecret }),
    loadRefreshCredential: loader,
    replaceRefreshCredential: async () => ({ stored: true, version: 'r2' }),
    now: () => start,
  });
  await hold(() => supplier.loadBearerToken(), 'HOLD_PRODUCTION_VERCEL_OAUTH_REFRESH_CREDENTIAL');
}

for (const exchange of [
  {},
  { access_token: 'short', refresh_token: refreshTwo, token_type: 'Bearer', expires_in: 3600 },
  { access_token: accessOne, refresh_token: refreshTwo, token_type: 'mac', expires_in: 3600 },
  { access_token: accessOne, refresh_token: refreshTwo, token_type: 'Bearer', expires_in: 30 },
  { access_token: accessOne, refresh_token: refreshTwo, token_type: 'Bearer', expires_in: 10000 },
]) {
  const f = fixture({ exchange });
  await hold(() => f.supplier.loadBearerToken(), 'HOLD_PRODUCTION_VERCEL_OAUTH_TOKEN');
}

const tokenHttpFailure = fixture({ tokenStatus: 503 });
await hold(() => tokenHttpFailure.supplier.loadBearerToken(), 'HOLD_PRODUCTION_VERCEL_OAUTH_TOKEN');

for (const inspect of [
  { active: false, client_id: clientId, token_type: 'bearer', exp: Math.floor((start + 3_600_000) / 1000) },
  { active: true, client_id: 'cl_other12345678', token_type: 'bearer', exp: Math.floor((start + 3_600_000) / 1000) },
  { active: true, client_id: clientId, token_type: 'mac', exp: Math.floor((start + 3_600_000) / 1000) },
  { active: true, client_id: clientId, token_type: 'bearer', exp: Math.floor((start + 30_000) / 1000) },
  { active: true, client_id: clientId, token_type: 'bearer', exp: Math.floor((start + 3 * 60 * 60 * 1000) / 1000) },
]) {
  const f = fixture({ inspect });
  await hold(() => f.supplier.loadBearerToken(), 'HOLD_PRODUCTION_VERCEL_OAUTH_INTROSPECTION');
}

const inspectHttpFailure = fixture({ introspectionStatus: 503 });
await hold(() => inspectHttpFailure.supplier.loadBearerToken(), 'HOLD_PRODUCTION_VERCEL_OAUTH_INTROSPECTION');

let replaceCalls = 0;
const rotationFailure = fixture({ replace: async () => {
  replaceCalls += 1;
  throw new Error(`do not leak ${refreshTwo}`);
} });
await hold(() => rotationFailure.supplier.loadBearerToken(), 'HOLD_PRODUCTION_VERCEL_OAUTH_ROTATION');
assert.equal(replaceCalls, 1);
const callsAfterFailure = rotationFailure.calls.length;
await hold(() => rotationFailure.supplier.loadBearerToken(), 'HOLD_PRODUCTION_VERCEL_OAUTH_ROTATION');
assert.equal(rotationFailure.calls.length, callsAfterFailure);
pass();

const badAck = fixture({ replace: async () => ({ stored: false, version: 'r2' }) });
await hold(() => badAck.supplier.loadBearerToken(), 'HOLD_PRODUCTION_VERCEL_OAUTH_ROTATION');

const secretFailure = createPublicationProductionVercelOAuthBearerSupplier({
  fetchImpl: async () => { throw new Error(`${clientSecret}:${refreshOne}:${accessOne}`); },
  loadClientCredentials: async () => ({ clientId, clientSecret }),
  loadRefreshCredential: async () => ({ token: refreshOne, version: 'r1' }),
  replaceRefreshCredential: async () => ({ stored: true, version: 'r2' }),
  now: () => start,
});
await hold(() => secretFailure.loadBearerToken(), 'HOLD_PRODUCTION_VERCEL_OAUTH_TOKEN');

const rollback = fixture({ nowValues: [start, start, start - 1] });
await hold(async () => {
  await rollback.supplier.loadBearerToken();
  await rollback.supplier.loadBearerToken();
}, 'HOLD_PRODUCTION_VERCEL_OAUTH_CLOCK');

console.log(`publication production Vercel OAuth bearer tests pass (${groups} groups; source-only fake OAuth provider/store)`);
