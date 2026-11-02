#!/usr/bin/env python3
"""Read-only accessibility regression on compiled Spanish Preview pages.

Serves exact-build static Astro output on 127.0.0.1 only. New browser
context per test, no real account, no live Vercel, no external requests,
no customer preferences, and no Production deployment.
"""
import json
import shutil
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

WEB = Path(__file__).resolve().parents[1]
DIST = WEB / "dist"
OUT = WEB / "spanish-preview-accessibility-qa"
ROUTES = ("/es/news/", "/es/reports/")
VIEWPORTS = ((320, 568), (390, 844), (768, 900), (1440, 900))

for route in ROUTES:
    assert (DIST / route.strip("/") / "index.html").is_file(), (
        "Compiled Spanish Preview route missing: " + route
    )
OUT.mkdir(parents=True, exist_ok=True)


class QuietStatic(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), QuietStatic)
server.daemon_threads = True
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = "http://127.0.0.1:" + str(server.server_port)
chrome = next(
    (shutil.which(name) for name in
     ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser")
     if shutil.which(name)),
    None,
)
assert chrome, "System Chrome missing; do not silently skip browser QA"

results = []
failures = []
try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=chrome,
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        try:
            for route in ROUTES:
                section = "latest-edition" if route == "/es/news/" else "latest-report"
                label = "news" if route == "/es/news/" else "reports"
                summary_selector = "section." + section + " details.card > summary"
                details_selector = "section." + section + " details.card"
                original_link_selector = "section." + section + " a.button.primary"
                for width, height in VIEWPORTS:
                    context = browser.new_context(
                        viewport={"width": width, "height": height},
                        service_workers="block",
                    )
                    external_requests = []
                    page_errors = []
                    page = context.new_page()
                    page.on("pageerror", lambda error: page_errors.append(str(error)[:300]))

                    def route_request(interception):
                        url = interception.request.url
                        if url.startswith(origin + "/"):
                            interception.continue_()
                        else:
                            external_requests.append(urlsplit(url).hostname or "unknown")
                            interception.abort_()

                    context.route("**/*", route_request)
                    entry = {"route": route, "width": width, "height": height}
                    try:
                        response = page.goto(origin + route, wait_until="load", timeout=30000)
                        assert response and response.status == 200, "Compiled page did not load"
                        page.wait_for_function(
                            "typeof window.USDImpactConsent?.preference === 'function'",
                            timeout=15000,
                        )
                        assert page.locator("html").get_attribute("lang") == "es"
                        assert "noindex" in (page.locator('meta[name="robots"]').get_attribute("content") or "")
                        assert page.locator("h1").count() == 1
                        assert page.locator("main#main-content").count() == 1
                        assert page.locator(summary_selector).count() == 1
                        assert page.locator(original_link_selector).get_attribute("hreflang") == "en"
                        assert page.locator(details_selector + " p[lang='en']").count() == 2
                        contents = page.locator(details_selector + " p[lang='en']").all_text_contents()
                        assert len(contents[0]) > 15 and len(contents[1]) > 150, (
                            "English source title or summary was truncated"
                        )

                        # The unselected privacy notice must not obscure page focus.
                        banner = page.locator("#privacy-consent-banner")
                        assert banner.is_visible(), "First visit should present privacy choices"
                        assert banner.get_attribute("data-analytics-enabled") == "false"
                        assert page.evaluate("window.USDImpactConsent.preference()") == "unset"
                        assert page.evaluate("""() => {
                          const header = document.querySelector('header.site-header');
                          const banner = document.querySelector('#privacy-consent-banner');
                          const main = document.querySelector('main#main-content');
                          return Boolean(
                            header && banner && main &&
                            (header.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING) &&
                            (banner.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING) &&
                            getComputedStyle(banner).position !== 'fixed'
                          );
                        }"""), "Privacy banner must be in DOM and visual flow"

                        page.keyboard.press("Tab")
                        assert page.evaluate(
                            "() => document.activeElement?.classList.contains('skip-link')"
                        ), "First Tab must expose skip link"
                        seen = []
                        reached = False
                        for _ in range(90):
                            seen.append(page.evaluate(
                                "() => document.activeElement?.id || document.activeElement?.tagName"
                            ))
                            if page.evaluate(
                                "(selector) => document.activeElement?.matches(selector)",
                                summary_selector,
                            ):
                                reached = True
                                break
                            page.keyboard.press("Tab")
                        assert reached, "Tab navigation did not reach English-source disclosure"
                        assert "privacy-consent-reject" in seen, (
                            "Privacy choice should precede page disclosure in keyboard order"
                        )

                        focus = page.evaluate("""() => {
                          const element = document.activeElement;
                          const rect = element.getBoundingClientRect();
                          const x = rect.left + rect.width / 2;
                          const y = rect.top + rect.height / 2;
                          const hit = document.elementFromPoint(x, y);
                          return {
                            top: rect.top, bottom: rect.bottom,
                            visible: rect.top >= -1 && rect.bottom <= innerHeight + 1,
                            onTop: hit === element || hit?.closest('summary') === element,
                            outline: parseFloat(getComputedStyle(element).outlineWidth) || 0,
                            htmlOverflow: document.documentElement.scrollWidth > innerWidth + 1,
                            bodyOverflow: document.body.scrollWidth > innerWidth + 1
                          };
                        }""")
                        assert focus["visible"] and focus["onTop"], (
                            "Focused summary hidden or covered: " + json.dumps(focus)
                        )
                        assert focus["outline"] >= 3, "Keyboard focus outline is not visible"
                        assert not focus["htmlOverflow"] and not focus["bodyOverflow"], (
                            "Horizontal overflow on compiled Preview"
                        )

                        # Closed mobile navigation must never steal Escape.
                        page.keyboard.press("Escape")
                        assert page.evaluate(
                            "(selector) => document.activeElement?.matches(selector)",
                            summary_selector,
                        ), "Escape unexpectedly moved focus away from a content disclosure"

                        page.keyboard.press("Enter")
                        assert page.locator(details_selector).evaluate("(el) => el.open"), (
                            "Enter did not expand native English disclosure"
                        )
                        page.keyboard.press("Space")
                        assert not page.locator(details_selector).evaluate("(el) => el.open"), (
                            "Space did not collapse native English disclosure"
                        )

                        if width <= 390:
                            page.screenshot(path=str(OUT / (label + "-" + str(width) + "-focused.png")))

                        # Native consent modal must own Escape and restore focus to its opener.
                        review = page.locator("#privacy-consent-review")
                        review.click()
                        dialog = page.locator("#privacy-consent-dialog")
                        assert dialog.evaluate("(el) => el.open")
                        page.keyboard.press("Escape")
                        assert not dialog.evaluate("(el) => el.open"), "Escape did not close modal"
                        assert review.evaluate("(el) => document.activeElement === el"), (
                            "Consent modal did not restore opener focus"
                        )

                        if width <= 760:
                            menu = page.locator(".nav-toggle")
                            assert menu.is_visible()
                            menu.click()
                            assert menu.get_attribute("aria-expanded") == "true"
                            page.locator(".nav-group > summary").first.focus()
                            page.keyboard.press("Escape")
                            assert menu.get_attribute("aria-expanded") == "false"
                            assert menu.evaluate("(el) => document.activeElement === el"), (
                                "Open mobile menu did not close and return focus"
                            )
                        else:
                            first_group = page.locator(".nav-group").first
                            first_summary = first_group.locator("summary")
                            first_summary.click()
                            assert first_group.evaluate("(el) => el.open")
                            page.keyboard.press("Escape")
                            assert not first_group.evaluate("(el) => el.open")
                            assert first_summary.evaluate("(el) => document.activeElement === el")

                        # Real first-party browser cookie and cross-page persistence.
                        page.locator("#privacy-consent-reject").click()
                        assert not banner.is_visible(), "Consent rejection did not dismiss banner"
                        assert page.evaluate("window.USDImpactConsent.preference()") == "denied"
                        cookies = context.cookies(origin)
                        choice = next((c for c in cookies if c["name"] == "usd_impact_consent"), None)
                        assert choice and choice["value"] == "v1.analytics-denied", (
                            "Native browser did not persist privacy choice"
                        )
                        assert not page.evaluate("window.USDImpactConsent.analyticsAllowed()")
                        other = "/es/reports/" if route == "/es/news/" else "/es/news/"
                        response = page.goto(origin + other, wait_until="load")
                        assert response and response.status == 200
                        page.wait_for_function(
                            "typeof window.USDImpactConsent?.preference === 'function'"
                        )
                        assert not page.locator("#privacy-consent-banner").is_visible()
                        assert page.evaluate("window.USDImpactConsent.preference()") == "denied"
                        assert not page.evaluate("window.USDImpactConsent.analyticsAllowed()")

                        footer = page.locator("#privacy-settings-button")
                        footer.click()
                        assert page.locator("#privacy-consent-dialog").evaluate("(el) => el.open")
                        page.keyboard.press("Escape")
                        assert not page.locator("#privacy-consent-dialog").evaluate("(el) => el.open")
                        assert footer.evaluate("(el) => document.activeElement === el")
                        if width <= 390:
                            page.screenshot(path=str(OUT / (label + "-" + str(width) + "-dismissed.png")))
                        assert not page_errors, "JavaScript exceptions: " + repr(page_errors)
                        assert not external_requests, (
                            "External network attempted: " + repr(external_requests)
                        )
                        entry.update({
                            "result": "PASS", "source_language": "en",
                            "native_cookie": True, "visual_focus": True,
                            "escape_scoped": True, "modal_focus": True,
                            "external_requests": 0,
                        })
                        print("PASS " + label + " " + str(width) + "x" + str(height))
                    except Exception as exc:
                        entry["result"] = "FAIL"
                        entry["error"] = str(exc)[:900]
                        failures.append(entry)
                        try:
                            page.screenshot(path=str(OUT / (label + "-" + str(width) + "-failure.png")))
                        except Exception:
                            pass
                        print("FAIL " + label + " " + str(width) + ": " + str(exc)[:500])
                    finally:
                        results.append(entry)
                        context.close()
        finally:
            browser.close()
finally:
    server.shutdown()
    server.server_close()

summary = {
    "cases": len(results),
    "passed": len(results) - len(failures),
    "failed": len(failures),
    "results": results,
    "limitations": (
        "Isolated Chrome on real compiled Astro Preview HTML, not a Vercel deployment, "
        "physical device, NVDA, VoiceOver, or public-release authorization."
    ),
}
(OUT / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
print("RESULT " + json.dumps({
    "cases": len(results), "passed": len(results) - len(failures),
    "failed": len(failures), "compiled_preview": True,
    "real_browser_cookie": True, "vercel_deployed": False,
}, sort_keys=True))
assert not failures, "Compiled Spanish Preview accessibility regression failed"
assert len(results) == 8, "Expected eight exact compiled route/viewport cases"
