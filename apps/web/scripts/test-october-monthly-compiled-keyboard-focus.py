#!/usr/bin/env python3
"""Read-only keyboard and focus QA on exact compiled October Monthly Preview.

Runs only against locally built Astro dist served over 127.0.0.1. Blocks all
external browser requests; no Vercel access tokens, live data or Production
changes. Does not constitute signed-in Preview or assistive-technology QA.
"""
import json
import shutil
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

WEB = Path(__file__).resolve().parents[1]
DIST = WEB / "dist"
REPORT = DIST / "macro-reviews/monthly/2026-10/index.html"
OUT = WEB / "october-monthly-focus-evidence"
ROUTE = "/macro-reviews/monthly/2026-10/"
VIEWPORTS = ((320, 568), (390, 844), (768, 900), (1440, 900))

assert REPORT.is_file(), "Preview-only compiled October route missing: no test may be skipped"
assert not (DIST / "macro-reviews/monthly/2026-11/index.html").exists(), (
    "Unreleased future Monthly must remain absent"
)
OUT.mkdir(parents=True, exist_ok=True)


class LocalHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), LocalHandler)
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = "http://127.0.0.1:" + str(server.server_port)
chrome = next(
    (shutil.which(name) for name in
     ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser")
     if shutil.which(name)), None,
)
assert chrome, "System Chromium missing: do not silently skip focus assertions"

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
                errors = []
                external_requests = []
                page.on("pageerror", lambda err: errors.append(str(err)[:400]))

                def isolate(route):
                    if route.request.url.startswith(origin + "/"):
                        route.continue_()
                    else:
                        external_requests.append(route.request.url.split("/")[2])
                        route.abort_()

                context.route("**/*", isolate)
                # A self-origin, memory-only CSS response models a user stylesheet
                # without disabling the application's genuine style-src CSP.
                css_path = origin + "/__qa_user_text_spacing.css"
                spacing_css = (
                    "* { line-height: 1.5 !important;"
                    " letter-spacing: .12em !important;"
                    " word-spacing: .16em !important; }"
                    " p { margin-bottom: 2em !important; }"
                )
                context.route(
                    css_path,
                    lambda request: request.fulfill(
                        status=200, content_type="text/css", body=spacing_css,
                    ),
                )
                result = {"route": ROUTE, "width": width, "height": height}
                stage = "load"
                try:
                    response = page.goto(origin + ROUTE, wait_until="load", timeout=40000)
                    assert response and response.status == 200, "Compiled page did not load"
                    page.evaluate("() => document.fonts.ready")
                    assert page.locator("html").get_attribute("lang") == "en"
                    assert "noindex" in (
                        page.locator('meta[name="robots"]').get_attribute("content") or ""
                    )
                    assert page.locator("h1").count() == 1
                    assert page.locator("main#main[tabindex='-1']").count() == 1
                    assert page.locator("footer a[href='/privacy/']").count() == 1
                    assert page.locator("main section[aria-labelledby]").count() == 7

                    stage = "skip-link keyboard focus"
                    page.keyboard.press("Tab")
                    assert page.evaluate(
                        "() => document.activeElement?.matches('a.skip[href=\"#main\"]')"
                    ), "First Tab must focus the Skip to October preview link"
                    skip = page.evaluate("""() => {
                      const a = document.activeElement;
                      const css = getComputedStyle(a);
                      const r = a.getBoundingClientRect();
                      return {
                        width: innerWidth,
                        outlineStyle: css.outlineStyle,
                        outlineWidth: parseFloat(css.outlineWidth) || 0,
                        fullyVisible: r.top >= -1 && r.bottom <= innerHeight + 1
                      };
                    }""")
                    assert skip["width"] == width, "Unexpected browser viewport width"
                    assert skip["outlineStyle"] != "none" and skip["outlineWidth"] >= 3
                    assert skip["fullyVisible"], "Skip link focus outline not in viewport"
                    if width <= 390:
                        page.screenshot(path=str(OUT / ("october-" + str(width) + "-skip.png")))

                    stage = "main target DOM focus"
                    page.keyboard.press("Enter")
                    focus = page.evaluate("""() => {
                      const main = document.querySelector('main#main');
                      const css = getComputedStyle(main);
                      const r = main.getBoundingClientRect();
                      return {
                        hash: location.hash,
                        activeTag: document.activeElement?.tagName,
                        activeId: document.activeElement?.id,
                        mainIsActive: document.activeElement === main,
                        outlineStyle: css.outlineStyle,
                        outlineWidth: parseFloat(css.outlineWidth) || 0,
                        mainTop: r.top, viewportHeight: innerHeight,
                        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
                      };
                    }""")
                    assert focus["hash"] == "#main", "Skip link failed to navigate to #main"
                    assert focus["mainIsActive"], (
                        "Skip link reached #main but DOM focus stayed on " +
                        str(focus["activeTag"]) + "#" + str(focus["activeId"])
                    )
                    assert focus["outlineStyle"] != "none" and focus["outlineWidth"] >= 3, (
                        "Compiled main focus ring was not visible"
                    )
                    assert not focus["horizontalOverflow"], "Horizontal overflow at requested width"
                    if width <= 390:
                        page.screenshot(
                            path=str(OUT / ("october-" + str(width) + "-main-focused.png"))
                        )
                    result["skip_to_main"] = focus

                    stage = "keyboard movement into main content"
                    page.keyboard.press("Tab")
                    assert page.evaluate(
                        "() => Boolean(document.activeElement?.closest('main#main'))"
                    ), "Next Tab after skip did not enter main content"

                    stage = "natural keyboard-only traversal from main to Privacy footer"
                    # Starting after the real skip-link Enter and first Tab, follow
                    # every successive browser Tab without manually calling .focus().
                    # A hidden or unreachable footer control must fail the test.
                    tab_order = []
                    for _ in range(90):
                        active = page.evaluate("""() => {
                          const el = document.activeElement;
                          const css = getComputedStyle(el);
                          const r = el.getBoundingClientRect();
                          return {
                            tag: el.tagName,
                            name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 120),
                            inMain: Boolean(el.closest('main#main')),
                            inFooter: Boolean(el.closest('footer')),
                            isPrivacy: el.matches('footer a[href="/privacy/"]'),
                            visible: r.top >= -1 && r.bottom <= innerHeight + 1,
                            outlineStyle: css.outlineStyle,
                            outlineWidth: parseFloat(css.outlineWidth) || 0,
                            overflow: document.documentElement.scrollWidth > innerWidth + 1,
                          };
                        }""")
                        assert active["tag"] == "A", (
                            "Tab left keyboard-accessible links at " + active["tag"]
                        )
                        assert active["name"], "Focused link has no accessible name"
                        assert active["visible"], (
                            "Focused link outside viewport: " + active["name"]
                        )
                        assert active["outlineStyle"] != "none" and active["outlineWidth"] >= 3, (
                            "Missing visible keyboard outline: " + active["name"]
                        )
                        assert not active["overflow"], "Horizontal overflow during Tab traversal"
                        tab_order.append({
                            "name": active["name"],
                            "inMain": active["inMain"],
                            "inFooter": active["inFooter"],
                        })
                        if active["isPrivacy"]:
                            break
                        page.keyboard.press("Tab")
                    assert active["isPrivacy"], (
                        "Natural Tab traversal never reached the footer Privacy link"
                    )
                    assert sum(1 for link in tab_order if link["inMain"]) >= 5, (
                        "Fewer than five main-content links were reachable by Tab"
                    )
                    assert sum(1 for link in tab_order if link["inFooter"]) >= 3, (
                        "Fewer than three footer links were reachable by Tab"
                    )
                    result["natural_tab"] = {
                        "links": len(tab_order),
                        "main": sum(1 for link in tab_order if link["inMain"]),
                        "footer": sum(1 for link in tab_order if link["inFooter"]),
                        "privacyReached": True,
                    }

                    stage = "footer keyboard focus"
                    privacy = page.locator("footer a[href='/privacy/']")
                    assert privacy.evaluate("(el) => document.activeElement === el")
                    page.keyboard.press("Shift+Tab")
                    assert page.evaluate(
                        "() => document.activeElement?.matches('footer a[href=\"/news\"]')"
                    ), "Shift+Tab from Privacy did not reach preceding footer Dailies link"
                    page.keyboard.press("Tab")
                    assert privacy.evaluate("(el) => document.activeElement === el"), (
                        "Tab did not move focus back to the Privacy footer link"
                    )
                    footer = privacy.evaluate("""(el) => {
                      const css = getComputedStyle(el);
                      const r = el.getBoundingClientRect();
                      const hit = document.elementFromPoint(
                        (r.left + r.right) / 2, (r.top + r.bottom) / 2
                      );
                      return {
                        accessibleName: el.textContent.trim(),
                        outlineStyle: css.outlineStyle,
                        outlineWidth: parseFloat(css.outlineWidth) || 0,
                        fullyVisible: r.top >= -1 && r.bottom <= innerHeight + 1,
                        hitOnLink: hit === el || el.contains(hit),
                        viewportWidth: innerWidth,
                        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
                      };
                    }""")
                    assert footer["accessibleName"] == "Privacy"
                    assert footer["outlineStyle"] != "none" and footer["outlineWidth"] >= 3, (
                        "Privacy footer link keyboard focus outline not visible"
                    )
                    assert footer["fullyVisible"] and footer["hitOnLink"], (
                        "Privacy link focus obscured or outside viewport"
                    )
                    assert not footer["horizontalOverflow"] and footer["viewportWidth"] == width
                    if width <= 390:
                        page.screenshot(
                            path=str(OUT / ("october-" + str(width) + "-footer-focused.png"))
                        )
                        page.screenshot(
                            path=str(OUT / ("october-" + str(width) + "-fullpage.png")),
                            full_page=True,
                        )
                    # W3C WCAG 2.2 SC 1.4.12: test the four user text-spacing
                    # overrides without changing any other authored CSS property.
                    # This is an extra regression beyond default-width reflow.
                    stage = "WCAG 1.4.12 user text spacing"
                    page.add_style_tag(url=css_path)
                    page.locator("h1#page-title").scroll_into_view_if_needed()
                    spacing = page.evaluate("""() => {
                      const p = document.querySelector('main p');
                      const ps = p ? getComputedStyle(p) : null;
                      const font = ps ? parseFloat(ps.fontSize) : 0;
                      const root = document.documentElement;
                      const elements = Array.from(document.querySelectorAll('body *'));
                      const overflowNodes = elements.filter(el => {
                        if (getComputedStyle(el).display === 'none') return false;
                        const r = el.getBoundingClientRect();
                        return r.right > innerWidth + 1 || r.left < -1;
                      }).slice(0, 5).map(el => ({
                        tag: el.tagName,
                        cls: String(el.className).slice(0, 90),
                        text: (el.textContent || '').trim().slice(0, 60)
                      }));
                      return {
                        viewport: innerWidth,
                        scrollWidth: root.scrollWidth,
                        lineHeightRatio: font ? parseFloat(ps.lineHeight) / font : 0,
                        paragraphSpacingRatio: font ? parseFloat(ps.marginBottom) / font : 0,
                        letterSpacingRatio: font ? parseFloat(ps.letterSpacing) / font : 0,
                        wordSpacingRatio: font ? parseFloat(ps.wordSpacing) / font : 0,
                        sections: document.querySelectorAll('main section[aria-labelledby]').length,
                        footerPrivacyVisible: Boolean(document.querySelector('footer a[href="/privacy/"]')),
                        overflowingElements: overflowNodes
                      };
                    }""")
                    assert spacing["lineHeightRatio"] >= 1.49
                    assert spacing["paragraphSpacingRatio"] >= 1.99
                    assert spacing["letterSpacingRatio"] >= .119
                    assert spacing["wordSpacingRatio"] >= .159
                    assert spacing["viewport"] == width
                    assert spacing["scrollWidth"] <= width + 1, (
                        "User text spacing introduces horizontal scrolling: " +
                        json.dumps(spacing)
                    )
                    assert spacing["sections"] == 7 and spacing["footerPrivacyVisible"], (
                        "User text spacing removed Monthly content or footer"
                    )
                    # Reflow must preserve the real keyboard path, not merely
                    # the ability to programmatically focus a footer link.
                    # Starting at Privacy (naturally reached above), use only
                    # Shift+Tab and Tab after the user spacing override.
                    stage = "natural footer keyboard after text spacing"
                    assert privacy.evaluate(
                        "(el) => document.activeElement === el"
                    ), "Text-spacing override unexpectedly displaced keyboard focus"
                    page.keyboard.press("Shift+Tab")
                    assert page.evaluate(
                        "() => document.activeElement?.matches('footer a[href=\\\"/news\\\"]')"
                    ), "Shift+Tab after text spacing did not reach Dailies"
                    page.keyboard.press("Tab")
                    assert privacy.evaluate(
                        "(el) => document.activeElement === el"
                    ), "Natural Tab after text spacing did not return to Privacy"
                    footer_after_spacing = privacy.evaluate("""(el) => {
                      const css = getComputedStyle(el);
                      const rect = el.getBoundingClientRect();
                      const hit = document.elementFromPoint(
                        (rect.left + rect.right) / 2,
                        (rect.top + rect.bottom) / 2
                      );
                      return {
                        focused: document.activeElement === el,
                        visible: rect.top >= -1 && rect.bottom <= innerHeight + 1,
                        onTop: hit === el || el.contains(hit),
                        outline: parseFloat(css.outlineWidth) || 0
                      };
                    }""")
                    assert all([
                        footer_after_spacing["focused"],
                        footer_after_spacing["visible"],
                        footer_after_spacing["onTop"],
                        footer_after_spacing["outline"] >= 3,
                    ]), "Text spacing obstructed footer keyboard focus"
                    result["text_spacing"] = spacing
                    if width <= 390:
                        page.screenshot(
                            path=str(OUT / ("october-" + str(width) + "-textspacing-fullpage.png")),
                            full_page=True,
                        )
                    assert not errors, "Browser page exceptions: " + repr(errors)
                    assert not external_requests, (
                        "External request attempted: " + repr(external_requests)
                    )
                    result["footer_focus"] = footer
                    result["status"] = "PASS"
                    print("PASS October Monthly " + str(width) + "x" + str(height)
                          + " skip-main focus + Privacy footer focus")
                except Exception as exc:
                    result["status"] = "FAIL"
                    result["stage"] = stage
                    result["error"] = str(exc)[:900]
                    failures.append(result)
                    print("FAIL October Monthly " + str(width) + " " + stage + ": "
                          + str(exc)[:700])
                    try:
                        page.screenshot(
                            path=str(OUT / ("october-" + str(width) + "-failure.png")),
                            full_page=True,
                        )
                    except Exception:
                        pass
                finally:
                    results.append(result)
                    context.close()
        finally:
            browser.close()
finally:
    server.shutdown()
    server.server_close()

summary = {
    "cases": len(results) * 2,
    "passed": 2 * (len(results) - len(failures)),
    "failed": 2 * len(failures),
    "results": results,
    "scope": "Actual compiled Preview HTML/CSS, native Chromium keyboard, 127.0.0.1 only.",
    "limitations": (
        "NOT a live authenticated Vercel Preview or genuine NVDA, VoiceOver or "
        "physical-device certification. No customer, consent or Production access."
    ),
}
(OUT / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
print("RESULT " + json.dumps({
    "viewports": len(results),
    "passed_viewports": len(results) - len(failures),
    "failed_viewports": len(failures),
    "keyboard_cases": len(results) * 2,
    "compiled_preview": True,
    "deployed_preview": False,
}, sort_keys=True))
assert len(results) == 4, "Expected four exact viewport cases"
assert not failures, "October Monthly compiled keyboard focus QA failed"
