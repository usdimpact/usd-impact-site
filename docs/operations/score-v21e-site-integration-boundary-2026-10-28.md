# USD Impact Score v2.1E — website methodology separation and rights handoff

**Date:** October 28, 2026  
**Status:** Draft site methodology quarantine; historically owner-approved private research has now been CONSUMED / FAIL CLOSED after H.15 preflight (Issue #218). Site/public/paid rights and Production remain HOLD.
**Website baseline:** `dbbe7e6dcf1632275b0e05c1db311e543d524d6c`.
**Pipeline reviewed baseline:** `f2ac360fa01b4fbe87a2a94b0da4519d63210515` (one-off research consumption closeout; earlier H.15 scope review #208 and approval #210 remain historical).

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

## Narrow H.15 published-output scope clarification — pipeline PR #208

[Upstream PR #208](https://github.com/usdimpact/usd-impact-pipeline/pull/208) merged at `d99530589eade93de5827de9ba29bb341884d3e8` with an **evidence-only** supplement: [`score-v2-1e-h15-output-scope-review.json`](https://github.com/usdimpact/usd-impact-pipeline/blob/d99530589eade93de5827de9ba29bb341884d3e8/governance/score-v2-1e-h15-output-scope-review.json), Git blob `e6e0cb540b9765a02f5f8f8e842ede7ba6e52371`.

This **does not erase or reclassify** the earlier #206 provenance caveat. It adds a narrower potential-use boundary: v2.1E's `REAL_YIELD`, `UST_2Y` and `UST_10Y` slots would consume **only published government-derived Treasury/Federal Reserve constant-maturity outputs**, not underlying OTC quotations or reconstructed market quote streams. The reviewed *published output* path identified no specific third-party notice; that finding does not establish legal clearance.

| Item | Status |
| --- | --- |
| H.15 published official outputs identified | Yes — exactly 3 named series |
| Raw upstream OTC quote streams, reconstruction or paid endpoints in candidate scope | **No** |
| Identified specific third-party notice on the reviewed published output path | No — a limited evidence finding, **not** rights approval |
| Source approval and legal conclusion | **Not granted** |
| One-off private official Board/BLS research | **Historically authorized** under Issue #209 for 2013-01-01–2026-10-23; consumed after H.15 feasibility failure |
| Site-side fetch, public/paid publication, methodology replacement | **Not authorized** |
| Source/public component redistribution, rights hold and Production | **HOLD** |
| Active one-off private research receipt | **Absent on current pipeline main**; historical approval retained in [consumption record](https://github.com/usdimpact/usd-impact-pipeline/blob/f2ac360fa01b4fbe87a2a94b0da4519d63210515/governance/score-v2-1e-real-data-research-consumption-2026-10-28.json) |

The website's machine-checked fixture pins both historical evidence layers (#206 and #208). Their original negative flags describe **the authorization state of those evidence-only reviews at the time they merged**; they are not the current research authorization state. A separate owner receipt under #210 permitted the limited study at that time, but the receipt has since been consumed and removed from the active path. Neither government publication status nor the expired one-off permission authorizes site-side fetching, further private research, public reports, paid Research distribution, or Production.

The next substantive decision belongs to the source owner/provider/counsel and the existing one-off private research authorization process; no one may infer a signed receipt from this CI fixture.

## Historical one-off private research approval — upstream PR #210

**The authorization state changed after the source-scope review.** The owner historically approved a single private study under [Issue #209](https://github.com/usdimpact/usd-impact-pipeline/issues/209), comment `6477834394`. The [original approved receipt at its historical commit](https://github.com/usdimpact/usd-impact-pipeline/blob/bb9e4c4d2ef7d28938d670746b4a57f3fb1af587/governance/score-v2-1e-real-data-research-authorization.json) merged in pipeline PR #210 at `bb9e4c4d2ef7d28938d670746b4a57f3fb1af587` (Git blob `40283d6c846c994b71e3d1a8007f1844215a655e`).

| Allowed by that specific receipt | Still forbidden |
| --- | --- |
| One-off private research/fetch of the **eight fixed** Board/BLS series | Any alternate or ninth series; Yahoo, CME, Cboe, paid source, API key or contract acceptance |
| 2013-01-01 to 2026-10-23 only | Extending the window or changing the preregistered method |
| Isolated temporary workspace; source values and raw HTTP payloads ephemeral only | Durable raw/component storage, publication of source/component values |
| Aggregate diagnostics, feasibility gate outcomes and provenance identifiers (no values) | Research-ledger mutation, public Score replacement, member-only report launch, Production |

The separate pipeline workflow performed the historical-vintage feasibility preflight and stopped on the missing H.15 archive; [Issue #218](https://github.com/usdimpact/usd-impact-pipeline/issues/218) governs that outcome. This website Draft owns no data retrieval or retry. **Do not start a duplicate run or lift a preflight HOLD based on the existence of the receipt alone.**

This Draft's `oneOffPrivateResearchAuthorization` inventory is a pinned **historical** metadata-only copy of the former approval. The separate `oneOffResearchConsumption` record reports the current, blocked execution status. The website has no authority to fetch data, activate v2.1E, publish a new Score, or grant paid Research access. Rights issue #155 remains open.

## Authorized study stopped at historical-vintage feasibility — Issue #218

The preflight performed under the valid owner receipt did **not** authorize bypassing preregistered data-vintage rules. [Issue #218](https://github.com/usdimpact/usd-impact-pipeline/issues/218) records a **BLOCKED / FAIL CLOSED** disposition after [run 40755916179](https://github.com/usdimpact/usd-impact-pipeline/actions/runs/40755916179):

- Fixed historical samples for H.10, H.8, and H.4.1 were reached.
- An official H.15 release was scheduled for **January 6, 2020**, but its expected dated Board archive `/releases/h15/20200106/default.htm` returned HTTP **404**.
- Current revised DDP/other recent Treasury histories cannot substitute for the historical *release-time* record; the Board's historical corrections make such a substitution methodologically unsafe.
- The source allowlist, eight series, and preregistered point-in-time method remain fixed. No ALFRED/FRED/Treasury/Wayback source, ninth proxy, dropping/reweighting H.15, or alternate method is permitted under this receipt.

**The historical owner approval remains valid as an audit fact but the full v2.1E study is STOPPED.** Pipeline governance has already consumed the one-off receipt and removed its executable path. This website Draft records, but does not control, that outcome. No candidate Score was computed or released by the blocked preflight.

A separately versioned v2.1F successor is now preregistered (see below), but its live historical-vintage feasibility remains untested and unauthorised. Further real-data retrieval requires separate reviewed owner permission; the v2.1E approval cannot be reused. Issue #155 remains the controlling publication/redistribution HOLD.

## Verified upstream consumption — active execution disabled

Pipeline `main` at `f2ac360fa01b4fbe87a2a94b0da4519d63210515` contains the [consumption record](https://github.com/usdimpact/usd-impact-pipeline/blob/f2ac360fa01b4fbe87a2a94b0da4519d63210515/governance/score-v2-1e-real-data-research-consumption-2026-10-28.json) (Git blob `05c2dcb2e88bddd7f2fc0e297da7afa6c1a5e6a5`) and a [consumed execution contract](https://github.com/usdimpact/usd-impact-pipeline/blob/f2ac360fa01b4fbe87a2a94b0da4519d63210515/governance/score-v2-1e-real-data-execution-contract.json) (Git blob `b728d9efb75c569c06afb5ba6a95a12dfe5a81a8`).

The active receipt file is **absent**. All current real-data fetch/research and release authorizations are **false**. The original Issue #209 approval remains traceable through comment `6477834394`; it is no longer executable. The v2.1E validator checks the consumed record and requires the original executable path to be absent.

This website Draft's new test pins that state independently from the earlier approval metadata. It remains **evidence-only**: no cross-repository network fetch, new market observations, Score computation, or automatic synchronization occurs in site CI.

## Newly preregistered successor — Score v2.1F (design only)

**Upstream pipeline `main` at `bcf473e2bbcb36fa1080a3a56f77a3796d74ccaa` now includes a new, distinct five-factor design and frozen research protocol.** This is not an amendment to the consumed eight-factor v2.1E authorization and is not equivalent to the website's live Score v2.

Evidence: [design #222](https://github.com/usdimpact/usd-impact-pipeline/blob/bcf473e2bbcb36fa1080a3a56f77a3796d74ccaa/governance/score-v2-1f-five-slot-design.json) (Git blob `66f063bbb91324f8c623cab5a681d8407a0fdcda`) and [preregistration #223](https://github.com/usdimpact/usd-impact-pipeline/blob/bcf473e2bbcb36fa1080a3a56f77a3796d74ccaa/governance/score-v2-1f-preregistration.json) (Git blob `74ef6e0834513e2c17b196a59cf05a417678bd3d`). Controlling [Issue #221](https://github.com/usdimpact/usd-impact-pipeline/issues/221); redistribution [Issue #155](https://github.com/usdimpact/usd-impact-pipeline/issues/155) remains HOLD.

| Frozen five-factor slot | Official proposed series | Weight |
| --- | --- | ---: |
| USD | H.10 broad index `H10/H10/JRXWTFB_N.B` | +0.20 |
| Energy | BLS crude petroleum PPI `WPU0561` | −0.20 |
| Financial conditions | H.8 bank credit `H8/H8/B1001NCBA` | +0.20 |
| Financial stress | H.4.1 primary credit `H41/H41/RESPPALDP_N.WW` | +0.20 |
| Liquidity | H.4.1 total assets `H41/H41/RESPPA_N.WW` | −0.20 |

The three failed H.15 slots are removed **only in this separately preregistered successor**; they have not been silently changed in v2.1E. The new protocol freezes Friday 23:59:59 America/New_York, exact official release vintage, 104 preceding complete weeks and expanding point-in-time normalization. It permits neither revised-history substitution nor retroactive tuning.

Two distinct future approvals are required: **(1)** a strictly limited official-source live vintage-feasibility preflight without Score computation, and **(2)** only after all five source-vintage paths pass, a second owner-approved full private candidate study. Neither approval exists. Zero data values have been retrieved by this website Draft, and no rights, public artifact, paid-member delivery or Production promotion is authorized.

The revised site regression test pins the successor's separate identity, five weights/series, absence of H.15 and all denial flags. It also rejects v2.1F identity under the unused Score v2 public-safe prototype; the live Score v2 pages and Research member route remain unchanged.

## Why site-side separation is necessary

The existing website methodology page promises current **Score v2**, complete with its DXY/WTI/SPX/VIX/BTC/Gold inputs and full-sample treatment. It links publicly to v2 component-derived archives pending redistribution rights review. The existing `score-public-v2-safe-1` schema is only a **candidate** aggregate-safe contract for Score v2.

A future federal-statistics candidate must not silently publish through that same schema or carry the old Score v2 label. This Draft tightens only the *unused publication prototype* by requiring exact `metadata.pipeline = usd_impact_score_v2`, rather than accepting arbitrary pipeline strings. Synthetic tests verify that a v2.1E-labelled payload is rejected even if it falsely claims the `score-public-v2-safe-1` outer schema. This is a defense-in-depth **identity check**, not cryptographic provenance: a mislabelled payload would still require independent trusted-origin enforcement.

The existing Score consumer tests now import a separate CI regression suite that:
1. freezes the eight proposed candidate identifiers and upstream design/preregistration commits;
2. verifies both the historical one-off owner approval and its later consumption, requiring all current research, public/paid distribution and Production flags to be false;
3. checks the website methodology and score display remain v2;
4. verifies the protected Score member rewrite and separate historic sample;
5. verifies public Score v2 Class-C redistribution exposures are still documented HOLD, not mislabelled rights-clean; and
6. checks named runtime / Weekly generator files have not added candidate series, version identifiers or silent source swaps.

## Decision gates, in order

1. **Private research authorization consumed; site HOLD:** PR #208 restricts H.15 to published government-derived output; PR #210 approved one-off private research, but pipeline main has now removed its executable receipt after Issue #218. Any future study needs a new preregistration and explicit owner decision. This website Draft forbids fetching, activation and publication. Rights issue #155 remains open.
2. **Versioned research evaluation (STOPPED — H.15 vintage FAIL CLOSED):** do not run the full Score; any future independently versioned/repreregistered candidate must reconstruct release-time eligibility (BLS monthly revision window, H.8 benchmarks, H.10 lag, H.4.1/H.15 release cutoffs) and apply the frozen 104-prior-week normalization and acceptance gates. No retroactive tuning or live publication.
3. **Distribution rights (HOLD):** distinguish permissions to inspect federal releases, publish aggregate Score values, redistribute transformed component data, and distribute paid Research reports. The Series receipts are candidates, not rights approvals.
4. **Site copy and schema migration (NOT STARTED):** if a newly versioned successor such as v2.1F eventually passes its independently authorized feasibility and research gates, introduce a distinct versioned public contract, explicit methodology copy, new data-source labels and preserved archive identity. Do not reuse `score-public-v2-safe-1` with changed semantics.
5. **Protected delivery (NOT STARTED):** handle the member dashboard and Research archives through separately reviewed server authorization, private storage/origin, and exact-head negative tests. Library Pass and TradingView remain independent.
6. **Production (NOT AUTHORIZED):** explicit release decision, QA, cache/SEO and historical treatment, correct provider rights, and READY Production deployment verification.

## Intentional exclusions

This website Draft performs no market/federal observation retrieval or real-data analysis, no source switching, no public report content changes, no customer entitlement, no checkout/webhook replay, no provider contract, no Supabase resource, no site route, no Production deployment, and no rights-gate state change.

Both upstream snapshots (v2.1E consumption and v2.1F preregistration) are pinned to reviewed commits for traceability; the website test is **not** a live cross-repo freshness monitor. The test protects a selected high-risk set of website source paths, not every hypothetical new runtime path. A genuine future methodology promotion requires dedicated new negative tests and an explicit review of all consumers, including archived public pages.
