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
