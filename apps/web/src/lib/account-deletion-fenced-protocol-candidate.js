// Issue #950: source-only, unintegrated fenced deletion protocol candidate.
// REVIEW-ONLY. No scheduler, API route, Production feature flag, real provider,
// database migration or real Auth operation is wired to this module.
// All IO must be explicitly injected, and only an offline fixture may invoke.
import { randomUUID } from 'node:crypto';

const DEVELOPMENT_ORIGIN = 'https://ycstrcvshdluovtuasjc.supabase.co';
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export class FencedDeletionProtocolError extends Error {
  constructor(code) {
    super(code);
    this.name = 'FencedDeletionProtocolError';
    this.code = code;
  }
}

function fail(code) {
  throw new FencedDeletionProtocolError(code);
}

function uuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function ensureOffline({ config, fetchImpl, authSoftDelete, recordCompletion }) {
  // No implicit global fetch or external Auth client; this cannot be activated
  // by setting the legacy ACCOUNT_DELETION_FINALIZER_ENABLED environment flag.
  if (!config || config.mode !== 'offline_fixture' || config.production !== false
    || config.supabase?.url !== DEVELOPMENT_ORIGIN
    || !String(config.supabase?.secretKey || '').startsWith('sb_secret_')
    || typeof fetchImpl !== 'function' || typeof authSoftDelete !== 'function'
    || typeof recordCompletion !== 'function') {
    fail('CLAIM_PROTOCOL_OFFLINE_HOLD');
  }
}

function claimedSnapshot(candidate) {
  if (!uuid(candidate?.account_id) || !uuid(candidate?.deletion_request_id)
    || candidate.status !== 'deletion_pending' || !candidate.deletion_due_at
    || !candidate.deletion_requested_at) {
    fail('CLAIM_SNAPSHOT_INVALID');
  }
  const due=Date.parse(candidate.deletion_due_at);
  const requested=Date.parse(candidate.deletion_requested_at);
  if (!Number.isFinite(due) || !Number.isFinite(requested) || due < requested) {
    fail('CLAIM_SNAPSHOT_INVALID');
  }
  return Object.freeze({
    accountId: candidate.account_id,
    requestId: candidate.deletion_request_id,
  });
}

async function rpc({ config, fetchImpl, method, payload, errorCode }) {
  // The API path is static and cannot be controlled by the due-list candidate.
  const response = await fetchImpl(DEVELOPMENT_ORIGIN+'/rest/v1/rpc/'+method,{
    method:'POST',
    headers:{
      Accept:'application/json',
      'Content-Type':'application/json',
      apikey:config.supabase.secretKey,
    },
    body:JSON.stringify(payload),
  });
  if (!response?.ok) fail(errorCode);
  const body=await response.text();
  if (!body) fail(errorCode);
  try { return JSON.parse(body); }
  catch { fail(errorCode); }
}

function requireSingleRow(value, errorCode) {
  if (!Array.isArray(value) || value.length !== 1 || typeof value[0] !== 'object'
    || value[0] === null) fail(errorCode);
  return value[0];
}

function classifyUncertainAuth(result, error) {
  if (error?.name === 'AbortError') return 'timeout';
  if (error) return 'network_error';
  const code=Number(result?.status);
  if ([404,409,429,503].includes(code)) return 'auth_'+code;
  return 'auth_unexpected';
}

// Every call is one fresh attempt. No catch/retry loop around Auth DELETE,
// and no replay of BEGIN after a potentially committed (lost) response.
export async function runOfflineFencedDeletion({
  config, candidate, fetchImpl, authSoftDelete, recordCompletion,
  workerNonce = randomUUID(),
}) {
  ensureOffline({config,fetchImpl,authSoftDelete,recordCompletion});
  const {accountId,requestId}=claimedSnapshot(candidate);
  if (!uuid(workerNonce)) fail('CLAIM_WORKER_NONCE_INVALID');

  const claim= requireSingleRow(await rpc({
    config,fetchImpl,method:'claim_due_account_deletion',
    payload:{
      claim_account_id:accountId,
      claim_request_id:requestId,
      claim_worker_nonce:workerNonce,
    },
    errorCode:'CLAIM_NOT_GRANTED',
  }), 'CLAIM_RESPONSE_INVALID');
  if (!uuid(claim.claim_token) || !Number.isSafeInteger(claim.claim_generation)
    || claim.claim_generation < 1 || claim.claimed_auth_user_id !== accountId
    || claim.claimed_request_id !== requestId) {
    fail('CLAIM_RESPONSE_INVALID');
  }
  const fence={
    begin_account_id:accountId, begin_request_id:requestId,
    begin_token:claim.claim_token, begin_generation:claim.claim_generation,
  };
  let authUserId;
  try {
    authUserId=await rpc({
      config,fetchImpl,method:'begin_claimed_auth_removal',payload:fence,
      errorCode:'BEGIN_DISPATCH_UNCERTAIN',
    });
    if (authUserId !== accountId) fail('BEGIN_DISPATCH_UNCERTAIN');
  } catch {
    // Begin may have committed before the response was lost.
    // Never proceed to Auth on an unknown fence result.
    fail('BEGIN_DISPATCH_UNCERTAIN');
  }

  let result;
  let authError;
  try {result=await authSoftDelete({accountId,authUserId,shouldSoftDelete:true});}
  catch(error){authError=error;}

  if (authError || ![200,204].includes(result?.status)) {
    const reason=classifyUncertainAuth(result,authError);
    const ambiguousPayload={
      ambiguous_account_id:accountId,
      ambiguous_request_id:requestId,
      ambiguous_token:claim.claim_token,
      ambiguous_generation:claim.claim_generation,
      ambiguous_error_code:reason,
    };
    try {
      if (await rpc({
        config,fetchImpl,method:'mark_claimed_auth_ambiguous',
        payload:ambiguousPayload,errorCode:'AUTH_AMBIGUITY_NOT_RECORDED',
      }) !== true) fail('AUTH_AMBIGUITY_NOT_RECORDED');
    } catch {
      fail('AUTH_AMBIGUITY_NOT_RECORDED');
    }
    fail('AUTH_OUTCOME_UNVERIFIED');
  }

  try {
    if (await rpc({
      config,fetchImpl,method:'confirm_claimed_auth_soft_delete',
      payload:{
        confirm_account_id:accountId,
        confirm_request_id:requestId,
        confirm_token:claim.claim_token,
        confirm_generation:claim.claim_generation,
        confirm_http_status:result.status,
      },
      errorCode:'AUTH_CONFIRMATION_UNCERTAIN',
    }) !== true) fail('AUTH_CONFIRMATION_UNCERTAIN');
  } catch {
    // Auth has already been attempted; do not retry Auth or issue new claim.
    fail('AUTH_CONFIRMATION_UNCERTAIN');
  }

  let finalized;
  try {
    finalized=requireSingleRow(await rpc({
      config,fetchImpl,method:'finalize_claimed_account_deletion',
      payload:{
        finalize_account_id:accountId,
        finalize_request_id:requestId,
        finalize_token:claim.claim_token,
        finalize_generation:claim.claim_generation,
      },errorCode:'CLAIMED_FINALIZATION_UNCERTAIN',
    }),'CLAIMED_FINALIZATION_UNCERTAIN');
  } catch {
    fail('CLAIMED_FINALIZATION_UNCERTAIN');
  }
  if (finalized.account_id !== accountId
    || !finalized.recipient_email || !finalized.deleted_at
    || !Number.isFinite(Date.parse(finalized.deleted_at))) {
    fail('CLAIMED_FINALIZATION_UNCERTAIN');
  }
  // Completion intent occurs only after proven, claim-bound database finalize.
  // The future adapter must use durable outbox idempotency, not a direct send.
  const completion=await recordCompletion(finalized);
  if (!completion?.durable) fail('COMPLETION_NOT_DURABLE');
  return Object.freeze({status:'finalized',accountId,completionReference:completion.reference??null});
}
