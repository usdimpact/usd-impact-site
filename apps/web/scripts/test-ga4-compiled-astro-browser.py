#!/usr/bin/env python3
"""Offline native-cookie QA of the actual compiled Astro pages.

Only 127.0.0.1 is served. Synthetic GA4 measurement ID, synthetic cookies,
blocked Google requests, no user data, no Production and no deployment.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import json
import shutil
import threading

from playwright.sync_api import sync_playwright

WEB = Path(__file__).resolve().parents[1]
DIST = WEB / "dist"
PAGES = ["privacy/index.html", "terms/index.html", "es/privacy/index.html"]
for relative in PAGES:
    assert (DIST / relative).is_file(), f"Expected compiled Astro route missing: {relative}"
home = (DIST / "privacy/index.html").read_text(encoding="utf-8")
assert "G-TEST1234" in home, "Synthetic QA measurement ID missing from compiled HTML"
assert "id=\"privacy-consent-banner\"" in home
assert "id=\"privacy-settings-button\"" in home
assert "googletagmanager.com" in home
assert "usd-impact:consent-ready" in home, "Consent listener not present in compiled GA4 code"
assert "if (typeof window.USDImpactConsent?.analyticsAllowed === 'function')" in home, "Proposed initialization guard absent from compiled output"
assert "type=\"module\"" in home, "Processed Astro module script not found"

class QuietStatic(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(("127.0.0.1", 0), QuietStatic)
server.daemon_threads = True
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f"http://127.0.0.1:{server.server_port}"
chrome = next((shutil.which(name) for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser") if shutil.which(name)), None)
assert chrome, "Chrome missing from isolated Actions runner"

passed = 0
google_mocked_total = 0
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path=chrome, headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"]
    )
    def fixture():
        ctx = browser.new_context(service_workers="block")
        page = ctx.new_page()
        observed = {"google_mocked": 0, "other_external": 0}
        def handle(route):
            url = route.request.url
            host = urlsplit(url).hostname
            if url.startswith(origin + "/"):
                route.continue_()
            elif host in {"www.googletagmanager.com", "www.google-analytics.com", "region1.google-analytics.com"}:
                observed["google_mocked"] += 1
                route.fulfill(status=200, content_type="application/javascript",
                              body="/* synthetic QA: Google vendor code not loaded */")
            else:
                observed["other_external"] += 1
                route.abort()
        ctx.route("**/*", handle)
        return ctx, page, observed
    def seed(ctx, name, value):
        ctx.add_cookies([{"name": name, "value": value, "url": origin + "/", "sameSite": "Lax"}])
    def names(ctx):
        return {c["name"] for c in ctx.cookies(origin)}
    def value(ctx, name):
        return next((c["value"] for c in ctx.cookies(origin) if c["name"] == name), None)
    def navigate(page, path):
        response = page.goto(origin + path, wait_until="load", timeout=20000)
        assert response and response.status == 200, f"Generated Astro page not 200: {path}"
        page.wait_for_function(
            "typeof window.USDImpactConsent?.preference === 'function'", timeout=15000
        )
    def state(page):
        return page.evaluate("""() => ({
          enabled: document.getElementById('privacy-consent-banner')?.dataset.analyticsEnabled,
          preference: window.USDImpactConsent.preference(),
          allowed: window.USDImpactConsent.analyticsAllowed(),
          disabled: window['ga-disable-G-TEST1234'],
          count: document.querySelectorAll('#usd-impact-ga4-script').length,
          events: (window.dataLayer || []).filter(x => x[0] === 'event').length,
          denied: (window.dataLayer || []).some(x =>
             x[0] === 'consent' && x[1] === 'update' && x[2]?.analytics_storage === 'denied'),
          adsDenied: (window.dataLayer || []).filter(x => x[0] === 'consent').every(x =>
             x[2]?.ad_storage === 'denied' &&
             x[2]?.ad_user_data === 'denied' &&
             x[2]?.ad_personalization === 'denied')
        })""")
    def guard(obs):
        assert obs["other_external"] == 0, "Unexpected external request attempted"
    def run(label, func):
        global passed, google_mocked_total
        n = func()
        google_mocked_total += n
        passed += 1
        print("PASS: " + label)

    def before_consent_reject():
        ctx, page, obs = fixture()
        try:
            navigate(page, "/privacy/")
            s = state(page)
            assert s["enabled"] == "true" and s["preference"] == "unset"
            assert s["disabled"] is True and not s["allowed"] and s["count"] == 0
            assert obs["google_mocked"] == 0
            page.click("#privacy-consent-reject")
            s = state(page)
            assert s["preference"] == "denied" and s["disabled"] and s["count"] == 0
            assert "_ga" not in names(ctx) and "usd_impact_consent" in names(ctx)
            guard(obs)
            return obs["google_mocked"]
        finally:
            ctx.close()
    run("compiled Privacy first-visit Reject prevents GA4", before_consent_reject)

    def accept_navigation_withdraw():
        ctx, page, obs = fixture()
        try:
            navigate(page, "/privacy/")
            page.click("#privacy-consent-accept")
            s = state(page)
            assert s["allowed"] and s["adsDenied"] and s["count"] == 1
            assert obs["google_mocked"] >= 1
            seed(ctx, "_ga", "controlled-ga-id")
            seed(ctx, "_ga_TEST1234", "controlled-stream-id")
            navigate(page, "/terms/")
            s = state(page)
            assert s["allowed"] and s["count"] == 1 and s["adsDenied"]
            assert value(ctx, "_ga") == "controlled-ga-id"
            assert value(ctx, "_ga_TEST1234") == "controlled-stream-id"
            page.click("#privacy-settings-button")
            page.uncheck("#privacy-consent-analytics")
            page.click("#privacy-consent-save")
            s = state(page)
            assert s["preference"] == "denied" and not s["allowed"] and s["disabled"] and s["denied"]
            assert "_ga" not in names(ctx) and "_ga_TEST1234" not in names(ctx)
            pre = s["events"]
            page.evaluate("""() => window.dispatchEvent(new CustomEvent('usd-impact:analytics-event', {
              detail: {eventName:'quiz_start',details:{quizId:'synthetic-qa'}}
            }))""")
            assert state(page)["events"] == pre, "Analytics event queued after withdrawal"
            guard(obs)
            return obs["google_mocked"]
        finally:
            ctx.close()
    run("compiled Accept, route change preserves cookies; Withdraw revokes", accept_navigation_withdraw)

    def pregranted_continuity():
        ctx, page, obs = fixture()
        try:
            seed(ctx, "usd_impact_consent", "v1.analytics-granted")
            seed(ctx, "_ga", "existing-synthetic-id")
            seed(ctx, "_ga_TEST1234", "existing-synthetic-stream")
            navigate(page, "/privacy/")
            assert state(page)["allowed"]
            assert value(ctx, "_ga") == "existing-synthetic-id"
            navigate(page, "/terms/")
            assert state(page)["allowed"]
            assert value(ctx, "_ga") == "existing-synthetic-id"
            assert value(ctx, "_ga_TEST1234") == "existing-synthetic-stream"
            guard(obs)
            return obs["google_mocked"]
        finally:
            ctx.close()
    run("compiled returning grant survives two full pages", pregranted_continuity)

    def denied_removes_stale():
        ctx, page, obs = fixture()
        try:
            seed(ctx, "usd_impact_consent", "v1.analytics-denied")
            seed(ctx, "_ga", "stale-synthetic-id")
            navigate(page, "/privacy/")
            s = state(page)
            assert s["preference"] == "denied" and not s["allowed"] and s["disabled"]
            assert "_ga" not in names(ctx) and s["count"] == 0
            assert obs["google_mocked"] == 0
            guard(obs)
            return obs["google_mocked"]
        finally:
            ctx.close()
    run("compiled persisted Reject cleans stale cookie without tag", denied_removes_stale)

    def spanish_unavailable():
        ctx, page, obs = fixture()
        try:
            seed(ctx, "usd_impact_consent", "v1.analytics-granted")
            seed(ctx, "_ga", "stale-synthetic-id")
            navigate(page, "/es/privacy/")
            s = state(page)
            assert s["enabled"] == "false" and not s["allowed"] and s["count"] == 0
            # This locale excludes GA4; absent GA4 does not promise stale-cookie cleanup.
            assert obs["google_mocked"] == 0
            guard(obs)
            return obs["google_mocked"]
        finally:
            ctx.close()
    run("compiled Spanish locale excludes optional GA4", spanish_unavailable)

    def malformed_consent():
        ctx, page, obs = fixture()
        try:
            seed(ctx, "usd_impact_consent", "v1.not-a-real-decision")
            seed(ctx, "_ga", "old-synthetic-id")
            navigate(page, "/privacy/")
            s = state(page)
            assert s["preference"] == "unset" and not s["allowed"] and s["count"] == 0
            assert "_ga" not in names(ctx) and obs["google_mocked"] == 0
            guard(obs)
            return obs["google_mocked"]
        finally:
            ctx.close()
    run("compiled malformed consent fails closed", malformed_consent)
    browser.close()
server.shutdown()
assert passed == 6
print("RESULT " + json.dumps({
  "cases": passed, "passed": passed, "compiled_astro": True,
  "browser_native_first_party_cookies": True,
  "synthetic_ga4_id": True, "google_vendor_code_executed": False,
  "google_requests_forwarded": 0, "google_requests_locally_stubbed": google_mocked_total,
  "production_tested": False, "vercel_deployment": False
}, sort_keys=True))
