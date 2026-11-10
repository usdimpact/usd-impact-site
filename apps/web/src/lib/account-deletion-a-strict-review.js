// #1103 / D1 A-strict, SYNTHETIC REVIEW ONLY: not a handler or cron.
// This module has no default DB/Auth/merchant/network adapters. A caller must
// inject all adapters and opt into a synthetic harness. Real accounts always
// reject until independent SQL/owner-policy acceptance and an approved cutover.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CASE = /^p1-[0-9a-f]{12,40}$/;
const isUuid = (v) => typeof v === 'string' && UUID.test(v);
export class AStrictError extends Error {
  constructor(code) { super(code); this.name = 'AStrictError'; this.code = code; }
}
function fail(code) { throw new AStrictError(code); }
function scope(input, services) {
  if (input?.reviewMode !== 'synthetic-only' || services?.syntheticOnly !== true) {
    fail('ASTRICT_REAL_ACCOUNT_EXECUTION_DENIED');
  }
  if (!isUuid(input?.accountId) || !isUuid(input?.authorizationId)
    || !CASE.test(input?.caseRef || '')) fail('ASTRICT_SCOPE_INVALID');
  if (!services || typeof services.db !== 'object') fail('ASTRICT_ADAPTERS_MISSING');
  return Object.freeze({
    accountId: input.accountId, authorizationId: input.authorizationId,
    caseRef: input.caseRef,
  });
}
function need(service, names) {
  if (names.some((x) => typeof service?.[x] !== 'function')) fail('ASTRICT_ADAPTERS_MISSING');
}
function own(receipt, ctx) {
  return receipt?.account_id === ctx.accountId
    && receipt?.authorization_id === ctx.authorizationId;
}
function validLease(row, ctx, phase) {
  if (!own(row, ctx) || row.case_ref !== ctx.caseRef
    || row.phase !== phase || !isUuid(row.lease_id)
    || typeof row.prior_auth_attempt !== 'boolean') fail('ASTRICT_LEASE_RECEIPT_INVALID');
  return row.lease_id;
}
async function dbCall(db, name, args, code) {
  try { return await db[name](args); }
  catch { fail(code); }
}
async function persistHold(ctx, db, leaseId, reason) {
  need(db, ['hold']);
  let row;
  try {
    row = await db.hold({ ...ctx, leaseId, reason });
  } catch {
    fail('ASTRICT_HOLD_PERSISTENCE_UNVERIFIED');
  }
  if (!own(row, ctx) || row.status !== 'open' || row.persisted !== true) {
    fail('ASTRICT_HOLD_PERSISTENCE_UNVERIFIED');
  }
}
function authResult(result, ctx) {
  if (result?.account_id !== ctx.accountId
    || result.authoritative !== true
    || !['active', 'retired'].includes(result.state)) {
    fail('ASTRICT_AUTH_GET_AMBIGUOUS');
  }
  return result.state;
}
async function inspectAuth(ctx, db, auth, leaseId) {
  let result;
  try { result = await auth.get(ctx); return authResult(result, ctx); }
  catch {
    await persistHold(ctx, db, leaseId, 'auth_get_ambiguous');
    fail('ASTRICT_AUTH_GET_AMBIGUOUS');
  }
}

// Owner-issued case capability is verified again by SQL in the same transaction
// as the actual one-account Phase A. No due-listing or batch functions.
export async function reviewSupervisedPhaseA(input, services) {
  const ctx = scope(input, services);
  need(services.db, ['phaseA']);
  const row = await dbCall(services.db, 'phaseA', ctx, 'ASTRICT_PHASE_A_REFUSED');
  if (!own(row, ctx) || row.case_ref !== ctx.caseRef || row.phase !== 'auth_pending') {
    fail('ASTRICT_PHASE_A_RECEIPT_INVALID');
  }
  return Object.freeze({ status: 'auth_pending', scope: 'single_account' });
}

// Auth stage: a prior possible DELETE always requires an independent Auth GET.
// After a possible Auth DELETE the code never restores identity/access or retries
// DELETE automatically. The SQL intent record must be durable BEFORE the call.
export async function reviewSupervisedAuth(input, services) {
  const ctx = scope(input, services), { db, auth } = services;
  need(db, ['claim', 'fence', 'mark', 'observed', 'hold']);
  need(auth, ['get', 'deleteUser']);
  const row = await dbCall(db, 'claim', { ...ctx, purpose: 'auth' }, 'ASTRICT_LEASE_REFUSED');
  const leaseId = validLease(row, ctx, 'auth_pending');
  // A prior attempt may already have reached Auth. Never re-arm the SQL
  // pre-DELETE fence or issue DELETE: inspect Auth and reconcile this lease
  // only. SQL a_strict_fence intentionally refuses any second attempt.
  if (!row.prior_auth_attempt) {
    let fenced;
    try { fenced = await db.fence({ ...ctx, leaseId }); }
    catch {
      await persistHold(ctx, db, leaseId, 'unknown_payment');
      fail('ASTRICT_FENCE_REFUSED');
    }
    if (fenced !== true) {
      await persistHold(ctx, db, leaseId, 'unknown_payment');
      fail('ASTRICT_FENCE_REFUSED');
    }
  }
  const before = await inspectAuth(ctx, db, auth, leaseId);
  if (row.prior_auth_attempt) {
    if (before !== 'retired') {
      await persistHold(ctx, db, leaseId, 'prior_auth_attempt_ambiguous');
      fail('ASTRICT_REPEAT_AUTH_FORBIDDEN');
    }
  } else {
    if (before !== 'active') {
      await persistHold(ctx, db, leaseId, 'auth_result_unknown');
      fail('ASTRICT_AUTH_STATE_UNEXPECTED');
    }
    let marked;
    try { marked = await db.mark({ ...ctx, leaseId }); }
    catch {
      await persistHold(ctx, db, leaseId, 'auth_result_unknown');
      fail('ASTRICT_AUTH_INTENT_UNVERIFIED');
    }
    if (marked !== true) {
      await persistHold(ctx, db, leaseId, 'auth_result_unknown');
      fail('ASTRICT_AUTH_INTENT_UNVERIFIED');
    }
    try {
      const submitted = await auth.deleteUser(ctx);
      if (submitted?.submitted !== true) throw Error('ambiguous');
    } catch {
      await persistHold(ctx, db, leaseId, 'auth_delete_ambiguous');
      fail('ASTRICT_AUTH_DELETE_AMBIGUOUS');
    }
    const after = await inspectAuth(ctx, db, auth, leaseId);
    if (after !== 'retired') {
      await persistHold(ctx, db, leaseId, 'auth_not_retired');
      fail('ASTRICT_AUTH_NOT_RETIRED');
    }
  }
  let receipt;
  try { receipt = await db.observed({ ...ctx, leaseId }); }
  catch {
    await persistHold(ctx, db, leaseId, 'auth_result_unknown');
    fail('ASTRICT_AUTH_OBSERVATION_REFUSED');
  }
  if (!own(receipt, ctx) || receipt.phase !== 'auth_confirmed'
      || receipt.post_auth_merchant_verified !== false) {
    await persistHold(ctx, db, leaseId, 'auth_result_unknown');
    fail('ASTRICT_AUTH_OBSERVATION_INVALID');
  }
  // STOP: never dispatch email or complete privacy automatically after Auth.
  return Object.freeze({ status: 'awaiting_owner_post_auth_merchant_read' });
}

// No merchant API calls here: authenticated paginated provider read + owner
// only a_strict_owner_post_auth_clearance() is an external human procedure.
// SQL barriers at BOTH confirm and finish must validate that receipt.
export async function reviewSupervisedCompletion(input, services) {
  const ctx = scope(input, services), { db, outbox } = services;
  need(db, ['claim', 'confirm', 'finish', 'hold']);
  need(outbox, ['stage']);
  const row = await dbCall(db, 'claim', { ...ctx, purpose: 'complete' }, 'ASTRICT_LEASE_REFUSED');
  const leaseId = validLease(row, ctx, 'auth_confirmed');
  let receipt;
  try { receipt = await db.confirm({ ...ctx, leaseId }); }
  catch {
    await persistHold(ctx, db, leaseId, 'provider_ambiguous');
    fail('ASTRICT_POST_AUTH_PROVIDER_HOLD');
  }
  if (!own(receipt, ctx) || receipt.phase !== 'auth_confirmed'
    || typeof receipt.recipient_email !== 'string'
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receipt.recipient_email)
    || !Number.isFinite(Date.parse(receipt.deleted_at))
    || !Number.isFinite(Date.parse(receipt.deletion_requested_at))
    || Date.parse(receipt.deleted_at) < Date.parse(receipt.deletion_requested_at)) {
    await persistHold(ctx, db, leaseId, 'provider_ambiguous');
    fail('ASTRICT_COMPLETION_RECEIPT_INVALID');
  }
  let staged;
  try { staged = await outbox.stage({ ...ctx, leaseId, receipt }); }
  catch {
    await persistHold(ctx, db, leaseId, 'outbox_uncertain');
    fail('ASTRICT_OUTBOX_NOT_DURABLE');
  }
  if (!isUuid(staged?.id) || staged.status !== 'deletion_staged') {
    await persistHold(ctx, db, leaseId, 'outbox_uncertain');
    fail('ASTRICT_OUTBOX_NOT_STAGED');
  }
  try {
    if (await db.finish({ ...ctx, leaseId, outboxId: staged.id }) !== true) {
      throw Error('not acknowledged');
    }
  } catch {
    await persistHold(ctx, db, leaseId, 'unknown_payment');
    fail('ASTRICT_FINAL_BARRIER_REFUSED');
  }
  return Object.freeze({ status: 'completed_after_post_auth_owner_clearance' });
}
