// Stage O non-authorizing R1/R2 release screen. Offline fixtures ONLY.
// Two consistent provider reads cannot certify a change made after last GET.
import assert from 'node:assert/strict';

function screenEvidence({ invoiceReads, subscriptionReads, paidCycle, remoteCAS } = {}) {
  const reasons = [];
  const inv = Array.isArray(invoiceReads) ? invoiceReads : [];
  const sub = Array.isArray(subscriptionReads) ? subscriptionReads : [];
  if (inv.length < 2 || sub.length < 2) reasons.push('insufficient_rechecks');
  if (inv.length > 0 && inv.some(x => x?.status !== 'paid' || x?.refunded !== false))
    reasons.push('invoice_not_current_paid');
  if (sub.length > 0 && sub.some(x => !['active','cancelled'].includes(x?.status)))
    reasons.push('subscription_not_eligible');
  if (inv.length >= 2 && (inv[0]?.id !== inv.at(-1)?.id ||
      inv[0]?.updated_at !== inv.at(-1)?.updated_at ||
      inv[0]?.refunded !== inv.at(-1)?.refunded ||
      inv[0]?.total !== inv.at(-1)?.total)) {
    reasons.push('invoice_changed_between_reads');
  }
  if (sub.length >= 2 && (sub[0]?.id !== sub.at(-1)?.id ||
      sub[0]?.updated_at !== sub.at(-1)?.updated_at ||
      sub[0]?.renews_at !== sub.at(-1)?.renews_at)) {
    reasons.push('subscription_changed_between_reads');
  }
  if (paidCycle?.authority !== 'independently_verified_provider_cycle' ||
      typeof paidCycle?.start !== 'string' ||
      typeof paidCycle?.end !== 'string') {
    reasons.push('no_authoritative_invoice_paid_cycle');
  }
  // Lemon Squeezy invoice/subscription API docs expose no remote
  // entitlement-conditional version token; updated_at is not a CAS token.
  if (remoteCAS?.verifiedAtomicConditionalCommit !== true ||
      remoteCAS?.providerProof !== 'independently_verified') {
    reasons.push('no_remote_atomic_commit_fence');
  }
  // Never authorize from caller-supplied booleans, even "full" synthetic proof.
  reasons.push('post_final_read_race_not_eliminated');
  return Object.freeze({
    action: reasons.some(x => /changed|not_current|not_eligible/.test(x))
      ? 'quarantine' : 'hold_for_independent_proof_and_owner_policy',
    canMutate: false,
    liveCanMutate: false,
    releaseApproved: false,
    blockers: Object.freeze([...new Set(reasons)]),
  });
}

const paid = Object.freeze({
  id:'118', status:'paid',refunded:false,updated_at:'2026-11-05T01:00:00Z',
  total:999, created_at:'2026-11-05T00:30:00Z'
});
const active = Object.freeze({
  id:'217', status:'active', updated_at:'2026-11-05T01:00:00Z',
  renews_at:'2026-12-05T00:00:00Z'
});
const normal={invoiceReads:[paid,paid], subscriptionReads:[active,active]};
let count=0;
function check(input,code,quarantine=false) {
  const result=screenEvidence(input);
  assert.equal(result.canMutate,false);
  assert.equal(result.liveCanMutate,false);
  assert.equal(result.releaseApproved,false);
  if (code) assert.ok(result.blockers.includes(code),[code,result]);
  if (quarantine) assert.equal(result.action,'quarantine');
  ++count;
}
check(normal,'no_authoritative_invoice_paid_cycle');
check({...normal,paidCycle:{start:'2026-11-05',end:'2026-12-05',authority:'caller'}},'no_authoritative_invoice_paid_cycle');
check({...normal,remoteCAS:{verifiedAtomicConditionalCommit:false,providerProof:'independently_verified'}},'no_remote_atomic_commit_fence');
check({...normal,invoiceReads:[paid,{...paid,refunded:true,updated_at:'2026-11-05T01:00:01Z'}]},'invoice_changed_between_reads',true);
check({...normal,invoiceReads:[paid,{...paid,status:'refunded',refunded:true}]},'invoice_not_current_paid',true);
check({...normal,invoiceReads:[paid,{...paid,total:998}]},'invoice_changed_between_reads',true);
check({...normal,invoiceReads:[paid,{...paid,updated_at:'2026-11-05T01:00:04Z'}]},'invoice_changed_between_reads',true);
check({...normal,subscriptionReads:[active,{...active,status:'expired'}]},'subscription_not_eligible',true);
check({...normal,subscriptionReads:[active,{...active,renews_at:'2026-12-01T00:00:00Z'}]},'subscription_changed_between_reads',true);
check({...normal,subscriptionReads:[active,{...active,updated_at:'2026-11-05T01:10:00Z'}]},'subscription_changed_between_reads',true);
check({...normal,invoiceReads:[paid]},'insufficient_rechecks');
check({...normal,subscriptionReads:[active]},'insufficient_rechecks');
check({...normal,invoiceReads:[]},'insufficient_rechecks');
check({...normal,subscriptionReads:[]},'insufficient_rechecks');
for (const value of [null,undefined,{},[],false,'',0])
  check({...normal,paidCycle:value},'no_authoritative_invoice_paid_cycle');
for (const flag of [
  'ownerApproved','ciPassed','independentQA','applyNow','skipChecks',
  'preapproved','issuerVerified','signedHmac','finalProviderReadDone',
  'serviceRoleAvailable','pendingJInvoice','forceGrant',
]) check({...normal,[flag]:true},'post_final_read_race_not_eliminated');

const impossible={...normal,
  paidCycle:{authority:'independently_verified_provider_cycle',
    start:'2026-11-05T00:00:00Z',end:'2026-12-05T00:00:00Z'},
  remoteCAS:{verifiedAtomicConditionalCommit:true,
    providerProof:'independently_verified'},
  independentQA:true,ownerApproved:true,preapproved:true,forceGrant:true
};
check(impossible,'post_final_read_race_not_eliminated');
const afterFinalRefundScenario={
  ...impossible,
  hypotheticalRemoteMutationAfterLastGET: {
    at:'2026-11-05T01:00:01Z',invoice_id:'118',refunded:true
  }
};
check(afterFinalRefundScenario,'post_final_read_race_not_eliminated');
assert.deepEqual(screenEvidence(afterFinalRefundScenario),
  screenEvidence(impossible),
  'change after final GET observationally indistinguishable, still HOLD'
);
console.log('STAGE_O_R1_R2_PROVIDER_ATOMICITY_NEGATIVES_PASS '+count+' synthetic hold/quarantine cases');
console.log('RESEARCH_STAGE_O_PROVIDER_GATE_REVIEW_PASS; no remote paid-cycle start/atomic CAS and no authorize outcome');
