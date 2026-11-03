#!/usr/bin/env python3
"""Draft-only independent English shared-header/skip accessibility QA.

Uses the actual compiled Astro Preview artifact served on 127.0.0.1.
No authenticated Vercel access, external network, user preference writes,
production deployment, or simulated screen-reader claims.
"""
import json
import shutil
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

WEB = Path(__file__).resolve().parents[1]
DIST = WEB / "dist"
OUT = WEB / "english-header-a11y-evidence"
VIEWPORTS = ((320, 568), (390, 844), (768, 900), (960, 900), (961, 900), (1440, 900))
assert (DIST / "index.html").is_file(), "Actual compiled English homepage missing"
OUT.mkdir(parents=True, exist_ok=True)


class LocalStatic(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), LocalStatic)
server.daemon_threads = True
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = "http://127.0.0.1:" + str(server.server_port)
chrome = next((shutil.which(x) for x in (
    "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"
) if shutil.which(x)), None)
assert chrome, "System Chromium unavailable; never silently skip QA"

results = []
failures = []
try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=chrome, headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        try:
            for width, height in VIEWPORTS:
                context = browser.new_context(
                    viewport={"width": width, "height": height},
                    device_scale_factor=1,
                    service_workers="block",
                    reduced_motion="reduce",
                )
                page = context.new_page()
                external = []
                errors = []
                browser_console = []
                page.on("pageerror", lambda e: errors.append(str(e)[:500]))
                page.on("console", lambda m: browser_console.append(m.text[:400]) if m.type == "error" else None)

                def isolate(route):
                    if route.request.url.startswith(origin + "/"):
                        route.continue_()
                    else:
                        external.append(route.request.url.split("/")[2])
                        route.abort_()

                context.route("**/*", isolate)
                css_url = origin + "/__qa_english_user_text_spacing.css"
                css = (
                    "* { line-height: 1.5 !important;"
                    " letter-spacing: .12em !important;"
                    " word-spacing: .16em !important; }"
                    " p { margin-bottom: 2em !important; }"
                )
                context.route(
                    css_url,
                    lambda route: route.fulfill(
                        status=200, content_type="text/css", body=css
                    ),
                )
                item = {"route": "/", "width": width, "height": height}
                stage = "initial"
                try:
                    response = page.goto(origin + "/", wait_until="load", timeout=40000)
                    assert response and response.status == 200
                    page.evaluate("() => document.fonts.ready")
                    assert page.locator("html").get_attribute("lang") == "en"
                    assert page.locator("h1").first.inner_text().strip() == "Read the Dollar First."
                    assert page.locator("a.skip-link[href='#main-content']").count() == 1
                    assert page.locator("main#main-content").count() == 1
                    assert page.evaluate("window.innerWidth") == width

                    stage = "real first-Tab Enter skip-target focus"
                    page.keyboard.press("Tab")
                    assert page.evaluate("""() => (
                      document.activeElement?.matches('a.skip-link[href="#main-content"]')
                    )"""), "First Tab did not focus the English skip link"
                    page.keyboard.press("Enter")
                    skip = page.evaluate("""() => ({
                      hash: location.hash,
                      activeTag: document.activeElement?.tagName,
                      activeId: document.activeElement?.id,
                      mainIsActive: document.activeElement === document.querySelector('main#main-content'),
                      mainTabIndex: document.querySelector('main#main-content')?.getAttribute('tabindex')
                    })""")
                    item["skip"] = skip
                    assert skip["hash"] == "#main-content", "Skip Enter did not navigate"
                    assert skip["mainIsActive"], (
                        "Skip Enter navigated but main did not receive DOM focus: " +
                        json.dumps(skip)
                    )

                    stage = "responsive header natural keyboard menu"
                    page.goto(origin + "/", wait_until="load")
                    toggle = page.locator(".site-header button.nav-toggle")
                    nav = page.locator("nav#site-navigation")
                    group = page.locator("nav#site-navigation details.nav-group").first
                    summary = group.locator("summary")
                    page.keyboard.press("Tab")
                    assert page.evaluate(
                        "() => document.activeElement?.matches('a.skip-link')"
                    )
                    page.keyboard.press("Tab")
                    assert page.evaluate(
                        "() => document.activeElement?.matches('header .logo')"
                    ), "Second Tab did not focus site logo"
                    page.keyboard.press("Tab")
                    if width <= 960:
                        assert toggle.is_visible() and not nav.is_visible()
                        assert toggle.evaluate("(el) => document.activeElement === el"), (
                            "Third Tab did not reach responsive Menu button"
                        )
                        page.keyboard.press("Enter")
                        assert toggle.get_attribute("aria-expanded") == "true"
                        assert nav.is_visible()
                        page.keyboard.press("Tab")
                        assert summary.evaluate("(el) => document.activeElement === el")
                        page.keyboard.press("Enter")
                        page.wait_for_function(
                            "() => document.querySelector('nav details.nav-group').open"
                        )
                        page.keyboard.press("Escape")
                        assert toggle.get_attribute("aria-expanded") == "false"
                        assert not nav.is_visible()
                        assert not group.evaluate("(el) => el.open")
                        assert toggle.evaluate("(el) => document.activeElement === el"), (
                            "Mobile Escape did not restore focus to Menu button"
                        )
                        item["navMode"] = "responsive"
                    else:
                        assert not toggle.is_visible() and nav.is_visible()
                        assert summary.evaluate("(el) => document.activeElement === el"), (
                            "Third Tab did not focus desktop Learn summary"
                        )
                        page.keyboard.press("Enter")
                        page.wait_for_function(
                            "() => document.querySelector('nav details.nav-group').open"
                        )
                        page.keyboard.press("Escape")
                        assert not group.evaluate("(el) => el.open")
                        assert summary.evaluate("(el) => document.activeElement === el"), (
                            "Desktop Escape did not restore Learn summary focus"
                        )
                        item["navMode"] = "desktop"
                    item["keyboard"] = "PASS"

                    stage = "text-spacing user override under real CSP"
                    page.add_style_tag(url=css_url)
                    page.wait_for_timeout(300)
                    item["stylesheetDiagnostics"] = page.evaluate("""() => ({
                      qaStylePresent: !!document.querySelector('link[href*="__qa_english_user_text_spacing.css"]'),
                      qaStyleLoaded: [...document.styleSheets].some(
                        s => s.href && s.href.includes('__qa_english_user_text_spacing.css')
                      ),
                      qaStyleLink: document.querySelector('link[href*="__qa_english_user_text_spacing.css"]')?.outerHTML.slice(0, 280) || null,
                      sheetCount: document.styleSheets.length
                    })""")
                    item["browserConsoleErrors"] = browser_console[-8:]
                    spacing = page.evaluate("""() => {
                      const p = document.querySelector('main p');
                      const s = p && getComputedStyle(p);
                      const fs = s ? parseFloat(s.fontSize) : 0;
                      const header = document.querySelector('header.site-header');
                      const rect = header.getBoundingClientRect();
                      return {
                        width: innerWidth,
                        scrollWidth: document.documentElement.scrollWidth,
                        headerWidth: rect.width,
                        line: fs ? parseFloat(s.lineHeight) / fs : 0,
                        paragraph: fs ? parseFloat(s.marginBottom) / fs : 0,
                        letter: fs ? parseFloat(s.letterSpacing) / fs : 0,
                        word: fs ? parseFloat(s.wordSpacing) / fs : 0,
                        navToggleVisible: getComputedStyle(document.querySelector('.nav-toggle')).display !== 'none'
                      };
                    }""")
                    item["textSpacing"] = spacing
                    assert spacing["width"] == width
                    assert spacing["line"] >= 1.49 and spacing["paragraph"] >= 1.99
                    assert spacing["letter"] >= .119 and spacing["word"] >= .159
                    assert spacing["scrollWidth"] <= width + 1, (
                        "English page overflow with text spacing: " + json.dumps(spacing)
                    )
                    assert spacing["navToggleVisible"] == (width <= 960), (
                        "Header breakpoint mismatch under text spacing"
                    )
                    if width in (320, 390, 768, 960, 961):
                        page.screenshot(
                            path=str(OUT / ("english-" + str(width) + "-textspacing.png")),
                            full_page=True,
                        )
                    assert not errors, "Browser JS errors: " + repr(errors)
                    assert not external, "External requests unexpectedly attempted: " + repr(external)
                    item["status"] = "PASS"
                    print("PASS English shared header " + str(width) + "x" + str(height))
                except Exception as exc:
                    item["status"] = "FAIL"
                    item["stage"] = stage
                    item["error"] = str(exc)[:1200]
                    item["browserConsoleErrors"] = browser_console[-8:]
                    failures.append(item)
                    print("FAIL English " + str(width) + " stage=" + stage + " " + str(exc)[:700])
                    try:
                        page.screenshot(
                            path=str(OUT / ("english-" + str(width) + "-failure.png")),
                            full_page=True,
                        )
                    except Exception:
                        pass
                finally:
                    results.append(item)
                    context.close()
        finally:
            browser.close()
finally:
    server.shutdown()
    server.server_close()

summary = {
    "results": results,
    "cases": len(results),
    "passed": len(results) - len(failures),
    "failed": len(failures),
    "scope": "Compiled exact Astro Preview-only English homepage; localhost native Chromium.",
    "notCertified": "Live Vercel authenticated viewport and actual NVDA/VoiceOver.",
}
(OUT / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
print("RESULT " + json.dumps({
    "cases": len(results), "passed": len(results)-len(failures),
    "failed": len(failures), "liveProtected": False
}))
assert len(results) == len(VIEWPORTS)
assert not failures, "English shared header independent compiled accessibility QA failed"
