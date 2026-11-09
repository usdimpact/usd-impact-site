#!/usr/bin/env python3
"""Loopback-only negative GA4 Preview browser test; fictional ID, no external requests."""
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import shutil
import threading

from playwright.sync_api import sync_playwright

assert os.environ.get("VERCEL_ENV") == "preview", "Refuse to run outside synthetic Preview target"
assert os.environ.get("PUBLIC_GA4_MEASUREMENT_ID") == "G-TEST1234"
dist = Path(__file__).resolve().parents[1] / "dist"
for filename in ("privacy/index.html", "terms/index.html", "es/privacy/index.html"):
    assert (dist / filename).is_file(), f"Compiled Preview page missing: {filename}"

class QuietStatic(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(dist), **kwargs)
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(("127.0.0.1", 0), QuietStatic)
server.daemon_threads = True
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f"http://127.0.0.1:{server.server_port}"
binary = next((shutil.which(v) for v in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser") if shutil.which(v)), None)
assert binary, "Chrome/Chromium unavailable on isolated CI runner"

attempted_google = []
other_blocked = []
tests = 0
def fixture(browser):
    context = browser.new_context(service_workers="block")
    page = context.new_page()
    def route(interception):
        url = interception.request.url
        if url.startswith(origin + "/"):
            interception.continue_()
            return
        if urlsplit(url).hostname in {
            "www.googletagmanager.com",
            "www.google-analytics.com",
            "region1.google-analytics.com",
        }:
            attempted_google.append(urlsplit(url).hostname)
        else:
            other_blocked.append(urlsplit(url).hostname)
        interception.abort()
    context.route("**/*", route)
    return context, page

def state(page):
    return page.evaluate("""() => ({
      allowed: window.USDImpactConsent?.analyticsAllowed?.(),
      preference: window.USDImpactConsent?.preference?.(),
      available: document.getElementById('privacy-consent-banner')?.dataset.analyticsEnabled,
      gaConfig: !!document.getElementById('usd-impact-ga4-config'),
      gaScript: !!document.getElementById('usd-impact-ga4-script'),
      gtagPresent: typeof window.gtag !== 'undefined'
    })""")

def navigate(page, path):
    response = page.goto(origin + path, wait_until="load", timeout=20000)
    assert response and response.status == 200, "Compiled Preview route did not serve"
    page.wait_for_function("typeof window.USDImpactConsent?.preference === 'function'", timeout=15000)
    observed = state(page)
    assert not observed["gaConfig"] and not observed["gaScript"] and not observed["gtagPresent"], observed
    return observed

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=binary, headless=True,
                                    args=["--no-sandbox", "--disable-dev-shm-usage"])

        # First visit: rejecting and later accepting may not create GA4.
        ctx, page = fixture(browser)
        try:
            initial = navigate(page, "/privacy/")
            assert initial["available"] == "true" and not initial["allowed"]
            page.click("#privacy-consent-reject")
            rejected = state(page)
            assert rejected["preference"] == "denied" and not rejected["gaScript"]
            page.click("#privacy-settings-button")
            page.check("#privacy-consent-analytics")
            page.click("#privacy-consent-save")
            accepted = state(page)
            assert accepted["allowed"] and not accepted["gaScript"] and not accepted["gtagPresent"]
            page.evaluate("""() => window.dispatchEvent(new CustomEvent('usd-impact:analytics-event', {
              detail: {eventName: 'quiz_start', details: {quizId: 'synthetic-preview-test'}}
            }))""")
            assert not state(page)["gaScript"]
            continued = navigate(page, "/terms/")
            assert continued["allowed"] and not continued["gaScript"]
            tests += 1
        finally:
            ctx.close()

        # Returning visitor with a synthetically pre-granted analytics cookie.
        ctx, page = fixture(browser)
        try:
            ctx.add_cookies([{"name": "usd_impact_consent",
                              "value": "v1.analytics-granted", "url": origin + "/",
                              "sameSite": "Lax"}])
            observed = navigate(page, "/privacy/")
            assert observed["allowed"] and not observed["gaScript"]
            tests += 1
        finally:
            ctx.close()

        # Spanish stays analytics-off even if cookie says granted.
        ctx, page = fixture(browser)
        try:
            ctx.add_cookies([{"name": "usd_impact_consent",
                              "value": "v1.analytics-granted", "url": origin + "/",
                              "sameSite": "Lax"}])
            observed = navigate(page, "/es/privacy/")
            assert observed["available"] == "false" and not observed["allowed"]
            assert page.locator("#privacy-consent-accept").count() == 0
            tests += 1
        finally:
            ctx.close()
        browser.close()
finally:
    server.shutdown()

assert tests == 3
assert not attempted_google, f"Preview attempted Google requests: {attempted_google}"
print("PASS " + json.dumps({
    "cases": tests,
    "preview_compiled_browser": True,
    "ga4_network_attempts": len(attempted_google),
    "other_external_requests_blocked": len(other_blocked),
    "vendor_code_executed": False,
    "production_tested": False,
    "live_deployment_created": False
}, sort_keys=True))
