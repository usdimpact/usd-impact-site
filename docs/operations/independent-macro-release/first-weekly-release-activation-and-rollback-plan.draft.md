# First independent Macro Weekly — controlled release activation and rollback blueprint (DRAFT / HOLD)

**Prepared:** 2026-10-31. **Repository:** usdimpact/usd-impact-site. **Working review:** [PR #1025](https://github.com/usdimpact/usd-impact-site/pull/1025).  
**Exact pinned Draft baseline for this plan:** `85851976f2793beead0b536162ea1e037a2870e7`. **Protected-main reference:** `eb832fac7203a6a0f2ff29c0320616114e39224f`.  
**Not an activation instruction:** no existing authorization to merge, enable the page, deploy to the public Vercel project, index, alter existing Score/source rights, or distribute the report.

## 1. Frozen facts, article and preview evidence

- Seven factual editorial sections and ten existing source links: five official Federal Reserve/BEA/BLS release links and five already published Dailies. The full original English release-candidate source is immutable Git blob `4ce3ea62d8db328fa03739ae15e2571f5f6e99bd`.
- Independently authorized presentation exists in the isolated Vercel-authenticated review page, using shared component blob `22b3a44a59560ebdcd2c17781108332789e6dac1`, reviewed commit `889c9da8a692e5c7f5a2935fc4096eced67f8204`. Owner appearance, desktop/mobile and consent UI checks have been recorded as PASS.
- The owner's later reported Production Network/Cookies PASS is pinned in [an exact receipt](production-privacy-owner-devtools-pass-2026-10-31.draft.json). It is not a preserved independent request/cookie trace or a qualified GDPR/ePrivacy certification.
- The [item-by-item rights review packet](first-weekly-scope-limited-legal-and-production-privacy-review.draft.md) and [source evidence](first-weekly-source-rights-and-privacy-evidence-2026-10-30.draft.json) cover facts-and-links-only publishing, not agency logos, copied whole works or paid market data.
- Current proposed public route: `/macro-reviews/weekly/2026-10-30/ (NOT generated). The October 26–30 dates are **coverage**, not a claimed public publication date. Do not backdate its first publication.
- Existing original Score, Score-derived /reports/weekly/ and /reports/monthly/, commerce, licensing and source-rights registers are out of scope. First actually published **independent** Weekly = 0, qualifying independent Monthly = **0/4**.

## 2. Two remaining independent decision gates BEFORE a release patch

1. **Narrow source/international legal decision.** A qualified reviewer must record who assessed the first *original English educational webpage*, the five precise agency URLs, Romanian/EU/cross-border facts-vs-expression issues, item exceptions, operator disclosures and endorsement/attribution, with findings for each concern. Blanket permission to copy agency materials or use commercial market data is not requested. This qualified review is a **project governance requirement**, not a claim that quoting ordinary facts or linking to public government websites always requires special permission. If the owner wishes to replace this governance requirement with a different documented risk-acceptance process, that requires a separately approved policy decision; do not silently write `qualified...Approved:true` or call it independent legal clearance.
2. **Production privacy decision.** Existing interactive consent UI and owner-reported DevTools verification PASS. A reviewer must determine whether the current evidence satisfies the project-specific privacy release gate. The raw Production GA4 pre-consent/withdrawal trace and cookie names were not independently preserved in this PR; no independent audit result may be fabricated. Any new material failure requires a **separate targeted Privacy fix** with production QA and approval, not an unrelated edit to the Macro Weekly factual article.

The PR #1025 technical/owner-PASS baseline alone cannot clear either gate. Both decisions remain **HOLD** at creation of this plan.

## 3. Required exact release-patch changes (NOT made in this PR)

Do not merely change `getStaticPaths()` and publish the current Draft. It contains explicit not-published statements.

| File/surface | Current protected state | Future proposed change requiring fresh exact-head review |
| --- | --- | --- |
| `apps/web/src/pages/macro-reviews/weekly/[date].astro` | Literal `getStaticPaths() { return []; }`; static 0 routes | Whitelist **only** `date: '2026-10-30'` after the explicit release decision. Never use a broad glob, env flag or future week auto-router. Validate no other independent Weeklies are created. |
| `apps/web/src/components/IndependentMacroWeeklyDraftShell.astro` | `noindex={true}`, Draft title/description, `data-release-authorized="false"`, historical `data-shared-layout-editorial-pass="false"`, draft-only banner | Prepare a publication-specific shared-layout component or status-only patch with accurate current publication/approval metadata. Prefer a distinct release component so the reviewed Draft remains a fixed audit artifact. Indexing may remain **noindex** for an explicitly approved public soft launch; do not index automatically. |
| `apps/web/src/lib/independent-macro-weekly-draft-shell.mjs` | Strictly adapts unpublished candidate; asserts `readyForPublicRelease: false`; says the shared layout lacks presentation approval | Do not weaken the Draft validator. Use a separately reviewed release adapter or carefully bounded, exact-source status substitutions that preserve all non-status facts and links. |
| `apps/web/src/data/independent-macro-review/weekly-2026-10-30.release-candidate.html` | Immutable standalone approved Draft. It has Draft metadata, hero badge, review-status metadata, a compliance-section candidate notice, and release-control note | **Do not overwrite the source blob.** Preserve the historical Draft and document any narrowly scoped changed status strings in a different reviewed release artifact/adapter. Changing in-section Draft text is an **editorial change requiring a targeted new PASS**, even if macro facts do not change. |
| Shared navigation, robots, sitemap and distribution | No public route/nav/sitemap/email/RSS inclusion | Decide public reachability, indexability, link discovery, newsletter and RSS **independently**. A single authorized page does not automatically authorize syndication or marketing. |
| `apps/web/scripts/test-independent-macro-main-integration-hold.mjs` and manifest | Fail closed: build must produce **0** pages; every release authorization FALSE | Keep the negative test for the Draft artifact. Add separate **positive exact-date published-page tests** in a release PR while checking other weeks, original Score, source grants and unrelated outputs remain unchanged. Do not just delete the negative protections without replacement. |

Suggested bounded editorial adjustment: replace only publication-status assertions (badge, coverage vs publication wording, compliance release-control disclaimer and adapter notice) when a final release is authorized; **do not change the seven factual claims, macro numbers, citation URLs, source timestamps or investment compliance language** without a new factual review. A status-only adjustment still needs a new publisher PASS on the exact rendered release artifact.

## 4. Ordered cutover process — only after gates 1–2 and explicit scope approval

1. **Baseline freeze:** re-fetch current protected `main` and PR #1025; verify the article/component/style blob hashes and completed 6/6 CI. Stop if any current baseline changed. Prepare new isolated release-candidate PR off the **then-current** protected main (do not silently merge the entire Draft history or resurrect old Score branches).
2. **Bounded activation patch:** implement only the approved date-specific page and accurate status copy; maintain site `BaseLayout`, legal/footer/consent, operator and financial disclaimers. Do not connect paid market data. Retain exact source and official-link provenance. Keep all future weeks unrouted.
3. **Pre-public checks:** build and test source and generated output on the exact release commit, review CodeQL, dependencies, public/legacy Score regression, 200/404 route matrix, semantic headings, legal links, no duplicate header/footer, 320/390/820/1440 px, opt-in UI, keyboard access and official links. Check current Vercel project IDs and authentication. If a private preview is separately approved, use an isolated, fully authenticated project and a production-parity build; do not enable Git deployments for `agent/*` globally.
4. **Release approval:** owner must specify exact tested **SHA**, named public Vercel project, target URL, whether protected-main merge is authorized, whether new public deployment is authorized, and separately whether indexing/navigation/newsletter/RSS are authorized. Approval of this plan is not approval of those actions.
5. **Controlled release:** only after approvals, use the approved deployment workflow for the exact tested commit. Verify anonymous public response, footer, current real legal disclosures, no accidental Score exposure, page metadata/canonical/robots and actual source-link navigation. Record the first live public publication timestamp **only after the URL is verified**; do not use coverage dates as the publication time.
6. **Post-release accounting:** count the first actual independent Weekly only after public verification. Do **not** backfill or substitute earlier Score Weeklies. Monthly remains 0/4 until four genuinely published consecutive-Friday independent Weeklies have been confirmed under their own individual release receipts.

## 5. Post-release verification and rollback (requires its own authority)

**Pass matrix after authorized release:** proposed exact Weekly URL returns 200 with one H1 and seven facts sections; adjacent dates are unavailable; robots directives match **separately approved** indexing; official links and legal/footer/privacy UI work; no added Score/commerce/network-feed permission; anonymous browser can access only the intended article.

**Rollback trigger:** wrong content/claims, misdirected links, privacy failure, source-rights exception, forbidden indexing, unintended extra route, changes to original Score, or accessibility/security failure.

**Rollback plan:** using the public Vercel project's authenticated dashboard, select the previously verified, known-good Production deployment (checkpoint `eb832fac7203a6a0f2ff29c0320616114e39224f` at preparation, but reverify immediately before any cutover); restore it through the platform's **authorized** rollback/promote action, then check public route becomes unavailable or shows intended prior state, confirm original pages and legal functionality are unaffected, and document the incident. Do not treat a Git revert alone as sufficient if it has not yet deployed. Rollback can alter automatic domain assignment; use Vercel's current deployment management guidance before doing it.

**Stop rule:** if any checklist item is unknown, deny public activation; document the missing evidence instead of inventing a license, a legal opinion, a timestamp or a PASS.

## 6. Release decision input template (UNFILLED; not executable)

- Qualified scoped legal/source review: PENDING — reviewer/authority, date, exact page version, URLs, exceptions, signed finding.
- Production privacy/ePrivacy release readiness: PENDING — owner QA evidence already recorded, exact reviewer decision still absent.
- Exact final release PR and commit SHA: PENDING.
- Exact destination project: verify `prj_ZoLLM35ksI6wk17PcfS2xYknaVl7` at release time; not an authorization.
- Public route: proposed `/macro-reviews/weekly/2026-10-30/`; not yet approved.
- Merge: **NO**. Production deploy: **NO**. Indexing: **NO**. Site navigation: **NO**. Marketing/RSS/PDF/translations: **NO**. Original Score rights: **HOLD**.
- First actual publication timestamp: **null**; independently published Weeklies **0**; Monthly **0/4**.

**No production, code behavior, DNS, Git branch deployment policy, indexing, payments, original Score or user-access controls change as a result of this blueprint.**
