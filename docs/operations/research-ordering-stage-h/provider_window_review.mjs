/**
 * USD Impact O1/O4 Stage H -- REVIEW ONLY. No runtime imports.
 * No live Lemon Squeezy access, SQL writes, credentials or entitlement authority.
 * Even a stable pair of GET snapshots is not a remote atomic transaction.
 */
import { createHash } from 'node:crypto';
import { inspectResearchPaidEvidenceReview } from '../research-ordering-stage-g/provider_paid_evidence_review.mjs';

const ISO_MICROS = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/;
const SHA256 = /^[0-9a-f]{64}$/;
const pending = (reason) => Object.freeze({ disposition: 'pending_reconciliation', reason, canMutate: false });
const hash = value => createHash('sha256').update(value).digest('hex');

function micros(value) {
  if (typeof value !== 'string') return null;
  const m = ISO_MICROS.exec(value);
  if (!m) return null;
  const base = Date.parse(`${m[1]}Z`);
  if (!Number.isFinite(base) || new Date(base).toISOString().slice(0, 19) !== m[1]) return null;
  return BigInt(base) * 1000n + BigInt((m[2] || '').padEnd(6, '0'));
}

function sameLocalVersion(a, b) {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  for (const field of ['subscription', 'entitlement', 'receipt']) {
    if (!Number.isSafeInteger(a[field]) || a[field] < 0 ||
        !Number.isSafeInteger(b[field]) || a[field] !== b[field]) return false;
  }
  return true;
}

function cycleDecision(cycle, candidate, trustedAccountId) {
  if (!cycle || typeof cycle !== 'object') return 'paid_cycle_start_provenance_missing';
  if (cycle.authority !== 'synthetic_external_reviewer_only' ||
      cycle.providerAuthenticated !== false ||
      cycle.subscriptionId !== candidate.subscriptionId ||
      cycle.invoiceId !== candidate.invoiceId ||
      cycle.accountId !== trustedAccountId ||
      cycle.status !== candidate.currentProviderStatus ||
      cycle.periodEnd !== candidate.reviewPeriodEnd) {
    return 'paid_cycle_scope_or_authority_invalid';
  }
  const start = micros(cycle.periodStart);
  const end = micros(cycle.periodEnd);
  if (start === null || end === null || start >= end) return 'paid_cycle_range_invalid';
  // Stage H can check a synthetically supplied start, but Lemon Squeezy's
  // subscription/invoice GETs do not provide an authoritative paid-cycle start.
  return null;
}

export async function inspectResearchProviderWindowReview({
  stageGRequest, firstReadAt, secondReadAt,
  beforeLocalVersion, afterLocalVersion,
  cycleEvidence = null, afterFirstRead = async () => {},
} = {}) {
  if (!stageGRequest || typeof stageGRequest !== 'object' ||
      typeof stageGRequest.fetchImpl !== 'function') return pending('review_input_or_transport_missing');
  const firstTime = micros(firstReadAt), secondTime = micros(secondReadAt);
  if (firstTime === null || secondTime === null || secondTime < firstTime ||
      secondTime - firstTime > 10_000_000n) return pending('review_window_clock_invalid_or_too_old');
  if (!sameLocalVersion(beforeLocalVersion, afterLocalVersion)) {
    return pending('local_versions_missing_or_mismatched');
  }
  const first = await inspectResearchPaidEvidenceReview(stageGRequest);
  if (first.disposition !== 'candidate_for_external_atomic_reconciliation' || first.canMutate !== false) {
    return pending(`first_snapshot_${first.reason || 'not_candidate'}`);
  }
  try { await afterFirstRead(); }
  catch { return pending('provider_interread_hook_unavailable'); }
  const second = await inspectResearchPaidEvidenceReview(stageGRequest);
  if (second.disposition !== 'candidate_for_external_atomic_reconciliation' || second.canMutate !== false) {
    return pending(`second_snapshot_${second.reason || 'not_candidate'}`);
  }
  const stableFields = ['eventKey', 'signedDeliveryHash', 'subscriptionId', 'invoiceId',
    'providerInvoiceVersion', 'providerSubscriptionVersion', 'reviewPeriodEnd',
    'currentProviderStatus', 'reviewDigest'];
  if (stableFields.some(k => !first[k] || first[k] !== second[k]) ||
      !SHA256.test(first.reviewDigest) || !SHA256.test(first.signedDeliveryHash)) {
    return pending('provider_evidence_changed_between_reads');
  }
  const cycleError = cycleDecision(cycleEvidence, second, stageGRequest.trustedBinding?.accountId);
  if (cycleError) return pending(cycleError);
  const digest = hash(JSON.stringify({ eventKey: second.eventKey, signed: second.signedDeliveryHash,
    invoice: second.providerInvoiceVersion, subscription: second.providerSubscriptionVersion,
    status: second.currentProviderStatus, periodEnd: second.reviewPeriodEnd,
    periodStart: cycleEvidence.periodStart, local: beforeLocalVersion }));
  return Object.freeze({
    disposition: 'candidate_for_human_review_only',
    reason: 'two_mock_provider_reads_equal_and_synthetic_period_start_coherent',
    canMutate: false,
    evidenceDigest: digest,
    eventKey: second.eventKey,
    signedDeliveryHash: second.signedDeliveryHash,
    providerInvoiceVersion: second.providerInvoiceVersion,
    providerSubscriptionVersion: second.providerSubscriptionVersion,
    requestedPeriodStart: cycleEvidence.periodStart,
    requestedPeriodEnd: cycleEvidence.periodEnd,
    requiresRealProviderPeriodStartProof: true,
    requiresRemoteCommitReconciliation: true,
    remoteAtomicityProven: false,
  });
}
