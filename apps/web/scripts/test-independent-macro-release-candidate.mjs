import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const root = new URL('../../../docs/operations/independent-editorial/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('release-candidate-2026-10-30.manifest.draft.json', root), 'utf8'));
const stageA = readFileSync(new URL('stage-a-preview/macro-reviews/weekly/2026-10-30/index.html', root), 'utf8');
const owner = JSON.parse(readFileSync(new URL('stage-a-editorial-layout-owner-pass.draft.json', root), 'utf8'));
const weekly = JSON.parse(readFileSync(new URL('weekly-2026-10-30.draft.json', root), 'utf8'));
const originalRights = JSON.parse(readFileSync(new URL('pilot-exact-source-rights-worksheet.draft.json', root), 'utf8'));
const scopedRights = JSON.parse(readFileSync(new URL('stage-b-narrow-source-use-review.draft.json', root), 'utf8'));
const candidatePath = new URL('../src/data/independent-macro-review/weekly-2026-10-30.release-candidate.html', import.meta.url);
const candidate = readFileSync(candidatePath, 'utf8');
const route = readFileSync(new URL('../src/pages/macro-reviews/weekly/[date].astro', import.meta.url), 'utf8');

let checks = 0;
const eq = (actual, expected, why) => { assert.deepEqual(actual, expected, why); checks++; };
const ok = (value, why) => { assert.ok(value, why); checks++; };
const gitBlobSha = (source) => {
  const bytes = Buffer.from(source, 'utf8');
  return createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0'))
    .update(bytes).digest('hex');
};

eq(manifest.schemaVersion, 'independent-macro-weekly-public-release-candidate-v0-draft', 'candidate version');
eq(manifest.status, 'DRAFT_CANDIDATE_NOT_PUBLISHED', 'unpublished only');
eq(manifest.releaseSeries, 'independent_macro_education', 'no Score report family');
eq(manifest.targetPublicPathCandidate, '/macro-reviews/weekly/2026-10-30/', 'separate future path');
eq(manifest.actualFirstPublicationAtUtc, null, 'never backdate a publication');
eq(manifest.publicArticleExists, false, 'not a public edition');
eq(manifest.publicIndexing, false, 'no index permission');
eq(manifest.robotsNoindex, true, 'draft noindex policy');
eq(manifest.routePrerenderIsHardDisabled, true, 'no emitted routes until new authority');
eq(manifest.compiledPagesExpected, 0, 'no generated public edition');
eq(manifest.releaseAuthorized, false, 'release forbidden');
eq(manifest.publishReady, false, 'no issuer rights signoff');
eq(manifest.editorialProvenance.stageAExactReviewedHtmlGitBlobSha,
  gitBlobSha(stageA), 'original Stage A PASS source unchanged');
eq(owner.exactReviewedSource.htmlGitBlobSha,
  gitBlobSha(stageA), 'exact Stage A human-reviewed content');
eq(manifest.editorialProvenance.stageAApprovedGitCommitSha,
  owner.exactReviewedSource.reviewedGitCommitSha, 'approved Stage A Git revision');
eq(manifest.editorialProvenance.publicCandidateExactVersionEditorialApproved,
  true, 'owner exact-version approval for new candidate must be recorded');
ok(manifest.editorialProvenance.olderStageAPassNotTransferable,
  'cannot transfer owner PASS to modified HTML');
eq(manifest.contentGitBlobSha, gitBlobSha(candidate), 'content changes require new manifest and review');
eq(manifest.editorialProvenance.sourceWeeklyContractVersion, weekly.contractVersion,
  'independent source contract unchanged');
eq(manifest.editorialProvenance.sourceWeeklyGitBlobSha,
  '11056d67139f48ed86cebf6522149ac6e79d987e', 'source-snapshot blob pinned');
eq(manifest.editorialProvenance.sourceClaimIds, weekly.claims.map((c) => c.id),
  'all source claims pinned without additions');
eq(manifest.editorialProvenance.sourceDailies,
  weekly.sourceEditions.map((s) => ({ date:s.date, exactPublishedDailyGitBlobSha:s.gitBlobSha })),
  'five published Daily versions must match source-pinned draft');
eq(manifest.editorialProvenance.issuerDeclaredReleaseTimePlusLaterEditorialReview,
  'APPROVED_FOR_DRAFT_METHOD_PROPOSAL_ONLY', 'methodology not future release authorized');
eq(manifest.editorialProvenance.laterExactClaimReviewReceiptsVerifiedForAllClaims, false,
  'no fake item-review completion');
eq(manifest.editorialProvenance.actualIssuerFirstWebPostingClaimed, false,
  'do not invent HTTP posting times');
eq(manifest.sourceUse.stageBNarrowScopeGitBlobSha, gitBlobSha(
  readFileSync(new URL('stage-b-narrow-source-use-review.draft.json', root), 'utf8')),
  'rights scope must be bound to specific original review version');
eq(manifest.sourceUse.exactSourceRightsGrants, 0, 'no source grant');
ok(manifest.sourceUse.originalProseAndOfficialFactsOnly &&
  manifest.sourceUse.directIssuerLinksAndAttributionOnly &&
  !manifest.sourceUse.copiedAgencySourceTextImagesOrTablesAllowed &&
  !manifest.sourceUse.vendorMarketDataOrOriginalScoreAllowed,
  'no licensed or expressive copying');
ok(!manifest.sourceUse.mediaOutsideOnePublicEnglishWebpageAllowed &&
  !manifest.sourceUse.RomaniaEuInternationalDistributionReviewed &&
  manifest.sourceUse.foreignLawQuestionStillPending,
  'narrow rights and foreign treatment not silently cleared');
ok(!manifest.sourceUse.qualifiedPerItemRightsReviewComplete &&
  !manifest.sourceUse.ownerFinalRightsAcceptance,
  'a candidate cannot grant its own rights');
eq(manifest.sourceUse.sourceItems.length, 5, 'exactly five reviewed official sources');
const scoped = new Map(scopedRights.sourceItems.map((source) => [source.sourceId, source]));
const allDeny = new Map(originalRights.sourceItems.map((source) => [source.sourceId, source]));
for (const source of manifest.sourceUse.sourceItems) {
  const expected = scoped.get(source.sourceId);
  ok(expected !== undefined && allDeny.has(source.sourceId),
    'no unreviewed source ' + source.sourceId);
  eq(source.url, expected.exactOfficialSourceUrl, 'exact official URL unchanged');
  eq(source.rightsApproval, false, 'never grant source use by writing candidate');
  ok(candidate.includes('href="' + source.url + '"'), 'candidate has source citation ' + source.sourceId);
  ok(Object.values(allDeny.get(source.sourceId).rightsChecks).every((v) => v === false),
    'all-deny rights worksheet must remain false');
}
eq(manifest.sourceUse.sourceItems.length, scoped.size, 'no missing/extra sources');
eq(manifest.existingIndependentPublishedWeeklyCount, 0, 'private candidate is not a Weekly');
eq(manifest.requiredWeekliesBeforeFirstIndependentMonthly, 4, 'first Monthly requires four real Weeks');
for (const [gate, value] of Object.entries(manifest.publisherGovernance)) {
  eq(value, ['finalIndependentExactContentPass', 'publisherNarrowFactsAndLinksUseScopeAccepted'].includes(gate),
    'only exact editorial PASS and narrow-use publisher acceptance may be true: ' + gate);
}
ok(Object.values(manifest.technicalSafety).every((v) => v === true),
  'all specified technical safety invariants true');
ok(manifest.externalGoLiveRequirements.length >= 6, 'release requirements are explicit');

const sections = ['summary','timeline','transmission','mistakes','watch','sources'];
for (const name of sections) {
  const pattern = new RegExp('<section aria-labelledby="' + name +
    '">[\\s\\S]*?<\\/section>');
  const oldBlock = stageA.match(pattern)?.[0], nextBlock = candidate.match(pattern)?.[0];
  ok(Boolean(oldBlock), 'original source block exists: ' + name);
  eq(nextBlock, oldBlock, 'previously approved substantive content is unchanged: ' + name);
}
ok(candidate.startsWith('<!doctype html>'), 'candidate remains full static HTML');
ok(candidate.includes('<html lang="en">'), 'English document');
ok(candidate.includes('name="robots" content="noindex,nofollow,noarchive,nosnippet"'),
  'noindex meta must remain until final go-live');
ok(candidate.includes('name="googlebot" content="noindex,nofollow,noarchive,nosnippet"'),
  'Google noindex must remain');
ok(candidate.includes('data-release-authorized="false"'), 'content explicitly not authorized');
ok(candidate.includes('data-release-candidate="draft"'), 'visible machine-readable Draft status');
ok(/Not published|NOT PUBLISHED|unpublished/i.test(candidate), 'visibly unpublished');
ok(candidate.includes('KELA LEADS S.R.L.'), 'correct operator attribution');
ok(candidate.includes('No original eight-driver Score'), 'legacy Score is not imported');
ok(!/<script\b/i.test(candidate), 'no script, analytics or remote data loader');
ok(!/<iframe\b/i.test(candidate) && !/<img\b/i.test(candidate) &&
  !/<form\b/i.test(candidate), 'no external widgets, official seals or user inputs');
ok(!/google-analytics|googletagmanager|hotjar|mixpanel|segment\.com/i.test(candidate),
  'no tracking or vendor telemetry');

const allowedHrefs = new Set([...manifest.sourceUse.sourceItems.map(s => s.url),
  ...weekly.sourceEditions.map(d => 'https://www.usd-impact.com/news/' + d.date + '/'), '#main']);
const hrefs = [...candidate.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(x => x[1]);
ok(hrefs.length >= 12 && hrefs.every(url => allowedHrefs.has(url)),
  'only the approved issuer or already public Daily links');
ok(!candidate.includes('datePublished') && !candidate.includes('article:published_time'),
  'no claimed publication date');

ok(route.includes("../../../data/independent-macro-review/weekly-2026-10-30.release-candidate.html?raw"),
  'proposed Astro route reads only review candidate HTML');
ok(/export const prerender\s*=\s*true;/.test(route), 'static build only');
ok(/export function getStaticPaths\(\)\s*\{\s*return \[\];\s*\}/.test(route),
  'EMPTY getStaticPaths; zero public pages may be generated');
ok(!/\bimport .*Score|import .*weeklyReports|import .*purchase/i.test(route),
  'no original Score, report or checkout loader');
ok(!/import\.meta\.env|process\.env|PUBLIC_/.test(route),
  'environment variables cannot activate an unapproved page');

// Four official outcomes have a later Daily correction, but no previous Daily
// approval is allowed to masquerade as a new independent Weekly editorial PASS.
{
  const rawEvidence = readFileSync(new URL('release-candidate-2026-10-30.claim-evidence.draft.json', root), 'utf8');
  const evidence = JSON.parse(rawEvidence);
  eq(evidence.schemaVersion, 'independent-macro-weekly-exact-claim-review-evidence-v0-draft',
    'source-evidence ledger version');
  eq(manifest.editorialProvenance.claimEvidenceGitBlobSha, gitBlobSha(rawEvidence),
    'exact immutable claim-evidence ledger');
  eq(evidence.candidateHtmlGitBlobSha, manifest.contentGitBlobSha,
    'claim-evidence tied to exact release-candidate HTML');
  eq(evidence.sourceWeeklyGitBlobSha, manifest.editorialProvenance.sourceWeeklyGitBlobSha,
    'claim-evidence tied to exact pinned source Weekly');
  eq(evidence.claims.length, 6, 'two calendar reminders plus four official outcomes');
  eq(evidence.claims.map(c => c.claimId), weekly.claims.map(c => c.id),
    'same six Daily claim IDs and order');
  eq(evidence.verifiedOfficialOutcomeCount, 4,
    'four official outcome claim entries, no invented fifth outcome');
  eq(evidence.independentCandidateExactClaimPassCount, 0,
    'no claim-level Weekly PASS was granted');
  eq(manifest.editorialProvenance.independentWeeklyClaimOwnerPassCount, 0,
    'candidate approval count must remain zero');
  ok(!manifest.publisherGovernance.claimLevelExplicitIndependentEditorialApproval,
    'claim editor has not separately approved this Weekly');
  ok(manifest.editorialProvenance.finalCandidateEditorialPassStillRequired === false,
    'exact candidate editorial PASS now recorded; legal/provenance hold separate');
  ok(evidence.issuerStatedIssueTimeAcceptedForDraftMethodOnly,
    'issuer times are supported in the draft method only');
  ok(!evidence.issuerActualHttpPostingProven,
    'no first website posting timestamp verified');
  ok(!evidence.finalWeeklyExactVersionEditorialApproved &&
    !evidence.qualifiedRightsReviewApproved && !evidence.publicReleaseAuthorized,
    'rights, editorial and public release all HOLD');
  eq(Object.keys(evidence.dailyBlobs).length, weekly.sourceEditions.length,
    'five original published Dailies in evidence inventory');
  for (const day of weekly.sourceEditions) {
    eq(evidence.dailyBlobs[day.date], day.gitBlobSha,
      'no old Daily source rewrite for ' + day.date);
  }
  const approvedSource = new Map(manifest.sourceUse.sourceItems.map(item => [item.sourceId, item]));
  const officialOutcomeIds = new Set(['fomc-outcome-oct28', 'gdp-oct29', 'pce-oct29', 'eci-oct30']);
  for (const c of evidence.claims) {
    const pinned = weekly.claims.find(x => x.id === c.claimId);
    ok(pinned !== undefined, 'claim exists in original source Weekly: '+c.claimId);
    eq(c.sourceId, pinned.sourceId, 'same source ID for '+c.claimId);
    eq(c.exactOfficialSourceUrl, pinned.sourceUrl,
      'same issuer URL for '+c.claimId);
    eq(c.exactSourceDailyGitBlobSha, evidence.dailyBlobs[c.sourceDailyDate],
      'same immutable published Daily for '+c.claimId);
    ok(candidate.includes('href="' + c.exactOfficialSourceUrl + '"'),
      'candidate retains exact linked issuer for '+c.claimId);
    ok(approvedSource.has(c.sourceId),
      'candidate manifest source ID exists for '+c.claimId);
    eq(c.independentCandidateExactClaimApproved, false,
      'original Daily approval is NOT independent Weekly PASS for '+c.claimId);
    eq(c.sourceReuseRightsApproved, false,
      'facts and links are not a signed public source grant for '+c.claimId);
    eq(c.actualFirstHttpPostingAtUtc, null,
      'issuer-stated issue time must not become a first HTTP posting time');
    if (officialOutcomeIds.has(c.claimId)) {
      eq(c.kind, 'official_outcome', 'official result claim '+c.claimId);
      ok(Number.isFinite(Date.parse(c.issuerStatedIssueAtUtc)),
        'dated issuer-stated official release for '+c.claimId);
      ok(c.dailyPostReleaseEvidence?.postReleaseObserved === true,
        'real later Daily correction exists for '+c.claimId);
      ok(Date.parse(c.dailyPostReleaseEvidence.correctedCommitAtUtc) >
        Date.parse(c.issuerStatedIssueAtUtc),
        'Daily correction must follow agency issue for '+c.claimId);
      ok(/^[0-9a-f]{40}$/.test(c.dailyPostReleaseEvidence.correctedHeadSha),
        'exact corrected Daily commit for '+c.claimId);
      eq(c.dailyPostReleaseEvidence.dailyExactVersionOwnerPass, c.claimId === 'eci-oct30',
        'only BLS Daily has prior exact owner PASS');
    } else {
      eq(c.kind, 'calendar_preview', 'scheduled meeting only');
      eq(c.issuerStatedIssueAtUtc, null, 'calendar is not an outcome');
      eq(c.dailyPostReleaseEvidence, null, 'no fabricated correction receipt');
    }
  }
}


// The owner explicitly accepted THIS precise HTML and narrow original-facts
// publisher use. This is not a general agency license, a qualified cross-border
// legal signoff, or an invitation to enable public output.
{
  const ownerRecordText = readFileSync(
    new URL('release-candidate-2026-10-30.owner-editorial-and-narrow-use-pass.draft.json', root), 'utf8');
  const approval = JSON.parse(ownerRecordText);
  eq(approval.schemaVersion, 'independent-macro-weekly-owner-editorial-and-narrow-use-pass-v1',
    'owner review record schema');
  eq(approval.decisionSource,
    'user_explicit_approval_following_specific_dual_review_question',
    'owner PASS comes from explicit two-part request');
  eq(approval.exactReviewTimestampUtc, null, 'do not fabricate a review timestamp');
  eq(approval.reviewedArtifact.draftPrNumber, 1024, 'correct stacked candidate PR');
  eq(approval.reviewedArtifact.reviewedPrHeadAtDecision,
    'd4d55c7ae721c21ab464f5429b679b9020ea9e16',
    'exact source head approved before governance-only edits');
  eq(approval.reviewedArtifact.htmlGitBlobSha, gitBlobSha(candidate),
    'approved HTML exact blob still matches the current candidate');
  eq(approval.reviewedArtifact.htmlGitBlobSha,
    manifest.editorialProvenance.ownerReviewedExactContentGitBlobSha,
    'owner PASS is bound to candidate manifest');
  eq(manifest.editorialProvenance.ownerReviewReceiptGitBlobSha,
    gitBlobSha(ownerRecordText), 'immutable owner review receipt is pinned');
  eq(manifest.editorialProvenance.ownerReviewReceiptFile,
    'docs/operations/independent-editorial/release-candidate-2026-10-30.owner-editorial-and-narrow-use-pass.draft.json',
    'owner receipt provenance path pinned');
  eq(approval.reviewedArtifact.exactClaimIds, weekly.claims.map(c => c.id),
    'the approved article contains the six claim IDs from the same weekly');
  eq(approval.reviewedArtifact.sourceItemIds, manifest.sourceUse.sourceItems.map(x => x.sourceId),
    'five issuer sources match the exact candidate');
  eq(approval.approvals.exactCandidateEditorialContentAndPresentationPass, true,
    'owner exact candidate editorial content PASS');
  eq(approval.approvals.publisherAcceptsNarrowOriginalProseOfficialFactsDirectLinksScope, true,
    'owner accepts limited facts and direct links use');
  eq(approval.approvals.publisherAcknowledgesDocumentedRomaniaEuInternationalRightsExceptions, true,
    'owner reviewed international scope caveats');
  eq(approval.approvals.issuerDeclaredIssueTimePlusAuthenticatedLaterReviewDraftMethodology, true,
    'issuer time methodology accepted only for Draft');
  eq(manifest.publisherGovernance.finalIndependentExactContentPass, true,
    'owner candidate editorial approval reflected in manifest');
  eq(manifest.publisherGovernance.publisherNarrowFactsAndLinksUseScopeAccepted, true,
    'narrow owner publisher acceptance reflected in manifest');
  eq(manifest.sourceUse.publisherAcceptedNarrowFactsAndOfficialLinksOnly, true,
    'candidate source use is constrained to facts and hyperlinks');
  eq(manifest.sourceUse.publisherAcknowledgedInternationalCopyrightExceptions, true,
    'foreign-law caveats acknowledged');
  eq(manifest.sourceUse.publisherAcceptedUseIsNotExternalAgencyLicense, true,
    'owner does not claim agency rights license');
  eq(manifest.sourceUse.ownerFinalRightsAcceptance, false,
    'qualified final rights and production use still pending');
  eq(manifest.sourceUse.qualifiedPerItemRightsReviewComplete, false,
    'no qualified agency/third-party exception check invented');
  eq(manifest.sourceUse.RomaniaEuInternationalDistributionReviewed, false,
    'no qualified international legal opinion inferred from owner risk acceptance');
  eq(manifest.editorialProvenance.independentWeeklyClaimOwnerPassCount, 0,
    'whole-article approval must not masquerade as historical source claim receipts');
  eq(manifest.editorialProvenance.laterExactClaimReviewReceiptsVerifiedForAllClaims, false,
    'separate dated claim-specific evidence still requires completion');
  eq(manifest.editorialProvenance.olderStageAPassNotTransferable, true,
    'owner provided a new exact candidate approval, not transfer from old Stage A');
  eq(manifest.editorialProvenance.candidateEditorialPassCoversWholeArticleNotIndividualPriorDailyReceipts, true,
    'approval applies to candidate content, not fake earlier Daily approvals');
  const specificAllowedApprovals = new Set([
    'exactCandidateEditorialContentAndPresentationPass',
    'publisherAcceptsNarrowOriginalProseOfficialFactsDirectLinksScope',
    'publisherAcknowledgesDocumentedRomaniaEuInternationalRightsExceptions',
    'issuerDeclaredIssueTimePlusAuthenticatedLaterReviewDraftMethodology'
  ]);
  for (const [name, value] of Object.entries(approval.approvals)) {
    eq(value, specificAllowedApprovals.has(name),
      'no broader source license, Production, indexing or merge permission: ' + name);
  }
  const validUse = new Set([
    'originalWrittenExplanations', 'directLinksAndPlainTextIssuerCredit', 'noAgencyEndorsement'
  ]);
  for (const [name, value] of Object.entries(approval.actualUseScope)) {
    if (typeof value === 'boolean') {
      eq(value, validUse.has(name), 'no expanded image, email, translation or data rights: ' + name);
    }
  }
  for (const [name, value] of Object.entries(approval.unresolvedRightsRemainHold)) {
    eq(value, name === 'allOriginalProjectAllDenySourceMatricesRemainUnmodified' ||
      name === 'oneEnglishWebpageScopeDoesNotApproveOtherMedia' ||
      name === 'noClaimThatUSFederalPublicDomainAppliesGlobally',
    'uncleared source and international rights must stay visible: ' + name);
  }
  ok(approval.postReviewPolicy.htmlGitBlobImmutableUntilNewEditorialPass &&
     approval.postReviewPolicy.noEnablingOfAstroStaticPaths &&
     approval.postReviewPolicy.publicSiteProductionStillHold,
     'no deployment from publisher scope acceptance');
  eq(approval.postReviewPolicy.firstIndependentMonthlyEligiblePublishedWeeks, 0,
     'no Monthly publication history is invented');
  eq(approval.releaseAuthorized, false, 'explicit no-publication owner instruction');
  eq(approval.publishReady, false, 'scope pass is not overall release readiness');
}


// The exact published October 28 Daily was further corrected after the first
// Fed post-release PR (#926). The later merged PR #928 matches the pinned blob.
// Never silently equate the earlier intermediate blob with the final edition.
{
  const auditText = readFileSync(
    new URL('release-candidate-2026-10-30.final-daily-revision-audit.draft.json', root), 'utf8');
  const audit = JSON.parse(auditText);
  eq(audit.schemaVersion, 'independent-macro-weekly-source-daily-exact-version-reconciliation-v1-draft',
    'final Daily version audit schema');
  eq(manifest.editorialProvenance.finalDailySourceReconciliationGitBlobSha,
    gitBlobSha(auditText), 'final Daily audit Git blob pinned');
  eq(audit.sourcePinnedWeeklyGitBlobSha,
    manifest.editorialProvenance.sourceWeeklyGitBlobSha,
    'same independent Weekly source snapshot');
  eq(audit.verifiedProtectedMainCommit,
    'eb832fac7203a6a0f2ff29c0320616114e39224f',
    'read-only protected main provenance checkpoint');
  eq(audit.result, 'FIVE_OF_FIVE_PUBLISHED_DAILY_BLOBS_EXACT_MATCH',
    'all five published Daily versions verified');
  eq(audit.pinnedFinalDailyBlobsVerified, 5, 'five actual published Dailies');
  eq(audit.items.length, 5, 'one exact content reconciliation per source date');
  ok(audit.allFiveDailiesPublished && audit.fourPostReleaseOfficialOutcomesRepresented &&
    audit.allThreeAffectedOutcomeDailyCorrectionsHappenedAfterIssuerDeclaredTime,
    'final posted and post-release correction chain checked');
  ok(manifest.editorialProvenance.allFiveFinalPublishedDailyBlobsVerified,
    'five published final source editions matched');
  ok(manifest.editorialProvenance.fedPriorPr926IntermediateDailyWasSupersededByMergedPr928,
    'Fed intermediate revision must not be treated as final');
  ok(manifest.editorialProvenance.allFourOfficialOutcomeCorrectionsDocumentedAfterIssuerIssueTime,
    'four official outcome claims have dated later Daily revisions');
  ok(!audit.officialIssuerFirstHttpPostingTimesEstablished &&
     !audit.publicReleaseAuthorized &&
     audit.allIndependentOriginalSourceUsePermissionsStillHold,
    'source version reconciliation creates no external publication permission');
  for(const [index,day] of weekly.sourceEditions.entries()){
    const d = audit.items[index];
    eq(d.date, day.date, 'same original published Daily date');
    eq(d.exactPublishedDailyBlobSha, day.gitBlobSha,
      'exact pinned published Daily content hash must match');
    eq(d.publicationStatus, 'published', 'original Daily is published, not this Weekly');
    if(d.officialOutcomeTime){
      ok(Number.isFinite(Date.parse(d.officialOutcomeTime)),
        'official issuer stated time is typed UTC');
      ok(Number.isFinite(Date.parse(d.reviewedFinalRevisionCommitAt)) &&
        Date.parse(d.reviewedFinalRevisionCommitAt) > Date.parse(d.officialOutcomeTime),
        'final Daily revision follows issuer-stated official outcome');
      ok(/^[a-f0-9]{40}$/.test(d.reviewedFinalRevisionCommit),
        'final Daily revision anchored to exact Git commit');
    } else {
      eq(d.reviewedFinalRevisionCommit, null,
        'calendar preview cannot invent a later official-outcome correction');
    }
  }
  const fed = audit.items.find(x => x.date === '2026-10-28');
  const intermediate = fed.chronology.find(x => x.pr === 926);
  const final = fed.chronology.find(x => x.pr === 928 && x.matchesFinalPinnedDailyBlob);
  ok(intermediate && final, 'both real Fed correction revisions must be represented');
  eq(intermediate.dailyBlobAtCommit, 'e0dfe2159adfe1d4da79299773e7fb4125c31fee',
    'PR926 intermediate Fed Daily blob provenance');
  eq(intermediate.matchesFinalPinnedDailyBlob, false,
    'earlier PR926 was superseded and must never be equated to final source');
  eq(final.dailyBlobAtCommit, fed.exactPublishedDailyBlobSha,
    'later PR928 Daily has exact source-pinned final blob');
  eq(final.commit, '8eb805ad9ae43148d188f61a960aed69a70b528a',
    'actual later revision commit from merged PR928');
  ok(audit.publisherIndependentWeeklyExactArticleOwnerPassRecordedInSeparateReceipt &&
    audit.preExistingDailyPassDoesNotAutomaticallyBecomeIndependentWeeklyPass,
    'new owner editorial PASS is kept distinct from historical Daily evidence');
}

console.log('Independent Macro Weekly draft public-release candidate: ' +
  checks + ' assertions passed. Zero public paths; all rights and Production HOLD.');
