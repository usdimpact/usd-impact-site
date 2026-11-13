# Independent Macro Weekly, 2–6 November 2026 — 13 Nov chronology recheck

**DRAFT / SOURCE-ONLY / NON-SERVED / DO NOT MERGE OR PUBLISH.** This recheck supplements existing [Draft PR #1227](https://github.com/usdimpact/usd-impact-site/pull/1227) at `f1386a44d9f0e5b2f540ebc6d4adb3aabbb8d474`, whose source, test and original protection matrix remain unchanged. It is not an editorial signature, legal opinion, rights grant or authorization to add a public route.

## Independent original-issuer check, 13 November

| Date original released | Reference period | Original source / claim verified | Qualified state |
| --- | --- | --- | --- |
| 3 Nov | September labor turnover | [BLS original JOLTS](https://www.bls.gov/news.release/archives/jolts_11032026.htm): **7.5 million openings**, **5.4 million hires**, **3.4 million quits** | Historical September labor-flow counts; not October payrolls |
| 4 Nov | November funding announcement | [U.S. Treasury refunding statement](https://home.treasury.gov/news/press-releases/sb0678): **$125 billion offered**, ~**$97 billion** to refund maturing debt, ~**$28 billion** new cash; three-, ten- and thirty-year auctions **announced for 9/10/12 Nov** | Issuer announcement only, not award results |
| 4 Nov | September trade | [BEA/Census original](https://www.bea.gov/news/2026/us-international-trade-goods-and-services-september-2026): **$105.0 billion deficit**, **$321.5 billion exports**, **$426.6 billion imports** | September estimates issued Nov 4, no currency move proven |
| 5 Nov | Q3 preliminary productivity | [BLS original productivity](https://www.bls.gov/news.release/archives/prod2_11052026.htm): **+3.6%** nonfarm-business productivity at seasonally adjusted **annual** rate, output **+3.7%**, hours **+0.1%** | Not +3.6% year-over-year |
| 6 Nov | October employment | [BLS original employment](https://www.bls.gov/news.release/archives/empsit_11062026.htm): **+165,000 payroll jobs**, unemployment **4.1%** | October survey, not November USD price movement |

**Finding:** The five factual anchors in the existing Draft #1227 were rechecked against these five exact original issuer documents; no numeric discrepancy in the stated highlighted claims was found. This is a five-release **source validation**, not a complete Friday U.S. close/corrections and market-price review or human editorial approval.

## Chronology fix required by 13 November

Existing #1227 source text was written for a **10 November review**. By **13 November**, all three auctions announced in the 4 November Treasury statement (9 Nov, 10 Nov and 12 Nov) are in the past. The announcement itself supplies auction **dates and sizes only**; it does not document awarded yields, bid-to-cover, participation or a causal USD/WTI/gold move. CPI released **10 November** falls **outside** the 2–6 November report's release window and must not be silently appended as a weekly original.

New source-only companion: `docs/operations/independent-macro-weekly-2026-11-06-chronology-revised-20261113-NONSERVED.astro` updates:
1. Review timestamp language to say **as reviewed 13 Nov**, 9/10/12 auctions have passed;
2. “some dates now past” → **all three dates past**;
3. “Next official milestones” → **After-period Treasury chronology**;
4. “appropriate next step is to verify after each event” → require explicit verification of **each original Treasury auction result** before any separate expansion;
5. Top file comment marks **R2 non-served source only**, not an approved final edition.

**Static source isolation QA on the exact compared texts:** 409 opening/closing HTML element tokens kept byte-identical in sequence; all ten external original-source `href` destinations unchanged; prior source's visible `draft-source-not-served` marker retained; no new script, image, third-party embed or served route introduced. This is **not** a browser/compiled-build claim.

## Live route control, 13 November

- `/macro-reviews/weekly/2026-11-06/`: **HTTP 404**, rightly unpublished.
- `/macro-reviews/weekly/2026-10-30/`: **HTTP 200**, preserved prior independent Weekly.
- `/reports/` and `/news/`: **HTTP 200**; the required coordinated latest-Weekly date-card transition has not been released.
- Unapproved `/news/catalysts/2026-11-12-eia-weekly-petroleum-status-report-veterans-day-adjusted-publication-preview/`: **HTTP 404**. The separate WPSR outcome source custody is [Draft #1254](https://github.com/usdimpact/usd-impact-site/pull/1254).

## Remaining mandatory gates — no inference from source check

- Accountable owner/editor must review the **whole actual revised copy**, including any corrections and editorial adequacy of *Friday-close* coverage, as-of claims and the precise publication timestamp; record exact final source SHA. If complete closing market data is unavailable, keep the explicitly limited scope and do not call it an investor-performance summary.
- Determine AI-assisted public disclosure, cross-border rights/reuse, sitewide privacy/consent and cookies, and owner/operator identification; do not infer legal acceptance from government data being available.
- Run a separate protected-source release PR under then-current `main` if approved. It must build a real date-specific Astro route, retain noindex/robots and original brand, explicitly exclude sitemap, atomically update News and Reports latest-Weekly references and adapt only *date-specific* fail-closed publishing tests without broad bypasses.
- Exact-head native Web Quality/CodeQL/dependency/security checks, READY matching Vercel Preview, actual browser/mobile/keyboard/legal/consent checks, source links, adjacent unpublished 404, then **new owner exact-head public release approval**, protected merge and same-SHA READY Production/public parity.
- Leave original real-input Score rights, Monthly, Research, Daily incident [#840](https://github.com/usdimpact/usd-impact-site/issues/840), other Drafts and site settings unchanged; no paid model generation, workflow dispatch or release of this source-only PR.

**Decision:** independently verified historical source facts and corrected postperiod chronology are ready for final human editorial review; actual public Weekly **HOLD**.
