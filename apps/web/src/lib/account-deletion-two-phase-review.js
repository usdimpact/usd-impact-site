// DRAFT REVIEW PROTOTYPE ONLY. The owner-gated Preview-only review worker
// can import this module, but is disabled by default. No Production, merchant,
// or real customer work is authorized. Independent database-first acceptance
// and release approval are required before any hosted execution.
import { enqueueAccountDeletionCompletedEmail } from './account-deletion-completed-email.js';

const DEVELOPMENT_REF = 'ycstrcvshdluovtuasjc';
// Keep every privileged HTTP step bounded well below the 15-minute SQL lease.
// Timeout cannot prove whether the server committed: recovery still relies on
// the private phase/lease ledger and independent Auth GET verification.
const PRIVILEGED_REQUEST_TIMEOUT_MS = 25_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TwoPhaseReviewError extends Error {
  constructor(code) {
    super(code);
    this.name = 'TwoPhaseReviewError';
    this.code = code;
  }
}

function requireReviewConfig(config) {
  const ref = (() => {
    try { return new URL(config?.supabase?.url).hostname.split('.')[0]; }
    catch { return ''; }
  })();
  if (config?.enabled !== true || config?.production !== false
    || ref !== DEVELOPMENT_REF || config?.projectRef !== DEVELOPMENT_REF
    || config?.supabase?.url !== 'https://ycstrcvshdluovtuasjc.supabase.co'
    || typeof config?.supabase?.secretKey !== 'string'
    || config.supabase.secretKey.length < 16) {
    throw new TwoPhaseReviewError('TWO_PHASE_DRAFT_DEVELOPMENT_ONLY');
  }
  return config;
}

function headers(config) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    apikey: config.supabase.secretKey,
    Authorization: 'Bearer ' + config.supabase.secretKey,
  };
}

function validId(value) {
  return typeof value === 'string' && UUID.test(value);
}

// This prototype has separate configuration objects for Auth/SQL and the
// shared completion-email helper. Never allow a mixed Development/Production
// environment to reach Auth DELETE before discovering an outbox mismatch.
// Mock enqueue implementations remain available for offline negative tests.
function requireMatchingEmailEnvironment(config, environment, enqueueImpl) {
  if (enqueueImpl !== enqueueAccountDeletionCompletedEmail) return;
  const deployment = String(environment?.VERCEL_ENV || '').trim().toLowerCase();
  if (!['preview', 'development'].includes(deployment)
      || environment?.SUPABASE_URL !== config.supabase.url
      || environment?.SUPABASE_SECRET_KEY !== config.supabase.secretKey) {
    throw new TwoPhaseReviewError('TWO_PHASE_EMAIL_CONFIG_MISMATCH');
  }
}

function requireOutboxRequestTarget(url, options, config) {
  let parsed;
  try { parsed = new URL(url); }
  catch { throw new TwoPhaseReviewError('TWO_PHASE_EMAIL_NOT_DURABLE'); }
  const method = String(options?.method || 'GET').toUpperCase();
  if (parsed.origin !== config.supabase.url
      || parsed.pathname !== '/rest/v1/notification_outbox'
      || parsed.username || parsed.password
      || !['GET', 'POST'].includes(method)) {
    throw new TwoPhaseReviewError('TWO_PHASE_EMAIL_NOT_DURABLE');
  }
}

async function boundedRequest({ url, options, fetchImpl, failureCode }) {
  try {
    return await fetchImpl(url, {
      ...options,
      signal: AbortSignal.timeout(PRIVILEGED_REQUEST_TIMEOUT_MS),
    });
  } catch {
    // Raw network/timeout messages may embed internal URLs or account data.
    throw new TwoPhaseReviewError(failureCode);
  }
}

async function rpc({ config, name, input, fetchImpl }) {
  const res = await boundedRequest({
    url: config.supabase.url + '/rest/v1/rpc/' + name, fetchImpl,
    options: {
      method: 'POST', headers: headers(config), body: JSON.stringify(input),
    },
    failureCode: 'TWO_PHASE_DATABASE_UNAVAILABLE',
  });
  if (!res?.ok) {
    throw new TwoPhaseReviewError('TWO_PHASE_DATABASE_UNAVAILABLE');
  }
  try {
    return await res.json();
  } catch {
    throw new TwoPhaseReviewError('TWO_PHASE_DATABASE_MALFORMED');
  }
}

// Phase A: ONE database transaction checks merchant evidence, removes only the
// nullable FK link, completes SQL deletion, and persists Auth cleanup custody.
// An error means there must be ZERO Auth Admin calls. This does not invoke the
// existing, unsafe readiness -> Auth -> SQL sequence.
export async function prepareDraftDatabaseFinalization({
  config, accountId, fetchImpl = fetch,
}) {
  const cfg = requireReviewConfig(config);
  if (!validId(accountId)) throw new TwoPhaseReviewError('TWO_PHASE_ACCOUNT_INVALID');
  const answer = await rpc({
    config: cfg, name: 'finalize_deletion_and_queue_auth_cleanup',
    input: { p_account_id: accountId }, fetchImpl,
  });
  if (answer?.account_id !== accountId
      || !['auth_pending', 'auth_confirmed', 'email_enqueued'].includes(answer.phase)) {
    throw new TwoPhaseReviewError('TWO_PHASE_PREPARE_RECEIPT_INVALID');
  }
  return Object.freeze({ phase: answer.phase });
}

export async function claimDraftAuthCleanup({
  config, batchSize = 1, fetchImpl = fetch,
}) {
  const cfg = requireReviewConfig(config);
  if (!Number.isInteger(batchSize) || batchSize !== 1) {
    throw new TwoPhaseReviewError('TWO_PHASE_BATCH_INVALID');
  }
  const rows = await rpc({
    config: cfg, name: 'claim_deletion_auth_cleanup_batch',
    input: { p_limit: batchSize }, fetchImpl,
  });
  if (!Array.isArray(rows) || rows.length > batchSize || rows.some((item) =>
    !validId(item?.account_id) || !validId(item?.lease_id)
    || !['auth_pending', 'auth_confirmed'].includes(item?.phase)
    || !Number.isInteger(item?.attempt_count) || item.attempt_count < 1)) {
    throw new TwoPhaseReviewError('TWO_PHASE_CLAIM_RECEIPT_INVALID');
  }
  return rows;
}

async function confirmedAuthRetirement({ config, accountId, fetchImpl }) {
  const url = config.supabase.url + '/auth/v1/admin/users/' + encodeURIComponent(accountId);
  const removed = await boundedRequest({
    url, fetchImpl, failureCode: 'TWO_PHASE_AUTH_DELETE_UNAVAILABLE',
    options: {
      method: 'DELETE', headers: headers(config),
      // GoTrue Admin reads this option from JSON body, not the URL query.
      body: JSON.stringify({ should_soft_delete: true }),
    },
  });
  if (!removed?.ok && removed?.status !== 404) {
    throw new TwoPhaseReviewError('TWO_PHASE_AUTH_DELETE_UNAVAILABLE');
  }
  // A successful DELETE alone does not certify that the identity is retired.
  // A GET must report 404 or an explicitly deleted matching user. Actual
  // hosted soft-delete response semantics remain a release-time HOLD.
  const observed = await boundedRequest({
    url, fetchImpl, failureCode: 'TWO_PHASE_AUTH_STATUS_UNKNOWN',
    options: { method: 'GET', headers: headers(config) },
  });
  if (observed?.status === 404) return;
  if (!observed?.ok) throw new TwoPhaseReviewError('TWO_PHASE_AUTH_STATUS_UNKNOWN');
  let doc;
  try { doc = await observed.json(); }
  catch { throw new TwoPhaseReviewError('TWO_PHASE_AUTH_STATUS_UNKNOWN'); }
  const user = doc?.user ?? doc;
  if (user?.id !== accountId || typeof user?.deleted_at !== 'string'
    || !Number.isFinite(Date.parse(user.deleted_at))) {
    throw new TwoPhaseReviewError('TWO_PHASE_AUTH_NOT_RETIRED');
  }
}

function validCompletion(value, accountId) {
  return value?.phase === 'auth_confirmed'
    && value.account_id === accountId
    && typeof value.recipient_email === 'string'
    && value.recipient_email.includes('@')
    && Number.isFinite(Date.parse(value.deleted_at))
    && Number.isFinite(Date.parse(value.deletion_requested_at))
    && Date.parse(value.deleted_at) >= Date.parse(value.deletion_requested_at);
}

const FINANCIAL_HOLD_CODES = Object.freeze({
  auth_intact_cessation_unverified: 'TWO_PHASE_CESSATION_UNVERIFIED',
  auth_intact_financial_evidence: 'TWO_PHASE_FINANCIAL_HOLD_AUTH_INTACT',
  auth_outcome_unknown_financial_evidence: 'TWO_PHASE_FINANCIAL_HOLD_AUTH_UNKNOWN',
  auth_retired_financial_evidence: 'TWO_PHASE_FINANCIAL_SPLIT_AUTH_RETIRED',
});

// After a refused fence/confirm/finish, ask SQL to classify and durably record
// a financial hold. SQL re-evaluates the evidence itself; this caller can only
// make the state stricter. Clean evidence (a transient failure) keeps the
// original error and the normal lease retry. If classification itself fails,
// the original error stands and the next attempt's fence re-checks.
async function holdOnFinancialEvidence({ config, row, authRetiredObserved, error, fetchImpl }) {
  let held;
  try {
    held = await rpc({
      config, name: 'hold_deletion_auth_cleanup',
      input: {
        p_account_id: row.account_id, p_lease_id: row.lease_id,
        p_auth_retired_observed: authRetiredObserved === true,
      },
      fetchImpl,
    });
  } catch {
    throw error;
  }
  if (held === null) throw error;
  const code = FINANCIAL_HOLD_CODES[held];
  if (!code) throw new TwoPhaseReviewError('TWO_PHASE_FINANCIAL_HOLD_MALFORMED');
  throw new TwoPhaseReviewError(code);
}

// Phases B+C: verified Auth retirement; DB confirms a fresh lease; durable
// completion email; SQL verifies the outbox and scrubs the temporary email.
// All failure windows leave an independently retryable database state.
// Cross-service limit: the fence is a point-in-time SQL check and cannot lock
// across the Auth Admin HTTP call. A signed charge committed between the fence
// and DELETE is detected afterwards and becomes a durable, classified hold;
// it cannot be prevented, and Auth cannot be restored by this code.
export async function resumeDraftAuthCleanup({
  config, row, environment = process.env, fetchImpl = fetch,
  enqueueImpl = enqueueAccountDeletionCompletedEmail,
}) {
  const cfg = requireReviewConfig(config);
  requireMatchingEmailEnvironment(cfg, environment, enqueueImpl);
  if (!validId(row?.account_id) || !validId(row?.lease_id)
      || !['auth_pending', 'auth_confirmed'].includes(row.phase)) {
    throw new TwoPhaseReviewError('TWO_PHASE_CLAIM_RECEIPT_INVALID');
  }
  // Fence before irreversible Auth and before email: pending signed payment
  // observations must fail closed. A database lock cannot span the subsequent
  // Auth HTTP call, so externally verified cessation remains a release gate.
  let fenced;
  try {
    fenced = await rpc({
      config: cfg, name: 'check_deletion_auth_cleanup_billing_fence',
      input: { p_account_id: row.account_id, p_lease_id: row.lease_id },
      fetchImpl,
    });
  } catch (error) {
    await holdOnFinancialEvidence({
      config: cfg, row, authRetiredObserved: false, error, fetchImpl,
    });
  }
  if (fenced !== true) {
    throw new TwoPhaseReviewError('TWO_PHASE_BILLING_FENCE_REFUSED');
  }
  if (row.phase === 'auth_pending') {
    await confirmedAuthRetirement({ config: cfg, accountId: row.account_id, fetchImpl });
  }
  // From here the worker has itself verified Auth retirement (or the row was
  // already auth_confirmed), so any financial hold is a split, not "unknown".
  let receipt;
  try {
    receipt = await rpc({
      config: cfg, name: 'confirm_deletion_auth_cleanup',
      input: { p_account_id: row.account_id, p_lease_id: row.lease_id },
      fetchImpl,
    });
  } catch (error) {
    await holdOnFinancialEvidence({
      config: cfg, row, authRetiredObserved: true, error, fetchImpl,
    });
  }
  if (!validCompletion(receipt, row.account_id)) {
    throw new TwoPhaseReviewError('TWO_PHASE_AUTH_CONFIRM_RECEIPT_INVALID');
  }
  // The shared email helper performs both POST and GET. Bound each operation
  // before invoking the shared helper; unknown outcomes remain retryable.
  const boundedEmailFetch = (url, options = {}) => {
    requireOutboxRequestTarget(url, options, cfg);
    return boundedRequest({
      url, options, fetchImpl, failureCode: 'TWO_PHASE_EMAIL_NOT_DURABLE',
    });
  };
  let queued;
  try {
    queued = await enqueueImpl({
      finalizationResult: {
        account_id: receipt.account_id,
        recipient_email: receipt.recipient_email,
        deletion_requested_at: receipt.deletion_requested_at,
        deleted_at: receipt.deleted_at,
      },
      environment, fetchImpl: boundedEmailFetch,
    });
  } catch {
    throw new TwoPhaseReviewError('TWO_PHASE_EMAIL_NOT_DURABLE');
  }
  if (!queued?.enabled || !validId(queued?.outbox?.id)) {
    throw new TwoPhaseReviewError('TWO_PHASE_EMAIL_NOT_DURABLE');
  }
  if (queued.outbox.status !== 'deletion_staged') {
    throw new TwoPhaseReviewError('TWO_PHASE_EMAIL_NOT_STAGED');
  }
  let completed;
  try {
    completed = await rpc({
      config: cfg, name: 'finish_deletion_auth_cleanup',
      input: { p_account_id: row.account_id, p_lease_id: row.lease_id },
      fetchImpl,
    });
  } catch (error) {
    await holdOnFinancialEvidence({
      config: cfg, row, authRetiredObserved: true, error, fetchImpl,
    });
  }
  if (completed !== true) {
    throw new TwoPhaseReviewError('TWO_PHASE_EMAIL_ACK_INVALID');
  }
  return Object.freeze({ status: 'auth_and_email_confirmed' });
}

// Draft-only helper for controlled synthetic tests; never registered as a
// web or cron route. Production config rejected BEFORE any API interaction.
export async function runDraftAuthCleanupBatch({
  config, batchSize = 1, environment = process.env, fetchImpl = fetch,
  enqueueImpl = enqueueAccountDeletionCompletedEmail,
}) {
  // Never claim many leased Auth tasks and process them sequentially.
  if (batchSize !== 1) throw new TwoPhaseReviewError('TWO_PHASE_BATCH_INVALID');
  const rows = await claimDraftAuthCleanup({ config, batchSize, fetchImpl });
  let completed = 0;
  let held = 0;
  const errors = [];
  for (const row of rows) {
    try {
      await resumeDraftAuthCleanup({ config, row, environment, fetchImpl, enqueueImpl });
      completed += 1;
    } catch (error) {
      held += 1;
      errors.push(typeof error?.code === 'string' ? error.code : 'TWO_PHASE_UNKNOWN_ERROR');
    }
  }
  return Object.freeze({ scanned: rows.length, completed, held, errors });
}


// Full DRAFT-only orchestration review: fair due scan -> atomic database Phase A
// -> leased Auth cleanup. Only an explicitly owner-gated Preview review route
// can call this; no production or deployed cron is authorized.
// The canonical Development config guard executes before all network IO.
// A Phase A failure never triggers an Auth operation for the failed account.
// The merchant-stop and privileged-runtime cutover approvals remain HOLD.
export async function runDraftTwoPhaseReviewCycle({
  config, batchSize = 1, now = new Date(), environment = process.env,
  fetchImpl = fetch, enqueueImpl = enqueueAccountDeletionCompletedEmail,
}) {
  const cfg = requireReviewConfig(config);
  if (!Number.isInteger(batchSize) || batchSize !== 1) {
    throw new TwoPhaseReviewError('TWO_PHASE_BATCH_INVALID');
  }
  const parsedNow = new Date(now);
  if (!Number.isFinite(parsedNow.getTime())) {
    throw new TwoPhaseReviewError('TWO_PHASE_NOW_INVALID');
  }
  const due = await rpc({
    config: cfg, name: 'list_due_account_deletions_fair',
    input: { p_limit: batchSize, p_due_at: parsedNow.toISOString() },
    fetchImpl,
  });
  const ids = new Set();
  if (!Array.isArray(due) || due.length > batchSize || due.some((row) => {
    const id = row?.account_id;
    if (!validId(id) || ids.has(id) || row?.status !== 'deletion_pending'
        || !Number.isFinite(Date.parse(String(row?.deletion_due_at || '')))
        || Date.parse(row.deletion_due_at) > parsedNow.getTime()) return true;
    ids.add(id);
    return false;
  })) {
    throw new TwoPhaseReviewError('TWO_PHASE_DUE_SCAN_INVALID');
  }
  let prepared = 0;
  let held = 0;
  const errors = [];
  for (const row of due) {
    try {
      await prepareDraftDatabaseFinalization({
        config: cfg, accountId: row.account_id, fetchImpl,
      });
      prepared += 1;
    } catch (error) {
      held += 1;
      errors.push(typeof error?.code === 'string'
        ? error.code : 'TWO_PHASE_PREPARE_FAILED');
    }
  }
  const cleanup = await runDraftAuthCleanupBatch({
    config: cfg, batchSize, environment, fetchImpl, enqueueImpl,
  });
  return Object.freeze({
    dueScanned: due.length, prepared, held,
    cleanupScanned: cleanup.scanned, cleanupCompleted: cleanup.completed,
    cleanupHeld: cleanup.held, errors: Object.freeze([...errors, ...cleanup.errors]),
  });
}
