import assert from 'node:assert/strict';
import {
  PUBLICATION_PRODUCTION_VERCEL_INTEGRATION_SCOPE,
  PublicationProductionVercelIntegrationBearerError,
  createPublicationProductionVercelIntegrationBearerSupplier,
} from '../src/lib/publication-production-vercel-integration-bearer.js';

let groups = 0;
const pass = () => { groups += 1; };
const token = 'vcp_fixture_private_integration_abcdefghijklmnopqrstuvwxyz0123456789';
const environment = Object.freeze({
  VERCEL: '1',
  VERCEL_ENV: 'production',
  VERCEL_TARGET_ENV: 'production',
  VERCEL_PROJECT_ID: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7',
  VERCEL_GIT_PROVIDER: 'github',
  VERCEL_GIT_REPO_OWNER: 'usdimpact',
  VERCEL_GIT_REPO_SLUG: 'usd-impact-site',
  VERCEL_GIT_COMMIT_REF: 'main',
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  PUBLICATION_GUARD_VERCEL_INTEGRATION_ACCESS_TOKEN: token,
});

async function hold(work, code) {
  await assert.rejects(work, (error) => error instanceof PublicationProductionVercelIntegrationBearerError
    && error.code === code && error.policyCode === code && error.message === code);
  pass();
}

assert.equal(PUBLICATION_PRODUCTION_VERCEL_INTEGRATION_SCOPE.schema,
  'publication-production-vercel-integration-bearer/v1');
assert.equal(PUBLICATION_PRODUCTION_VERCEL_INTEGRATION_SCOPE.projectId,
  'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7');
assert.deepEqual(PUBLICATION_PRODUCTION_VERCEL_INTEGRATION_SCOPE.requiredInstallationPermissions, [
  'read:integration-configuration',
  'read:deployment',
  'read:project',
]);
assert.equal(PUBLICATION_PRODUCTION_VERCEL_INTEGRATION_SCOPE.credentialMode,
  'private-integration-static-access-token');
assert.equal(PUBLICATION_PRODUCTION_VERCEL_INTEGRATION_SCOPE.projectAccess, 'single-project');
assert.equal(PUBLICATION_PRODUCTION_VERCEL_INTEGRATION_SCOPE.publicationAuthorized, false);
assert.equal(PUBLICATION_PRODUCTION_VERCEL_INTEGRATION_SCOPE.enforcementActive, false);
pass();

const supplier = createPublicationProductionVercelIntegrationBearerSupplier({ environment });
assert.equal(supplier.publicationAuthorized, false);
assert.equal(supplier.enforcementActive, false);
assert.equal(await supplier.loadBearerToken(), token);
assert.equal(await supplier.loadBearerToken(), token);
assert.ok(Object.isFrozen(supplier));
pass();

for (const patch of [
  { VERCEL: '0' },
  { VERCEL_ENV: 'preview' },
  { VERCEL_TARGET_ENV: 'preview' },
  { VERCEL_PROJECT_ID: 'prj_other' },
  { VERCEL_GIT_PROVIDER: 'gitlab' },
  { VERCEL_GIT_REPO_OWNER: 'other' },
  { VERCEL_GIT_REPO_SLUG: 'other' },
  { VERCEL_GIT_COMMIT_REF: 'develop' },
  { VERCEL_GIT_COMMIT_SHA: 'bad' },
]) {
  assert.throws(
    () => createPublicationProductionVercelIntegrationBearerSupplier({
      environment: { ...environment, ...patch },
    }),
    (error) => error instanceof PublicationProductionVercelIntegrationBearerError
      && error.code === 'HOLD_PRODUCTION_VERCEL_INTEGRATION_CONTEXT',
  );
  pass();
}

for (const invalidToken of [undefined, '', 'short', 'x'.repeat(4097), `secret with spaces`]) {
  const candidate = createPublicationProductionVercelIntegrationBearerSupplier({
    environment: {
      ...environment,
      PUBLICATION_GUARD_VERCEL_INTEGRATION_ACCESS_TOKEN: invalidToken,
    },
  });
  await hold(() => candidate.loadBearerToken(), 'HOLD_PRODUCTION_VERCEL_INTEGRATION_CREDENTIAL');
}

const secretBearingToken = `do-not-leak-${'z'.repeat(64)}`;
const missing = createPublicationProductionVercelIntegrationBearerSupplier({
  environment: {
    ...environment,
    PUBLICATION_GUARD_VERCEL_INTEGRATION_ACCESS_TOKEN: undefined,
  },
});
await assert.rejects(() => missing.loadBearerToken(), (error) => {
  assert.doesNotMatch(error.message, new RegExp(secretBearingToken));
  return error.code === 'HOLD_PRODUCTION_VERCEL_INTEGRATION_CREDENTIAL';
});
pass();

console.log(`publication production Vercel Integration bearer tests pass (${groups} groups; source-only)`);
