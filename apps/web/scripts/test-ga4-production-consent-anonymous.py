#!/usr/bin/env python3
"""Anonymous live USD Impact consent audit. Does not read/print cookie values or payloads.

This is intentionally a non-production, Draft-PR-only Playwright test.
It changes consent only inside a disposable browser context of a GitHub runner.
Never use an authenticated browser profile, HAR recording, or credentials.
"""
import json
import os
import shutil
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ORIGIN="https://www.usd-impact.com"
URL=ORIGIN+"/privacy/"
OUT=Path(__file__).resolve().parents[1]/".ga4_live_network_qa"
TARGET="PRODUCTION_ANONYMOUS_CONSENT_NEGATIVE_TEST"
PHASES=("initial_no_choice","reject_reloaded","accept_consented","withdraw_reloaded")
signals=defaultdict(lambda:{"tag_script_requests":0,"ga4_collect_requests":0})
phase="initial_no_choice"
pages=[]
errors=[]
def kind(url):
    parsed=urlsplit(url)
    host=(parsed.hostname or "").lower()
    path=parsed.path.lower()
    if host=="www.googletagmanager.com" and path.startswith("/gtag/js"):
        return "tag_script_requests"
    if host.endswith(".google-analytics.com") or host=="google-analytics.com":
        return "ga4_collect_requests"
    if host.endswith(".google.com") and ("/g/collect" in path or "/ccm/collect" in path):
        return "ga4_collect_requests"
    return None

def check(value,label):
    if not value:
        raise AssertionError(label)

def capture(ctx,page,stage):
    cookies=ctx.cookies([ORIGIN])
    names={str(c.get("name","")) for c in cookies}
    count=sum(name=="_ga" or name.startswith("_ga_") for name in names)
    state=page.evaluate("""() => ({
      allowed: window.USDImpactConsent?.analyticsAllowed?.() ?? null,
      preference: window.USDImpactConsent?.preference?.() ?? 'missing',
      gaTag: !!document.getElementById('usd-impact-ga4-script'),
      gaConfigured: !!document.getElementById('usd-impact-ga4-config'),
    })""")
    return {
      "phase":stage,
      "consent_analytics_allowed":state["allowed"],
      "consent_state":state["preference"],
      "ga_tag_script_present":state["gaTag"],
      "ga_public_config_present":state["gaConfigured"],
      "ga_cookie_count":count,
      "consent_cookie_present":"usd_impact_consent" in names,
      "vendor_request_counts":dict(signals[stage]),
    }

def load(page):
    resp=page.goto(URL,wait_until="domcontentloaded",timeout=45000)
    check(resp and resp.status==200,"Live public Privacy returned non-200")
    page.wait_for_function("typeof window.USDImpactConsent?.analyticsAllowed === 'function'",timeout=15000)
    page.wait_for_timeout(1800)

try:
    with sync_playwright() as p:
        chrome=next((shutil.which(n) for n in ("google-chrome","google-chrome-stable","chromium","chromium-browser") if shutil.which(n)),None)
        check(chrome is not None,"Runner Chromium/Chrome missing")
        browser=p.chromium.launch(executable_path=chrome,headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        try:
            ctx=browser.new_context(service_workers="block",viewport={"width":1280,"height":900},
                                    locale="en-US",timezone_id="Europe/Athens",ignore_https_errors=False)
            page=ctx.new_page()
            def on_request(req):
                signal=kind(req.url)
                if signal:
                    signals[phase][signal]+=1
            ctx.on("request",on_request)
            page.on("pageerror",lambda e:errors.append(type(e).__name__))
            load(page)
            page.locator("#privacy-consent-banner").wait_for(state="visible",timeout=10000)
            check(page.locator("#privacy-consent-reject").is_visible(),"Reject action not visible on first visit")
            check(page.locator("#privacy-consent-accept").is_visible(),"Accept action not visible on first visit")
            first=capture(ctx,page,phase)
            pages.append(first)
            check(first["consent_analytics_allowed"] is False and first["consent_state"]=="unset","Fresh visit must default to denied")
            check(not first["ga_tag_script_present"] and first["ga_cookie_count"]==0,"GA tag or GA cookie before consent")
            check(not any(first["vendor_request_counts"].values()),"GA vendor request before consent")

            page.locator("#privacy-consent-reject").click()
            phase="reject_reloaded"
            load(page)
            rejected=capture(ctx,page,phase)
            pages.append(rejected)
            check(rejected["consent_state"]=="denied" and rejected["consent_analytics_allowed"] is False,"Reject not persistent")
            check(rejected["consent_cookie_present"] and rejected["ga_cookie_count"]==0,"Reject cookie missing or GA cookie exists")
            check(not rejected["ga_tag_script_present"] and not any(rejected["vendor_request_counts"].values()),"GA traffic/tag after Reject")

            phase="accept_consented"
            page.locator("#privacy-settings-button").click()
            page.locator("#privacy-consent-analytics").check()
            page.locator("#privacy-consent-save").click()
            page.wait_for_timeout(2500)
            page.reload(wait_until="domcontentloaded",timeout=45000)
            page.wait_for_timeout(2500)
            accepted=capture(ctx,page,phase)
            pages.append(accepted)
            check(accepted["consent_state"]=="granted" and accepted["consent_analytics_allowed"] is True,"Accept not persisted")
            # Property may have no configured GA4 tag; in that case acceptance's network part is UNVERIFIED.
            if accepted["ga_public_config_present"]:
                check(accepted["ga_tag_script_present"],"Consent granted, configured GA4 tag not inserted")
                check(accepted["vendor_request_counts"].get("tag_script_requests",0)>=1,
                      "Consent granted, configured GA4 script network request not attempted")

            page.locator("#privacy-settings-button").click()
            page.locator("#privacy-consent-analytics").uncheck()
            page.locator("#privacy-consent-save").click()
            # Allow previously consented requests to settle BEFORE the new reload measurement.
            page.wait_for_timeout(1200)
            phase="withdraw_reloaded"
            load(page)
            withdrawn=capture(ctx,page,phase)
            pages.append(withdrawn)
            check(withdrawn["consent_state"]=="denied" and withdrawn["consent_analytics_allowed"] is False,"Withdraw not persisted")
            check(withdrawn["consent_cookie_present"] and withdrawn["ga_cookie_count"]==0,
                  "GA cookies still present after Withdraw + reload")
            check(not withdrawn["ga_tag_script_present"],"GA script reloaded despite Withdraw")
            check(not any(withdrawn["vendor_request_counts"].values()),"New GA requests after Withdraw + reload")
            check(not errors,"Browser JavaScript page errors occurred")
            ctx.close()
        finally:
            browser.close()
    result={
      "method":TARGET,
      "target":"www.usd-impact.com/privacy/",
      "exact_customer_data_read":False,
      "cookie_values_saved":False,
      "network_query_strings_saved":False,
      "raw_har_or_credentials_saved":False,
      "browser_profile":"fresh_disposable_anonymous",
      "production_settings_or_content_changed":False,
      "phases":pages,
      "ui_consent_pass":True,
      "network_negative_test_pass":True,
      "cookie_names_negative_test_pass":True,
      "accept_ga4_tag_request_observed":bool(pages[2]["vendor_request_counts"].get("tag_script_requests",0)),
      "accept_ga4_collect_request_observed":bool(pages[2]["vendor_request_counts"].get("ga4_collect_requests",0)),
      "google_analytics_collection_after_accept":"ATTEMPTED" if pages[2]["vendor_request_counts"].get("ga4_collect_requests",0) else "UNVERIFIED_NO_COLLECT_OBSERVED",
      "scope_limit":"Single runner vantage and one fresh browser; not 24h monitoring, legal clearance or all-geography proof",
      "status":"PASS_ONE_VANTAGE_NEGATIVE_TEST_NOT_LEGAL_CERTIFICATION",
    }
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/"redacted-production-consent-report.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print("GA4_LIVE_READONLY_QA "+json.dumps({
       "status":result["status"],
       "privacy_ui":True,
       "no_unconsented_ga_requests":True,
       "ga_cookie_cleanup_after_withdraw":True,
       "phases":[{"name":x["phase"],"state":x["consent_state"],"ga_cookie_count":x["ga_cookie_count"],
                  "tag_requests":x["vendor_request_counts"].get("tag_script_requests",0),
                  "collect_requests":x["vendor_request_counts"].get("ga4_collect_requests",0)} for x in pages]
    }))
except Exception as e:
    OUT.mkdir(parents=True,exist_ok=True)
    failure={
      "status":"FAIL_OR_UNVERIFIED",
      "error_type":type(e).__name__,
      "redacted_reason":str(e).split("\n")[0][:180] if isinstance(e,AssertionError) else "Automation/environment failure; inspect controlled job step",
      "phases":[{"phase":x["phase"],"ga_cookie_count":x["ga_cookie_count"],
                  "request_counts":x["vendor_request_counts"]} for x in pages],
      "no_credentials_or_cookie_values_logged":True,
      "production_changes":False,
    }
    (OUT/"redacted-production-consent-report.json").write_text(json.dumps(failure,indent=2)+"\n",encoding="utf-8")
    print("GA4_LIVE_READONLY_QA "+json.dumps(failure))
    raise SystemExit(1)
