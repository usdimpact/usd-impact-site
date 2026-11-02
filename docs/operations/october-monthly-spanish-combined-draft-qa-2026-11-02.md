# Isolated October Monthly and Spanish combined integration QA

**Status: DRAFT-ONLY / REVIEW HOLD. Do not merge into original PRs or Production.**

## Pinned exact source heads — 2026-11-02
- Protected main: `37589725e5b09675040c74c329478f305f4bfb30`
- Independent October Monthly PR #1060: `1605bbc5367a93f89869d4f39d180ecc7cbb23eb`; this candidate is based on its tree.
- UI-39 Spanish shell Draft PR #1047: `6a7245c5c8611a53208e4fcfe13bc9317635e05e`.
- UI-40 Spanish public destination Draft PR #1050: `48b4194bbc0120f2651e56973abb7b52edb0d6e9` (includes #1047 ancestor).

## Construction and nonoverlap
- Imported 13 unchanged, source-pinned Spanish JS/Astro/test/doc file blobs from #1050, including #1047's `site-navigation.js` and earlier owner contract, without modifying either original PR.
- Shared `apps/web/astro.config.mjs` is **not** copied from the Spanish branch. Only the Spanish review-policy import and sitemap-filter check were inserted into #1060's newer version. Preserves current main's independent Oct 30 Weekly exclusion, October Monthly prefix exclusion, private paths, unpublished locale filter, CSP and canonical handling.
- Main diverged from #1047's base in eight files, and the **only** intersecting imported source path is `astro.config.mjs`, reconciled as above. Existing Score reports, research/payments, access, Supabase, Cloudflare, consent and Production are untouched.
- Test code from #1060 conditionally enforces Spanish review exclusion in combined builds; #1050 also asserts its own source and canonical contract.
- No October editorial HTML changes, translations approved, media rights opened, or November Monthly generated.

## QA to execute before completing review
- Exact-head GitHub Web quality / localization / canonical / migration / GA4 / security checks. Both Preview and default/Production-shaped build restrictions must hold.
- Protected Preview: October Monthly, `/es/news/`, `/es/score/`, `/es/reports/`, `/es/video-library/` produce noindex pages excluded from XML sitemap; already-published independent Weekly remains accessible and noindex; November Monthly is absent.
- Production/default builds must not generate the Monthly or four Spanish Preview-only routes. No custom domain is assigned to the Preview. No index, RSS or public Reports navigation additions.
- This branch is not the public release of Monthly or Spanish. Editorial signoff, legal/rights disposition, bilingual content checks, and separate exact-version deployment approval remain mandatory.

## Imported exact blobs
- `apps/web/scripts/test-localization-policy.mjs` — `562ebb0c78a9a685aaa05051f4cd9eca5b12eec0`
- `apps/web/scripts/verify-canonical-build.mjs` — `019a0ea9cd96d43d47ef5f52ece54cb1270be44d`
- `apps/web/src/data/es-video-catalog-draft.js` — `cf49633a94bff2ceaf333e9cc046fa4f78e3d0c5`
- `apps/web/src/layouts/BaseLayout.astro` — `8ee30ea1e7d0718959d894b8d775f8b8513356d9`
- `apps/web/src/lib/spanish-public-review-policy.js` — `02acddb9ddc35fbf6c68a90e46a6994820353c9e`
- `apps/web/src/pages/es/[section].astro` — `c40ea1a18894296426301c31b39f31d222c4dad1`
- `docs/localization/ES_PUBLIC_DESTINATIONS_DRAFT_REVIEW_2026-11-01.md` — `6f8ee7314aee5d6ef913f8b4d4885d1bdc0500d2`
- `docs/localization/ES_VIDEO_51_SOURCE_PAIRED_EDITORIAL_REVIEW_2026-11-02.md` — `92762a04c6f5b3ce2cdd33bc6d7eaeccc951fd92`
- `docs/localization/drafts/DAILY_2026-10-30_ES_CANDIDATE_2026-11-02.md` — `5c68925be45988289e3c21a4f3f6ff2226c58b83`
- `docs/localization/drafts/WEEKLY_2026-10-23_ES_CANDIDATE_2026-11-02.md` — `1249a4f1f3538cfde52143a9510257f6bf04aa9d`
- `docs/localization/drafts/WEEKLY_DOLLAR_REGIME_CHECKLIST_ES_CANDIDATE_2026-11-02.md` — `f19993953b9c2d89eeeb9643f83eff32b107c9b2`
- `apps/web/src/lib/site-navigation.js` — `fc9b9fe088eca6e8c83869c7c9ccdd87815a1d6e`
- `docs/localization/EN_ES_SHELL_AND_FUNDRAISING_MODE_CONTRACT_2026-11-01.md` — `28c764bd4acfffa0951f0d90745b7df4fb376e99`

## November 2 — post-integration editorial-clarity QA adjustment (Draft review only)

The first combined protected Preview revealed one **P1 editorial ambiguity**: `/es/reports/` described the four-consecutive-Weekly monthly calculation without making clear it applies to the **historical Score-derived reports**, whereas the owner-directed **independent free Macro Monthly** follows a calendar month and does **not** require four already published independent Weeklies. This QA adjustment changes **only the isolated integration Draft's Spanish review page**, not source PR #1050, #1047 or #1060. It labels the legacy `monthlyEligibility` counter, adds a separate October (five Fridays; independently published Weekly Oct 26–30 only as of Nov 2) calendar-month explanation, maintains October unpublished/November month-end gates, and leaves all Score calculations/entitlements unchanged. A separate, visible Spanish AI-drafting notice was added to each of the four Preview-only routes without claiming editorial or rights signoff. Existing noindex/CSP protections remain intact.

Regression coverage: `test-localization-policy.mjs` asserts all four Draft Spanish pages declare the AI notice and the independent vs legacy distinction; `verify-canonical-build.mjs` asserts those markers on built Preview HTML. These are conservative source/markup tests, **not** a bilingual editorial approval, accessibility certification, transfer of original video rights, or release permission. Earlier imported-blob list is an immutable baseline, **not** the exact current blob state for the amended review-page/test files. A fresh exact-head combined build and protected Preview check are required before reporting PASS.
## November 2 — isolated exact-width Chromium browser QA gate (test-only proposal)

The stacked QA branch adds a manual workflow_dispatch-only Web quality step with a second isolated Astro Preview build and a Chromium DevTools Protocol test at **320, 390, 768 and 1440 px** on each of the four Spanish review pages. It checks computed document/body width for horizontal overflow, exact CSS viewport width, Spanish HTML language, one H1, noindex, main/skip-link presence, visible AI drafting notice, and all 51 gated video links. Captures four top-of-page PNG screenshots (Reports and Video Library, 320/1440) plus JSON to a two-day private GitHub Actions artifact. The browser reads only local static files on the GitHub runner; it does not connect to Production or bypass Vercel Authentication. No package dependencies, secrets, protected media, or new routes are introduced. The branch-specific guard prevents this step from running in main workflows even if its YAML is later copied. A 16/16 browser PASS must be read from the exact-head workflow receipt; creating this step alone is **not** an executed PASS. Physical-device review and assistive-technology certification remain separate owner release gates. Test source includes no account credentials or API tokens.

## November 2 — October Monthly independent Chromium width and source-link gate

The previous exact-head Web quality #3998 passed **16/16 Spanish** Chromium tests. That result did not test the separate English October Monthly page. For nonoverlapping review, this isolated Draft adds `apps/web/scripts/qa-october-monthly-responsive.mjs` and a **manual workflow_dispatch-only** additional QA step after the existing Spanish tests. The test uses the same local generated Preview files (it does **not** trigger a second build, contact customer systems or bypass Vercel Auth). It checks the October page at 320, 390, 768 and 1440 CSS px for viewport/document overflow, English language, one H1, seven labeled editorial sections, noindex+googlebot, valid skip-to-main focus, visible AI disclosure, six issuer URLs each linked twice and protected by noopener/noreferrer, five dated public Daily links, an independent Weekly link, proper October/Friday period attributes, historical Score and market-price exclusion flags, and absence of media or canonical publication tags. Results and two viewport screenshots are recorded in a separate private `october-monthly-preview-breakpoints` artifact (two-day retention).

This *automation configuration alone* is NOT an executed browser PASS, owner publication approval or full WCAG certification. GitHub run evidence and exact commit must be verified first. Physical devices, screen readers, typography, source reuse and owner/editor signoff remain separate release gates.

**Live click-through at preparation:** BLS employment/CPI/ECI, BEA GDP/PCE and Federal Reserve FOMC links all resolved to their original publishers; BLS November release schedule and BEA schedule also resolved. All five dated public Daily archive destinations and the Oct 26–30 independent Weekly were accessible. The public domain returned 404 for October independent Monthly and tested Spanish Draft pages. These were observed read-only; no source data, public page, DNS, Score or commerce was altered.

**Nonoverlap:** New PR #1064 concerns `apps/web/scripts/test-independent-weekly-current-entry.mjs` and `apps/web/scripts/validate-links.mjs` only; neither overlaps new October QA script or the isolated `.github/workflows/quality.yml` additions. Original PR #1060 and Spanish source PRs #1047/#1050 remain unchanged. Production main at preparation was `5ae8836944f2aeea3898cd0f91f30d2e4d53ce28`; no merge, Vercel deployment, publication or media-rights change is authorized.
