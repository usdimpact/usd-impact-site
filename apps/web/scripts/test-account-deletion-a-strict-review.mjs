import assert from 'node:assert/strict';
import {
  reviewSupervisedPhaseA, reviewSupervisedAuth, reviewSupervisedCompletion, AStrictError,
} from '../src/lib/account-deletion-a-strict-review.js';

// No network, Supabase, merchant, customer or email calls. SQL-shaped receipts.
const A = '11111111-1111-4111-8111-111111111111';
const TOKEN = '22222222-2222-4222-8222-222222222222';
const LEASE = '33333333-3333-4333-8333-333333333333';
const OUTBOX = '44444444-4444-4444-8444-444444444444';
const ctx = Object.freeze({
  reviewMode: 'synthetic-only', accountId: A,
  authorizationId: TOKEN, caseRef: 'p1-1234567890ab',
});
let n = 0;
async function denied(fn, code) {
  await assert.rejects(fn, (e) => e instanceof AStrictError && e.code === code, code);
  n++;
}
function make(opts = {}) {
  const log = [], holds = [];
  let retired = opts.retired === true, phase = opts.phase || 'auth_pending';
  let prior = opts.prior === true, claimed = false, payment = opts.payment === true;
  const receipt = (x) => ({ account_id: x.accountId, authorization_id: x.authorizationId });
  const db = {
    async phaseA(x) { log.push('PHASE_A'); return { ...receipt(x), case_ref:x.caseRef, phase:'auth_pending' }; },
    async claim(x) {
      log.push('CLAIM_' + x.purpose);
      if (claimed && opts.singleLease || payment || opts.leaseFails) throw Error('leased');
      claimed = true;
      return {...receipt(x), case_ref:x.caseRef, phase, lease_id:LEASE, prior_auth_attempt:prior};
    },
    async fence() { log.push('FENCE'); if (opts.fenceFails || payment) throw Error('hold'); return true; },
    async mark() { log.push('MARK'); if (opts.markFails) throw Error('ambiguous'); prior = true; return true; },
    async observed(x) {
      log.push('OBSERVE_SQL'); if (opts.paidAfterAuth || payment) throw Error('payment');
      phase = 'auth_confirmed';
      return {...receipt(x), phase, post_auth_merchant_verified:false};
    },
    async hold(x) {
      log.push('PERSIST_HOLD');
      if (opts.holdFails) throw Error('unavailable');
      holds.push(x.reason); payment = true;
      return {...receipt(x), status:'open', persisted:true};
    },
    async confirm(x) {
      log.push('POST_AUTH_BARRIER');
      if (!opts.providerVerified || payment) throw Error('merchant unknown');
      return {...receipt(x), phase:'auth_confirmed',
        recipient_email:'synthetic@example.test',
        deletion_requested_at:'2026-11-01T00:00:00Z',
        deleted_at:'2026-11-10T00:00:00Z'};
    },
    async finish() {
      log.push('FINAL_BARRIER');
      if (opts.lateAtFinish || payment) throw Error('new receipt');
      return true;
    },
  };
  const auth = {
    async get(x) {
      log.push('AUTH_GET');
      if (opts.getFails) throw Error('503');
      if (opts.getWrongId) return {account_id:'wrong',authoritative:true,state:'retired'};
      if (opts.getUnknown) return {account_id:x.accountId,authoritative:false,state:'unknown'};
      return {account_id:x.accountId,authoritative:true,state:retired?'retired':'active'};
    },
    async deleteUser() {
      log.push('AUTH_DELETE');
      retired = true; // even an ambiguous transport result may have committed
      if (opts.deleteFails) throw Error('timeout');
      return {submitted:true};
    },
  };
  const outbox = {
    async stage() {
      log.push('STAGE_EMAIL');
      if (opts.outboxFails) throw Error('crash');
      return {id:OUTBOX,status:'deletion_staged'};
    },
  };
  return { log, holds, services:{syntheticOnly:true,db,auth,outbox},
    setPhase(v) {phase=v;}, setPayment(v) {payment=v;},
  };
}
for (const invalid of [
  {...ctx,reviewMode:'production'},
  {...ctx,accountId:'wrong'},
  {...ctx,authorizationId:'wrong'},
  {...ctx,caseRef:'customer@example.test'},
]) {
  const h = make();
  await denied(() => reviewSupervisedPhaseA(invalid,h.services),
    invalid.reviewMode==='production'?'ASTRICT_REAL_ACCOUNT_EXECUTION_DENIED':'ASTRICT_SCOPE_INVALID');
  assert.deepEqual(h.log,[]);
  n++;
}
{ const h=make(); const s=await reviewSupervisedPhaseA(ctx,h.services);
  assert.equal(s.status,'auth_pending');assert.deepEqual(h.log,['PHASE_A']);n++; }
{ const h=make({fenceFails:true});await denied(() => reviewSupervisedAuth(ctx,h.services),'ASTRICT_FENCE_REFUSED');
  assert.deepEqual(h.holds,['unknown_payment']); assert(!h.log.includes('AUTH_DELETE'));n++; }
for (const opts of [{getFails:true},{getUnknown:true},{getWrongId:true}]) {
  const h=make(opts);await denied(() => reviewSupervisedAuth(ctx,h.services),'ASTRICT_AUTH_GET_AMBIGUOUS');
  assert.deepEqual(h.holds,['auth_get_ambiguous']); assert(!h.log.includes('AUTH_DELETE'));n++;
}
{ const h=make({getFails:true,holdFails:true});await denied(() => reviewSupervisedAuth(ctx,h.services),'ASTRICT_HOLD_PERSISTENCE_UNVERIFIED');n++; }
{ const h=make({prior:true});await denied(() => reviewSupervisedAuth(ctx,h.services),'ASTRICT_REPEAT_AUTH_FORBIDDEN');
  assert.deepEqual(h.holds,['prior_auth_attempt_ambiguous']);
  assert.deepEqual(h.log,['CLAIM_auth','AUTH_GET','PERSIST_HOLD']);
  assert(!h.log.includes('FENCE')); assert(!h.log.includes('AUTH_DELETE'));n++; }
{ const h=make({prior:true,retired:true});const v=await reviewSupervisedAuth(ctx,h.services);
  assert.equal(v.status,'awaiting_owner_post_auth_merchant_read');
  assert.deepEqual(h.log,['CLAIM_auth','AUTH_GET','OBSERVE_SQL']);
  assert.deepEqual(h.holds,[]);
  assert(!h.log.includes('FENCE')); assert(!h.log.includes('AUTH_DELETE'));n++; }
{ const h=make({retired:true});await denied(() => reviewSupervisedAuth(ctx,h.services),'ASTRICT_AUTH_STATE_UNEXPECTED');
  assert(!h.log.includes('AUTH_DELETE'));n++; }
{ const h=make({markFails:true});await denied(() => reviewSupervisedAuth(ctx,h.services),'ASTRICT_AUTH_INTENT_UNVERIFIED');
  assert(!h.log.includes('AUTH_DELETE'));n++; }
{ const h=make({deleteFails:true});await denied(() => reviewSupervisedAuth(ctx,h.services),'ASTRICT_AUTH_DELETE_AMBIGUOUS');
  assert.deepEqual(h.holds,['auth_delete_ambiguous']);n++; }
{ const h=make({paidAfterAuth:true});await denied(() => reviewSupervisedAuth(ctx,h.services),'ASTRICT_AUTH_OBSERVATION_REFUSED');
  assert(h.log.includes('AUTH_DELETE'));assert(!h.log.includes('STAGE_EMAIL'));n++; }
{ const h=make();const v=await reviewSupervisedAuth(ctx,h.services);
  assert.equal(v.status,'awaiting_owner_post_auth_merchant_read');
  assert(h.log.indexOf('MARK') < h.log.indexOf('AUTH_DELETE'));assert(!h.log.includes('FINAL_BARRIER'));n++; }
{ const h=make({singleLease:true});const two=await Promise.allSettled([
  reviewSupervisedAuth(ctx,h.services),reviewSupervisedAuth(ctx,h.services)]);
  assert.equal(two.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(h.log.filter(x=>x==='AUTH_DELETE').length,1);n++; }
{ const h=make({phase:'auth_confirmed'});await denied(() => reviewSupervisedCompletion(ctx,h.services),'ASTRICT_POST_AUTH_PROVIDER_HOLD');
  assert(!h.log.includes('STAGE_EMAIL'));assert.deepEqual(h.holds,['provider_ambiguous']);n++; }
{ const h=make({phase:'auth_confirmed',providerVerified:true,outboxFails:true});
  await denied(() => reviewSupervisedCompletion(ctx,h.services),'ASTRICT_OUTBOX_NOT_DURABLE');
  assert(!h.log.includes('FINAL_BARRIER'));n++; }
{ const h=make({phase:'auth_confirmed',providerVerified:true,lateAtFinish:true});
  await denied(() => reviewSupervisedCompletion(ctx,h.services),'ASTRICT_FINAL_BARRIER_REFUSED');
  assert(h.log.indexOf('POST_AUTH_BARRIER') < h.log.indexOf('FINAL_BARRIER'));n++; }
{ const h=make({phase:'auth_confirmed',providerVerified:true});const v=await reviewSupervisedCompletion(ctx,h.services);
  assert.equal(v.status,'completed_after_post_auth_owner_clearance');
  assert.deepEqual(h.log,['CLAIM_complete','POST_AUTH_BARRIER','STAGE_EMAIL','FINAL_BARRIER']);n++; }
console.log('A-strict SQL-shaped offline negative assertions PASS: '+n+' (zero external IO).');
