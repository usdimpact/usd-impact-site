# Chat R — Analytics measurement integrity / Issue #1201 (DRAFT, no release)

**Review date:** 2026-11-09 UTC.  
**Authority:** Owner authorized **Gate A (existing GSC Wizard reporting-only property link)** and **Gate B (Draft-only remediation plan)**. **Gate A COMPLETED and read back on 2026-11-09** when the owner selected and saved the existing property. **Gate C (actual env/code/tracking changes, deployment, merge, cleanup)** remains **NOT AUTHORIZED**.  
**Scope:** existing `www.usd-impact.com` EN/ES educational site; read-only evidence, one documentation-only Draft PR on `agent/*`. Do not implement, dispatch workflows, trigger paid calls, change analytics settings outside the explicitly approved reporting association, touch customer data, or claim legal certification.  
**Canonical issue:** https://github.com/usdimpact/usd-impact-site/issues/1201 — **KEEP OPEN**.

## 1. Ownership and immutable audit checkpoint

- **Protected Production:** `main@b845f841ce9f9d4b915b9c4a04a8548a3604c311`, Vercel deployment `dpl_B1nqWGMYXmpqevtykQ1KUf1XytVR`, **READY** when audited. The release remains unchanged.
- **Git source:** `apps/web/src/components/GoogleAnalyticsClient.astro`, `ConsentClient.astro`, `TelemetryClient.astro`, `BaseLayout.astro`, `apps/web/api/telemetry.js`, `apps/web/src/lib/telemetry-store.js`, `apps/web/src/data/localization-manifest.js`.
- **Vercel project:** `usd-impact-site`, one encrypted `PUBLIC_GA4_MEASUREMENT_ID` variable targets **production AND preview**, with no Preview branch constraint; **no value was requested/decrypted/disclosed**.
- **Source behavior:** Astro validates a `G-...` measurement ID and serializes a public hidden DOM config. On EN pages, GA4 loads only after affirmative consent. Spanish locale `analyticsEnabled:false` excludes GA4 and first-party telemetry through `BaseLayout`. Withdrawal sends denied Google consent update only following prior initialization, sets `ga-disable`, and attempts cookie cleanup.
- **Historic verification:** issue #1201 records a prior read-only same-ID comparison of Production/Preview built HTML. **New connected first-party GA4 report proof (Oct 12–Nov 8): 3 sessions and 16 page views occurred on three Vercel Preview deployment hostnames**; Vercel independently verified all three against READY `review/*` branches with `target:null`, not protected Production. This establishes observed historical Preview measurement contamination, **not** a pre-consent breach or a current live network/HAR capture. No authenticated browser/cookie capture or new real-user collection was performed.
- **First-party telemetry nuance:** Client sends optional `/api/telemetry` after consent. Current backend short-circuits **Preview checkout_*** events as non-durable; non-checkout events do **not** have an equivalent generic Preview guard in the handler. Whether Preview and Production use the **same Upstash Redis resource** (and whether Preview non-checkout events have persisted in Production counters) is **UNKNOWN**. Vercel env metadata and exact source do not prove the resource mapping, so do not claim actual contamination.
- **Ownership:** Master UI-12 owns SEO/GSC, UI-38 owns consent/privacy, Chat O owns website QA, Fundraising Chat I owns the existing `W3 ENGAGEMENT QA` design. Chat R owns only this bounded review. Do not claim implementation or overlap with Research, Daily #840, original Score, G2/G3 release governance or #950.

## 2. Gate A — existing-property reporting association

Current GSC Wizard connected account: `mircea.management@gmail.com`, GSC site `sc-domain:usd-impact.com`; readable GA4 **USD Impact — Web** property `properties/554833655` (`554833655`) exists. **After the owner's reporting-only Save**, the independently refreshed `list_ga4_properties` reports `linkedSiteUrls: ['sc-domain:usd-impact.com']`; `get_ga4_overview` now returns real GA4 metrics, not `no_property`. Windsor.ai independently also lists the same GA4 property and domain as connected; its Free-tier connection visibility is not the verified source for this period's metrics.

**Connector limitation resolved by owner UI action:** The GSC Wizard integration supports *listing* GA4 properties and *reporting*, but does **not** expose a site-to-GA4 link mutation; `update_site` only accepts tags, branded keywords, sitemaps and crawl controls. The owner used the existing GSC Wizard Analytics page to select and Save the already existing property. Subsequent read-only connector calls verified the correct association and metrics. Chat R did not change another account, property, stream, website tag, consent, or Vercel settings.

**Completed owner action / readback:**
1. Owner selected **USD Impact — Web** (`554833655`) for `sc-domain:usd-impact.com` and clicked **Save** in the existing Analytics page.
2. GSC Wizard readback: `linkedSiteUrls` now contains the exact domain. GA4 overview returned **22 sessions, 18 active users, 95 page views, 212 events, 0 key events**, 72.7% engagement in Oct 12–Nov 8.
3. The full property totals include **3 Preview sessions and 16 Preview page views**; for live website-only board metrics, apply explicit `hostName` filter `www.usd-impact.com` to obtain **19 sessions, 15 active users, 79 page views**, approximately 73.7% engagement and 0 key events. Do not sum active users between hostnames.
4. The three Preview hostname rows were validated against Vercel review branch deployments; two Preview sessions were in the GA4 **AI Assistant** channel and one Preview session in **Direct**, so unfiltered attribution is not Production-only. The channel breakdown is observational, not a source-level identity or revenue proof.

**Acceptance:** Gate A PASS for reporting association and working API. The link does not change website tracking or retroactively remove Preview measurements.

## 3. Gate B — design choices (DRAFT ONLY)

**Preferred fail-closed design (future approval required):** Scope the existing `PUBLIC_GA4_MEASUREMENT_ID` to **Production only**. In new Preview builds, leave it **unset**; no fallback to Production, no hostname-substring bypass and no new GA4 property. This addresses future Preview GA4 injection but **does not retroactively scrub older Preview bundles**.

**Alternative held:** A separately approved, dedicated synthetic-only GA4 test property for Preview. Creating an additional property/stream is not approved by Gates A/B and is NOT REQUIRED for the preferred option.

**Companion isolation risk:** Removing the Preview GA4 ID does **not** disable English first-party `TelemetryClient`, which is consent-gated independently. Before any code change or release, have UI-38 and existing telemetry owner decide whether ALL optional Preview events must be short-circuited *before durable storage* (currently only `checkout_*` are guarded), or whether a truly distinct, verified Preview-only store is sufficient. For now **no backend change**. Do not weaken checkout guards or production learning flow.

**Consent-copy issue:** In a Preview with GA4 unset, English consent UI may still truthfully govern first-party telemetry; do not change legal copy without explicit privacy/editorial sign-off. Spanish analytics must remain unavailable in every environment.

## 4. Verification and negative acceptance specification (NOT RUN)

| ID | Isolated future condition | Required evidence |
| --- | --- | --- |
| A01 | Production-like compiled Astro, synthetic GA4 ID, EN first visit | No Google or `/api/telemetry` before consent; after opt-in, only permitted events; no ads consent |
| A02 | Production-like compiled Astro, consent withdraw/reload | Explicit denied Google consent after prior init; no further optional events; stale GA cookies removed where technically possible |
| A03 | Preview compiled with ID **unset**, EN reject/accept/withdraw | No `#usd-impact-ga4-config`, no `gtag/js`, no GA4 collect beacon after **any** consent choice |
| A04 | Preview, ES (with or without ID) | No analytics accept toggle, GA4 ID/config, Google beacon or first-party telemetry |
| A05 | Preview EN with optional first-party events, isolated synthetic store | No cross-environment durable counter writes; prove actual Upstash resource binding or fail closed |
| A06 | Preview versus Production checkout events | Existing Preview non-durable checkout guard PASS; Production authorized paths unchanged |
| A07 | Existing historical protected Previews | Inventory compiled artifact scope, access protection, retention/expiration, and any GA4 exposure; propose non-destructive disposition; no bulk deletion |
| A08 | GSC Wizard after Gate A association | **PASS 2026-11-09:** `linkedSiteUrls` contains the domain and live GA4 overview works. Continue hostName/date filtering; do not infer real revenue |
| A09 | Current Production consent/Spanish UX | Site QA owner confirms existing protections remain, with clean authenticated or synthetic HAR evidence and no real customer data |
| A10 | Future review/release | Exact-head CodeQL, built browser consent tests, owner privacy/infra approval, Git protection, Vercel READY and rollback, **only if separately authorized** |

The current offline tests include `test-ga4-consent-revocation.mjs`, `test-ga4-native-cookie-browser.py`, `test-ga4-compiled-astro-browser.py`, `test-consent-client-contract.mjs`, and `test-telemetry-function.mjs`. Their existence is **not** acceptance that A03/A05/historical Preview behavior has been tested. Never label author CI as an independent real-browser network capture.

## 5. Board reporting and source quality

**Search Console web property, 28 settled days through 2026-11-07:** **7 organic clicks, 3,686 impressions, 0.1899% CTR, average position 7.323**; two submitted sitemap entries each report 223 URLs, with 0 errors and 0 warnings. Do not sum sitemap index and child counts or treat deprecated `indexed:null` as 0.

**VERIFIED GA4 reporting after Gate A:** Oct 12–Nov 8 inclusive: **22 total sessions, 18 active users, 95 page views, 212 events, engagement 72.7%, key events 0**. Host breakdown: **Production hostname `www.usd-impact.com`: 19 sessions, 15 active users, 79 page views, engagement 73.7%, 0 key events**. Three separate Vercel Preview hostnames: **one session each; page views 5, 1, and 10 (16 total)**. Preview thus accounts for **3/22 = 13.6% of sessions** and **16/95 = 16.8% of page views** in unfiltered GA4. Dates: Preview activity on Nov 1 and Nov 4. Vercel lookups matched all three hostnames to review branch deployments (`target:null`). The GA4 AI Assistant channel includes **7 property-wide sessions**, two on Preview hosts; **5** on `www.usd-impact.com`. Prior comparison period has **no data**, so any infinite growth markers are not meaningful.

**UNKNOWN / NOT PROVED:** Actual purchaser conversion/revenue, unique learners, whether real people versus testers visited, consent legality/cookie HAR, first-party Preview/Production aggregate storage separation, fully verified indexed-page total. The GA4 key event count of 0 is *not* proof of zero merchant orders; neither a GSC click nor an event counter is a verified unique reader/customer.

## 6. Release and rollback gates — NOT APPROVED

**First separate owner review:** Gate A readback **COMPLETE**, privacy owner consent-copy design, Vercel environment targets and resource-mapping evidence, exact test fixtures. Explicitly choose whether Preview will have no GA4 or a separate *subsequently approved* test property; require first-party telemetry isolation proof.

**Then (only on a new exact-scope GO):** isolate implementation in a new reviewed Draft; no production/shared env edits until approval of target and rollback. Baseline all env target metadata and prior published deployment SHAs without revealing values. Run exact-head synthetic/native browser and source-grant validation, including EN/ES and historical preview treatment. Separate protected merge/Production approval and post-deployment controls required. Existing direct no-deploy merges to main remain BLOCK under G3 governance.

**Rollback:** do not reflexively restore Preview's access to Production GA4—that would reintroduce the contamination risk. A failed change should hold new Previews / preserve Production settings until privacy and infrastructure owners authorize a verified correction, and update evidence with exact build identities. No force/admin bypass.

## 7. Hard stops and evidence

- **No code, Vercel env mutation, Google collection changes, Production action, GA4 reconfiguration beyond the separately approved owner-operated reporting association, connected-account reconnect, shared cache/storage reset, customer query, secrets, paid APIs, new project, merge, deploy, dispatch or issue closure.**
- Draft documentation does **not** lift Score, Research, Site EAA, Daily, #950 or any other hold.
- Vercel: https://vercel.com/usd-impact/usd-impact-site/B1nqWGMYXmpqevtykQ1KUf1XytVR
- GitHub issue: https://github.com/usdimpact/usd-impact-site/issues/1201
- Source: https://github.com/usdimpact/usd-impact-site/blob/b845f841ce9f9d4b915b9c4a04a8548a3604c311/apps/web/src/components/GoogleAnalyticsClient.astro
- Source: https://github.com/usdimpact/usd-impact-site/blob/b845f841ce9f9d4b915b9c4a04a8548a3604c311/apps/web/src/components/TelemetryClient.astro
- Backend: https://github.com/usdimpact/usd-impact-site/blob/b845f841ce9f9d4b915b9c4a04a8548a3604c311/apps/web/api/telemetry.js
- Master: https://docs.google.com/spreadsheets/d/1uDvVlmbqPONI6a7YWrbhQlwGt9QSn4qBtnYSx87NlcA/edit
- Fundraising: https://docs.google.com/spreadsheets/d/1CQBMA-7hqN9qsy2Xt9yBGjlo08EuLluG2DEDnKVItKk/edit

**Disposition:** Gate A **COMPLETE and independently verified by GSC Wizard API**; GA4 reporting active with **confirmed 3 Preview sessions / 16 Preview page views** in the historic 28-day window. Gate B design-only Draft prepared; implementation and Gate C remain **HOLD**. No Production, provider, consent, tracking, merchant or Vercel settings were modified by Chat R.
