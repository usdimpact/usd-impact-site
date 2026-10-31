import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extractIndependentMacroWeeklyDraftFragment, DRAFT_ARTICLE_SECTION_IDS } from '../src/lib/independent-macro-weekly-draft-shell.mjs';

const from = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const gitBlob = (value) => {
  const bytes = Buffer.from(value, 'utf8');
  return createHash('sha1')
    .update(Buffer.from('blob ' + bytes.length + '\0', 'utf8'))
    .update(bytes).digest('hex');
};
const m = JSON.parse(from('../../../docs/operations/independent-macro-release/main-integration-hold.manifest.draft.json'));
const ownerText = from('../../../docs/operations/independent-macro-release/owner-scope-pass.snapshot.draft.json');
const owner = JSON.parse(ownerText);
const auditText = from('../../../docs/operations/independent-macro-release/final-daily-source-audit.snapshot.draft.json');
const audit = JSON.parse(auditText);
const html = from('../src/data/independent-macro-review/weekly-2026-10-30.release-candidate.html');
const route = from('../src/pages/macro-reviews/weekly/[date].astro');
const vercel = JSON.parse(from('../vercel.json'));
const layout = from('../src/layouts/BaseLayout.astro');
const privacy = from('../src/pages/privacy.md');
const consent = from('../src/components/ConsentClient.astro');
let checks = 0;
function eq(a,b,message){ assert.deepEqual(a,b,message); checks++; }
function ok(v,message){ assert.ok(v,message); checks++; }

eq(m.schemaVersion,'usd-impact-independent-macro-weekly-main-integration-hold-v1','correct main integration contract');
eq(m.state,'MAIN_BASED_DRAFT_SOURCE_ONLY_UNPUBLISHED','Draft only');
eq(m.sourceAndRepository.repository,'usdimpact/usd-impact-site','correct public site repository');
eq(m.sourceAndRepository.baseProtectedMainCommit,'eb832fac7203a6a0f2ff29c0320616114e39224f','base exact');
eq(m.sourceAndRepository.sourceCandidatePr,1024,'upstream reviewed Draft');
ok(m.sourceAndRepository.sourcePrsNotMerged && m.sourceAndRepository.copiedOnlyExplicitSmallSubset,'no wholesale incompatible branch merge');
eq(m.intendedEdition.series,'independent_macro_education','not Score');
eq(m.intendedEdition.coverageStart,'2026-10-26','coverage start');
eq(m.intendedEdition.coverageEnd,'2026-10-30','coverage end');
eq(m.intendedEdition.proposedPath,'/macro-reviews/weekly/2026-10-30/','separate proposed route');
eq(gitBlob(html),m.intendedEdition.candidateHtmlGitBlobSha,'exact owner-reviewed candidate HTML bytes');
eq(gitBlob(html),owner.reviewedArtifact.htmlGitBlobSha,'owner PASS not transferred to changed HTML');
eq(gitBlob(ownerText),m.ownerDecision.ownerReceiptGitBlobSha,'frozen owner scope receipt');
eq(gitBlob(auditText),m.sources.finalDailyAuditGitBlobSha,'frozen source audit');
eq(owner.approvals.exactCandidateEditorialContentAndPresentationPass,true,'exact candidate owner PASS');
eq(owner.approvals.publisherAcceptsNarrowOriginalProseOfficialFactsDirectLinksScope,true,'narrow publisher scope accepted');
eq(owner.approvals.qualifiedCrossBorderLegalOpinionCompleted,false,'no qualified international legal opinion invented');
eq(m.ownerDecision.qualifiedCrossBorderLegalClearance,false,'qualified rights clearance missing');
eq(m.ownerDecision.publicProductionApproval,false,'owner has not approved public Production');
eq(m.intendedEdition.actualFirstUsdImpactPublicationTimestampUtc,null,'no backdated first publication');
eq(m.intendedEdition.generatedPublicPageCount,0,'no publicly emitted edition');
eq(m.intendedEdition.published,false,'unpublished');
eq(m.intendedEdition.publicIndexing,false,'no indexing');
ok(m.intendedEdition.olderWeekliesAreOriginalScoreAndNeverMonthlyInputs,'no original Score Weeklies counted');
eq(m.actualPublishedIndependentWeeklyCount,0,'no independent Weeklies published');
eq(m.requiredGenuineConsecutiveFridayWeekliesForMonthly,4,'four genuine Weeklies to first Monthly');
eq(m.sources.officialSourceUrls.length,5,'five official source URLs only');
eq(m.sources.originalPublishedDailyFiles.length,5,'five published source Dailies only');
eq(m.sources.claimCount,6,'six pinned source claims');
eq(audit.pinnedFinalDailyBlobsVerified,5,'five final Daily blobs audited');
ok(audit.fedLaterMergedPr928ResolvesToFinalPinnedDailyBlob,'later Fed corrected Daily reconciled');
eq(m.sources.authorizingThirdPartyIssuerLicenseReceipts,0,'no agency permissions manufactured');
eq(m.releaseAuthorized,false,'no public release authority');
eq(m.publishReady,false,'not publicly publish-ready');
for(const [name,v] of Object.entries(m.holds))eq(v,false,'all remaining gates HOLD: '+name);
for(const [name,v] of Object.entries(m.technicalConstraints))eq(v,true,'technical fail-closed invariant: '+name);
for(const [name,v] of Object.entries(owner.approvals)) {
  const allowed=new Set(['exactCandidateEditorialContentAndPresentationPass','publisherAcceptsNarrowOriginalProseOfficialFactsDirectLinksScope','publisherAcknowledgesDocumentedRomaniaEuInternationalRightsExceptions','issuerDeclaredIssueTimePlusAuthenticatedLaterReviewDraftMethodology']);
  eq(v,allowed.has(name),'no greater implied permission from owner: '+name);
}
for (const [i,d] of m.sources.originalPublishedDailyFiles.entries()){
  eq(audit.items[i].date,d.date,'exact pinned Daily date');
  eq(audit.items[i].exactPublishedDailyBlobSha,d.blobSha,'final published Daily hash');
  eq(gitBlob(from('../src/content/news/'+d.date+'.md')),d.blobSha,'protected-main Daily unchanged: '+d.date);
  eq(audit.items[i].publicationStatus,'published','source Daily already published');
  ok(html.includes('href="https://www.usd-impact.com/news/'+d.date+'/"'),'published Daily cited: '+d.date);
}
for(const url of m.sources.officialSourceUrls)ok(html.includes('href="'+url+'"'),'exact issuer source hyperlink '+url);
const allowedLinks = new Set([...m.sources.officialSourceUrls,
  ...m.sources.originalPublishedDailyFiles.map(x=>'https://www.usd-impact.com/news/'+x.date+'/'),'#main']);
const hrefs=[...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(x=>x[1]);
ok(hrefs.length>=12 && hrefs.every(x=>allowedLinks.has(x)),'only approved direct issuer and published Daily links');
ok(html.startsWith('<!doctype html>') && html.includes('<html lang="en">'),'standalone English candidate');
ok(html.includes('name="robots" content="noindex,nofollow,noarchive,nosnippet"'),'candidate cannot index');
ok(html.includes('data-release-authorized="false"') && html.includes('data-release-candidate="draft"'),'unpublished visible machine state');
ok(!/<script\b|<iframe\b|<img\b|<form\b/i.test(html),'no remote analytics, forms, logos or copied figures');
ok(!/google-analytics|googletagmanager|pixel\.|mixpanel|hotjar/i.test(html),'no external tracking');
ok(!html.includes('datePublished') && !html.includes('article:published_time'),'no fabricated article publication timestamp');
ok(/export const prerender\s*=\s*true;/.test(route),'static route only');
ok(/export function getStaticPaths\(\)\s*\{\s*return \[\];\s*\}/.test(route),'zero generated paths unconditionally');
ok(!/import\.meta\.env|process\.env|PUBLIC_/.test(route),'no environment activation bypass');
ok(!/import .*Score|import .*weeklyReports|import .*purchase/i.test(route),'no original Score or commerce imports');
eq(vercel.git?.deploymentEnabled?.['agent/*'],false,'agent branch cannot automatically deploy on Vercel');
eq(gitBlob(from('../vercel.json')),m.existingSiteReuse.publicVercelConfigGitBlobSha,'production Vercel settings unchanged');
eq(gitBlob(layout),m.existingSiteReuse.baseLayoutGitBlobSha,'live layout unchanged');
eq(gitBlob(privacy),m.existingSiteReuse.privacyNoticeGitBlobSha,'live privacy notice unchanged');
eq(gitBlob(consent),m.existingSiteReuse.consentComponentGitBlobSha,'live consent component unchanged');
ok(layout.includes('<ConsentClient') && layout.includes('<GoogleAnalyticsClient') &&
    layout.includes('href="/privacy/"') && layout.includes('href="/compliance"'),
    'existing layout provides consent and legal links');
ok(privacy.includes('## Cookies, browser storage, and consent'),'privacy notice contains existing cookie policy');
ok(consent.includes('privacy-consent-reject') && consent.includes('privacy-consent-accept'),
    'existing consent has choices; no new consent behavior added');
eq(m.existingSiteReuse.releasePageUsesBaseLayoutNow,false,'standalone source has not been integrated with site shell');
ok(m.existingSiteReuse.futureLayoutSwitchRequiresFreshOwnerPresentationReview &&
   m.existingSiteReuse.privacyAndCookieComplianceNotCertified,
    'future site-shell use requires review; legal certification not invented');

// Read-only primary-source factual verification is neither rights nor publication authority.
{
  const src=from('../../../docs/operations/independent-macro-release/first-weekly-primary-claim-reconciliation-2026-10-31.draft.json');
  const review=JSON.parse(src);
  eq(gitBlob(src),m.sources.independentPrimaryClaimReviewGitBlobSha,
    'pin independent claim audit exact Git object');
  eq(m.sources.independentPrimaryClaimReviewPath,'docs/operations/independent-macro-release/first-weekly-primary-claim-reconciliation-2026-10-31.draft.json',
    'pin claim evidence location');
  eq(review.schemaVersion,'usd-impact-first-independent-macro-weekly-six-claim-official-source-review-v1-draft',
    'claim audit schema');
  eq(review.sourceArticleBlobSha,gitBlob(html),'claim audit pins immutable article');
  eq(review.officialSourceCount,m.sources.officialSourceUrls.length,'five official sources');
  eq(review.reviewedClaimCount,m.sources.claimCount,'six source/method claims');
  eq(review.reviewedEvents.map((x)=>x.id),[
    'fomc-preview-oct26','fomc-outcome-oct28','gdp-oct29','pce-oct29','eci-oct30'],
    'all five dated factual events reviewed');
  eq(review.reviewedEvents.map((x)=>x.sourceUrl),m.sources.officialSourceUrls,
    'only five existing official source URLs used');
  ok(review.reviewedEvents.every((x)=>
     html.includes('data-claim="'+x.id+'"') &&
     html.includes('href="'+x.sourceUrl+'"') &&
     x.factualCrossCheck==='PASS' && x.observedFacts.length>=2 &&
     x.externallyVerifiedMarketReaction===false),
     'all dated facts match frozen article without fabricated market-price evidence');
  const method=review.editorialMethodClaim;
  ok(method.methodologicalNotASixthGovernmentRelease &&
     !method.marketPriceSourceUsed && !method.originalEightDriverScoreUsed &&
     !method.realizedAssetReturnAsserted && !method.investmentRecommendationAsserted,
     'sixth claim is only the explicit educational / no-price-data boundary');
  ok(review.verificationScope.governmentSourceFactsIndependentlyReviewed &&
     !review.verificationScope.qualifiedRomaniaEuInternationalRightsClearance &&
     !review.verificationScope.qualifiedPrivacyCertification &&
     !review.verificationScope.mergeAuthorized &&
     !review.verificationScope.publicRouteAuthorized &&
     !review.verificationScope.productionDeployAuthorized &&
     !review.verificationScope.indexingAuthorized &&
     !m.sources.independentPrimaryClaimReviewIsLegalClearance &&
     !m.holds.fullIndependentClaimLevelSourceReviewApproved &&
     !review.verificationScope.independentPublishedWeeklyCount &&
     !review.verificationScope.eligibleMonthlyWeeklies,
     'research-grade claim validation cannot self-approve release/legal governance');
}


 // Exact owner selection activates ONLY temporary internal review; public release still denied.
 {
   const invText=from('../../../docs/operations/independent-macro-release/first-weekly-publication-status-inventory-2026-10-31.draft.json');
   const inv=JSON.parse(invText);
   const governanceText=from('../../../docs/operations/independent-macro-release/owner-operated-review-exception-proposal-2026-10-31.draft.md');
   const invManifest=m.futureReleaseStatusInventoryDraft;
   const proposal=m.optionalOwnerOperatedGovernanceAmendmentProposal;
   eq(gitBlob(invText),invManifest.gitBlobSha,
      'pin exact future publication-status inventory');
   eq(gitBlob(governanceText),proposal.gitBlobSha,
      'pin the proposed-only governance amendment');
   eq(inv.scannedCommit,'66feffa2edc01b1a505c7c081672257098050762',
      'inventory refers to exact frozen reviewed Draft');
   eq(inv.approvedArticleBlobSha,gitBlob(html),
      'inventory preserves original article source');
   eq(inv.ownerReviewedSharedLayoutComponentBlobSha,m.siteShellAdaptationDraft.componentGitBlobSha,
      'inventory records immutable owner-reviewed layout');
   eq(inv.adapterBlobSha,m.siteShellAdaptationDraft.adapterGitBlobSha,
      'inventory records immutable adapter');
   eq(inv.disabledRouteBlobSha,gitBlob(route),
      'inventory preserves disabled route');
   eq(inv.markerCount,invManifest.markerCount,
      'inventory marker count pinned');
   eq(inv.markers.length,14,
      'all identified publication-status hot spots inventoried');
   const inspected={
    'apps/web/src/data/independent-macro-review/weekly-2026-10-30.release-candidate.html':html,
    'apps/web/src/components/IndependentMacroWeeklyDraftShell.astro':from('../src/components/IndependentMacroWeeklyDraftShell.astro'),
    'apps/web/src/lib/independent-macro-weekly-draft-shell.mjs':from('../src/lib/independent-macro-weekly-draft-shell.mjs'),
    'apps/web/src/pages/macro-reviews/weekly/[date].astro':route,
   };
   for(const marker of inv.markers) {
     const input=inspected[marker.path];
     ok(typeof input==='string' && marker.id && marker.futureAction &&
       input.indexOf(marker.needle)>=0 &&
       input.indexOf(marker.needle,input.indexOf(marker.needle)+marker.needle.length)<0,
       'exact Draft publication-status marker remains pinned: '+marker.id);
   }
   ok(inv.originalArticleMustStayUnmodified &&
      inv.releaseAuthorized===false &&
      inv.publicationStatusCopyApproved===false &&
      inv.newPublicRouteActivationApproved===false &&
      inv.indexingAuthorized===false && !inv.originalScoreRightsGranted &&
      inv.firstActualPublicationTimeUtc===null,
      'publication-status inventory is non-executable and fail-closed');
   ok(!proposal.proposedOnly &&
      proposal.policyAmendedOrEffective &&
      proposal.separateExplicitOwnerPolicyDecisionReceived &&
      !proposal.externalLegalObligationsWaived &&
      !proposal.qualifiedLegalAndPrivacyClearanceObtained &&
      !proposal.releaseAuthorized &&
      !m.holds.qualifiedRomaniaEuInternationalDistributionApproved &&
      !m.holds.finalLegalAndCompliancePass,
      'proposed owner-led internal alternative cannot bypass original approval gates');
   ok(governanceText.includes('historical optional review proposal') &&
      governanceText.includes('original "not selected" status') &&
      governanceText.includes('**FALSE**') &&
      governanceText.includes('**DENIED**'),
      'original proposal preserved as historic evidence; owner selection is separate');
 }
 
 // The final-status copy is a proposed redline only; no executable release route.
{
  const statusCopyText=from('../../../docs/operations/independent-macro-release/first-weekly-conditional-publication-copy-2026-10-31.draft.json');
  const statusCopy=JSON.parse(statusCopyText);
  const decision=from('../../../docs/operations/independent-macro-release/first-weekly-owner-review-decision-record-2026-10-31.draft.md');
  const pinned=m.futureReleaseCopyAndOwnerDecisionDraft;
  eq(gitBlob(statusCopyText),pinned.statusCopyGitBlobSha,
     'exact proposal: future publication-status copy Git blob');
  eq(gitBlob(decision),pinned.ownerDecisionGitBlobSha,
     'exact owner-decision worksheet Git blob');
  eq(statusCopy.schemaVersion,'usd-impact-first-weekly-proposed-status-copy-v1-draft',
     'future publication-status redline remains non-executable');
  eq(statusCopy.unmodified===undefined,true,
     'no implicit execution code accepted in status data');
  eq(statusCopy.unchangedEvidence.articleGitBlobSha,gitBlob(html),
     'original article frozen for any future release');
  eq(statusCopy.unchangedEvidence.componentGitBlobSha,
     m.siteShellAdaptationDraft.componentGitBlobSha,
     'owner-reviewed shared-layout component preserved');
  eq(statusCopy.unchangedEvidence.adapterGitBlobSha,
     m.siteShellAdaptationDraft.adapterGitBlobSha,
     'Draft adapter not modified');
  eq(statusCopy.proposedStatusOnlySubstitutions.length,pinned.proposedSubstitutionCount,
     'all proposed visible Draft markers tracked');
  const originalSourceByPath={
    'apps/web/src/data/independent-macro-review/weekly-2026-10-30.release-candidate.html':html,
    'apps/web/src/components/IndependentMacroWeeklyDraftShell.astro':from('../src/components/IndependentMacroWeeklyDraftShell.astro'),
    'apps/web/src/lib/independent-macro-weekly-draft-shell.mjs':from('../src/lib/independent-macro-weekly-draft-shell.mjs')
  };
  ok(statusCopy.proposedStatusOnlySubstitutions.every(x=>{
    const input=originalSourceByPath[x.path];
    return typeof input==='string' && x.editorialApprovalNeeded === true &&
      x.old && x.proposed && x.old!==x.proposed &&
      input.indexOf(x.old)>=0 &&
      input.indexOf(x.old,input.indexOf(x.old)+x.old.length)<0;
  }), 'every proposed replacement tied to exactly one frozen source string');
  ok(statusCopy.otherChangesThatMustBeDecidedSeparately.standaloneOriginalSourceMustRemainImmutable &&
     statusCopy.otherChangesThatMustBeDecidedSeparately.noindexFirstDefault &&
     statusCopy.otherChangesThatMustBeDecidedSeparately.exactDateRouteWhitelistMustRemainDisabled &&
     statusCopy.firstPublicPublicationUtc===null &&
     !statusCopy.ownerStatusCopyEditorialPass &&
     !statusCopy.releaseCandidateCompiled && !statusCopy.renderedReleaseCandidateReviewed &&
     !statusCopy.releaseAuthorized && !statusCopy.routeActivated &&
     !statusCopy.noindexRemovalAuthorized && !statusCopy.legalRightsReviewPassed &&
     !statusCopy.privacyCertificationPassed,
     'future status-only copy does not authorize publishing or legal approval');
  ok(decision.includes('**B — PROVISIONAL INTERNAL PROCESS ONLY; explicit owner choice 2026-10-31**') &&
     decision.includes('**ALL DENIED**') &&
     decision.includes('**FALSE**') &&
     decision.includes('**No executable release action follows this worksheet.**') &&
     !pinned.newStatusCopyEditorialPass && pinned.ownerPathSelected &&
     pinned.internalGovernanceAmendmentActivated && !pinned.releaseAuthorized &&
     m.optionalOwnerOperatedGovernanceAmendmentProposal.policyAmendedOrEffective,
     'owner selected internal process only; final page review and public release still denied');
}

// Exact owner decision — provisional internal-process substitution, never a release gate.
{
  const recText=from('../../../docs/operations/independent-macro-release/provisional-owner-led-review-approval-2026-10-31.draft.json');
  const rec=JSON.parse(recText);
  const entry=m.provisionalOwnerLedReviewApproval;
  eq(gitBlob(recText),entry.decisionReceiptGitBlobSha,
    'provisional Option B receipt Git blob is immutable');
  eq(entry.decisionReceiptPath,'docs/operations/independent-macro-release/provisional-owner-led-review-approval-2026-10-31.draft.json',
    'provisional owner decision path pinned');
  eq(rec.schemaVersion,'usd-impact-macro-weekly-provisional-option-b-owner-process-approval-v1',
    'internal-only scope schema');
  eq(rec.ownerResponseVerbatim,
    'approved for now, until we get a better solution, remember to upgrade when ever possible',
    'owner words recorded exactly without release inference');
  eq(rec.selectedOption,'B','owner explicitly selected Option B');
  eq(rec.exactPr.number,1025,'only existing independent Macro Weekly PR');
  eq(rec.exactPr.originalArticleGitBlobSha,gitBlob(html),
    'same exact owner-reviewed original source');
  eq(rec.exactPr.ownerReviewedSharedLayoutComponentGitBlobSha,
    m.siteShellAdaptationDraft.componentGitBlobSha,
    'same exact shared-layout review blob');
  ok(entry.internalOwnerReviewProcessActive && entry.scopeLimitedToOneEnglishWeekly &&
     rec.internalGovernanceChange.scopedOwnerOperatedReviewSelected &&
     rec.internalGovernanceChange.supersedesInternalQualifiedReviewerAsProcessOnly &&
     rec.internalGovernanceChange.provisionalRatherThanPermanent &&
     rec.internalGovernanceChange.requiresFinalItemSpecificOwnerRiskAssessment &&
     !rec.internalGovernanceChange.finalItemSpecificOwnerRiskAssessmentCompleted &&
     !rec.internalGovernanceChange.qualifiedInternationalLegalOpinionObtained &&
     !rec.internalGovernanceChange.qualifiedProductionPrivacyAssessmentObtained &&
     !rec.internalGovernanceChange.applicableStatutoryOrContractualRequirementsWaived,
     'temporary internal review path is distinct from legal and publication acceptance');
  ok(rec.upgradePolicy.openIssueUrl===entry.upgradeIssue &&
     rec.upgradePolicy.doNotPurchaseOrEngageAutomatically &&
     rec.upgradePolicy.ownerReapprovalNeededForUpgradeOrReplacement &&
     rec.upgradePolicy.neverAutoExpandScope &&
     rec.hardStops.length>=5,
     'improvement plan is tracked without automatic external actions');
  ok(Object.values(rec.uncompletedDecisions).every(x=>x===false) &&
     !entry.finalSpecificRiskAssessmentSignedOff && !entry.externalLegalAndPrivacyCertified &&
     !entry.releaseAuthorized && !rec.releaseAuthorized &&
     rec.publishedIndependentWeeklyCount===0 && rec.eligibleMonthlyCount===0 &&
     !m.releaseAuthorized && !m.publishReady &&
     Object.values(m.holds).every(x=>x===false),
     'owner process selection cannot self-clear any release or legal/privacy gate');
}

// Offline final-text preflight: a content-only simulation must leave no visible Draft labels.
{
  const proposed=JSON.parse(from('../../../docs/operations/independent-macro-release/first-weekly-conditional-publication-copy-2026-10-31.draft.json'));
  const srcAdapter=from('../src/lib/independent-macro-weekly-draft-shell.mjs');
  const bodyStart=html.indexOf('<section class="hero" aria-labelledby="headline">');
  const bodyEnd=html.indexOf('</main>',bodyStart);
  const previous='This page is NOT routed or published. Rights clearance, exact article PASS, merge and public Production release are still denied.';
  const historical='This shared-layout adaptation is not published. The standalone article has an editorial PASS; this new layout, qualified international rights review, merge and public Production release remain on HOLD.';
  ok(srcAdapter.includes(previous) && srcAdapter.includes(historical) &&
     bodyStart>=0 && bodyEnd>=0,'offline source selection mirrors original draft adapter');
  let fragment=html.slice(bodyStart,bodyEnd+7)
     .replace('<main id="main" class="container layout">',
      '<main id="main-content" class="container layout">').replace(previous,historical);
  let component=from('../src/components/IndependentMacroWeeklyDraftShell.astro');
  eq(proposed.proposedStatusOnlySubstitutions.length,8,'exactly eight targeted visible replacements');
  for(const edit of proposed.proposedStatusOnlySubstitutions) {
    const input=edit.renderTarget==='layout'?component:fragment;
    eq(input.split(edit.old).length-1,1,'each intended visible replacement matches once: '+edit.id);
    if(edit.renderTarget==='layout')component=input.replace(edit.old,edit.proposed);
    else fragment=input.replace(edit.old,edit.proposed);
  }
  const visibleFragment=fragment.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
  const layoutBody=component.slice(component.indexOf('<BaseLayout'));
  const visibleLayout=layoutBody.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
  const staleLabels=/\b(?:Draft|unpublished|never published|not published|release.candidate|on HOLD)\b/i;
  ok(staleLabels.test('Shared-layout Draft - not published'),
     'offline draft-language detector must detect a known obsolete sentence');
  ok(!staleLabels.test(visibleFragment+' '+visibleLayout),
     'offline proposed visible text has no obsolete unpublished Draft language');
  eq([...fragment.matchAll(/<section aria-labelledby="([^"]+)">/g)].map(x=>x[1]),
    ['summary','timeline','transmission','mistakes','watch','sources','compliance'],
    'proposed visible status copy does not remove any of seven original sections');
  ok(m.sources.officialSourceUrls.every(x=>fragment.includes('href="'+x+'"')),
     'all five original issuer URLs retained in offline visible text');
  ok(component.includes('noindex={true}') &&
     component.includes('data-release-authorized="false"') &&
     component.includes('data-shared-layout-editorial-pass="false"') &&
     component.includes('data-shared-layout-status="draft-not-published"'),
     'historical machine-authority controls remain disabled even in offline copy audit');
  ok(proposed.machineReadablePublishStateChangesRequiringSeparateAuthorization.length===4 &&
     proposed.machineReadablePublishStateChangesRequiringSeparateAuthorization.every(x=>
       x.allowedOnlyAfterExactReleaseAuthorization||x.allowedOnlyAfterNewFinalRenderedEditorialPass||
       x.allowedOnlyAfterRealVerifiedPublication||x.allowedOnlyAfterSeparateIndexingDecision),
     'machine state, indexing and timestamp need distinct future release authority');
  ok(proposed.offlineRenderedTextPreflight.visibleOldDraftLabelsRemaining===0 &&
     !proposed.offlineRenderedTextPreflight.newRenderedAstroComponentCompiled &&
     !proposed.offlineRenderedTextPreflight.newPreviewOrProductionCreated &&
     !proposed.ownerStatusCopyEditorialPass && !proposed.releaseAuthorized,
     'offline string simulation is never a new owner approval or deployment');
}
// Objective risk preflight: no owner legal/risk signoff may be self-issued.
{
  const txt=from('../../../docs/operations/independent-macro-release/first-weekly-owner-item-specific-risk-preflight-2026-10-31.draft.json');
  const risk=JSON.parse(txt);
  eq(gitBlob(txt),m.ownerItemSpecificRiskPreflightDraft.gitBlobSha,
     'pin exact nonlegal owner risk preflight');
  eq(risk.schemaVersion,'usd-impact-first-weekly-owner-scope-risk-preflight-v1',
     'risk review scope version');
  eq(risk.source.articleGitBlobSha,gitBlob(html),'risk review pins original approved source');
  eq(risk.source.componentGitBlobSha,m.siteShellAdaptationDraft.componentGitBlobSha,
     'risk review pins original approved layout');
  eq(risk.riskItems.length,m.ownerItemSpecificRiskPreflightDraft.riskItemCount,
     'all eight discrete risk areas must be individually reviewed');
  ok(risk.riskItems.every(x=>x.ownerFinalAcceptance===false && x.evidenceUrls.length>0 && x.uncertainty),
     'no risk assessment may be marked accepted without owner signoff');
  ok(risk.internalReviewProcess.option==='B' && risk.internalReviewProcess.provisionallyApproved &&
     !risk.internalReviewProcess.qualifiedLegalOpinionObtained &&
     !risk.internalReviewProcess.independentQualifiedPrivacyReviewObtained &&
     !risk.internalReviewProcess.externalLegalOrContractualObligationsWaived &&
     !risk.acceptance.anyOwnerRiskItemAccepted && !risk.acceptance.ownerNameOrCapacityRecorded &&
     !risk.acceptance.finalEditorialCopyPass && !risk.acceptance.actualReleaseAuthorization,
     'internal process accepted but no item-level risk/rights/privacy certification');
  ok(!risk.releaseAuthorized && !risk.mergeAuthorized && !risk.publicRouteAuthorized &&
     !risk.productionDeployAuthorized && !risk.indexingAuthorized &&
     !m.ownerItemSpecificRiskPreflightDraft.ownerFinalRiskAcceptance &&
     !m.ownerItemSpecificRiskPreflightDraft.qualifiedExternalRightsOrPrivacyCertification &&
     !m.ownerItemSpecificRiskPreflightDraft.publicationAuthorized &&
     risk.firstPublishedIndependentWeeklies===0 && risk.monthlyEligibleCount===0,
     'risk worksheet never authorizes any public page or original Score rights');
}

// Standing release risk standard and case-specific remediation matrix are immutable evidence.
{
  const matrixText=from('../../../docs/operations/independent-macro-release/first-weekly-remediation-matrix-2026-10-31.draft.json');
  const matrix=JSON.parse(matrixText);
  const policyText=from('../../../docs/operations/publication-risk-decision-standard.md');
  const ptr=m.independentRemediationAndStandingPublicationDecisionRule;
  eq(gitBlob(matrixText),ptr.matrixGitBlobSha,'pin exact eight-area remediation matrix');
  eq(gitBlob(policyText),ptr.futurePolicyGitBlobSha,'pin reusable future-publication rulebook');
  eq(ptr.matrixPath,'docs/operations/independent-macro-release/first-weekly-remediation-matrix-2026-10-31.draft.json','pin case-specific path');
  eq(ptr.futurePolicyPath,'docs/operations/publication-risk-decision-standard.md','pin reusable policy path');
  eq(matrix.schemaVersion,'usd-impact-independent-macro-risk-remediation-register-v1',
    'matrix schema');
  eq(matrix.reviewedBaselineCommit,'85b2b836838c689fc8fdd6ccbc681324dd05f183','reviewed baseline SHA');
  eq(matrix.sourceGitBlobs.article,gitBlob(html),'risk matrix original article SHA');
  eq(matrix.sourceGitBlobs.baseLayout,m.existingSiteReuse.baseLayoutGitBlobSha,
    'risk matrix references reviewed site layout');
  eq(matrix.sourceGitBlobs.googleAnalyticsClient,gitBlob(from('../src/components/GoogleAnalyticsClient.astro')),
    'risk matrix references GA consent code');
  eq(matrix.sourceGitBlobs.consentClient,m.existingSiteReuse.consentComponentGitBlobSha,
    'risk matrix references consent client');
  eq(matrix.mainEight.map(x=>x.id),['R01','R02','R03','R04','R05','R06','R07','R08'],
    'all eight original risk categories included');
  eq(matrix.mainEight.map(x=>x.priority),['P2','P2','P2','P1','P1','P1','P1','P0'],
    'risk priorities preserved and never silently demoted');
  eq(matrix.crossCutting.map(x=>x.id),['X01','X02','X03','X04'],
    'future AI, privacy, runtime and upgrade guards tracked');
  ok(matrix.mainEight.every(x=>x.ownerItemDecisionRecorded===false && x.sourceRightsGrantedGlobally===false) &&
     matrix.crossCutting.every(x=>x.complete===false) &&
     ptr.allEightRiskAreasPresent && ptr.allIndividualOwnerAcceptancesDenied &&
     ptr.newCrossCuttingRisksCount===4 &&
     matrix.currentDecision.provisionalOptionBActive &&
     !matrix.currentDecision.publicReleaseAuthorized &&
     !matrix.currentDecision.sourceRightsExpanded &&
     !matrix.currentDecision.originalScoreRightsUnblocked &&
     !ptr.releaseAuthorized && !m.releaseAuthorized,
     'standing policy evidence never certifies legal rights or public release');
  ok(policyText.includes('AI Act Article 50(4)') &&
     policyText.includes('every actual release') &&
     policyText.includes('**a potential improvement**') &&
     policyText.includes('**an evidence gap**') &&
     policyText.includes('**a **')===false &&
     policyText.includes('**a **')===false &&
     policyText.includes('all future')===false,
     'future guardrail differentiates verified facts, gaps, defects, and approvals');
}

// The five owner risk and AI editorial choices are decision inputs, not inferred approvals.
{
  const inputText=from('../../../docs/operations/independent-macro-release/first-weekly-owner-final-decision-input-2026-10-31.draft.json');
  const proposed=JSON.parse(inputText);
  const worksheet=from('../../../docs/operations/independent-macro-release/first-weekly-final-risk-and-ai-editorial-review-2026-10-31.draft.md');
  const p=m.nextOwnerRiskAndAiEditorialDecisionInputDraft;
  eq(gitBlob(inputText),p.inputGitBlobSha,
    'exact five-question owner-risk decision input pinned');
  eq(gitBlob(worksheet),p.worksheetGitBlobSha,
    'exact human-readable decision worksheet pinned');
  eq(proposed.schemaVersion,'usd-impact-first-weekly-owner-item-specific-release-input-v1',
    'specific owner decision schema');
  eq(proposed.approvedArticleGitBlobSha,gitBlob(html),
    'frozen article exact Git blob preserved');
  eq(proposed.approvedPresentationComponentGitBlobSha,m.siteShellAdaptationDraft.componentGitBlobSha,
    'owner-reviewed shared-layout exact Git blob preserved');
  eq(proposed.riskPreflightGitBlobSha,m.ownerItemSpecificRiskPreflightDraft.gitBlobSha,
    'same original owner-risk preflight');
  eq(proposed.evidence.map(x=>x.riskId),
    ['R04','R05','R06','R07','X01'],
    'all separate unresolved human decisions present');
  ok(proposed.evidence.length===p.itemsNeedingActualOwnerReview &&
     proposed.evidence.every(x=>x.ownerDecision==='PENDING' &&
       !x.ownerAcknowledgedRisk && !x.hardStopConfirmed && x.sources.length>0),
     'no item-specific owner approval invented');
  const ai=proposed.aiEditorialDetermination;
  ok(ai.actualAIContributionToFinalText==='NOT_ATTESTED' &&
     ai.priorOwnerEditorialContentPassRecorded &&
     ai.priorOwnerPresentationPassRecorded &&
     ai.primarySourceFactsCheckedAgainstFiveIssuerLinks &&
     !ai.humanSubstantiveReviewBeyondGenericPassDocumented &&
     !ai.legalEditorialResponsibilityForThisArticleAttested &&
     !ai.exceptionUnderEUArticle50_4Chosen && !ai.publicAITextDisclosureChosen &&
     ai.disclosureCandidateNotInsertedIntoArticle &&
     ai.editorialDecision==='PENDING' &&
     !ai.legalCertification,
     'source facts PASS does not become Article 50 human review certification');
  ok(Object.values(proposed.signOff).every(x=>x===false) &&
     Object.values(proposed.releasePermissions).every(x=>x===false) &&
     !p.itemSpecificRiskAcceptanceRecorded && !p.aiEditorialDeterminationRecorded &&
     !p.finalStatusCopyPassed && !p.releaseAuthorized &&
     proposed.firstPublishedIndependentWeeklies===0 &&
     proposed.eligibleMonthlyCount===0,
     'owner-specific review may not waive release/indexing/Score or legal requirements');
  ok(worksheet.includes('AI Act Article 50(4)') &&
     worksheet.includes('all five owner outcomes PENDING') &&
     worksheet.includes('KELA LEADS S.R.L.') &&
     worksheet.includes('Privacy PR #1035 is now live in public Production') &&
     worksheet.includes('no privacy breach established') &&
     worksheet.includes('independent traffic/cookie-name') &&
     !m.releaseAuthorized && !m.publishReady,
     'worksheet explicitly holds legal/privacy and publication decision');
}

// Non-routable owner wording proof: exactly four source-label changes and one adapted side notice.
{
  const original=html;
  const status=JSON.parse(from('../../../docs/operations/independent-macro-release/first-weekly-conditional-publication-copy-2026-10-31.draft.json'));
  const proof=from('../../../docs/operations/independent-macro-release/first-weekly-status-copy-offline-proof-2026-10-31.draft.html');
  const p=m.offlineStatusCopyProofDraft;
  eq(gitBlob(proof),p.gitBlobSha,'pin exact review-only HTML proof');
  eq(gitBlob(original),p.sourceHtmlGitBlobSha,'pin original immutable article in proof');
  eq(gitBlob(from('../../../docs/operations/independent-macro-release/first-weekly-conditional-publication-copy-2026-10-31.draft.json')),p.statusCopyGitBlobSha,
    'pin eight-proposal editorial status copy');
  const replaceOnlyOne=(str,oldText,newText,label)=>{
    eq(str.split(oldText).length-1,1,'one source occurrence for '+label);
    return str.replace(oldText,newText);
  };
  const banner="  <div role=\"note\" data-offline-review-only=\"true\" style=\"background:#fff0b6;color:#1c2626;padding:18px 28px;text-align:center;font:700 15px/1.5 system-ui\">\n    OFFLINE WORDING PROOF — NOT PUBLISHED. This file illustrates proposed status wording only. It is not the shared-site Astro layout or a public release. All legal, privacy, routing, deployment, indexing, and original Score permissions remain on HOLD.\n  </div>\n";
  const open="<body data-candidate-period-end=\"2026-10-30\" data-release-candidate=\"draft\" data-series=\"independent_macro_education\" data-release-authorized=\"false\">";
  let expected=replaceOnlyOne(original,open,open+'\n'+banner,'review-only banner');
  const four=status.proposedStatusOnlySubstitutions.filter(x=>
    x.path==='apps/web/src/data/independent-macro-review/weekly-2026-10-30.release-candidate.html');
  eq(four.length,4,'four original-source visible copy edits');
  for(const change of four) {
    expected=replaceOnlyOne(expected,change.old,change.proposed,change.id);
  }
  const sidebar=status.proposedStatusOnlySubstitutions.find(x=>
    x.id==='adapter-stale-presentation-notice');
  expected=replaceOnlyOne(expected,
    'This page is NOT routed or published. Rights clearance, exact article PASS, merge and public Production release are still denied.',
    sidebar.proposed,'offline proof sidebar');
  eq(proof,expected,
    'wording proof must be identical to frozen source except five intentional text changes and warning banner');
  eq([...proof.matchAll(/<section aria-labelledby="([^"]+)">/g)].map(x=>x[1]),
    ['summary','timeline','transmission','mistakes','watch','sources','compliance'],
    'seven unchanged factual editorial sections');
  ok(m.sources.officialSourceUrls.every(x=>proof.includes('href="'+x+'"')),
    'all five official sources preserved in proof');
  ok(proof.includes('data-offline-review-only="true"') &&
     proof.includes('data-release-authorized="false"') &&
     proof.includes('<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">') &&
     proof.includes('Release Candidate • Draft only • Not published • All rights HOLD') &&
     !/<script\b/i.test(proof) && !/<iframe\b/i.test(proof) && !/<img\b/i.test(proof),
    'only inert, noindex review proof with prominent nonpublication status');
  ok(p.storedOutsideSiteSrcAndDist && p.noindexAndReleaseDenialRetained &&
     !p.sharedLayoutCompiledOrRendered && !p.ownerProofApprovalReceived &&
     !p.publicRouteAuthorized && !p.releaseAuthorized &&
     !m.releaseAuthorized && !m.publishReady,
     'offline proof never grants site deploy or indexing authority');
}

// Merged privacy client provenance: historical point-in-time evidence remains distinct.
{
  const raw=from('../../../docs/operations/independent-macro-release/privacy-production-merge-integration-receipt-2026-10-31.draft.json');
  const receipt=JSON.parse(raw);
  const p=m.privacyProductionReconciliationDraft;
  const risk=JSON.parse(from('../../../docs/operations/independent-macro-release/first-weekly-owner-item-specific-risk-preflight-2026-10-31.draft.json'));
  const matrix=JSON.parse(from('../../../docs/operations/independent-macro-release/first-weekly-remediation-matrix-2026-10-31.draft.json'));
  const decision=JSON.parse(from('../../../docs/operations/independent-macro-release/first-weekly-owner-final-decision-input-2026-10-31.draft.json'));
  const ga=from('../src/components/GoogleAnalyticsClient.astro');
  const gaTest=from('./test-ga4-consent-revocation.mjs');
  const gaMemo=from('../../../docs/operations/privacy/ga4-revocation-hardening-2026-10-31.draft.md');
  const pkg=JSON.parse(from('../package.json'));
  eq(gitBlob(raw),p.receiptGitBlobSha,'GA4 merge receipt exactly pinned');
  eq(p.receiptPath,'docs/operations/independent-macro-release/privacy-production-merge-integration-receipt-2026-10-31.draft.json','merge receipt path exact');
  eq(receipt.schemaVersion,'usd-impact-macro-weekly-ga4-production-integration-v1',
    'privacy integration receipt schema');
  eq(receipt.previousDraftHead,'4c1ce56c9fa805171eede394c8c4254d0dbcd7b9','historic Draft head pinned');
  eq(receipt.protectedMainSha,'743872f3fdfd5fdddd242b64e7a42674a459a416','merged Production main SHA');
  eq(receipt.historicalGa4ClientGitBlobSha,'cb6d89da7a6cfa3dab0c51b9972527fc1581e860',
    'historic prior-source GA4 blob preserved');
  eq(receipt.currentGa4ClientGitBlobSha,'2877b295ddc106c0e89b75eb55e71a0c92afc642',
    'current deployed-source GA4 blob preserved');
  eq(gitBlob(ga),receipt.currentGa4ClientGitBlobSha,'current GA4 code matches Production source');
  eq(gitBlob(gaTest),receipt.ga4RevocationTestGitBlobSha,'privacy regression test imported exactly');
  eq(gitBlob(gaMemo),receipt.privacyPatchNotesGitBlobSha,'privacy engineering memo imported');
  eq(risk.source.gaClientGitBlobSha,receipt.currentGa4ClientGitBlobSha,
    'R06 owner preflight references new GA4 source');
  eq(risk.privacyProductionIntegration.priorSourceBlobSha,receipt.historicalGa4ClientGitBlobSha,
    'preflight explicitly retains prior GA4');
  eq(risk.privacyProductionIntegration.historicalRiskPreflightGitBlobSha,
    receipt.historicalOwnerPreflightGitBlobSha,'historical risk preflight retained as historical');
  eq(matrix.sourceGitBlobs.googleAnalyticsClient,receipt.currentGa4ClientGitBlobSha,
    'R06 matrix references new GA4 source');
  eq(matrix.historicalSourceReview.previousRemediationMatrixBlobSha,
    receipt.historicalCaseMatrixGitBlobSha,'historical matrix is immutable provenance');
  eq(decision.riskPreflightGitBlobSha,gitBlob(from('../../../docs/operations/independent-macro-release/first-weekly-owner-item-specific-risk-preflight-2026-10-31.draft.json')),
    'owner five-item review points to reconciled preflight');
  eq(pkg.scripts['validate:functions'].split('test-ga4-consent-revocation.mjs').length-1,1,
    'privacy lifecycle regression added exactly once');
  ok(pkg.scripts.build.includes('test-independent-macro-main-integration-hold.mjs --built-output') &&
    pkg.scripts['validate:reports'].includes('test-independent-macro-main-integration-hold.mjs'),
    'independent Macro Weekly negative build/contract tests retained');
  ok(ga.includes("analytics_storage: 'denied'") &&
     ga.includes("if (configured && typeof window.gtag === 'function')") &&
     ga.includes('window[DISABLE_KEY] = true'),
    'actual merged GA4 has explicit denial and retains client kill switch');
  ok(receipt.liveDeployment.state==='READY' && receipt.liveDeployment.macroWeeklyPublicRoute404 &&
    receipt.qa.ownerPreviewUatReportedPass && !receipt.qa.independentFullProdNetworkCookieTrace &&
    !receipt.qa.professionalGDPRReview &&
    !receipt.rights.allEightItemsOwnerAccepted && !receipt.rights.fiveResidualOwnerDecisionsTaken &&
    !receipt.rights.macroRouteAuthorized && !receipt.rights.macroMergeAuthorized &&
    !receipt.rights.macroProductionAuthorized && !receipt.rights.indexingAuthorized &&
    !receipt.rights.originalScorePublicationAuthorized &&
    !p.ownerFinalRiskAcceptance && !p.macroRouteAuthorized && !p.mergeAuthorized &&
    !p.releaseAuthorized && !m.releaseAuthorized && !m.publishReady,
    'privacy Production hardening cannot grant Macro Weekly, original Score, or external rights');
}
// Shared BaseLayout integration stays non-public. The approved standalone
// article remains unchanged, but the new presentation needs its own owner PASS.
{
  const a=m.siteShellAdaptationDraft;
  ok(a && typeof a === 'object', 'shared-layout Draft adaptation manifest exists');
  const sourceComponent=from('../src/components/IndependentMacroWeeklyDraftShell.astro');
  const sourceAdapter=from('../src/lib/independent-macro-weekly-draft-shell.mjs');
  const scopedStyle=from('../src/styles/independent-macro-weekly-draft.css');
  eq(gitBlob(sourceComponent),a.componentGitBlobSha,'shared-layout component Git blob pinned');
  eq(gitBlob(sourceAdapter),a.adapterGitBlobSha,'pure Draft section adapter pinned');
  eq(gitBlob(scopedStyle),a.stylesheetGitBlobSha,'scoped site-shell CSS pinned');
  eq(gitBlob(route),a.routeGitBlobSha,'disabled draft route source pinned');
  ok(sourceComponent.includes("import BaseLayout from '../layouts/BaseLayout.astro'"),
    'use existing site layout without duplicating global header/footer');
  ok(sourceComponent.includes('noindex={true}'),'site-shell canonical / indexing denied');
  ok(sourceComponent.includes('data-release-authorized="false"') &&
    sourceComponent.includes('data-shared-layout-editorial-pass="false"'),
    'reviewed artifact retains its unchanged pre-PASS machine marker and release denial');
  ok(sourceComponent.includes('<Fragment set:html={adapted.fragment} />'),
    'trusted static article fragment rendered inside the base layout only');
  ok(sourceComponent.includes("'../styles/independent-macro-weekly-draft.css'"),
    'reuse review-only scoped CSS');
  ok(route.includes('IndependentMacroWeeklyDraftShell') &&
    !route.includes('<Fragment set:html={unpublishedCandidateHtml} />'),
    'disabled route now points to shared-site Draft only');
  ok(a.importsExistingBaseLayout && a.usesExistingSitePrivacyAndConsentElements &&
    a.replacesOriginalStandaloneHeaderFooter && a.patchesMainIdToSiteSkipLink,
    'adapts to the existing legal, consent and skip-link shell');
  ok(a.preservesAllSevenEditorialSectionsUnchanged &&
    a.updatesObsoleteDraftSideNoticeOnly &&
    a.hasNewPresentation && a.newPresentationOwnerPass,
    'all seven factual sections unchanged; owner exact-presentation PASS recorded');
  const ownerVisualReceiptText=from('../../../docs/operations/independent-macro-release/shared-layout-owner-presentation-pass-2026-10-30.draft.json');
  const ownerVisualReceipt=JSON.parse(ownerVisualReceiptText);
  eq(gitBlob(ownerVisualReceiptText),a.ownerPresentationPassReceiptGitBlobSha,
    'pin exact post-build owner presentation PASS receipt');
  eq(a.ownerPresentationPassExactReviewedCommit,ownerVisualReceipt.reviewedArtifact.reviewedPrCommit,
    'owner PASS only on exact source commit');
  eq(a.ownerPresentationPassExactReviewedCommit,'889c9da8a692e5c7f5a2935fc4096eced67f8204',
    'approved reviewed component version stays pinned');
  eq(ownerVisualReceipt.reviewedArtifact.originalArticleGitBlobSha,gitBlob(html),
    'frozen original article exact-match owner PASS');
  eq(ownerVisualReceipt.reviewedArtifact.sharedLayoutComponentGitBlobSha,gitBlob(sourceComponent),
    'frozen shared-layout component exact-match owner PASS');
  eq(ownerVisualReceipt.reviewedArtifact.sharedLayoutAdapterGitBlobSha,gitBlob(sourceAdapter),
    'frozen shared-layout adapter exact-match owner PASS');
  eq(ownerVisualReceipt.reviewedArtifact.sharedLayoutCssGitBlobSha,gitBlob(scopedStyle),
    'frozen shared-layout CSS exact-match owner PASS');
  ok(ownerVisualReceipt.ownerDecision==='PASS_PRESENTATION_ONLY_FOR_EXACT_REVIEWED_ARTIFACT' &&
    ownerVisualReceipt.evidenceAndLimits.ownerReportsAllFollowupManualChecksPass &&
    !ownerVisualReceipt.evidenceAndLimits.rawProductionCookieJarAndGa4BeaconsAudited &&
    !ownerVisualReceipt.evidenceAndLimits.sitePrivacyOrGdprComplianceCertified &&
    !ownerVisualReceipt.releaseAuthorized && !ownerVisualReceipt.publishReady &&
    a.reviewedArtifactStillHasHistoricalEditorialPassFalseAttribute &&
    a.fullIndependentNetworkAndCookieAuditStillPending,
    'owner presentation PASS is never a rights, runtime privacy or publication PASS');
  ok(!a.actualBrowserCookieControlsValidatedForFuturePage &&
    !a.actualBrowserVisualQaCompleted &&
    !a.qualifiedForeignLegalClearance && !a.releaseAuthorized,
    'do not claim browser/cross-border legality before actual QA');
  ok(m.existingSiteReuse.sharedLayoutDraftComponentExists &&
    m.existingSiteReuse.sharedLayoutDraftUsesBaseLayout &&
    !m.existingSiteReuse.sharedLayoutDraftOwnerPresentationPassPending &&
    !m.existingSiteReuse.releasePageUsesBaseLayoutNow,
    'component exists as Draft, not a live site integration');

  const result=extractIndependentMacroWeeklyDraftFragment(html);
  ok(result.presentationChanged && !result.readyForPublicRelease,
    'site layout changes visual presentation but not release rights');
  eq(result.factualSectionIds,[...DRAFT_ARTICLE_SECTION_IDS],
    'same expected original editorial section IDs');
  eq(DRAFT_ARTICLE_SECTION_IDS.length,7,'all seven owner-reviewed editorial sections');
  for (const id of DRAFT_ARTICLE_SECTION_IDS){
    const regexp=new RegExp('<section aria-labelledby="'+id+'">[\\s\\S]*?<\\/section>');
    const original=html.match(regexp)?.[0];
    const adapted=result.fragment.match(regexp)?.[0];
    ok(Boolean(original),'source section exists: '+id);
    eq(adapted,original,'source editorial section retained exactly: '+id);
  }
  ok(!result.fragment.includes('<header') && !result.fragment.includes('<footer') &&
    !result.fragment.includes('<html') && !result.fragment.includes('<body'),
    'standalone shell is omitted to avoid duplicate navigation and footer');
  ok(result.fragment.includes('<main id="main-content"') &&
    !result.fragment.includes('<main id="main"'),
    'base layout skip link lands on the actual report main landmark');
  ok(result.fragment.includes('This shared-layout adaptation is not published.') &&
    !result.fragment.includes('exact article PASS, merge'),
    'new Draft notice does not misstate already granted original article PASS');
  for (const link of m.sources.officialSourceUrls) {
    ok(result.fragment.includes('href="'+link+'"'),'exact source links preserved in new presentation');
  }
  for (const d of m.sources.originalPublishedDailyFiles){
    ok(result.fragment.includes('href="https://www.usd-impact.com/news/'+d.date+'/"'),
      'published Daily link preserved in new presentation '+d.date);
  }
  const cssSelectors=scopedStyle.split(/\n/).map(x=>x.trim()).filter(x=>x.includes('{') &&
    !x.startsWith('@') && !x.startsWith('/*') && !x.startsWith('*'));
  ok(cssSelectors.length>40,'responsive typography and components remain styled');
  ok(cssSelectors.every(x=>x.startsWith('.mw-root') || x.startsWith('}')),
    'all Draft CSS selectors remain rooted in .mw-root (no global site override)');
  ok(scopedStyle.includes('@media(max-width:880px)') &&
    scopedStyle.includes('@media(max-width:580px)') &&
    scopedStyle.includes('prefers-reduced-motion:reduce'),
    'desktop/tablet/mobile and reduced-motion Draft presentation rules exist');
}

// A browser session checked only the EXISTING public privacy page; it did
// not prove network-level cookie behavior or render the not-yet-public Weekly.
{
  const qaText=from('../../../docs/operations/independent-macro-release/current-site-consent-browser-qa-2026-10-30.draft.json');
  const qa=JSON.parse(qaText);
  eq(qa.schemaVersion,'usd-impact-live-existing-consent-browser-qa-v1-draft','consent browser receipt version');
  eq(gitBlob(qaText),m.existingSiteReuse.currentPublicPrivacyBrowserQaGitBlobSha,
    'exact existing-site browser QA receipt');
  eq(qa.url,'https://www.usd-impact.com/privacy/','privacy test did not access new route');
  eq(qa.mode,'fresh_anonymous_disposable_browser','no account or user-level data access');
  ok(qa.observations.privacyNoticeRenders && qa.observations.termsFooterLinkVisible &&
    qa.observations.complianceFooterLinkVisible,'current public legal/footer controls observed');
  ok(qa.observations.firstVisitConsentBannerVisible && qa.observations.rejectAnalyticsButtonVisible &&
    qa.observations.reviewSettingsButtonVisible && qa.observations.acceptAnalyticsButtonVisible,
    'fresh visitor offered both optional analytics consent choices');
  ok(qa.observations.rejectAnalyticsClicked &&
    qa.observations.optionalAnalyticsUncheckedAfterReject &&
    qa.observations.optionalAnalyticsRemainedUncheckedAfterReopen &&
    m.existingSiteReuse.currentPublicConsentRejectPersistenceObserved,
    'observed reject state persisted across reopening Privacy settings');
  ok(!qa.observations.acceptThenWithdrawExplicitlyTested &&
    !qa.observations.googleAnalyticsScriptAbsenceDirectlyVerified &&
    !qa.observations.rawCookieValuesInspected &&
    !qa.observations.networkRequestLogCaptured,
    'do not invent accept/withdraw, cookie or network verification');
  ok(!m.existingSiteReuse.gaNetworkAndCookieInspectionCompleted &&
    !m.existingSiteReuse.optionalAnalyticsAcceptanceAndWithdrawalBrowserTestCompleted &&
    !m.existingSiteReuse.futureMacroSharedLayoutBrowserTestCompleted &&
    m.existingSiteReuse.privacyAndCookieComplianceNotCertified,
    'future Weekly runtime and legal QA remain pending');
  ok(!qa.publicReleaseAuthorized && !qa.newPagePublished && !qa.productionMutationAuthorized,
    'browser-only review cannot enable publication');
}

// A separate, later anonymous session verified the VISIBLE Accept -> Withdraw
// preferences on the existing Privacy page. No tracking/network/cookie claims.
{
  const receiptText=from('../../../docs/operations/independent-macro-release/current-site-consent-accept-withdraw-qa-2026-10-30.draft.json');
  const receipt=JSON.parse(receiptText);
  eq(receipt.schemaVersion,'usd-impact-existing-consent-accept-withdraw-browser-qa-v1-draft',
    'accept-then-withdraw UI-only receipt schema');
  eq(gitBlob(receiptText),m.existingSiteReuse.currentPublicConsentAcceptWithdrawUiEvidenceGitBlobSha,
    'exact accepted UI-only browser QA receipt pinned');
  eq(receipt.testedUrl,'https://www.usd-impact.com/privacy/','test on current Privacy page only');
  ok(m.existingSiteReuse.currentPublicConsentAcceptWithdrawUiObserved &&
    receipt.observed.firstVisitBannerOffersRejectReviewAccept &&
    receipt.observed.clickedAcceptAnalytics &&
    receipt.observed.checkboxCheckedAfterAccept &&
    receipt.observed.uncheckedAnalyticsToWithdraw &&
    receipt.observed.savedChoice &&
    receipt.observed.checkboxStillUncheckedAfterSecondReopen &&
    receipt.observed.finalAnalyticsPreferenceRejected,
    'the visible consent preference was accepted, withdrawn and persisted after reopening');
  ok(!receipt.observed.networkBeaconsInspected &&
    !receipt.observed.googleTagScriptPresenceInspected &&
    !receipt.observed.rawCookieJarInspected &&
    !receipt.observed.postWithdrawalAnalyticsCookieErasureConfirmed &&
    !receipt.observed.futureMacroWeeklySharedLayoutRendered &&
    !receipt.observed.qualifiedPrivacyComplianceSignoff &&
    !m.existingSiteReuse.gaNetworkAndCookieInspectionCompleted &&
    !m.existingSiteReuse.optionalAnalyticsAcceptanceAndWithdrawalBrowserTestCompleted &&
    !m.existingSiteReuse.futureMacroSharedLayoutBrowserTestCompleted &&
    !receipt.releaseAuthorized,
    'UI-only consent observation does not confer full tracking, legal or publication PASS');
}

// Latest owner attestation is distinct from independently preserved GA4/cookie trace.
{
  const receiptText=from('../../../docs/operations/independent-macro-release/production-privacy-owner-devtools-pass-2026-10-31.draft.json');
  const receipt=JSON.parse(receiptText);
  eq(receipt.schemaVersion,'usd-impact-production-privacy-owner-devtools-pass-v1-draft',
     'owner-reported DevTools follow-up scope');
  eq(gitBlob(receiptText),m.existingSiteReuse.currentPublicNetworkCookieOwnerAttestationReceiptGitBlobSha,
     'exact owner DevTools attestation Git blob');
  eq(m.existingSiteReuse.currentPublicNetworkCookieOwnerAttestationReceiptPath,
     'docs/operations/independent-macro-release/production-privacy-owner-devtools-pass-2026-10-31.draft.json','attestation file location pinned');
  eq(receipt.lastReviewedPrHeadBeforeReceipt,'45b5a41aa632ed298e448d497820016ddc4f85e9',
     'attestation tied to exact reviewed PR baseline');
  eq(receipt.responseVerbatim,'all PASS please continue','owner reported latest manual results');
  ok(receipt.ownerAttestation.requestedRemainingNetworkAndCookieChecksReportedPass &&
     m.existingSiteReuse.currentPublicNetworkCookieOwnerAttestationReceived,
     'owner attested completion without demanding a redundant review');
  ok(receipt.priorScreenshotLimitations.lastReceivedNetworkFilterWasDocNotAll &&
     receipt.priorScreenshotLimitations.lastReceivedApplicationCookiesParentWasCollapsed &&
     receipt.priorScreenshotLimitations.noNewIndependentScreenshotOrHarAttachedToThisReceipt &&
     receipt.ownerAttestation.exactRequestRowsAndCookieNamesNotSuppliedInLatestReply,
     'do not manufacture direct network/cookie evidence from screenshots');
  ok(!receipt.independentVerification.ga4RawNetworkTrafficCapturedAndIndependentlyInspected &&
     !receipt.independentVerification.exactBeforeAndAfterCookieNamesIndependentlyInspected &&
     !receipt.independentVerification.qualifiedGdprEprivacySignoff &&
     !receipt.independentVerification.qualifiedRomaniaEuInternationalCopyrightSignoff &&
     !m.existingSiteReuse.gaNetworkAndCookieInspectionCompleted &&
     !m.existingSiteReuse.independentlyCapturedFullProductionNetworkCookieTraceAvailable &&
     !m.firstWeeklyRightsAndPrivacyEvidenceDraft.productionCookieAndNetworkTraceCompleted &&
     Object.values(receipt.decisions).filter(v=>v===true).length===1 &&
     receipt.decisions.presentationAndOwnerFunctionalQaRecorded,
     'UI/owner attestation never silently becomes legal, release or network proof');
}

// Exact-source legal/privacy review packet is only evidence: it grants NO rights.
{
  const packet=m.firstWeeklyRightsAndPrivacyEvidenceDraft;
  ok(packet && packet.sourceCount===5,'narrow legal/privacy review packet exists');
  const evidenceText=from('../../../docs/operations/independent-macro-release/first-weekly-source-rights-and-privacy-evidence-2026-10-30.draft.json');
  const evidence=JSON.parse(evidenceText);
  const memo=from('../../../docs/operations/independent-macro-release/first-weekly-scope-limited-legal-and-production-privacy-review.draft.md');
  eq(gitBlob(evidenceText),packet.evidenceGitBlobSha,'exact evidence JSON Git blob');
  eq(gitBlob(memo),packet.memoGitBlobSha,'exact qualified review memo Git blob');
  eq(evidence.schemaVersion,'usd-impact-independent-first-weekly-rights-privacy-evidence-v1-draft',
    'narrow five-item evidence schema');
  eq(evidence.scope.sourceArticleBlob,gitBlob(html),'article source unchanged');
  eq(evidence.sourceItems.length,5,'five official sources, no extra imports');
  eq(evidence.sourceItems.map(x=>x.url),m.sources.officialSourceUrls,'five exact official URLs');
  eq(evidence.linkedDailyDates,m.sources.originalPublishedDailyFiles.map(x=>x.date),
    'five original Dailies and no additional source URLs');
  ok(evidence.sourceItems.every(x=>x.policy.startsWith('https://') &&
     x.sourceExpressionRehosted===false && x.agencySealOrThirdPartyAssetUsed===false &&
     x.qualifiedInternationalRightsClearance===false &&
     html.includes('href="'+x.url+'"')),
     'facts-and-links-only evidence without legal grant or copied media');
  ok(evidence.sourceItems[4].directRetrieved===true &&
     evidence.sourceItems[4].verificationNote.includes('direct browser-backed retrieval succeeded') &&
     evidence.sourceItems[4].qualifiedInternationalRightsClearance===false,
     'separate BLS direct source check is not international legal clearance');
  ok(evidence.internationalReferences.length===2 &&
     evidence.privacyReferences.length===3 &&
     evidence.runtimePrivacyEvidence===undefined,
     'specific cross-border and privacy sources without unrelated rights');
  ok(evidence.privacy.currentConsentAndGa4SourceReviewed &&
     !evidence.privacy.productionNetworkRequestsBeforeConsentCertified &&
     !evidence.privacy.productionGa4AfterWithdrawalCertified &&
     !evidence.privacy.productionGaCookiesRemovedAfterWithdrawalCertified &&
     !evidence.privacy.productionFullTrackingHarCaptured &&
     !evidence.privacy.qualifiedGdprEprivacySignoff,
     'production network, cookie and legal clearance remain unproven');
  ok(Object.values(evidence.reviewStatus).every(v=>v==='pending'||v==='not_granted') &&
     !evidence.releaseAuthorized && !evidence.publicRouteAuthorized &&
     !evidence.mergeAuthorized && !evidence.indexAuthorized &&
     !packet.independentQualifiedLegalReviewCompleted &&
     !packet.productionCookieAndNetworkTraceCompleted &&
     !packet.releaseAuthorized &&
     evidence.firstIndependentWeekliesPublished===0 && evidence.monthlyEligibleWeeks===0,
     'all source/legal/release gates still closed');
  ok(memo.includes('DRAFT / HOLD') && memo.includes('**HOLD**') &&
     memo.includes('first-weekly-source-rights-and-privacy-evidence-2026-10-30.draft.json')===false &&
     memo.includes('BLS ECI') && memo.includes('Privacy settings') &&
     memo.includes('Independent published Weeklies: 0'),
     'scoped counsel memo explicitly holds publisher decision and production tests');
}

const builtOutput = process.argv.includes('--built-output');
if (builtOutput) {
  const dist = new URL('../dist/', import.meta.url);
  ok(existsSync(dist),'public site build exists before negative output test');
  ok(!existsSync(new URL('macro-reviews/weekly/2026-10-30/',dist)),'no public candidate directory');
  ok(!existsSync(new URL('macro-reviews/weekly/2026-10-30.html',dist)),'no public candidate file');
  const fingerprints=[
    'data-release-candidate="draft"',
    'UNPUBLISHED RELEASE CANDIDATE',
    'Release Candidate • Draft only',
    'USD Impact Macro Weekly Review | October 26–30, 2026 — Draft Release Candidate (Unpublished)',
    'data-shared-layout-status="draft-not-published"',
    'Shared-layout Draft — not published — presentation review'
  ];
  let inspected=0;
  function walk(folder){
    for(const entry of readdirSync(folder,{withFileTypes:true})){
      const child=new URL(encodeURIComponent(entry.name)+(entry.isDirectory()?'/':''),folder);
      if(entry.isDirectory())walk(child);
      else if(entry.isFile() && /\.(?:html|htm|js|mjs|json|xml|txt|css|map)$/i.test(entry.name)){
        const output=readFileSync(child,'utf8'); inspected++;
        for(const marker of fingerprints)ok(!output.includes(marker),'no private candidate leaked into '+entry.name);
        if (/^sitemap.*\.xml$/i.test(entry.name)) ok(!output.includes('/macro-reviews/weekly/2026-10-30'),'no candidate sitemap entry');
      }
    }
  }
  walk(dist);
  ok(inspected>0,'nonempty built artifacts inspected for leaks');
  console.log('Independent Macro Weekly main-based Draft HOLD build output: '+checks+
    ' assertions passed; generated public pages 0; sitemap/asset leakage 0.');
} else {
  console.log('Independent Macro Weekly main-based Draft HOLD source: '+checks+
    ' assertions passed; owner exact HTML PASS preserved; external release rights DENIED.');
}
