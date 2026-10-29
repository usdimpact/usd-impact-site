// Issue #950: no-recipient aggregate escrow-monitor acceptance on synthetic
// PGlite only. No external network, source Supabase, real users or email.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

const source=name=>readFileSync(new URL(
  '../../../docs/operations/candidates/'+name,import.meta.url),'utf8');
const fixture=readFileSync(new URL(
  './fixtures/account-deletion-pg17-claim-schema.sql',import.meta.url),'utf8');
const claims=source('account-deletion-atomic-claim.review.sql');
const escrow=source('account-deletion-transactional-completion-escrow.review.sql');
const monitor=source('account-deletion-completion-escrow-health.review.sql');
assert.match(monitor,/REVIEW ONLY/);
assert.doesNotMatch(monitor,/delete\s+from\s+(auth|account_deletion_internal)\./i);
const db=new PGlite();
const a='11111111-2222-4333-8444-555555555555';
const b='22222222-3333-4444-8555-666666666666';
let checks=0;
const row=async(q,p=[]) => (await db.query(q,p)).rows[0];
const health=async()=>row("select * from account_deletion_internal.completion_escrow_health()");
async function createCompleted(a,email){
  await db.query("insert into public.profiles(account_id,email,status,auth_user_id,deletion_request_id,deletion_requested_at,deletion_due_at) values ($1,$2,'deletion_pending',$1,gen_random_uuid(),now()-interval '8 days',now()-interval '1 day')",[a,email]);
  const req=(await row("select deletion_request_id from public.profiles where account_id=$1",[a])).deletion_request_id;
  const claim=await row("select * from public.claim_due_account_deletion($1,$2,$3)",[a,req,randomUUID()]);
  assert.equal(claim.claimed_auth_user_id,a);
  assert.equal((await row("select public.begin_claimed_auth_removal($1,$2,$3,$4) as ok",[a,req,claim.claim_token,claim.claim_generation])).ok,a);
  assert.equal((await row("select public.confirm_claimed_auth_soft_delete($1,$2,$3,$4,200) as ok",[a,req,claim.claim_token,claim.claim_generation])).ok,true);
  const finalized=await row("select * from public.finalize_claimed_account_deletion($1,$2,$3,$4)",[a,req,claim.claim_token,claim.claim_generation]);
  assert.equal(finalized.account_id,a);
  checks+=4;
  return {req,finalized,email:email.toLowerCase()};
}
async function acknowledge(account,v){
  const id=randomUUID(),ver=Math.floor(new Date(v.finalized.deleted_at).getTime()/60000);
  await db.query("insert into public.notification_outbox(id,message_id,business_object_type,business_object_id,state_version,recipient_email_normalized,template_id,classification,consent_required,payload) values ($1,'account_deletion_completed','account_deletion_request',$2,$3,$4,'account_deletion_completed','transactional_operational',false,'{}'::jsonb)",[id,account,ver,v.email]);
  assert.equal((await row("select public.confirm_account_deletion_completion_outbox($1,$2,$3) as ok",[account,v.req,id])).ok,true);
  checks++;
  return id;
}
try{
  await db.exec(fixture);
  await db.exec("create table public.notification_outbox(id uuid primary key default gen_random_uuid(),message_id text,business_object_type text,business_object_id text,state_version integer,recipient_email_normalized text,template_id text,classification text,consent_required boolean default false,payload jsonb default '{}'::jsonb);");
  await db.exec(claims);
  await db.exec(escrow);
  await db.exec(monitor);

  const privateFunction='account_deletion_internal.completion_escrow_health()';
  const grants=await row("select has_function_privilege('anon',$1,'EXECUTE') as anon,has_function_privilege('authenticated',$1,'EXECUTE') as member,has_function_privilege('service_role',$1,'EXECUTE') as worker,has_function_privilege('postgres',$1,'EXECUTE') as operator",[privateFunction]);
  assert.deepEqual(grants,{anon:false,member:false,worker:false,operator:true});
  assert.equal((await row("select has_schema_privilege('service_role','account_deletion_internal','USAGE') as permitted")).permitted,false);
  checks+=2;

  let h=await health();
  assert.deepEqual(h,{pending_count:0,pending_over_two_hours:0,pending_over_twenty_four_hours:0,pending_inconsistent_count:0,recorded_missing_outbox_count:0,oldest_pending_age_band:'none',manual_review_required:false});
  checks++;
  const A=await createCompleted(a,'Escrow.A@Example.invalid');
  h=await health();
  assert.equal(h.pending_count,1);
  assert.equal(h.pending_over_two_hours,0);
  assert.equal(h.pending_over_twenty_four_hours,0);
  assert.equal(h.oldest_pending_age_band,'under_two_hours');
  assert.equal(h.manual_review_required,false);
  checks+=5;

  const B=await createCompleted(b,'Escrow.B@Example.invalid');
  // Deliberately age ONE synthetic pending record; never operate on real PII.
  await db.query("update account_deletion_internal.completion_intents set created_at=now()-interval '27 hours' where account_id=$1",[b]);
  h=await health();
  assert.equal(h.pending_count,2);
  assert.equal(h.pending_over_two_hours,1);
  assert.equal(h.pending_over_twenty_four_hours,1);
  assert.equal(h.oldest_pending_age_band,'at_least_24_hours');
  assert.equal(h.manual_review_required,true);
  assert.equal(h.pending_inconsistent_count,0);
  assert.equal(h.recorded_missing_outbox_count,0);
  checks+=7;
  assert.equal(JSON.stringify(h).includes('@'),false);
  assert.equal(JSON.stringify(h).includes(a),false);
  assert.equal(JSON.stringify(h).includes(b),false);
  checks+=3;

  const idB=await acknowledge(b,B);
  h=await health();
  assert.equal(h.pending_count,1);
  assert.equal(h.pending_over_twenty_four_hours,0);
  assert.equal(h.manual_review_required,false);
  assert.equal(h.oldest_pending_age_band,'under_two_hours');
  checks+=4;
  const idA=await acknowledge(a,A);
  h=await health();
  assert.equal(h.pending_count,0);
  assert.equal(h.manual_review_required,false);
  assert.equal(h.oldest_pending_age_band,'none');
  checks+=3;

  // A dangling ack is a manual error even though PII is already scrubbed;
  // the monitor must not silently mark the complete state as healthy.
  await db.query("delete from public.notification_outbox where id=$1",[idB]);
  h=await health();
  assert.equal(h.recorded_missing_outbox_count,1);
  assert.equal(h.manual_review_required,true);
  checks+=2;

  await db.exec('set role service_role');
  try{
    await assert.rejects(()=>health(),/permission denied/i);
    checks++;
  }finally{await db.exec('reset role');}
  console.log('Issue #950 no-PII completion escrow health: '+checks+
    ' synthetic assertions PASS; recipient retention not changed; no provider or real account.');
}finally{await db.close();}
