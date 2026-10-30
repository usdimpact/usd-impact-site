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

## Required decisions before a separate release-stage PR

- Legal/provider/source reviewer: clarify reuse terms for each *exact* Federal Reserve, BEA, BLS or other official release, allowed fact quotation/derivatives, commercial display, attribution, machine-readable format, snapshots and archives. Official government hosting or a Daily citation does not automatically settle every series or downstream use; no unapproved source fetch.
- Owner: draft English working names, English editorial language, free/public educational direction, verified Daily sources and four-independent-Weekly Monthly **recorded as approved for draft-only preparation**. **Still pending separately:** final public-brand/legal wording, holiday/missing-Daily policy, unified public schema, permitted distribution implementation and publication/release authorization; never imply the legacy Score was replaced.
- Engineering: implement a new separately approved publication contract, source-rights receipts, independent content schema/route and validator, preview authorization, isolation and rollback plan. Never change original Score/Weekly/Monthly schema or reopen their rights gate as part of this path.
- Editorial/compliance: review final exact-version text, each dated assertion, release-versus-observation units, post-release receipts, attribution and no-investment-advice disclosure.
- Release: new owner Production authorization, exact-head CI, an explicitly approved non-Production Preview and separate go-live review. **This Draft PR must stay unmerged.**

To check the design locally in the repository (no network required), run from apps/web: node scripts/test-independent-editorial-draft.mjs && node scripts/independent-editorial-draft.mjs. These are also added to validate:reports. Passing tests means only the offline draft contract is coherent, never legally approved or publishable.
