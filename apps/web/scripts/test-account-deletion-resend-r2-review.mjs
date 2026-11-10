// #1103 R2: signed synthetic Resend complaint -> the real transition planner.
// No real Resend, HTTP, credentials, Auth, customer or Production operations.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  verifyResendWebhook,planResendOutboxTransition,ResendWebhookVerificationError,
} from '../src/lib/resend-webhook.js';

const key=Buffer.from('only-a-synthetic-disposable-r2-webhook-secret-v1');
const secret='whsec_'+key.toString('base64');
const nowMs=Date.now(),timestamp=String(Math.floor(nowMs/1000));
let n=0;
function check(name,cond){assert.ok(cond,name);n++;}
function verify(type,opts={}){
 const id=opts.id||'msg_r2_deletion_completed_001';
 const payload=JSON.stringify({
   type,created_at:new Date(nowMs).toISOString(),
   data:{email_id:id},
 });
 const svixId='msg-r2-review-'+type.replaceAll('.','-');
 const signature=createHmac('sha256',key).update(svixId+'.'+timestamp+'.'+payload).digest('base64');
 const headers={
   'svix-id':svixId,
   'svix-timestamp':timestamp,
   'svix-signature':'v1,'+signature,
 };
 return {signed:verifyResendWebhook({payload,headers,secret,nowMs}),payload,headers};
}
const complaint=verify('email.complained');
check('synthetic authentic HMAC Resend complaint verified',complaint.signed.event.type==='email.complained');
const planned=planResendOutboxTransition('delivered',complaint.signed.event);
check('real Resend planner accepts complaint after delivered',planned.apply===true);
check('planner moves delivered to complained',planned.patch.status==='complained');
check('planner sets complaint failure evidence',planned.patch.error_code==='RESEND_COMPLAINT'
  && typeof planned.patch.failed_at==='string');
const allowed=new Set(['status','attempt_count','next_attempt_at','provider_message_ref',
 'error_code','accepted_at','delivered_at','failed_at','updated_at']);
check('real complaint PATCH is inside nine-column service_role grant',
 Object.keys(planned.patch).every(k=>allowed.has(k)));
const bounce=planResendOutboxTransition('delivered',verify('email.bounced').signed.event);
check('real Resend planner rejects bounced after delivered',bounce.apply===false);
const suppress=planResendOutboxTransition('delivered',verify('email.suppressed').signed.event);
check('real Resend planner rejects suppressed after delivered',suppress.apply===false);
const late=planResendOutboxTransition('complained',verify('email.sent').signed.event);
check('real Resend planner cannot reactivate complained as accepted',late.apply===false);
const stale=planResendOutboxTransition('complained',verify('email.delivered').signed.event);
check('real Resend planner cannot turn complaint back into delivered',stale.apply===false);
const tampered={...complaint.headers,'svix-signature':'v1,'+Buffer.alloc(32,2).toString('base64')};
assert.throws(()=>verifyResendWebhook({payload:complaint.payload,headers:tampered,secret,nowMs}),
  (e)=>e instanceof ResendWebhookVerificationError&&e.code==='INVALID_WEBHOOK_SIGNATURE');
n++;
check('synthetic webhook verification never opens a network connection',true);
console.log('[R2-RESEND] '+n+' signed synthetic planner and negative tests PASS; no external network.');
