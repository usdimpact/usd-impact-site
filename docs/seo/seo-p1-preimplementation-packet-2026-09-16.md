# SEO P1 Pre-Implementation Packet — 2026-09-16

Status: **planning only / HOLD IMPLEMENTATION**. This document does not authorize Production, content, title/meta, canonical, indexing, sitemap, merge, or deployment changes. Implementation remains gated by #569.

Search Console evidence is settled through 2026-09-13. Query rows are intent evidence; page-level totals remain the quantitative backbone because GSC can suppress query rows.

## 1. BEA Aug 26 catalyst preview

Canonical preview: `/news/catalysts/2026-08-26-bea-personal-income-and-outlays-july-and-gdp-second-estimate-q2-preview`

Page performance: **2,086 impressions / 1 click / 0.048% CTR / avg position 7.27**.

Current emitted metadata:
- title: `Personal Income and Outlays, July 2026 + Q2 GDP | BEA`
- description: `BEA’s Aug. 26, 2026 releases: Personal Income and Outlays for July 2026, including PCE, plus the Q2 GDP second estimate and corporate profits.`

Visible query intent is dominated by official release naming, date/timing, PCE and GDP-second-estimate searches. Examples include exact `Personal Income and Outlays, July 2026` variants around positions 3.3–10.7 and `GDP (Second Estimate) and Corporate Profits, 2nd Quarter 2026` variants around positions 6.2–10.6.

Important diagnosis: the preview now receives some post-release/result-oriented intent. It already has an archive note linking to the verified July PCE outcome and BEA's released Q2 GDP results. Preserve the preview role; do not rewrite it to impersonate an outcome.

Post-#569 test hypothesis, only if low CTR persists:
- preserve the official release name and archive/pre-event role;
- test stronger date/timing clarity rather than generic promotional language;
- preserve PCE + GDP terms because both are evidenced;
- verify outcome handoff remains prominent and crawlable.

Candidate title for controlled test: `July 2026 PCE + Q2 GDP Second Estimate — Aug. 26 BEA Release`

Candidate description: `Archive of the Aug. 26, 2026 BEA release preview for July Personal Income and Outlays/PCE and the Q2 GDP second estimate, with links to released results.`

Do not deploy this candidate until #569 clears the observation gate and a fresh query/page check confirms the same intent pattern.

## 2. BLS Sep 4 Employment Situation preview

Canonical preview: `/news/catalysts/2026-09-04-bls-employment-situation-august-2026-scheduled-release-preview`

Page performance: **655 impressions / 1 click / 0.153% CTR / avg position 6.98**.

Current emitted metadata:
- title: `BLS Employment Situation — August 2026 Jobs Report`
- description: `BLS releases the August 2026 Employment Situation on September 4 at 8:30 a.m. ET. Watch payrolls, unemployment, earnings, hours, and revisions.`

Visible queries are strongly aligned to `August 2026 jobs report`, `nonfarm payrolls`, `unemployment`, `September 4 2026`, and BLS release-calendar intent. The source preview currently has **no archiveNote/outcome handoff**, while a published released outcome exists at `/news/catalysts/2026-09-04-bls-employment-situation-for-august-2026-released-outcome`.

Highest-value post-gate change is therefore not a title rewrite first. It is a narrow archive/outcome handoff equivalent to the existing BEA pattern, linking the historical preview to the verified released outcome while preserving both page roles.

Candidate archive note:
- introduction: `This briefing was prepared before the September 4 release.`
- context: `For the released August 2026 jobs data, read our`
- label: `verified Employment Situation outcome`
- href: `/news/catalysts/2026-09-04-bls-employment-situation-for-august-2026-released-outcome`
- closing: `The preview below preserves the information available before release.`

Only after that handoff is live and measured should a snippet test be considered. If still warranted, a controlled title hypothesis is: `August 2026 Jobs Report — Sep. 4 BLS Employment Situation`.

## 3. Real Yield evergreen strengthening

Canonical target: `/learn/real-yield`

Live audit: HTTP 200, indexable, self-canonical, one H1, ~500 words, 40 internal links, two authoritative external references. Current title is mechanically generated from the card title as `Real Yield | USD Impact Learn` (29 characters).

Current non-slash URL query evidence:
- `real yield`: 17 impressions, avg position 28.94
- `real yields`: 10, position 24.9
- `what is real yield`: 6, position 8.67
- `what is a real yield`: 3, position 9.67
- `what are real yields`: 2, position 9
- `what is the real yield`: 1, position 7

The slash/non-slash historical variants still split impressions for core terms, so #569 consolidation remains a prerequisite for causal measurement.

### Post-gate content hypothesis

Do **not** create a second `What is real yield?` page. Strengthen the existing canonical definition page.

Proposed search title: `What Is Real Yield? TIPS, Inflation and Market Impact | USD Impact`

Proposed H1: `What Is Real Yield?`

Proposed opening definition: `Real yield is the return on an interest-bearing asset after accounting for inflation or inflation compensation. In market analysis, the U.S. 10-year TIPS yield is commonly used as a market-based reference for long-term real yields.`

Proposed meta description: `Learn what real yield means, how TIPS provide a market-based real-yield reference, and why real yields matter for gold, the dollar, bonds and equity valuations.`

Required semantic coverage without keyword stuffing:
- real yield / real yields
- nominal yield versus real yield
- TIPS
- inflation compensation / inflation expectations distinction
- 10-year TIPS yield as a commonly used reference, not a universal definition
- opportunity-cost channel for non-yielding assets
- rate/valuation transmission
- explicit warning that real yields are not a single-factor explanation for gold or other assets

### Template design recommendation

The Learn template currently forces `<title>` from `card.title` and the H1 from the same field. Avoid renaming every visible card merely to optimize SERPs. Prefer an optional `metaTitle` field in the card model with fallback to `${card.title} | USD Impact Learn`. If an optional `searchTitle`/`metaTitle` is introduced, add regression coverage so existing cards remain unchanged unless explicitly opted in.

For Real Yield specifically, H1 can remain `Real Yield` if product consistency is preferred; the higher-confidence first change is the dedicated search title plus a more explicit first definition sentence. The `What is...` H1 variant is a secondary hypothesis, not required.

### Internal authority packet

Existing reciprocal/related-card graph already includes Real Yield from Three Macro Dials, inflation-expectations education and TIPS mechanics. Preserve those. Add contextual authority only where semantically natural, prioritizing:
1. `/dollar-framework` or Three-Dial framework → Real Yield using descriptive real-rate/real-yield anchor text;
2. TIPS mechanics → Real Yield;
3. Gold/real-yields explainer → Real Yield;
4. equity real-rates/valuation explainer → Real Yield;
5. representative catalyst pages → Real Yield only when real-rate transmission is discussed.

Avoid sitewide/footer links and avoid turning dated event pages into evergreen duplicates.

## 4. Structured data

All three audited priority pages lack structured data, but this remains a separate enhancement candidate. Do not mix schema implementation into the first CTR/content experiment; doing so would contaminate measurement and broaden scope.

## 5. Release order after #569 clears

1. Re-query settled GSC data and confirm slash/non-slash consolidation plus utility/noindex normalization.
2. Add BLS preview → outcome archive handoff if still absent.
3. Implement Real Yield dedicated search-title capability + one-page opt-in, with tests.
4. Measure before broader Learn rollout.
5. Consider BEA/BLS snippet experiments only if low CTR persists on settled post-gate data.
6. Keep DXY/Broad USD as the next evergreen packet.

Classification: `PREPARED / IMPLEMENTATION-READY AFTER #569 / NO PRODUCTION CHANGE`.