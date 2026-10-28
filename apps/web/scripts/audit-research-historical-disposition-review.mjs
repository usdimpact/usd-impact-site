// Frozen, read-only pre-decision mapping of already-public Research report URLs.
// Strict audit deliberately has no "approve" transition and NEVER authorizes release.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_REPORT = fileURLToPath(
  new URL('./fixtures/research-historical-disposition-review-2026-10-28.json', import.meta.url)
);
const DEFAULT_BASELINE = fileURLToPath(
  new URL('./fixtures/research-report-public-baseline-2026-10-28.json', import.meta.url)
);
const DEFAULT_RIGHTS = fileURLToPath(
  new URL('../../../governance/score-derived-publication-rights-gate.json', import.meta.url)
);
const AUTH_FIELDS = [
  'approvedPublicAndMemberUseSeparation',
  'historicalUrlRedirectCacheReview',
  'internalAuditCopyRetentionApproval',
  'privateReportOriginApproval',
  'productionReleaseAuthorization',
];
const DECISION_FIELDS = [
  'providerCounselRightsReceipt',
  'ownerEditorialRetentionDecision',
];

function result(status, reason, details = {}) {
  return Object.freeze({ status, reason, releaseAuthorized: false, ...details });
}

export function reviewHistoricalDispositionPacket(packet, baseline, rights) {
  if (!packet || typeof packet !== 'object' || Array.isArray(packet) ||
      !baseline || typeof baseline !== 'object' || Array.isArray(baseline) ||
      !rights || typeof rights !== 'object' || Array.isArray(rights)) {
    return result('HOLD', 'missing-or-invalid-review-evidence');
  }
  if (rights.state !== 'hold' || rights.decision_receipt !== null ||
      rights.approved_by !== null) {
    return result('HOLD', 'rights-governance-changed-review-required');
  }
  if (baseline.schemaVersion !== 'research-report-public-baseline-v1' ||
      baseline.disposition?.startsWith('HOLD') !== true ||
      !Array.isArray(baseline.entries) || baseline.entries.length !== 16 ||
      packet.schemaVersion !== 'research-historical-disposition-review-v1' ||
      packet.state !== 'undecided_hold' ||
      packet.baselinePath !==
        'apps/web/scripts/fixtures/research-report-public-baseline-2026-10-28.json' ||
      packet.baselineGitBlobSha !== 'd74c32623d8d29260afe1b29644f77faae34d244' ||
      packet.controllingRightsHold !==
        'https://github.com/usdimpact/usd-impact-pipeline/issues/155') {
    return result('HOLD', 'review-template-or-frozen-baseline-changed');
  }
  const a = packet.approvalEvidence;
  if (!a || typeof a !== 'object' || Array.isArray(a) ||
      DECISION_FIELDS.some(key => a[key] !== null) ||
      AUTH_FIELDS.some(key => a[key] !== false)) {
    return result('HOLD', 'unverified-decision-or-approval-asserted');
  }
  if (!Array.isArray(packet.rows) || packet.rows.length !== baseline.entries.length) {
    return result('HOLD', 'historical-report-row-count-changed');
  }
  const ids = new Set();
  for (let i = 0; i < baseline.entries.length; i += 1) {
    const frozen = baseline.entries[i];
    const item = packet.rows[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return result('HOLD', 'missing-or-malformed-report-review-row');
    }
    const key = item.type + '/' + item.periodEnd;
    if (ids.has(key)) return result('HOLD', 'duplicate-report-review-row');
    ids.add(key);
    for (const [actual, expected] of [
      [item.type, frozen.type],
      [item.periodEnd, frozen.periodEnd],
      [item.currentPublicRoute, frozen.publicRoute],
      [item.originalSourceGitBlobSha, frozen.sourceGitBlobSha],
      [item.observedStaticPublic, frozen.published],
      [item.observedSampleRoute, frozen.approvedSampleRoute],
      [item.componentDiscussionObserved, frozen.hasComponentDiscussion],
      [item.weeklyInputReferenceObserved, frozen.hasWeeklyInputReference],
      [item.nearestRegimeBoundaryObserved, frozen.hasNearestRegimeBoundary],
      [item.currentRightsClassification, 'HOLD_UNREVIEWED'],
      [item.proposedFutureAccess, 'undecided'],
      [item.publicRightsDecision, 'unreviewed'],
      [item.paidMemberRightsDecision, 'unreviewed'],
      [item.aggregateSafeReplacementApproved, false],
      [item.historicalUrlTreatment, 'undecided'],
      [item.thirdPartyCacheAndIndexPlan, 'unreviewed'],
      [item.privateAuditEvidenceRetentionPlan, 'unreviewed'],
      [item.releaseAuthorized, false],
    ]) {
      if (actual !== expected) return result('HOLD', 'report-review-row-or-approval-drift');
    }
    if (Object.keys(item).length !== 18) {
      return result('HOLD', 'unexpected-report-review-field');
    }
  }
  if (ids.size !== 16 || packet.rows.filter(row => row.observedSampleRoute).length !== 1 ||
      packet.rows.filter(row => row.type === 'weekly').length !== 13 ||
      packet.rows.filter(row => row.type === 'monthly').length !== 3) {
    return result('HOLD', 'historical-report-classification-disagreement');
  }
  return result('REVIEW_PACKET_MATCH_ONLY', '16-public-urls-await-rights-and-editorial-decision', {
    reportCount: 16,
    weekly: 13,
    monthly: 3,
    observedSampleRoutes: 1,
    rightsApprovedReports: 0,
    premiumHistoryAuthorized: false,
    historicalPublicRemovalAuthorized: false,
  });
}

export function auditHistoricalDispositionPacket({
  packetPath = DEFAULT_REPORT,
  baselinePath = DEFAULT_BASELINE,
  rightsPath = DEFAULT_RIGHTS,
} = {}) {
  const packet = JSON.parse(fs.readFileSync(packetPath, 'utf8'));
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const rights = JSON.parse(fs.readFileSync(rightsPath, 'utf8'));
  return reviewHistoricalDispositionPacket(packet, baseline, rights);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const review = auditHistoricalDispositionPacket();
  console.log(JSON.stringify(review));
  if (process.argv.includes('--check') && review.status !== 'REVIEW_PACKET_MATCH_ONLY') {
    process.exitCode = 1;
  }
}
