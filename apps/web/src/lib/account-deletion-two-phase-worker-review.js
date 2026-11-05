// DRAFT, UNDEPLOYED. Additional review-only worker route; no rewrite or cron.
// The only executable target is canonical Development, after explicit,
// item-specific owner attestations. Production always rejects before network IO.
// These flags MUST NOT be set by this PR or its tests on a connected host.
import {
  readAccountDeletionFinalizerConfig,
  validCronAuthorization,
} from './account-deletion-finalizer.js';
import { runDraftTwoPhaseReviewCycle } from './account-deletion-two-phase-review.js';

const DEVELOPMENT_REF = 'ycstrcvshdluovtuasjc';
const OWNER_ATTESTATIONS = Object.freeze([
  'ACCOUNT_DELETION_TWO_PHASE_REVIEW_EXECUTION_APPROVED',
  'ACCOUNT_DELETION_TWO_PHASE_REVIEW_SCHEMA_APPROVED',
  'ACCOUNT_DELETION_TWO_PHASE_REVIEW_LEGACY_DRAINED',
]);

function send(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function validSummary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const names = [
    'dueScanned', 'prepared', 'held', 'cleanupScanned',
    'cleanupCompleted', 'cleanupHeld',
  ];
  if (names.some((name) => !Number.isSafeInteger(value[name])
    || value[name] < 0 || value[name] > 1)) return false;
  if (value.dueScanned !== value.prepared + value.held
    || value.cleanupScanned !== value.cleanupCompleted + value.cleanupHeld
    || !Array.isArray(value.errors)
    || value.errors.length > value.held + value.cleanupHeld
    || value.errors.some((code) => typeof code !== 'string'
      || !/^TWO_PHASE_[A-Z_]{1,60}$/.test(code))) return false;
  return true;
}

export async function handleDraftTwoPhaseWorker(
  request, response, {
    environment = process.env,
    fetchImpl = fetch,
    runImpl = runDraftTwoPhaseReviewCycle,
  } = {},
) {
  if (environment.ACCOUNT_DELETION_TWO_PHASE_REVIEW_ROUTE_ENABLED !== 'true') {
    return send(response, 404, { ok: false, code: 'TWO_PHASE_REVIEW_ROUTE_DISABLED' });
  }
  if (request?.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return send(response, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  }
  if (!validCronAuthorization(request, environment)) {
    return send(response, 401, { ok: false, code: 'SCHEDULER_AUTHORIZATION_REQUIRED' });
  }
  // Production, missing/invalid context, or legacy workers active all fail
  // before reading secrets or calling any external service.
  if (environment.VERCEL_ENV !== 'preview') {
    return send(response, 503, { ok: false, code: 'TWO_PHASE_REVIEW_PRODUCTION_HOLD' });
  }
  if (environment.ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED !== 'false') {
    return send(response, 409, { ok: false, code: 'TWO_PHASE_LEGACY_ROUTE_NOT_DISABLED' });
  }
  if (OWNER_ATTESTATIONS.some((name) => environment[name] !== 'true')) {
    return send(response, 423, { ok: false, code: 'TWO_PHASE_REVIEW_OWNER_HOLD' });
  }
  let config;
  try {
    config = readAccountDeletionFinalizerConfig(environment);
  } catch {
    return send(response, 503, { ok: false, code: 'TWO_PHASE_REVIEW_CONFIG_HOLD' });
  }
  if (!config.enabled || config.production || config.projectRef !== DEVELOPMENT_REF) {
    return send(response, 503, { ok: false, code: 'TWO_PHASE_REVIEW_CONFIG_HOLD' });
  }

  // Only bounded, fair atomic-DB-first -> leased Auth operations exist inside
  // this reviewed library. No old Auth-first function, cron or direct legacy
  // RPC is called here. Tests inject a mock runner; never contact live data.
  try {
    const result = await runImpl({
      config, batchSize: 1, environment, fetchImpl,
    });
    if (!validSummary(result)) {
      return send(response, 503, { ok: false, code: 'TWO_PHASE_REVIEW_RESULT_INVALID' });
    }
    const ok = result.held === 0 && result.cleanupHeld === 0;
    return send(response, ok ? 200 : 503, {
      ok,
      code: ok ? 'TWO_PHASE_REVIEW_DRAFT_CYCLE_OK' : 'TWO_PHASE_REVIEW_HELD',
      dueScanned: result.dueScanned,
      prepared: result.prepared,
      held: result.held,
      cleanupScanned: result.cleanupScanned,
      cleanupCompleted: result.cleanupCompleted,
      cleanupHeld: result.cleanupHeld,
      releaseApproved: false,
    });
  } catch {
    // Never send exception strings or per-account details to a cron response.
    return send(response, 503, { ok: false, code: 'TWO_PHASE_REVIEW_UNAVAILABLE' });
  }
}
