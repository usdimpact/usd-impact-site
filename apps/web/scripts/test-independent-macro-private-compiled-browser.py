#!/usr/bin/env python3
"""Private, loopback-only Chromium QA of an actual temporary Astro build."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
import json, shutil, threading

WEB=Path(__file__).resolve().parents[1]
DIST=WEB/"dist"
HTML=DIST/"internal/macro-weekly-private-qa/index.html"
OUT=WEB/".private_macro_compiled_qa"
ROOT=WEB.parents[1]
RECEIPT=ROOT/"docs/operations/independent-macro-release/first-weekly-r05-compiled-qa-wording-decision-2026-11-01.draft.json"
MANIFEST=ROOT/"docs/operations/independent-macro-release/main-integration-hold.manifest.draft.json"
assert HTML.is_file() and RECEIPT.is_file() and MANIFEST.is_file()
approval=json.loads(RECEIPT.read_text())
manifest=json.loads(MANIFEST.read_text())
assert approval["decision"]=="ACCEPT_OFFLINE_WORDING_FOR_COMPILED_QA"
assert approval["reviewedProofBlobSha"]=="61c35f8380c793c8330ca5b6402f483ec7e38710"
assert manifest["r05PrivateCompiledQaWordingDecision"]["decision"]==approval["decision"]
assert approval["finalRenderedEditorialPass"] is False
assert not approval["releaseAuthorized"] and not any(approval["releasePermissions"].values())
source=HTML.read_text(encoding="utf-8")
for marker in ['data-private-appearance-proof="true"','data-release-authorized="false"',
               'data-final-rendered-owner-pass="false"','data-ai-disclosure-proposed="true"',
               'two voting dissenters, Lisa D. Cook and Beth M. Hammack']:
    assert marker in source, "Compiled markup missing: "+marker
for sitemap in DIST.rglob("sitemap*.xml"):
    assert "macro-weekly-private-qa" not in sitemap.read_text(), "QA route leaked into local sitemap"

class Quiet(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(DIST),**kwargs)
    def log_message(self,*args):
        pass

server=ThreadingHTTPServer(("127.0.0.1",0),Quiet)
threading.Thread(target=server.serve_forever,daemon=True).start()
origin="http://127.0.0.1:"+str(server.server_port)
chrome=next((shutil.which(x) for x in ["google-chrome","google-chrome-stable","chromium","chromium-browser"] if shutil.which(x)),None)
assert chrome, "No runner Chrome/Chromium found"
OUT.mkdir(parents=True,exist_ok=True)
shutil.copyfile(HTML,OUT/"compiled-private-review.html")
expected=["summary","timeline","transmission","mistakes","watch","sources","compliance"]
results=[]
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=chrome,headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        try:
            for label,width,height in [("desktop",1440,900),("tablet",768,960),("mobile",390,844)]:
                ctx=browser.new_context(viewport={"width":width,"height":height},service_workers="block")
                page=ctx.new_page()
                blocked=[]
                errors=[]
                page.on("pageerror",lambda err:errors.append(str(err)[:200]))
                def allow_loopback(route):
                    if route.request.url.startswith(origin+"/"):
                        route.continue_()
                    else:
                        blocked.append(urlsplit(route.request.url).hostname or "non-http")
                        route.abort()
                ctx.route("**/*",allow_loopback)
                response=page.goto(origin+"/internal/macro-weekly-private-qa/",wait_until="domcontentloaded",timeout=30000)
                assert response and response.status==200, label+": compiled QA page not 200"
                page.locator('[data-private-appearance-proof="true"]').wait_for(timeout=10000)
                found=page.evaluate("""() => {
                  const r=document.querySelector('[data-private-appearance-proof="true"]');
                  const a=r?.querySelector('article.content');
                  const n=a?.querySelector('[data-ai-disclosure-proposed="true"]');
                  const links=[...(a?.querySelectorAll('a[href^="https://"]')||[])]
                    .filter(x=>/(federalreserve|bea|bls)\.gov/.test(new URL(x.href).hostname));
                  return {
                    article:!!a,visibleDisclosure:!!n&&n.getBoundingClientRect().height>0,
                    sections:[...(a?.querySelectorAll('section[aria-labelledby]')||[])]
                      .map(x=>x.getAttribute('aria-labelledby')),
                    noindex:[...document.querySelectorAll('meta[name="robots"]')].some(x=>x.content.includes('noindex')),
                    canonicalCount:document.querySelectorAll('link[rel="canonical"]').length,
                    release:r?.dataset.releaseAuthorized,renderedPass:r?.dataset.finalRenderedOwnerPass,
                    indexing:r?.dataset.indexingAuthorized,issuerLinks:links.length,
                    fomc:a?.innerText.includes('two voting dissenters, Lisa D. Cook and Beth M. Hammack'),
                    advice:a?.innerText.includes('not financial, investment, trading, legal or tax advice'),
                    operator:document.body.innerText.includes('KELA LEADS S.R.L.'),
                    terms:!!document.querySelector('a[href="/terms/"]'),
                    privacy:!!document.querySelector('a[href="/privacy/"]'),
                    overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)
                  };
                }""")
                assert found["article"] and found["visibleDisclosure"] and found["sections"]==expected, label+": missing article/disclosure/sections"
                assert found["noindex"] and found["canonicalCount"]==0, label+": indexing metadata"
                assert found["release"]=="false" and found["renderedPass"]=="false" and found["indexing"]=="false", label+": release authority leaked"
                assert all(found[x] for x in ("fomc","advice","operator","terms","privacy")), label+": wording or legal links missing"
                assert found["issuerLinks"]==5 and found["overflow"]==0, label+": source count or horizontal overflow"
                assert not blocked and not errors, label+": external request or page errors "+str((blocked,errors))
                page.screenshot(path=str(OUT/("macro-compiled-"+label+".png")),full_page=True,animations="disabled")
                results.append({"viewport":label,"width":width,"height":height,"assertions":found,"externalRequests":blocked,"pageErrors":errors})
                print("PASS compiled Astro private "+label)
                ctx.close()
        finally:
            browser.close()
finally:
    server.shutdown()
assert len(results)==3
report={"result":"PASS_COMPILED_ASTRO_REVIEW_ONLY","sourceProofBlobSha":approval["reviewedProofBlobSha"],
        "releaseAuthorized":False,"ownerFinalRenderedEditorialPass":False,"deploymentOccurred":False,
        "network":"loopback-only","viewports":results}
(OUT/"qa-results.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
print("RESULT "+json.dumps({"compiledAstro":True,"viewports":3,"publicRoute":False,"production":False}))
