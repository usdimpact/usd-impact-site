import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  auditHistoricalDispositionPacket,
  reviewHistoricalDispositionPacket,
} from './audit-research-historical-disposition-review.mjs';

const readJson = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const packet = await readJson('./fixtures/research-historical-disposition-review-2026-10-28.json');
const baseline = await readJson('./fixtures/research-report-public-baseline-2026-10-28.json');
const rights = await readJson('../../../governance/score-derived-publication-rights-gate.json');
const copy = item => JSON.parse(JSON.stringify(item));
const assess = candidate => reviewHistoricalDispositionPacket(candidate, baseline, rights);

test('all 16 public historical reports remain visibly undecided, with no paid/public rights asserted', () => {
  const review = auditHistoricalDispositionPacket();
  assert.equal(review.status, 'REVIEW_PACKET_MATCH_ONLY');
  assert.equal(review.releaseAuthorized, false);
  assert.equal(review.reportCount, 16);
  assert.equal(review.weekly, 13);
  assert.equal(review.monthly, 3);
  assert.equal(review.observedSampleRoutes, 1);
  assert.equal(review.rightsApprovedReports, 0);
  assert.equal(review.premiumHistoryAuthorized, false);
  assert.equal(review.historicalPublicRemovalAuthorized, false);
  assert.equal(packet.rows.length, 16);
  assert.equal(packet.approvalEvidence.providerCounselRightsReceipt, null);
  assert.equal(packet.approvalEvidence.ownerEditorialRetentionDecision, null);
  assert.equal(packet.rows.filter(row => row.observedSampleRoute === '/research/sample/').length, 1);
  assert.equal(packet.rows.every(row => row.releaseAuthorized === false), true);
});

test('snapshot provenance and existing public URLs cannot be silently reclassified', () => {
  for (const [field, changed] of [
    ['currentPublicRoute', '/research/member/reports/weekly/2026-07-31'],
    ['originalSourceGitBlobSha', '0'.repeat(40)],
    ['observedStaticPublic', false],
    ['currentRightsClassification', 'RIGHTS_CLEARED'],
    ['observedSampleRoute', '/research/sample/'],
  ]) {
    const altered = copy(packet);
    altered.rows[0][field] = changed;
    assert.equal(assess(altered).status, 'HOLD', field);
  }
});

test('no inferred public/member/private rights, URL removal or archival redirect without review', () => {
  for (const [field, changed] of [
    ['proposedFutureAccess', 'research-private'],
    ['publicRightsDecision', 'approved'],
    ['paidMemberRightsDecision', 'approved'],
    ['historicalUrlTreatment', 'remove'],
    ['thirdPartyCacheAndIndexPlan', 'completed'],
    ['privateAuditEvidenceRetentionPlan', 'approved'],
    ['aggregateSafeReplacementApproved', true],
    ['releaseAuthorized', true],
  ]) {
    const altered = copy(packet);
    altered.rows[0][field] = changed;
    assert.equal(assess(altered).status, 'HOLD', field);
    assert.equal(assess(altered).releaseAuthorized, false);
  }
});

test('a forged approval or a rights-governance change never grants release in this audit', () => {
  for (const field of [
    'approvedPublicAndMemberUseSeparation', 'historicalUrlRedirectCacheReview',
    'internalAuditCopyRetentionApproval', 'privateReportOriginApproval',
    'productionReleaseAuthorization',
  ]) {
    const altered = copy(packet);
    altered.approvalEvidence[field] = true;
    assert.equal(assess(altered).status, 'HOLD', field);
  }
  const fake = copy(packet);
  fake.approvalEvidence.providerCounselRightsReceipt = 'synthetic-only';
  assert.equal(assess(fake).status, 'HOLD');
  const changedRights = { ...rights, state: 'approved' };
  assert.equal(reviewHistoricalDispositionPacket(packet, baseline, changedRights).status, 'HOLD');
});

test('missing, duplicate and added public report entries fail closed', () => {
  const deleted = copy(packet);
  deleted.rows.pop();
  assert.equal(assess(deleted).status, 'HOLD');
  const duplicated = copy(packet);
  duplicated.rows[2] = duplicated.rows[0];
  assert.equal(assess(duplicated).status, 'HOLD');
  const added = copy(packet);
  added.rows.push({...added.rows[0], periodEnd:'2026-11-06'});
  assert.equal(assess(added).status, 'HOLD');
  const extra = copy(packet);
  extra.rows[0].rightsGrantedBy = 'unverified';
  assert.equal(assess(extra).status, 'HOLD');
  const tamperedBaseline = copy(baseline);
  tamperedBaseline.entries.pop();
  assert.equal(reviewHistoricalDispositionPacket(packet, tamperedBaseline, rights).status, 'HOLD');
});

console.log('Historical Research report disposition: 16 pending, no automatic private/public rights or Production approval.');
