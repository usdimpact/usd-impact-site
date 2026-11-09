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

---

## 8. Post-implementation independent handoff — 2026-11-09

This section supersedes older draft-only **status** statements above where they predate the separate implementation PR. It does not amend or waive any release hold.

### Latest exact-head evidence

- [Implementation PR #1217](https://github.com/usdimpact/usd-impact-site/pull/1217) remains **OPEN / DRAFT / UNMERGED**, with six files changed, base `b845f841ce9f9d4b915b9c4a04a8548a3604c311`, exact head `699627f8b3648d3c9895d21d905f6976da6cc48c`.
- Six **author-run GitHub workflows** succeeded at that exact head: CodeQL, Web Quality, GA4 compiled Astro native-cookie browser QA, GA4 native-cookie QA, Dependency review, and Supabase Production migration intake guard (no database access). The compiled workflow separately built a synthetic Production target and a synthetic Preview target with an intentionally mis-scoped test GA4 ID, and its Preview browser checks passed. This is test evidence, **not independent real-Vercel release acceptance**.
- Vercel reports **zero deployment records** for the #1217 head. Production remains **READY** on `b845f841` at deployment `dpl_B1nqWGMYXmpqevtykQ1KUf1XytVR`. The live Production GA4 source is still the old unmodified code.
- Encrypted `PUBLIC_GA4_MEASUREMENT_ID` metadata still lists targets `production` **and** `preview`. No environment modification was performed. GSC Wizard's existing `properties/554833655` link to `sc-domain:usd-impact.com` remains active.
- No GitHub PR review submissions or issue #1201 comments were found as of this read-only check, so **owner/privacy/infrastructure acceptance is NOT evidenced**.
- Project setting metadata reports SSO Protection **enabled** with `deploymentType=all_except_custom_domains`, Password Protection **disabled**. This is a project setting, not an access verification for every historical URL.

### Historical deployment inventory (read-only, non-destructive)

Vercel Preview deployment history for **2026-11-01 through 2026-11-09 UTC** returned **386 distinct deployment records** across the paginated query: **265 READY, 121 ERROR**. The records' Git target is `preview` / deployment `target:null`. These are **possible old-build candidates, not 386 proven GA4-contaminated deployments**. No HTML was downloaded from protected Previews and no deployment was deleted.

Three **specifically verified** GA4 hostname rows in Oct 12–Nov 8 map to READY Vercel review-branch deployments:

| GA4 observed hostname | Vercel deployment ID | Branch (historical) | Observed GA4 sessions / page views |
| --- | --- | --- | --- |
| `usd-impact-site-9tujyujhs-usd-impact.vercel.app` | `dpl_FG2CgGjBcwqbmVFsaqRSugikEYiJ` | `review/wave5-start-here-five-min-20261105` | 1 / 5 |
| `usd-impact-site-git-review-ui39-public-en-es-351836-usd-impact.vercel.app` (alias) | `dpl_8MBjN4Dk8jyk6VB787GPL8q5pfdX` | `review/ui39-public-en-es-shell-20261101` | 1 / 1 |
| `usd-impact-site-rdcyopusn-usd-impact.vercel.app` | `dpl_Ge3iH9Rv4aWcyDNSGAfW25MuisLY` | `review/wave5-start-here-five-min-20261105` | 1 / 10 |

The confirmed Preview share is 3/22 GA4 sessions (13.6%) and 16/95 GA4 page views (16.8%) for the period. These observations establish GA4 Preview measurement contamination, **not consent failure, unauthorized access, or 386 affected artifacts**.

**Non-destructive follow-up:** Using existing protected administrative review, inventory historical artifact IDs/accessible custom aliases, access policy, expiry/retention, whether the GA4 DOM bridge was compiled, and any additional GA4 hostname rows. Do not bypass protection, access user data, delete or rebuild deployments, or change DNS. Existing historical artifacts are not fixed by changing an environment-variable target because Vercel env changes apply only to new deployments; see [official documentation](https://vercel.com/docs/environment-variables).

### Mandatory acceptance questions before any merge, target change or Production release

1. **Actual Vercel system variable:** Official [Vercel documentation](https://vercel.com/docs/environment-variables/system-environment-variables) states `VERCEL_ENV` exists at build and runtime when automatic system-variable exposure is enabled. The connected project-details tool did **not** expose this setting. **Verify it is actually available to this Production build before any merge**. If not, the fail-closed new code would suppress GA4 on Production. Do not print variable values or modify settings during this review. Synthetic CI `VERCEL_ENV=production` alone is insufficient.
2. **Independent nonauthor review:** An existing owner/privacy/infrastructure reviewer needs to accept the exact six-file diff, English/Spanish consent presentation, Production parity, telemetry policy change, and all 10 test claims; no owner review was evidenced.
3. **Preview telemetry persistence:** The proposed application guard returns 202 non-durable for all non-Production POST events. This does not itself prove that historic Preview Redis counts were separate, nor does it address protected aggregate read APIs. Verify any read path and resource scope separately without secret retrieval/customer data.
4. **Historical treatment:** Decide separately which historical Preview artifacts remain protected, need future expiry, or should be left untouched. Do not destructively delete them on this authorization.
5. **New deployment configuration:** Once a separate release GO exists and correct build targeting is verified, authorize removal of `preview` from the *existing* `PUBLIC_GA4_MEASUREMENT_ID` target, preserving `production`. Do not invent an alternate Production GA4 ID or add a test property under this task.
6. **Safe release governance:** G3 direct `main` no-deployment merge remains BLOCK; do not merge #1217, dispatch workflows, deploy, change Vercel settings, disable access protection, or approve an untested rollback. Any future exact-head release must have a separately recorded owner GO and Production regression/rollback evidence.

**Current disposition:** Gate A reporting link **COMPLETE**; Gate B Draft code + 6/6 author CI **COMPLETE**; independent release acceptance, environment configuration, and historical Preview treatment **NOT COMPLETE**. **Gate C / Issue #1201 REMAIN HOLD**. No further engineering branch is needed until the owners resolve these explicit acceptance questions.

---

## 9. Approved GA4 environment-target correction — 2026-11-09

**Owner authorization:** On 2026-11-09 the owner explicitly approved continuation after review of the remaining isolated-release steps. Chat R made **one narrowly scoped Vercel project setting correction** to prevent the Production GA4 measurement ID from being supplied to future Preview builds. **No application release authorization was inferred.**

**Exact change:** In existing project `usd-impact-site` (`prj_ZoLLM35ksI6wk17PcfS2xYknaVl7`), edit the existing encrypted variable `PUBLIC_GA4_MEASUREMENT_ID` (Vercel ID `WyFODAqW0Xmnr8Ms`) from targets `['production','preview']` to `['production']`. No value, type, key, branch, credentials or unrelated environment variable was changed. The variable's value was never requested, decrypted or displayed.

**Readback:** A fresh `filter_project_envs(decrypt:false)` call verified **exactly one** GA4 variable with `target:['production']`, `type:'encrypted'`, same Vercel variable ID. Existing Production deployment `dpl_B1nqWGMYXmpqevtykQ1KUf1XytVR` remained `READY` on `main@b845f841ce9f9d4b915b9c4a04a8548a3604c311`; no new deployment at #1217 head `699627f8b3648d3c9895d21d905f6976da6cc48c`. #1217 remained OPEN/DRAFT/UNMERGED; issue #1201 remained OPEN. GSC Wizard still linked the preexisting GA4 property `554833655` to `sc-domain:usd-impact.com`.

**Effective scope:** The environment-target correction removes that Production ID from the **configured Preview environment for newly built deployments**. Existing Preview artifacts can retain old compiled IDs. The Vercel Production deployment is not rebuilt by a target edit. The additional #1217 source guard and telemetry ingress guard are still **Draft-only / NOT LIVE**.

**Remaining validation and release holds:**
1. Verify the real Vercel Production build target exposes `VERCEL_ENV=production`; official docs describe this as build-time available, but the current connector did not expose the project's automatic system environment exposure flag. Do not merge a change that could silently suppress Production GA4 when unverified.
2. Obtain independent privacy and infrastructure review of #1217's exact six-file change and its 6/6 **author** CI; confirm Source/Preview-only behavior, first-party telemetry and connected consent restrictions.
3. Require new Preview behavior evidence from a separately authorized safe artifact/deployment; the existing `agent/*` branch is intentionally not Vercel-deployed. Do not bypass SSO, dispatch workflows or generate a Preview as a side effect of this audit.
4. Non-destructively resolve older Preview artifact exposure; documented 386 Preview records are **not** 386 proven GA4 leaks.
5. Preserve G3 prohibition on direct merge-to-main deployment, separate actual release/rollback GO, and all other project NO-GO holds.

**Disposition:** Gate A association COMPLETE; GA4 environment target narrowed to Production-only and **verified**; Gate B Draft code + synthetic QA COMPLETE; **Gate C merge/release remains HOLD**. This addendum supersedes earlier statements that the GA4 variable still targets both environments.

---

## 10. Independent NO-GO review and bounded F1/F2 fixes (2026-11-09)

**Independent evidence received:** An external nonauthor reviewer cloned the public repository read-only and reviewed exact baseline `b845f841` versus implementation head `699627f8`, using only local synthetic fixtures (`G-TEST1234`, fake tokens) and no connected GitHub/Vercel credentials. Their verdict was **NO-GO**. They did **not** independently verify hosted CI and did **not** authorize release.

- **F1 / P1 confirmed:** A local build with `VERCEL_ENV` unset but a configured ID produced zero GA4 bridges across 300 HTML pages and exited successfully. The draft original code could silently suppress Production GA4 if system build variables were unavailable.
- **F2 / P2, potentially P1 if shared store:** All three authenticated GET report routes (`report`, `checklist-report`, `checkout-funnel-report`) remained reachable from synthetic Preview context, with aggregate reads invoked. Shared KV bindings were **not verified**; this does **not** prove customer-data exposure.
- **F3 governance:** `main` remains deploy-triggering; G3–G6 still HOLD; no PR merge permitted.
- **F4 privacy:** English Preview consent choices persist although GA4 and telemetry are deliberately inert. A privacy-owner UI-38 decision is required; no consent text changed.
- **F5 paperwork:** PR #1217 description incorrectly described the GA4 environment variable as targeting both environments; the body was corrected after verified Production-only targeting.

**Bounded remediation only in existing Draft PR #1217:**
- `GoogleAnalyticsClient.astro`: fail loudly with `GA4_BUILD_ENV_UNRESOLVED` when the Vercel build marker or a configured GA4 ID is present but `VERCEL_ENV` cannot be resolved, and `GA4_PRODUCTION_ID_MISSING` when Production lacks a configured ID. This prevents a silent Production output loss without injecting analytics into Preview/Development.
- `verify-production-build.mjs`: for a known Production target, verify that compiled public homepage contains the expected GA4 bridge, without logging the ID.
- `api/telemetry.js`: all three GET aggregate reports fail closed with 404 outside Production **before** bearer-token evaluation and Upstash access. GET reporting uses dedicated `TELEMETRY_REPORT_TOKEN` only; no `NEWSFEED_BEARER_TOKEN` fallback. Existing non-Production POST non-durable guard remains.
- Synthetic regression tests cover 12 non-Production GET denials with zero aggregate reads, legacy token fallback denial, and `VERCEL=1` with unset `VERCEL_ENV` / fictional ID requiring build failure.
- A stale checklist dashboard source-contract test was updated to the new privilege separation after the first revised Web Quality run failed, and the Phase 2 telemetry operations documentation was reconciled in the Draft. **Production credential readiness remains UNVERIFIED** because Vercel's read-only environment listing is capped.

**Current candidate head after focused corrections:** `ab88f2ae78a92fb088cc194bd9a978f2a6a161ad` in PR #1217, containing nine changed files. The original author's six successful checks on old head `699627f8` **must not** be counted as acceptance of the revised candidate. As of the evidence check, four revised-head workflows had passed and CodeQL / compiled Astro browser QA were still in progress. Recheck all exact-head checks before owner decision; if further changes occur, this checkpoint becomes historical.

**Remaining conditional GO prerequisites:**
1. Metadata-only owner readback of the actual Vercel project setting exposing `VERCEL_ENV` to Production builds. Official Vercel docs alone are insufficient for a project-specific assertion.
2. Verify a dedicated **Production-scoped** `TELEMETRY_REPORT_TOKEN` already exists and identify legitimate dashboard readers; without it, the new Draft's Production GET reports will return 503. Do not print, copy or rotate any tokens without separate authorization.
3. Independent nonauthor re-review of the **new exact head**, including CI log verification. The independent reviewer asked for this once F1 and F2 changes were available; author CI alone is not independent sign-off.
4. Privacy owner UI-38 decision on English Preview consent presentation.
5. Review access policy of historical protected Preview artifacts; **no deletion or forced cleanup** under Chat R.
6. Separate G3-governed release authorization with explicit Production parity and rollback checks. Direct `main` no-deployment merges and release remain BLOCK; #1201 stays OPEN.

**Disposition:** New F1/F2 source fixes are Draft-only and not yet accepted for deployment. GA4 Vercel variable remains Production-only, previous Production deployment intact, no new Preview, no Production or Vercel mutation from these Draft commits.


---

## 11. Second independent review, owner D1 policy, and D2/D3 test closure

**Date:** 2026-11-09 UTC. All new changes remain **Draft-only** in the existing implementation PR #1217, and do not change the live GA4/telemetry runtime.

A separate nonauthor reviewer independently rebuilt implementation head `ab88f2ae78a92fb088cc194bd9a978f2a6a161ad` against protected `main@b845f841`, using fictional IDs and tokens. Their verdict: **conditional source-code PASS / release NO-GO**. They reproduced key F1/F2 protections and showed the Production compiled output was byte-identical to the base when `VERCEL_ENV=production`; the external reviewer could not fetch authenticated GitHub workflows in their environment. Connected GitHub independently verified the six original exact-head workflows by reading live run records.

**Independent remaining findings at their reviewed head:**

- **D1 (P2, OWNER DECISION / RELEASE BLOCK):** the proposed `GA4_PRODUCTION_ID_MISSING` guard makes every Production deploy, including unattended Daily publication, depend on the optional GA4 ID. It is a deliberate availability coupling and requires the owner's explicit choice: **A** retain mandatory Production GA4 (missing ID means fail build) or **B** make GA4 optional so a Production build with no ID succeeds with GA4 disabled, while configured-ID builds with unresolved environment still fail loudly. Both strategies must preserve EN consent, ES analytics-off, Preview ID exclusion, and Production parity when ID is supplied. This policy was NOT selected by Chat R.
- **D2 (P3):** old tests did not prove Preview reporting guards execute *before* missing-token validation; a mutation moved the guards later and tests still passed.
- **D3 (P3):** the direct legacy-Newsfeed-token rejection test covered only one of three reporting GET actions, despite the source contract covering all three.
- **F4 owner privacy:** English Preview consent choice with inactive analytics remains an owner design decision, not legal certification. Historic Preview artifacts retain individual access/retention decision gates.
- **External:** still unverified: real Production system-variable exposure, Production-scoped dedicated `TELEMETRY_REPORT_TOKEN` metadata (the connected env list is capped), and independent G3-governed deployment authorization.

**Draft-only D2/D3 repair** at new exact implementation head `7013de72b0a6a236f06f476d9f683f3f271a478d` changes only `apps/web/scripts/test-telemetry-function.mjs`: 12 non-Production report-route cases now also test missing `TELEMETRY_REPORT_TOKEN` and no Authorization, asserting 404, no missing-token console error and no aggregate reads; all three report routes reject a legacy Newsfeed bearer (503 if dedicated token absent, 401 if present), without aggregate reads. The behavior guards themselves did not change.

**Connected GitHub read-back on NEW exact SHA:** all six pull-request-triggered workflows are **completed / SUCCESS**, independently fetched by run ID with matching `head_sha`:

| Workflow | Run |
| --- | --- |
| Web Quality | https://github.com/usdimpact/usd-impact-site/actions/runs/42702706540 |
| Dependency Review | https://github.com/usdimpact/usd-impact-site/actions/runs/42702706361 |
| Supabase migration-intake guard (no database access) | https://github.com/usdimpact/usd-impact-site/actions/runs/42702706356 |
| GA4 native-cookie QA | https://github.com/usdimpact/usd-impact-site/actions/runs/42702706542 |
| GA4 compiled Astro native-browser QA | https://github.com/usdimpact/usd-impact-site/actions/runs/42702706492 |
| CodeQL security analysis | https://github.com/usdimpact/usd-impact-site/actions/runs/42702706464 |

**Release gate status:** D2/D3 **test coverage complete**, source still Draft; D1 **owner unresolved**; real Vercel build target and dedicated report token **unknown**; independent re-review of the *latest* exact head **not yet recorded**; privacy owner decision **unknown**; G3 release authorization **NO-GO**. Production and inherited Preview artifacts unchanged. No merge, deploy, Vercel settings change, secret read, workflow dispatch or historical deletion undertaken. **Issue #1201 stays OPEN.**
