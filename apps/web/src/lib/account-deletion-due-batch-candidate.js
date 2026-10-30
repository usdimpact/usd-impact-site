// Issue #950 — unimported offline-only due-account batch coordinator candidate.
// REVIEW ONLY: does NOT replace the deployed scheduler or call real services.
// No default fetch, provider adapter, email outbox, environment or network.
import { createHash, randomUUID } from 'node:crypto';
import {
  FencedDeletionProtocolError,
  runOfflineFencedDeletion,
} from './account-deletion-fenced-protocol-candidate.js';

const DEVELOPMENT_ORIGIN = 'https://ycstrcvshdluovtuasjc.supabase.co';
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const MAX_FIXTURE_BATCH = 5;

function stop(code) {
  throw new FencedDeletionProtocolError(code);
}

function requireSafeDependencies({ config, fetchImpl, authSoftDelete, recordCompletion }) {
  if (config?.mode !== 'offline_fixture'
    || config?.production !== false
    || config.supabase?.url !== DEVELOPMENT_ORIGIN
    || !String(config.supabase?.secretKey || '').startsWith('sb_secret_')
    || typeof fetchImpl !== 'function'
    || typeof authSoftDelete !== 'function'
    || typeof recordCompletion !== 'function') {
    stop('CLAIM_BATCH_OFFLINE_HOLD');
  }
}

function shortReference(value) {
  return 'ui-' + createHash('sha256')
    .update(String(value))
    .digest('hex')
    .slice(0,16);
}

function validatedBatchSize(limit) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_FIXTURE_BATCH) {
    stop('CLAIM_BATCH_LIMIT_INVALID');
  }
  return limit;
}

function eligibleCandidate(row, nowMs) {
  const requested = Date.parse(String(row?.deletion_requested_at || ''));
  const due = Date.parse(String(row?.deletion_due_at || ''));
  return Boolean(
    row && typeof row === 'object' && !Array.isArray(row)
    && UUID.test(row.account_id || '')
    && UUID.test(row.deletion_request_id || '')
    && row.status === 'deletion_pending'
    && row.auth_user_id === row.account_id
    && row.deleted_at == null
    && Number.isFinite(requested) && Number.isFinite(due)
    && requested <= due && due <= nowMs
  );
}

// Only canonical Development PostgREST can be represented by this fixture.
// A detached pending account (dispatched/ambiguous) must never fill a fresh
// candidate batch; it is handled by a separately approved reconciler.
export async function scanOfflineDueDeletionCandidates({
  config, fetchImpl, now = new Date(), limit = 1,
}) {
  if (config?.mode !== 'offline_fixture' || config?.production !== false
    || config?.supabase?.url !== DEVELOPMENT_ORIGIN
    || !String(config?.supabase?.secretKey || '').startsWith('sb_secret_')
    || typeof fetchImpl !== 'function') {
    stop('CLAIM_BATCH_OFFLINE_HOLD');
  }
  const bounded = validatedBatchSize(limit);
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) stop('CLAIM_BATCH_TIME_INVALID');
  const time = new Date(nowMs).toISOString();
  const path =
    '/rest/v1/profiles?status=eq.deletion_pending'
    + '&auth_user_id=not.is.null'
    + '&deletion_due_at=lte.' + encodeURIComponent(time)
    + '&select=account_id,status,deletion_request_id,deletion_requested_at,deletion_due_at,deleted_at,auth_user_id'
    + '&order=deletion_due_at.asc&limit=' + bounded;
  let response;
  try {
    response=await fetchImpl(DEVELOPMENT_ORIGIN+path,{
      method:'GET',headers:{
        Accept:'application/json',apikey:config.supabase.secretKey,
      },
    });
  } catch {
    stop('CLAIM_BATCH_SCAN_FAILED');
  }
  if (!response?.ok) stop('CLAIM_BATCH_SCAN_FAILED');
  let rows;
  try {
    rows=JSON.parse(await response.text());
  } catch {
    stop('CLAIM_BATCH_SCAN_INVALID');
  }
  if (!Array.isArray(rows) || rows.length > bounded) {
    stop('CLAIM_BATCH_SCAN_INVALID');
  }
  const seen=new Set();
  for(const row of rows){
    if (!eligibleCandidate(row,nowMs)) {
      stop('CLAIM_BATCH_SNAPSHOT_INVALID');
    }
    const accountId=row.account_id.toLowerCase();
    if(seen.has(accountId)) stop('CLAIM_BATCH_DUPLICATE_ACCOUNT');
    seen.add(accountId);
  }
  return Object.freeze(rows.map(row=>Object.freeze({...row})));
}

export async function runOfflineDueDeletionBatch({
  config,fetchImpl,authSoftDelete,recordCompletion,
  now=new Date(),limit=1,
  workerNonceFactory=randomUUID,
  haltOnManualReview=false,
}){
  requireSafeDependencies({config,fetchImpl,authSoftDelete,recordCompletion});
  if (typeof workerNonceFactory !== 'function') stop('CLAIM_BATCH_WORKER_FACTORY_INVALID');
  if (typeof haltOnManualReview !== 'boolean') stop('CLAIM_BATCH_HALT_POLICY_INVALID');
  const rows=await scanOfflineDueDeletionCandidates({config,fetchImpl,now,limit});
  const outcomes=[];
  let finalized=0,conflicts=0,manualReview=0,halted=false;

  for(const row of rows){
    const accountRef=shortReference(row.account_id);
    try {
      const workerNonce=workerNonceFactory();
      const result=await runOfflineFencedDeletion({
        config,candidate:row,fetchImpl,authSoftDelete,
        // Bind the authoritative request UUID to the matching finalized
        // account; never try to infer the request from a scrubbed profile.
        recordCompletion:finalized=>recordCompletion(finalized,{candidate:row}),
        workerNonce,
      });
      if(result?.status!=='finalized') stop('CLAIM_BATCH_RESULT_INVALID');
      finalized++;
      outcomes.push(Object.freeze({accountReference:accountRef,state:'finalized'}));
    } catch(error){
      const allowedCompletionCodes=new Set([
        'COMPLETION_RECOVERY_ROW_INVALID',
        'COMPLETION_RECOVERY_OUTBOX_NOT_DURABLE',
        'COMPLETION_RECOVERY_OUTBOX_IDENTITY_MISMATCH',
        'COMPLETION_RECOVERY_ACK_UNCERTAIN',
        'COORDINATED_DELETION_COMPLETION_IDENTITY_MISMATCH',
        'COORDINATED_DELETION_COMPLETION_INVALID',
      ]);
      const code=error instanceof FencedDeletionProtocolError
        ? error.code
        : allowedCompletionCodes.has(error?.code)
          ? error.code : 'CLAIM_BATCH_UNEXPECTED_FAILURE';
      // Only a rejected claim is a conflict. Any unknown outcome after a
      // claim may involve a committed Auth handoff and must be reconciled.
      const conflict=code==='CLAIM_NOT_GRANTED';
      if (conflict) conflicts++;
      else manualReview++;
      outcomes.push(Object.freeze({
        accountReference:accountRef,
        state: conflict?'conflict':'manual_review',
        code,
      }));
      // A new unresolved Auth or durable-completion outcome must stop later
      // deletions in a coordinated safety-first batch. Existing callers keep
      // the legacy offline fixture behavior unless they opt in explicitly.
      if(haltOnManualReview && !conflict){halted=true;break;}
    }
  }
  return Object.freeze({
    mode:'offline_fixture',
    scanned:rows.length,
    processed:outcomes.length,deferred:rows.length-outcomes.length,
    halted,finalized,conflicts,manualReview,
    outcomes:Object.freeze(outcomes),
  });
}
