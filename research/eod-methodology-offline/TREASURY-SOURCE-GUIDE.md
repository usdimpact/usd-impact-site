# Direct-source Treasury Method Daily candidate — Draft / NO RELEASE

**Research implementation only.** This is an isolated companion to the synthetic methodology PRs #1081 and #1082. It does not alter the existing News service, source minimum, Score rights, publishing workflows, cloud environments, routes, account entitlements or email. No live feed is fetched in CI or by importing these modules.

## Why this source first

Treasury publishes a government-originated daily par yield-curve XML feed. Its official documentation specifies the month query, the native observation date and the tenor fields. This adapter accepts **only** the exact official monthly yield-curve endpoint for the New York business-day under consideration:

- Guide: https://home.treasury.gov/treasury-daily-interest-rate-xml-feed
- Canonical endpoint: https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=YYYYMM
- Fields: `NEW_DATE`, `BC_2YEAR`, `BC_10YEAR`.
- Calculation: the directly reproducible **Treasury 10-year minus 2-year par-yield spread**, in percentage points. This is **not** the original Score v2 Treasury DGS2/DGS10 vendor transport, nor the eight-factor Score, nor a trading instruction.

Treasury's government publisher status reduces source ambiguity. It **does not automatically certify** the contractual and legal public use of every input quotation, downstream derived display, or the original USD Impact Score. Original third-party licensing remains on HOLD. Any future published numeric series requires its own source-rights and editorial approval.

## Interface and control boundaries

The `verified-treasury-source.mjs` adapter:

1. Builds a fixed HTTPS Treasury monthly feed URL from a validated `YYYY-MM-DD` date. Rejects redirects, wrong issuer URLs, non-XML responses, HTTP failures and oversized bodies.
2. Requires **17:00 or later in America/New_York** on the matching business-day. This is a proposed observation checkpoint, not a guaranteed publisher release time or global market close.
3. Parses a tightly scoped, size-bounded XML subset from the official feed: unique observation dates; exact two- and ten-year par yields; no `DOCTYPE`, dynamic XML entities or unknown numeric fields. Missing rates and duplicates FAIL; a valid feed without the target date yields a labeled `NO_MATCHING_OBSERVATION_DRAFT`.
4. Stores an integrity hash and limited source metadata in the transient candidate object, **not raw vendor data archives**. `feed/updated` is **not** a certified publication time: original issuer release instant is explicitly `null`.
5. Produces one canonical fact list and deterministic EN/ES Markdown drafts with identical IDs, values and source URLs; no text suggests Treasury curves prove a dollar/gold/oil/BTC/equity price move.
6. Returns `public_release_authorized:false`, `human_editorial_review_required:true`, `source_rights_status:SEPARATE_LEGAL_EDITORIAL_REVIEW_REQUIRED` and `original_score_reconstruction_authorized:false` in all cases.
7. Local hand-supplied XML always receives `UNVERIFIED_FIXTURE` provenance, even if a caller tries to pass a stronger transport flag. Only the explicit exact-origin fetch function can label a response `EXACT_ISSUER_RESPONSE`; that label **does not establish rights or original issuer release time**.

## Running the safe example

- `node --test research/eod-methodology-offline/test.mjs research/eod-methodology-offline/methodology-schedule.test.mjs research/eod-methodology-offline/verified-treasury-source.test.mjs`
- `node research/eod-methodology-offline/treasury-candidate-cli.mjs --demo` prints a **fictional February 2100 source-shaped example** to stdout. No files are written and no network requests occur.
- Only when explicitly authorized for a read-only source probe, `node research/eod-methodology-offline/treasury-candidate-cli.mjs --live-official` makes one bounded GET to Treasury from the operator's runtime, only after the defined New York cutoff; stdout remains a **private draft**, not a release. Do not schedule this option or copy the JSON into public assets or GitHub logs without rights/privacy QA.

The source adapter has injected-response tests for endpoint enforcement, days and DST, release-time limitations, XML parsing, duplicate dates, missing maturities, size limits, language parity, arithmetic, no-new-observation distinction, and read-only behavior.

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
