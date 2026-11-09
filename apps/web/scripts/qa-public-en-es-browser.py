#!/usr/bin/env python3
"""Draft-only real Chrome QA of actual compiled Astro over loopback, with no external requests."""
import json
import shutil
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

web = Path(__file__).resolve().parents[1]
dist = web / "dist"
routes = {"/":"en", "/es/":"es", "/news/":"en", "/reports/":"en",
          "/score/":"en", "/learn/":"en", "/learn/dxy-signal-vs-dollar-system/":"en",
          "/quiz/":"en", "/start-here/quiz/":"en", "/book/read-the-dollar-first/":"en"}
for route in routes:
    target = ("index.html" if route == "/" else route.lstrip("/") + "index.html")
    assert (dist / target).is_file(), f"Missing built route: {route}"

class Quiet(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(dist), **kwargs)
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(("127.0.0.1", 0), Quiet)
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f"http://127.0.0.1:{server.server_port}"
chrome = next((shutil.which(x) for x in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser")
               if shutil.which(x)), None)
assert chrome, "Chrome not available"
results = []

def check(name, operation):
    try:
        summary = operation()
        results.append({"case":name, "status":"PASS", "detail":summary})
        print("PASS", name, flush=True)
    except Exception as exc:
        results.append({"case":name, "status":"FAIL", "detail":str(exc)[:400]})
        print("FAIL", name, str(exc)[:400], flush=True)

def setup(browser, width=390, js=True):
    ctx = browser.new_context(viewport={"width":width,"height":844}, java_script_enabled=js,
                              service_workers="block", reduced_motion="reduce")
    ctx.route("**/*", lambda request: request.continue_()
              if request.request.url.startswith(origin + "/") else request.abort())
    return ctx, ctx.new_page()

def visit(page, route):
    response = page.goto(origin + route, wait_until="load", timeout=30000)
    assert response and response.status == 200, f"{route} HTTP failure"
    assert page.locator("html").get_attribute("lang") == routes[route], f"{route} language mismatch"
    assert page.locator("main#main-content").count() == 1, f"{route} no server-rendered skip target"
    assert page.locator("a.skip-link[href='#main-content']").count() == 1, f"{route} no skip link"
    assert page.locator("h1").count() == 1, f"{route} H1 count not 1"

def skips(browser, js):
    ctx, page = setup(browser, js=js)
    try:
        for route in routes:
            visit(page, route)
            page.keyboard.press("Tab")
            assert page.evaluate("document.activeElement?.classList?.contains('skip-link') === true"), f"{route} first Tab not skip link, JS={js}"
            page.keyboard.press("Enter")
            focused = page.evaluate("document.activeElement?.id === 'main-content'")
            assert page.url.endswith("#main-content") or focused, f"{route} Enter did not reach main"
            # Strengthened: the next Tab must land on <main> or inside it, with JS on and off.
            page.keyboard.press("Tab")
            in_main = page.evaluate("""() => { const a = document.activeElement;
                return !!a && a !== document.body && !!a.closest('main#main-content'); }""")
            assert in_main, f"{route} Tab after skip did not reach main content, JS={js}"
        assert all(c["name"] != "usd_impact_consent" for c in ctx.cookies()), "Consent was mutated"
        return {"routes":len(routes), "javascript":js}
    finally:
        ctx.close()

def nojs_navigation(browser, language, width):
    """Without JavaScript the header navigation must stay reachable (no inert Menu button)."""
    ctx, page = setup(browser, width=width, js=False)
    try:
        route = "/" if language == "en" else "/es/"
        visit(page, route)
        state = page.evaluate("""() => {
            const visible = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
            const toggle = document.querySelector('.nav-toggle');
            const nav = document.querySelector('#site-navigation');
            return { toggleVisible: visible(toggle), navVisible: visible(nav),
                     reachable: [...nav.querySelectorAll('summary, a.nav-direct')].filter(visible).length,
                     overflow: document.documentElement.scrollWidth > window.innerWidth + 1 };
        }""")
        assert not state["toggleVisible"], f"{route} {width}px: inert Menu button shown without JS"
        assert state["navVisible"] and state["reachable"] >= 4, f"{route} {width}px: header navigation not reachable without JS ({state})"
        assert not state["overflow"], f"{route} {width}px: horizontal overflow without JS"
        if page.locator("#site-navigation summary").count() > 0:
            # Grouped (EN) navigation: native <details> must open from the keyboard without JS.
            page.locator("#site-navigation summary").first.focus()
            page.keyboard.press("Enter")
            assert page.evaluate("document.querySelector('#site-navigation details[open]') !== null"), f"{route} {width}px: native disclosure did not open without JS"
        else:
            # Flat (ES) navigation: sequential Tab from the page start must reach a header nav link.
            reached = False
            for _ in range(8):
                page.keyboard.press("Tab")
                if page.evaluate("!!document.activeElement.closest('#site-navigation')"):
                    reached = True
                    break
            assert reached, f"{route} {width}px: keyboard Tab did not reach header navigation without JS"
        return {"language": language, "width": width, "reachable": state["reachable"]}
    finally:
        ctx.close()

def js_collapsed(browser, language, width):
    """With JavaScript the enhanced collapsed header (Menu button) is unchanged at the 961px boundary."""
    ctx, page = setup(browser, width=width, js=True)
    try:
        route = "/" if language == "en" else "/es/"
        visit(page, route)
        state = page.evaluate("""() => ({ toggle: getComputedStyle(document.querySelector('.nav-toggle')).display,
            nav: getComputedStyle(document.querySelector('#site-navigation')).display })""")
        collapsed = width <= 960
        assert (state["toggle"] != "none") == collapsed, f"{route} {width}px JS: toggle display {state}"
        assert (state["nav"] == "none") == collapsed, f"{route} {width}px JS: nav display {state}"
        return {"language": language, "width": width, **state}
    finally:
        ctx.close()

def mobile_menu(browser, language, width):
    ctx, page = setup(browser, width=width)
    try:
        route = "/es/" if language == "es" else "/"
        visit(page, route)
        toggle = page.locator("button.nav-toggle")
        assert toggle.is_visible(), f"Toggle not visible at {width}px"
        toggle.focus()
        page.keyboard.press("Enter")
        assert toggle.get_attribute("aria-expanded") == "true", "Enter did not open menu"
        assert page.locator("#site-navigation").get_attribute("data-open") == "true"
        page.keyboard.press("Tab")
        assert page.evaluate("Boolean(document.activeElement?.closest('#site-navigation'))"), "Tab did not enter menu"
        page.keyboard.press("Escape")
        assert toggle.get_attribute("aria-expanded") == "false", "Escape did not close menu"
        assert page.evaluate("document.activeElement?.classList?.contains('nav-toggle') === true"), "Escape did not restore toggle focus"
        return {"language":language, "width":width}
    finally:
        ctx.close()

def desktop_menu(browser, width):
    ctx, page = setup(browser, width=width)
    try:
        visit(page, "/")
        item = page.locator(".nav-group summary").first
        item.focus()
        page.keyboard.press("Enter")
        assert item.evaluate("(el) => el.parentElement.hasAttribute('open')"), "Enter did not open group"
        page.keyboard.press("Escape")
        assert not item.evaluate("(el) => el.parentElement.hasAttribute('open')"), "Escape did not close group"
        return {"width":width}
    finally:
        ctx.close()

def synthetic_score_lab_interaction(browser):
    """Real Chrome/compiled Astro keyboard/input/CSV/reset test; all traffic stays on loopback."""
    ctx, page = setup(browser, width=390)
    try:
        response = page.goto(origin + "/score/lab/", wait_until="load", timeout=30000)
        assert response and response.status == 200, "Fictional lab route not built"
        assert page.locator("html").get_attribute("lang") == "es", "Lab must retain Spanish locale"
        assert page.locator("[data-lab-status='fictional-only']").count() == 1, "Synthetic disclaimer missing"
        assert "noindex" in (page.locator('meta[name="robots"]').get_attribute("content") or "").lower(), "Lab must remain noindex"

        score = page.locator("[data-sim-score]")
        csv = page.locator("#lab-csv")
        slider = page.locator("#lab-DXY")
        display = page.locator('[data-sim-row="DXY"] [data-sim-x]')
        row_initial = "DXY,0.125,900,900,1000,1100,1100,1120"
        row_changed = "DXY,0.125,900,900,1000,1100,1100,1130"
        assert score.inner_text().strip() == "0.4011", "Wrong initial fictional Score"
        assert slider.get_attribute("type") == "range", "DXY must use native range control"
        assert slider.input_value() == "1120", "Wrong initial DXY W6"
        assert display.inner_text().strip() == "1120", "Displayed DXY W6 mismatch"
        assert row_initial in csv.input_value().splitlines(), "Initial fictional CSV does not match input"

        # Unlike visual cursor automation, focus + ArrowRight targets the exact range element.
        slider.focus()
        assert page.evaluate("document.activeElement?.id === 'lab-DXY'"), "DXY slider not keyboard focusable"
        slider.press("ArrowRight")
        page.wait_for_function("""() => document.querySelector('#lab-DXY')?.value === '1130'
            && document.querySelector('[data-sim-score]')?.textContent?.trim() === '0.4088'""", timeout=10000)
        assert display.inner_text().strip() == "1130", "DXY W6 visible output not updated"
        assert row_changed in csv.input_value().splitlines(), "CSV did not update with changed W6"
        assert row_initial not in csv.input_value().splitlines(), "CSV retained stale default W6"

        page.locator("#lab-reset").click()
        page.wait_for_function("""() => document.querySelector('#lab-DXY')?.value === '1120'
            && document.querySelector('[data-sim-score]')?.textContent?.trim() === '0.4011'""", timeout=10000)
        assert display.inner_text().strip() == "1120", "Reset did not restore visible DXY"
        assert row_initial in csv.input_value().splitlines(), "Reset did not restore original CSV"
        assert ctx.cookies() == [], "Interaction should not set cookies"
        return {"route":"/score/lab/", "keyboard":"DXY 1120 -> 1130",
                "score":"0.4011 -> 0.4088 -> 0.4011",
                "csv":"updated and reset", "network":"loopback-only",
                "indexing":"noindex"}
    finally:
        ctx.close()


def reflow(browser, route):
    ctx, page = setup(browser, width=320)
    try:
        visit(page, route)
        found = []
        for width in (320, 390, 640, 768, 960, 961, 1280):
            page.set_viewport_size({"width":width,"height":844})
            page.wait_for_timeout(80)
            v = page.evaluate("() => ({width:window.innerWidth, client:document.documentElement.clientWidth, scroll:document.documentElement.scrollWidth})")
            found.append(v)
            assert v["scroll"] <= v["client"] + 2, f"{route}: overflow at width {width}: {v}"
        return {"route":route, "widths":found, "note":"320/640 CSS widths are reflow proxies for 400%/200% on 1280px; not actual browser zoom"}
    finally:
        ctx.close()

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=chrome, headless=True, args=["--no-sandbox","--disable-dev-shm-usage"])
        check("no-JS skip Tab-Enter across public pages", lambda: skips(browser, False))
        check("JS-on skip Tab-Enter across public pages", lambda: skips(browser, True))
        for width in (390, 768, 960):
            check(f"ES tablet/mobile {width}px Enter-Tab-Escape", lambda width=width: mobile_menu(browser, "es", width))
            check(f"EN tablet/mobile {width}px Enter-Tab-Escape", lambda width=width: mobile_menu(browser, "en", width))
        for width in (961, 1280):
            check(f"EN desktop {width}px Enter-Escape", lambda width=width: desktop_menu(browser, width))
        for width in (390, 760, 761, 768, 959, 960):
            for language in ("en", "es"):
                check(f"{language.upper()} no-JS header navigation reachable {width}px",
                      lambda width=width, language=language: nojs_navigation(browser, language, width))
        for width in (760, 761, 959, 960, 961):
            for language in ("en", "es"):
                check(f"{language.upper()} JS collapsed-header boundary {width}px",
                      lambda width=width, language=language: js_collapsed(browser, language, width))
        check("synthetic Score Lab native slider/CSV/reset", lambda: synthetic_score_lab_interaction(browser))
        for route in ("/", "/es/", "/news/", "/reports/", "/learn/", "/quiz/"):
            check("reflow " + route, lambda route=route: reflow(browser, route))
        browser.close()
finally:
    server.shutdown()

passed = sum(z["status"] == "PASS" for z in results)
print("EN_ES_BROWSER_QA " + json.dumps({"passed":passed,"total":len(results),"results":results},
                                      sort_keys=True), flush=True)
assert passed == len(results), f"Compiled-browser QA failed: {len(results)-passed} cases"
