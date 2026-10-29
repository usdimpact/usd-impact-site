# Spanish DXY vs Broad USD — primary-reference, provenance and rights review

**Review date:** 2026-10-29. **Status:** DEVELOPMENT RESEARCH ONLY / RELEASE HOLD. **Owner approval already on record:** Spanish title, SEO title, description, hero, and the existing English quiz CTA links for editorial use. This report does **not** grant legal rights, independent compliance approval, public publication, merge, indexing, or entitlement changes.

## Exact reviewed source versions

- Published English teaching source: `usdimpact/usd-impact-site`, file `apps/web/src/content/pages/dxy-vs-broad-usd.md`, Git blob `3c4a3820b9cc0ddc094aa1862f738e231dc0f398` at protected Production `main` `06e185d39b4768e1f2ab8aeabccd63b531bf1435`. Original initial creation: commit `293fdf33888f7f9d1b3a4578e690717bd67e3bfb` on 2026-07-27 through [PR #33](https://github.com/usdimpact/usd-impact-site/pull/33).
- English article's source basis per PR #33: the pre-existing first-party USD Impact Quiz 5 learning contract and publicly available Federal Reserve/ICE index definitions; PR description **does not** claim quotation from the protected book manuscript.
- Offline Spanish translation source: [enterprise-evaluation Draft PR #3](https://github.com/USD-Impact/enterprise-evaluation/pull/3) with `real-content-shadow/full-page.es-LATAM.private-draft.md` blob `46cadc998e31c6f332ce34c3cbec1f8dc758f825`, `full-page-manifest.json` declaring `origin: assistant_offline`, and the limited owner acceptance tied to that exact blob. The 12-excerpt and full-page private QA GitHub Action used **no external translation provider** or production write.
- Website Spanish candidate: `apps/web/src/content/pages/es/dxy-vs-broad-usd.md`, blob `541b15670eb19f4664352e5dc03cee8460d15c48` at Draft [PR #932](https://github.com/usdimpact/usd-impact-site/pull/932), head before this evidence-only addendum `75f5d331dc145cabbeed0bbb6cd5b00e5fe2ff4c`. The accepted Spanish body is protected by source/body hash checks; title/SEO/hero and English CTA have separate owner editorial approval. Internal Quiz 5 has been removed from external `sources:`, but not the internal links/CTA.

## Institutional source-to-claim verification

| English/Spanish educational claim | Primary source inspected | Result | Scope / required caution |
| --- | --- | --- | --- |
| DXY represents a narrow, euro-concentrated, **six-currency** exchange-rate basket | [ICE USDX composition](https://www.ice.com/forex/usdx); [ICE USDX futures specification](https://www.ice.com/products/194/US-Dollar-Index-Futures/) | **Supported** | ICE specifies six currencies and the fixed basket, with a 1999 currency replacement on euro launch. The lesson's English/Spanish 7-row table gives no proprietary component-weight table or replica of an ICE graphic. |
| DXY has a liquid, market-visible futures/options use case | [ICE USDX overview](https://www.ice.com/forex/usdx) | **Supported** | ICE lists USDX futures and options. Do not imply the Federal Reserve's statistical broad index is the *same futures contract* or that every third-party index product is uninvestable. |
| The Fed Broad Dollar Index uses more trading-partner currencies and trade-based weighting | [Federal Reserve methodology note, 2019](https://www.federalreserve.gov/econres/notes/feds-notes/revisions-to-the-federal-reserve-dollar-indexes-20190115.html); [2026 trade weights](https://www.federalreserve.gov/releases/H10/Weights/) | **Supported** | The methodology covers U.S. bilateral goods and services trade (subject to noted exclusions) and differentiated AFE/EME index families; 2026 weights are dated 2026-02-02. Do not conflate the index with a simple count of every world currency. |
| The broad dollar index is distinct from DXY and may diverge even when one is flat | [Federal Reserve methodology](https://www.federalreserve.gov/econres/notes/feds-notes/revisions-to-the-federal-reserve-dollar-indexes-20190115.html); [ICE composition](https://www.ice.com/forex/usdx) | **Analytically consistent; examples hypothetical** | Different baskets/weights allow divergence. A directional example is a *scenario*, not independently observed historical evidence; confirm bilateral-rate behavior before describing a real market regime. |
| Annual reassessment of trade-based weights; broad, AFE and EME sub-indexes | [Federal Reserve weights](https://www.federalreserve.gov/releases/H10/Weights/); [Federal Reserve index summary](https://www.federalreserve.gov/releases/h10/summary/) | **Supported** | The Fed may revise weights outside the annual cycle in unusual circumstances. Treat historical series and composition as subject to methodology revisions. |
| Nominal versus real Broad Dollar Index are different measures | [Federal Reserve nominal/real index page](https://www.federalreserve.gov/releases/h10/summary/) | **Supported** | As published by the Fed, nominal indexes are daily; **real Broad/AFE/EME indexes are monthly and price-adjusted using CPIs**. The lesson explains the conceptual distinction but should never present a real index as a live daily ticker. |
| Numerical block: DXY 100→102 or Broad USD 100→103 | [Original USD Impact English teaching lesson](https://github.com/usdimpact/usd-impact-site/blob/06e185d39b4768e1f2ab8aeabccd63b531bf1435/apps/web/src/content/pages/dxy-vs-broad-usd.md) and [Spanish evaluation source](https://github.com/USD-Impact/enterprise-evaluation/blob/7931b2a8b109cf644cebdb3b540a20ee3c90ce3e/real-content-shadow/full-page.es-LATAM.private-draft.md) | **Source-inherited, explicitly illustrative** | The levels are assumed classroom examples, **not historical ICE/Fed observations**. The indexes have different base dates/scales; never compare absolute index-point levels as if 100 in DXY equals 100 in Broad USD. Do not add a real-time data claim. |
| Agreement of indexes strengthens evidence of broad strength, but does not prove cause or a particular asset trade | [Source lesson](https://github.com/usdimpact/usd-impact-site/blob/06e185d39b4768e1f2ab8aeabccd63b531bf1435/apps/web/src/content/pages/dxy-vs-broad-usd.md) | **Educational heuristic, not independently statistically validated here** | Maintain conditional language and the explicit no-investment-advice notice; source definitions alone do not establish predictive accuracy or causal claims. |

### Source URLs used for this review

1. Official Federal Reserve [weekly H.10 current release](https://www.federalreserve.gov/releases/h10/current/) displayed **release date 2026-10-26**; the page includes broad index values under the memo section. This is source verification, **not permission to republish Fed data**.
2. Official Federal Reserve [nominal/real index summary](https://www.federalreserve.gov/releases/h10/summary/) and [2026 currency weights](https://www.federalreserve.gov/releases/H10/Weights/).
3. Official Federal Reserve [2019 index-revisions methodology](https://www.federalreserve.gov/econres/notes/feds-notes/revisions-to-the-federal-reserve-dollar-indexes-20190115.html).
4. Official ICE [USDX overview](https://www.ice.com/forex/usdx) and [futures specification with property notice](https://www.ice.com/products/194/US-Dollar-Index-Futures/). Do not use the previously proposed `ICE_FX_Indexes_Methodology.pdf` path as a verified current source; its availability was not established on the earlier read.

## Originality and licensing scope — mechanical evidence vs legal determination

**Observed in exact English and Spanish Markdown sources:**

- Both source files carry the *same independently authored site-level comparison schema* (one header + seven explanatory rows), with Spanish text corresponding to English rows; no embedded third-party image, chart, data series, executable component, `<img>`, `<iframe>` or vendor table was found in the inspected Markdown.
- The four conditional market scenarios, 100/102/103 numeric teaching example, 8/10 Quiz 5 threshold, and educational disclaimer were inherited from the existing English first-party article. The Spanish translation workflow is traceable to the source file and hashes, rather than a paste from ICE/Federal Reserve content.
- The published **English** frontmatter still lists `USD Impact Quiz 5` as a `sources:` item; the Spanish Development candidate already classifies it as a separate internal resource. Consider a separate, reviewed English correction; do **not** silently edit the published English page under this Spanish approval.
- These observations establish **document and derivation provenance**. They do not constitute independent proof of legal ownership of the English educational expression or a blanket determination that no proprietary third-party facts or formulations were reused.

**Potential rights issue that remains open:** ICE's [US Dollar Index futures specification](https://www.ice.com/products/194/US-Dollar-Index-Futures/) expressly reserves intellectual-property and trademark rights over index materials and includes broad written-consent language. **Linking to ICE for fact-checking is not a data license, redistribution permission, trademark endorsement, or legal clearance.** Avoid importing index formulas, proprietary weighting tables, charts, logos, licensed market feeds, and downloadable data under this approval. A qualified reviewer must determine the appropriate use/attribution standard for short educational descriptions and nomenclature in target jurisdictions; do not imply that even a first-party text translation settles third-party rights.

The Federal Reserve public pages provide authoritative statistical definitions. Public access alone is not an unrestricted rights grant; track any reproduced chart, table, data series or image separately if later proposed.

## Compliance and release gate status

| Decision | State as of this review |
| --- | --- |
| First-party English source and private offline Spanish derivation | **VERIFIED provenance** through Git blobs, PRs, owner-scoped acceptance and offline Action |
| Owner approval of Spanish descriptive metadata and unchanged English quiz links | **APPROVED for editorial use** |
| Source concept/definition corroboration | **VERIFIED on primary pages** (see matrix) |
| Hypothetical examples correctly categorized as educational | **VERIFIED in source text** |
| English/Spanish ownership and any relevant third-party licensing assurance | **NOT INDEPENDENTLY CERTIFIED** |
| ICE rights/trademarks and any marketing/ad-approval implications | **HOLD — qualified rights/compliance review** |
| Reuse/translation publication authorization | **HOLD — distinct from editorial acceptance** |
| Spanish public route / sitemap / hreflang / indexability | **HOLD — absent** |
| PR #932 Production merge | **NOT AUTHORIZED; must remain Draft/unmerged** |

### Concrete next human action

Review this matrix against the actual English editorial creation records and any external assets, and either (a) record a **narrow owner attestation that USD Impact owns/has authority to translate its English *prose and teaching structure***, explicitly excluding ICE/Fed proprietary materials, or (b) mark this claim `UNKNOWN` and continue holding publication. Separately obtain a qualified decision on attribution, use of the ICE index name and references, risk/disclaimer phrasing, and LATAM target-market rules. **Do not solicit secrets, credentials, personal IDs or legal documents in GitHub comments.**

**No direct article/body/SEO metadata edit is part of this evidence note. No public release, license assurance, Production merge, DNS/SSO or commerce changes have been requested or authorized.**
## Post-review editorial clarity update — 2026-10-29

The owner explicitly approved one precise Spanish wording correction in the hypothetical DXY 100→102 exercise:

> En este ejemplo hipotético, el DXY sube dos puntos, pero eso no demuestra que el dólar se haya fortalecido en la misma magnitud frente a un conjunto más amplio de divisas ponderado por el comercio.

This sentence replaces “La subida del DXY es real, pero no demuestra que el dólar se haya fortalecido en la misma magnitud frente a un conjunto más amplio de divisas ponderado por el comercio.”. This **supersedes** older statements in this document that the Spanish body was still byte-identical to its initial accepted translation; the edited body is now pinned to new Git blob hash `78cf51a6333b33c603359805be42fd8212188ad8`. All source-to-claim research and teaching-example origin evidence remain applicable: the numbers are illustrative, not actual ICE/Federal Reserve observations. No third-party rights determination or publication authorization is inferred. Article frontmatter remains unchanged, public Spanish DXY URL still held, and legal/compliance review still separate.
