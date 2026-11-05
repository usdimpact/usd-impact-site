// DRAFT-only operational preflight. This additional account action performs ZERO
// deletion, Auth Admin, SQL, email, or merchant calls. It is not scheduled,
// and does not modify the existing account deletion handler or cron.
// Releasing the actual two-phase runner requires separate schema and owner
// approvals plus independent security acceptance.
import {
  readAccountDeletionFinalizerConfig,
  validCronAuthorization,
} from './account-deletion-finalizer.js';

const CANONICAL_DEV_REF = 'ycstrcvshdluovtuasjc';
const YES = 'true';
const NO = 'false';

function send(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

export async function handleTwoPhasePreflight(
  request, response, { environment = process.env } = {},
) {
  // No feature flag or any unknown value means NO ROUTE. The public
  // endpoint must never disclose its configured credentials.
  if (environment.ACCOUNT_DELETION_TWO_PHASE_PREFLIGHT_ROUTE_ENABLED !== YES) {
    return send(response, 404, {
      ok: false, code: 'TWO_PHASE_PREFLIGHT_ROUTE_DISABLED',
    });
  }
  if (request?.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return send(response, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  }
  if (!validCronAuthorization(request, environment)) {
    return send(response, 401, {
      ok: false, code: 'SCHEDULER_AUTHORIZATION_REQUIRED',
    });
  }
  // Deliberately reject Production before resolving any service credentials.
  // "preview" is not itself a release approval: the canonical Dev binding is
  // required even on a Preview deployment.
  const deployment = String(environment.VERCEL_ENV || '').trim().toLowerCase();
  if (!['preview', 'development'].includes(deployment)) {
    return send(response, 503, {
      ok: false, code: 'TWO_PHASE_PREFLIGHT_PRODUCTION_HOLD',
    });
  }
  // The existing Auth-first cron cannot run side by side with a future
  // two-phase execution path. This route verifies the ordering requirement
  // without ever starting an execution.
  if (environment.ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED !== NO) {
    return send(response, 409, {
      ok: false, code: 'LEGACY_FINALIZER_NOT_EXPLICITLY_DISABLED',
    });
  }
  let cfg;
  try {
    cfg = readAccountDeletionFinalizerConfig(environment);
  } catch {
    return send(response, 503, {
      ok: false, code: 'TWO_PHASE_PREFLIGHT_CONFIGURATION_HOLD',
    });
  }
  if (!cfg.enabled || cfg.production || cfg.projectRef !== CANONICAL_DEV_REF) {
    return send(response, 503, {
      ok: false, code: 'TWO_PHASE_PREFLIGHT_CONFIGURATION_HOLD',
    });
  }
  // Config-only evidence: no database migration, grants, Auth behavior or
  // provider settlement is verified here. Never expose account counts.
  return send(response, 200, {
    ok: true,
    code: 'TWO_PHASE_DRAFT_PREFLIGHT_ONLY',
    scope: 'canonical_development',
    legacyRouteDisabled: true,
    externalCalls: 0,
    deletionExecuted: false,
    releaseApproved: false,
  });
}

export default handleTwoPhasePreflight;
