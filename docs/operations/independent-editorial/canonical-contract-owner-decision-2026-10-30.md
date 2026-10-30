# Owner decision packet — independent educational Weekly/Monthly (2026-10-30)

> **DRAFT / HOLD / NOT A LEGAL OPINION OR RELEASE AUTHORIZATION.** This packet consolidates the proposed internal editorial decisions and makes manual sign-off straightforward. It must not be used to merge PRs, publish, buy data, retrieve external provider observations, alter original Score rights gates, or change Production. No provider/agency correspondence is sent.

## Recorded owner decision — APPROVED FOR DRAFT EDITORIAL DIRECTION ONLY

The owner explicitly approved the following on **October 30, 2026**. The instruction is recorded in [`owner-editorial-direction.draft.json`](owner-editorial-direction.draft.json) and this Draft PR; it is **not** an independent agency-rights receipt, signed legal assessment, published-content sign-off, a final public product launch, or consent to change existing releases.

> Approved: proposed English names, free/public educational direction, verified Daily sources, and four-Weekly Monthly. Draft-only. Keep all rights and Production gates on HOLD.

| Owner-directed choice | Approved only within this draft |
| --- | --- |
| English Weekly working name | **USD Impact Macro Weekly Review** |
| English Monthly working name | **USD Impact Four-Week Macro Review** |
| Editorial language | **English** |
| Intended eventual reader access | **Free/public educational** (does not create or open a route, entitlement, subscription, RSS, indexing or checkout) |
| Editorial input boundary | **Already published and verified USD Impact Daily editions**, with exact source links and separate source-specific rights review; no new vendor observation retrieval |
| Monthly source rule | **The first four genuinely published, rights-cleared, consecutive-Friday independent Weeklies** after the latest published independent Monthly; never legacy Score-based Weeklies |

**Not approved:** independent source rights, exact claim publication times, public brand/legal copy, a specific production schema, the five-Dailies rule for holiday weeks, automated ingestion, public route, preview, merge, deployment, release timing, redistribution, historical Score data reuse or any original Score rights-gate change. These remain separate HOLDs. The Oct 30 sample remains an **unpublished** draft and the next independent Monthly has **0 of 4** eligible source Weeklies.

## Recommended draft technical foundation — NOT A RELEASE CONTRACT

**Preferred Draft technical contract**: the source-pinned `independent-editorial-draft-v1` (`series: independent_macro_education`) in [Draft PR #1019](https://github.com/usdimpact/usd-impact-site/pull/1019), not the alternate synthetic `independent-editorial` series used in [Draft PR #1020](https://github.com/usdimpact/usd-impact-site/pull/1020). This choice is **a development recommendation**, not a Production/public schema approval. It retains exactly five date-stamped Daily source Git blob hashes, source ID/source URL verification against existing published Dailies, six reviewed editorial claims, and post-release correction evidence.

Draft #1020 provides the independently recorded [all-deny source-rights ledger](https://github.com/usdimpact/usd-impact-site/blob/agent/independent-editorial-reports-design-2026-10-30/governance/independent-editorial-source-rights-review-2026-10-30.json) and separate nonrelease synthetic checks. **Do not merge #1019 and #1020 together**, assume contract interoperability, or overwrite the shared `apps/web/package.json` test command. Select a single versioned contract with an explicit future review. The Draft #1019 validator now also contains a first-four independent Monthly check with caller-attested complete source inventory; the attestation is not independent proof of publication or legal authority.

## Exact allowed proposed use (only after independent sign-off)

- **Editorial text only**: explain official released facts in USD Impact's own words, link directly to dated issuer statements, and cite full agency names, release titles, publication dates and observation periods. Calendar previews must never be counted as policy decisions.
- **No third-party assets or data feeds**: no downloaded/rehosted agency logos, photos, figures, charts or embedded iframe; no Yahoo, S&P, CME, Cboe, ICE, licensed DXY/WTI/S&P 500/VIX/BTC/gold/real-yield observations, original Score z-scores, weights, histories or contributions.
- **No automated feed ingestion/storage**: prepare only from the previously approved, pinned Daily files and any independently permitted text snippets. No new GET/HEAD of numerical series, API consumption, scraping, time-series storage, screenshots, HTML snapshots, provider cache, archive, private derived dataset, or commercial machine redistributor in this approval stage.
- **No measurable cross-asset conclusions without rights-cleared independent observations**. Discussion of conditional USD policy transmission mechanisms is educational; it is not a statement about observed asset returns, forecasts, or trading signals.
- **No implied endorsement** by the Fed, BEA, BLS or other federal agencies, no government wordmarks/logos, and no assertion that U.S. public-domain status answers Romanian/EU or international re-use rights.

## Specific six-claim source-rights decision list (all PENDING)

The Oct 26–30 source-pinned Weekly in [PR #1019](https://github.com/usdimpact/usd-impact-site/pull/1019) contains the exact primary links below. "Published Daily verified" is not a new authorization to commercially redistribute or archive external material.

| Claim ID | Issuer/dated exact primary item | Intended excerpt/attribution | Rights disposition |
| --- | --- | --- | --- |
| `fomc-preview-oct26` | [Fed October event calendar](https://www.federalreserve.gov/newsevents/2026-october.htm); Oct 26 published Daily | Own prose about scheduled FOMC meeting; link-out; "Source: Board of Governors of the Federal Reserve System" | PENDING (calendar context only) |
| `fomc-reminder-oct27` | [Same Fed October event calendar](https://www.federalreserve.gov/newsevents/2026-october.htm); Oct 27 published Daily | Own prose; *same meeting* not a new decision | PENDING |
| `fomc-outcome-oct28` | [Fed Oct 28 FOMC statement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm) | Own prose on target range/vote; date/time of release and claim review need separate evidence, no observed dollar move | PENDING |
| `gdp-oct29` | [BEA Oct 29 Q3 GDP advance estimate](https://www.bea.gov/news/2026/gdp-advance-estimate-3rd-quarter-2026) | Own prose; distinguish 3.4% SAAR Q3 vs 2.2% Q2; do not mix y/y | PENDING |
| `pce-oct29` | [BEA Sep 2026 Personal Income and Outlays, issued Oct 29](https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026) | Own prose; separate September PCE m/m and y/y, headline versus core | PENDING |
| `eci-oct30` | [BLS Oct 30 ECI archive release](https://www.bls.gov/news.release/archives/eci_10302026.htm) | Own prose; distinguish Q3 q/q SA from y/y NSA; [post-release owner review](https://github.com/usdimpact/usd-impact-site/pull/1009#issuecomment-6525502611) is a *content correction receipt*, not a reuse-rights approval | PENDING |

The source-pinned specimen has **four** `official_outcome` claims, three of which presently have `sourceReleaseAt: null`. A `null` event-time field is *not* acceptable evidence of release timing for a future publishable contract; maintain fail-closed release review until exact release and subsequent editorial-review times are verified. The Draft-only validator does not grant release clearance.

## Published official agency reuse notices — evidence, not one-click clearance

- [Federal Reserve Board disclaimer](https://www.federalreserve.gov/disclaimer.htm): generally public-domain Board materials with Board credit, exceptions for non-Board photos/graphics, prohibited official seals/logos and framing. The exact release/calendar and any external content require review.
- [BEA copyright FAQ](https://www.bea.gov/help/faq/147): unless otherwise stated BEA information is public domain, with source attribution appreciated.
- [BLS copyright/linking information](https://www.bls.gov/bls/linksite.htm): BLS public-domain materials and link-outs allowed with BLS attribution; previously copyrighted images/illustrations and BLS emblem are exceptions.
- [EIA copyrights/reuse](https://www.eia.gov/about/copyrights_reuse.php): many EIA-owned reports/data may be reused with publication-date acknowledgment and translation credit, but privately contributed/photographic/logo content can be restricted. **EIA is NOT in the six-claim pilot.**
- [USAGov federal-materials guidance](https://www.usa.gov/government-copyright): agency websites can include third-party work, official logos and foreign-country rights differ. Confirm Romanian/EU-facing distribution separately.

These notices support a narrow future path of independent paraphrase/citation rather than licensed Score-derived computation. They do not settle whether every exact issuer text/image, automated transport, subscriptions, derivative publication, retention or international use is approved. No decision flags are turned on in #1020.

## Independent reporting calendar — decision proposal

- **Weekly**: current pilot requires precisely 5 genuinely published and Git-version-pinned Monday–Friday Dailies. Holiday/missing-Daily policy unresolved; **never fabricate an edition**. First external publication would need a new approved review/rights and route contract, not retroactively publish the Oct 30 Draft.
- **Four-week Monthly**: exactly the **first four genuinely published, consecutive-Friday independent Weeklies** after the latest independent Monthly. Source reports need their own immutable public receipts, a verified complete source ledger, and prior Monthly source-consumption history. Legacy Oct 23 Score-derived Weekly is ineligible. **0 of 4 independent Weeklies** currently published; no independent Monthly date is promised.
- **Status**: every validator and editorial template must return `publishReady:false` or `releaseAuthorized:false` in these Draft contracts, even when all synthetic structure tests pass.

## Remaining decisions — separate from this approved draft direction

The working titles, English editorial language, intended free/public audience, published Daily source boundary and four-independent-Weekly Monthly are **already approved as draft direction**. Do **not** ask the owner to repeat those approvals. The following items remain unapproved and must not be assumed from the owner's message:

1. **Exact-source reuse and international/legal treatment:** rights review for each Fed, BEA and BLS item, exceptions, third-party material, commercial presentation, local jurisdiction, archival and translation use. Original Score and FRED delivery/retention reviews remain independent.
2. **Release-time evidence:** three of four dated outcome claims in the Oct 30 source-pinned pilot have `sourceReleaseAt: null`. Require actual source release timing plus later editorial receipt, without fabricating dates or timestamps.
3. **Weekly completeness policy:** the present *pilot validator* demands five published Monday–Friday Dailies; the owner did not approve that requirement permanently for weeks with holidays, skipped editions or source failures. Do not infer backfill permission.
4. **One final delivery contract:** decide how the source-pinned #1019 draft and rights-matrix/synthetic-contract #1020 fit together. Their schemas differ; they must not be silently merged or treated as interchangeable.
5. **Separate release governance:** approve independent routes, final compliance language, noindex/protected Preview, distribution, externally authenticated publisher receipts, exact-head QA, and **explicit Production launch** in distinct subsequent owner instructions. Current approval does not grant any of them.

No mandatory hosting, DNS, account, paid-license or manual GitHub action is necessary to record the decisions in this packet. The remaining meaningful manual activity is the scoped rights review below. Keep both PRs **Draft/unmerged**.

## Manual rights check (owner or qualified reviewer)

1. Open each of the **five distinct official primary items** listed above and the matched agency notice. Verify whether the exact issuer-authored textual material carries a third-party notice, embedded protected chart, photo, logo or redistribution condition; **do not copy raw economic series or imagery**. Record exact source URL, human reviewer, review date, permitted *type* of use, and relevant notice in a private decision log.
2. Assess **business/commercial and international** (Romania/EU/LATAM) use and downstream retention (site/newsletters/translations/backups). U.S. government public-domain status alone is not a legal opinion on cross-border publication. Seek counsel or the agency if an exception or uncertainty materially affects the intended use; do not mark fields true on assumptions.
3. Confirm the official outcome **release timestamps and later editorial review receipts** for Oct 28–30. The original Oct 30 Daily `generatedAt` precedes the actual BLS ECI announcement. Do not backdate review receipts or treat a release date alone as proof of a release-time observation.
4. Add a dated scoped outcome to the Draft review discussion (or a separate private evidence record). **Keep all rights flags false until separately authorized**, with no provider solicitations, permissions requests or external correspondence automatically sent by these drafts.
5. To request a later *new* Preview/Production phase, give a separate explicit instruction only after these decisions and a consolidated, versioned contract have completed exact-head CI. Current PRs remain Draft and cannot be release candidates.

## Cross-reference and stop conditions

- [Legacy Score rights HOLD #155](https://github.com/usdimpact/usd-impact-pipeline/issues/155) and [FRED retention #282](https://github.com/usdimpact/usd-impact-pipeline/issues/282) are untouched.
- [Independent three-dial Macro Context Panel #313](https://github.com/usdimpact/usd-impact-pipeline/issues/313) is a distinct source model with separate rights HOLD.
- [PR #1020: source-rights/governance reference](https://github.com/usdimpact/usd-impact-site/pull/1020) must not be silently merged with #1019. Its denial flags remain authoritative *draft indicators*, not a present permission grant.
- [Daily publishing issue #840](https://github.com/usdimpact/usd-impact-site/issues/840) remains a separate incident; do not schedule a duplicate Daily.

**Current approval state: owner-approved editorial DRAFT direction only (English working names, proposed free/public access, verified published Daily input, first-four independent Monthly). No final rights, public release schema, commercial reuse, Preview, merge or Production approval.**
