import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DRAFT_DIR, SERIES, validateWeeklyDraft, validateMonthlyDraft,
  inspectIndependentMonthlyWindow, inspectFirstFourIndependentPublishedWeeklies,
  inspectIndependentEditorialDraftHolds, runOfflineDraftValidation
} from './independent-editorial-draft.mjs';

const weekly = JSON.parse(fs.readFileSync(path.join(DRAFT_DIR, 'weekly-2026-10-30.draft.json'), 'utf8'));
const monthly = JSON.parse(fs.readFileSync(path.join(DRAFT_DIR, 'monthly-template.draft.json'), 'utf8'));
const clone = (v) => structuredClone(v);
let tests = 0;
function rejects(change, matching) {
  assert.throws(() => change(), matching);
  tests += 1;
}
const accepted = validateWeeklyDraft(weekly);
assert.equal(accepted.sourceEdtions, 5);
assert.equal(accepted.publishReady, false);
assert.equal(accepted.sourceRightsCleared, false);
assert.equal(validateMonthlyDraft(monthly).sourceCount, 0);
assert.equal(validateMonthlyDraft(monthly).publishReady, false);
assert.equal(runOfflineDraftValidation().monthly.publishReady, false);
tests += 5;

rejects(() => validateWeeklyDraft({ ...weekly, status: 'published' }), /published or ready/);
rejects(() => validateWeeklyDraft({ ...weekly, releaseAuthorized: true }), /never authorizes release/);
rejects(() => validateWeeklyDraft({ ...weekly, rightsStatus: 'approved' }), /source rights remain pending/);
rejects(() => validateWeeklyDraft({ ...weekly, score: 0 }), /unexpected fields/);
rejects(() => validateWeeklyDraft({ ...weekly, periodStart: '2026-10-27' }), /Monday/);
rejects(() => validateWeeklyDraft({ ...weekly, periodEnd: '2026-11-06' }), /one Monday-Friday/);
rejects(() => validateWeeklyDraft({ ...weekly, sourceEditions: weekly.sourceEditions.slice(0, 4) }), /five weekday/);
{
  const candidate = clone(weekly);
  candidate.sourceEditions[1].date = '2026-10-26';
  rejects(() => validateWeeklyDraft(candidate), /complete and chronological/);
}
{
  const candidate = clone(weekly);
  candidate.sourceEditions[4].gitBlobSha = '0'.repeat(40);
  rejects(() => validateWeeklyDraft(candidate), /hash changed/);
}
{
  const candidate = clone(weekly);
  candidate.claims[0].sourceId = 'invented-id';
  rejects(() => validateWeeklyDraft(candidate), /primary source ID/);
}
{
  const candidate = clone(weekly);
  candidate.claims[0].sourceUrl = 'https://example.com/other';
  rejects(() => validateWeeklyDraft(candidate), /citation URL/);
}
{
  const candidate = clone(weekly);
  candidate.claims[0].marketReactionAsserted = true;
  rejects(() => validateWeeklyDraft(candidate), /market reaction/);
}
{
  const candidate = clone(weekly);
  candidate.claims[0].rightsStatus = 'cleared';
  rejects(() => validateWeeklyDraft(candidate), /reuse license/);
}
{
  const candidate = clone(weekly);
  candidate.claims[0].claimCategory = 'official_outcome';
  candidate.claims[0].eventDate = '2026-10-30';
  rejects(() => validateWeeklyDraft(candidate), /future events are not outcomes/);
}
{
  const candidate = clone(weekly);
  const eci = candidate.claims.find((c) => c.id === 'eci-oct30');
  assert.ok(eci, 'ECI claim missing from the pilot');
  eci.postReleaseEditorialReceipt = null;
  rejects(() => validateWeeklyDraft(candidate), /post-release claim needs/);
}
{
  const candidate = clone(weekly);
  const eci = candidate.claims.find((c) => c.id === 'eci-oct30');
  eci.sourceReleaseAt = '2026-11-30T12:30:00Z';
  rejects(() => validateWeeklyDraft(candidate), /release date must agree/);
}
rejects(() => validateMonthlyDraft({ ...monthly, status: 'published' }), /published or ready/);
rejects(() => validateMonthlyDraft({ ...monthly, releaseAuthorized: true }), /never authorizes release/);
rejects(() => validateMonthlyDraft({ ...monthly, scorePath: [] }), /unexpected fields/);
rejects(() => validateMonthlyDraft({ ...monthly, sourceRule: 'legacy_score_reports' }), /four_consecutive/);

let first = new Date('2099-01-01T12:00:00Z');
while (first.getUTCDay() !== 5) first.setUTCDate(first.getUTCDate() + 1);
function friday(offsetWeeks) {
  const value = new Date(first);
  value.setUTCDate(value.getUTCDate() + offsetWeeks * 7);
  return value.toISOString().slice(0, 10);
}
const sources = [0, 1, 2, 3].map((i) => ({
  series: SERIES, kind: 'independent_weekly', periodEnd: friday(i),
  publicationStatus: 'published',
  publicationReceipt: 'https://github.com/usdimpact/usd-impact-site/pull/99999#issuecomment-99999'
}));
assert.equal(inspectIndependentMonthlyWindow(sources).fourConsecutive, true);
assert.equal(inspectIndependentMonthlyWindow(sources).publishReady, false);
tests += 2;
{
  const candidate = clone(sources);
  candidate[1].kind = 'legacy_score_weekly';
  rejects(() => inspectIndependentMonthlyWindow(candidate), /legacy Score Weeklies/);
}
{
  const candidate = clone(sources);
  candidate[2].periodEnd = friday(4);
  assert.equal(inspectIndependentMonthlyWindow(candidate).fourConsecutive, false);
  tests += 1;
}
{
  const candidate = clone(sources);
  candidate[2].periodEnd = candidate[1].periodEnd;
  rejects(() => inspectIndependentMonthlyWindow(candidate), /duplicate independent Weekly/);
}
{
  const candidate = clone(sources);
  candidate[0].publicationStatus = 'draft';
  rejects(() => inspectIndependentMonthlyWindow(candidate), /actually published/);
}
{
  const candidate = clone(monthly);
  candidate.sourceWeeklyReports = sources;
  assert.equal(validateMonthlyDraft(candidate, {
    completeInventoryAttested: true,
    fullPublishedIndependentWeeklies: sources,
    publishedIndependentMonthlyHistory: []
  }).firstFourStructurallyConfirmed, true);
  assert.equal(validateMonthlyDraft(candidate, {
    completeInventoryAttested: true,
    fullPublishedIndependentWeeklies: sources,
    publishedIndependentMonthlyHistory: []
  }).publishReady, false);
  tests += 2;
}

function syntheticSource(offsetWeeks) {
  return {
    series: SERIES, kind: 'independent_weekly', periodEnd: friday(offsetWeeks),
    publicationStatus: 'published',
    publicationReceipt: 'https://github.com/usdimpact/usd-impact-site/pull/99999#issuecomment-99999'
  };
}
function syntheticPriorMonthly(weekOffset = 0) {
  return {
    series: SERIES, kind: 'independent_monthly', periodEnd: friday(weekOffset + 3),
    publicationStatus: 'published',
    publicationReceipt: 'https://github.com/usdimpact/usd-impact-site/pull/99999#issuecomment-99999',
    sourceWeeklyPeriodEnds: [0, 1, 2, 3].map((i) => friday(weekOffset + i))
  };
}
{
  const candidate = clone(monthly);
  candidate.sourceWeeklyReports = sources;
  rejects(() => validateMonthlyDraft(candidate), /complete independent Weekly inventory must be explicitly attested/);
}
{
  const candidate = clone(monthly);
  candidate.sourceWeeklyReports = sources;
  rejects(() => validateMonthlyDraft(candidate, { completeInventoryAttested: true, publishedIndependentMonthlyHistory: [] }),
    /complete published independent Weekly inventory required/);
}
{
  const candidate = clone(monthly);
  candidate.sourceWeeklyReports = sources;
  rejects(() => validateMonthlyDraft(candidate, { completeInventoryAttested: true, fullPublishedIndependentWeeklies: sources }),
    /published independent Monthly history required/);
}
{
  const later = [1, 2, 3, 4].map(syntheticSource);
  rejects(() => inspectFirstFourIndependentPublishedWeeklies(later, {
    completeInventoryAttested: true,
    fullPublishedIndependentWeeklies: [0, 1, 2, 3, 4].map(syntheticSource),
    publishedIndependentMonthlyHistory: []
  }), /not the first four eligible/);
}
{
  rejects(() => inspectFirstFourIndependentPublishedWeeklies(sources, {
    completeInventoryAttested: true,
    fullPublishedIndependentWeeklies: [...sources, sources[0]],
    publishedIndependentMonthlyHistory: []
  }), /duplicate independent Weekly in supplied full inventory/);
}
{
  const later = [5, 6, 7, 8].map(syntheticSource);
  rejects(() => inspectFirstFourIndependentPublishedWeeklies(later, {
    completeInventoryAttested: true,
    fullPublishedIndependentWeeklies: [...sources, ...later],
    publishedIndependentMonthlyHistory: [syntheticPriorMonthly()]
  }), /first independent Weekly after prior Monthly is missing/);
}
{
  const later = [4, 5, 6, 7].map(syntheticSource);
  const result = inspectFirstFourIndependentPublishedWeeklies(later, {
    completeInventoryAttested: true,
    fullPublishedIndependentWeeklies: [...sources, ...later],
    publishedIndependentMonthlyHistory: [syntheticPriorMonthly()]
  });
  assert.equal(result.firstFourStructurallyConfirmed, true);
  assert.equal(result.publishReady, false);
  assert.equal(result.releaseAuthorized, false);
  tests += 3;
}
{
  const later = [4, 5, 6, 7].map(syntheticSource);
  rejects(() => inspectFirstFourIndependentPublishedWeeklies(later, {
    completeInventoryAttested: true,
    fullPublishedIndependentWeeklies: [...sources, ...later],
    publishedIndependentMonthlyHistory: [syntheticPriorMonthly(), syntheticPriorMonthly()]
  }), /duplicate historical independent Monthly period/);
}
{
  const candidate = clone(monthly);
  candidate.sourceWeeklyReports = sources;
  rejects(() => validateMonthlyDraft(candidate, {
    completeInventoryAttested: true,
    fullPublishedIndependentWeeklies: sources,
    publishedIndependentMonthlyHistory: [syntheticPriorMonthly()]
  }), /fewer than four published independent Weeklies/);
}

// Owner-approved editorial direction is DRAFT ONLY. A naming/access choice does
// not constitute permission to change rights gates, merge, publish or deploy.
{
  const decision = JSON.parse(fs.readFileSync(path.join(DRAFT_DIR, 'owner-editorial-direction.draft.json'), 'utf8'));
  assert.equal(decision.scope, 'DRAFT_EDITORIAL_DIRECTION_ONLY');
  assert.equal(decision.ownerDraftDirectionApproved, true);
  assert.equal(decision.editorial.weeklyWorkingTitle, 'USD Impact Macro Weekly Review');
  assert.equal(decision.editorial.fourWeeklyWorkingTitle, 'USD Impact Four-Week Macro Review');
  assert.equal(decision.editorial.language, 'en');
  assert.equal(decision.editorial.intendedFutureAccess, 'free_public_educational');
  assert.equal(decision.reportingAsOf.independentPublishedWeeklyCount, 0);
  assert.equal(decision.reportingAsOf.independentMonthlyEligible, false);
  assert.equal(decision.executableActivation, false);
  assert.equal(decision.productionRuntimeUsesThisFile, false);
  assert.ok(weekly.editorial.title.startsWith(decision.editorial.weeklyWorkingTitle));
  assert.ok(monthly.editorial.title.startsWith(decision.editorial.fourWeeklyWorkingTitle));
  const approvedDraftKeys = new Set([
    'draftNaming', 'draftLanguage', 'draftFreePublicDirection',
    'draftPublishedDailySourceDirection', 'draftFourWeeklyMonthlyRule'
  ]);
  assert.equal(Object.keys(decision.authorizations).length, 16);
  for (const [key, enabled] of Object.entries(decision.authorizations)) {
    assert.equal(enabled, approvedDraftKeys.has(key), 'unexpected authorization: ' + key);
  }
  assert.ok(Object.values(decision.existingHolds).every((value) => value === 'HOLD'));
  tests += 14 + Object.keys(decision.authorizations).length;
}

// Record exactly why the current, user-approved editorial draft is still not
// allowed to publish. All observations are from existing local draft inputs.
{
  const decision = JSON.parse(fs.readFileSync(path.join(DRAFT_DIR, 'owner-editorial-direction.draft.json'), 'utf8'));
  const readiness = inspectIndependentEditorialDraftHolds(weekly, monthly, decision);
  assert.equal(readiness.disposition, 'HOLD_DRAFT_ONLY');
  assert.equal(readiness.approvedDraftDirection, true);
  assert.equal(readiness.officialOutcomeClaims, 4);
  assert.deepEqual(readiness.missingOfficialOutcomeReleaseAtIds,
    ['fomc-outcome-oct28', 'gdp-oct29', 'pce-oct29']);
  assert.deepEqual(readiness.unresolvedSourceRightsClaimIds, weekly.claims.map((claim) => claim.id));
  assert.equal(readiness.independentPublishedWeeklies, 0);
  assert.equal(readiness.independentWeekliesRequiredForMonthly, 4);
  assert.equal(readiness.openExternalReleaseApprovals.length, 11);
  assert.equal(readiness.publicationReady, false);
  assert.equal(readiness.releaseAuthorized, false);
  const validated = runOfflineDraftValidation();
  assert.deepEqual(validated.readiness, readiness);
  tests += 11;
  rejects(() => inspectIndependentEditorialDraftHolds(weekly, monthly,
    { ...decision, authorizations: { ...decision.authorizations, publicPublication: true } }),
    /unauthorized decision flag/);
  const tampered = clone(weekly);
  tampered.claims[0].rightsStatus = 'cleared';
  rejects(() => inspectIndependentEditorialDraftHolds(tampered, monthly, decision),
    /cannot silently clear/);
  const imaginaryMonth = clone(monthly);
  imaginaryMonth.sourceWeeklyReports.push({});
  rejects(() => inspectIndependentEditorialDraftHolds(weekly, imaginaryMonth, decision),
    /cannot count imaginary/);
}

// Five *exact* primary-source URLs used in six source-pinned Daily claims.
// This worksheet is reviewer preparation and cannot authorize reuse.
{
  const worksheet = JSON.parse(fs.readFileSync(
    path.join(DRAFT_DIR, 'pilot-exact-source-rights-worksheet.draft.json'), 'utf8'));
  assert.equal(worksheet.schemaVersion, 'independent-weekly-exact-source-worksheet-draft-v1');
  assert.equal(worksheet.status, 'HOLD_PENDING_QUALIFIED_EXACT_ITEM_REVIEW');
  assert.equal(worksheet.sourceItemCount, 5);
  assert.equal(worksheet.claimCount, 6);
  assert.equal(worksheet.sourceRetrievalPerformed, false);
  assert.equal(worksheet.permittedByThisRecord, false);
  assert.equal(worksheet.releaseAuthorized, false);
  const bySource = new Map(worksheet.sourceItems.map((source) => [source.sourceId, source]));
  assert.equal(bySource.size, 5, 'source IDs must be unique');
  const byDate = new Map(weekly.sourceEditions.map((daily) => [daily.date, daily.gitBlobSha]));
  for (const claim of weekly.claims) {
    const source = bySource.get(claim.sourceId);
    assert.ok(source, 'exact source worksheet item required: ' + claim.sourceId);
    assert.equal(source.exactSourceUrl, claim.sourceUrl, 'pinned URL must match original Daily claim');
    assert.ok(source.sourceClaims.includes(claim.id), 'claim must be explicitly mapped');
    assert.ok(source.sourceDailyEvidence.some(
      (daily) => daily.date === claim.sourceEditionDate &&
        daily.gitBlobSha === byDate.get(claim.sourceEditionDate)
    ), 'source evidence must match already published pinned Daily blob');
  }
  for (const source of worksheet.sourceItems) {
    assert.equal(source.currentDisposition, 'EXACT_ITEM_REUSE_REVIEW_PENDING');
    assert.equal(source.reviewerName, null);
    assert.equal(source.reviewedAtUtc, null);
    assert.equal(source.decisionAuthority, null);
    assert.equal(source.scopedReceiptUrl, null);
    assert.equal(source.authorizationForPublication, false);
    assert.equal(Object.keys(source.rightsChecks).length, 9);
    assert.ok(Object.values(source.rightsChecks).every((value) => value === false));
    assert.deepEqual(source.sourceClaims.slice().sort(),
      weekly.claims.filter((claim) => claim.sourceId === source.sourceId)
        .map((claim) => claim.id).sort(), 'worksheet claims must exactly match real pilot claims');
  }
  tests += 16;
}
// Offline release schedule evidence: a scheduled event is NOT a verified exact
// issuer publication timestamp. No network access or source permission is inferred.
{
  const evidence = JSON.parse(fs.readFileSync(path.join(DRAFT_DIR,
    'pilot-release-timing-evidence.draft.json'), 'utf8'));
  assert.equal(evidence.schemaVersion, 'independent-weekly-release-timing-evidence-v0-draft');
  assert.equal(evidence.status, 'EVIDENCE_ONLY_ISSUE_TIMES_AND_EDITORIAL_CHRONOLOGY_RECORDED_ACTUAL_ISSUER_POSTING_UNVERIFIED');
  assert.match(evidence.evidenceSemantics.exactIssuerActualPublicationAtUtc, /Only populate with directly authenticated/);
  assert.equal(evidence.sourceRetrievalPerformed, false);
  assert.equal(evidence.rightsGranted, false);
  assert.equal(evidence.publicationAuthorized, false);
  assert.equal(evidence.legacyScoreSourceUsed, false);
  const officialClaims = weekly.claims.filter((claim) => claim.claimCategory === 'official_outcome');
  assert.equal(officialClaims.length, 4);
  assert.equal(evidence.events.length, officialClaims.length);
  const byId = new Map(officialClaims.map((claim) => [claim.id, claim]));
  assert.equal(new Set(evidence.events.map((event) => event.claimId)).size, evidence.events.length);
  const beaSchedule = JSON.parse(fs.readFileSync(path.resolve(
    DRAFT_DIR, '../daily-major-release-calendars/2026-10-29.json'), 'utf8'));
  const scheduled = new Map(beaSchedule.events.map((event) => [event.id, event]));
  const beaIds = {
    'gdp-oct29': 'BEA_GDP_Q3_ADVANCE',
    'pce-oct29': 'BEA_PCE_SEPTEMBER'
  };
  const daily = new Map(weekly.sourceEditions.map((edition) => [edition.date, edition.gitBlobSha]));
  for (const event of evidence.events) {
    const claim = byId.get(event.claimId);
    assert.ok(claim, 'unknown official outcome claim');
    assert.equal(event.sourceId, claim.sourceId);
    assert.equal(event.exactSourceUrl, claim.sourceUrl);
    assert.equal(event.sourceDailyGitBlobSha, daily.get(claim.sourceEditionDate));
    assert.match(event.scheduledReleaseAtUtc, /^2026-10-(28|29|30)T\d\d:\d\d:\d\dZ$/);
    assert.ok(Number.isFinite(Date.parse(event.scheduledReleaseAtUtc)));
    assert.notEqual(event.status, 'PUBLICATION_APPROVED');
    if (event.claimId === 'fomc-outcome-oct28') {
      assert.equal(event.scheduledReleaseAtUtc, '2026-10-28T18:00:00Z');
      const fed = fs.readFileSync(path.resolve(DRAFT_DIR,
        '../fomc-2026-10-28-outcome-framework.md'), 'utf8');
      assert.match(fed, /Statement release: 2:00 p\.m\. U\.S\. Eastern/);
      assert.ok(Date.parse(event.existingDailyGeneratedAtUtc) >
        Date.parse(event.scheduledReleaseAtUtc));
      assert.equal(event.postReleaseEditorialCandidate.sourcePr, 'https://github.com/usdimpact/usd-impact-site/pull/926');
      assert.equal(event.postReleaseEditorialCandidate.sourcePrExactHead, 'b0790a73324741bf3c1f1e5b9603670b68c2e48b');
      assert.equal(event.postReleaseEditorialCandidate.claimSpecificOwnerPassForIndependentReport, false);
      assert.equal(event.postReleaseEditorialCandidate.exactIssuerPostingTimeAuthenticated, false);
    }
    if (Object.hasOwn(beaIds, event.claimId)) {
      assert.equal(event.scheduledReleaseAtUtc,
        scheduled.get(beaIds[event.claimId]).releaseAtUtc);
      assert.ok(Date.parse(event.originalDailyCandidateGeneratedAtUtc) <
        Date.parse(event.scheduledReleaseAtUtc),
      'original automated BEA Daily was generated before releases');
      assert.ok(Date.parse(event.postReleaseEditorialCommentAtUtc) >
        Date.parse(event.scheduledReleaseAtUtc),
      'human post-release editorial review must be later than scheduled release');
      assert.equal(event.postReleaseEditorialReference,
        'https://github.com/usdimpact/usd-impact-site/pull/938#issuecomment-6510694719');
      assert.equal(event.postReleaseEditorialCandidate.sourcePrExactHead, '14bbc23422518eb8850e4591f0127ba50cf68d7d');
      assert.equal(event.postReleaseEditorialCandidate.commentCreatedAtUtc, '2026-10-29T23:11:35Z');
      assert.equal(event.postReleaseEditorialCandidate.independentWeeklyEditorialApproval, false);
      assert.equal(event.postReleaseEditorialCandidate.exactItemSourceRightsApproval, false);
      if (event.claimId === 'gdp-oct29') {
        assert.notEqual(event.exactSourceUrl, event.calendarOutcomeUrl,
          'distinct BEA GDP official URL spellings require human reconciliation');
      } else assert.equal(event.exactSourceUrl, event.calendarOutcomeUrl);
    }
    if (claim.sourceReleaseAt === null) {
      assert.equal(event.exactIssuerActualPublicationAtUtc, null,
        'scheduled issuer time must not be invented as actual publication time');
      assert.equal(event.verifiedPostReleaseClaimReceipt, null,
        'editing a receipt link must not bypass claim-level review');
    } else {
      assert.equal(event.recordedEditorialSourceReleaseAtUtc, claim.sourceReleaseAt,
        'BLS official issue time in existing approved Daily must remain pinned');
      assert.equal(event.exactIssuerActualPublicationAtUtc, null,
        'official issued time is not authenticated website posting timestamp');
      assert.equal(event.releaseTimeType, 'OFFICIAL_ISSUE_TIME_ALREADY_PINNED_IN_DAILY_NOT_INDEPENDENT_HTTP_POST_RECEIPT');
      assert.equal(event.verifiedPostReleaseClaimReceipt, claim.postReleaseEditorialReceipt);
      assert.ok(Date.parse(event.firstGeneratedAtUtc) <
        Date.parse(event.recordedEditorialSourceReleaseAtUtc));
    }
  }
  assert.deepEqual(evidence.events.filter((event) =>
    event.exactIssuerActualPublicationAtUtc === null).map((event) => event.claimId),
    ['fomc-outcome-oct28', 'gdp-oct29', 'pce-oct29', 'eci-oct30']);
  tests += 34;
}
// Agency notices are public-domain policy *context* only. The exact-source
// rights worksheet stays all-deny, and no publishing permission is inferred.
{
  const policy = JSON.parse(fs.readFileSync(
    path.join(DRAFT_DIR, 'official-source-reuse-policy-evidence.draft.json'), 'utf8'));
  const rights = JSON.parse(fs.readFileSync(
    path.join(DRAFT_DIR, 'pilot-exact-source-rights-worksheet.draft.json'), 'utf8'));
  assert.equal(policy.schemaVersion, 'independent-weekly-policy-evidence-v0-draft');
  assert.equal(policy.reviewedPoliciesOnly, true);
  assert.equal(policy.marketDataObservationEndpointsQueried, false);
  assert.equal(policy.exactItemRightsOrPermissionsReviewed, false);
  assert.equal(policy.rightsAuthorized, false);
  assert.equal(policy.publishingAuthorized, false);
  assert.equal(policy.publicationStatus, 'HOLD_DRAFT_ONLY');
  assert.equal(policy.internationalCaution.romanianEuLatamUseDecision, 'PENDING');
  const claimed = new Map(weekly.claims.map((claim) => [claim.id, claim]));
  const pinnedRights = new Map(rights.sourceItems.map((source) => [source.sourceId, source]));
  assert.equal(policy.sourceItems.length, pinnedRights.size);
  assert.equal(policy.sourceItems.length, 5);
  assert.equal(new Set(policy.sourceItems.map((item) => item.sourceId)).size, 5);
  for (const item of policy.sourceItems) {
    const source = pinnedRights.get(item.sourceId);
    assert.ok(source, 'policy source not found in rights worksheet');
    assert.equal(item.exactPinnedItemUrl, source.exactSourceUrl);
    assert.deepEqual([...item.claimIds].sort(), [...source.sourceClaims].sort());
    assert.equal(item.policyIndicatesGeneralAgencyTextMayBeReusable, true);
    assert.equal(item.exactItemCheckedForExceptions, false);
    assert.equal(item.publicSiteCommercialContextReviewed, false);
    assert.equal(item.crossBorderUseReviewed, false);
    assert.equal(item.translationOrStorageReviewed, false);
    assert.equal(item.scopeSpecificApproval, false);
    assert.equal(item.permissionToPublish, false);
    assert.equal(item.legalOrOwnerReceipt, null);
    assert.ok(Object.values(source.rightsChecks).every((granted) => granted === false));
    assert.match(item.policyEvidence.publicNoticeUrl, /^https:\/\//);
    for (const claimId of item.claimIds) {
      const claim = claimed.get(claimId);
      assert.ok(claim && claim.sourceId === item.sourceId,
        'policy may cite only claims in verified source-pinned Weekly');
    }
  }
  tests += 20;
}

// Cross-PR reconciliation is a frozen exact-link snapshot, NOT a schema merge,
// remote GitHub lookup, source licensing, nor a release pathway.
{
  const crosswalk = JSON.parse(fs.readFileSync(
    path.join(DRAFT_DIR, 'cross-pr-exact-source-rights-map.draft.json'), 'utf8'));
  const rights = JSON.parse(fs.readFileSync(
    path.join(DRAFT_DIR, 'pilot-exact-source-rights-worksheet.draft.json'), 'utf8'));
  assert.equal(crosswalk.schemaVersion, 'independent-editorial-cross-pr-rights-crosswalk-v0-draft');
  assert.match(crosswalk.referencePr1020Head, /^[a-f0-9]{40}$/);
  assert.match(crosswalk.referencePr1020LedgerBlobSha, /^[a-f0-9]{40}$/);
  assert.equal(crosswalk.referencePr1019RightsBlobSha, '615476aeca74e0e373b02d868c4c86575eb40bd6');
  assert.equal(crosswalk.finalContractSelected, false);
  assert.equal(crosswalk.publicationRightsApproved, false);
  assert.equal(crosswalk.codeOrSchemasMerged, false);
  assert.equal(crosswalk.runtimeDependencyOnOtherPr, false);
  assert.equal(crosswalk.publicationAuthorized, false);
  assert.equal(crosswalk.extraMarketDataLicenseBudgetUsd, 0);
  assert.equal(crosswalk.mappedItems.length, 5);
  assert.deepEqual(crosswalk.unmappedPr1020InventorySources.map((source) => source.id).sort(),
    ['bls_october_schedule', 'eia_optional_future']);
  const sources = new Map(rights.sourceItems.map((source) => [source.sourceId, source]));
  const seen = new Set();
  for (const item of crosswalk.mappedItems) {
    assert.ok(!seen.has(item.pilotSourceId), 'duplicate pilot source');
    seen.add(item.pilotSourceId);
    const source = sources.get(item.pilotSourceId);
    assert.ok(source, 'cross-PR record must reference an exact pinned pilot item');
    assert.equal(item.exactSourceUrl, source.exactSourceUrl);
    assert.deepEqual([...item.pilotClaimIds].sort(), [...source.sourceClaims].sort());
    assert.equal(item.sourceUrlExactMatch, true);
    assert.equal(item.pr1019NineRightsChecksAllFalse, true);
    assert.equal(item.pr1020SevenPermissionsAllFalse, true);
    assert.equal(item.rightsReceipt, null);
    assert.equal(item.canRelease, false);
  }
  assert.equal(seen.size, 5);
  tests += 19;
}

console.log('Independent editorial offline draft contract: ' + tests + ' assertions passed (never release-ready).');
