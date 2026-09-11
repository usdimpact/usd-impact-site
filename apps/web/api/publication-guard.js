import { createRecordedPublicationHandler, } from '../src/lib/publication-response-boundary.js';
import { createPublicationBuildRenderer } from '../src/lib/publication-build-renderer.js';
import {
  PUBLICATION_ROUTE_CANDIDATE,
  PublicationRouteCandidateError,
  verifyDormantPreviewRouteEnvelope,
} from '../src/lib/publication-route-candidate.js';

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

async function defaultBundleLoader() {
  const generated = await import('../src/generated/publication-render-inputs.generated.js');
  return generated.PUBLICATION_RENDER_INPUTS;
}

/**
 * Dormant Preview-only Vercel Function candidate.
 *
 * There is intentionally no vercel.json/middleware rewrite to this function in
 * #559. A future separately approved route adapter must authenticate and sign
 * the original public path. Production context is rejected by the route
 * envelope verifier in this increment. Authority/history adapters are injected
 * only by trusted server code; request data cannot construct them.
 */
export function createDormantPublicationGuardFunction({
  environment = process.env,
  loadBundle = defaultBundleLoader,
  loadAuthority,
  readHistory,
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

    if (typeof loadAuthority !== 'function' || typeof readHistory !== 'function') {
      return hold(response, 503, 'Publication unavailable.');
    }

    let renderer;
    try {
      const bundle = await loadBundle();
      if (bundle?.buildCommitSha !== envelope.runtime.commitSha) {
        return hold(response, 503, 'Publication unavailable.');
      }
      renderer = createPublicationBuildRenderer(bundle);
    } catch {
      return hold(response, 503, 'Publication unavailable.');
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
