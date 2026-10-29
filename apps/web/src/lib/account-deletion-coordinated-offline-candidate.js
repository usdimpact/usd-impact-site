// Issue #950 — REVIEW-ONLY coordinated, fail-closed synthetic finalizer.
// Not imported by the deployed cron/API. No runtime keys, global network,
// real Auth Admin, Resend, Storage, migrations or Production activation.
// The only transport/provider/outbox interactions are explicit injected mocks.
import { createAccountDeletionCompletedEmailIntent } from './account-deletion-completed-email.js';
import {
  runOfflineCompletionRecovery,
  recordOfflineCompletionOutbox,
} from './account-deletion-completion-recovery-candidate.js';
import { runOfflineDueDeletionBatch } from './account-deletion-due-batch-candidate.js';

const DEVELOPMENT_ORIGIN='https://ycstrcvshdluovtuasjc.supabase.co';
const MAX_ITEMS=5;
const EMPTY_DUE=Object.freeze({scanned:0,finalized:0,conflicts:0,manualReview:0,outcomes:Object.freeze([])});

export class OfflineCoordinatedDeletionError extends Error {
  constructor(code){super(code);this.name='OfflineCoordinatedDeletionError';this.code=code;}
}
function stop(code){throw new OfflineCoordinatedDeletionError(code);}
function strictDependencies({config,fetchImpl,authSoftDelete,enqueueCompletion,limit,now,workerNonceFactory}){
  if(config?.mode!=='offline_fixture' || config?.production!==false
    || config?.supabase?.url!==DEVELOPMENT_ORIGIN
    || !String(config.supabase?.secretKey||'').startsWith('sb_secret_')
    || typeof fetchImpl!=='function' || typeof authSoftDelete!=='function'
    || typeof enqueueCompletion!=='function'
    || (workerNonceFactory!==undefined && typeof workerNonceFactory!=='function')){
    stop('COORDINATED_DELETION_OFFLINE_HOLD');
  }
  if(!Number.isSafeInteger(limit) || limit<1 || limit>MAX_ITEMS)
    stop('COORDINATED_DELETION_LIMIT_INVALID');
  if(!Number.isFinite(new Date(now).getTime()))
    stop('COORDINATED_DELETION_CLOCK_INVALID');
}

// Recovery always comes FIRST: if a completed account's acknowledgement is
// uncertain, never start additional irreversible Auth work in this batch.
// The existing claim SQL is the final authority against cancelled requests.
export async function runOfflineCoordinatedDeletion({
  config,fetchImpl,authSoftDelete,enqueueCompletion,
  limit=1,now=new Date(),workerNonceFactory,
}={}){
  strictDependencies({config,fetchImpl,authSoftDelete,enqueueCompletion,limit,now,workerNonceFactory});
  const recovery=await runOfflineCompletionRecovery({
    config,fetchImpl,enqueueCompletion,maxItems:limit,
  });
  // Each scanned recovery consumes a budget slot, whether it succeeds or
  // fails. Any unresolved recipient halts new deletions for this invocation.
  const remaining=Math.max(0,limit-recovery.scanned);
  if(recovery.manualReview>0 || remaining===0){
    return Object.freeze({
      mode:'offline_fixture',recovery,due:EMPTY_DUE,
      newAuthWorkBlocked:recovery.manualReview>0,
      completionPolicy:'durable_outbox_and_escrow_ack',
    });
  }
  const recordCompletion=async(finalized,{candidate}={})=>{
    if(finalized?.account_id!==candidate?.account_id || !candidate?.deletion_request_id){
      stop('COORDINATED_DELETION_COMPLETION_IDENTITY_MISMATCH');
    }
    // This intent is identical to the governed launch email ledger identity.
    // Enqueue means *durably recorded*, never sent by the provider.
    let intent;
    try{intent=createAccountDeletionCompletedEmailIntent({finalizationResult:finalized});}
    catch{stop('COORDINATED_DELETION_COMPLETION_INVALID');}
    return recordOfflineCompletionOutbox({
      config,fetchImpl,enqueueCompletion,accountId:candidate.account_id,
      requestId:candidate.deletion_request_id,intent,
    });
  };
  const due=await runOfflineDueDeletionBatch({
    config,fetchImpl,authSoftDelete,recordCompletion,now,
    limit:remaining,...(workerNonceFactory?{workerNonceFactory}:{}),
  });
  return Object.freeze({
    mode:'offline_fixture',recovery,due,
    newAuthWorkBlocked:false,
    completionPolicy:'durable_outbox_and_escrow_ack',
  });
}
