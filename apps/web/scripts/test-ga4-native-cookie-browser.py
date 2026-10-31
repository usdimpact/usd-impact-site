#!/usr/bin/env python3
"""Draft-only native first-party cookie QA. Never contact real Google or Production."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import json
import re
import shutil
import threading
from playwright.sync_api import sync_playwright

web = Path(__file__).resolve().parents[1]
def source(file, pattern):
    text = (web / "src/components" / file).read_text(encoding="utf8")
    match = re.search(pattern, text, re.S)
    assert match, "Astro source extraction failed"
    return match.group(1)

ga = source("GoogleAnalyticsClient.astro", r'<script define:vars=\{\{ measurementId \}\}>(.*?)</script>')
consent = source("ConsentClient.astro", r"<script>(.*?)</script>")
guard = """    // Astro processes ConsentClient's ordinary script as a deferred module.
    // This define:vars script is inline and can run first. Do not expire a
    // returning member's GA cookies before the consent API has initialized.
    // Fail closed while waiting; ConsentClient emits consent-ready afterward.
    if (typeof window.USDImpactConsent?.analyticsAllowed === 'function') {
      applyConsent();
    } else {
      window[DISABLE_KEY] = true;
    }"""
assert ga.count(guard) == 1, "Unexpected GA4 implementation; stop instead of guessing"
old_ga = ga.replace(guard, "    applyConsent();")

html = """<!doctype html><html><head><meta charset="utf-8">
<script>const measurementId="G-TEST1234";
__GA__
window.__initial={
  noConsentApi:typeof window.USDImpactConsent==="undefined",
  disabled:window["ga-disable-G-TEST1234"]===true,
  hasGa:document.cookie.split(";").some(s=>s.trim().startsWith("_ga=")),
  hasTag:!!document.getElementById("usd-impact-ga4-script")
};
</script></head><body>
<div id="privacy-consent-banner" data-analytics-enabled="__ENABLED__" hidden>
  <button id="privacy-consent-accept">Accept</button>
  <button id="privacy-consent-reject">Reject</button>
</div>
<dialog id="privacy-consent-dialog">
  <input type="checkbox" id="privacy-consent-analytics">
  <button id="privacy-consent-save">Save</button>
  <button id="privacy-consent-close">Close</button>
</dialog>
<button id="privacy-settings-button">Privacy settings</button>
<script type="module" src="/consent.js"></script>
</body></html>"""

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path=urlsplit(self.path).path
        if path=="/consent.js":
            text="await new Promise(r=>setTimeout(r,120));\n"+consent
            mime="application/javascript"
        elif path in ("/home","/privacy","/denied","/disabled","/baseline"):
            js=old_ga if path=="/baseline" else ga
            text=html.replace("__GA__",js).replace("__ENABLED__","false" if path=="/disabled" else "true")
            mime="text/html"
        else:
            self.send_error(404)
            return
        body=text.encode()
        self.send_response(200)
        self.send_header("Content-Type",mime+"; charset=utf-8")
        self.send_header("Cache-Control","no-store")
        self.send_header("Content-Length",str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def log_message(self,*args):
        pass  # No request/cookie logs.

server=ThreadingHTTPServer(("127.0.0.1",0),Handler)
server.daemon_threads=True
threading.Thread(target=server.serve_forever,daemon=True).start()
origin="http://127.0.0.1:"+str(server.server_port)
binary=next((shutil.which(v) for v in ("google-chrome","google-chrome-stable","chromium","chromium-browser") if shutil.which(v)),None)
assert binary, "Chrome/Chromium executable unavailable"

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(executable_path=binary,headless=True,args=["--disable-dev-shm-usage","--no-sandbox"])
    def fixture():
        ctx=browser.new_context(service_workers="block")
        page=ctx.new_page()
        seen={"google_mocked":0,"unexpected":0}
        def route(request):
            url=request.request.url
            host=urlsplit(url).hostname
            if url.startswith(origin+"/"):
                request.continue_()
            elif host in ("www.googletagmanager.com","www.google-analytics.com"):
                seen["google_mocked"]+=1
                request.fulfill(status=200,content_type="application/javascript",body="/* blocked by controlled QA mock */")
            else:
                seen["unexpected"]+=1
                request.abort()
        ctx.route("**/*",route)
        return ctx,page,seen
    def seed(ctx,name,value):
        ctx.add_cookies([{"name":name,"value":value,"url":origin+"/","sameSite":"Lax"}])
    def names(ctx):
        return {c["name"] for c in ctx.cookies(origin+"/")}
    def cookie(ctx,name):
        return next((c["value"] for c in ctx.cookies(origin+"/") if c["name"]==name),None)
    def visit(page,path):
        page.goto(origin+path,wait_until="load",timeout=15000)
        page.wait_for_function("typeof window.USDImpactConsent?.preference === 'function'",timeout=7000)
    def state(page):
        return page.evaluate("""() => ({
          pre:window.__initial,
          preference:window.USDImpactConsent.preference(),
          allowed:window.USDImpactConsent.analyticsAllowed(),
          disabled:window["ga-disable-G-TEST1234"],
          tagCount:document.querySelectorAll("#usd-impact-ga4-script").length,
          denied:(window.dataLayer||[]).some(x=>x[0]==="consent"&&x[1]==="update"&&x[2]?.analytics_storage==="denied"),
          adsDenied:(window.dataLayer||[]).filter(x=>x[0]==="consent").every(x=>
           x[2]?.ad_storage==="denied"&&x[2]?.ad_user_data==="denied"&&x[2]?.ad_personalization==="denied")
        })""")
    def no_external(seen):
        assert seen["unexpected"]==0, "Unexpected outbound request attempt"

    passed=0
    def run(label,callback):
        global passed
        callback()
        passed+=1
        print("PASS: "+label)

    def reject_first():
        ctx,page,seen=fixture()
        try:
            visit(page,"/home")
            s=state(page)
            assert s["pre"]=={"noConsentApi":True,"disabled":True,"hasGa":False,"hasTag":False}
            assert s["preference"]=="unset" and not s["allowed"] and not s["tagCount"]
            assert seen["google_mocked"]==0
            page.click("#privacy-consent-reject")
            s=state(page)
            assert s["preference"]=="denied" and s["disabled"]
            assert "_ga" not in names(ctx) and "usd_impact_consent" in names(ctx)
            no_external(seen)
        finally:
            ctx.close()
    run("first visit Reject: no tag/cookies",reject_first)

    def accept_then_withdraw():
        ctx,page,seen=fixture()
        try:
            visit(page,"/home")
            page.click("#privacy-consent-accept")
            assert state(page)["allowed"] and state(page)["adsDenied"]
            seed(ctx,"_ga","controlled-A")
            seed(ctx,"_ga_TEST1234","controlled-B")
            visit(page,"/privacy")
            s=state(page)
            assert s["pre"]["hasGa"] and s["pre"]["disabled"] and s["allowed"]
            assert cookie(ctx,"_ga")=="controlled-A" and cookie(ctx,"_ga_TEST1234")=="controlled-B"
            page.click("#privacy-settings-button")
            page.uncheck("#privacy-consent-analytics")
            page.click("#privacy-consent-save")
            s=state(page)
            assert s["preference"]=="denied" and s["disabled"] and s["denied"]
            assert "_ga" not in names(ctx) and "_ga_TEST1234" not in names(ctx)
            assert seen["google_mocked"]>=1
            no_external(seen)
        finally:
            ctx.close()
    run("accept, navigate with native cookies, withdraw",accept_then_withdraw)

    def already_granted():
        ctx,page,seen=fixture()
        try:
            seed(ctx,"usd_impact_consent","v1.analytics-granted")
            seed(ctx,"_ga","controlled-stable")
            seed(ctx,"_ga_TEST1234","controlled-stream")
            visit(page,"/home")
            assert state(page)["pre"]["hasGa"] and state(page)["allowed"]
            assert cookie(ctx,"_ga")=="controlled-stable"
            visit(page,"/privacy")
            assert cookie(ctx,"_ga")=="controlled-stable"
            assert cookie(ctx,"_ga_TEST1234")=="controlled-stream"
            no_external(seen)
        finally:
            ctx.close()
    run("returning opt-in: same native cookies across documents",already_granted)

    def denied_stale():
        ctx,page,seen=fixture()
        try:
            seed(ctx,"usd_impact_consent","v1.analytics-denied")
            seed(ctx,"_ga","obsolete")
            visit(page,"/denied")
            assert state(page)["pre"]["hasGa"] and not state(page)["allowed"]
            assert "_ga" not in names(ctx) and seen["google_mocked"]==0
            no_external(seen)
        finally:
            ctx.close()
    run("denied consent removes stale first-party GA cookie",denied_stale)

    def disabled_locale():
        ctx,page,seen=fixture()
        try:
            seed(ctx,"usd_impact_consent","v1.analytics-granted")
            seed(ctx,"_ga","obsolete")
            visit(page,"/disabled")
            assert not state(page)["allowed"] and not state(page)["tagCount"]
            assert "_ga" not in names(ctx) and seen["google_mocked"]==0
            no_external(seen)
        finally:
            ctx.close()
    run("analytics-disabled locale remains fail-closed",disabled_locale)

    def negative_control():
        ctx,page,seen=fixture()
        try:
            seed(ctx,"usd_impact_consent","v1.analytics-granted")
            seed(ctx,"_ga","legacy-cookie")
            visit(page,"/baseline")
            assert not state(page)["pre"]["hasGa"], "Old source did not reproduce early deletion"
            assert "_ga" not in names(ctx)
            no_external(seen)
        finally:
            ctx.close()
    run("old eager applyConsent reproduces native cookie deletion",negative_control)
    browser.close()
server.shutdown()
print("RESULT "+json.dumps({"case_count":6,"passed":passed,"all_pass":passed==6,"browser_native_cookie_jar":True,
 "production_browser_test":False,"google_vendor_code_executed":False,"google_requests_forwarded":0,
 "method":"loopback Chromium first-party cookies, exact Astro script bodies, synthetic GA4 ID"},sort_keys=True))
assert passed==6
