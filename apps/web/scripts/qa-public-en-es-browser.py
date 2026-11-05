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
        assert all(c["name"] != "usd_impact_consent" for c in ctx.cookies()), "Consent was mutated"
        return {"routes":len(routes), "javascript":js}
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
        for route in ("/", "/es/", "/news/", "/reports/", "/learn/", "/quiz/"):
            check("reflow " + route, lambda route=route: reflow(browser, route))
        browser.close()
finally:
    server.shutdown()

passed = sum(z["status"] == "PASS" for z in results)
print("EN_ES_BROWSER_QA " + json.dumps({"passed":passed,"total":len(results),"results":results},
                                      sort_keys=True), flush=True)
assert passed == len(results), f"Compiled-browser QA failed: {len(results)-passed} cases"
