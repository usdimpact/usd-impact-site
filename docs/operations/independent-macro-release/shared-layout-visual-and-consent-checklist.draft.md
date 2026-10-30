# Shared-layout integration — visual and privacy QA checklist (Draft / not published)

**Prepared:** 2026-10-30. **Working PR:** [#1025](https://github.com/usdimpact/usd-impact-site/pull/1025).  
**Source article approval:** Original standalone candidate's exact Git blob `4ce3ea62d8db328fa03739ae15e2571f5f6e99bd` has an editorial PASS and narrow original-facts/links owner acceptance. **This new shared-site visual presentation has NOT received an exact-version PASS**.  
**Public status:** Route `/macro-reviews/weekly/2026-10-30/` deliberately generates **zero pages**; source rights, qualified international/compliance review, merge, public Production and indexing stay HOLD.

## Implementation — what exists in Draft code only

- `apps/web/src/components/IndependentMacroWeeklyDraftShell.astro` imports the unchanged owner-approved HTML source, the deterministic seven-section adapter, and Draft-only CSS. It wraps the article in **the existing `BaseLayout`** with `noindex={true}` and Draft status, but produces **no public route**.
- `apps/web/src/lib/independent-macro-weekly-draft-shell.mjs` intentionally extracts only the original hero and main content. It excludes the standalone document `<head>`, global `<html>/<body>`, duplicate header/footer, first skip-link and standalone styles. It changes the main ID to `main-content` for the existing site skip-link and refreshes the obsolete side-card Draft-release status line. **All seven original editorial `<section>` blocks remain byte-for-byte unchanged, including their source citations and compliance text.**
- `apps/web/src/styles/independent-macro-weekly-draft.css` scopes all report styles to `.mw-root`, including focus-visible, tablet/mobile adaptations and reduced-motion. Sitewide header, footer, consent banner, main privacy notice, analytics settings and existing styles are **not** changed.
- The dormant `apps/web/src/pages/macro-reviews/weekly/[date].astro` continues to return `[]` from `getStaticPaths()` without relying on a toggle or environment variable. An unreviewed public URL cannot appear from a normal build.

**Important:** Astro compiling a Draft component and passing source tests is **not** a rendered browser screenshot, screen-reader audit or regulatory certification. A protected review of the *new integrated presentation* will be required under separate authorization before any public release.

## Safety and content contract for the Draft build

| Verification | Required outcome |
| --- | --- |
| Article source Git blob | Exact same `4ce3ea62d8db328fa03739ae15e2571f5f6e99bd` |
| Original factual sections | Seven of seven sections unchanged, source URL list unchanged |
| Other content | Only the site-shell transition and an obsolete draft status notice differ; no new macro assertions |
| Legal footer, Privacy settings and consent | Component imports the site's existing `BaseLayout` with `noindex`, and does not copy/reimplement privacy logic |
| Vercel agent branch deployment | `git.deploymentEnabled["agent/*"] === false`; 0 branch deployments |
| Static route | `getStaticPaths()` returns `[]` unconditionally; no output HTML or sitemap link |
| Security | No new API requests, analytics, third-party asset fetches, user inputs, Score paths, memberships or checkout |
| Original Score and parallel rights | All site/pipeline Score rights HOLD; 49/49 parallel source permissions and 10/10 release gates remain FALSE |
| Published independent Weeklies | **0**; eligible Monthlies **0/4** |

## Existing public-site consent browser QA — PARTIAL PASS (2026-10-30)

A **fresh anonymous browser session** tested the public [Privacy Notice](https://www.usd-impact.com/privacy/) and recorded its precise observed steps in the [consent-browser QA evidence](current-site-consent-browser-qa-2026-10-30.draft.json). It verified that the first-visit banner has **Reject analytics**, **Review settings**, and **Accept analytics**; rejecting optional analytics dismisses the banner; opening, saving and reopening **Privacy settings** showed optional analytics **unchecked**, with essential features always active. Existing Terms/Compliance/footer links were present.

**At the time of that first session, not yet verified:** `gtag.js` network loading/absence, real cookie values or deletion, GA4 beacons, visible **Accept then Withdraw** behavior (subsequently checked at UI level below), small-screen consent display, screen reader accessibility, or the **future shared-layout Weekly page** (still not publicly or privately rendered). This partial browser observation is **not** a qualified privacy/ePrivacy/GDPR compliance certificate. No Production settings or stored user data were changed, and the browser ended with analytics rejected.

## Additional consent browser observation — accept then withdraw PASS (2026-10-30)

An additional **fresh anonymous browser session** on the **existing** public [Privacy Notice](https://www.usd-impact.com/privacy/) clicked **Accept analytics**, confirmed the optional analytics checkbox was checked after reopening Privacy settings, then unchecked it, saved the preference, and confirmed the checkbox remained unchecked when reopening. Final UI preference was **Rejected**. [Evidence](current-site-consent-accept-withdraw-qa-2026-10-30.draft.json).

This validates the **visible browser-local consent choice flow only**. It does **not** independently verify that GA4 requests were blocked before acceptance, that cookies were cleared after withdrawal, or that the new unpublished Macro Weekly has been visually rendered. Privacy/ePrivacy certification remains pending. The Draft manifest and regression tests now pin this UI-only receipt separately while retaining `optionalAnalyticsAcceptanceAndWithdrawalBrowserTestCompleted: false` for the **full, network-and-cookie-verified** scenario.

## Protected browser QA after separately authorized review environment

No browser QA is claimed as completed by this document. When an authenticated, private-only review environment is explicitly approved, test **without disabling access controls**:

- **Desktop (1440 px), tablet (820 px), mobile (390 px and 320 px):** navigation and logo should come from the existing USD Impact header; no second header/footer; hero and 7 article sections visible; sidebar stacks without horizontal overflow; source links have suitable tap targets.
- **Accessibility:** one `<main id="main-content">`, `#main-content` skip link works, one H1, logical H2/H3 sequence, visible keyboard focus, sufficient contrast, no stuck keyboard trap, reduced-motion layout safe.
- **Content integrity:** all five official Fed/BEA/BLS links and all five published Dailies resolve; numbers/time units correct; no substituted market returns, no original Score values; no invented `datePublished`.
- **Legal/compliance:** existing site footer links to [Privacy](https://www.usd-impact.com/privacy/), [Terms](https://www.usd-impact.com/terms/), [Compliance](https://www.usd-impact.com/compliance) and [Contact](https://www.usd-impact.com/contact). Check actual page includes the footer and a working Privacy settings control.
- **Fresh browser/no prior consent:** non-essential GA4 and first-party telemetry must not execute before valid consent; Reject analytics must leave them disabled. Review settings should present essential and optional scopes accurately.
- **Opt-in and withdrawal:** Accept analytics only after explicit choice; subsequent Privacy settings withdrawal disables future optional tracking and removes relevant GA cookies as designed. Verify behavior with browser storage/network panel; do **not** infer from code alone.
- **Anonymous security test:** private review URL must remain Vercel-authenticated/noindex. Test anonymous denial before sharing it. A deploy target classified Production within an isolated project is not a literal Preview target.
- **Negative public URL:** the production `/macro-reviews/weekly/2026-10-30/` must continue returning not found before later explicit release authorization.

## Scoped rights still requiring determination

The publisher accepted independently authored English explanations, five federal release headline facts, ordinary official source links and attribution; this **does not** authorize copying official seals, third-party images, government release tables, PDF/HTML documents, provider market quotes or the original Score. Cross-border copyright exceptions, any protected third-party component, GDPR/ePrivacy consent and the intended future public website's actual legal disclosures need proportionate final qualified review. Do not convert existing broad rights matrices from HOLD to PASS based on the Draft.

## Next owner decision after a successful protected presentation review

Obtain a distinct **PASS/REVISE** for the **new shared-layout presentation**, naming the actual reviewed Git commit or rendered artifact. This would still **not** authorize merging, publishing, unblocking rights gates or enabling indexing. A subsequent final production approval must expressly name the final release commit and target project.

**No public publication or deployment is authorized at this stage.**

## Read-only CI and Vercel checkpoint — 2026-10-30 (Draft head `31ac4014`)

The six GitHub Actions workflows for exact commit `31ac4014d47b39a8d967f1f9f7baf76553fb2cae` were observed **SUCCESS**: Web quality, CodeQL security analysis, Supply chain evidence, Dependency review, Daily Card Telegram contract and Web Push contract. The web quality job's validation and build steps also completed successfully. This is a snapshot of that commit, not an automatic PASS for any subsequent documentation-only update.

The Vercel deployment inventory reported **zero deployments** for branch `agent/independent-macro-weekly-main-integration-hold-2026-10-30`. The current public `usd-impact-site` Production deployment observed at that check was **READY**, based on existing `main` commit `eb832fac7203a6a0f2ff29c0320616114e39224f`, not the Macro Weekly Draft. [Existing Production deployment](https://vercel.com/usd-impact/usd-impact-site/8CfC6X2K2kM1P9H3dPPatJFKKffh).

**Boundary:** No protected review deployment was created. No new shared-layout screenshot, network trace, cookie inspection, screen-reader audit, qualified legal signoff, new presentation owner PASS, release approval or public route is implied. CI is only a technical, fail-closed signal.

