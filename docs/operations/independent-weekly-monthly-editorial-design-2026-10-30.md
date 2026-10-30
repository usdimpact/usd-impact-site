# Independent USD Impact Weekly and Monthly Educational Reviews — Design v0 (October 30, 2026)

> **OWNER APPROVED DRAFT PREPARATION ONLY. RELEASE HOLD. NO MERGE / NO DEPLOY / NO PUBLICATION / NO PROVIDER FETCH.**
>
> Separate editorial product: not the original eight-driver USD Impact Score, not a renamed Score, not the current Score-derived Weekly or Monthly. No authority to reuse frozen Score history, normalized values, z-scores, contributions, archives, Yahoo/FRED observations, or market-data licenses. $0 **additional market-data-license budget** (not a claim that legal review, development or hosting are free).

## Authority and scope

Owner approved preparing a distinct educational Weekly and Monthly with existing verified published Daily text and independently rights-cleared official sources, on a Draft branch only. Existing Production, public routes, search indexing, membership, commerce, Score publication rights gates, Score formula and historical products remain untouched. The original owner approval covered design preparation, and the subsequent continuation approval extends Draft-only preparation to an **exact-source rights ledger and a standalone, pure synthetic-only validator with tests**. This PR therefore contains isolated documentation, the all-deny review ledger and independent offline test files only. No application import, package-script integration, scheduled workflow, source adapter, content entry, deployed route or production release. No completed review, legal permission, publisher receipt or release authorization is implied by approval to draft.

Authoritative issues: [Score redistribution #155](https://github.com/usdimpact/usd-impact-pipeline/issues/155), [FRED retention #282](https://github.com/usdimpact/usd-impact-pipeline/issues/282), [independent Macro Context Panel #313](https://github.com/usdimpact/usd-impact-pipeline/issues/313), and [Daily scheduler incident #840](https://github.com/usdimpact/usd-impact-site/issues/840). Existing original-Score Monthly source packet: [Draft #1014](https://github.com/usdimpact/usd-impact-site/pull/1014). None is closed or superseded by this proposal.

## Publication identity and separation

Working titles: **Independent Weekly Macro Review** and **Independent Four-Week Macro Review**. Editorial prose only, no numerical Score or synthetic replacement metric; the name, legal/compliance copy, subscriptions, routes and audience promises require separate approval.

- Internal draft folders may be proposed later; **do not add** `apps/web/src/content/weekly-reports`, `monthly-reports`, production pages or public feeds on this branch.
- Use dedicated **future** collections and routes only after a separate reviewed content-schema contract, for example `independent-weekly-reviews` and `independent-four-week-reviews`; these are placeholders, not reserved endpoints.
- Distinct chronology, separate validator, separate published-source ledger and separate eligibility; never read legacy `scorePath`, original `monthlyEligibility` or old Score source URLs for the independent publication.
- Existing public legacy Weekly/Monthly pages and historical reports remain unchanged. No silent renaming, redirects, substitution or claim of historical comparability.

## Allowed editorial evidence — conservative boundary

1. Existing **published** USD Impact Daily editorial text with exact dates, source IDs, original source URLs and review corrections. This is editorial provenance, **not** independent rights to republish external data.
2. Links to primary government issuer statements and release calendar, subject to **exact-source commercial reuse, transport, copyright, attribution, automated retrieval and archival rights review** before any new copy, extract, feed or numeric ingestion.
3. No live market prices, proprietary index observations, frozen Score inputs, raw vendor feeds, retained provider numeric histories or new market-data GET/HEAD during design. Government publication alone does not guarantee all rights (notably third-party-contributed data, H.10/H.15 transport, EIA/WPSR and corrections).
4. Link-out citations and independent paraphrase of already-reviewed claims are editorial candidates, not legal permissions. Distinguish issuer release time, economic observation period, Daily generation time, later editorial revision and public publication date.
5. Every claim carries a primary source URL, issuer, as-of date, exact Daily edition, claim-level verification status and review receipt (nullable). No unsupported intraday USD, DXY, S&P 500, VIX, WTI, gold or BTC reactions.

## Exact offline Weekly contract (draft only, not an Astro content collection)

Implemented for structural rehearsal in [the pure validator](../../apps/web/scripts/independent-editorial-validator.mjs). The test suite [uses invented 2099 fixtures](../../apps/web/scripts/test-independent-editorial-validator.mjs); it does not read actual Dailies, data provider values or historical Score inputs.

| Field | Required meaning |
| --- | --- |
| \`contractVersion\` | Exactly \`independent-weekly-editorial-v0-draft\` |
| \`series\` | Exactly \`independent-editorial\`; no original Score Weeklies |
| \`status\` | \`draft\` or structurally hypothetical \`published\` (never a real publication action) |
| \`id\` and \`slug\` | \`independent-weekly-YYYY-MM-DD\` and test namespace \`/independent/weekly/YYYY-MM-DD\`; **no route exists or is authorized** |
| \`periodStart\` / \`periodEnd\` | Same Monday–Friday week; valid dates, Friday completed before editorial cutoff |
| \`editorialAsOfUtc\` | Explicit UTC timestamp; validator requires an independent \`asOfUtc\` argument |
| \`sourceDailyEditions\` | 1–5 distinct dated published Dailies, with original generation and editorial-review timestamps |
| \`claimLineage\` | Unique claim ID, source ID, issuer, direct HTTPS URL, issuer publication time, corresponding Daily date and claim review time; **separate post-release revision receipt** if Daily generated before source appeared |
| \`themes\` | Titles referencing approved claim IDs only |
| \`approvals\` | \`sourceRightsDecisionReceipt\`, \`editorialApprovalReceipt\`, \`productionApprovalReceipt\`; required for hypothetical published shape, but not independently authenticated by this test |
| \`complianceNote\` | Educational, expressly not investment/trading advice |

The validator rejects unknown schema fields and legacy keys such as \`score\`, \`scorePath\`, \`regime\`, \`zScore\`, \`contributions\`, original Weekly URLs and public Score data pointers. All outputs **always** contain \`releaseAuthorized:false\`, even when \`structurallyValid:true\`. Syntactically plausible approval-reference strings are *not* legal or owner signatures.

**Run in offline development only:** \`node --test apps/web/scripts/test-independent-editorial-validator.mjs\` from the repository root. No workflow or npm script has been changed to invoke it automatically. The 45 cases were executed against the exact staged module in an isolated JavaScript harness; direct Node command execution remains a separate QA step.

## Proposed independent Monthly schema and eligibility

Working rule: exactly **four consecutive published independent Weeklies** starting after the latest published independent Monthly; no calendar-month assumption. It must **not** include or count published original-Score Weeklies and must not turn five Dailies into an eligible Weekly implicitly.

Fail-closed validator requirements:
- Exact four distinct source Weekly identifiers, with the source files/URLs/periods matching a standalone independent collection and `status=published`.
- Four completed consecutive Fridays, strictly increasing by seven days, with no skipped Friday; the Monthly begins at the first source Weekly's start and ends at the fourth source Weekly's end.
- Source publisher receipts, primary links and reviewed factual claim lineage all present; issuer sources and their observation dates independently checked. No source from the future.
- No original Score `scorePath`, regime, Score history, component values, or legacy `weekly_input` reference anywhere in the derived Monthly.
- No duplicate reuse of a Weekly across published independent Monthly editions.
- Require explicit **complete prior independent Monthly history** to check that source Weeklies were not used by another published Monthly. Missing history, overlapping Weeklies or duplicate Monthly period must fail closed.
- Explicit separate rights/compliance, editorial and Production approvals; absence or ambiguity fails closed. The offline validator cannot authenticate a claimed receipt and **never authorizes publication**.

Current state: **zero independent Weeklies exist**. The October 23 legacy Weekly is not eligible. Consequently there is **no independent Monthly release date** and no authority to backdate an independent Weekly for October 30.

## Editorial seed: Oct 26–30 published Dailies (unpromoted source ledger)

| Edition | Relevant issuer claim already reviewed in Daily | Original primary issuer link |
| --- | --- | --- |
| [Oct 26](https://www.usd-impact.com/news/2026-10-26/) | Fed/BLS meeting and release calendar preview; no observed outcome | [Fed calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm) |
| [Oct 27](https://www.usd-impact.com/news/2026-10-27/) | FOMC meeting scheduled; not a distinct policy decision | [Fed calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm) |
| [Oct 28](https://www.usd-impact.com/news/2026-10-28/) | Fed held 3.75%–4.00% target range, 10–2 vote; **do not claim dollar reaction** | [Oct 28 Fed statement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm) |
| [Oct 29](https://www.usd-impact.com/news/2026-10-29/) | BEA advance Q3 GDP +3.4% SAAR versus Q2 +2.2%; September PCE headline 3.6% y/y and core 3.1% y/y | [BEA GDP](https://www.bea.gov/news/2026/gdp-advance-estimate-3rd-quarter-2026), [BEA PCE](https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026) |
| [Oct 30](https://www.usd-impact.com/news/2026-10-30/) | BLS Q3 ECI 0.8% q/q SA versus Q2 0.9%, and 3.4% y/y NSA | [BLS dated ECI](https://www.bls.gov/news.release/archives/eci_10302026.htm) |

The Oct 30 Daily's original `generatedAt` precedes ECI release; the separately reviewed post-release revision and PR #1009 provenance must accompany the ECI claim. GDP (annualized quarter), PCE (September monthly/year-over-year), ECI (seasonally adjusted q/q versus unadjusted y/y) are not interchangeable. This section is **not** a retrospectively published Weekly.

## Independent Weekly editorial specimen — NOT PUBLISHED

**Working headline:** Policy held steady while US growth, inflation and labor-cost releases sharpened the next USD watchlist (Oct 26–30).

**Executive read:** The Federal Reserve held its 3.75%–4.00% policy target range on October 28. BEA's October 29 releases reported stronger Q3 annualized real GDP growth and September PCE inflation readings. BLS's October 30 ECI release showed quarterly civilian compensation growth of 0.8%, following 0.9% in the prior quarter. These dated releases provide policy and macro context but **do not verify a realized direction for the dollar, real yields, energy, gold, equities or Bitcoin**.

**Transmission lens:** Stronger real activity, inflation pressure and moderating quarterly compensation growth can shape expectations for policy and discount rates; their effects on cross-assets may diverge. The observed data here are the issuer releases, **not** inferred market-price changes or an eight-driver Score regime.

**Common mistake:** Treating October 26–27 calendar previews as separate Fed decisions, interpreting annualized GDP as year-over-year GDP, mixing q/q SA with y/y NSA ECI, or using the Daily's original machine generation timestamp as a post-release approval receipt.

**What to watch:** Upcoming *scheduled* employment and policy updates, checked against official issuer calendars at the future editorial cutoff; no forecast or trade direction.

**Source and compliance note:** Primary links above; educational only, not financial or trading advice. Specimen is review-only and needs rights/attribution/compliance decision before any standalone report content is prepared for publication.

## Safe preparation sequence and release gates

- [x] Owner authorizes **Draft-only** independent editorial design with $0 additional market-data licensing.
- [x] Define separate output identity, source lineage, editorial specimen, and standalone Monthly rules in a nondeploying documentation-only branch.
- [x] Record relevant agency **general reuse policies** and seven exact issuer candidate references in the [source-rights review matrix](independent-editorial-source-rights-review-2026-10-30.md) and [all-deny JSON ledger](../../governance/independent-editorial-source-rights-review-2026-10-30.json). **This is not exact-item rights clearance:** 49/49 permissions and all 10 publication gates remain false.
- [ ] Complete issuer exact-source third-party/copyright, link/excerpt, commercial use, translation, automated retrieval and retention reviews; record an actual scoped authority decision/receipt. Do not fetch market observations.
- [ ] Approve independent methodology, final publication naming, reader-facing disclaimers and precise claim-level editorial signoff.
- [x] Stage pure standalone validator and synthetic-only test suite after owner continuation approval; 45/45 V8 in-memory regression bodies passed. **No application integration, scheduled run or Production use.** Existing original Score validators and publishing workflows remain unchanged.
- [ ] Execute the standalone `node --test` command in a verified Node checkout; keep this additional runner result distinct from the isolated in-memory regressions. No provider retrieval is needed.
- [ ] Produce four approved and *actually published* independent consecutive Weeklies, then separately review a Monthly from those exact editions.
- [ ] Exact-head CI + protected Preview + accessibility/sitemap/noindex + public rights + owner Production approval **all separately required** before release. No current approval covers these steps.

**Stop conditions:** missing licensing/citation rights, a new provider-derived observation, missing source Weekly, skipped Friday, absent editorial receipt, original Score dependency, paid request, altered rights gate, changed public route or commerce, or unintended deployment => HOLD.

**Disposition 2026-10-30:** independent-series design **PREPARED AS DRAFT**; official original Score / original Weekly / original Monthly / independent series all **NOT AUTHORIZED FOR NEW PUBLICATION**. Keep Daily publication and incident #840 monitoring separately.
