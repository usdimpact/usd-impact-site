import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

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
    'USD Impact Macro Weekly Review | October 26–30, 2026 — Draft Release Candidate (Unpublished)'
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
