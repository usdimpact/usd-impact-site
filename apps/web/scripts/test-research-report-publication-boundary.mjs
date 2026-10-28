import assert from 'node:assert/strict';
import {
  RESEARCH_REPORT_RELEASE_CLASSES as CLASS,
  assessResearchReportReleaseCandidate as assess,
  proposedResearchReportRoute,
} from '../src/lib/research-report-publication-boundary.js';

const publicRights = { approved: true, scope: 'public', sourceEvidenceReviewed: true };
const memberRights = { approved: true, scope: 'member', sourceEvidenceReviewed: true };
const privateDelivery = {
  serverSessionVerified: true,
  serverResearchEntitlementVerified: true,
  privateOriginStorage: true,
  absentFromPublicBuild: true,
  absentFromPublicAssetUrls: true,
  failClosedOnUnavailableAuth: true,
  responseNoStore: true,
  responseNoIndex: true,
};
const history = {
  reportType: 'weekly', periodEnd: '2026-10-23',
  path: '/reports/weekly/2026-10-23', releaseClass: CLASS.HISTORICAL_PUBLIC,
  rightsApproval: publicRights, editorialApproval: true,
  historicalPublicApproval: true, previouslyPublic: true,
  publicDataReviewPassed: true,
};
const sample = {
  reportType: 'weekly', periodEnd: '2026-08-07',
  path: '/research/sample/', releaseClass: CLASS.PUBLIC_SAMPLE,
  rightsApproval: publicRights, editorialApproval: true,
  sampleApproval: true, publicDataReviewPassed: true,
  utcAssessmentDate: '2026-10-28',
};
const privateWeekly = {
  reportType: 'weekly', periodEnd: '2026-10-30',
  path: proposedResearchReportRoute('weekly', '2026-10-30'),
  releaseClass: CLASS.RESEARCH_PRIVATE,
  rightsApproval: memberRights, editorialApproval: true, privateDelivery,
};
const privateMonthly = {
  ...privateWeekly, reportType: 'monthly', periodEnd: '2026-11-20',
  path: proposedResearchReportRoute('monthly', '2026-11-20'),
};
const ready = (value) => assert.deepEqual(assess(value), {
  status: 'CANDIDATE_ONLY',
  reason: value.releaseClass === CLASS.HISTORICAL_PUBLIC
    ? 'reviewed-existing-public-report-only'
    : value.releaseClass === CLASS.PUBLIC_SAMPLE
      ? 'approved-historical-sample-only'
      : 'private-delivery-requires-exact-head-release-review',
  releaseAuthorized: false,
});
const blocked = (value, reason) => assert.deepEqual(assess(value), {
  status: 'HOLD', reason, releaseAuthorized: false,
});

// A release candidate is never an authorization to publish or change production.
ready(history);
ready(sample);
ready(privateWeekly);
ready(privateMonthly);
blocked({}, 'invalid-report-type');
blocked({ ...history, reportType: 'daily' }, 'invalid-report-type');
blocked({ ...history, periodEnd: '2026-02-30' }, 'invalid-period-end');
blocked({ ...history, releaseClass: 'published' }, 'unclassified-release');
blocked({ ...history, tradingViewIncluded: true }, 'tradingview-not-in-launch-scope');
blocked({ ...history, editorialApproval: false }, 'editorial-approval-required');
blocked({ ...history, rightsApproval: null }, 'rights-approval-required-for-delivery-scope');
blocked({ ...history, rightsApproval: memberRights }, 'rights-approval-required-for-delivery-scope');
blocked({ ...privateWeekly, rightsApproval: publicRights }, 'rights-approval-required-for-delivery-scope');
blocked({ ...history, previouslyPublic: false }, 'historical-public-exception-not-approved');
blocked({ ...history, historicalPublicApproval: false }, 'historical-public-exception-not-approved');
blocked({ ...history, publicDataReviewPassed: false }, 'public-data-review-required');
blocked({ ...history, path: '/reports/weekly/2026-10-30' }, 'invalid-historical-route');
blocked({ ...sample, path: '/reports/weekly/2026-08-07' }, 'invalid-public-sample-route');
blocked({ ...sample, reportType: 'monthly' }, 'invalid-public-sample-route');
blocked({ ...sample, sampleApproval: false }, 'public-sample-review-required');
blocked({ ...sample, utcAssessmentDate: '2026-08-30' }, 'public-sample-minimum-age-not-met');
blocked({ ...sample, utcAssessmentDate: 'not-a-date' }, 'public-sample-minimum-age-not-met');
blocked({ ...privateWeekly, path: '/reports/weekly/2026-10-30' }, 'invalid-private-route');
for (const key of Object.keys(privateDelivery)) {
  blocked({ ...privateWeekly, privateDelivery: { ...privateDelivery, [key]: false } },
    `private-delivery-${key}-unverified`);
}
blocked({ ...privateWeekly, privateDelivery: null }, 'private-delivery-serverSessionVerified-unverified');
assert.equal(proposedResearchReportRoute('weekly', '2026-11-06'), '/research/member/reports/weekly/2026-11-06');
assert.equal(proposedResearchReportRoute('monthly', '2026-11-20'), '/research/member/reports/monthly/2026-11-20');
assert.equal(proposedResearchReportRoute('daily', '2026-11-06'), null);
assert.equal(proposedResearchReportRoute('weekly', '2026-02-30'), null);
console.log('Research report publication boundary: candidate-only and fail-closed matrix passed.');
