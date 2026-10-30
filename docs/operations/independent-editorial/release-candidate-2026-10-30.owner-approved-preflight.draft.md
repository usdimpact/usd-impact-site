# First independent Macro Weekly — owner-approved Draft preflight and release boundary

**Decision date:** October 30, 2026  
**Project:** USD Impact / KELA LEADS S.R.L.  
**User priority:** publish the independent educational Macro Weekly first, then accumulate four *actually published* consecutive-Friday independent Weeklies for a later independent Monthly.  
**Current release state:** **DRAFT / ZERO PUBLIC ROUTES / RIGHTS & PRODUCTION HOLD**.

This is a **review and launch-readiness memo**, not a deployment instruction, trademark clearance, lawyer's opinion or authorization to change protected `main`.

## 1. What the owner has expressly approved

The publisher was asked whether the *exact new* independent candidate's editorial content was accepted and whether the publisher accepted the **narrowly defined original-prose, official-facts and direct-links use, with documented international exceptions**. The user replied: **“approved, please continue in high detail.”**

Recorded in the immutable-scope [owner review record](release-candidate-2026-10-30.owner-editorial-and-narrow-use-pass.draft.json):

| Scope | Owner decision | Boundary |
| --- | --- | --- |
| **Exact candidate editorial content and presentation** | **PASS** | Only HTML Git blob `4ce3ea62d8db328fa03739ae15e2571f5f6e99bd` in [Draft PR #1024](https://github.com/usdimpact/usd-impact-site/pull/1024). Any revised article or layout needs a fresh editorial PASS. |
| One future original English free educational article, five official issuer links and agency attribution | **Narrow publisher use accepted** | Independently authored explanation and historic released facts only, acknowledging Romanian/EU/international copyright differences. |
| Issuer-declared official time + authenticated later editorial source evidence | **Approved as a Draft methodology proposal** | Does not assert unknown first HTTP website posting time, and does not backdate USD Impact's future publication timestamp. |
| Protected Preview, Production, merging, source-license purchase, indexing or public distribution | **NOT approved** | Retain the original Score and independent release gates, and the zero-path Astro build. |
| Qualified foreign-law and exact third-party exception assessment | **Not represented as independently signed off** | Publisher's narrow risk acceptance is not a blanket professional legal opinion or an external agency license. |

Approval receipt has **no made-up UTC review timestamp, reviewer signature or law-firm identity**. User response serves as a dated conversation owner decision within this project.

## 2. Exact reviewed article and claim evidence

The candidate remains a **Draft-only HTML source** with `noindex` and `data-release-authorized="false"`, proposed future URL `/macro-reviews/weekly/2026-10-30/`. It is **not a public page**.

- Primary source-linked factual claims: October 27–28 Fed meeting calendar, October 28 FOMC held **3.75%–4.00%** in a **10–2** vote; October 29 BEA Q3 GDP advance **+3.4% annualized** after **+2.2%** Q2; September PCE **+3.6% headline / +3.1% core year over year**; October 30 BLS ECI **+0.8% quarterly SA / +3.4% 12-month NSA**.
- Four outcomes have official issuer-declared October 28 **18:00 UTC**, October 29 **12:30 UTC** for both BEA outcomes, and October 30 **12:30 UTC** for BLS. The actual first website HTTP posting instants are **unknown**, not backfilled.
- The [six-claim ledger](release-candidate-2026-10-30.claim-evidence.draft.json) distinguishes two calendar reminders from four released outcomes and prior *Daily* corrections from this *Weekly* owner's fresh article PASS.
- The [five-Daily final-version audit](release-candidate-2026-10-30.final-daily-revision-audit.draft.json) verifies **5/5 published Daily blob SHAs** match protected `main`.
- Important correction: [October 28 PR #926](https://github.com/usdimpact/usd-impact-site/pull/926) produced an **intermediate** post-FOMC Daily blob `e0dfe2159adfe1d4da79299773e7fb4125c31fee`. The **later** merged [PR #928](https://github.com/usdimpact/usd-impact-site/pull/928), revision `8eb805ad9ae43148d188f61a960aed69a70b528a`, produced the **final pinned** October 28 Daily blob `c7e6ae165a445658aaefe5958f753c4474e89212`. This exact-fingerprint difference is now explained, not concealed.
- October 29 BEA final Daily blob `068950a9aec9c4b5bee6ca8ce16ebdadd430451e` matches [PR #938](https://github.com/usdimpact/usd-impact-site/pull/938) revision `14bbc23422518eb8850e4591f0127ba50cf68d7d`. October 30 BLS final Daily blob `f8881e383adba66eb801a3fbbcb4d1507de32917` matches [PR #1009](https://github.com/usdimpact/usd-impact-site/pull/1009) revision `8aa2178d0b024cd6740b527f3ee32a8c2962f4d4` and its **Daily-specific** owner PASS.
- The new candidate has an independent **whole-article owner PASS**, but no claim that historical Daily approval retroactively grants legal source-use rights. The supplemental claim-level review metadata is still separately flagged for a future final publication methodology.

## 3. Narrow rights assessment — no market-data license procurement

This candidate contains **independently written English explanatory text, public economic facts, plain-text agency credit and ordinary issuer links**. It excludes copied press-release paragraphs/tables, graphics, charts, logos, trademarks, screenshots, original eight-driver Score, historical Score publications and paid market-data feed observations.

| Official guidance | Applicable principle | Exclusion to retain |
| --- | --- | --- |
| [Federal Reserve Board disclaimer](https://www.federalreserve.gov/disclaimer.htm) | Board-originated information generally public domain and Board hyperlinking permitted with citation. | Exclude non-Board copyrighted graphics, seals and website framing; do not imply agency endorsement. |
| [BEA copyright FAQ](https://www.bea.gov/help/faq/147) | BEA website information generally in public domain unless specified; BEA credit appreciated. | No copying third-party protected expressive artifacts or source pages. |
| [BLS linking/copyright policy](https://www.bls.gov/bls/linksite.htm) | Linking and BLS-authored public-domain material permitted; agency attribution requested. | Exclude previously copyrighted illustrations and BLS emblem. |
| [Romanian Law No. 8/1996, Article 9](https://legislatie.just.ro/public/detaliidocument/7816) | Ideas, press information and simple facts/data are excluded from copyright protection under Romanian law. | Do not treat the legal exclusion for facts as a license to copy protected foreign expression or reproduce databases. |
| [USAGov foreign copyright notice](https://www.usa.gov/government-copyright) | U.S. federal works may receive different copyright treatment outside the U.S. | Do not infer world-wide rights for full source content, licensed graphics, marks or non-government works. |

The **publisher has accepted this narrower one-webpage scope**, but the source-use worksheets' original all-deny flags remain unchanged because they govern **broader redistribution, source copying, media, transport, foreign and retention permissions**. They are **project HOLDs**, not evidence that the agencies refused rights. A future release integrator should resolve the specific remaining *international/legal/compliance and third-party exception* questions; do not require or pretend to obtain five blanket reproduction licenses for copied materials that this candidate **never uses**.

No paid S&P DJI, vendor series, DXY/WTI/energy/equity pricing entitlement or original Score rights are part of this design. **No additional market-data license purchase is recommended for this facts-and-links-only content**.

## 4. Security and staging boundary — no public release in this PR

- [Draft PR #1024](https://github.com/usdimpact/usd-impact-site/pull/1024) is stacked on [Draft PR #1019](https://github.com/usdimpact/usd-impact-site/pull/1019); parallel rights [Draft PR #1020](https://github.com/usdimpact/usd-impact-site/pull/1020) has a different synthetic schema and **must not** be merged into this release branch by assumption.
- The only proposed site route source is `apps/web/src/pages/macro-reviews/weekly/[date].astro` with `export function getStaticPaths(){return []}`; no environment variable can activate it. **0 generated public pages** and no candidate sitemap entry is the required green state.
- The read-only Draft-only GitHub Actions workflow has **no Vercel token, deployment permission, secrets or site release step**. The negative build guard checks that no candidate route, sitemap reference or known source fingerprint leaked into generated files.
- The isolated Stage A review environment still uses project-wide Vercel Authentication and `noindex`; its initial deployment was classified as Production **inside the isolated project**, not public USD Impact Production. Do not remove authentication, add DNS aliases or call it an actual Preview-target deployment.
- The original Score site's/pipeline's canonical rights records remain `state:hold`, without approver/receipt. The existing public `/reports/weekly/` and `/reports/monthly/` retain their historical Score-derived identities.

**Do not merge multiple source Draft branches wholesale:** a future go-live should use a **new, minimal, independently reviewed release integration PR against current protected `main`**, taking only the specifically cleared independent content, source-attribution/provenance metadata, isolated route activation, tests, disclosure and rollback controls. Building that main-based release PR, enabling a public route or staging Production each requires a **new, separate owner authorization**.

## 5. Actual remaining gates — shortest controlled route

1. **Qualified scoped publishing/compliance assessment:** determine any remaining issuer third-party exceptions, Romania/EU/international jurisdiction exposures, agency credit/no-endorsement, site legal/privacy/cookie disclosures, and the permitted sole English webpage medium. The publisher's explicit narrow-use risk acceptance is already recorded; do not reset it to "no owner decision."
2. **Claim-level final evidence methodology:** accept existing issuer-stated times and the verified later exact Daily revisions for this edition, while recording any unresolved claim-specific independent Weekly review requirements. The entire candidate article **already has owner editorial PASS**; do not request the same HTML review again unless the article itself changes.
3. **One final release contract and integration review:** use `independent_macro_education`, not the old Score source model or the incompatible alternate synthetic schema. A later separate route should not depend on original `/reports/weekly/`, licensed data, commerce or paid Score provider rights.
4. **Separate explicit production instructions:** owner must identify the final reviewed **exact release-integration PR commit and intended public Vercel project**, with explicit scope for merge, route activation, anonymous/public access, indexation, actual new publication timestamp, and post-release rollback. No earlier generic "continue" statement authorizes this.
5. **Post-publication verification only if the owner later authorizes release:** confirm public route/HTML/issuer links/legal disclosures, unrelated Score unchanged, exact build provenance, and record actual new release date (never substitute coverage October 26–30). Only genuinely public independent Weeklies qualify for the first four-Friday Monthly.

**Current gate disposition:** owner exact candidate editorial PASSED; owner narrow facts-and-links use ACCEPTED; historic source provenance RECONCILED; final cross-border/legal/integration/Production release STILL HOLD; independently published Weeklies **0**, first Monthly **0/4**.

This memo records the owner's present decisions without requiring repeated approval of the same article or overstating legal/commercial source rights.
