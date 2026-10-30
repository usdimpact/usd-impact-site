# Independent Weekly and Monthly educational reports — DRAFT ONLY

Owner direction: October 30, 2026. This is a zero-additional-market-data-license-budget, completely separate editorial family. This directory contains internal working files in an isolated, nondeploying agent/* pull request. It is NOT an Astro content collection, an existing Weekly/Monthly report, a Score-derived product, a public route, a launch request, or a licensed dataset.

## Approved draft editorial direction — October 30, 2026

The owner approved **English** working titles **USD Impact Macro Weekly Review** and **USD Impact Four-Week Macro Review**, with a **future free/public educational** readership direction, content grounded in **already published and verified USD Impact Dailies**, and a Monthly from the **first four genuinely published consecutive-Friday independent Weeklies**. This is approval for **draft preparation only**, not activation of any free/public web route or redistribution rights.

Machine-readable scope and explicit denied release actions: [owner-editorial-direction.draft.json](owner-editorial-direction.draft.json). Supporting source and legal decision checklist: [canonical-contract-owner-decision-2026-10-30.md](canonical-contract-owner-decision-2026-10-30.md). All exact-source rights, international reuse, archives/retention, final publishing schema, public-brand legal copy, five-Dailies holiday policy, Preview, merge and Production authorization remain separate HOLDs. Do not infer that a source citation or previously published Daily permits a new publication.

## Source and release boundary

- Only the already published October 26–30 Daily markdown files are read by the offline validator. Their exact Git blob hashes are pinned in weekly-2026-10-30.draft.json. No new official-provider GET/HEAD, live prices, paid model call, API, data persistence or scheduled workflow is used.
- The published Dailies' verified-primary labels establish editorial provenance, **not** a separate grant for commercial calculation, redistribution, archives or republishing third-party datasets. Each proposed reuse claim is marked pending_independent_source_review, with source IDs/URLs matched to the actual Daily frontmatter. Official publisher source-rights must be independently reviewed before any future publication.
- This editorial family must never import original Score v2/v3 artifacts, Yahoo/CME/ICE/S&P/Cboe index/futures values, Treasury/FRED cached histories, normalization moments, per-driver contributions or regimes. Do not call the independent commentary a new or continuous USD Impact Score.
- Issue 155 (Score provider redistribution), Issue 282 (FRED retention), and Issue 313 (government-source independent Macro Context Panel) remain separate HOLDs. This editorial system does not unblock or substitute for any of them. Existing published legacy Score artifacts and their historical treatment require their own counsel decision.
- No public Astro route, collection, report index, sitemap, email, RSS, membership, workflow, cron, checkout or data import is created here. Agent/* Vercel Git deployment is disabled. No merge or deployment is approved.

## What is prepared

1. Versioned, **non-releasable** independent editorial contract in apps/web/scripts/independent-editorial-draft.mjs. The script uses local published Daily files only, computes Git blob hashes to detect changed/unreviewed source editions, checks reference IDs, pinned official URLs and verified Daily highlights, enforces weekday completeness and post-release editorial provenance, and always returns publishReady=false.
2. The source-pinned October 26–30 sample Weekly JSON with six explicitly dated claims. The accompanying markdown is a working editorial read-through, not the final public report.
3. A future Monthly JSON/markdown outline with 0/4 independent published Weekly sources. The structural four-week gate requires four consecutive Friday-ending independently published Weeklies. Neither the October 23 historical Score-derived Weekly nor any other old Score report qualifies; four hypothetical receipts still never make this draft-version release ready.
4. Offline regression tests run via the existing apps/web package validate:reports command. They test mutated daily hashes, missing Dailies, forged published status, rights toggles, mismatched source IDs/URLs, unsupported market-reaction claims, post-release timing, original-Score input attempts and discontinuous Monthly windows. No real market-data observations are accessed.

## Editorial source ledger (existing published Dailies)

| Date | Git blob SHA | Role |
| --- | --- | --- |
| 2026-10-26 | a05089cbcb372862455157e0382a9a4e81cbd532 | Calendar preview; not a Fed decision |
| 2026-10-27 | 29ee81eb8ac3e49ebf4676c34fb025a052daf398 | Calendar reminder; no anticipated outcome |
| 2026-10-28 | c7e6ae165a445658aaefe5958f753c4474e89212 | Fed statement dated October 28 |
| 2026-10-29 | 068950a9aec9c4b5bee6ca8ce16ebdadd430451e | Dated GDP/PCE Daily; early generatedAt is not release proof |
| 2026-10-30 | f8881e383adba66eb801a3fbbcb4d1507de32917 | Later owner-reviewed GDP/PCE/ECI Daily; ECI post-release review receipt is pinned |

October 30 ECI timing: the original Daily generatedAt of 09:34 UTC precedes the actual 12:30 UTC BLS release; the later exact-version owner editorial review is documented at https://github.com/usdimpact/usd-impact-site/pull/1009#issuecomment-6525502611. Do not present the generatedAt timestamp as post-release evidence.

## Distinct reporting and future-month rule

The proposed *independent* Weekly is a non-Score explanation of official releases, their units/timestamps, educational USD transmission channels, evidence gaps and what to watch. No verified live asset-price return is inferred.

A future independent Monthly would use exactly the first four **separately published and rights-cleared independent Weeklies** in a consecutive completed-Friday sequence, with an independent source manifest and validator. As of October 30, there are **zero** such publications, hence **0/4**, not the legacy Monthly's 1/4. There is no calendar-month shortcut and no backdating or historical-score carry-forward. No earliest publish date is asserted.

## Latest offline readiness audit — still blocked

The draft validator now returns a separate read-only `readiness` section alongside its existing Weekly and Monthly results. It is computed **only from the pinned local October 30 Weekly, empty Monthly, and owner Draft decision JSON**, without consulting a website, market-data service, or external provider. The expected audit identifies **four dated official-outcome claims**, **three missing exact `sourceReleaseAt` timestamps** (`fomc-outcome-oct28`, `gdp-oct29`, `pce-oct29`), **six of six claims with source rights still pending**, and **zero of four actually published independent Monthly source Weeklies**. The BLS ECI claim has a release timestamp and linked later editorial receipt, but remains **rights-pending**. The audit additionally rejects any attempt to turn owner approval of names/access into source, Preview, merge, or Production authority. It always reports `HOLD_DRAFT_ONLY` / `releaseAuthorized:false`.

This dated snapshot is a **blocker inventory, not a real-time source or legal approval monitor**. The three missing release times must be verified from legitimate existing receipts and independently reviewed before any separately authorized future publishing contract; never fabricate or retrospectively backdate. Current source-rights permissions and public-production decisions remain disallowed. Green GitHub quality tests are evidence of an internally consistent draft, not an authorization to publish.

## Pilot source-rights reviewer worksheet — all pending

[Five-item exact-source worksheet](pilot-exact-source-rights-worksheet.draft.json) maps all six source-pinned Oct 26–30 claims to the five distinct exact Fed, BEA and BLS official item URLs and the existing published Daily Git blobs. Each item has **nine false (not granted) reuse dimensions** for issuer authorship/third-party components, commercial site use, attribution, international publication, email/RSS, translation, retention, automated source retrieval, and protected imagery/logos/charts. Human reviewer, decision authority, review timestamp and scoped receipt remain **null for every source**. The worksheet is **not** a substitute for [the separate all-deny governance ledger in Draft PR #1020](https://github.com/usdimpact/usd-impact-site/pull/1020); both remain review-only, and neither authorizes a source fetch, editor release, site route, PR merge or Production.

The first manual review, when an authorized reviewer is available, should consider **only** the exact official release item and the proposed original educational paraphrase/direct-link use. Do **not** classify a whole agency/domain as unrestricted, import live time-series observations or mark any reuse/retention/foreign-jurisdiction flag approved without the corresponding dated scoped evidence. For source time uncertainties, keep `sourceReleaseAt` null in the historical draft until a verified exact release and subsequent editorial receipt can be documented. The original Score and FRED rights gates remain independent and unchanged.

## Release-time evidence reconciled from existing project records — no issuer fetch

The separate [pilot release-timing evidence worksheet](pilot-release-timing-evidence.draft.json) now cross-references **pre-existing, reviewed internal evidence** for all four official outcome claims, without changing the pinned unpublished Weekly:

- The [October 28 FOMC evidence record](../fomc-2026-10-28-outcome-framework.md) states a scheduled **2:00 p.m. U.S. Eastern / 18:00 UTC** statement. The Oct 28 published Daily is generated after this schedule. Exact issuer posting time and a separately authenticated claim-level editorial receipt remain **unverified** for the new independent series.
- The [October 29 BEA calendar](../daily-major-release-calendars/2026-10-29.json) records **12:30 UTC** scheduled GDP/PCE releases. The original Oct 29 Daily candidate was generated **09:33 UTC**, so it could not be treated as post-release. The [later owner-requested correction in PR #938](https://github.com/usdimpact/usd-impact-site/pull/938#issuecomment-6510694719) was recorded **23:11 UTC**, and added actual BEA outcomes. The GDP calendar's `/index.php/news/` URL differs from the new pilot's exact `/news/` link; URL identity still requires human review.
- The October 30 BLS ECI claim already has a **12:30 UTC** release-time reference and [later correction receipt](https://github.com/usdimpact/usd-impact-site/pull/1009#issuecomment-6525502611), and remains **rights-HOLD**.

These observations reduce what a reviewer must rediscover but **do not** turn a scheduled event time into the exact time a federal website actually posted its document, authorize commercial source reuse, or invent a missing receipt. Three `sourceReleaseAt` fields remain **null** in the original independent Weekly draft (FOMC, GDP and PCE). The BLS ECI claim retains its prior **12:30 UTC official issue-time** value and later content-PASS receipt, but the separate evidence worksheet now correctly records its **independently authenticated exact website posting timestamp as unknown/null** too. Thus, all four `exactIssuerActualPublicationAtUtc` entries are **null**, while the scheduled/issued times remain available as separate editorial facts. Existing Daily/Weekly files are not rewritten. Only independently verified dated evidence may change previously null source-release fields after a separately reviewed Draft decision. The independent Monthly is still **0/4 published**.

## General agency policy evidence and separate PR crosswalk (draft only)

[Agency policy-only review](official-source-reuse-policy-evidence.draft.json) documents official Federal Reserve Board, BEA and BLS reuse/citation notices together with the [USAGov international-rights caution](https://www.usa.gov/government-copyright). Agency-authored public-domain information can generally be cited, linked and reused under the notices, subject to issuer-specific limitations, third-party exceptions and non-endorsement rules; neither the notices nor this memo approve these five **specific** sources or their Romania/EU/LATAM website, translation, archive, RSS or commercial use. No agency marks, photos, protected attachments, rehosted charts, provider feeds or original Score market inputs are permitted by the Draft.

The [exact five-source cross-PR rights map](cross-pr-exact-source-rights-map.draft.json) pins the overlapping source IDs and URLs to the frozen **Draft #1020** all-deny governance-ledger snapshot without importing #1020's incompatible schema. The separate BLS schedule is background context; future EIA sources are out of scope. Five source URLs are exact matches and **all their rights approvals remain denied**. This crosswalk is neither a source-rights signoff nor an authority to merge #1019 and #1020, create a public route, or activate any production/report feature. A later combined contract requires a new explicit decision and exact-head review.

## Exact issuer release-time fact check — new read-only review, still Draft

On October 30, 2026, the official publicly accessible announcement pages were checked read-only against the existing six-claim pilot. The [timing evidence ledger](pilot-release-timing-evidence.draft.json) now records **four agency-stated official release/embargo times**, which are distinct from exact first live website-posting instants:

| Outcome claim | Exact official issuer source | Official stated time | UTC | Still NOT verified |
| --- | --- | --- | --- | --- |
| Oct 28 FOMC outcome | [Federal Reserve statement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm) | 2:00 p.m. EDT | **2026-10-28T18:00:00Z** | Exact first web posting, fresh independent-Weekly editorial PASS, publisher rights |
| Oct 29 GDP advance | [BEA GDP Q3 advance](https://www.bea.gov/news/2026/gdp-advance-estimate-3rd-quarter-2026) | Embargoed until 8:30 a.m. EDT | **2026-10-29T12:30:00Z** | Exact first web posting, fresh independent-Weekly editorial PASS, publisher rights |
| Oct 29 September PCE | [BEA September PCE](https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026) | Embargoed until 8:30 a.m. EDT | **2026-10-29T12:30:00Z** | Exact first web posting, fresh independent-Weekly editorial PASS, publisher rights |
| Oct 30 ECI | [BLS September ECI release](https://www.bls.gov/news.release/archives/eci_10302026.htm) | Embargoed until 8:30 a.m. Eastern | **2026-10-30T12:30:00Z** | Exact first web posting, new independent-Weekly publication rights |

Issuer-reported facts were also checked against the same source items: Fed 3.75%–4.00% and 10–2 decision; BEA real GDP 3.4% SAAR Q3 versus 2.2% Q2; PCE headline/core 3.6% / 3.1% y/y for September; BLS compensation 0.8% q/q SA and 3.4% 12-month NSA. The distinct BEA GDP `/news/` and `/index.php/news/` URLs both displayed the same dated official release when inspected; **this does not assert redirect or canonical HTTP equivalence**.

**The original Weekly JSON's three null `sourceReleaseAt` fields remain unchanged**, because the project has not yet adopted a future independent publishing standard that accepts issuer-declared issue time plus a later claim-specific editorial receipt. The actual website posting fields remain null for all four events; a press release header cannot establish a precise first HTTP posting instant. Review-only access to official public-release pages did occur for this fact check, but **no programmatic market-data feed import, API ingestion, licensed vendor observation or asset-price retrieval was added to the Draft code**. All independent reuse and publication gates remain disabled.

## Proposed single future contract — not activated

The [single-contract draft architecture](canonical-release-architecture-and-approval-gates.draft.md) and [fail-closed candidate design JSON](canonical-future-contract-proposal.draft.json) now consolidate a future plan around the existing **source-pinned #1019 `independent_macro_education` family**, with #1020 used for supplementary all-deny source-rights evidence only. The candidate is **not a selected Production schema**, does not import or merge PR #1020 code, and leaves public paths **null**, with thirteen future rights/chronology/Preview/merge/release evidence gates explicitly **false**. It neither authorizes a website route nor makes any preview or market-data access request.

The plan distinguishes scheduled release time, agency-issued release time, independently verified first live website posting, original Daily generation and later exact-version editorial review. **Actual website posting is not a compulsory hypothetical future rule unless separately adopted**: a reviewer may instead recommend authoritative agency issue-time plus a verifiable later editorial receipt, but that choice is still pending. The current pilot's three null claim-level release times remain null, and the BLS's recorded 12:30 UTC official issue time is never mislabeled as a verified server posting instant.

Holiday/missing Daily treatment is also unresolved. The current five-Daily rule describes the already complete October 26–30 sample. A **future** explicitly approved partial-week policy could allow one to five genuinely published Dailies, documented missing days and a reviewed Friday publication; it would **not** invent new Dailies or permit the Monthly to silently skip a Friday. If a Friday is missing or all Dailies are absent, the future Monthly must fail closed until separately documented owner review. This is only a proposed design, not a changed publication eligibility rule.

## Stage B — actionable source-use and chronology decisions, no publication

The owner has already **PASSED Stage A editorial/layout** on the frozen private HTML blob. To prevent unnecessary re-review of unrelated copyrights or an expensive data license, the [five-item narrow-use review](stage-b-narrow-source-use-review.draft.json) and [two-decision Stage B signoff packet](stage-b-source-rights-and-release-decision.draft.md) now cover **only original English explanatory text, government-reported facts, exact issuer links and attribution on one eventual freely accessible webpage**. Original Score, vendor data, government expressive passages/tables/marks, automated feeds, translations, source rehosting, downloadable PDF and newsletter/RSS delivery stay out of scope.

Agency notices generally permit links and agency-authored content reuse with third-party and trademark exclusions. **No blanket foreign-law or source-specific public-production clearance is inferred.** Only four worksheet questions are material to this first intended medium: authorship/exceptions, commercial educational use, attribution/direct links and relevant Romania/EU/international publication. The five unused distribution/media rights dimensions are **OUT OF SCOPE, not approved**; all 45 historical flags remain false. The next owner/reviewer scope decision and official issuer-time + later exact-version editorial evidence policy are **unapproved**.

After those two scoped decisions are recorded, a separate new public-release candidate and its own exact-commit user authorization would still be necessary. **Do not merge, deploy, remove Vercel Authentication, index or change Production or original Score during the current Stage B research.** Independent Monthly eligibility remains 0/4.

## Required decisions before a separate release-stage PR

- Legal/provider/source reviewer: clarify reuse terms for each *exact* Federal Reserve, BEA, BLS or other official release, allowed fact quotation/derivatives, commercial display, attribution, machine-readable format, snapshots and archives. Official government hosting or a Daily citation does not automatically settle every series or downstream use; no unapproved source fetch.
- Owner: draft English working names, English editorial language, free/public educational direction, verified Daily sources and four-independent-Weekly Monthly **recorded as approved for draft-only preparation**. **Still pending separately:** final public-brand/legal wording, holiday/missing-Daily policy, unified public schema, permitted distribution implementation and publication/release authorization; never imply the legacy Score was replaced.
- Engineering: implement a new separately approved publication contract, source-rights receipts, independent content schema/route and validator, preview authorization, isolation and rollback plan. Never change original Score/Weekly/Monthly schema or reopen their rights gate as part of this path.
- Editorial/compliance: review final exact-version text, each dated assertion, release-versus-observation units, post-release receipts, attribution and no-investment-advice disclosure.
- Release: new owner Production authorization, exact-head CI, an explicitly approved non-Production Preview and separate go-live review. **This Draft PR must stay unmerged.**

To check the design locally in the repository (no network required), run from apps/web: node scripts/test-independent-editorial-draft.mjs && node scripts/independent-editorial-draft.mjs. These are also added to validate:reports. Passing tests means only the offline draft contract is coherent, never legally approved or publishable.
