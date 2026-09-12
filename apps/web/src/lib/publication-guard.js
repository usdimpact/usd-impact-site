import { createRecordedPublicationHandler } from './publication-response-boundary.js';
import { createPublicationBuildRenderer } from './publication-build-renderer.js';
import {
  PUBLICATION_PREVIEW_REHEARSAL,
  runPublicationPreviewRehearsal,
} from './publication-preview-rehearsal.js';
import {
  PUBLICATION_ROUTE_CANDIDATE,
  PublicationRouteCandidateError,
  verifyDormantPreviewRouteEnvelope,
} from './publication-route-candidate.js';

const SAFE = Object.freeze({
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Content-Type': 'text/plain; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
});

function hold(response, status, message) {
  if (response.headersSent || response.writableEnded || response.destroyed) {
    if (!response.writableEnded && !response.destroyed) response.destroy();
    return Object.freeze({ decision: 'HOLD_ROUTE_RESPONSE_STARTED', responseDispatched: false,
      publicationAuthorized: false, enforcementActive: false });
  }
  for (const name of response.getHeaderNames()) response.removeHeader(name);
  const body = `${message}\n`;
  response.writeHead(status, { ...SAFE, 'Content-Length': String(Buffer.byteLength(body)) });
  response.end(body);
  return Object.freeze({ decision: status === 404 ? 'HOLD_ROUTE_DORMANT' : 'HOLD_ROUTE_UNAVAILABLE',
    responseDispatched: true, status, publicationAuthorized: false, enforcementActive: false });
}

function rehearsalHold(response, method, diagnostic) {
  if (response.headersSent || response.writableEnded || response.destroyed) {
    if (!response.writableEnded && !response.destroyed) response.destroy();
    return Object.freeze({ decision: 'HOLD_ROUTE_RESPONSE_STARTED', responseDispatched: false,
      publicationAuthorized: false, enforcementActive: false });
  }
  for (const name of response.getHeaderNames()) response.removeHeader(name);
  const body = `${JSON.stringify(diagnostic)}\n`;
  const headers = { ...SAFE, 'Content-Type': 'application/json; charset=utf-8' };
  if (method !== 'HEAD') headers['Content-Length'] = String(Buffer.byteLength(body));
  response.writeHead(503, headers);
  response.end(method === 'HEAD' ? undefined : body);
  return Object.freeze({ decision: 'HOLD_NOT_ADMITTED', responseDispatched: true, status: 503,
    rehearsal: true, publicationAuthorized: false, enforcementActive: false });
}

async function defaultBundleLoader() {
  const generated = await import('../generated/publication-render-inputs.generated.js');
  return generated.PUBLICATION_RENDER_INPUTS;
}

async function defaultPreviewRehearsal({ environment, envelope, bundle }) {
  const module = await import('pg');
  const PoolClass = module.default?.Pool ?? module.Pool;
  return runPublicationPreviewRehearsal({ environment, PoolClass, envelope, bundle });
}

/**
 * Dormant Preview-only Vercel Function candidate.
 *
 * The current internal /api/publication-guard rewrite reaches this handler but
 * no governed public path is intercepted. Production context is rejected by the
 * route-envelope verifier. A separately enabled read-only Preview rehearsal can
 * prove the signed envelope plus managed reader identity and revision-0 history;
 * it always terminates at HOLD_NOT_ADMITTED and never invokes serving policy.
 * Authority/history adapters are injected only by trusted server code; request
 * data cannot construct them.
 */
export function createDormantPublicationGuardFunction({
  environment = process.env,
  loadBundle = defaultBundleLoader,
  loadAuthority,
  readHistory,
  runRehearsal = defaultPreviewRehearsal,
  now = Date.now,
} = {}) {
  return async function dormantPublicationGuard(request, response) {
    let envelope;
    try {
      envelope = verifyDormantPreviewRouteEnvelope({
        request,
        environment,
        secret: environment[PUBLICATION_ROUTE_CANDIDATE.secretEnvironmentKey],
        now,
      });
    } catch (error) {
      // Missing mode/secret, direct calls, forged paths, wrong host and
      // Production requests are indistinguishable to the caller.
      if (error instanceof PublicationRouteCandidateError) return hold(response, 404, 'Not found.');
      return hold(response, 404, 'Not found.');
    }

    const rehearsalMode = environment[PUBLICATION_PREVIEW_REHEARSAL.modeEnvironmentKey];
    const rehearsalRequested = rehearsalMode === PUBLICATION_PREVIEW_REHEARSAL.approvedMode;
    if (rehearsalMode && !rehearsalRequested) return hold(response, 503, 'Publication unavailable.');
    if (!rehearsalRequested && (typeof loadAuthority !== 'function' || typeof readHistory !== 'function')) {
      return hold(response, 503, 'Publication unavailable.');
    }

    let bundle;
    let renderer;
    try {
      bundle = await loadBundle();
      if (bundle?.buildCommitSha !== envelope.runtime.commitSha) {
        return hold(response, 503, 'Publication unavailable.');
      }
      if (!rehearsalRequested) renderer = createPublicationBuildRenderer(bundle);
    } catch {
      return hold(response, 503, 'Publication unavailable.');
    }

    if (rehearsalRequested) {
      if (typeof runRehearsal !== 'function') return hold(response, 503, 'Publication unavailable.');
      try {
        const diagnostic = await runRehearsal({ environment, envelope, bundle });
        const valid = diagnostic?.schema === PUBLICATION_PREVIEW_REHEARSAL.schema
          && diagnostic.decision === 'HOLD_NOT_ADMITTED'
          && diagnostic.publicationAuthorized === false
          && diagnostic.enforcementActive === false
          && diagnostic.route?.path === envelope.path
          && diagnostic.route?.surface === envelope.surface
          && diagnostic.runtime?.target === 'preview'
          && diagnostic.runtime?.exposure === 'protected-preview'
          && diagnostic.runtime?.projectId === envelope.runtime.projectId
          && diagnostic.runtime?.repository === envelope.runtime.repository
          && diagnostic.runtime?.branch === envelope.runtime.branch
          && diagnostic.runtime?.commitSha === envelope.runtime.commitSha
          && diagnostic.runtime?.deploymentHost === envelope.runtime.deploymentHost
          && diagnostic.reader?.readSnapshot === true
          && diagnostic.reader?.writePrivileges === false
          && diagnostic.snapshot?.revision === '0'
          && diagnostic.snapshot?.recordCount === 0;
        if (!valid) return hold(response, 503, 'Publication unavailable.');
        return rehearsalHold(response, request.method, diagnostic);
      } catch {
        return hold(response, 503, 'Publication unavailable.');
      }
    }

    const handler = createRecordedPublicationHandler({
      surface: envelope.surface,
      path: envelope.path,
      loadSources: renderer.loadSources,
      loadAuthority,
      readHistory,
      render: renderer.render,
      resolveRequestTarget: () => envelope.path,
      now,
    });
    const result = await handler(request, response);
    return Object.freeze({ ...result, publicationAuthorized: false, enforcementActive: false });
  };
}

export default createDormantPublicationGuardFunction();
