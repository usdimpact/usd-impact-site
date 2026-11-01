#!/usr/bin/env python3
"""Private release-shaped Macro Weekly QA. No public Astro route, deploy or login.

The sole QA route is injected inside a disposable GitHub Actions runner.
Do not collect cookie values, tokens, network payloads or other private data.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
import hashlib
import json
import shutil
import threading

WEB = Path(__file__).resolve().parents[1]
ROOT = WEB.parents[1]
DIST = WEB / "dist"
PAGE = DIST / "internal/macro-weekly-release-shape-qa/index.html"
OUT = WEB / ".private_macro_release_shape_evidence"
SPEC = ROOT / "docs/operations/independent-macro-release/first-weekly-release-shaped-private-qa-2026-11-01.draft.json"
ORIGINAL = WEB / "src/data/independent-macro-review/weekly-2026-10-30.release-candidate.html"
PRIVACY = WEB / "src/pages/privacy.md"
DRAFT_ROUTE = WEB / "src/pages/macro-reviews/weekly/[date].astro"
COMPONENT = WEB / "src/components/IndependentMacroWeeklyReleaseShapeHold.astro"
OWNER_PASS = ROOT / "docs/operations/independent-macro-release/first-weekly-r05-x01-private-compiled-owner-visual-pass-2026-11-01.draft.json"
NOTICE_DRAFT = ROOT / "docs/operations/independent-macro-release/ga4-transfer-retention-proposed-notice-2026-11-01.draft.md"

def git_sha(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\x00" + data).hexdigest()

def ensure(ok, why):
    if not ok:
        raise AssertionError(why)

for f in [PAGE, SPEC, ORIGINAL, PRIVACY, DRAFT_ROUTE, COMPONENT, OWNER_PASS, NOTICE_DRAFT]:
    ensure(f.is_file(), "Required source missing: " + f.name)

spec = json.loads(SPEC.read_text(encoding="utf-8"))
owner = json.loads(OWNER_PASS.read_text(encoding="utf-8"))
source = spec["contentProvenance"]
display = spec["proposedPresentation"]
ensure(spec["schemaVersion"] == "usd-impact-independent-macro-release-shaped-private-qa-v1", "Unexpected review spec")
ensure(git_sha(ORIGINAL.read_bytes()) == source["originalCandidateGitBlobSha"], "Owner-frozen article SHA changed")
ensure(git_sha(PRIVACY.read_bytes()) == source["privacyNoticeProductionBlobShaBeforeReview"],
       "Live privacy source changed in a review-only PR")
ensure("return [];" in DRAFT_ROUTE.read_text(encoding="utf-8"), "Production Macro route unexpectedly enabled")
ensure(owner["ownerAttestedPrivateReview"]["r05CompiledCandidateWordingAndPresentationPass"],
       "Missing original private R05 owner PASS")
ensure(owner["ownerAttestedPrivateReview"]["x01VisibleAiAssistanceDisclosurePlacementPrivateReviewPass"],
       "Missing original private X01 owner PASS")
ensure(owner["reviewIdentity"]["reviewedOfflineHtmlProofGitBlobSha"] ==
       source["ownerReviewedOfflineHtmlProofGitBlobSha"], "Owner-approved proof identity mismatch")
ensure(display["firstPublicationUtc"] is None and not display["showFirstPublishedLabel"] and
       not display["proposedPageRouteIsCommitted"] and display["noindex"] and
       not display["canonicalAllowed"] and not display["structuredArticleDatePublishedAllowed"],
       "Private candidate improperly contains publication/indexing metadata")
ensure(all(v is False for v in spec["permissions"].values()), "Release permission in review spec")
ensure(not spec["ownerAndPrivacy"]["actualPublicReleaseRenderedEditorialPass"] and
       not spec["ownerAndPrivacy"]["qualifiedPrivacyAndRightsReviewCompleted"],
       "Owner or legal public release approval improperly claimed")
ensure("DRAFT ONLY" in NOTICE_DRAFT.read_text(encoding="utf-8"), "Privacy amendment incorrectly released")
html = PAGE.read_text(encoding="utf-8")
for fragment in [
    'data-release-shaped-review="true"',
    'data-release-authorized="false"',
    'data-indexing-authorized="false"',
    'data-first-publication-recorded="false"',
    'data-final-rendered-owner-pass="false"',
    'data-original-score-rights-authorized="false"',
    'NONPUBLIC RELEASE-SHAPED REVIEW',
    'two voting dissenters, Lisa D. Cook and Beth M. Hammack',
    'data-ai-disclosure-proposed="true"',
    'noindex'
]:
    ensure(fragment in html, "Compiled release-shape markup missing: " + fragment)

for sitemap in DIST.rglob("sitemap*.xml"):
    ensure("macro-weekly-release-shape-qa" not in sitemap.read_text(encoding="utf-8"),
           "Disposable QA path entered local sitemap")

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(DIST), **kw)
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = "http://127.0.0.1:" + str(server.server_port)
chrome = next((shutil.which(s) for s in
               ("google-chrome","google-chrome-stable","chromium","chromium-browser") if shutil.which(s)), None)
ensure(chrome, "Chrome/Chromium not found on isolated runner")
OUT.mkdir(parents=True, exist_ok=True)
shutil.copyfile(PAGE, OUT / "compiled-release-shape-review.html")
results = []
sizes = [("desktop",1440,900), ("tablet",768,960), ("mobile",390,844), ("compact",320,720)]
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=chrome, headless=True,
                                    args=["--no-sandbox","--disable-dev-shm-usage"])
        try:
            for label,width,height in sizes:
                context = browser.new_context(viewport={"width":width,"height":height},
                                              service_workers="block",locale="en-US")
                page = context.new_page()
                blocked = []
                errors = []
                page.on("pageerror", lambda error: errors.append(type(error).__name__))
                def gate(route):
                    if route.request.url.startswith(origin + "/"):
                        route.continue_()
                    else:
                        # Count only hostnames; no URL query strings, payloads or identifiers.
                        blocked.append(urlsplit(route.request.url).hostname or "non-http")
                        route.abort()
                context.route("**/*", gate)
                response=page.goto(origin+"/internal/macro-weekly-release-shape-qa/",
                                   wait_until="domcontentloaded",timeout=40000)
                ensure(response and response.status==200,label+": ephemeral release-shaped page not 200")
                page.locator('[data-release-shaped-review="true"]').wait_for(timeout=10000)
                observed=page.evaluate(r"""() => {
                  const root=document.querySelector('[data-release-shaped-review="true"]');
                  const article=root?.querySelector("article.content");
                  const notice=article?.querySelector('[data-ai-disclosure-proposed="true"]');
                  const official=[...(article?.querySelectorAll('a[href^="https://"]')||[])]
                    .filter(a=>/(federalreserve|bea|bls)\.gov/.test(new URL(a.href).hostname));
                  const daily=[...(article?.querySelectorAll('a[href]')||[])]
                    .filter(a=>/^\/news\/2026-10-(26|27|28|29|30)\/?$/.test(new URL(a.href).pathname));
                  return {
                    root:!!root,article:!!article,noticeInside:!!notice&&article.contains(notice),
                    noticeVisible:!!notice&&notice.getBoundingClientRect().height>0,
                    sections:[...(article?.querySelectorAll('section[aria-labelledby]')||[])]
                      .map(x=>x.getAttribute('aria-labelledby')),
                    originalCoverageEnd:root?.dataset.originalCoverageEnd,
                    noFirstPublicationDate:root?.dataset.firstPublicationRecorded==="false" &&
                      document.querySelectorAll('meta[property="article:published_time"],meta[itemprop="datePublished"],time[pubdate]').length===0,
                    noArticleStructuredData:document.querySelectorAll('script[type="application/ld+json"]').length===0,
                    title:document.title,
                    description:document.querySelector('meta[name="description"]')?.content,
                    noindex:[...document.querySelectorAll('meta[name="robots"]')].some(x=>x.content.includes('noindex')),
                    canonical:document.querySelectorAll('link[rel="canonical"]').length,
                    release:root?.dataset.releaseAuthorized,index:root?.dataset.indexingAuthorized,
                    final:root?.dataset.finalRenderedOwnerPass,score:root?.dataset.originalScoreRightsAuthorized,
                    holdBanner:!!root.querySelector('[data-hold-banner="true"]'),
                    issuerLinks:new Set(official.map(a=>a.href)).size,
                    dailyLinks:new Set(daily.map(a=>new URL(a.href).pathname.replace(/\/$/,''))).size,
                    fomc:article?.innerText.includes('two voting dissenters, Lisa D. Cook and Beth M. Hammack'),
                    disclaimer:article?.innerText.includes('not financial, investment, trading, legal or tax advice'),
                    nonendorsement:article?.innerText.includes('No agency endorses this page'),
                    footerOperator:document.body.innerText.includes('Operated by KELA LEADS S.R.L.'),
                    privacyLink:!!document.querySelector('footer a[href="/privacy/"]'),
                    termsLink:!!document.querySelector('footer a[href="/terms/"]'),
                    footerSettings:!!document.querySelector('#privacy-settings-button'),
                    horizontalOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)
                  };
                }""")
                ensure(observed["root"] and observed["article"] and observed["noticeInside"] and
                       observed["noticeVisible"],label+": article or AI notice missing")
                ensure(observed["sections"]==display["expectedSectionIds"],label+": editorial section order")
                ensure(observed["originalCoverageEnd"]==display["coverageEnd"] and
                       observed["noFirstPublicationDate"] and observed["noArticleStructuredData"],
                       label+": unearned publication date or schema")
                ensure(observed["title"]==display["headline"] and
                       observed["description"]==display["description"],label+": candidate metadata mismatch")
                ensure(observed["noindex"] and observed["canonical"]==0,label+": index/canonical leak")
                ensure(observed["release"]=="false" and observed["index"]=="false" and
                       observed["final"]=="false" and observed["score"]=="false" and observed["holdBanner"],
                       label+": unapproved release control")
                ensure(observed["issuerLinks"]==display["expectedIssuerLinks"] and
                       observed["dailyLinks"]==display["expectedDailyLinks"],label+": link inventory drift")
                ensure(all(observed[key] for key in ("fomc","disclaimer","nonendorsement","footerOperator",
                             "privacyLink","termsLink","footerSettings")),label+": editorial/legal text or footer missing")
                ensure(observed["horizontalOverflow"]==0,label+": horizontal overflow")
                ensure(not blocked and not errors,label+": unauthorized external request or JS error")
                page.locator("#privacy-consent-reject").click(timeout=10000)
                page.locator("#privacy-consent-banner").wait_for(state="hidden",timeout=10000)
                page.locator('article.content [data-ai-disclosure-proposed="true"]').scroll_into_view_if_needed(timeout=10000)
                visible=page.evaluate("""() => {
                  const n=document.querySelector('article.content [data-ai-disclosure-proposed="true"]');
                  const r=n.getBoundingClientRect();
                  const x=Math.min(innerWidth-2,Math.max(1,r.left+r.width/2));
                  const y=Math.min(innerHeight-2,Math.max(1,r.top+Math.min(r.height/2,innerHeight/2)));
                  const hit=document.elementFromPoint(x,y);
                  return !!hit&&(hit===n||n.contains(hit));
                }""")
                ensure(visible,label+": AI notice obscured after analytics rejection")
                ensure(page.evaluate("() => window.USDImpactConsent?.analyticsAllowed?.() === false"),
                       label+": analytics consent not denied")
                ensure(not blocked and not errors,label+": blocked external requests/errors after rejection")
                page.screenshot(path=str(OUT/("release-shaped-"+label+"-after-reject.png")),
                                full_page=True,animations="disabled")
                results.append({"viewport":label,"width":width,"height":height,
                                "checks":observed,"disclosureUnobstructed":visible,
                                "consent":"denied","blockedExternalRequests":len(blocked),
                                "javascriptErrors":len(errors)})
                print("PASS isolated release-shaped Astro " + label + " noindex/final-hold/footer/AI")
                context.close()
        finally:
            browser.close()
finally:
    server.shutdown()
ensure(len(results)==4,"All four viewports required")
report={
 "status":"PASS_RELEASE_SHAPED_PRIVATE_RENDER_ONLY_NOT_PUBLICATION_AUTHORIZATION",
 "compiledAstro":True,"originalArticleBlob":source["originalCandidateGitBlobSha"],
 "ownerReviewedOfflineProofBlob":source["ownerReviewedOfflineHtmlProofGitBlobSha"],
 "firstPublishedUtc":None,"publicRouteAuthorized":False,"indexingAuthorized":False,
 "finalPublicOwnerPass":False,"legalClearance":False,"productionDeploy":False,
 "authOrCustomerDataAccess":False,"externalNetworkRequestsAllowed":False,"viewports":results
}
(OUT/"qa-results.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
print("RESULT "+json.dumps({"pass":True,"viewports":len(results),"noindex":True,
                           "sourceArticleUnchanged":True,"publicRelease":False,
                           "datePublished":False,"externalNetworkRequests":0}))
