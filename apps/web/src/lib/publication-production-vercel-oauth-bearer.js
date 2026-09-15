const OAUTH_SCHEMA = 'publication-production-vercel-oauth-bearer/v1';
const APPROVED_PROJECT_ID = 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7';
const APPROVED_TEAM_ID = 'team_1LuMlacGuM198mRjoID4O3Ct';
const REQUIRED_INSTALLATION_PERMISSIONS = Object.freeze(['read:deployment', 'read:project']);
const TOKEN_ENDPOINT = 'https://api.vercel.com/login/oauth/token';
const INTROSPECTION_ENDPOINT = 'https://api.vercel.com/login/oauth/token/introspect';
const FETCH_TIMEOUT_MS = 3_000;
const MAX_RESPONSE_BYTES = 32_768;
const MIN_ACCESS_TOKEN_MS = 60_000;
const MAX_ACCESS_TOKEN_MS = 2 * 60 * 60 * 1_000;
const REFRESH_SKEW_MS = 2 * 60 * 1_000;

export class PublicationProductionVercelOAuthBearerError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PublicationProductionVercelOAuthBearerError';
    this.code = code;
    this.policyCode = code;
  }
}

const fail = (code) => { throw new PublicationProductionVercelOAuthBearerError(code); };
const need = (condition, code) => { if (!condition) fail(code); };

function plain(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function safeOpaque(value, min = 20, max = 8192) {
  return typeof value === 'string' && value.length >= min && value.length <= max && !/\s/.test(value);
}

function safeVersion(value) {
  return (typeof value === 'string' && value.length >= 1 && value.length <= 256 && !/\s/.test(value))
    || (Number.isSafeInteger(value) && value >= 0);
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
    if (error instanceof PublicationProductionVercelOAuthBearerError) throw error;
    fail(code);
  }
}

async function postForm(fetchImpl, url, form, code) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(form).toString(),
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch {
    fail(code);
  } finally {
    clearTimeout(timer);
  }
  return boundedJson(response, code);
}

async function clientCredentials(loadClientCredentials) {
  let value;
  try { value = await loadClientCredentials(); } catch { fail('HOLD_PRODUCTION_VERCEL_OAUTH_CLIENT'); }
  need(plain(value)
    && typeof value.clientId === 'string'
    && value.clientId.startsWith('cl_')
    && safeOpaque(value.clientId, 8, 256)
    && safeOpaque(value.clientSecret),
  'HOLD_PRODUCTION_VERCEL_OAUTH_CLIENT');
  return { clientId: value.clientId, clientSecret: value.clientSecret };
}

async function refreshCredential(loadRefreshCredential) {
  let value;
  try { value = await loadRefreshCredential(); } catch { fail('HOLD_PRODUCTION_VERCEL_OAUTH_REFRESH_CREDENTIAL'); }
  need(plain(value) && safeOpaque(value.token) && safeVersion(value.version),
    'HOLD_PRODUCTION_VERCEL_OAUTH_REFRESH_CREDENTIAL');
  return { token: value.token, version: value.version };
}

async function persistRotation(replaceRefreshCredential, previous, nextToken) {
  if (nextToken === previous.token) return;
  let result;
  try {
    result = await replaceRefreshCredential({ expectedVersion: previous.version, nextToken });
  } catch {
    fail('HOLD_PRODUCTION_VERCEL_OAUTH_ROTATION');
  }
  need(plain(result) && result.stored === true && safeVersion(result.version),
    'HOLD_PRODUCTION_VERCEL_OAUTH_ROTATION');
}

function tokenExchange(value, observed) {
  const ttlMs = Number.isSafeInteger(value?.expires_in) ? value.expires_in * 1_000 : NaN;
  need(plain(value)
    && safeOpaque(value.access_token)
    && safeOpaque(value.refresh_token)
    && typeof value.token_type === 'string'
    && value.token_type.toLowerCase() === 'bearer'
    && Number.isSafeInteger(ttlMs)
    && ttlMs >= MIN_ACCESS_TOKEN_MS
    && ttlMs <= MAX_ACCESS_TOKEN_MS,
  'HOLD_PRODUCTION_VERCEL_OAUTH_TOKEN');
  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token,
    endpointExpiresAt: observed + ttlMs,
  };
}

function introspection(value, clientId, observed) {
  const expiresAt = Number.isSafeInteger(value?.exp) ? value.exp * 1_000 : NaN;
  need(plain(value)
    && value.active === true
    && value.client_id === clientId
    && typeof value.token_type === 'string'
    && value.token_type.toLowerCase() === 'bearer'
    && Number.isSafeInteger(expiresAt)
    && expiresAt >= observed + MIN_ACCESS_TOKEN_MS
    && expiresAt <= observed + MAX_ACCESS_TOKEN_MS,
  'HOLD_PRODUCTION_VERCEL_OAUTH_INTROSPECTION');
  if (value.iat !== undefined) {
    const issuedAt = Number.isSafeInteger(value.iat) ? value.iat * 1_000 : NaN;
    need(Number.isSafeInteger(issuedAt) && issuedAt <= observed + 30_000,
      'HOLD_PRODUCTION_VERCEL_OAUTH_INTROSPECTION');
  }
  return expiresAt;
}

export function createPublicationProductionVercelOAuthBearerSupplier({
  fetchImpl = globalThis.fetch,
  loadClientCredentials,
  loadRefreshCredential,
  replaceRefreshCredential,
  now = Date.now,
} = {}) {
  need(typeof fetchImpl === 'function'
    && typeof loadClientCredentials === 'function'
    && typeof loadRefreshCredential === 'function'
    && typeof replaceRefreshCredential === 'function'
    && typeof now === 'function',
  'HOLD_PRODUCTION_VERCEL_OAUTH_CONFIG');

  let highestTime = -1;
  let cached = null;
  let inFlight = null;
  let rotationBlocked = false;

  function clock() {
    const value = now();
    need(Number.isSafeInteger(value) && value >= 0 && value >= highestTime,
      'HOLD_PRODUCTION_VERCEL_OAUTH_CLOCK');
    highestTime = value;
    return value;
  }

  async function refreshBearer() {
    need(rotationBlocked === false, 'HOLD_PRODUCTION_VERCEL_OAUTH_ROTATION');
    const observed = clock();
    const client = await clientCredentials(loadClientCredentials);
    const refresh = await refreshCredential(loadRefreshCredential);
    const exchange = tokenExchange(await postForm(fetchImpl, TOKEN_ENDPOINT, {
      grant_type: 'refresh_token',
      client_id: client.clientId,
      client_secret: client.clientSecret,
      refresh_token: refresh.token,
    }, 'HOLD_PRODUCTION_VERCEL_OAUTH_TOKEN'), observed);

    try {
      await persistRotation(replaceRefreshCredential, refresh, exchange.refreshToken);
    } catch (error) {
      rotationBlocked = exchange.refreshToken !== refresh.token;
      throw error;
    }

    const introspectedExpiresAt = introspection(await postForm(fetchImpl, INTROSPECTION_ENDPOINT, {
      token: exchange.accessToken,
    }, 'HOLD_PRODUCTION_VERCEL_OAUTH_INTROSPECTION'), client.clientId, observed);
    const expiresAt = Math.min(exchange.endpointExpiresAt, introspectedExpiresAt);
    need(Number.isSafeInteger(expiresAt) && expiresAt >= observed + MIN_ACCESS_TOKEN_MS,
      'HOLD_PRODUCTION_VERCEL_OAUTH_INTROSPECTION');
    cached = { accessToken: exchange.accessToken, expiresAt };
    return exchange.accessToken;
  }

  async function loadBearerToken() {
    const observed = clock();
    if (cached && observed + REFRESH_SKEW_MS < cached.expiresAt) return cached.accessToken;
    need(rotationBlocked === false, 'HOLD_PRODUCTION_VERCEL_OAUTH_ROTATION');
    if (!inFlight) {
      inFlight = refreshBearer();
      inFlight.finally(() => { inFlight = null; }).catch(() => {});
    }
    return inFlight;
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

export const PUBLICATION_PRODUCTION_VERCEL_OAUTH_SCOPE = Object.freeze({
  schema: OAUTH_SCHEMA,
  projectId: APPROVED_PROJECT_ID,
  teamId: APPROVED_TEAM_ID,
  requiredInstallationPermissions: REQUIRED_INSTALLATION_PERMISSIONS,
  tokenEndpoint: TOKEN_ENDPOINT,
  introspectionEndpoint: INTROSPECTION_ENDPOINT,
  fetchTimeoutMs: FETCH_TIMEOUT_MS,
  refreshSkewMs: REFRESH_SKEW_MS,
  minAccessTokenMs: MIN_ACCESS_TOKEN_MS,
  maxAccessTokenMs: MAX_ACCESS_TOKEN_MS,
  credentialMode: 'project-scoped-readonly-oauth-refresh',
  aliasReadPermissionProof: 'live-rehearsal-required',
  publicationAuthorized: false,
  enforcementActive: false,
});
