# October 2026 Independent Monthly — standalone English accessibility and publisher-scope review

**Date:** November 3, 2026. **Status:** DRAFT QA / PUBLIC RELEASE HOLD.  
**Parent:** [current-main integrated Monthly Draft #1068](https://github.com/usdimpact/usd-impact-site/pull/1068) at `0df741eae215c9632bcd6955c39d1be46834411e`.  
**New review:** separate **three-file** child Draft; exact new SHA identified in its pull request. Neither the parent nor Production is modified.

## Focused English accessibility check (not a screen-reader certificate)

The independent English Monthly page uses a standalone, script-free HTML shell, **not** the shared Spanish app navigation or privacy-banner implementation. The original English source has one H1, seven `section[aria-labelledby]` article sections, a labeled aside, a main landmark, first-focusable skip link, visible anchor focus styling, linked official sources and policy/legal footer links, and a `prefers-reduced-motion: reduce` override. No form, custom menu, media player, video, modal dialog or page-level consent banner is present in this standalone page.

**Source-only hardening in this child:**
1. Add `tabindex="-1"` to `<main id="main">` so the skip link's target is explicitly programmatically focusable without becoming an ordinary Tab stop.
2. Provide a visible `main:focus` outline, preserving the existing link focus ring and reduced-motion override.
3. Extend the already-executed October Monthly source and built-preview test to assert the exact skip link, target, ring, unique IDs, one H1, no interactive script/banner and reduced-motion CSS. No dependencies, network endpoints, auth, build variables or workflow routes are added.

W3C's [G1 bypass-blocks technique](https://www.w3.org/WAI/WCAG21/Techniques/general/G1) includes a post-activation keyboard-focus check. Having a valid `href="#main"` **alone** does not establish that the focus moved in all browser/AT combinations. This child is a **preventive source-level improvement**, not a retroactive claim that the old behavior was definitively broken.

| Check | Source/CI scope | Final status |
| --- | --- | --- |
| One H1, labeled content sections, sole main landmark, named links, skip link first | Source test | Static check PASS after exact-head CI only |
| Link focus ring and main focus target, no Tab-stop insertion | Source and built-HTML contract | Pending exact-head run |
| Mobile reflow at 320, 390, 768, 1440 | Prior integrated #1061 20/20 automated viewport receipt; prior content SHA | Prior evidence, **not** newly run and not actual keyboard certification |
| Initial privacy banner | The independent English Monthly source has **no page-level banner script** | Not applicable to this page's own source; global browser policy overlay still requires inspection if present |
| Full-page keyboard Tab, Shift+Tab, Enter on skip link, link activation, visual focus after jump and subsequent tab order | Real protected Preview/Chrome manual observation | **NOT VERIFIED for this child** |
| VoiceOver/NVDA/TalkBack, landmark reading order, high zoom, actual touch device and OS settings | Actual assistive-technology/physical-device session | **NOT VERIFIED** |

**Solid-background CSS contrast spot checks (not a complete rendered contrast test):**
- Ordinary body text `#cfdee3` on base `#081726`: **13.10:1**.
- Main accent link `#80dbcb` on base `#081726`: **11.12:1**.
- Warm focus outline `#efd0a1` on base `#081726`: **12.24:1**.
- Preview chip `#ffebc5` on `#423b2a`: **9.49:1**.
- Sidebar labels `#b4cbd1` on `#173c4d`: **6.93:1**.
Computed for these exact declared solid colors only; gradients, overlays, all text contexts and CSS-computed states were not exhaustively audited.

## Official-source reuse and accountable publisher scope

The underlying article links to six dated BLS/BEA/Federal Reserve Board official releases. Its language is newly drafted educational analysis; no copied issuer charts, third-party photographs, seals, copyrighted logos, syndicated PDFs, licensed quote feeds, cross-asset returns, Score driver series or existing original USD Impact Score is added.

| Source | Publisher policy | Scope assessment |
| --- | --- | --- |
| BLS | https://www.bls.gov/bls/linksite.htm | Published material generally public-domain; attribution requested; photos/illustrations previously copyrighted and BLS emblem are exceptions. Article uses factual data, citation and links only. |
| BEA | https://www.bea.gov/help/faq/147 | Information generally public domain unless indicated otherwise; BEA citation appreciated. Article uses factual data, attribution and hyperlinks only. |
| Federal Reserve Board | https://www.federalreserve.gov/disclaimer.htm | Most site information public domain unless indicated; excludes third-party works, seals and logos, and does not authorize site framing. Article cites the Board and links the FOMC statement. |
| USD Impact original education | The article retains visible “AI-assisted preparation” and identifies `KELA LEADS S.R.L.` as operator and content owner. | Human editorial/rights scope decision for **English public educational HTML on usd-impact.com** must still be recorded by a company-authorized decision-maker before production release. |

This rights assessment supports the *narrow original English HTML publishing scope*. It does not grant/activate translations, audiobooks, films, externally distributed PDFs, vendor data, the held Score, membership commerce or redistribution of protected third-party material. No external legal opinion or signed owner decision is implied.

## Owner decision and manual release checklist — intentionally unexecuted

1. [ ] Review the exact current candidate commit shown in the new Draft PR and verify the only page change is robust skip-target focus; accept or reject that revision as the authorized operator/editor.
2. [ ] Record a **company-authorized English HTML source-reuse/AI disclosure disposition** naming the decision-maker, date, website domain and above excluded media/Score/licensed-data scopes. Publisher links alone are not an internal signoff receipt.
3. [ ] For actual protected Preview of the exact candidate, document Tab → skip link → Enter → visible focus on main, then Tab/Shift+Tab navigation and footer links across mobile and desktop. Check that no initial consent/banner overlay obstructs interaction; record any true Assistive Technology testing separately.
4. [ ] Do not inherit older exact-head CI, protected Preview, 20/20 Chromium or screen-reader outcomes for a new commit. Perform new exact-head GitHub checks.
5. [ ] Only after those gates, submit a **separate expressly authorized public-release revision** against then-current main. That separate revision must specify the actual first-publication date and its SHA; merging, deploying or indexing remain separate decisions.

**HOLD remains in force.** `VERCEL_ENV=preview` October-only generation, `noindex,nofollow,noarchive,nosnippet`, the October Monthly sitemap exclusion, the first independent Weekly noindex/sitemap rule, all Spanish release holds and all existing Production/Score/entitlement controls remain unchanged.

This document is a review and decision *template*, not a claim of executed human approvals or actual assistive-technology test results.
