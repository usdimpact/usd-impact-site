import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const root = new URL('../../../docs/operations/independent-editorial/', import.meta.url);
const previewRoot = new URL('stage-a-preview/', root);
const article = readFileSync(new URL('macro-reviews/weekly/2026-10-30/index.html', previewRoot), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('vercel.json', previewRoot), 'utf8'));
const robots = readFileSync(new URL('robots.txt', previewRoot), 'utf8');
const weekly = JSON.parse(readFileSync(new URL('weekly-2026-10-30.draft.json', root), 'utf8'));
const rights = JSON.parse(readFileSync(new URL('pilot-exact-source-rights-worksheet.draft.json', root), 'utf8'));
const owner = JSON.parse(readFileSync(new URL('owner-editorial-direction.draft.json', root), 'utf8'));
let tests = 0;

function check(value, message) { assert.ok(value, message); tests++; }
function equal(a,b,message){ assert.deepEqual(a,b,message);tests++; }
check(article.startsWith('<!doctype html>'), 'HTML5 document');
check(article.includes('<html lang="en">'), 'English lang declaration');
check(article.includes('<main id="main"'), 'accessible main landmark');
check(article.includes('name="viewport"'), 'responsive viewport');
check(article.includes('name="robots" content="noindex,nofollow,noarchive,nosnippet"'), 'robots noindex meta');
check(article.includes('name="googlebot" content="noindex,nofollow,noarchive,nosnippet"'), 'Google noindex meta');
check(article.includes('data-stage-a-version="2026-10-30"'), 'Stage A marker');
check(article.includes('data-series="independent_macro_education"'), 'separate series marker');
check(article.includes('data-release-authorized="false"'), 'release disabled');
check(/Stage A . Private editorial preview/.test(article), 'unpublished banner');
check(article.includes('not published') || article.includes('Not published'), 'unpublished wording');
check(!/<script\b/i.test(article), 'no scripts');
check(!/<iframe\b/i.test(article), 'no iframes');
check(!/<form\b/i.test(article), 'no forms or user tracking');
check(!/<img\b/i.test(article), 'no protected images or logos');
check(!/<link\s[^>]*rel="stylesheet"/i.test(article), 'no remote fonts or CSS');
check(!/href="\/reports\/weekly\//.test(article), 'not the original Score Weekly route');
check(!/href="\/score\//.test(article), 'no Score route dependency');
check(!/\b(google-analytics|gtag|googletagmanager|hotjar|segment\.com|mixpanel)\b/i.test(article), 'no analytics');
check(/Educational, not actionable trading advice/.test(article), 'compliance disclaimer');
check(/Rights review pending/i.test(article), 'rights HOLD visible');
check(article.includes(owner.editorial.weeklyWorkingTitle), 'owner-approved title in page metadata');
check(owner.authorizations.publicPublication === false, 'owner has not authorized publication');
check(weekly.status === 'draft' && weekly.releaseAuthorized === false, 'pilot remains unpublished');
check(rights.permittedByThisRecord === false && rights.releaseAuthorized === false, 'rights worksheet cannot authorize release');
check(rights.sourceItems.length === 5, 'exactly five distinct official items');
check(rights.sourceItems.every((s)=>Object.values(s.rightsChecks).every((allowed)=>allowed===false)), 'all item rights HOLD');
const allowedLinks = new Set();
for (const source of rights.sourceItems) {
  check(article.includes('href="' + source.exactSourceUrl + '"'), 'official source link ' + source.sourceId);
  allowedLinks.add(source.exactSourceUrl);
}
for (const edition of weekly.sourceEditions) {
  const url = 'https://www.usd-impact.com/news/' + edition.date + '/';
  check(article.includes('href="' + url + '"'), 'pinned Daily link ' + edition.date);
  allowedLinks.add(url);
}
allowedLinks.add('#main');
const links = [...article.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((m)=>m[1]);
check(links.length >= 12, 'links included for readers');
check(links.every((value)=>allowedLinks.has(value)), 'only source-pinned public or internal anchor links');
check(article.includes('data-claim="fomc-outcome-oct28"'), 'Fed outcome distinguished from calendar');
for(const id of ['gdp-oct29','pce-oct29','eci-oct30']){
  check(article.includes('data-claim="'+id+'"'), 'dated claim '+id);
}
check(article.includes('3.75–4.00%'), 'Fed range presented');
check(article.includes('3.4%'), 'GDP and ECI details included');
check(article.includes('3.6% / 3.1%'), 'headline/core PCE distinct');
check(article.includes('No original eight-driver Score'), 'original Score not embedded');
check(/@media\(max-width:580px\)/.test(article), 'mobile-specific layout');
equal(vercel.version, 2, 'Vercel config v2');
check(Array.isArray(vercel.headers) && vercel.headers.length === 1, 'one all-path header rule');
equal(vercel.headers[0].source, '/(.*)', 'all paths covered');
const headers = new Map(vercel.headers[0].headers.map(({key,value})=>[key.toLowerCase(),value]));
equal(headers.get('x-robots-tag'), 'noindex, nofollow, noarchive, nosnippet', 'X-Robots-Tag enforced');
equal(headers.get('cache-control'), 'private, no-store, max-age=0', 'no caching');
equal(headers.get('x-frame-options'), 'DENY', 'clickjacking denied');
check(headers.get('content-security-policy').includes("script-src 'none'"), 'scripts prohibited');
check(headers.get('content-security-policy').includes("connect-src 'none'"), 'remote data prohibited');
check(headers.get('content-security-policy').includes("frame-ancestors 'none'"), 'embedding denied');
check(vercel.rewrites.some((r)=>r.source==='/' && r.destination==='/macro-reviews/weekly/2026-10-30/index.html'), 'root preview route');
check(vercel.rewrites.some((r)=>r.source==='/macro-reviews/weekly/2026-10-30/' && r.destination==='/macro-reviews/weekly/2026-10-30/index.html'), 'nested preview route');
check(/^User-agent: \*/m.test(robots), 'robots user agent');
check(/^Disallow: \/$/m.test(robots), 'robots all routes disallowed');

// The owner's post-Stage-A PASS is narrowly scoped to the unchanged HTML and
// layout; it is NOT a source-rights, merge, deploy, or publication receipt.
// Preserve the Git content blobs of the exact artifacts that the owner reviewed.
{
  const review = JSON.parse(readFileSync(new URL('stage-a-editorial-layout-owner-pass.draft.json', root), 'utf8'));
  const src = review.exactReviewedSource;
  const dep = review.exactReviewedIsolatedDeployment;
  const approval = review.passedScope;
  const gitBlobSha = (source) => {
    const bytes = Buffer.from(source, 'utf8');
    return createHash('sha1')
      .update(Buffer.from('blob ' + bytes.length + '\0', 'utf8'))
      .update(bytes).digest('hex');
  };
  equal(review.schemaVersion, 'stage-a-independent-macro-weekly-editorial-layout-review-v1',
    'review receipt contract');
  equal(review.stage, 'A', 'review Stage A');
  equal(review.recordedDate, '2026-10-30', 'owner dated PASS');
  check(review.reviewSource === 'owner_explicit_pass_in_current_conversation', 'owner PASS source');
  equal(review.reviewTimestampUtc, null, 'do not invent precise owner review time');
  equal(src.repo, 'usdimpact/usd-impact-site', 'expected repo');
  equal(src.reviewedPr, 1019, 'reviewed draft PR');
  equal(src.reviewedGitCommitSha, '77551873f9d7a68cfeec11804dc0237cdc0154ac',
    'exact reviewed Git commit');
  equal(src.htmlGitBlobSha, gitBlobSha(article), 'reviewed article content must not change');
  equal(src.vercelConfigGitBlobSha,
    gitBlobSha(readFileSync(new URL('vercel.json', previewRoot), 'utf8')),
    'reviewed noindex/security config must not change');
  equal(src.robotsGitBlobSha, gitBlobSha(robots), 'reviewed robots must not change');
  equal(dep.projectId, 'prj_rJ1pQKXoNAbrjMivScWeRYNfsAJa', 'isolated review project');
  equal(dep.deploymentId, 'dpl_5qTFTzp6FaEMrqWvwLqFpmc3ESxT',
    'isolated deployment reviewed');
  equal(dep.platformDeploymentTarget, 'production',
    'preserve isolated project target classification without concealing it');
  check(dep.productionTargetIsIsolatedProjectOnly === true, 'not public site Production');
  check(dep.approvedPreviewTargetAchieved === false, 'not an actual Preview-target deployment');
  check(dep.deploymentTargetMismatchIsKnown === true, 'target mismatch must stay visible');
  check(dep.gitConnectionPresent === false, 'no Git-integrated deployment');
  equal(dep.authenticationSetting, 'all', 'all deployments require Vercel authentication');
  equal(dep.anonymousDirectReviewUrl, 'login_required', 'anonymous review URL denied');
  equal(dep.anonymousAliasRootUrl, 'login_required', 'anonymous alias denied');
  check(dep.authenticatedBrowserRenderingVerifiedByConnector === false,
    'owner PASS does not pretend to be connector-render QA');
  check(dep.ownerAttestsEditorialAndLayoutReviewPass === true, 'owner PASS received');
  check(approval.editorialCopyAndLayout === true, 'editorial/layout only approval');
  for (const [name, allowed] of Object.entries(approval)) {
    if (name === 'editorialCopyAndLayout') continue;
    equal(allowed, false, 'owner did not approve release-related scope: ' + name);
  }
  check(review.releaseAuthorized === false, 'the new review record cannot release');
  check(review.unchangedHolds.independentEditorialSourceRights === 'HOLD',
    'independent source rights remain held');
  check(review.unchangedHolds.publicUsdImpactProduction === 'HOLD',
    'public Production remains held');
  check(review.unchangedHolds.siteScoreGate === 'hold' &&
    review.unchangedHolds.pipelineScoreGate === 'hold', 'original Score rights remain held');
  equal(review.unchangedHolds.independentWeekliesActuallyPublished, 0,
    'private review is not a published independent Weekly');
  equal(review.unchangedHolds.independentMonthlyCountFromEligibleWeeklies, 0,
    'private review cannot count towards Monthly');
  check(review.frozenQaBaseline.exactReviewHtmlMustNotChangeWithoutNewEditorialReview,
    'any future visual change requires another editorial PASS');
  check(owner.authorizations.mergeToProtectedMain === false &&
    owner.authorizations.publicPublication === false &&
    owner.authorizations.productionDeployment === false, 'main release gates untouched');
}

console.log('Stage A independent Macro Weekly static preview: '+tests+' checks passed. Publication and source rights remain HOLD.');
