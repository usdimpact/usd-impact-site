# USD Impact Score v2.1E — website methodology separation and rights handoff

**Date:** October 28, 2026  
**Status:** Draft, non-activating source/version gate; rights/research/Production HOLD.
**Website baseline:** `dbbe7e6dcf1632275b0e05c1db311e543d524d6c`.
**Pipeline reviewed baseline:** `d4d1e441f6dd91e1d249d9f3ad515c76e2d3f61b` (upstream provenance review #206; prior real-data-authorization boundary #204 remains HOLD).

## Exact current difference

**Production Score v2** remains the current eight-market-level model:
DXY, WTI, S&P 500, VIX, BTC, Gold, nominal Treasury 2Y and nominal Treasury 10Y; full-sample normalization and its existing publication/archive contract.

**Score v2.1E** is only a separately versioned federal/BLS *design candidate* with seven Federal Reserve series and one BLS PPI series (WPU0561). It changes source families, economic concepts, release schedules, missingness/revision handling and expanding **point-in-time** normalization. It is **not** a technical drop-in that can reuse the v2 numerical record, v2 backtest, replication claims, archive identity or marketing language.

## Updated upstream provenance boundary — pipeline PR #206

The upstream evidence-only review merged at `d4d1e441f6dd91e1d249d9f3ad515c76e2d3f61b`. Its reviewed source snapshot is [`score-v2-1e-upstream-provenance-review.json`](https://github.com/usdimpact/usd-impact-pipeline/blob/d4d1e441f6dd91e1d249d9f3ad515c76e2d3f61b/governance/score-v2-1e-upstream-provenance-review.json) (Git blob `2e95a744ac9bc43a260fb7ab09a82ee580dce361`).

| Upstream publication-path finding | Slots | Decision |
| --- | --- | --- |
| No specific source exception identified in the official publication path | USD broad index; BLS crude-petroleum PPI; H.8 bank credit; H.4.1 primary credit; H.4.1 total assets | **Not approved.** A negative exception search is not permission for commercial/public/paid distribution |
| Residual upstream provenance requires explicit scope confirmation | H.15 real 10Y yield; H.15 nominal 2Y; H.15 nominal 10Y | **Not approved.** Official H.15 text identifies OTC market quotations obtained by the FRBNY as upstream inputs to Treasury constant-maturity curves |

Therefore **5 of 8** slots lack a specific exception finding, but **3 of 8** have an identified remaining upstream-provenance question; **0 of 8** has a confirmed source-scope approval. This finding does not determine whether use is unlawful. It identifies precisely which source rights still require explicit confirmation.

The site CI fixture records the exact three residual roles, upstream commit and file blob, and denies any promotion flag. Its evidence is pinned and must be explicitly reviewed when the upstream source scope changes; it is **not** a live cross-repository rights watcher.

The upstream candidate is specified in:
- [Federal/BLS design](https://github.com/usdimpact/usd-impact-pipeline/blob/4810d6546d511debf49b6e0afba57c265837f71d/governance/score-v2-1e-federal-bls-design.json)
- [Frozen preregistration](https://github.com/usdimpact/usd-impact-pipeline/blob/4810d6546d511debf49b6e0afba57c265837f71d/governance/score-v2-1e-preregistration.json)
- [Hold-only execution contract](https://github.com/usdimpact/usd-impact-pipeline/blob/4810d6546d511debf49b6e0afba57c265837f71d/governance/score-v2-1e-real-data-execution-contract.json)
- [Issue #155 rights HOLD](https://github.com/usdimpact/usd-impact-pipeline/issues/155)
- [Issue #179 source replacement](https://github.com/usdimpact/usd-impact-pipeline/issues/179)

## Why site-side separation is necessary

The existing website methodology page promises current **Score v2**, complete with its DXY/WTI/SPX/VIX/BTC/Gold inputs and full-sample treatment. It links publicly to v2 component-derived archives pending redistribution rights review. The existing `score-public-v2-safe-1` schema is only a **candidate** aggregate-safe contract for Score v2.

A future federal-statistics candidate must not silently publish through that same schema or carry the old Score v2 label. This Draft tightens only the *unused publication prototype* by requiring exact `metadata.pipeline = usd_impact_score_v2`, rather than accepting arbitrary pipeline strings. Synthetic tests verify that a v2.1E-labelled payload is rejected even if it falsely claims the `score-public-v2-safe-1` outer schema. This is a defense-in-depth **identity check**, not cryptographic provenance: a mislabelled payload would still require independent trusted-origin enforcement.

The existing Score consumer tests now import a separate CI regression suite that:
1. freezes the eight proposed candidate identifiers and upstream design/preregistration commits;
2. requires all owner/research/publication rights flags to remain false;
3. checks the website methodology and score display remain v2;
4. verifies the protected Score member rewrite and separate historic sample;
5. verifies public Score v2 Class-C redistribution exposures are still documented HOLD, not mislabelled rights-clean; and
6. checks named runtime / Weekly generator files have not added candidate series, version identifiers or silent source swaps.

## Decision gates, in order

1. **Research-source and re-use scope (HOLD):** explicitly resolve the three H.15 upstream-market-quotation scope questions and document the source-specific reuse scope for *all eight* slots; only then consider an explicit reviewed owner authorization receipt for one-off *private* federal/BLS real-data research, only if legally/technically adequate. The packet currently has no active receipt; no real-data retrieval is allowed by this Draft.
2. **Versioned research evaluation (HOLD):** reconstruct release-time eligibility (BLS monthly revision window, H.8 benchmarks, H.10 lag, H.4.1/H.15 release cutoffs) and apply the frozen 104-prior-week normalization and acceptance gates. No retroactive tuning or live publication.
3. **Distribution rights (HOLD):** distinguish permissions to inspect federal releases, publish aggregate Score values, redistribute transformed component data, and distribute paid Research reports. The Series receipts are candidates, not rights approvals.
4. **Site copy and schema migration (NOT STARTED):** if v2.1E eventually passes independently, introduce a distinct versioned public contract, explicit methodology copy, new data-source labels and preserved archive identity. Do not reuse `score-public-v2-safe-1` with changed semantics.
5. **Protected delivery (NOT STARTED):** handle the member dashboard and Research archives through separately reviewed server authorization, private storage/origin, and exact-head negative tests. Library Pass and TradingView remain independent.
6. **Production (NOT AUTHORIZED):** explicit release decision, QA, cache/SEO and historical treatment, correct provider rights, and READY Production deployment verification.

## Intentional exclusions

No additional market/federal observations, no real-data analysis, no source switching, no public report content changes, no customer entitlement, no checkout/webhook replay, no provider contract, no Supabase resource, no site route, no Production deployment, and no rights-gate state change.

The upstream snapshot is pinned to a reviewed commit for traceability; the website test is **not** a live cross-repo freshness monitor. The test protects a selected high-risk set of website source paths, not every hypothetical new runtime path. A genuine future methodology promotion requires dedicated new negative tests and an explicit review of all consumers, including archived public pages.
