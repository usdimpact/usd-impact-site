import {
  PUBLICATION_ROUTE_CANDIDATE,
  PublicationRouteCandidateError,
  classifyPublicationPath,
  normalizePublicationHost,
  signDormantPreviewRouteEnvelope,
} from './publication-route-candidate.js';

export const PUBLICATION_PUBLIC_ROUTE_WIRING = Object.freeze({
  schema: 'publication-public-route-wiring/v1',
  modeEnvironmentKey: 'PUBLICATION_GUARD_PUBLIC_ROUTE_WIRING',
  approvedPreviewMode: 'preview-dormant-v1',
  internalPath: PUBLICATION_ROUTE_CANDIDATE.internalPath,
  publicationAuthorized: false,
  enforcementActive: false,
});

export class PublicationPublicRouteWiringError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PublicationPublicRouteWiringError';
    this.code = code;
  }
}

const fail = (code) => { throw new PublicationPublicRouteWiringError(code); };
const need = (condition, code) => { if (!condition) fail(code); };
const result = (value) => Object.freeze({
  ...value,
  publicationAuthorized: false,
  enforcementActive: false,
});
const denied = (status, decision, routeKind) => result({ action: 'deny', status, decision, routeKind });

/**
 * Source-only Preview wiring planner for #558/#559.
 *
 * With PUBLICATION_GUARD_PUBLIC_ROUTE_WIRING unset/empty, governed publication
 * paths are a strict fallthrough and no route secret/context is read. The only
 * accepted active mode is Preview-only; Production can never produce a rewrite.
 * Signed request headers are overwritten server-side before the internal rewrite.
 */
export function planPublicationPublicRouteRequest({
  request,
  environment = process.env,
  now = Date.now,
} = {}) {
  let url;
  try { url = new URL(request?.url); } catch { return denied(503, 'HOLD_PUBLIC_ROUTE_URL', 'unknown'); }

  const classified = classifyPublicationPath(url.pathname);
  if (classified.kind === 'unrelated') {
    return result({ action: 'continue', decision: 'UNRELATED_ROUTE', routeKind: classified.kind });
  }

  const configuredMode = environment[PUBLICATION_PUBLIC_ROUTE_WIRING.modeEnvironmentKey];
  if (configuredMode == null || configuredMode === '') {
    return result({ action: 'continue', decision: 'INACTIVE_FALLTHROUGH', routeKind: classified.kind });
  }
  if (configuredMode !== PUBLICATION_PUBLIC_ROUTE_WIRING.approvedPreviewMode) {
    return denied(503, 'HOLD_PUBLIC_ROUTE_MODE', classified.kind);
  }

  if (classified.kind === 'deny-static-alias') {
    return denied(404, 'HOLD_PUBLIC_ROUTE_STATIC_ALIAS', classified.kind);
  }
  if (!['GET', 'HEAD'].includes(request?.method)) {
    return denied(405, 'HOLD_PUBLIC_ROUTE_METHOD', classified.kind);
  }

  try {
    need(url.protocol === 'https:', 'HOLD_PUBLIC_ROUTE_PROTOCOL');
    need(typeof request?.headers?.get === 'function', 'HOLD_PUBLIC_ROUTE_HEADERS');
    const host = request.headers.get('host');
    need(typeof host === 'string' && host.length > 0, 'HOLD_PUBLIC_ROUTE_HOST');
    need(normalizePublicationHost(host) === normalizePublicationHost(url.host), 'HOLD_PUBLIC_ROUTE_HOST');
    const issuedAt = now();
    need(Number.isSafeInteger(issuedAt) && issuedAt >= 0, 'HOLD_PUBLIC_ROUTE_CLOCK');

    const signed = signDormantPreviewRouteEnvelope({
      method: request.method,
      host,
      path: classified.path,
      issuedAt,
      environment,
      secret: environment[PUBLICATION_ROUTE_CANDIDATE.secretEnvironmentKey],
    });
    const requestHeaders = new Headers(request.headers);
    for (const [name, value] of Object.entries(signed)) requestHeaders.set(name, value);

    const destination = new URL(PUBLICATION_PUBLIC_ROUTE_WIRING.internalPath, request.url);
    destination.search = '';
    destination.hash = '';
    return result({
      action: 'rewrite',
      decision: 'REWRITE_TO_DORMANT_PREVIEW_GUARD',
      routeKind: classified.kind,
      surface: classified.surface,
      path: classified.path,
      destination: destination.href,
      requestHeaders,
      issuedAt,
    });
  } catch (error) {
    const decision = error instanceof PublicationRouteCandidateError
      ? 'HOLD_PUBLIC_ROUTE_PREVIEW_CONTEXT'
      : error instanceof PublicationPublicRouteWiringError
        ? error.code
        : 'HOLD_PUBLIC_ROUTE_FAILURE';
    return denied(503, decision, classified.kind);
  }
}

export function publicationPublicRouteWiringPlan() {
  return result({
    schema: PUBLICATION_PUBLIC_ROUTE_WIRING.schema,
    activeByDefault: false,
    approvedMode: PUBLICATION_PUBLIC_ROUTE_WIRING.approvedPreviewMode,
    internalPath: PUBLICATION_PUBLIC_ROUTE_WIRING.internalPath,
    transport: 'vercel-routing-middleware-rewrite-with-overridden-signed-request-headers',
    productionActivation: 'not-implemented',
  });
}
