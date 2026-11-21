# Calendar-month independent Macro Monthly — November 2 owner direction / October Preview

**Date:** 2026-11-02. **State:** Draft-only review candidate. **Product family:** independent free educational macro review. **No new Production permission, Score rights, market-price feed, paid media or billing change.**

## Owner direction — replaces the independent *four-Weekly cadence assumption*

The owner requests an **October 2026 calendar-month preview**, then **November 2026** under the same method. Calendar months are **not defined as four Friday Weeklies**. October 1–31, 2026 contains five Friday-ending dates (2, 9, 16, 23, 30); November 1–30 contains four (6, 13, 20, 27). Missing independently published Weekly editions must be shown rather than represented as complete. A month may support an independently authored, original-source-linked **educational Monthly Preview** without inventing or assembling missing Weeklies, once its calendar period has ended and each published factual claim has been verified.

This direction **supersedes the four-independent-Weeklies prerequisite in Draft PR #1019/#1020 templates for this distinct educational series**. Those are old, parallel Draft contracts; **do not merge them alongside this branch without one contract reconciliation**. It does **not** rewrite the historical Score-derived `monthlyEligibility` function, `validate-monthly-reports.mjs`, `scorePath` or original four-Weekly monthly release terms. The earlier 1/4 counter remains a statement only about that **historical Score** gate, **not** an embargo on the independent October preview.

## Calendar contract and evidence coverage

| Edition | Source reporting window | Friday dates | Published free independent Weeklies at this checkpoint | Review disposition |
| --- | --- | --- | --- | --- |
| October 2026 | 2026-10-01 through 2026-10-31 | 2, 9, 16, 23, 30 (5) | 2026-10-30 only (1 of 5) | Source-based editorial preview candidate now; **not** represented as five completed Weeklies |
| November 2026 | 2026-11-01 through 2026-11-30 | 6, 13, 20, 27 (4) | None as of 2026-11-02 | Do not create November report or claim outcomes before month close |
| Other months | First to final date (28/29/30/31 days) | Exact Friday count, which may be 4 or 5 | Explicitly observed, never backfilled | Flexible monthly editorial method; **not** an automatic publish permission |

**Separation:** The independent Monthly uses **month-bounded issuer facts**, not historical licensed weekly Score paths. `apps/web/src/lib/independent-calendar-month.js` returns the actual Friday dates, observed independently published Fridays and missing dates. It always returns `releaseAuthorized:false` and never changes historical `monthlyEligibility`. The October `/macro-reviews/monthly/2026-10/` route is staged in a separate Draft-only `agent/*` branch, **noindex/nofollow/noarchive/nosnippet**, no sitemap inclusion and no link on the public Reports index in this Draft. The existing `/reports/monthly/YYYY-MM-DD` routes are untouched.

## October editorial scope — six dated first-party source leads

| Publication date | Issuer + claim basis | Exact issuer release | Measurement boundary |
| --- | --- | --- | --- |
| 2026-10-02 | BLS September payrolls +29,000; unemployment 4.2% | https://www.bls.gov/news.release/archives/empsit_10022026.htm | September observation, October publication |
| 2026-10-14 | BLS September headline CPI +0.6% m/m SA and +3.7% y/y NSA | https://www.bls.gov/news.release/archives/cpi_10142026.htm | September prices, two adjustment bases |
| 2026-10-28 | Federal Reserve target range held 3.75%–4.00%, vote 10–2 | https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm | Policy decision, not market return |
| 2026-10-29 | BEA Q3 GDP advance +3.4% annualized, Q2 +2.2% | https://www.bea.gov/news/2026/gdp-advance-estimate-3rd-quarter-2026 | Quarter, not year-over-year growth |
| 2026-10-29 | BEA September PCE +3.6% y/y headline, +3.1% y/y core | https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026 | September monthly data published October; not GDP quarterly PCE |
| 2026-10-30 | BLS Q3 compensation +0.8% q/q SA, +3.4% y/y NSA | https://www.bls.gov/news.release/archives/eci_10302026.htm | Separate quarter/12-month windows |

Existing published USD Impact Dailies on these six issuer events: Oct 2, Oct 14, Oct 28–30. The independent Oct 26–30 Weekly is already published separately. The Draft does **not** imply October 9, 16 or 23 were published in the independent Weekly format, or that all October macro news is represented. It excludes historical Score values, live market-price observations, return/causality claims, ratings, licensed charts, third-party screenshots and market-data vendors.

## Publication safety acceptance

1. Final editor verifies every original issuer URL, correct released/statistical period, rates, adjustments, dated revisions, and own-word paraphrase. Verify no overclaim of month completeness. Six exact cited first-party URLs only; any link or updated value must be independently checked.
2. Confirm original English copy and visible AI-assisted preparation, publisher entity, official-publisher non-endorsement, educational/risk note, navigation/privacy/terms/accessibility, source provenance, and per-item permissible reuse/distribution under company rights policies.
3. Strict separation: original Score and provider-sourced data remain on HOLD; historical `/reports/monthly/` and `report-periods.js` four-Weekly gate untouched. No customer account, subscriptions, checkout, media, DNS, analytics or marketing changes.
4. Exact-head GitHub CodeQL/Dependency/Web quality/build PASS and noindex/CSP/no-sitemap tests. Protected preview/manual responsive 320/390/768/1440 and source-link checks if release planned. Current branch `agent/*` intentionally **does not request a Vercel Preview**; the Draft source page is an editorial preview, not a publicly accessible page.
5. Any public **October preview** publication requires separately reviewed final text, site/legal evidence, exact commit SHA, owner release approval and a scoped merge/deploy. Do not automatically expose a new public Monthly route from this Draft.
6. **November**: after 2026-11-30, separately verify that month's actual primary-source outcomes, independent Weeklies that truly published, rights, and releases. Don't fabricate December-review data or generate November early. The calendar-month rule should apply even if a holiday, missing Friday Weekly or five-Friday month occurs.

## Review and coordination

- Canonical independent Weekly now published: [October 26–30 free Macro Weekly](https://www.usd-impact.com/macro-reviews/weekly/2026-10-30/).
- Historical Score-based gate: `apps/web/src/lib/report-periods.js` and `apps/web/scripts/validate-monthly-reports.mjs` — **unchanged**.
- Older independent format experiments: Draft [#1019](https://github.com/usdimpact/usd-impact-site/pull/1019), Draft [#1020](https://github.com/usdimpact/usd-impact-site/pull/1020); do not silently combine incompatible versions.
- Prior historical source packet Draft [#1014](https://github.com/usdimpact/usd-impact-site/pull/1014): its October19–Nov13 window and 1/4 estimate describe the original Score series, not the new free calendar Monthly.
- Fundraising and Master tracker updates must differentiate **independent calendar Monthly** from **legacy Score 1/4 rights HOLD**, and should retain the fact that November is future.

**Decision recorded:** calendar-month editorial preview accepted as owner direction; source, rights, design, QA and public launch are distinct gates. No live or paid action is implied.
