/**
 * Stage M: strictly offline review-only B-5 consumed-intent contract and
 * JS/SQL canonical invoice-handoff envelope. No provider or DB actions.
 */
import {createHash} from 'node:crypto';
const ID=/^[1-9][0-9]{0,17}$/;
const HASH=/^[a-f0-9]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function hold(reason, disposition='pending_reconciliation'){
  return Object.freeze({reason,disposition,canMutate:false,
    paidCycleAuthority:false,realProviderSettlement:false,
    remoteCommitAtomicity:false,liveEntitlementEffect:false});
}
function id(s){return typeof s==='string'&&ID.test(s)}
function hash(s){return typeof s==='string'&&HASH.test(s)}

/** Identical ASCII envelope to Stage M SQL, including test/live namespace.
 * The INVOICE SNAPSHOT digest supplied here is still synthetic/untrusted.
 */
export function canonicalInvoiceHandoffV1({provider,storeId,testMode,invoiceId,
    subscriptionId,invoiceSnapshotDigest,quoteDigest}={}){
  if(provider!=='lemon-squeezy'||!id(storeId)||typeof testMode!=='boolean'||
      !id(invoiceId)||!id(subscriptionId)||!hash(invoiceSnapshotDigest)||
      !hash(quoteDigest)) throw new TypeError('invalid synthetic invoice handoff');
  const bytes=['m1',provider,storeId,testMode?'test':'live',invoiceId,
    subscriptionId,invoiceSnapshotDigest,quoteDigest].join('|');
  return Object.freeze({canonicalBytes:bytes,
    digest:createHash('sha256').update(Buffer.from(bytes,'utf8')).digest('hex'),
    canMutate:false,authority:'synthetic_review_only'});
}

/** B5 issued->consumed is not "pending". This is a synthetically supplied
 * binding gate that NEVER invokes Stage J or Stage L and can never grant.
 */
export function inspectConsumedB5InitialReview({intent,subscription,
    researchEntitlementCount,invoice,quote}={}){
  if(!intent||!subscription||!invoice||!quote)
    return hold('b5_consumed_checkout_evidence_missing');
  if(intent.state!=='consumed')
    return hold('b5_intent_not_consumed');
  if(intent.productId!=='research-membership'||subscription.productId!=='research-membership'||
      subscription.state!=='pending'||!Number.isSafeInteger(subscription.version)||
      subscription.version<1||researchEntitlementCount!==0)
    return hold('b5_initial_subscription_or_absent_entitlement_mismatch');
  if(!UUID.test(intent.accountId||'')||
      intent.accountId!==subscription.accountId||
      intent.checkoutIntentId!==quote.checkoutIntentId||
      typeof intent.checkoutIntentId!=='string'||intent.checkoutIntentId.length<6||
      intent.checkoutKey!==quote.checkoutKey||
      typeof intent.checkoutKey!=='string'||intent.checkoutKey.length<8||
      !id(intent.storeId)||intent.storeId!==quote.storeId||
      !id(intent.variantId)||intent.variantId!==quote.variantId||
      intent.testMode!==quote.testMode||
      quote.accountId!==intent.accountId||
      quote.subscriptionId!==subscription.subscriptionId||
      subscription.providerSubscriptionId!==invoice.subscriptionId||
      subscription.providerCustomerId!==invoice.customerId||
      intent.storeId!==invoice.storeId||intent.testMode!==invoice.testMode)
    return hold('b5_consumed_checkout_scope_or_quote_mismatch');
  if(invoice.billingReason!=='initial'||invoice.status!=='paid'||
      invoice.refunded!==false||invoice.refundedAmountCents!==0)
    return hold('b5_initial_invoice_status_or_reason_not_eligible');
  if(!id(invoice.invoiceId)||!id(invoice.subscriptionId)||!id(invoice.customerId)||
      !Number.isSafeInteger(invoice.totalCents)||invoice.totalCents<=0||
      !Number.isSafeInteger(quote.issuedTotalCents)||quote.issuedTotalCents!==invoice.totalCents||
      invoice.currency!==quote.currency||!hash(quote.issuedQuoteDigest)||
      !hash(invoice.invoiceSnapshotDigest))
    return hold('b5_initial_invoice_quote_not_bound');
  // The test fixture does NOT prove the merchant issued the quote, that the
  // invoice settled, or that the provider linked it to this paid cycle.
  return Object.freeze({...hold('synthetic_b5_consumed_intent_matches_pending_first_purchase',
    'candidate_for_human_review_only'),
    canonicalInvoiceKey:['lemon-squeezy',intent.storeId,intent.testMode?'test':'live',
      invoice.invoiceId].join(':'),
    expectedSubscriptionVersion:subscription.version,
    requiresAuthoritativeCycleProof:true,requiresRealIntentVerification:true});
}
