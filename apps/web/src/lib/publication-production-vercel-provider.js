import { createHash } from 'node:crypto';

const PROVIDER_SCHEMA = 'publication-production-provider-state/v1';
const RENDER_SCHEMA = 'publication-render-inputs/v1';
const APPROVED_REPOSITORY = 'usdimpact/usd-impact-site';
const APPROVED_PROJECT_ID = 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7';
const APPROVED_TEAM_ID = 'team_1LuMlacGuM198mRjoID4O3Ct';
const APPROVED_OWNER = 'usdimpact';
const APPROVED_REPO = 'usd-impact-site';
const APPROVED_BRANCH = 'main';
const API_ORIGIN = 'https://api.vercel.com';
const MAX_PROVIDER_MS = 15_000;
const PROVIDER_TTL_MS = 5_000;
const FETCH_TIMEOUT_MS = 3_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_BUNDLE_BYTES = 20_000_000;
const SHA = /^[a-f0-9]{40}$/;
const HEX = /^[a-f0-9]{64}$/;
const DEPLOYMENT = /^dpl_[A-Za-z0-9]{8,80}$/;
const DEPLOYMENT_HOST = /^[a-z0-9][a-z0-9-]{1,98}\.vercel\.app$/;
const ROUTE = /^\/news\/(?:\d{4}-\d{2}-\d{2}|catalysts\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const APPROVED_PUBLIC_ALIASES = Object.freeze([
  'usd-impact-site-git-main-usd-impact.vercel.app',
  'usd-impact-site-usd-impact.vercel.app',
  'usd-impact-site.vercel.app',
  'usd-impact.com',
  'www.usd-impact.com',
]);

export class PublicationProductionVercelProviderError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PublicationProductionVercelProviderError';
    this.code = code;
    this.policyCode = code;
  }
}

const fail = (code) => { throw new PublicationProductionVercelProviderError(code); };
const need = (condition, code) => { if (!condition) fail(code); };
const digest = (value) => createHash('sha256').update(value).digest('hex');

function plain(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) freeze(nested);
    Object.freeze(value);
  }
  return value;
}

function runtimeContext(environment) {
  need(environment && typeof environment === 'object', 'HOLD_PRODUCTION_PROVIDER_CONTEXT');
  need(environment.VERCEL === '1'
    && environment.VERCEL_ENV === 'production'
    && environment.VERCEL_TARGET_ENV === 'production'
    && environment.VERCEL_PROJECT_ID === APPROVED_PROJECT_ID
    && environment.VERCEL_GIT_PROVIDER === 'github'
    && environment.VERCEL_GIT_REPO_OWNER === APPROVED_OWNER
    && environment.VERCEL_GIT_REPO_SLUG === APPROVED_REPO
    && environment.VERCEL_GIT_COMMIT_REF === APPROVED_BRANCH
    && SHA.test(environment.VERCEL_GIT_COMMIT_SHA ?? '')
    && DEPLOYMENT.test(environment.VERCEL_DEPLOYMENT_ID ?? '')
    && DEPLOYMENT_HOST.test(environment.VERCEL_URL ?? ''),
  'HOLD_PRODUCTION_PROVIDER_CONTEXT');
  return freeze({
    repository: APPROVED_REPOSITORY,
    projectId: APPROVED_PROJECT_ID,
    teamId: APPROVED_TEAM_ID,
    deploymentId: environment.VERCEL_DEPLOYMENT_ID,
    deploymentHost: environment.VERCEL_URL,
    commitSha: environment.VERCEL_GIT_COMMIT_SHA,
  });
}

function localArtifact(renderBundle, commitSha) {
  need(plain(renderBundle) && renderBundle.schema === RENDER_SCHEMA
    && renderBundle.siteOrigin === 'https://www.usd-impact.com'
    && renderBundle.buildCommitSha === commitSha
    && Array.isArray(renderBundle.publications)
    && renderBundle.publications.length > 0
    && renderBundle.publications.length <= 500
    && plain(renderBundle.static),
  'HOLD_PRODUCTION_PROVIDER_ARTIFACT');
  need(HEX.test(renderBundle.static.homepageSha256 ?? '')
    && HEX.test(renderBundle.static.newsSha256 ?? '')
    && Array.isArray(renderBundle.static.sitemapBaseEntries)
    && renderBundle.static.sitemapBaseEntries.length <= 1000,
  'HOLD_PRODUCTION_PROVIDER_ARTIFACT');
  const seen = new Set();
  const entries = renderBundle.publications.map((item) => {
    need(plain(item) && ROUTE.test(item.path ?? '')
      && HEX.test(item.sourceSha256 ?? '')
      && HEX.test(item.htmlSha256 ?? '')
      && !seen.has(item.path),
    'HOLD_PRODUCTION_PROVIDER_ARTIFACT');
    seen.add(item.path);
    return { path: item.path, sourceSha256: item.sourceSha256 };
  }).sort((a, b) => a.path.localeCompare(b.path));
  let payload;
  try { payload = JSON.stringify(renderBundle); } catch { fail('HOLD_PRODUCTION_PROVIDER_ARTIFACT'); }
  need(typeof payload === 'string' && Buffer.byteLength(payload) <= MAX_BUNDLE_BYTES,
    'HOLD_PRODUCTION_PROVIDER_ARTIFACT');
  return freeze({
    artifactSha256: digest(payload),
    manifestSha256: digest(JSON.stringify(entries)),
    entries: freeze(entries),
  });
}

function deploymentIdentity(value, runtime) {
  need(plain(value), 'HOLD_PRODUCTION_PROVIDER_DEPLOYMENT');
  const id = value.id ?? value.uid;
  const projectId = value.project?.id ?? value.projectId;
  const meta = plain(value.meta) ? value.meta : {};
  const git = plain(value.gitSource) ? value.gitSource : {};
  const commitSha = git.sha ?? meta.githubCommitSha;
  const branch = git.ref ?? meta.githubCommitRef;
  const owner = git.org ?? git.owner ?? meta.githubCommitOrg ?? meta.githubOrg;
  const repo = git.repo ?? meta.githubCommitRepo ?? meta.githubRepo;
  const ready = value.readyState ?? value.state;
  need(id === runtime.deploymentId
    && value.url === runtime.deploymentHost
    && projectId === runtime.projectId
    && value.target === 'production'
    && ready === 'READY'
    && commitSha === runtime.commitSha
    && branch === APPROVED_BRANCH
    && owner === APPROVED_OWNER
    && repo === APPROVED_REPO,
  'HOLD_PRODUCTION_PROVIDER_BINDING');
  return freeze({
    deploymentId: id,
    deploymentHost: value.url,
    commitSha,
  });
}

function aliasInventory(value) {
  need(plain(value) && Array.isArray(value.aliases) && value.aliases.length <= 50,
    'HOLD_PRODUCTION_PROVIDER_ALIASES');
  const aliases = value.aliases.map((row) => {
    const alias = typeof row === 'string' ? row : row?.alias;
    need(typeof alias === 'string' && alias.length <= 253 && HOST.test(alias),
      'HOLD_PRODUCTION_PROVIDER_ALIASES');
    return alias;
  }).sort();
  need(new Set(aliases).size === aliases.length
    && aliases.length === APPROVED_PUBLIC_ALIASES.length
    && aliases.every((alias, index) => alias === APPROVED_PUBLIC_ALIASES[index]),
  'HOLD_PRODUCTION_PROVIDER_ALIASES');
  return freeze(aliases);
}

async function jsonResponse(response, code) {
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
    if (error instanceof PublicationProductionVercelProviderError) throw error;
    fail(code);
  }
}

async function bearerCredential(loadBearerToken) {
  let token;
  try { token = await loadBearerToken(); } catch { fail('HOLD_PRODUCTION_PROVIDER_CREDENTIAL'); }
  need(typeof token === 'string' && token.length >= 20 && token.length <= 4096 && !/\s/.test(token),
    'HOLD_PRODUCTION_PROVIDER_CREDENTIAL');
  return token;
}

async function authenticatedGet(fetchImpl, runtime, token, path, code) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(`${API_ORIGIN}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch {
    fail(code);
  } finally {
    clearTimeout(timer);
  }
  return jsonResponse(response, code);
}

export function createPublicationProductionVercelProviderStateLoader({
  environment = process.env,
  fetchImpl = globalThis.fetch,
  renderBundle,
  loadBearerToken,
  now = Date.now,
} = {}) {
  const runtime = runtimeContext(environment);
  need(typeof fetchImpl === 'function' && typeof loadBearerToken === 'function' && typeof now === 'function',
    'HOLD_PRODUCTION_PROVIDER_CONFIG');
  const artifact = localArtifact(renderBundle, runtime.commitSha);
  let highestTime = -1;
  function clock() {
    const value = now();
    need(Number.isSafeInteger(value) && value >= 0 && value >= highestTime,
      'HOLD_PRODUCTION_PROVIDER_CLOCK');
    highestTime = value;
    return value;
  }

  async function loadProviderState() {
    const token = await bearerCredential(loadBearerToken);
    const deployment = deploymentIdentity(await authenticatedGet(
      fetchImpl,
      runtime,
      token,
      `/v13/deployments/${encodeURIComponent(runtime.deploymentId)}?withGitRepoInfo=true&teamId=${encodeURIComponent(runtime.teamId)}`,
      'HOLD_PRODUCTION_PROVIDER_DEPLOYMENT',
    ), runtime);
    const aliases = aliasInventory(await authenticatedGet(
      fetchImpl,
      runtime,
      token,
      `/v2/deployments/${encodeURIComponent(runtime.deploymentId)}/aliases?teamId=${encodeURIComponent(runtime.teamId)}`,
      'HOLD_PRODUCTION_PROVIDER_ALIASES',
    ));
    const observed = clock();
    const validUntil = observed + PROVIDER_TTL_MS;
    need(validUntil - observed <= MAX_PROVIDER_MS, 'HOLD_PRODUCTION_PROVIDER_CLOCK');
    return freeze({
      schema: PROVIDER_SCHEMA,
      repository: runtime.repository,
      projectId: runtime.projectId,
      teamId: runtime.teamId,
      target: 'production',
      // Deployment identity and assigned aliases do not verify effective access.
      // The authority adapter must reject this metadata-only observation.
      exposure: 'unverified',
      source: 'git',
      deploymentId: deployment.deploymentId,
      deploymentHost: deployment.deploymentHost,
      commitSha: deployment.commitSha,
      artifactSha256: artifact.artifactSha256,
      manifestSha256: artifact.manifestSha256,
      entries: artifact.entries,
      publicAliases: aliases,
      observedAt: new Date(observed).toISOString(),
      validUntil: new Date(validUntil).toISOString(),
    });
  }

  return Object.freeze({
    publicationAuthorized: false,
    enforcementActive: false,
    runtime: freeze({
      repository: runtime.repository,
      projectId: runtime.projectId,
      teamId: runtime.teamId,
      deploymentId: runtime.deploymentId,
      deploymentHost: runtime.deploymentHost,
      commitSha: runtime.commitSha,
    }),
    loadProviderState,
  });
}

export const PUBLICATION_PRODUCTION_VERCEL_PROVIDER_SCOPE = Object.freeze({
  schema: PROVIDER_SCHEMA,
  renderSchema: RENDER_SCHEMA,
  repository: APPROVED_REPOSITORY,
  projectId: APPROVED_PROJECT_ID,
  teamId: APPROVED_TEAM_ID,
  branch: APPROVED_BRANCH,
  credentialMode: 'trusted-bearer-supplier',
  approvedPublicAliases: APPROVED_PUBLIC_ALIASES,
  maxProviderMs: MAX_PROVIDER_MS,
  providerTtlMs: PROVIDER_TTL_MS,
  publicationAuthorized: false,
  enforcementActive: false,
});
