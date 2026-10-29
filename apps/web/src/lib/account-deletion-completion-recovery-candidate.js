// Issue #950: SOURCE-ONLY offline, provider-free completion recovery candidate.
// NEVER imported by scheduler/API. Uses exact existing email identity contract.
// No global fetch, process.env, Resend provider or Auth Admin HTTP.
import { createHash } from 'node:crypto';
import { createAccountDeletionCompletedEmailIntent } from './account-deletion-completed-email.js';
import { verifyLaunchEmailOutboxIdentity } from './launch-email-dispatch.js';

const ORIGIN='https://ycstrcvshdluovtuasjc.supabase.co';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export class CompletionRecoveryCandidateError extends Error {
  constructor(code){super(code);this.name='CompletionRecoveryCandidateError';this.code=code;}
}
function stop(code){throw new CompletionRecoveryCandidateError(code);}
function key(config,fetchImpl,enqueueCompletion){
  if(config?.mode!=='offline_fixture'
    || config?.production!==false
    || config?.supabase?.url!==ORIGIN
    || !String(config?.supabase?.secretKey||'').startsWith('sb_secret_')
    || typeof fetchImpl!=='function'
    || typeof enqueueCompletion!=='function') stop('COMPLETION_RECOVERY_OFFLINE_HOLD');
  return config.supabase.secretKey;
}
function safeLimit(maxItems){
  if(!Number.isSafeInteger(maxItems) || maxItems<1 || maxItems>5)
    stop('COMPLETION_RECOVERY_LIMIT_INVALID');
  return maxItems;
}
function opaque(id){
  return 'ui-'+createHash('sha256').update(String(id)).digest('hex').slice(0,16);
}
async function rpc(config,fetchImpl,name,payload,errorCode){
  let response;
  try{
    response=await fetchImpl(ORIGIN+'/rest/v1/rpc/'+name,{
      method:'POST',
      headers:{
        Accept:'application/json','Content-Type':'application/json',
        apikey:config.supabase.secretKey,
      },
      body:JSON.stringify(payload),
    });
  }catch{stop(errorCode);}
  if(!response?.ok)stop(errorCode);
  try{
    const content=await response.text();
    if(!content)stop(errorCode);
    return JSON.parse(content);
  }catch{stop(errorCode);}
}
function prepare(row){
  if(!row || typeof row!=='object' || Array.isArray(row)
    || !UUID.test(row.account_id||'')
    || !UUID.test(row.deletion_request_id||'')
    || typeof row.recipient_email_normalized!=='string'
    || typeof row.deletion_requested_at!=='string'
    || typeof row.deleted_at!=='string') stop('COMPLETION_RECOVERY_ROW_INVALID');

  let intent;
  try{
    intent=createAccountDeletionCompletedEmailIntent({
      finalizationResult:{
        account_id:row.account_id,
        recipient_email:row.recipient_email_normalized,
        deletion_requested_at:row.deletion_requested_at,
        deleted_at:row.deleted_at,
      },
    });
  }catch{stop('COMPLETION_RECOVERY_ROW_INVALID');}

  if(intent?.outboxRecord?.recipient_email_normalized!==row.recipient_email_normalized
    || intent.outboxRecord.business_object_id!==row.account_id
    || intent.outboxRecord.message_id!=='account_deletion_completed'
    || intent.outboxRecord.business_object_type!=='account_deletion_request')
    stop('COMPLETION_RECOVERY_ROW_INVALID');

  return {accountId:row.account_id,requestId:row.deletion_request_id,intent};
}

export async function runOfflineCompletionRecovery({
  config,fetchImpl,enqueueCompletion,maxItems=1,
}={}){
  key(config,fetchImpl,enqueueCompletion);
  const limit=safeLimit(maxItems);

  const rows=await rpc(
    config,fetchImpl,'list_account_deletion_completion_recoveries',
    {max_items:limit},'COMPLETION_RECOVERY_SCAN_FAILED',
  );
  if(!Array.isArray(rows) || rows.length>limit)
    stop('COMPLETION_RECOVERY_SCAN_INVALID');
  const entries=rows.map(prepare);
  const seen=new Set();
  for(const entry of entries){
    if(seen.has(entry.accountId.toLowerCase()))
      stop('COMPLETION_RECOVERY_DUPLICATE_ACCOUNT');
    seen.add(entry.accountId.toLowerCase());
  }
  // Entire list validated BEFORE any email-outbox callback can be used.
  const outcomes=[];
  let recorded=0,manualReview=0;
  for(const entry of entries){
    let code=null;
    try{
      // Injected in-memory test callback only. A future approved real adapter
      // must use the existing governed enqueueLaunchEmailIntent and flags.
      const persisted=await enqueueCompletion(entry.intent);
      if(persisted?.enabled!==true || !UUID.test(persisted?.outbox?.id||''))
        stop('COMPLETION_RECOVERY_OUTBOX_NOT_DURABLE');
      try{verifyLaunchEmailOutboxIdentity(entry.intent,persisted.outbox);}
      catch{stop('COMPLETION_RECOVERY_OUTBOX_IDENTITY_MISMATCH');}

      // The SQL RPC revalidates identity against the ACTUAL DB outbox record
      // before scrubbing the temporary private recovery recipient.
      const confirmed=await rpc(
        config,fetchImpl,'confirm_account_deletion_completion_outbox',{
          recorded_account_id:entry.accountId,
          recorded_request_id:entry.requestId,
          recorded_outbox_id:persisted.outbox.id,
        },'COMPLETION_RECOVERY_ACK_UNCERTAIN',
      );
      if(confirmed!==true)stop('COMPLETION_RECOVERY_ACK_UNCERTAIN');
      recorded++;
      outcomes.push(Object.freeze({
        accountReference:opaque(entry.accountId),state:'outbox_recorded',
      }));
      continue;
    }catch(error){
      code=error instanceof CompletionRecoveryCandidateError
        ? error.code:'COMPLETION_RECOVERY_UNEXPECTED_FAILURE';
    }
    manualReview++;
    outcomes.push(Object.freeze({
      accountReference:opaque(entry.accountId),state:'manual_review',code,
    }));
  }
  return Object.freeze({
    mode:'offline_fixture',scanned:entries.length,recorded,manualReview,
    outcomes:Object.freeze(outcomes),
  });
}
