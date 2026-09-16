const INTEGRATION_SCHEMA = 'publication-production-vercel-integration-bearer/v1';
const APPROVED_PROJECT_ID = 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7';
const APPROVED_TEAM_ID = 'team_1LuMlacGuM198mRjoID4O3Ct';
const APPROVED_OWNER = 'usdimpact';
const APPROVED_REPOSITORY = 'usd-impact-site';
const APPROVED_BRANCH = 'main';
const ACCESS_TOKEN_ENV_KEY = 'PUBLICATION_GUARD_VERCEL_INTEGRATION_ACCESS_TOKEN';
const REQUIRED_INSTALLATION_PERMISSIONS = Object.freeze([
  'read:integration-configuration',
  'read:deployment',
  'read:project',
]);
const SHA = /^[a-f0-9]{40}$/;
const TOKEN_MIN = 20;
const TOKEN_MAX = 4096;

export class PublicationProductionVercelIntegrationBearerError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PublicationProductionVercelIntegrationBearerError';
    this.code = code;
    this.policyCode = code;
  }
}

const fail = (code) => { throw new PublicationProductionVercelIntegrationBearerError(code); };
const need = (condition, code) => { if (!condition) fail(code); };

function assertContext(environment) {
  need(environment && typeof environment === 'object'
    && environment.VERCEL === '1'
    && environment.VERCEL_ENV === 'production'
    && environment.VERCEL_TARGET_ENV === 'production'
    && environment.VERCEL_PROJECT_ID === APPROVED_PROJECT_ID
    && environment.VERCEL_GIT_PROVIDER === 'github'
    && environment.VERCEL_GIT_REPO_OWNER === APPROVED_OWNER
    && environment.VERCEL_GIT_REPO_SLUG === APPROVED_REPOSITORY
    && environment.VERCEL_GIT_COMMIT_REF === APPROVED_BRANCH
    && SHA.test(environment.VERCEL_GIT_COMMIT_SHA ?? ''),
  'HOLD_PRODUCTION_VERCEL_INTEGRATION_CONTEXT');
}

function accessToken(environment) {
  const token = environment[ACCESS_TOKEN_ENV_KEY];
  need(typeof token === 'string'
    && token.length >= TOKEN_MIN
    && token.length <= TOKEN_MAX
    && !/\s/.test(token),
  'HOLD_PRODUCTION_VERCEL_INTEGRATION_CREDENTIAL');
  return token;
}

export function createPublicationProductionVercelIntegrationBearerSupplier({
  environment = process.env,
} = {}) {
  assertContext(environment);

  async function loadBearerToken() {
    return accessToken(environment);
  }

  return Object.freeze({
    publicationAuthorized: false,
    enforcementActive: false,
    projectId: APPROVED_PROJECT_ID,
    teamId: APPROVED_TEAM_ID,
    requiredInstallationPermissions: REQUIRED_INSTALLATION_PERMISSIONS,
    loadBearerToken,
  });
}

export const PUBLICATION_PRODUCTION_VERCEL_INTEGRATION_SCOPE = Object.freeze({
  schema: INTEGRATION_SCHEMA,
  projectId: APPROVED_PROJECT_ID,
  teamId: APPROVED_TEAM_ID,
  repository: `${APPROVED_OWNER}/${APPROVED_REPOSITORY}`,
  branch: APPROVED_BRANCH,
  accessTokenEnvKey: ACCESS_TOKEN_ENV_KEY,
  requiredInstallationPermissions: REQUIRED_INSTALLATION_PERMISSIONS,
  credentialMode: 'private-integration-static-access-token',
  projectAccess: 'single-project',
  tokenValidation: 'live-read-only-provider-rehearsal-required',
  rotationMode: 'operator-controlled-replacement',
  publicationAuthorized: false,
  enforcementActive: false,
});
