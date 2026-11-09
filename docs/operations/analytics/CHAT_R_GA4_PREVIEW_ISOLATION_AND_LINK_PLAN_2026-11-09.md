# Chat R — Analytics measurement integrity / Issue #1201 (DRAFT, no release)

**Review date:** 2026-11-09 UTC.  
**Authority:** Owner authorized **Gate A (existing GSC Wizard reporting-only property link)** and **Gate B (Draft-only remediation plan)**. **Gate C (actual env/code/tracking changes, deployment, merge, cleanup)** remains **NOT AUTHORIZED**.  
**Scope:** existing `www.usd-impact.com` EN/ES educational site; read-only evidence, one documentation-only Draft PR on `agent/*`. Do not implement, dispatch workflows, trigger paid calls, change analytics settings outside the explicitly approved reporting association, touch customer data, or claim legal certification.  
**Canonical issue:** https://github.com/usdimpact/usd-impact-site/issues/1201 — **KEEP OPEN**.

## 1. Ownership and immutable audit checkpoint

- **Protected Production:** `main@b845f841ce9f9d4b915b9c4a04a8548a3604c311`, Vercel deployment `dpl_B1nqWGMYXmpqevtykQ1KUf1XytVR`, **READY** when audited. The release remains unchanged.
- **Git source:** `apps/web/src/components/GoogleAnalyticsClient.astro`, `ConsentClient.astro`, `TelemetryClient.astro`, `BaseLayout.astro`, `apps/web/api/telemetry.js`, `apps/web/src/lib/telemetry-store.js`, `apps/web/src/data/localization-manifest.js`.
- **Vercel project:** `usd-impact-site`, one encrypted `PUBLIC_GA4_MEASUREMENT_ID` variable targets **production AND preview**, with no Preview branch constraint; **no value was requested/decrypted/disclosed**.
- **Source behavior:** Astro validates a `G-...` measurement ID and serializes a public hidden DOM config. On EN pages, GA4 loads only after affirmative consent. Spanish locale `analyticsEnabled:false` excludes GA4 and first-party telemetry through `BaseLayout`. Withdrawal sends denied Google consent update only following prior initialization, sets `ga-disable`, and attempts cookie cleanup.
- **Historic verification:** issue #1201 records a prior read-only same-ID comparison of Production/Preview built HTML. **No new authenticated live Preview network/HAR or real-user collection was performed for this review.**
- **First-party telemetry nuance:** Client sends optional `/api/telemetry` after consent. Current backend short-circuits **Preview checkout_*** events as non-durable; non-checkout events do **not** have an equivalent generic Preview guard in the handler. Whether Preview and Production use the **same Upstash Redis resource** (and whether Preview non-checkout events have persisted in Production counters) is **UNKNOWN**. Vercel env metadata and exact source do not prove the resource mapping, so do not claim actual contamination.
- **Ownership:** Master UI-12 owns SEO/GSC, UI-38 owns consent/privacy, Chat O owns website QA, Fundraising Chat I owns the existing `W3 ENGAGEMENT QA` design. Chat R owns only this bounded review. Do not claim implementation or overlap with Research, Daily #840, original Score, G2/G3 release governance or #950.

## 2. Gate A — existing-property reporting association

Current GSC Wizard connected account: `mircea.management@gmail.com`, GSC site `sc-domain:usd-impact.com`; readable GA4 **USD Impact — Web** property `properties/554833655` (`554833655`) exists. `list_ga4_properties` reports `linkedSiteUrls: []`; `get_ga4_overview` returns `notConfigured:true, reason:no_property`. Windsor.ai **also lists** GA4 property `554833655` and the same GSC domain as connected, but this does not provide GA4 metrics.

**Connector limitation:** Available GSC Wizard integration supports *listing* GA4 properties and *reporting*, but **does not expose a site-to-GA4 link mutation action**; `update_site` only accepts tags, branded keywords, sitemaps and crawl controls. Browser connector was unavailable. Thus Gate A was authorized **but not executed**. No substitute mutation was made.

**Manual owner action, reporting-only:**
1. Log into **https://tool.gscwizard.com** as `mircea.management@gmail.com`.
2. Select property `sc-domain:usd-impact.com` and open its **Analytics** configuration.
3. Link the **already existing** `USD Impact — Web` GA4 property **`554833655`**. Do not create another property, add a new data stream, modify collection/consent settings, enable paid features or reconnect unrelated accounts.
4. Read back that property's `linkedSiteUrls` includes `sc-domain:usd-impact.com`; rerun `get_ga4_overview`. If absent, stop and investigate account/session mismatch; if metrics unavailable, report **UNKNOWN**, not zero.
5. Before board attribution, confirm allowed website hostnames and remove or separately label Preview/non-production traffic historically present in the GA4 dataset. Do **not** claim the link cleans historic events.

**Acceptance:** exact property/site pair visible, reporting API no longer says `no_property`, no new collection or change to publishing. Reporting link changes analytics configuration **only**, not website GA4 injection.

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
| A08 | GSC Wizard after Gate A association | `linkedSiteUrls` contains domain, no `no_property`; property/hostname/date checks recorded, no fictitious revenue |
| A09 | Current Production consent/Spanish UX | Site QA owner confirms existing protections remain, with clean authenticated or synthetic HAR evidence and no real customer data |
| A10 | Future review/release | Exact-head CodeQL, built browser consent tests, owner privacy/infra approval, Git protection, Vercel READY and rollback, **only if separately authorized** |

The current offline tests include `test-ga4-consent-revocation.mjs`, `test-ga4-native-cookie-browser.py`, `test-ga4-compiled-astro-browser.py`, `test-consent-client-contract.mjs`, and `test-telemetry-function.mjs`. Their existence is **not** acceptance that A03/A05/historical Preview behavior has been tested. Never label author CI as an independent real-browser network capture.

## 5. Board reporting and source quality

**Search Console web property, 28 settled days through 2026-11-07:** **7 organic clicks, 3,686 impressions, 0.1899% CTR, average position 7.323**; two submitted sitemap entries each report 223 URLs, with 0 errors and 0 warnings. Do not sum sitemap index and child counts or treat deprecated `indexed:null` as 0.

**UNKNOWN:** Actual GA4 sessions/active users/key events, paid Research conversion/revenue, learner uniqueness, historical Preview share of sessions, first-party Preview/Production storage separation, genuine live cookie/network behavior, and actual indexed-page total. Neither a GSC click nor an event counter is a verified unique reader/customer.

## 6. Release and rollback gates — NOT APPROVED

**First separate owner review:** reporting-association readback, privacy owner consent-copy design, Vercel environment targets and resource-mapping evidence, exact test fixtures. Explicitly choose whether Preview will have no GA4 or a separate *subsequently approved* test property; require first-party telemetry isolation proof.

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

**Disposition:** Gate A pending owner UI association and readback. Gate B design-only Draft prepared; implementation and Gate C remain HOLD.
