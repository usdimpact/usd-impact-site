# Three Dials publication review — October 2 and October 9, 2026

Date: October 17, 2026

Status: Prepared for protected review; this record does not authorize publication

Publication candidate: [PR #821](https://github.com/usdimpact/usd-impact-site/pull/821)

## Why this update is needed

The current Production source, `70f5b615b41e204cdb356370f3358b6ba3c86e99`, still contains the September 25 Three Dials snapshot. The October 2 candidate (#788) and both October 9 candidates (#815 and #821) remain unpublished. Their original normal pull-request quality and dependency checks require action; earlier successful manual preflights are not equivalent to passing normal PR checks.

This successor keeps #821 as the review location, incorporates current main, adds the missing October 2 archive, and advances both latest copies to the later captured October 9 snapshot. It also fixes the two reader-facing Score JSON links so a dated snapshot opens the matching archived Score bridge.

## Preserved source captures

| Completed week | Original candidate and generated head | Natural generator run | Original retrieval timestamp | Preserved Git blob |
| --- | --- | --- | --- | --- |
| October 2 | [#788](https://github.com/usdimpact/usd-impact-site/pull/788), `4be3b705a15b9504ffdbef41395a49c0a70d606e` | [37558873006](https://github.com/usdimpact/usd-impact-site/actions/runs/37558873006), scheduled, successful | `2026-10-07T01:48:10.149Z` | `1ad842f0b4392337e0ec4fa55d8d72cf5a58031f` |
| October 9 | [#821](https://github.com/usdimpact/usd-impact-site/pull/821), `588cd2b8b7772ea1ab5558eadd5b361427e85e7b` | [38495385503](https://github.com/usdimpact/usd-impact-site/actions/runs/38495385503), scheduled, successful | `2026-10-14T01:22:54.001Z` | `d0b0b9c5803e2c69794f3a24c8538b7ca09ad3a0` |

The four generated JSON destinations are:

1. `apps/web/public/data/three-dials/archive/2026-10-02.json`: original October 2 blob only.
2. `apps/web/public/data/three-dials/archive/2026-10-09.json`: original October 9 blob.
3. `apps/web/public/data/three-dials/latest.json`: byte-identical October 9 blob.
4. `apps/web/src/data/three-dials-latest.json`: byte-identical October 9 blob.

All existing dated archives remain unchanged. No new provider request, Three Dials generation, model execution, Score regeneration, or rewritten observation is part of this update. These are the original captured observations, not newly retrieved October 17 market data.

## October 9 candidate selection

PR #815 and PR #821 cover the same completed week but contain different captures. The later #821 capture includes the October 9 broad-dollar observation; #815's latest broad-dollar observation remained October 2. In #821, real and nominal yields, high-yield OAS, and funding-context observations also advance from October 8 to October 9.

The later capture therefore supplies more complete same-week evidence. Its broad-dollar change is +0.18%, with confirmed dollar breadth; its real-rate reading remains flat and liquidity stress remains contained. Its descriptive label remains **Mixed / transitional environment**. The original threshold definitions, source classes, source notes, observation dates, and Fact / Interpretation / Model output separation are preserved.

The October 2 archive retains its original **Rate-led firm-dollar environment** interpretation. It is historical archive data and does not replace the October 9 latest copies.

## Exact-week Score evidence and link correction

The snapshots retain these same-week Score v2 readings:

| Snapshot week | Exact preserved Score | Regime | Dated canonical bridge |
| --- | --- | --- | --- |
| October 2 | `-0.5029776266134216` | Soft dollar regime | [October 2 weekly input](https://score.usd-impact.com/archive/2026-10-02/weekly_input.json) |
| October 9 | `-0.509254132042471` | Soft dollar regime | [October 9 weekly input](https://score.usd-impact.com/archive/2026-10-09/weekly_input.json) |

The archived bridges were compared with pipeline main `1bdd9a47796876e794bb6a24248ced8823f8b719` at [October 2](https://github.com/usdimpact/usd-impact-pipeline/blob/1bdd9a47796876e794bb6a24248ced8823f8b719/public/archive/2026-10-02/weekly_input.json) and [October 9](https://github.com/usdimpact/usd-impact-pipeline/blob/1bdd9a47796876e794bb6a24248ced8823f8b719/public/archive/2026-10-09/weekly_input.json). Each snapshot's week, exact score and regime match its archived bridge. Direct requests to both canonical dated URLs returned HTTP 200 with matching JSON at October 17, 12:18:53 UTC.

The immutable snapshot payloads preserve their original `model_output.source_url`, which identifies the moving endpoint used when captured. That endpoint now serves a newer week. Previously, both the Three Dials component and Weekly Regime Lab used it directly as a reader-facing Score link, including one labeled “Open exact-week Score JSON.”

The rendering correction derives `/archive/<model_output.week_ending>/weekly_input.json` through the existing approved Score-origin contract. It leaves the captured JSON, methodology, model values, and observation data untouched. Date validation rejects malformed or impossible dates while preserving valid legacy archive dates. Both current and supported legacy Score origins retain the same dated path behavior.

## Publication cadence

This catch-up publishes evidence through October 9; it does not claim an October 16 Three Dials snapshot exists. On October 17, the existing practice cadence permits October 9 as `publication-pending` while the October 16 snapshot is within its normal Monday/Tuesday publication window. That allowance ends at October 21, 00:00 UTC under the unchanged cadence policy.

The Weekly Score and Weekly/Monthly reports already published for October 16 are separate products. Their publication does not backfill the Three Dials observations.

## Preparation checks completed October 17

Before editing the candidate, the isolated local base tree was verified identical to current main tree `4d7b9f79740cf5d094920abbebac640bf669c7f2`. The four generated destinations then hashed to the original blobs recorded above.

An offline review using the unchanged current `assessThreeDials` implementation passed for all fourteen facts across the two captures: numeric changes, observation cutoffs, recorded age-day counts, historical per-series freshness bounds, threshold identity, component classifications, evidence confirmations, and complete interpretation objects. These freshness checks are relative to each captured completed week; they do not claim current October 17 market observations.

The retained funding-spread facts contain the two derived SOFR-minus-IORB values; the individual constituent observations and raw provider-response hashes are not present in these snapshot files. Review of those facts verifies the stored two-point change and interpretation, not a new independent reconstruction of provider history.

The focused Score-origin/archive-link regression and existing transparency-page contract also passed during preparation.

The unchanged practice classifier returned `stale` for October 2 and `publication-pending` with usable comparison evidence for October 9 at the October 17 observation time. Only October 9 becomes latest; October 2 remains an archive.

## Successor validation and release gates

The candidate must retain the four recorded JSON blobs and pass the normal pull-request checks on its actual successor head:

- Full `validate-and-build`.
- Normal `Dependency review`.
- Normal CodeQL security analysis.
- An exact-head READY Vercel Preview, including the rendered October 9 evidence and dated Score JSON destinations.
- Protected owner approval of the exact successor head before merge.

Current quality and dependency workflows already cover every PR to main; they do not need a document to escape a generated-data exclusion. The operations document and rendering fix also place this change outside CodeQL's generated-JSON-only exclusion. The existing publication routing policy selects full validation. No workflow, required check, branch protection, source-rights rule, or schedule is changed.

The latest-copy transparency contract does not independently prove the older October 2 archive. Its original Git blob identity, source dates, derived changes, and matching dated Score bridge are reviewed separately. Successor CI and Preview receipts belong in PR #821 so this evidence file does not need a self-referential commit hash.

Until these gates are complete, Production remains on its existing release. The older publication candidates are historical input records, not alternative latest snapshots to merge after this successor.
