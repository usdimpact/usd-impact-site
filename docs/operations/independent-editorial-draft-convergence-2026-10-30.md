# Independent educational reports — Draft PR convergence and nonrelease handoff (2026-10-30)

> **REVIEW ONLY / TWO COMPLEMENTARY DRAFTS / NO MERGE, RELEASE, PROVIDER FETCH OR DEPLOY.** This record describes exact GitHub source-code and already approved Daily/editorial metadata, not a claim that any official release can be commercially republished. A $0 additional market-data-license budget is a planning constraint, not a source-rights permission or cost guarantee.

## One editorial goal, two different draft contracts

| | [Site Draft PR #1019](https://github.com/usdimpact/usd-impact-site/pull/1019) | [Site Draft PR #1020](https://github.com/usdimpact/usd-impact-site/pull/1020) |
| --- | --- | --- |
| Purpose | **Evidence-pinned editorial pilot:** Oct 26–30 Weekly prose, five exact published Daily Git blob hashes, claim/source-ID/URL checks, future empty Monthly template | **Rights/governance and structural contract:** seven-item all-deny issuer ledger, separate Weekly/Monthly structural and chronology validator, synthetic-only regressions |
| Reviewed head at handoff | `23ad2960a139ac8dda38e1aec8a60e06137bbbf4` | `1846ad59ec14cad1e1234490f73de770a0b007a4` (intermediate head of this Draft prior to handoff additions; **refresh exact head** on later review) |
| Contract version | `independent-editorial-draft-v1` | `independent-weekly-editorial-v0-draft` / `independent-monthly-editorial-v0-draft` |
| Series value | `independent_macro_education` | `independent-editorial` |
| Data boundary | Offline script reads five **existing published** local Daily markdown files; no external provider requests | Pure caller-supplied invented records; no `fs`, HTTP, real-world data, persistence or Score import in validator |
| Weekly test rule | Draft-only `status=draft`, five complete weekday Dailies, exact local Git blob SHA and source-highlight IDs/URLs | Separate structural `status=draft|published` for hypothetical future tests; one to five Dailies, source/review time checks, legacy Score rejection; **always `releaseAuthorized:false`** |
| Monthly rule | Empty current template, independent four-week test with hypothetical receipts; `publishReady:false` | Explicit complete Weekly inventory + prior published Monthly history, first four after latest Monthly in consecutive Fridays; **always `releaseAuthorized:false`** |
| Rights gates | Rights marked `pending_independent_source_review`, no release | 7 sources × 7 denied dimensions = **49 false**; 10 additional publication gates **false** |
| CI-only change | Appends its draft tests to `apps/web/package.json` `validate:reports` | Appends separate invented-only regressions to **the same script** |

**Critical integration decision:** These are **not two interchangeable representations of a future published report**. The different `series` values, contracts, source counts and hypothetical `published` treatment must not be silently bridged by a converter or product reader. Do not merge either into Production or close a legacy Score rights hold. The common `apps/web/package.json` edit also requires deliberate exact-main integration if a future owner approves a single consolidated release-stage design. Both remain Draft/unmerged now.

## Claim-to-rights candidate map (editorial mapping only)

This mapping identifies the corresponding **candidate issuer category** for the six already written Draft #1019 claims, not permission or completed review.

| #1019 claim ID | #1020 rights-ledger candidate | Original official source URL compatibility | Approval |
| --- | --- | --- | --- |
| `fomc-preview-oct26` | `fed_fomc_calendar` | **Different exact URLs:** #1019 pins `https://www.federalreserve.gov/newsevents/2026-october.htm`; #1020 inventory lists `https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm`. Reconcile **the actual claimed source URL**, not just the issuing domain. | PENDING |
| `fomc-reminder-oct27` | `fed_fomc_calendar` | Same distinct calendar-URL issue as above. | PENDING |
| `fomc-outcome-oct28` | `fed_fomc_statement` | Both point to the Federal Reserve's dated October 28 FOMC statement. | PENDING |
| `gdp-oct29` | `bea_q3_advance_gdp` | Both point to the BEA Q3 advance release dated October 29. | PENDING |
| `pce-oct29` | `bea_september_pce` | Both point to the distinct BEA September Personal Income and Outlays release. | PENDING |
| `eci-oct30` | `bls_q3_eci` | Both point to the BLS October 30 dated ECI. #1019 carries the documented post-12:30 UTC October 30 editorial receipt in [PR #1009](https://github.com/usdimpact/usd-impact-site/pull/1009#issuecomment-6525502611). | PENDING |

The separately listed BLS October calendar is context only; the EIA entry is **out of scope** for this six-claim Weekly. Neither becomes an authorized live data feed from this mapping. The #1019 official sources are pinned against already-published Daily content; the #1020 policy pages provide general issuer reuse context only.

## What the public agency reuse policies say — not a project grant

The following issuer **policy pages** were independently checked without fetching market-data observation feeds:

- [Federal Reserve Board disclaimer](https://www.federalreserve.gov/disclaimer.htm): general Board-authored website material is public domain unless otherwise indicated; Board citation; direct hyperlinks permitted; protected third-party items and seals require separate treatment.
- [BEA copyright FAQ](https://www.bea.gov/help/faq/147): BEA website information generally public domain unless otherwise stated; BEA citation appreciated.
- [BLS linking/copyright notice](https://www.bls.gov/bls/linksite.htm): agency publications public domain with BLS citation requested, except previously copyrighted photographs/illustrations; emblem restricted.
- [EIA copyrights and reuse](https://www.eia.gov/about/copyrights_reuse.php): public use of EIA-origin products is broadly described with publication-date attribution, but licensed third-party items, logos, photography and translation attribution require review. **EIA not used in the pilot.**
- [USAGov federal materials guidance](https://www.usa.gov/government-copyright): federal website presence does not establish all content is a government work, and U.S./international rights, third-party, trademark, privacy and endorsement issues remain possible.

No completed per-release legal assessment, automated transport/archival authorization, translated publication permission or final product/editorial receipt was added. Keep every rights and publishing flag FALSE.

## Why the first-four constraint matters

The legacy Score-based Monthly uses the first four published Weeklies after its previous period and an additional consecutive-Friday validator. The new independent family has **its own** timeline and zero published inputs. Its draft validator must not accept any four recent, consecutive-looking independent Weeklies if an earlier published independent Friday was silently omitted.

#1020 has added a **caller-attested complete Weekly inventory requirement**, first-four-source identity check, explicit prior independent Monthly history and duplicate-source rejection. This improves structural checks; it cannot independently prove the caller really supplied a complete published source inventory, authenticate a rights receipt or authorize release. A future release integration needs trusted repository/publication receipts and a separately approved release gate.

## Future integration plan — distinct owner decision, not authorized now

1. **Choose one canonical versioned content schema** and series ID: do not silently union the two versions, copy published history, or present either as a Score successor. Preserve Draft #1019 evidence-pinned source receipts and exact Daily versions if that design is selected.
2. Decide whether the separate product requires **five complete weekday Dailies** (strict pilot model) or allows **one to five source Dailies** (flexible structural model), and what happens on missing/nonpublication holidays. Do not invent Dailies solely to meet a five-day quota.
3. Complete exact-source/third-party rights and commercial-use review for every source; ensure actual #1019 October calendar URL is covered. Retention, translation, downstream JSON/HTML/email, citation and legal-signoff decisions must be explicit. The current matrix remains entirely denied.
4. Decide separate editorial naming, scope, free versus paid visibility, language and risk/compliance disclosure. A report with only official releases **does not establish actual DXY/WTI/Gold/BTC or asset-index moves**.
5. If later authorized, build **one** testable rights-bound publishing contract from the chosen source-pin and chronology validators; require verified full source inventory, immutable live publication receipts and external provenance, not user-supplied strings.
6. Only with separate explicit owner authority, prepare an isolated Preview / noindex QA and eventual Production release plan. Do not change original Score/Weekly/Monthly routes, jobs, archive retention, membership, commerce, independent Macro Panel or Daily pipeline as a side effect.

## Handoff status

- **Original Score and original Score-derived Weekly/Monthly:** HOLD, no new Score/Monthly/Weekly publication.
- **Independent educational reporting:** two parallel **Draft** research streams; no independent published Weeklies, no eligible independent Monthly and no authorized public route.
- **No automatic integration, merge, paid source, provider observation request, historical deletion, feature flag, DNS, deployment or release performed** by this review.
- **Next safe review:** exact rights decision on this six-claim Oct 30 specimen, reconciliation of official calendar URL, independent product contract decision, then any future separately approved Release engineering. Do not conflate green offline tests with permission to publish.
