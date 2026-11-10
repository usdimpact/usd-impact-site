// #1103 F2 end-to-end NEGATIVE. Signed bound invoice through the real JS
// handler -> fake PostgREST adapter -> REAL disposable PostgreSQL 17 invoice
// RPC/incident triggers. There is never an HTTP request or real merchant/Auth.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { processResearchMembershipWebhook } from '../src/lib/research-membership-webhook-handler.js';

const bridge=fileURLToPath(new URL('../../../supabase/tests/research-p1/signed_invoice_auth_intent_bridge.py',import.meta.url));
function db(op,data={}) {
  const result=execFileSync('python3',[bridge,op,JSON.stringify(data)],
    {encoding:'utf8',timeout:12000});
  return JSON.parse(result);
}
const caseData=db('setup');
assert.equal(caseData.preAuthIntent,true,'SQL Auth attempt must already be durable');
assert.match(caseData.serverVersion,/^17\./,'replay must actually use PostgreSQL 17 in this CI job');

const env={
  VERCEL_ENV:'preview',
  RESEARCH_MEMBERSHIP_WEBHOOK_ENABLED:'true',
  LEMON_SQUEEZY_RESEARCH_TEST_MODE:'true',
  LEMON_SQUEEZY_RESEARCH_TEST_WEBHOOK_SECRET:'offline-only-replay-test-signing-key',
  LEMON_SQUEEZY_RESEARCH_TEST_STORE_ID:'42',
  LEMON_SQUEEZY_RESEARCH_TEST_PRODUCT_ID:'99',
  LEMON_SQUEEZY_RESEARCH_TEST_MONTHLY_VARIANT_ID:'314',
  LEMON_SQUEEZY_RESEARCH_TEST_ANNUAL_VARIANT_ID:'315',
  SUPABASE_URL:'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_SECRET_KEY:'sb_secret_offline_only_not_a_real_key',
};
const calls=[];
let denyInvoice=false;
const json=(obj,code=200)=>new Response(JSON.stringify(obj),{status:code});
async function interceptedFetch(url,init={}) {
  const u=new URL(url);
  assert.equal(u.origin,env.SUPABASE_URL,'no outbound fetch');
  assert.equal(init.headers.apikey,env.SUPABASE_SECRET_KEY);
  const m=init.method||'GET';
  calls.push(m+" "+u.pathname);
  if(u.pathname==='/rest/v1/subscriptions') {
    assert.equal(m,'GET');
    assert.equal(u.searchParams.get('provider_subscription_id'),
      'eq.'+caseData.providerSubscriptionId);
    return json(db('subscription',{providerSubscriptionId:caseData.providerSubscriptionId}));
  }
  if(u.pathname==='/rest/v1/subscription_events') {
    assert.equal(m,'GET');
    const k=u.searchParams.get('event_key');
    assert.ok(k?.startsWith('eq.lemon-squeezy:'),'globally unique signed key lookup');
    return json(db('events',{key:k.slice(3)}));
  }
  if(u.pathname==='/rest/v1/rpc/record_research_signed_invoice_receipt') {
    assert.equal(m,'POST');
    const receipt=JSON.parse(init.body);
    assert.equal(receipt.p_subscription_id,caseData.subscriptionId);
    if(denyInvoice)return json({code:'55000',message:'synthetic database unavailable'},503);
    return json(db('invoice',receipt));
  }
  throw Error('Unexpected network/RPC surface '+u.pathname);
}
function fixture(invoiceId) {
  const body={
    meta:{event_name:'subscription_payment_success',
      custom_data:{usd_impact_account_id:caseData.accountId}},
    data:{type:'subscription-invoices',id:invoiceId,attributes:{
      store_id:42,product_id:99,variant_id:314,test_mode:true,
      subscription_id:caseData.providerSubscriptionId,
      status:'paid',cancelled:false,ends_at:null,
      created_at:'2026-10-01T00:00:00.000Z',
      updated_at:'2026-10-02T00:00:01.000Z',
      renews_at:'2026-11-01T00:00:00.000Z',
    }},
  };
  const rawBody=Buffer.from(JSON.stringify(body));
  const signature=crypto.createHmac('sha256',env.LEMON_SQUEEZY_RESEARCH_TEST_WEBHOOK_SECRET)
    .update(rawBody).digest('hex');
  return {rawBody,signature};
}
function process(id) {
  return processResearchMembershipWebhook({
    ...fixture(id),environment:env,fetchImpl:interceptedFetch,
  });
}
const before=db('status',caseData);
assert.equal(before.queuePhase,'auth_pending');
assert.equal(before.authUserCount,1);
assert.equal(before.sendableEmailCount,0);
assert.equal(before.eventCount,0);
assert.equal(before.subscriptionState,'refunded');

const id='invoice_after_durable_auth_intent_'+caseData.accountId.slice(0,8);
const done=await process(id);
assert.equal(done.action,'invoice_recorded');
const after=db('status',caseData);
assert.equal(after.eventCount,1,'SQL ledger MUST persist signed invoice before 2xx');
assert.equal(after.incident?.status,'open','SQL event trigger must open durable financial incident');
assert.equal(after.queuePhase,'auth_pending','no privacy/email completion');
assert.equal(after.authUserCount,1,'failed cross-system deletion cannot remove Auth');
assert.equal(after.sendableEmailCount,0,'cannot dispatch completion email after late charge');
assert.ok(after.pendingPrivacyCount>=1,'privacy request stays in progress');
assert.equal(after.subscriptionState,'refunded','historical rights must not reactivate');

const repeated=await process(id);
assert.equal(repeated.action,'duplicate','replay must be idempotent');
assert.equal(db('status',caseData).eventCount,1);

denyInvoice=true;
await assert.rejects(
  ()=>process('invoice_uncertain_write_'+caseData.accountId.slice(0,8)),
  {code:'RESEARCH_WEBHOOK_INVOICE_RECEIPT_UNAVAILABLE',status:503},
);
denyInvoice=false;
assert.equal(db('status',caseData).eventCount,1,'failed receipt is NOT acknowledged as persisted');
assert.ok(calls.filter(s=>s.includes('/record_research_signed_invoice_receipt')).length>=2);
assert.ok(calls.every(s=>s.includes('/rest/v1/')),'only local bridge operations');
console.log('RESEARCH_BOUND_INVOICE_AFTER_AUTH_INTENT PASS: real handler -> disposable SQL durable incident, no completion, replay idempotency, retryable failure; PG '+caseData.serverVersion);
