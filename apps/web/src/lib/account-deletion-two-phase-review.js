// DRAFT REVIEW PROTOTYPE ONLY. No route imports this module. No Production,
// merchant, or customer work is permitted. The database-first SQL must be
// independently accepted before a separately approved runtime integration.
import { enqueueAccountDeletionCompletedEmail } from './account-deletion-completed-email.js';

const DEVELOPMENT_REF = 'ycstrcvshdluovtuasjc';
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

async function rpc({ config, name, input, fetchImpl }) {
  const res = await fetchImpl(config.supabase.url + '/rest/v1/rpc/' + name, {
    method: 'POST', headers: headers(config), body: JSON.stringify(input),
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
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 25) {
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
  const removed = await fetchImpl(url, {
    method: 'DELETE', headers: headers(config),
    // GoTrue Admin reads this option from JSON body, not the URL query.
    body: JSON.stringify({ should_soft_delete: true }),
  });
  if (!removed?.ok && removed?.status !== 404) {
    throw new TwoPhaseReviewError('TWO_PHASE_AUTH_DELETE_UNAVAILABLE');
  }
  // A successful DELETE alone does not certify that the identity is retired.
  // A GET must report 404 or an explicitly deleted matching user. Actual
  // hosted soft-delete response semantics remain a release-time HOLD.
  const observed = await fetchImpl(url, { method: 'GET', headers: headers(config) });
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

// Phases B+C: verified Auth retirement; DB confirms a fresh lease; durable
// completion email; SQL verifies the outbox and scrubs the temporary email.
// All failure windows leave an independently retryable database state.
export async function resumeDraftAuthCleanup({
  config, row, environment = process.env, fetchImpl = fetch,
  enqueueImpl = enqueueAccountDeletionCompletedEmail,
}) {
  const cfg = requireReviewConfig(config);
  if (!validId(row?.account_id) || !validId(row?.lease_id)
      || !['auth_pending', 'auth_confirmed'].includes(row.phase)) {
    throw new TwoPhaseReviewError('TWO_PHASE_CLAIM_RECEIPT_INVALID');
  }
  // Fence before irreversible Auth and before email: pending signed payment
  // observations must fail closed. A database lock cannot span the subsequent
  // Auth HTTP call, so externally verified cessation remains a release gate.
  const fenced = await rpc({
    config: cfg, name: 'check_deletion_auth_cleanup_billing_fence',
    input: { p_account_id: row.account_id, p_lease_id: row.lease_id },
    fetchImpl,
  });
  if (fenced !== true) {
    throw new TwoPhaseReviewError('TWO_PHASE_BILLING_FENCE_REFUSED');
  }
  if (row.phase === 'auth_pending') {
    await confirmedAuthRetirement({ config: cfg, accountId: row.account_id, fetchImpl });
  }
  const receipt = await rpc({
    config: cfg, name: 'confirm_deletion_auth_cleanup',
    input: { p_account_id: row.account_id, p_lease_id: row.lease_id },
    fetchImpl,
  });
  if (!validCompletion(receipt, row.account_id)) {
    throw new TwoPhaseReviewError('TWO_PHASE_AUTH_CONFIRM_RECEIPT_INVALID');
  }
  const queued = await enqueueImpl({
    finalizationResult: {
      account_id: receipt.account_id,
      recipient_email: receipt.recipient_email,
      deletion_requested_at: receipt.deletion_requested_at,
      deleted_at: receipt.deleted_at,
    },
    environment, fetchImpl,
  });
  if (!queued?.enabled || !validId(queued?.outbox?.id)) {
    throw new TwoPhaseReviewError('TWO_PHASE_EMAIL_NOT_DURABLE');
  }
  if (queued.outbox.status !== 'deletion_staged') {
    throw new TwoPhaseReviewError('TWO_PHASE_EMAIL_NOT_STAGED');
  }
  const completed = await rpc({
    config: cfg, name: 'finish_deletion_auth_cleanup',
    input: { p_account_id: row.account_id, p_lease_id: row.lease_id },
    fetchImpl,
  });
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
// -> leased Auth cleanup. This is deliberately NOT imported by any route or
// cron, and the Development-only config guard executes before all network IO.
// A Phase A failure never triggers an Auth operation for the failed account.
// The merchant-stop and privileged-runtime cutover approvals remain HOLD.
export async function runDraftTwoPhaseReviewCycle({
  config, batchSize = 1, now = new Date(), environment = process.env,
  fetchImpl = fetch, enqueueImpl = enqueueAccountDeletionCompletedEmail,
}) {
  const cfg = requireReviewConfig(config);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 25) {
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
