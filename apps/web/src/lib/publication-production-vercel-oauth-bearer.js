const CONNECT_SCHEMA = 'publication-production-vercel-connect-bearer/v1';
const APPROVED_PROJECT_ID = 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7';
const APPROVED_TEAM_ID = 'team_1LuMlacGuM198mRjoID4O3Ct';
const APPROVED_OWNER = 'usdimpact';
const APPROVED_REPOSITORY = 'usd-impact-site';
const APPROVED_BRANCH = 'main';
const CONNECTOR_ID_ENV_KEY = 'PUBLICATION_GUARD_VERCEL_CONNECTOR_ID';
const OIDC_TOKEN_ENV_KEY = 'VERCEL_OIDC_TOKEN';
const REQUIRED_PROVIDER_SCOPES = Object.freeze(['read:deployment', 'read:project']);
const CONNECT_TOKEN_ORIGIN = 'https://api.vercel.com/v1/connect/token/';
const FETCH_TIMEOUT_MS = 3_000;
const MAX_RESPONSE_BYTES = 32_768;
const MIN_ACCESS_TOKEN_MS = 60_000;
const MAX_ACCESS_TOKEN_MS = 2 * 60 * 60 * 1_000;
const REFRESH_SKEW_MS = 2 * 60 * 1_000;
const SHA = /^[a-f0-9]{40}$/;
const CONNECTOR_ID = /^scl_[A-Za-z0-9]{6,120}$/;

export class PublicationProductionVercelConnectBearerError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PublicationProductionVercelConnectBearerError';
    this.code = code;
    this.policyCode = code;
  }
}

const fail = (code) => { throw new PublicationProductionVercelConnectBearerError(code); };
const need = (condition, code) => { if (!condition) fail(code); };

function plain(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function safeOpaque(value, min = 20, max = 8192) {
  return typeof value === 'string' && value.length >= min && value.length <= max && !/\s/.test(value);
}

function productionContext(environment) {
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
  'HOLD_PRODUCTION_VERCEL_CONNECT_CONTEXT');
}

export function loadPublicationProductionVercelConnectCredential(environment = process.env) {
  productionContext(environment);
  const connectorId = environment[CONNECTOR_ID_ENV_KEY];
  const oidcToken = environment[OIDC_TOKEN_ENV_KEY];
  need(CONNECTOR_ID.test(connectorId ?? ''), 'HOLD_PRODUCTION_VERCEL_CONNECT_CONNECTOR');
  need(safeOpaque(oidcToken, 40, 16_384), 'HOLD_PRODUCTION_VERCEL_CONNECT_OIDC');
  return Object.freeze({ connectorId, oidcToken });
}

async function boundedJson(response, code) {
  need(response && typeof response.status === 'number' && typeof response.text === 'function', code);
  need(response.status === 200, code);
  let text;
  try { text = await response.text(); } catch { fail(code); }
  need(typeof text === 'string' && Buffer.byteLength(text) <= MAX_RESPONSE_BYTES, code);
  try {
    const value = JSON.parse(text);
    need(plain(value), code);
    return value;
  } catch (error) {
    if (error instanceof PublicationProductionVercelConnectBearerError) throw error;
    fail(code);
  }
}

function normalizeExpiry(value, observed) {
  let expiresAt = value;
  if (typeof expiresAt === 'string' && /^\d{1,16}$/.test(expiresAt)) expiresAt = Number(expiresAt);
  need(Number.isSafeInteger(expiresAt) && expiresAt > 0, 'HOLD_PRODUCTION_VERCEL_CONNECT_TOKEN');
  if (expiresAt < 10_000_000_000) expiresAt *= 1_000;
  need(Number.isSafeInteger(expiresAt)
    && expiresAt >= observed + MIN_ACCESS_TOKEN_MS
    && expiresAt <= observed + MAX_ACCESS_TOKEN_MS,
  'HOLD_PRODUCTION_VERCEL_CONNECT_TOKEN');
  return expiresAt;
}

function connectToken(value, observed) {
  need(plain(value) && safeOpaque(value.token), 'HOLD_PRODUCTION_VERCEL_CONNECT_TOKEN');
  const expiresAt = normalizeExpiry(value.expiresAt, observed);
  return { accessToken: value.token, expiresAt };
}

async function connectCredential(loadConnectCredential) {
  let value;
  try { value = await loadConnectCredential(); } catch { fail('HOLD_PRODUCTION_VERCEL_CONNECT_CREDENTIAL'); }
  need(plain(value)
    && CONNECTOR_ID.test(value.connectorId ?? '')
    && safeOpaque(value.oidcToken, 40, 16_384),
  'HOLD_PRODUCTION_VERCEL_CONNECT_CREDENTIAL');
  return { connectorId: value.connectorId, oidcToken: value.oidcToken };
}

async function requestConnectToken(fetchImpl, credential) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(`${CONNECT_TOKEN_ORIGIN}${encodeURIComponent(credential.connectorId)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credential.oidcToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: { type: 'app' },
        scopes: [...REQUIRED_PROVIDER_SCOPES],
      }),
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch {
    fail('HOLD_PRODUCTION_VERCEL_CONNECT_TOKEN');
  } finally {
    clearTimeout(timer);
  }
  return boundedJson(response, 'HOLD_PRODUCTION_VERCEL_CONNECT_TOKEN');
}

export function createPublicationProductionVercelConnectBearerSupplier({
  fetchImpl = globalThis.fetch,
  loadConnectCredential = () => loadPublicationProductionVercelConnectCredential(process.env),
  now = Date.now,
} = {}) {
  need(typeof fetchImpl === 'function'
    && typeof loadConnectCredential === 'function'
    && typeof now === 'function',
  'HOLD_PRODUCTION_VERCEL_CONNECT_CONFIG');

  let highestTime = -1;
  let cached = null;
  let inFlight = null;

  function clock() {
    const value = now();
    need(Number.isSafeInteger(value) && value >= 0 && value >= highestTime,
      'HOLD_PRODUCTION_VERCEL_CONNECT_CLOCK');
    highestTime = value;
    return value;
  }

  async function acquireBearer() {
    const observed = clock();
    const credential = await connectCredential(loadConnectCredential);
    const token = connectToken(await requestConnectToken(fetchImpl, credential), observed);
    cached = token;
    return token.accessToken;
  }

  async function loadBearerToken() {
    const observed = clock();
    if (cached && observed + REFRESH_SKEW_MS < cached.expiresAt) return cached.accessToken;
    if (!inFlight) {
      inFlight = acquireBearer();
      inFlight.finally(() => { inFlight = null; }).catch(() => {});
    }
    return inFlight;
  }

  return Object.freeze({
    publicationAuthorized: false,
    enforcementActive: false,
    projectId: APPROVED_PROJECT_ID,
    teamId: APPROVED_TEAM_ID,
    requiredInstallationPermissions: REQUIRED_PROVIDER_SCOPES,
    requiredProviderScopes: REQUIRED_PROVIDER_SCOPES,
    loadBearerToken,
  });
}

export const PUBLICATION_PRODUCTION_VERCEL_CONNECT_SCOPE = Object.freeze({
  schema: CONNECT_SCHEMA,
  projectId: APPROVED_PROJECT_ID,
  teamId: APPROVED_TEAM_ID,
  requiredInstallationPermissions: REQUIRED_PROVIDER_SCOPES,
  requiredProviderScopes: REQUIRED_PROVIDER_SCOPES,
  connectorIdEnvKey: CONNECTOR_ID_ENV_KEY,
  oidcTokenEnvKey: OIDC_TOKEN_ENV_KEY,
  tokenEndpointOrigin: CONNECT_TOKEN_ORIGIN,
  fetchTimeoutMs: FETCH_TIMEOUT_MS,
  refreshSkewMs: REFRESH_SKEW_MS,
  minAccessTokenMs: MIN_ACCESS_TOKEN_MS,
  maxAccessTokenMs: MAX_ACCESS_TOKEN_MS,
  credentialMode: 'vercel-connect-project-oidc',
  connectorProjectLink: APPROVED_PROJECT_ID,
  connectorEnvironmentLink: 'production',
  providerTokenDurableStorage: false,
  legacyClientSecretRequired: false,
  legacyRefreshStoreRequired: false,
  aliasReadPermissionProof: 'live-rehearsal-required',
  publicationAuthorized: false,
  enforcementActive: false,
});

// Compatibility aliases keep the already-reviewed file/import surface stable while
// explicitly retiring the custom client-secret/refresh-token design before activation.
export const PublicationProductionVercelOAuthBearerError = PublicationProductionVercelConnectBearerError;
export const createPublicationProductionVercelOAuthBearerSupplier = createPublicationProductionVercelConnectBearerSupplier;
export const PUBLICATION_PRODUCTION_VERCEL_OAUTH_SCOPE = PUBLICATION_PRODUCTION_VERCEL_CONNECT_SCOPE;
export function loadPublicationProductionVercelOAuthClientCredentials() {
  fail('HOLD_PRODUCTION_VERCEL_CONNECT_LEGACY_OAUTH_DISABLED');
}
