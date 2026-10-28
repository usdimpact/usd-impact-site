import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  SAFE_SCORE_SCHEMA_VERSION,
  SAFE_SCORE_SOURCE_PIPELINE,
  validatePublicSafeScore,
} from './score-public-safe-report-prototype.mjs';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const repoRoot = path.resolve(webRoot, '..', '..');
const fixture = JSON.parse(await readFile(
  new URL('./fixtures/score-v21e-site-quarantine-2026-10-28.json', import.meta.url),
  'utf8',
));

async function source(relative) {
  return readFile(path.join(repoRoot, relative), 'utf8');
}

const expectedSeries = [
  'H10/H10/JRXWTFB_N.B',
  'WPU0561',
  'H8/H8/B1001NCBA',
  'H41/H41/RESPPALDP_N.WW',
  'H41/H41/RESPPA_N.WW',
  'H15/H15/RIFLGFCY10_XII_N.B',
  'H15/H15/RIFLGFCY02_N.B',
  'H15/H15/RIFLGFCY10_N.B',
];

function syntheticScore(pipeline, schemaVersion = SAFE_SCORE_SCHEMA_VERSION) {
  return {
    schema_version: schemaVersion,
    metadata: {
      pipeline,
      generated_at_utc: '2026-10-23T22:00:00Z',
      n_weeks: 1,
      weights: { USD: 0.125 },
    },
    latest: {
      week_ending: '2026-10-23',
      score: -0.5,
      regime: 'Soft dollar regime',
      week_over_week_change: 0,
      four_week_change: 0,
    },
    history: [{ date: '2026-10-23', score: -0.5, regime: 'Soft dollar regime' }],
    release_evidence: { aggregate_history_sha256: 'a'.repeat(64) },
  };
}

test('candidate is versioned and all WEBSITE release/activation gates remain closed', () => {
  assert.equal(fixture.schemaVersion, 'score-v21e-site-quarantine-v1');
  assert.equal(fixture.candidateVersion, '2.1E-design-candidate');
  assert.equal(fixture.candidateState, 'design_only');
  assert.equal(fixture.methodologyIdentity, 'distinct_not_an_equivalent_v2_source_swap');
  assert.equal(fixture.controllingRightsIssue,
    'https://github.com/usdimpact/usd-impact-pipeline/issues/155');
  assert.equal(fixture.replacementPlanningIssue,
    'https://github.com/usdimpact/usd-impact-pipeline/issues/179');
  assert.equal(fixture.frozenDesignMergeSha, '65e71695a3d99ed6a5584548652a61dc0e66006f');
  assert.equal(fixture.frozenPreregistrationMergeSha, 'b93ab1b4514e828561e74963b1a830421a104e29');
  assert.equal(fixture.authorizationPacketMergeSha, '4810d6546d511debf49b6e0afba57c265837f71d');
  assert.deepEqual(fixture.slots.map(entry => entry.series), expectedSeries);
  assert.equal(fixture.slots.length, 8);
  assert.equal(fixture.slots.filter(entry => entry.source === 'BLS').length, 1);
  assert.equal(fixture.slots.filter(entry => entry.source === 'Federal Reserve Board').length, 7);
  assert.deepEqual(new Set(fixture.slots.map(entry => entry.role)).size, 8);
  for (const field of [
    'sourceRightsCleared', 'siteResearchExecutionAuthorized', 'liveSourceSwitchoverAuthorized',
    'researchLedgerMutationAuthorized', 'publicArtifactReplacementAuthorized',
    'productionActivationAuthorized', 'sitePublishCandidate', 'releaseAuthorized',
  ]) assert.equal(fixture[field], false, field + ' requires separate approval');
});

test('owner-approved one-off private research is distinct from site, rights and Production approval', () => {
  const receipt = fixture.oneOffPrivateResearchAuthorization;
  assert.equal(fixture.candidateStateScope,
    'website_promotion_only_separate_from_authorized_upstream_private_research');
  assert.equal(receipt.activationMergeSha, 'bb9e4c4d2ef7d28938d670746b4a57f3fb1af587');
  assert.equal(receipt.originalExecutableReceiptPath,
    'governance/score-v2-1e-real-data-research-authorization.json');
  assert.equal(receipt.approvedReceiptOriginalBlobSha, '40283d6c846c994b71e3d1a8007f1844215a655e');
  assert.equal(receipt.ownerApprovalIssue,
    'https://github.com/usdimpact/usd-impact-pipeline/issues/209');
  assert.equal(receipt.ownerApprovalCommentId, 6477834394);
  assert.equal(receipt.approvedAtUtc, '2026-10-28T18:55:48Z');
  assert.equal(receipt.historicalDecisionStatus, 'approved');
  assert.equal(receipt.executionScope, 'one_off_private_research_only');
  assert.equal(receipt.methodologyVersion, fixture.candidateVersion);
  assert.equal(receipt.designMergeSha, fixture.frozenDesignMergeSha);
  assert.equal(receipt.preregistrationMergeSha, fixture.frozenPreregistrationMergeSha);
  assert.deepEqual([receipt.sourceHistoryStart, receipt.sourceHistoryEnd],
    ['2013-01-01', '2026-10-23']);
  assert.deepEqual(receipt.exactSeries, expectedSeries);
  assert.deepEqual(receipt.officialSourceAllowlist,
    ['www.federalreserve.gov', 'www.bls.gov', 'data.bls.gov']);
  for (const key of [
    'realDataFetchApprovedAtActivation', 'realDataResearchApprovedAtActivation', 'ephemeralSourceValuesOnly',
    'ephemeralRawResponsesOnly', 'privateIsolatedWorkspaceOnly', 'rightsHoldRemains',
  ]) assert.equal(receipt[key], true, key);
  for (const key of [
    'durableRawStorageApproved', 'additionalPaidSourcesApproved',
    'sourceContractAcceptanceApproved', 'researchLedgerMutationApproved',
    'publicArtifactReplacementApproved', 'commercialMemberDistributionApproved',
    'productionApproved', 'websiteSourceSwitchApproved',
    'websiteRealDataResearchExecutionApproved',
  ]) assert.equal(receipt[key], false, key);
  assert.equal(fixture.siteResearchExecutionAuthorized, false);
  assert.equal(fixture.publicArtifactReplacementAuthorized, false);
  assert.equal(fixture.sitePublishCandidate, false);
  assert.equal(fixture.releaseAuthorized, false);
});

test('H.15 point-in-time vintage blocker overrides the historic one-off owner approval', () => {
  const stop = fixture.preflightStop;
  const receipt = fixture.oneOffPrivateResearchAuthorization;
  assert.equal(receipt.historicalDecisionStatus, 'approved');
  assert.equal(receipt.realDataResearchApprovedAtActivation, true);
  assert.equal(stop.blockingIssue,
    'https://github.com/usdimpact/usd-impact-pipeline/issues/218');
  assert.equal(stop.controllingRunIssue,
    'https://github.com/usdimpact/usd-impact-pipeline/issues/211');
  assert.equal(stop.lastObservedFailedWorkflow,
    'https://github.com/usdimpact/usd-impact-pipeline/actions/runs/40755916179');
  assert.equal(stop.stage, 'authorized_historical_vintage_feasibility_preflight');
  assert.equal(stop.disposition, 'BLOCKED_FAIL_CLOSED');
  assert.deepEqual(stop.verifiedFixedFederalFamilies, ['H10', 'H8', 'H41']);
  assert.equal(stop.blockingFamily, 'H15');
  assert.equal(stop.sampleReleaseDate, '2020-01-06');
  assert.equal(stop.attemptedBoardArchivePath, '/releases/h15/20200106/default.htm');
  assert.equal(stop.sourceHttpStatus, 404);
  assert.equal(stop.upstreamReceiptDeactivationManagedByPipeline, true);
  assert.equal(stop.laterRedesignRequiresDistinctVersionAndFreshPreregistration, true);
  for (const key of [
    'candidateScoreComputed', 'allEightSeriesHistoricalVintageAvailable',
    'currentRevisedDDPSubstituteAllowed', 'additionalThirdPartySourceAllowedUnderOriginalApproval',
    'dropOrReweightH15UnderOriginalPreregistrationAllowed',
    'fullCandidateResearchAllowedAfterStop', 'releaseAuthorized', 'sourceRightsCleared',
  ]) assert.equal(stop[key], false, key + ' must fail closed');
  assert.equal(fixture.siteResearchExecutionAuthorized, false);
  assert.equal(fixture.productionActivationAuthorized, false);
  assert.equal(fixture.publicArtifactReplacementAuthorized, false);
});

test('upstream consumption has removed the executable research receipt after H.15 STOP', () => {
  const approved = fixture.oneOffPrivateResearchAuthorization;
  const state = fixture.oneOffResearchConsumption;
  assert.equal(approved.historicalDecisionStatus, 'approved');
  assert.equal(approved.realDataFetchApprovedAtActivation, true);
  assert.equal(approved.realDataResearchApprovedAtActivation, true);
  assert.equal(approved.ownerApprovalPreservedAsAuditEvidence, true);
  assert.equal(approved.currentlyExecutable, false);
  assert.equal(approved.activeReceiptStillPresent, false);
  assert.equal(state.observedPipelineMainSha,
    'f2ac360fa01b4fbe87a2a94b0da4519d63210515');
  assert.equal(fixture.reviewedPipelineMainSha, state.observedPipelineMainSha);
  assert.equal(state.state, 'one_off_private_research_consumed_fail_closed');
  assert.equal(state.consumptionRecordPath,
    'governance/score-v2-1e-real-data-research-consumption-2026-10-28.json');
  assert.equal(state.consumptionRecordGitBlobSha,
    '05c2dcb2e88bddd7f2fc0e297da7afa6c1a5e6a5');
  assert.equal(state.executionContractGitBlobSha,
    'b728d9efb75c569c06afb5ba6a95a12dfe5a81a8');
  assert.equal(state.consumptionDateUtc, '2026-10-28T19:39:10Z');
  assert.equal(state.ownerApprovalCommentId, approved.ownerApprovalCommentId);
  assert.equal(state.blockerIssue, fixture.preflightStop.blockingIssue);
  assert.equal(state.failedPreflightRun, fixture.preflightStop.lastObservedFailedWorkflow);
  assert.deepEqual([state.researchWindowStart,state.researchWindowEnd],
    [approved.sourceHistoryStart,approved.sourceHistoryEnd]);
  for (const field of [
    'originalExecutableReceiptRemoved', 'historicOwnerApprovalPreserved',
    'newExplicitOwnerAuthorizationRequiredForAnyFutureResearch',
  ]) assert.equal(state[field], true, field);
  for (const field of [
    'realDataFetchAuthorizedNow', 'realDataResearchAuthorizedNow',
    'fullScoreComputed', 'rawOrComponentValuesPersisted',
    'publicArtifactReplacementAuthorized', 'researchLedgerMutationAuthorized',
    'productionAuthorized', 'commercializationAuthorized', 'releaseAuthorized',
  ]) assert.equal(state[field], false, field);
  assert.equal(fixture.preflightStop.upstreamReceiptConsumptionCompleted, true);
  assert.equal(fixture.preflightStop.oldApprovalReusable, false);
  assert.equal(fixture.siteResearchExecutionAuthorized, false);
  assert.equal(fixture.sitePublishCandidate, false);
  assert.equal(fixture.releaseAuthorized, false);
});


test('upstream provenance review preserves five no-exception paths and three prior H.15 caveats', () => {
  const review = fixture.provenanceReview;
  const noException = 'no_specific_exception_identified_in_reviewed_official_publication_path';
  const residual = 'residual_upstream_provenance_requires_explicit_scope_confirmation';
  assert.equal(review.reviewedMergeSha, 'd4d1e441f6dd91e1d249d9f3ad515c76e2d3f61b');
  assert.equal(fixture.reviewedPipelineMainSha, 'f2ac360fa01b4fbe87a2a94b0da4519d63210515');
  assert.equal(fixture.h15PublishedOutputScope.precedingProvenanceReviewMergeSha,
    review.reviewedMergeSha);
  assert.equal(review.reviewedSourcePath,
    'governance/score-v2-1e-upstream-provenance-review.json');
  assert.equal(review.reviewedSourceBlobSha, '2e95a744ac9bc43a260fb7ab09a82ee580dce361');
  assert.equal(review.state, 'evidence_only_no_source_approval');
  assert.equal(review.historicalEvidenceSnapshotAtMerge, true);
  assert.equal(review.noSpecificExceptionIdentified, 5);
  assert.equal(review.residualUpstreamProvenance, 3);
  assert.equal(review.noSpecificExceptionIdentified + review.residualUpstreamProvenance, 8);
  assert.deepEqual(review.residualRoles, ['REAL_YIELD', 'UST_2Y', 'UST_10Y']);
  assert.deepEqual(fixture.slots.filter(x => x.provenanceClassification === residual)
    .map(x => x.role), review.residualRoles);
  assert.deepEqual(fixture.slots.filter(x => x.provenanceClassification === noException)
    .map(x => x.role), ['USD', 'ENERGY', 'FIN_CONDITIONS', 'FIN_STRESS', 'LIQUIDITY']);
  assert.match(review.residualCaveat, /upstream market quotations/);
  assert.ok(fixture.slots.every(x => x.sourceScopeApproved === false),
    'A non-exception finding must never be interpreted as data reuse approval');
  for (const field of [
    'sourceApproval', 'realDataFetchAuthorized', 'realDataResearchAuthorized',
    'productionAuthorized', 'siteReleaseAuthorized',
  ]) assert.equal(review[field], false, field + ' requires a separate approval');
});

test('published government H.15 output scope does not authorize raw OTC quote use or source approval', () => {
  const scope = fixture.h15PublishedOutputScope;
  const publishedClass =
    'government_derived_published_output_no_specific_third_party_notice_identified_on_reviewed_output_path';
  assert.equal(scope.reviewMergeSha, 'd99530589eade93de5827de9ba29bb341884d3e8');
  assert.equal(fixture.h15PublishedOutputScope.reviewMergeSha, 'd99530589eade93de5827de9ba29bb341884d3e8');
  assert.equal(scope.reviewedSourcePath,
    'governance/score-v2-1e-h15-output-scope-review.json');
  assert.equal(scope.reviewedSourceBlobSha, 'e6e0cb540b9765a02f5f8f8e842ede7ba6e52371');
  assert.equal(scope.originatingIssue,
    'https://github.com/usdimpact/usd-impact-pipeline/issues/207');
  assert.equal(scope.state, 'evidence_only_no_source_approval');
  assert.equal(scope.classification, publishedClass);
  assert.deepEqual(scope.h15Roles, ['REAL_YIELD', 'UST_2Y', 'UST_10Y']);
  const h15Rows = fixture.slots.filter(x => scope.h15Roles.includes(x.role));
  assert.equal(h15Rows.length, 3);
  assert.deepEqual(h15Rows.map(x => x.role), scope.h15Roles);
  assert.ok(h15Rows.every(x =>
    x.reviewedH15OutputClassification === publishedClass &&
    x.rawUpstreamQuoteUse === false &&
    x.sourceScopeApproved === false));
  assert.equal(scope.publishedGovernmentOutputsOnly, true);
  assert.equal(scope.noSpecificThirdPartyNoticeIdentifiedOnReviewedPublishedOutputPath, true);
  assert.equal(scope.rightsHoldRemains, true);
  assert.equal(scope.historicalEvidenceSnapshotAtMerge, true);
  assert.equal(scope.activeResearchAuthorizationReceiptPresentAtReview, false);
  for (const field of [
    'rawUpstreamOTCQuotesInScope', 'reconstructionOfRawUpstreamQuotesInScope',
    'paidOrCredentialedSourceInScope', 'legalConclusion', 'sourceApproval',
    'realDataFetchAuthorized', 'realDataResearchAuthorized',
    'publicArtifactReplacementAuthorized', 'researchLedgerMutationAuthorized',
    'productionAuthorized',
  ]) assert.equal(scope[field], false, field + ' is not authorized');
  assert.equal(scope.remainingDecisionAtReview,
    'owner_decision_required_before_any_one_off_private_real_data_research');
});

test('website Score v2 source and public-safe prototype cannot silently accept v2.1E', async () => {
  assert.equal(fixture.legacySiteProductionMethodology, 'v2');
  assert.equal(fixture.legacyAggregateSchema, SAFE_SCORE_SCHEMA_VERSION);
  assert.equal(fixture.legacyAggregatePipeline, SAFE_SCORE_SOURCE_PIPELINE);
  const score = await source('apps/web/src/pages/score.astro');
  const methodology = await source('apps/web/src/pages/score/methodology.astro');
  assert.match(score, /USD Impact Score v2 uses eight fixed-weight weekly market levels/);
  assert.match(methodology, /USD Impact Score v2 Methodology/);
  assert.ok(methodology.includes('0.125 × (DXY − WTI − SPX + VIX − BTC − GOLD + UST2Y + UST10Y)'));
  assert.match(score, /href="\/score\/member\/en\/"/);
  assert.equal(validatePublicSafeScore(syntheticScore(SAFE_SCORE_SOURCE_PIPELINE)).schemaVersion,
    SAFE_SCORE_SCHEMA_VERSION);
  for (const pipelineName of [
    'usd_impact_score_v2_1e',
    'score-v2.1E',
    '2.1E-design-candidate',
    'usd_impact_score_v2_1f',
    'score-v2.1F',
    '2.1F-design-candidate',
    'unknown-provider',
    'usd_impact_score_v2 ' + 'replacement',
  ]) {
    assert.throws(
      () => validatePublicSafeScore(syntheticScore(pipelineName)),
      /source identity|metadata.pipeline/,
      pipelineName,
    );
  }
  assert.throws(
    () => validatePublicSafeScore(syntheticScore(
      SAFE_SCORE_SOURCE_PIPELINE, 'score-public-v21e-unsafe-alias',
    )),
    /schema_version/,
  );
});

test('new v2.1F five-slot successor remains design-only and cannot inherit v2.1E research rights', () => {
  const x = fixture.separatelyPreregisteredSuccessor;
  assert.equal(x.candidateVersion, '2.1F-design-candidate');
  assert.equal(x.state, 'preregistered_design_only');
  assert.notEqual(x.candidateVersion, fixture.candidateVersion);
  assert.equal(x.reviewedPipelineMainSha, 'bcf473e2bbcb36fa1080a3a56f77a3796d74ccaa');
  assert.equal(x.designSourcePath, 'governance/score-v2-1f-five-slot-design.json');
  assert.equal(x.designGitBlobSha, '66f063bbb91324f8c623cab5a681d8407a0fdcda');
  assert.equal(x.designMergeSha, 'e14aec35142b9536b5b889d0fae4eab9a94faf88');
  assert.equal(x.preregSourcePath, 'governance/score-v2-1f-preregistration.json');
  assert.equal(x.preregGitBlobSha, '74ef6e0834513e2c17b196a59cf05a417678bd3d');
  assert.equal(x.preregMergeSha, x.reviewedPipelineMainSha);
  assert.equal(x.issue, 'https://github.com/usdimpact/usd-impact-pipeline/issues/221');
  assert.equal(x.controllingRightsIssue, fixture.controllingRightsIssue);
  assert.equal(x.predecessorVersion, fixture.candidateVersion);
  assert.equal(x.predecessorVintageBlocker, fixture.preflightStop.blockingIssue);
  assert.equal(x.fiveSlots.length, 5);
  assert.deepEqual(x.fiveSlots.map(v => v.role),
    ['USD', 'ENERGY', 'FIN_CONDITIONS', 'FIN_STRESS', 'LIQUIDITY']);
  assert.deepEqual(x.fiveSlots.map(v => v.series), expectedSeries.slice(0, 5));
  assert.deepEqual(x.fiveSlots.map(v => v.weight), [0.2, -0.2, 0.2, 0.2, -0.2]);
  assert.equal(x.fiveSlots.reduce((sum, v) => sum + Math.abs(v.weight), 0), 1);
  assert.deepEqual(x.removedPredecessorH15Roles,
    ['REAL_YIELD', 'UST_2Y', 'UST_10Y']);
  for (const entry of x.fiveSlots) assert.equal(entry.series.startsWith('H15/'), false);
  assert.equal(x.fridayCutoffTimezone, 'America/New_York');
  assert.equal(x.fridayCutoff, '23:59:59');
  assert.equal(x.minimumPriorCompleteWeeks, 104);
  assert.equal(x.normalization, 'expanding_point_in_time_zscore');
  for (const name of [
    'currentWeekExcludedFromOwnNormalization',
    'missingSlotFailClosed',
    'frozenPreregistration',
    'initialLiveVintagePreflightRequiresSeparateOwnerApproval',
    'fullCandidateStudyRequiresSecondSeparateOwnerApproval',
  ]) assert.equal(x[name], true, name);
  for (const name of [
    'inheritedOneOffAuthorization', 'vintageFallbackAllowed',
    'currentBlsRevisionSubstituteAllowed', 'candidateScoreComputed',
    'liveVintagePreflightAuthorizedNow', 'fullCandidateResearchApproved',
    'realDataFetchApproved', 'sourceRightsApproved',
    'publicArtifactReplacementApproved', 'commercialMemberDistributionApproved',
    'researchLedgerMutationApproved', 'productionApproved', 'releaseAuthorized',
  ]) assert.equal(x[name], false, name);
});

test('v2.1F Stage 1 BLS archive 403 consumed its one-off owner approval without candidate scoring', () => {
  const successor = fixture.separatelyPreregisteredSuccessor;
  const p = successor.stageOneVintagePreflight;
  assert.equal(successor.candidateVersion, '2.1F-design-candidate');
  assert.equal(successor.state, 'preregistered_design_only');
  assert.equal(p.state, 'consumed_fail_closed');
  assert.equal(p.reviewedPipelineMainSha, '56aa8b97922266be88c2f74ebf2659a48a8abede');
  assert.equal(p.sourceRecordPath,
    'governance/score-v2-1f-live-vintage-preflight-consumption-2026-10-28.json');
  assert.equal(p.sourceRecordGitBlobSha, '0ec3f9fd1a1a3daa8340b774fc2277b15bb5b243');
  assert.equal(p.executionContractPath,
    'governance/score-v2-1f-live-vintage-preflight-execution-contract.json');
  assert.equal(p.executionContractGitBlobSha, 'f46032bef6363cc831881105bf73b555893473ec');
  assert.equal(p.ownerDecisionIssue, 'https://github.com/usdimpact/usd-impact-pipeline/issues/224');
  assert.equal(p.ownerApprovalCommentId, 6479715940);
  assert.equal(p.ownerApprovalTimestampUtc, '2026-10-28T20:20:28Z');
  assert.equal(p.activationMergeSha, '48f6815199db7c030939629f49a75001d20ae566');
  assert.equal(p.dispatchMergeSha, '6ea7eb7390ad9949799867c6db38f20664cba6a3');
  assert.equal(p.scope, 'live_historical_vintage_feasibility_preflight_only');
  assert.deepEqual([p.authorizedWindowStart, p.authorizedWindowEnd],
    ['2013-01-01', '2026-10-23']);
  assert.equal(p.preflightRunUrl,
    'https://github.com/usdimpact/usd-impact-pipeline/actions/runs/40763350781');
  assert.equal(p.preflightConclusion, 'failure');
  assert.equal(p.blockerIssue, 'https://github.com/usdimpact/usd-impact-pipeline/issues/228');
  assert.equal(p.failureStage, 'BLS PPI archive index retrieval');
  assert.equal(p.failedOfficialHost, 'www.bls.gov');
  assert.equal(p.failedOfficialPath, '/bls/news-release/ppi.htm');
  assert.equal(p.failedHttpStatus, 403);
  assert.equal(p.consumedAtUtc, '2026-10-28T20:27:02Z');
  for (const field of [
    'federalReserveFixedSamplePhaseCompleted',
    'originalReceiptRemoved', 'dispatchMarkerRemoved',
    'ownerApprovalPreservedForAuditOnly',
    'freshOwnerAuthorizationNeededForNextLiveRequest',
    'blockedDueToArchiveAccessNotSeriesDisqualification',
  ]) assert.equal(p[field], true, field);
  for (const field of [
    'fullResearchApprovedAtActivation',
    'activeReceiptPresent', 'currentRealDataFetchAuthorized',
    'currentPreflightAuthorized', 'currentFullResearchAuthorized',
    'currentCandidateScoringAuthorized', 'currentPublicArtifactReplacementAuthorized',
    'currentResearchLedgerMutationAuthorized', 'currentProductionAuthorized',
    'candidateScoreComputed', 'componentZscoresComputed',
    'componentContributionsComputed', 'sourceOrComponentValuesPersisted',
    'publicArtifactsModified', 'researchLedgersModified', 'productionModified',
    'alternativeSourceOrCurrentRevisedHistoryAllowed',
  ]) assert.equal(p[field], false, field + ' must remain denied after consumption');
  assert.equal(successor.liveVintagePreflightAuthorizedNow, false);
  assert.equal(successor.fullCandidateResearchApproved, false);
  assert.equal(successor.productionApproved, false);
  assert.equal(fixture.releaseAuthorized, false);
});

test('Score rights HOLD and Class-C component-derived public paths remain accurately classified', async () => {
  const siteRights = JSON.parse(await source('governance/score-derived-publication-rights-gate.json'));
  const consumer = JSON.parse(await source('apps/web/scripts/score-rights-consumer-manifest.json'));
  assert.equal(siteRights.state, 'hold');
  assert.equal(siteRights.decision_receipt, null);
  assert.equal(siteRights.approved_by, null);
  assert.equal(consumer.state, 'hold');
  assert.equal(consumer.production_change_authorized, false);
  assert.equal(consumer.weekly_report_publication_hold_required, true);
  assert.equal(consumer.historical_content_treatment_unresolved, true);
  for (const key of [
    '/data/usd_impact_score_v2.json',
    '/data/usd_impact_score_v2.csv',
    '/data/weekly_input_latest.json',
  ]) assert.equal(consumer.path_classes[key], 'C');
  assert.equal(consumer.runtime_consumers['apps/web/scripts/generate-weekly-report.mjs'].class, 'C');
});

test('protected Score delivery and public sample are not coupled to candidate promotion', async () => {
  const vercel = JSON.parse(await source('apps/web/vercel.json'));
  assert.ok(vercel.rewrites.some(r =>
    r.source === '/score/member/:path*' &&
    r.destination === '/api/account?action=score-member-content&path=:path*'));
  const memberHandler = await source('apps/web/src/lib/score-member-handler.js');
  assert.match(memberHandler, /RESEARCH_MEMBERSHIP_PRODUCT_ID/);
  assert.match(memberHandler, /resolveSessionWithRefresh/);
  const sample = await source('apps/web/src/pages/research/sample/index.astro');
  assert.ok(sample.includes("PUBLIC_SAMPLE_DATE = '2026-08-07'"));
  assert.ok(sample.includes('PUBLIC_SAMPLE_MIN_AGE_DAYS = 30'));
});

test('live Score sources and report generator do not import the new candidate series or version', async () => {
  const runtimePaths = [
    'apps/web/src/pages/score.astro',
    'apps/web/src/pages/score/methodology.astro',
    'apps/web/src/lib/score-pipeline-origin.js',
    'apps/web/src/lib/score-member-handler.js',
    'apps/web/src/lib/score-member-assets.js',
    'apps/web/src/lib/score-membership-handler.js',
    'apps/web/scripts/generate-weekly-report.mjs',
    '.github/workflows/weekly-report.yml',
  ];
  const forbidden = /2\.1[ef]-design-candidate|score[-_ ]v2[.\-_]?1[ef]|wpu0561|h10\/h10\/jrxwtfb_n\.b/i;
  const unexpected = [];
  for (const file of runtimePaths) {
    const text = await source(file);
    if (forbidden.test(text)) unexpected.push(file);
  }
  assert.deepEqual(unexpected, [],
    'Candidate version/series entered Score runtime without a separate methodology release');
});

console.log('Score v2.1E and v2.1F candidates isolated from live v2; no data rights or release approved.');
