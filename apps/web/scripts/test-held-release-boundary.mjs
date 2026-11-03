import assert from 'node:assert/strict';
import {
  checkHeldSourceContract,
  assessGeneratedArtifacts,
  assessPublicReleaseClaim,
  HELD_SPANISH,
  EXISTING_PUBLIC_SPANISH,
} from './held-release-boundary.mjs';

assert.deepEqual(checkHeldSourceContract(), [], 'current Draft source guard must preserve existing holds');
const publicHtml = '<!doctype html><html lang="es"><head><title>Existing public</title></head><body>Published education</body></html>';
const previewHtml = '<!doctype html><html lang="es"><head><meta name="robots" content="noindex,nofollow"><title>Preview</title></head></html>';
const monthlyHtml = '<!doctype html><html lang="en"><head><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><meta name="googlebot" content="noindex,nofollow"><title>Monthly Preview</title></head></html>';
const publicPages = Object.fromEntries(EXISTING_PUBLIC_SPANISH.map(route => [route,publicHtml]));
const reviewPages = Object.fromEntries(HELD_SPANISH.map(route => [route,previewHtml]));
const sitemap = '<urlset><url><loc>https://www.usd-impact.com/es/start-here</loc></url><url><loc>https://www.usd-impact.com/es/privacy</loc></url></urlset>';
const prod = { mode:'production', pages:publicPages, sitemaps:[sitemap] };
const preview = { mode:'preview', pages:{...publicPages,...reviewPages,
  '/macro-reviews/monthly/2026-10':monthlyHtml}, sitemaps:[sitemap] };
assert.deepEqual(assessGeneratedArtifacts(prod), [], 'currently approved public Spanish pages remain unaffected');
assert.deepEqual(assessGeneratedArtifacts(preview), [], 'noindex-only Preview review pages may be built without granting release');

const requiresFailure=(name, inputs, fragment) => {
  const failures=assessGeneratedArtifacts(inputs);
  assert.ok(failures.some(f => f.includes(fragment)), name + ': expected ' + fragment + '; found ' + failures);
};
const addPage=(source, route, html) => ({...source, pages:{...source.pages, [route]:html}});
const addSitemap=(source, loc) => ({...source,
  sitemaps:[sitemap.replace('</urlset>','<url><loc>https://www.usd-impact.com' + loc + '</loc></url></urlset>')]});

// T1: exact public/review Spanish allowlist. Unknown routes must not sneak into either build.
requiresFailure('T1 unknown ES page', addPage(preview,'/es/not-authorized',previewHtml), 'Unknown Spanish');
requiresFailure('T1 unreviewed ES Daily translation', addPage(preview,'/es/news/2026-10-30',previewHtml), 'Unknown Spanish');
requiresFailure('T1 unreviewed public ES page', addPage(prod,'/es/score',previewHtml), 'Held Spanish route generated');
requiresFailure('T1 alias style ES page', addPage(prod,'/es/reports.html',previewHtml), 'Unknown Spanish');

// T2: all independent Monthly pages are Preview-only, not original Score Monthly.
// No November artifact should exist before its month closes.
requiresFailure('T2 public October Monthly',addPage(prod,'/macro-reviews/monthly/2026-10',monthlyHtml),'Monthly generated in Production');
requiresFailure('T2 extra November preview',addPage(preview,'/macro-reviews/monthly/2026-11',monthlyHtml),'Unapproved independent Monthly');

// T3/4: noindex/canonical/static sitemap checks are not a substitute for protected host authentication.
requiresFailure('T3 ES missing robots tag',addPage(preview,'/es/news','<p>noindex is not a meta tag</p>'),'missing robots noindex');
requiresFailure('T3 ES accidental canonical',addPage(preview,'/es/news',previewHtml.replace('</head>','<link rel="canonical" href="https://www.usd-impact.com/es/news"></head>')),'public canonical');
requiresFailure('T3 Monthly missing Googlebot noindex',addPage(preview,'/macro-reviews/monthly/2026-10',monthlyHtml.replace(/<meta name="googlebot"[^>]+>/,'')),'strict Preview');
requiresFailure('T3 Monthly canonical',addPage(preview,'/macro-reviews/monthly/2026-10',monthlyHtml.replace('</head>','<link rel="canonical" href="https://www.usd-impact.com/macro-reviews/monthly/2026-10"></head>')),'strict Preview');
requiresFailure('T3 missing sitemap evidence',{...preview,sitemaps:[]},'Missing generated sitemap');
requiresFailure('T4 sitemap ES leak',addSitemap(prod,'/es/reports'),'leaked into sitemap');
requiresFailure('T4 sitemap October Monthly leak',addSitemap(preview,'/macro-reviews/monthly/2026-10'),'leaked into sitemap');
requiresFailure('T4 sitemap future Monthly leak',addSitemap(preview,'/macro-reviews/monthly/2026-11'),'leaked into sitemap');
requiresFailure('T4 independent Weekly noindex-first',addSitemap(prod,'/macro-reviews/weekly/2026-10-30'),'leaked into sitemap');
assert.ok(assessGeneratedArtifacts({mode:'not-a-real-mode',pages:publicPages,sitemaps:[sitemap]}).length);
assert.ok(assessGeneratedArtifacts({mode:'production',pages:null,sitemaps:[sitemap]}).length);

// T6/7: a synthetic self-attested release receipt cannot override H-15/H-16 or Score rights.
// A real public release needs a distinct, owner-approved exact-head artifact and external gates.
const sha='a'.repeat(40);
const completeFakeReceipts=Object.fromEntries(
  ['owner','editorial','rights','accessibility','security','protectedPreview']
    .map(area => [area,{approved:true,sha}])
);
const fakeRelease={target:'production',candidateSha:sha,checkedOutSha:sha,
  routes:['/es/reports','/macro-reviews/monthly/2026-10'],receipts:completeFakeReceipts};
const disposition=assessPublicReleaseClaim(fakeRelease);
assert.equal(disposition.authorized,false);
assert.equal(disposition.disposition,'HOLD');
assert.ok(disposition.blockers.includes('H15_H16_public_release_hold'));
assert.ok(disposition.blockers.includes('score_derived_reports_rights_hold'));
assert.ok(assessPublicReleaseClaim({...fakeRelease, checkedOutSha:'b'.repeat(40)})
  .blockers.includes('candidate_and_verified_commit_mismatch'));
assert.ok(assessPublicReleaseClaim({...fakeRelease, candidateSha:'not-a-sha'})
  .blockers.includes('invalid_exact_commit_sha'));
assert.ok(assessPublicReleaseClaim({...fakeRelease, receipts:{}})
  .blockers.includes('missing_exact_sha_rights'));
assert.ok(assessPublicReleaseClaim({...fakeRelease, routes:['/es/new-public-film']})
  .blockers.includes('unreviewed_public_release_route'));
assert.ok(assessPublicReleaseClaim({...fakeRelease, routes:[], target:'preview'})
  .blockers.includes('missing_exact_requested_routes'));
assert.ok(assessPublicReleaseClaim({...fakeRelease, routes:[]}).authorized === false);

console.log('Release-boundary HOLD negative fixtures PASS: T1/T2/T3/T4/T6/T7, exact SHA, Score-derived rights, sitemaps, missing robots, malformed mode');
