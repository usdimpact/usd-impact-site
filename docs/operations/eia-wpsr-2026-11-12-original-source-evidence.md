# EIA WPSR — 12 November 2026 immutable-source evidence

**Status: SOURCE VERIFICATION ONLY — DRAFT / NON-SERVED / NO RELEASE AUTHORITY.**
Prepared 13 November 2026 for the 12 November EIA Weekly Petroleum Status Report (WPSR), covering the **data week ending 6 November 2026**. This is not a new 13 November release, a market-price verification, or authorization to publish. Independent of stale [pre-event Draft #1248](https://github.com/usdimpact/usd-impact-site/pull/1248), which stays Draft and unmerged.

## Discovery and original date custody

1. EIA [WPSR release schedule](https://www.eia.gov/petroleum/supply/weekly/schedule.php) identifies **Thursday 12 Nov 2026, 12:00 p.m. EST** as the holiday-adjusted first release for **week ending 6 Nov** (Veterans Day). The separate landing page lists a second 2:00 p.m. ET posting window. The schedule is a **discovery-only** reusable index, **not a dated publishedAt ledger source**.
2. EIA's current [WPSR landing page](https://www.eia.gov/petroleum/supply/weekly/) lists **November 12, 2026** in Previous Issues. Follow its actual issuer link; do not guess or reconstruct archive URLs.
3. The discovered original EIA archive [WPSR 12 Nov dated issue](https://www.eia.gov/petroleum/supply/weekly/archive/2026/2026_11_12/wpsr_2026_11_12.php) was independently fetched. It expressly states **“Data for week ending November 6, 2026 | Release Date: November 12, 2026.”** This release-specific archive is a **dated primary document**, unlike the rolling landing/schedule/PDF pointers.
4. Its directly linked, release-specific original [archived Summary TXT](https://www.eia.gov/petroleum/supply/weekly/archive/2026/2026_11_12/download/summary.txt) and [archived Table 1 CSV](https://www.eia.gov/petroleum/supply/weekly/archive/2026/2026_11_12/download/table1.csv) were separately fetched. Both belong to the above immutable 12 November archive. Do not cite the mutable `/petroleum/supply/weekly/pdf/wpsrall.pdf` or `/petroleum/supply/weekly/pdf/tableN.pdf` pointers as dated originals.

## Claim-to-original verification

| Source ID | Verified statement | Archived supporting document |
| --- | --- | --- |
| `eia-20261112-archive` | EIA's actual WPSR release date is **Nov 12**; its weekly *data reference period* ends **Nov 6** | release-specific archive HTML (3) |
| `eia-20261112-summary` | Commercial crude inventories **excluding SPR increased 4.7 million barrels to 414.4 million barrels** | archived summary TXT (4) |
| `eia-20261112-table1` | Commercial crude row: **409.760 → 414.417 million barrels**, unrounded **+4.657**; supports published summary's **+4.7** | archived Table 1 CSV (4) |
| `eia-20261112-summary` + `eia-20261112-table1` | Total motor gasoline stocks **+1.8 million to 210.8 million**; CSV **208.958 → 210.757**, **+1.799** | archived summary and Table 1 |
| `eia-20261112-summary` + `eia-20261112-table1` | Distillate fuel oil stocks **+4.1 million to 103.3 million**; CSV **99.259 → 103.330**, **+4.071** | archived summary and Table 1 |
| `eia-20261112-summary` | Refinery crude inputs **17.0 million b/d**, **+322,000 b/d** from prior week, at **95.2%** capacity utilization | archived summary TXT |

### Source ledger contract (for a later separately approved publication PR)

| ID | URL | sourceType | publishedAt |
| --- | --- | --- | --- |
| `eia-20261112-archive` | https://www.eia.gov/petroleum/supply/weekly/archive/2026/2026_11_12/wpsr_2026_11_12.php | primary | 2026-11-12 |
| `eia-20261112-summary` | https://www.eia.gov/petroleum/supply/weekly/archive/2026/2026_11_12/download/summary.txt | primary | 2026-11-12 |
| `eia-20261112-table1` | https://www.eia.gov/petroleum/supply/weekly/archive/2026/2026_11_12/download/table1.csv | primary | 2026-11-12 |

These are three distinct **documents from one authoritative issuer**, not three independent publishers. Each factual assertion must cite the relevant original ID; do not infer that source independence exists or reuse another date. No prices, consensus forecasts, price reactions, or causal WTI/Brent moves have been verified by these documents. Oil-market transmission is permitted **only as conditional educational interpretation**.

## Remaining release gates

- Draft a **new post-release outcome**, not a relabeled pre-event preview. Exact historical eventKey: `2026-11-12-eia-weekly-petroleum-status-report-veterans-day-adjusted-publication`, `eventDate=2026-11-12`, `phase=outcome`, `statusLabel=released`; new event-specific outcome slug must end `-outcome`. Public content status must remain `review` until separate authorization and protected publication.
- Recheck the release-specific originals and wording as a human editor; verify source mapping, EIA rounding, accessible page, rights/compliance/AI notice, and event-vs-reference chronology. Any post-retrieval correction or revised number requires a new reviewed candidate.
- Build and validate under then-current protected `main` in a **separate new source-content PR**. Require exact-head checks, real Vercel Preview, owner exact-copy acceptance, normal protected merge, same-SHA READY Production and public route/News/RSS checks.
- Hold other rights-restricted data, original Score, Monthly and Daily incident #840; do not invoke a paid generator, change scheduling, credentials or Production, or claim same-day market results from WPSR.

**Final disposition:** historical source provenance **PASS for these archived originals**; post-release article editorial and publication **HOLD**.
