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
  false, 'new candidate presentation is not yet editorial-approved');
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
ok(Object.values(manifest.publisherGovernance).every((v) => v === false),
  'every final legal, editorial, merge, indexing and Production flag false');
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
  ok(manifest.editorialProvenance.finalCandidateEditorialPassStillRequired === true,
    'independent candidate still requires editorial PASS');
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

console.log('Independent Macro Weekly draft public-release candidate: ' +
  checks + ' assertions passed. Zero public paths; all rights and Production HOLD.');
