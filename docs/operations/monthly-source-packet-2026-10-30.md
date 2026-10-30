# Next Monthly USD Impact — editorial source packet (as of 2026-10-30)

> **DRAFT / INTERNAL EDITORIAL REFERENCE / RELEASE HOLD.** This is not a Monthly article, not a request to generate, purchase, fetch or publish a Score, and not a market-data rights grant. It creates no Monthly content collection entry, page, feed item, workflow, alert or commercial entitlement. Preserve existing Production and published historical reports.

## Decision and reporting period

- **Last actually published Monthly:** [four weeks ending 2026-10-16](https://www.usd-impact.com/reports/monthly/2026-10-16/), using four published weekly reports through that Friday. Its source file is `apps/web/src/content/monthly-reports/2026-10-16.md`.
- The existing [site eligibility function](../../apps/web/src/lib/report-periods.js) selects the **first four published Weekly briefs strictly after** the latest published Monthly period end. The [monthly validator](../../apps/web/scripts/validate-monthly-reports.mjs) additionally requires four consecutive Fridays and exact source scores/regimes.
- The earliest prospective **next** four-Weekly window is **October 19–November 13, 2026**, ending on the consecutive Fridays **October 23, October 30, November 6, November 13**. This is *not* a calendar-month October report. It is an input window, **not an authorized future publication date**.
- **Eligibility as of 2026-10-30:** **1/4 published Weeklies**. The [October 23 Weekly](https://www.usd-impact.com/reports/weekly/2026-10-23/) is published. There is no `2026-10-30.md` in the Weekly collection and its canonical live URL returns 404. November 6 and November 13 are future input periods. Hence **`ready=false`**. The October 26–30 Daily editions are already published but do not substitute for a missing Weekly.
- **Score/Report rights HOLD:** [pipeline Issue #155](https://github.com/usdimpact/usd-impact-pipeline/issues/155) remains open. Both the pipeline `governance/score-publication-rights-gate.json` and site `governance/score-derived-publication-rights-gate.json` are `state: hold`, with no release receipt or approver. The direct Weekly generator and scheduled workflow are fail-closed. A provider's paid-license requirement for the proposed commercial original eight-driver Score, and unresolved source-by-source rights, cannot be cured by copying historical scores, adjusting the Monthly format, using a different transport, or a new editorial assertion. The aggregate-only prototype is **review-only, not licensed**. Do not quote a new Score, carry forward an old Score as current, or regenerate a Weekly/Monthly merely to fill the calendar.

### Weekly source gate

| Target completed Friday | Required role | Current evidence / eligibility |
| --- | --- | --- |
| 2026-10-23 | Source 1 of 4, period 2026-10-19–23 | **PUBLISHED**: [Weekly 2026-10-23](https://www.usd-impact.com/reports/weekly/2026-10-23/) and `apps/web/src/content/weekly-reports/2026-10-23.md` (reviewed Git blob `9bd65af82fb98e71fafd6bd98870c72be1fe2390`). Its already-public historical Score evidence is **not an approval for re-publication**. |
| 2026-10-30 | Source 2 of 4, period 2026-10-26–30 | **MISSING / RIGHTS HOLD**: five published Dailies are available; Weekly report absent from protected `main` and HTTP 404 at its expected public route. Do not construct or backdate a substitute Score. |
| 2026-11-06 | Source 3 of 4 | **FUTURE**: no source Weekly or final evidence yet. |
| 2026-11-13 | Source 4 of 4 | **FUTURE**: no source Weekly or final evidence yet. |

## Verified candidate fact ledger for the *second* source week (not a completed Weekly)

These facts are extracted from the **already published** USD Impact Dailies dated October 26–30, each of which returned HTTP 200 on Production during the October 30 check. Claims remain tied to the date and supporting document; this is not an independent measurement of asset-price changes. Keep this material as unpromoted editor input until a rights-cleared Weekly exists.

| Published Daily | Source-backed event or limitation | Primary-source starting point |
| --- | --- | --- |
| [Oct 26](https://www.usd-impact.com/news/2026-10-26/) — `a05089cbcb372862455157e0382a9a4e81cbd532` | Calendar-led preview of October 27–28 FOMC and October 30 ECI; neither a decision nor a market reaction was known from the October 26 calendar. | [Fed FOMC calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm); [BLS October schedule](https://www.bls.gov/schedule/2026/10_sched_list.htm) |
| [Oct 27](https://www.usd-impact.com/news/2026-10-27/) — `29ee81eb8ac3e49ebf4676c34fb025a052daf398` | Reiterated scheduled October 28 policy decision, with no invented pre-announcement outcome or live asset return. | [Fed FOMC calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm) |
| [Oct 28](https://www.usd-impact.com/news/2026-10-28/) — `c7e6ae165a445658aaefe5958f753c4474e89212` | Fed **held the 3.75%–4.00% target range** on October 28 by **10–2**. Two members preferred a 25 bp rise. Do not relabel this as an October 29 decision. | [Dated Fed statement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm) |
| [Oct 29](https://www.usd-impact.com/news/2026-10-29/) — `068950a9aec9c4b5bee6ca8ce16ebdadd430451e` | BEA Q3 GDP advance: **+3.4% SAAR**, versus Q2 **+2.2%**; September headline PCE **+3.6% y/y**, core PCE **+3.1% y/y**. GDP and PCE are separate releases and reference periods. | [BEA Q3 GDP](https://www.bea.gov/news/2026/gdp-advance-estimate-3rd-quarter-2026); [BEA September income/outlays](https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026) |
| [Oct 30](https://www.usd-impact.com/news/2026-10-30/) — `f8881e383adba66eb801a3fbbcb4d1507de32917` | BLS Q3 ECI: **+0.8% q/q seasonally adjusted** vs **+0.9% Q2**, and **+3.4% y/y not seasonally adjusted**. The original Daily `generatedAt=09:34 UTC` predates the **12:30 UTC** release; the published post-release editorial correction was separately reviewed and merged via [PR #1009](https://github.com/usdimpact/usd-impact-site/pull/1009). No same-day cross-asset price movement is asserted. | [Dated BLS ECI](https://www.bls.gov/news.release/archives/eci_10302026.htm); [BLS release schedule](https://www.bls.gov/schedule/2026/10_sched_list.htm) |

**Comparison integrity:** Do not add the Oct 26/27 calendar preview to the Oct 28 Fed outcome as separate policy actions; do not count Oct 29 PCE or GDP twice because they were repeated as background in Oct 30; distinguish q/q SA ECI from y/y NSA ECI, and Q3 GDP annualized growth from monthly PCE inflation. Keep release timestamps, observation periods and article generation/review timestamps separate.

## Source-backed editorial synthesis for October 26–30 — NOT a published Weekly

**Working paragraphs only.** The following prose uses the dated first-party Daily articles and the official issuer releases listed above. It is a factual handoff for future editorial review, not a new Score, Weekly Report, Monthly content entry, regime conclusion, asset-price attribution, or production publication. It may be used only within a separately approved future publication contract.

**Policy baseline (October 28).** The [Federal Reserve's October 28 statement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm) records a **10–2 vote to maintain the 3.75%–4.00% target range**. Two dissenters favored a 25-basis-point increase. The October 26–27 Daily references concerned the *scheduled meeting*, not additional rate decisions. The official result is dated October 28, not October 29 or October 30. This describes policy action, not a measured dollar or Treasury-yield reaction.

**Growth and inflation releases (October 29).** [BEA's Q3 advance estimate](https://www.bea.gov/news/2026/gdp-advance-estimate-3rd-quarter-2026) puts **real GDP growth at 3.4% seasonally adjusted annualized** versus **2.2% in Q2**; these are quarterly annualized growth rates, not year-over-year GDP. In a *separate* [September Personal Income and Outlays release](https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026), headline PCE prices increased **0.5% month over month and 3.6% year over year**, while core PCE prices increased **0.3% month over month and 3.1% year over year**. These are September monthly-price observations published October 29, not the annualized quarterly PCE series mentioned in GDP tables.

**Labor costs (October 30).** The dated [BLS Q3 Employment Cost Index](https://www.bls.gov/news.release/archives/eci_10302026.htm) reports **0.8% quarter-over-quarter civilian compensation growth, seasonally adjusted**, following **0.9% in Q2**, and **3.4% over 12 months, not seasonally adjusted**. The [reviewed October 30 Daily](https://www.usd-impact.com/news/2026-10-30/) includes the post-release correction record: its retained original `generatedAt` is 09:34 UTC, preceding the BLS 12:30 UTC release, while the exact later editorial revision was reviewed in [PR #1009](https://github.com/usdimpact/usd-impact-site/pull/1009). The early generation timestamp alone must **not** be cited as proof the outcome was known before release.

**Cross-asset interpretation boundary.** The above releases form an observable policy, activity, inflation and labor-cost backdrop, but they do **not** establish a realized October 26–30 DXY trend, Treasury real-yield move, oil/gas change, gold/Bitcoin performance, stock-index direction, or a current USD Impact Score. Any future analysis asserting such a response needs separately dated, rights-cleared market observations and a reviewed methodology. Existing published Daily descriptions should not be counted as independent market-data observations.

## Release-decision dependency — no implicit November 13 eligibility

The Monthly validator requires **exactly four consecutive Friday** source editions, each `published`, and a four-point `scorePath` that exactly agrees with those Weeklies' score values and regimes. The current `monthlyEligibility` helper separately takes the first four published Weeklies strictly after the last Monthly. These are **both** binding requirements, not alternatives.

- The prospective **October 23 → October 30 → November 6 → November 13** sequence is valid *only if all four source Weeklies actually become published and authorized*. As of October 30, October 30 is missing and the last two dates are future. A future November 6 or November 13 publication cannot simply skip the October 30 gap under the existing validator. No retrospective/backdated Score or invented report is an acceptable fix.
- **Original eight-driver Score path:** The existing [October 29 S&P DJI disposition](https://github.com/usdimpact/usd-impact-pipeline/issues/155#issuecomment-6512318653) requires a **paid license for the described commercial Score use including aggregate-only output**. There is no executed license or authorized additional market-data licensing budget. Even a future signed S&P license would not by itself clear every other provider, FRED delivery/retention, historic output, public schema, or Production permission. Do not assume a hypothetical $300 allocation meets an unknown license fee.
- **Independent non-Score editorial path:** It may be evaluated as a *separately named, separately reviewed product* without claiming equivalence to the original Score-derived Weekly/Monthly. It needs its own source-level rights, methodology, content/validator and reporting-cadence design, plus explicit owner release approval. The [independent Macro Context Panel](https://github.com/usdimpact/usd-impact-pipeline/issues/313) has its own HOLD and is **not** automatically a substitute for an eligible Score Weekly.
- **Until a distinct decision is recorded:** keep the original Score/Weekly rights HOLD, PR #1014 Draft, and the Monthly release blocked; continue only existing approved Daily publication and editorial-source collection. No provider outreach, license purchase, provider fetch, historical data deletion, rights-gate change, code migration, retrospective report or public release follows from this packet.

## Editorial structure — proposed themes, not report copy

1. **Policy:** October 28 FOMC decision versus its earlier October 26–27 scheduled previews; no implied USD reaction.
2. **Growth and inflation:** dated October 29 GDP advance and September PCE; separate reference periods, seasonal adjustment and release timing.
3. **Labor cost:** October 30 ECI; q/q deceleration versus prior quarter, 12-month comparison and exact post-release editorial provenance.
4. **Energy and the dollar transmission:** only those EIA and asset-market observations actually supported by the eventual published Weeklies; no live WTI/gas/Gold/BTC directional claim from macro headlines alone.
5. **Evidence and regime:** four source Weeklies' *approved* aggregate regime observations only after upstream provider rights, versioned public-safe schema and private evidence boundary have been reviewed. Current Score rights are HOLD, so no Score path or contribution story can be drafted as if licensed.

## Gates remaining before a future Monthly candidate

- [ ] A legitimate completed-Friday **Oct 30 Weekly**, source-bounded to the five published Dailies, with no fabricated Score; resolution of upstream Score and derivative redistribution rights is independently required.
- [ ] Published and checked Weeklies for **Nov 6** and **Nov 13**, maintaining consecutive Friday continuity.
- [ ] Exact four source Weekly files with published status, matching periods and URLs, and authorized Score/regime input under a **separately reviewed rights-safe publication contract**. Do not reuse legacy component z-scores/contributions as a workaround.
- [ ] Monthly theme and fact-line review against each published source Weekly, without inferring contemporaneous asset returns, forecasts, market impact or provider authorization.
- [ ] Normal Monthly validator + full Web quality/CodeQL/Dependency Review, exact-head Vercel Preview READY, and **specific owner editorial/compliance approval of the final text and source-rights boundary**.
- [ ] Protected merge only after the gates, followed by READY Production deployment and real live Monthly/report-hub verification. No existing research-private/member report route is authorized by this packet.

**Dispositions:** Monthly **PREPARATION ONLY**; next Monthly release **HOLD (1/4 eligible source Weeklies and Score rights unresolved)**; existing published [Oct 16 Monthly](https://www.usd-impact.com/reports/monthly/2026-10-16/) and [Oct 30 Daily](https://www.usd-impact.com/news/2026-10-30/) remain unchanged. Educational/informational only; not investment, financial, legal or trading advice.
