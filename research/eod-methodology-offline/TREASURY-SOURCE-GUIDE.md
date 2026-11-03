# Direct-source Treasury Method Daily candidate — Draft / NO RELEASE

**Research implementation only.** This is an isolated companion to the synthetic methodology PRs #1081 and #1082. It does not alter the existing News service, source minimum, Score rights, publishing workflows, cloud environments, routes, account entitlements or email. No live feed is fetched in CI or by importing these modules.

## Why this source first

Treasury publishes a government-originated daily par yield-curve XML feed. Its official documentation specifies the month query, the native observation date and the tenor fields. This adapter accepts **only** the exact official monthly yield-curve endpoint for the New York business-day under consideration:

- Guide: https://home.treasury.gov/treasury-daily-interest-rate-xml-feed
- Canonical endpoint: https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=YYYYMM
- Fields: `NEW_DATE`, `BC_2YEAR`, `BC_10YEAR`.
- Source units: two-year and ten-year **yields are percentages**; their arithmetic difference is in **percentage points**. The validated record and EN/ES renderers preserve that distinction.
- Month binding: a monthly response with any out-of-month observation is rejected rather than treated as a quiet-day or valid publisher update.
- Calculation: the directly reproducible **Treasury 10-year minus 2-year par-yield spread**, in percentage points. This is **not** the original Score v2 Treasury DGS2/DGS10 vendor transport, nor the eight-factor Score, nor a trading instruction.

Treasury's government publisher status reduces source ambiguity. It **does not automatically certify** the contractual and legal public use of every input quotation, downstream derived display, or the original USD Impact Score. Original third-party licensing remains on HOLD. Any future published numeric series requires its own source-rights and editorial approval.

## Interface and control boundaries

The `verified-treasury-source.mjs` adapter:

1. Builds a fixed HTTPS Treasury monthly feed URL from a validated `YYYY-MM-DD` date. Rejects redirects, wrong issuer URLs, non-XML responses, HTTP failures and oversized bodies.
2. Requires **18:30 or later in America/New_York** on the matching business-day in default mode. Treasury's official methodology states the day's par yields are *usually available by 18:00 Eastern, but may be delayed*; 18:30 is only a conservative research buffer, **not a guarantee**. Missing current-day observations stay held or become an explicitly dated no-observation educational note, never invented market facts. This source-specific cutoff is deliberately different from the unrelated **17:37 synthetic research dry run** in parent #1082, which remains OFF by default and must never be wired to this real-source adapter without separate schedule authorization.

   **Explicit delayed-source review:** An independent API-only option `allowRetrospective: true` permits a weekday source observation to be inspected **1–14 calendar days later**. This can include a weekend capture of a Friday observation. The old source observation date and later capture time are recorded separately in source metadata and clearly disclosed in both English and Spanish, without guessing the first publication time. Default mode still rejects stale dates. The `--live-official` CLI does **not** enable delayed backfill, and the 17:37 research workflow does **not** call the real source adapter. No historic scores or public editions are authorized.
3. Parses a tightly scoped, size-bounded XML subset from the official feed: unique observation dates; exact two- and ten-year par yields; no `DOCTYPE`, dynamic XML entities or unknown numeric fields. Missing rates and duplicates FAIL; a valid feed without the target date yields a labeled `NO_MATCHING_OBSERVATION_DRAFT`.
4. Stores an integrity hash and limited source metadata in the transient candidate object, **not raw vendor data archives**. `feed/updated` is **not** a certified publication time: original issuer release instant is explicitly `null`.
5. Produces one canonical fact list and deterministic EN/ES Markdown drafts with identical IDs, values and source URLs; no text suggests Treasury curves prove a dollar/gold/oil/BTC/equity price move.
6. Returns `public_release_authorized:false`, `human_editorial_review_required:true`, `source_rights_status:SEPARATE_LEGAL_EDITORIAL_REVIEW_REQUIRED` and `original_score_reconstruction_authorized:false` in all cases.
7. Local hand-supplied XML always receives `UNVERIFIED_FIXTURE` provenance, even if a caller tries to pass a stronger transport flag. Only the explicit exact-origin fetch function can label a response `EXACT_ISSUER_RESPONSE`; that label **does not establish rights or original issuer release time**.


**Primary publication-timing source:** [Treasury Yield Curve Methodology](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology) explicitly states rates are typically available by **6:00 p.m. ET** and can be delayed. Separately, 3:30 p.m. ET is approximately when indicative *inputs* are collected, not when the resulting public XML has necessarily been published. Never equate those two times or use source `feed/updated` as a verified initial availability timestamp.

## Running the safe example

- `node --test research/eod-methodology-offline/test.mjs research/eod-methodology-offline/methodology-schedule.test.mjs research/eod-methodology-offline/verified-treasury-source.test.mjs`
- `node research/eod-methodology-offline/treasury-candidate-cli.mjs --demo` prints a **fictional February 2100 source-shaped example** to stdout. No files are written and no network requests occur.
- For a **manual retrospective check** after an issuer delay, `node research/eod-methodology-offline/treasury-candidate-cli.mjs --live-official --probe-date=2026-10-30 --allow-retrospective` requires all three arguments in that exact order. The source date must be a weekday from **1–14 calendar days before** the current New York date. This invokes one fixed-origin GET and produces only the **redacted nonnumeric schema receipt**; it never writes a file, creates a PR, or publishes. The example date is an argument illustration, not a standing command to reuse in future months. On weekends use a valid prior weekday observation, not the weekend date. The default `--live-official` remains same-day only after 18:30 ET. **Do not add this command to CI, cron or public logs without separate approval.**
- Only when explicitly authorized for a read-only source probe, `node research/eod-methodology-offline/treasury-candidate-cli.mjs --live-official` makes one bounded GET to Treasury from the operator's runtime after the New York cutoff; **stdout now contains only a NONNUMERIC private schema receipt** (source/date/hash/field IDs, sanitized HTTP status and Content-Type, presence flags for HTTP Date/Last-Modified/ETag; no 2Y/10Y rates, no spread, no raw header strings, no real EN/ES Markdown). These transport headers are not evidence of the issuer's first data-release time. It is not a live issue, licensed-data receipt or publication approval. Do not schedule this option, enable a GitHub workflow source fetch, or copy outputs into public assets without separate source/legal/editorial QA.

The source adapter has invented-data tests for explicit delayed-source review, 14-day maximum lookback, weekend capture of weekday observations, and protected first-release attribution. the source adapter has injected-response tests for endpoint enforcement, days and DST, release-time limitations, XML parsing, duplicate dates, wrong-month observations, missing maturities, source-value units, tampered derived arithmetic, changed issuer URLs/rights flags, size limits, language parity, no-new-observation distinction, and read-only behavior.

**HTTP header evidence contract:** The privately invoked source adapter validates successful HTTP 200 and an XML MIME type and now reports the normalized MIME category plus boolean presence of HTTP `Date`, `Last-Modified` and `ETag`. The actual header timestamp/body strings are deliberately not reproduced in CLI output. In particular, `Last-Modified` or Atom `updated` **must never be presented as the first release timestamp** without issuer-specific provenance evidence. An absent header is reported as absent, not inferred. This header contract has only been verified with invented injected responses; actual Treasury response headers and full raw parser compatibility remain HOLD.

**Official XML compatibility change:** Treasury's [developer notice](https://home.treasury.gov/developer-notice-xml-changes) says the post-February-2022 feed omits elements when their values are unavailable, rather than necessarily emitting old `m:null="true"` elements. This adapter treats both a missing 2Y/10Y field and an empty field as **missing data, never zero**, and it ignores unrelated additional tenor elements such as the documented 2025 1.5-month series. `NEW_DATE` now requires a complete, lexically valid OData date-time value; a valid calendar-date prefix followed by garbage is rejected. These are fixture-tested parser behaviors, **not certification against current original HTTP bytes**. The notice's 2022 restriction on browser access describes the *all-period XML view*, not necessarily all monthly API requests.

**Independent read-only issuer inspection (2026-11-03):** A browser inspected the *October 2026 Treasury month-filtered feed's XML markup*, not only flattened extracted text. It confirmed the Atom `<feed>` root, `<entry>` records, `<content type="application/xml">` → `<m:properties>` containment, the three required `<d:...>` fields and the exact Atom/OData namespace URI families. This is a source-structure inspection, **not** proof that the current JavaScript function has parsed the full raw issuer response. The browser did NOT expose origin `Content-Type` or `Last-Modified` response headers, and no raw bytes were saved to the repository or published.

**Code hardening based on that inspection:** The research parser now requires the Atom namespace, the expected `d` and `m` OData namespaces, a single XML content/properties block per complete entry, and source data fields inside `m:properties`; forged lookalike tags outside that location, incomplete entries and foreign namespaces are rejected. Exact-head offline workflow passed **58/58 tests** at commit `c6ae01adff84de7bbd5968e52524bf8178536585`. **This is not certification of complete raw XML compatibility**; run the controlled, nonnumeric `--live-official` probe under approved private conditions and separately capture the HTTP headers before claiming the gate is closed.

**Separate independent source QA (Nov 3, 2026):** The Treasury's dated public rate table and the month-filtered XML extractor expose matching October 30 2-year and 10-year values and the same 10Y–2Y arithmetic, without using third-party market feeds. This is a presentation-level comparison, NOT an execution of this exact JavaScript parser against raw issuer XML. The current parser is a bounded, research-only XML-subset matcher rather than a standards-compliant XML parser; require raw-body, namespace and HTTP-header tests before allowing any scheduled or published source-backed edition.

**Historical method discontinuity:** Treasury's official par-yield table identifies a change on December 6, 2021 to a monotone-convex-spline curve methodology. Any before/after study, multi-year baseline or comparison to historical USD Impact Score inputs must explicitly document that break and use verified, rights-cleared exact series/vintages. Do not infer that the Treasury series automatically reproduce the original Score v2 inputs.

Official verification links:
- https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?field_tdr_date_value=2026&type=daily_treasury_yield_curve
- https://home.treasury.gov/treasury-daily-interest-rate-xml-feed


### Source/rights acceptance checklist (current gates)

| Gate | Current evidence | Status |
| --- | --- | --- |
| Direct issuer URL and fixed `YYYYMM` query | Treasury's own XML-feed documentation | PASS — research endpoint only |
| Actual Atom and OData hierarchy | Independent browser markup inspection: feed/entry/content/m:properties and required namespaced fields | PASS — structural observation |
| XML parser against *raw returned bytes* and HTTP `Content-Type` | Browser cannot show headers; no same-run direct Node parser receipt | **HOLD** |
| Historical example and 10Y−2Y math | Official Treasury dated table agrees with monthly XML's extracted values for Oct 30 | PASS — reference arithmetic only |
| Observation, issue-time and revision chain | Date exists; feed/entry `updated` is not a certified first-publication timestamp | **HOLD** |
| Permission for website numerical display, model-derived quotes, downstream archives and AI processing | USAgov guidance cautions federal pages can include third-party works; agency-specific commercial assessment needed | **HOLD** |
| Exact original USD Impact Score v2 reproducibility | Treasury direct par curve is a teaching example, not proven DGS2/DGS10 source/vintage parity or the eight-factor Score | **HOLD** |
| EN/ES invented-source parity and redacted source probe | 58/58 tests at the exact Draft head; no actual market data in GitHub CI | PASS — research only |
| Public content, indexing, scheduled live pull and membership access | No approvals and no public release flow implemented | **HOLD** |

**Economic interpretation:** Treasury's par curve uses indicative closing bid quotes from about 3:30 p.m. Eastern and reports *model-derived constant-maturity par yields*. They are not last-traded prices or yields on one actual security, nor are they a standalone predictive signal. Link the official Treasury source and state the observation date separately from the first-release/capture time. Its [interest-rate FAQ](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/interest-rates-frequently-asked-questions) explains these boundaries.

**Rights distinction:** U.S. federal government works may be public domain, but [USAGov's federal-materials guidance](https://www.usa.gov/government-copyright) warns that agency webpages can include third-party works, logos/trademarks and use limitations. Do not mark the Treasury-derived number/AI workflow as fully authorized for USD Impact website, archives or customer redistribution without a recorded use-specific decision; paid data-provider licensing is separate.

## Cost and reproducibility optimization opportunities (not enabled)

| Decision | Efficient evidence choice | Important distinction |
| --- | --- | --- |
| Daily nominal Treasury curve illustration | One direct Treasury monthly feed; single observed-date row + integrity receipt | No implied Score v2 vendor parity, first-publication instant, or automatic public use rights |
| Week-end snapshot methodology | One explicitly selected last eligible published observation with its own source day | Snapshot is **not** a Treasury or Federal Reserve weekly *average* |
| Weekly/monthly **published average** methodology | Evaluate the Federal Reserve H.15 official weekly/monthly series and its supported data files, subject to source/vintage and reuse checks | Do not silently average USD Impact dailies and mislabel them as issuer-published; different semantics from Friday snapshot |
| Future source automation | One shared dated evidence contract (issuer, series, unit, observation date, capture date, revision/rights) reused by EN/ES and period summaries | Separate editorial/release approval; do not add a real-data cron to the existing 17:37 synthetic workflow |
| Original USD Impact Score reconstruction | Licensed exact eight-driver sources, formulas/weights, time-vintages and held-out parity checks | Government Treasury 2Y/10Y spread is a **teaching illustration**, not the actual eight-driver Score |

**Near-term upstream deprecation:** the Federal Reserve's [Data Download Program notice](https://www.federalreserve.gov/datadownload/Choose.aspx?rel=H15) says it plans to remove the `Build Your Package` option during the week of **November 9, 2026** as the program is streamlined. Avoid making a new Weekly/Monthly pipeline depend on that custom-builder UI. Before selecting an H.15 transport, confirm the currently supported downloadable file/interface, long-term retention rights, and exact series/unit/frequency; use no new paid vendor calls by default. No H.15 ingest adapter is implemented in this Draft.

## What remains before genuine unattended Method Daily production

This first module **does not** produce a real published article. Before connecting to a workflow or adding market facts:

- independently certify Treasury source schema against the live XML feed, and confirm the actual original issuer publication/availability history;
- obtain a documented asset/source licence matrix for the precise contemplated public number, derivative display, historical retention and AI processing (and separately original Score vendor feeds);
- design a **new methodology-specific product contract** where one verified primary document can support bounded factual explanation and zero new records can lead to a clearly synthetic educational exercise. Do not bypass existing News three-document gating;
- add a reviewed dated issuer-capture receipt, per-edition concurrency lock, skip-on-holiday, stale-data limits, revision ledger and source-validated factual English/Spanish templates;
- separately authorize an automated Draft PR generator (no auto-merge) only after exact-head CI, user-access isolation, AI transparency/editorial/legal review, source provenance, publication correction/rollback and owner release decision.

The current scheduled `eod-methodology-dry-run.yml` runs invented fixtures and **never executes the real source adapter**, regardless of the future repo toggle. This prevents accidental paid sources or unreviewed live content from entering a CI artifact.

## Canonical ownership

Master: UI-01 Daily automation; UI-13/15 distinct Weekly/Monthly; UI-39/40 EN/ES review; UI-23/24 and pipeline #155/#282 real-data and Score rights; UI-36/37 trusted CI and buyer protections. Fundraising DEC-020/021/022 remains the strategic consumer, not a second publishing engine.
