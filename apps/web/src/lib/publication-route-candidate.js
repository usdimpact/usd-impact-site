import { createHmac, timingSafeEqual } from 'node:crypto';

// Dormant source-only route contract for #558/#559. It does not register routing.
// Production activation requires a separate approved source/configuration change.
export const PUBLICATION_ROUTE_CANDIDATE = Object.freeze({
  schema: 'publication-route-candidate/v1',
  active: false,
  internalPath: '/api/publication-guard',
  modeEnvironmentKey: 'PUBLICATION_GUARD_ROUTE_CANDIDATE',
  secretEnvironmentKey: 'PUBLICATION_GUARD_ROUTE_SECRET',
  approvedPreviewMode: 'preview-dormant',
  approvedPreviewBranch: 'publishing/558-calendar-validation',
  approvedProjectId: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7',
  approvedRepository: 'usdimpact/usd-impact-site',
  publicProductionHosts: Object.freeze([
    'www.usd-impact.com',
    'usd-impact.com',
    'usd-impact-site.vercel.app',
    'usd-impact-site-usd-impact.vercel.app',
    'usd-impact-site-git-main-usd-impact.vercel.app',
  ]),
});

export const PUBLICATION_ROUTE_HEADERS = Object.freeze({
  path: 'x-usd-impact-publication-path',
  issuedAt: 'x-usd-impact-publication-issued-at',
  mac: 'x-usd-impact-publication-mac',
});

const ARTICLE = /^\/news\/(?:\d{4}-\d{2}-\d{2}|catalysts\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const STATIC_SURFACES = Object.freeze(new Map([
  ['/', 'homepage'],
  ['/news', 'news-composite'],
  ['/news/feed.xml', 'feed'],
  ['/news/latest.json', 'latest-json'],
  ['/sitemap-0.xml', 'sitemap'],
]));
const SHA = /^[a-f0-9]{40}$/;
const MAC = /^[a-f0-9]{64}$/;
const HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/;
const MAX_ENVELOPE_AGE_MS = 10_000;

export class PublicationRouteCandidateError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PublicationRouteCandidateError';
    this.code = code;
  }
}

const fail = (code) => { throw new PublicationRouteCandidateError(code); };
const need = (condition, code) => { if (!condition) fail(code); };

export function normalizePublicationHost(value) {
  const text = String(value ?? '').trim().toLowerCase();
  const host = text.startsWith('[') ? '' : text.replace(/:\d{1,5}$/, '');
  need(host.length > 0 && host.length <= 253 && HOST.test(host), 'HOLD_ROUTE_HOST');
  return host;
}

export function resolvePublicationSurface(pathname) {
  if (typeof pathname !== 'string' || pathname.length > 2048 || !pathname.startsWith('/')) return null;
  if (ARTICLE.test(pathname)) return Object.freeze({ kind: 'governed', surface: 'article', path: pathname });
  const surface = STATIC_SURFACES.get(pathname);
  return surface ? Object.freeze({ kind: 'governed', surface, path: pathname }) : null;
}

export function isPublicationStaticAlias(pathname) {
  if (typeof pathname !== 'string') return false;
  if (pathname === '/index.html' || pathname === '/news/' || pathname === '/news/index.html') return true;
  if (pathname === '/news/feed.xml/' || pathname === '/news/latest.json/' || pathname === '/sitemap-0.xml/') return true;
  const canonical = pathname
    .replace(/\/index\.html$/, '')
    .replace(/\.html$/, '')
    .replace(/\/$/, '');
  return canonical !== pathname && ARTICLE.test(canonical);
}

export function classifyPublicationPath(pathname) {
  const governed = resolvePublicationSurface(pathname);
  if (governed) return governed;
  if (isPublicationStaticAlias(pathname)) {
    return Object.freeze({ kind: 'deny-static-alias', path: pathname });
  }
  return Object.freeze({ kind: 'unrelated', path: pathname });
}

export function isPublicProductionAlias(host) {
  let normalized;
  try { normalized = normalizePublicationHost(host); } catch { return false; }
  return PUBLICATION_ROUTE_CANDIDATE.publicProductionHosts.includes(normalized);
}

export function classifyPublicationHost(host, environment = {}) {
  const normalized = normalizePublicationHost(host);
  if (environment.VERCEL_ENV === 'production') {
    need(isPublicProductionAlias(normalized), 'HOLD_ROUTE_HOST');
    return Object.freeze({ kind: 'production-public-alias', host: normalized });
  }
  if (environment.VERCEL_ENV === 'preview') {
    const deploymentHost = normalizePublicationHost(environment.VERCEL_URL);
    need(normalized === deploymentHost, 'HOLD_ROUTE_HOST');
    return Object.freeze({ kind: 'protected-preview-deployment', host: normalized });
  }
  fail('HOLD_ROUTE_ENVIRONMENT');
}

export function assertDormantPreviewRouteContext(environment = {}) {
  need(environment[PUBLICATION_ROUTE_CANDIDATE.modeEnvironmentKey]
    === PUBLICATION_ROUTE_CANDIDATE.approvedPreviewMode, 'HOLD_ROUTE_DORMANT');
  need(environment.VERCEL === '1' && environment.VERCEL_ENV === 'preview'
    && environment.VERCEL_TARGET_ENV === 'preview', 'HOLD_ROUTE_ENVIRONMENT');
  need(environment.VERCEL_PROJECT_ID === PUBLICATION_ROUTE_CANDIDATE.approvedProjectId,
    'HOLD_ROUTE_PROJECT');
  need(environment.VERCEL_GIT_PROVIDER === 'github'
    && `${environment.VERCEL_GIT_REPO_OWNER}/${environment.VERCEL_GIT_REPO_SLUG}`
      === PUBLICATION_ROUTE_CANDIDATE.approvedRepository, 'HOLD_ROUTE_REPOSITORY');
  need(environment.VERCEL_GIT_COMMIT_REF === PUBLICATION_ROUTE_CANDIDATE.approvedPreviewBranch,
    'HOLD_ROUTE_BRANCH');
  need(SHA.test(environment.VERCEL_GIT_COMMIT_SHA ?? ''), 'HOLD_ROUTE_COMMIT');
  classifyPublicationHost(environment.VERCEL_URL, environment);
  return Object.freeze({
    target: 'preview',
    exposure: 'protected-preview',
    projectId: environment.VERCEL_PROJECT_ID,
    repository: PUBLICATION_ROUTE_CANDIDATE.approvedRepository,
    branch: environment.VERCEL_GIT_COMMIT_REF,
    commitSha: environment.VERCEL_GIT_COMMIT_SHA,
    deploymentHost: normalizePublicationHost(environment.VERCEL_URL),
    publicationAuthorized: false,
    enforcementActive: false,
  });
}

function exactHeader(request, name) {
  const lower = name.toLowerCase();
  if (Array.isArray(request?.rawHeaders)) {
    const values = [];
    for (let i = 0; i < request.rawHeaders.length; i += 2) {
      if (String(request.rawHeaders[i] ?? '').toLowerCase() === lower) values.push(request.rawHeaders[i + 1]);
    }
    need(values.length === 1 && typeof values[0] === 'string', 'HOLD_ROUTE_ENVELOPE');
    return values[0];
  }
  const headers = request?.headers;
  const value = typeof headers?.get === 'function' ? headers.get(name)
    : headers?.[lower] ?? headers?.[name];
  need(typeof value === 'string' && value.length > 0, 'HOLD_ROUTE_ENVELOPE');
  return value;
}

function message({ method, host, path, issuedAt, deploymentHost, commitSha }) {
  return [method, host, path, String(issuedAt), deploymentHost, commitSha].join('\n');
}

function secretBuffer(secret) {
  const value = Buffer.from(String(secret ?? ''), 'utf8');
  need(value.length >= 32 && value.length <= 256, 'HOLD_ROUTE_SECRET');
  return value;
}

export function signDormantPreviewRouteEnvelope({ method = 'GET', host, path, issuedAt, environment, secret }) {
  const runtime = assertDormantPreviewRouteContext(environment);
  need(['GET', 'HEAD'].includes(method), 'HOLD_ROUTE_METHOD');
  const normalizedHost = normalizePublicationHost(host);
  need(normalizedHost === runtime.deploymentHost, 'HOLD_ROUTE_HOST');
  const route = resolvePublicationSurface(path);
  need(route, 'HOLD_ROUTE_NOT_GOVERNED');
  need(Number.isSafeInteger(issuedAt) && issuedAt >= 0, 'HOLD_ROUTE_ENVELOPE');
  const mac = createHmac('sha256', secretBuffer(secret)).update(message({
    method, host: normalizedHost, path: route.path, issuedAt,
    deploymentHost: runtime.deploymentHost, commitSha: runtime.commitSha,
  })).digest('hex');
  return Object.freeze({
    [PUBLICATION_ROUTE_HEADERS.path]: route.path,
    [PUBLICATION_ROUTE_HEADERS.issuedAt]: String(issuedAt),
    [PUBLICATION_ROUTE_HEADERS.mac]: mac,
  });
}

export function verifyDormantPreviewRouteEnvelope({ request, environment, secret, now = Date.now } = {}) {
  const runtime = assertDormantPreviewRouteContext(environment);
  need(request && ['GET', 'HEAD'].includes(request.method), 'HOLD_ROUTE_METHOD');
  const host = normalizePublicationHost(exactHeader(request, 'host'));
  need(host === runtime.deploymentHost, 'HOLD_ROUTE_HOST');
  const path = exactHeader(request, PUBLICATION_ROUTE_HEADERS.path);
  const route = resolvePublicationSurface(path);
  need(route, 'HOLD_ROUTE_NOT_GOVERNED');
  const issuedText = exactHeader(request, PUBLICATION_ROUTE_HEADERS.issuedAt);
  need(/^\d{1,16}$/.test(issuedText), 'HOLD_ROUTE_ENVELOPE');
  const issuedAt = Number(issuedText);
  const current = now();
  need(Number.isSafeInteger(current) && current >= 0 && Number.isSafeInteger(issuedAt)
    && issuedAt <= current && current - issuedAt <= MAX_ENVELOPE_AGE_MS, 'HOLD_ROUTE_ENVELOPE_EXPIRED');
  const supplied = exactHeader(request, PUBLICATION_ROUTE_HEADERS.mac);
  need(MAC.test(supplied), 'HOLD_ROUTE_ENVELOPE');
  const expected = createHmac('sha256', secretBuffer(secret)).update(message({
    method: request.method, host, path: route.path, issuedAt,
    deploymentHost: runtime.deploymentHost, commitSha: runtime.commitSha,
  })).digest('hex');
  need(timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(expected, 'hex')), 'HOLD_ROUTE_ENVELOPE');
  return Object.freeze({ ...route, host, issuedAt, runtime,
    publicationAuthorized: false, enforcementActive: false });
}

export function publicationRouteCandidatePlan() {
  return Object.freeze({
    ...PUBLICATION_ROUTE_CANDIDATE,
    canonicalRoutes: Object.freeze([
      '/', '/news', '/news/:date', '/news/catalysts/:slug',
      '/news/feed.xml', '/news/latest.json', '/sitemap-0.xml',
    ]),
    rawStaticAliases: 'deny-before-render',
    routeBinding: 'server-signed-preview-envelope-required',
    productionActivation: 'not-implemented',
    publicationAuthorized: false,
    enforcementActive: false,
  });
}
