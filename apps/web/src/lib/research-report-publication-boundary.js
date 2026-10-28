// Candidate-only publication boundary. This module never grants access, routes
// requests, publishes reports, or mutates a commercial record.
export const RESEARCH_REPORT_RELEASE_CLASSES = Object.freeze({
  HISTORICAL_PUBLIC: 'historical-public',
  PUBLIC_SAMPLE: 'public-sample',
  RESEARCH_PRIVATE: 'research-private',
});

const REPORT_TYPES = new Set(['weekly', 'monthly']);
const RELEASE_CLASSES = new Set(Object.values(RESEARCH_REPORT_RELEASE_CLASSES));
const PRIVATE_DELIVERY_ATTESTATIONS = Object.freeze([
  'serverSessionVerified',
  'serverResearchEntitlementVerified',
  'privateOriginStorage',
  'absentFromPublicBuild',
  'absentFromPublicAssetUrls',
  'failClosedOnUnavailableAuth',
  'responseNoStore',
  'responseNoIndex',
]);

function hold(reason) {
  return Object.freeze({ status: 'HOLD', reason, releaseAuthorized: false });
}

function candidate(reason) {
  // Not a Production release approval. Rights, deploy and buyer-path evidence
  // must be reviewed again on the exact release head.
  return Object.freeze({ status: 'CANDIDATE_ONLY', reason, releaseAuthorized: false });
}

function validUtcDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const epoch = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0, 10) === value;
}

function daysBetweenUtc(start, end) {
  return (Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86_400_000;
}

export function proposedResearchReportRoute(reportType, periodEnd) {
  if (!REPORT_TYPES.has(reportType) || !validUtcDate(periodEnd)) return null;
  return `/research/member/reports/${reportType}/${periodEnd}`;
}

export function assessResearchReportReleaseCandidate({
  reportType,
  periodEnd,
  path,
  releaseClass,
  rightsApproval,
  editorialApproval = false,
  historicalPublicApproval = false,
  previouslyPublic = false,
  publicDataReviewPassed = false,
  sampleApproval = false,
  utcAssessmentDate = null,
  privateDelivery = {},
  tradingViewIncluded = false,
} = {}) {
  if (!REPORT_TYPES.has(reportType)) return hold('invalid-report-type');
  if (!validUtcDate(periodEnd)) return hold('invalid-period-end');
  if (!RELEASE_CLASSES.has(releaseClass)) return hold('unclassified-release');
  if (tradingViewIncluded !== false) return hold('tradingview-not-in-launch-scope');
  if (editorialApproval !== true) return hold('editorial-approval-required');

  // Public distribution rights do not imply a commercial subscription license,
  // and member distribution rights do not authorize public redistribution.
  const neededRightsScope = releaseClass === RESEARCH_REPORT_RELEASE_CLASSES.RESEARCH_PRIVATE
    ? 'member'
    : 'public';
  if (rightsApproval?.approved !== true ||
      rightsApproval?.scope !== neededRightsScope ||
      rightsApproval?.sourceEvidenceReviewed !== true) {
    return hold('rights-approval-required-for-delivery-scope');
  }

  if (releaseClass === RESEARCH_REPORT_RELEASE_CLASSES.HISTORICAL_PUBLIC) {
    if (path !== `/reports/${reportType}/${periodEnd}`) return hold('invalid-historical-route');
    if (historicalPublicApproval !== true || previouslyPublic !== true) {
      return hold('historical-public-exception-not-approved');
    }
    if (publicDataReviewPassed !== true) return hold('public-data-review-required');
    return candidate('reviewed-existing-public-report-only');
  }

  if (releaseClass === RESEARCH_REPORT_RELEASE_CLASSES.PUBLIC_SAMPLE) {
    if (reportType !== 'weekly' || path !== '/research/sample/') return hold('invalid-public-sample-route');
    if (sampleApproval !== true || publicDataReviewPassed !== true) {
      return hold('public-sample-review-required');
    }
    if (!validUtcDate(utcAssessmentDate) || daysBetweenUtc(periodEnd, utcAssessmentDate) < 30) {
      return hold('public-sample-minimum-age-not-met');
    }
    return candidate('approved-historical-sample-only');
  }

  if (path !== proposedResearchReportRoute(reportType, periodEnd)) {
    return hold('invalid-private-route');
  }
  // A noindex header or middleware redirect on its own does not protect HTML
  // that has already been emitted as a public static build artifact.
  for (const attestation of PRIVATE_DELIVERY_ATTESTATIONS) {
    if (privateDelivery?.[attestation] !== true) return hold(`private-delivery-${attestation}-unverified`);
  }
  return candidate('private-delivery-requires-exact-head-release-review');
}
