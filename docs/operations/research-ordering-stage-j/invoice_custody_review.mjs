/**
 * USD Impact Stage J -- review-only invoice custody and policy screen.
 * Imports only Stage H synthetic verifier. NEVER imported by live routes.
 * No real transport, payment, database connection or entitlement APPLY.
 */
import {createHash} from 'node:crypto';
import {inspectResearchProviderWindowReview} from '../research-ordering-stage-h/provider_window_review.mjs';

const SHA = /^[0-9a-f]{64}$/;
const ID = /^[1-9][0-9]{0,17}$/;
const UTC = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/;
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const id = v => typeof v === 'string' && ID.test(v) ? v :
  Number.isSafeInteger(v) && v > 0 ? String(v) : null;
const held = (reason, disposition='pending_reconciliation') => Object.freeze({
  disposition, reason, canMutate:false, providerSettlementProven:false,
  remoteAtomicityProven:false, providerCycleStartProven:false,
});
function utc(v) {
  if(typeof v!=='string') return null;
  const m=UTC.exec(v);
  if(!m) return null;
  const d=Date.parse(m[1]+'Z');
  if(!Number.isFinite(d)||new Date(d).toISOString().slice(0,19)!==m[1])return null;
  return BigInt(d)*1000n+BigInt((m[2]||'').padEnd(6,'0'));
}
function same(a,b) {return JSON.stringify(a)===JSON.stringify(b);}
const snapshotFields=['store_id','customer_id','subscription_id','test_mode',
  'status','refunded','refunded_at','refunded_amount','billing_reason',
  'total','currency','created_at','updated_at'];
const projected = a => Object.fromEntries(snapshotFields.map(k=>[k,a?.[k]??null]));

function validateQuote(quote, b, invoiceId, obs) {
  if(!quote||quote.source!=='synthetic_durable_quote_review_only' ||
     quote.accountId!==b.accountId || id(quote.storeId)!==id(b.storeId) ||
     id(quote.customerId)!==id(b.customerId) ||
     id(quote.subscriptionId)!==id(b.subscriptionId) ||
     id(quote.invoiceId)!==invoiceId ||
     id(quote.productId)!==id(b.productId) || id(quote.variantId)!==id(b.variantId) ||
     quote.currency!==b.currency || quote.testMode!==b.testMode ||
     !Number.isSafeInteger(quote.expectedTotalCents) || quote.expectedTotalCents<0 ||
     typeof quote.quoteId!=='string'||quote.quoteId.length<6 || quote.quoteId.length>120
  ) return 'durable_invoice_quote_or_scope_missing';
  if(obs.total!==quote.expectedTotalCents || obs.currency!==quote.currency) {
    return 'invoice_amount_not_bound_to_issued_quote';
  }
  // A positive match is synthetic evidence only. Real discounts/tax/credits need
  // a locally issued, exact total quote/adjustment policy, never a magic floor.
  return null;
}

function validateTransition(t, quote, billReason) {
  if(!t || !['first_activation','renewal'].includes(t.kind))return 'transition_intent_missing';
  if(t.kind==='first_activation') {
    if(t.fromState!=='pending' || t.toState!=='active' ||
       quote.quoteKind!=='issued_initial_checkout' ||
       quote.issuedCheckoutIntentState!=='pending' ||
       typeof quote.issuedCheckoutIntentId!=='string' ||
       quote.issuedCheckoutIntentId.length<6) return 'initial_checkout_intent_not_eligible';
    if(billReason!=='initial')return 'invoice_billing_reason_transition_mismatch';
  } else {
    if(t.fromState!=='active' || t.toState!=='active' ||
       quote.quoteKind!=='issued_renewal_terms' ||
       typeof quote.priorEntitlementVersion!=='number' ||
       !Number.isSafeInteger(quote.priorEntitlementVersion) ||
       quote.priorEntitlementVersion<0) return 'renewal_terms_or_version_missing';
    if(billReason!=='renewal')return 'invoice_billing_reason_transition_mismatch';
  }
  if(t.subscriptionVersion!==quote.subscriptionVersion ||
     !Number.isSafeInteger(t.subscriptionVersion) ||
     t.subscriptionVersion<0) return 'local_subscription_version_not_bound';
  return null;
}

/**
 * Intercepts the TWO mocked invoice GETs performed by Stage H and verifies the
 * fields Stage G/H currently omit from their review digest. The injected fetch
 * is NOT a real provider-authenticated transport; never use this to grant access.
 */
export async function inspectResearchInvoiceCustodyReview({
  stageHRequest, trustedQuote, expectedTransition, syntheticCycleLink=null,
  priorInvoiceReceipt=null,
}={}) {
  const req=stageHRequest?.stageGRequest;
  if(!req||typeof req.fetchImpl!=='function')return held('stage_h_provider_transport_missing');
  const captured=[];
  const wrapped=async (url,options)=>{
    const response=await req.fetchImpl(url,options);
    if(url.startsWith('https://api.lemonsqueezy.com/v1/subscription-invoices/') &&
       typeof response?.clone==='function') {
      try {
        const raw=await response.clone().text();
        if(Buffer.byteLength(raw,'utf8')<=196608) {
          const parsed=JSON.parse(raw);
          captured.push({id:id(parsed?.data?.id),attributes:projected(parsed?.data?.attributes)});
        }
      }catch {captured.push({error:'invoice_capture_unavailable'});}
    }
    return response;
  };
  const stageH=await inspectResearchProviderWindowReview({
    ...stageHRequest,stageGRequest:{...req,fetchImpl:wrapped},
  });
  if(stageH.canMutate!==false ||
     stageH.disposition!=='candidate_for_human_review_only') {
    return held('stage_h_not_reconciled_'+(stageH.reason||'unknown'));
  }
  if(captured.length!==2 || captured.some(x=>!x.id||!x.attributes) ||
     captured.some(x=>x.id!==stageH.eventKey.split(':').slice(-1)[0]) ||
     !same(captured[0],captured[1]))return held('invoice_fields_changed_between_provider_reads');
  const inv=captured[1].attributes;
  const binding=req.trustedBinding;
  if(!binding)return held('trusted_binding_missing');
  const invoiceId=captured[1].id;
  const quoteError=validateQuote(trustedQuote,binding,invoiceId,inv);
  if(quoteError)return held(quoteError);
  const transitionError=validateTransition(expectedTransition,trustedQuote,inv.billing_reason);
  if(transitionError)return held(transitionError);

  const originalCycle=stageHRequest?.cycleEvidence;
  const start=utc(originalCycle?.periodStart),end=utc(originalCycle?.periodEnd);
  if(start===null||end===null||start>=end)return held('invoice_cycle_start_end_unproven');
  if(!syntheticCycleLink ||
     syntheticCycleLink.authority!=='synthetic_invoice_cycle_link_only' ||
     syntheticCycleLink.providerAuthenticated!==false ||
     syntheticCycleLink.invoiceId!==invoiceId ||
     syntheticCycleLink.subscriptionId!==stageHRequest.stageGRequest.trustedBinding.subscriptionId ||
     syntheticCycleLink.accountId!==binding.accountId ||
     syntheticCycleLink.periodStart!==originalCycle.periodStart ||
     syntheticCycleLink.periodEnd!==originalCycle.periodEnd ||
     syntheticCycleLink.billingReason!==inv.billing_reason) {
    return held('invoice_to_current_paid_cycle_link_missing_or_inconsistent');
  }
  // This only ties together synthetic inputs; provider still does not attest
  // to paid-cycle start, snapshot conditional version or GET-to-COMMIT atomicity.
  // Invoice identity is provider/store/environment/invoice, NOT event name or
  // subscription. A replay against another subscription must be a conflict.
  const canonicalInvoiceKey=['lemon-squeezy',id(binding.storeId),
    binding.testMode?'test':'live',invoiceId].join(':');
  const invoiceSnapshotDigest=hash({key:canonicalInvoiceKey,invoice:inv,
    periodStart:syntheticCycleLink.periodStart,periodEnd:syntheticCycleLink.periodEnd});
  const receipt=priorInvoiceReceipt;
  if(receipt!==null) {
    if(receipt?.canonicalInvoiceKey!==canonicalInvoiceKey ||
       typeof receipt?.invoiceSnapshotDigest!=='string' ||
       !SHA.test(receipt.invoiceSnapshotDigest))return held('prior_invoice_custody_unverifiable');
    if(receipt.subscriptionId!==id(binding.subscriptionId)) {
      return Object.freeze({...held('same_invoice_key_subscription_scope_conflict','quarantined_conflict'),
        canonicalInvoiceKey,invoiceSnapshotDigest,subscriptionId:id(binding.subscriptionId)});
    }
    if(receipt.invoiceSnapshotDigest!==invoiceSnapshotDigest) {
      return Object.freeze({...held('same_invoice_key_conflicting_provider_evidence','quarantined_conflict'),
        canonicalInvoiceKey,invoiceSnapshotDigest,subscriptionId:id(binding.subscriptionId)});
    }
    return Object.freeze({...held('same_invoice_already_seen_no_second_effect','duplicate_invoice_held'),
      canonicalInvoiceKey,invoiceSnapshotDigest});
  }
  return Object.freeze({
    disposition:'candidate_for_human_review_only',
    reason:'synthetic_quote_transition_and_invoice_cycle_shapes_match',
    canMutate:false,providerSettlementProven:false,remoteAtomicityProven:false,
    providerCycleStartProven:false,requiresDurableAtomicInvoiceCustody:true,
    requiresPostCommitProviderReconciliation:true,
    canonicalInvoiceKey,invoiceSnapshotDigest,
    invoiceId,subscriptionId:id(binding.subscriptionId),
    signedDeliveryHash:stageH.signedDeliveryHash,
    invoiceBillingReason:inv.billing_reason,invoiceTotalCents:inv.total,
  });
}
