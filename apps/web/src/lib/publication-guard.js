import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
const GENERATED_BUNDLE_RELATIVE = path.join('src', 'generated', 'publication-render-inputs.generated.js');
const GENERATED_BUNDLE_PREFIX = '// Generated after Astro build. Do not edit or commit.\nconst value = ';
const GENERATED_BUNDLE_MARKER = ';\nfunction freeze(input)';
const MAX_GENERATED_BUNDLE_BYTES = 21_000_000;

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

function freezeGeneratedBundle(input) {
  if (input && typeof input === 'object') {
    for (const value of Object.values(input)) freezeGeneratedBundle(value);
    Object.freeze(input);
  }
  return input;
}

function logPreviewHold(stage) {
  console.info(JSON.stringify({
    boundary: 'publication-preview-rehearsal',
    stage,
    decision: 'HOLD_ROUTE_UNAVAILABLE',
    publicationAuthorized: false,
    enforcementActive: false,
  }));
}

function sanitizedRehearsalHoldCode(error) {
  const code = typeof error?.code === 'string' ? error.code.trim().toUpperCase() : '';
  return /^(?:HOLD_REHEARSAL|HOLD_READER)_[A-Z0-9_]{1,80}$/.test(code)
    ? code
    : 'UNCLASSIFIED';
}

function generatedBundleCandidates() {
  const candidates = [
    fileURLToPath(new URL('../generated/publication-render-inputs.generated.js', import.meta.url)),
    path.resolve(process.cwd(), GENERATED_BUNDLE_RELATIVE),
    path.resolve(process.cwd(), 'apps', 'web', GENERATED_BUNDLE_RELATIVE),
  ];
  if (typeof process.env.LAMBDA_TASK_ROOT === 'string' && process.env.LAMBDA_TASK_ROOT.trim()) {
    candidates.push(path.resolve(process.env.LAMBDA_TASK_ROOT, GENERATED_BUNDLE_RELATIVE));
    candidates.push(path.resolve(process.env.LAMBDA_TASK_ROOT, 'apps', 'web', GENERATED_BUNDLE_RELATIVE));
  }
  return [...new Set(candidates)];
}

async function defaultBundleLoader() {
  let source = null;
  for (const candidate of generatedBundleCandidates()) {
    try {
      source = await readFile(candidate, 'utf8');
      break;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  if (source == null) throw new Error('generated bundle missing');
  if (Buffer.byteLength(source) > MAX_GENERATED_BUNDLE_BYTES) throw new Error('generated bundle too large');
  if (!source.startsWith(GENERATED_BUNDLE_PREFIX)) throw new Error('generated bundle prefix mismatch');
  const markerIndex = source.indexOf(GENERATED_BUNDLE_MARKER, GENERATED_BUNDLE_PREFIX.length);
  if (markerIndex < 0) throw new Error('generated bundle marker missing');
  const payload = source.slice(GENERATED_BUNDLE_PREFIX.length, markerIndex);
  const bundle = JSON.parse(payload);
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) throw new Error('generated bundle invalid');
  return freezeGeneratedBundle(bundle);
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
        logPreviewHold('bundle-commit');
        return hold(response, 503, 'Publication unavailable.');
      }
      if (!rehearsalRequested) renderer = createPublicationBuildRenderer(bundle);
    } catch {
      logPreviewHold('bundle-loader');
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
        if (!valid) {
          logPreviewHold('diagnostic-contract');
          return hold(response, 503, 'Publication unavailable.');
        }
        return rehearsalHold(response, request.method, diagnostic);
      } catch (error) {
        logPreviewHold(`rehearsal-runner:${sanitizedRehearsalHoldCode(error)}`);
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
