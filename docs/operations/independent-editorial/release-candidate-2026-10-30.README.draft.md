# Independent Macro Weekly — separate Draft-only public-release candidate

**Date:** 30 October 2026. **State:** DRAFT / UNMERGED / NOT PUBLICLY DEPLOYED / NOT INDEXED.  
**Requested Stage B scope:** original English educational explanations, five exact Federal Reserve/BEA/BLS source links and reported government facts, issuer attribution; no copied source materials, vendor data or original Score. Public Production and all rights gates remain HOLD.

## How this stacked Draft relates to prior work

This branch `agent/independent-macro-weekly-public-candidate-2026-10-30` starts from the exact approved Stage B preparation branch head `efd76ae1e277c77df236af31bd8a9c009725774a` and must be opened as a **separate Draft PR targeting that branch**, not merged or rebased onto protected `main`.

- **Base PR #1019:** existing published Daily SHA pins, protected Stage A preview, editorial/layout-only owner PASS, exact five-source rights review, original Score rights HOLD, independent Monthly 0/4.
- **Parallel Draft PR #1020:** source/rights all-deny research reference only. Its incompatible synthetic reporting contract is **not** copied or merged.
- **New candidate:** proposed future site path `/macro-reviews/weekly/2026-10-30/` and a distinct English article. The path is **NOT currently generated** because the Astro `getStaticPaths()` returns `[]` unconditionally. No environmental variable, scheduling rule or webhook can enable it.
- **Original site pages:** `/reports/weekly/`, `/reports/monthly/`, original Score, news and book/library remain unchanged.
- **Stage A protected isolated Vercel deployment:** stays as it was, with authentication and noindex. Its deployment remains labeled Production *inside the isolated project*, not a public site release, and is **not** a template for enabling the independent public route.

## What the new candidate contains

| File | Role | Safety |
| --- | --- | --- |
| `apps/web/src/data/independent-macro-review/weekly-2026-10-30.release-candidate.html` | Original English facts-based article, adapted from the Stage A PASSED copy only in non-substantive release-candidate notices | Explicit unpublished banner, noindex, no scripts/analytics/remote resources, issuer direct links |
| `apps/web/src/pages/macro-reviews/weekly/[date].astro` | Proposed separate Astro route source | `getStaticPaths() { return []; }` — generates **zero public pages** |
| [Release candidate manifest](release-candidate-2026-10-30.manifest.draft.json) | Pinned candidate HTML SHA, source Dailies, five official items, exact owner editorial PASS and narrow publisher-use acceptance TRUE, but all legal/merge/publication/indexing gates FALSE | No `datePublished`, no rights grant, no review PASS transferred from Stage A |
| [Romanian/international issue review](release-candidate-2026-10-30.rights-assessment.draft.md) | Official Romanian Law 8/1996 Art. 9 (facts, data, news); EU Database Directive; Fed/BEA/BLS and USAGov policies | Favorable facts/link distinction, **not** final copyright/legal clearance |
| `apps/web/scripts/test-independent-macro-release-candidate.mjs` | Validates immutable Stage A source, six pinned claims, exact five official URLs, original sections, no source/rights gate drift | CI fails on unauthorized public candidate change or accidental route enablement |
| `apps/web/scripts/test-independent-macro-release-candidate-build.mjs` | Checks Astro's generated public `dist/` and sitemap after build | Fails if a new public candidate HTML file or sitemap link appears |

The `validate:reports` script runs the candidate guard after the existing independent draft and Stage A tests. The normal Astro `build` script runs the candidate public-output denial test at the end, so **a successful build specifically proves the new route is not yet published**.

## Current owner decision and provenance — later than the original Draft

**Reviewed candidate owner PASS:** [exact candidate and publisher limited-use decision](release-candidate-2026-10-30.owner-editorial-and-narrow-use-pass.draft.json). This records the actual user approval of the exact unchanged article and of an original English prose / public facts / five official links / agency credit scope. It **does not** grant third-party copyright rights, approve logos or charts, substitute for a qualified foreign-law determination, or authorize a public URL.

**Final source revisions verified:** [five-Daily Git blob audit](release-candidate-2026-10-30.final-daily-revision-audit.draft.json), including the later merged Fed [PR #928](https://github.com/usdimpact/usd-impact-site/pull/928) that superseded the initial FOMC Daily correction and matches the pinned published October 28 edition. The older [claim evidence ledger](release-candidate-2026-10-30.claim-evidence.draft.json) is a **pre-owner-PASS source snapshot**, not a contradictory latest editorial decision. The owner review is recorded as a separate later event; dated prior *Daily* corrections remain distinct.

**Current full preflight:** [owner-approved release-readiness and remaining gates](release-candidate-2026-10-30.owner-approved-preflight.draft.md). No public HTML is generated, existing reports remain unchanged, and independent Monthly eligibility stays **0/4**.

## Review/approval policy

The Stage A HTML was approved for editorial/layout **only** at Git blob `4fc7844ebb8701dd3682326dfe4e119c8783467f`. The candidate has a **different HTML blob** (`4ce3ea62d8db328fa03739ae15e2571f5f6e99bd`) because its Draft status and operator information were changed. **The owner has NOW given a separate exact-version editorial PASS and accepted the narrow publisher facts-and-links scope for this candidate**. This is pinned in the [new owner review receipt](release-candidate-2026-10-30.owner-editorial-and-narrow-use-pass.draft.json). It is **not merely transferred from Stage A**. Any further candidate HTML change requires another review; public legal, claim-specific provenance, merger, Production and indexing remain on HOLD.

The user approved official issuer-declared issue times and later authenticated editorial evidence **as the proposed methodology**. That proposal is not a fabricated exact first website-posting timestamp, and missing Fed/GDP/PCE claim-specific review receipts remain pending. The first URL to be published someday must record its **actual USD Impact publication time only after real publication**; the October 26–30 interval is its reporting period.

The owner has separately accepted the exact narrow original-facts/prose/links publisher scope, acknowledging Romania/EU/international caveats. **An independently qualified source-exception and cross-border compliance determination remains pending** for any later public Production release. Since the planned output is original prose plus headline facts and hyperlinks, no S&P DJI Score or additional paid market-data license is required **for the proposed content**, but neither US federal public-domain guidance nor Romanian Art. 9 is an automatic legal clearance for every jurisdiction and future distribution channel. No permission is implied for rehosting government PDF/HTML, agency logos, screenshots, commercial vendor observations, newsletters/RSS/PDF exports, translations or old Score history.

## Stop/go list — all external gates HOLD

- [ ] Human item-specific rights review complete for all five issuer items and relevant Romania/EU/international uses.
- [ ] Accepted final source provenance method and authenticated later exact-version editorial review of each claim.
- [x] **Exact current candidate HTML editorial PASS** for the unchanged reviewed Git blob; separately [ ] final compliance/international-use signoff, attribution/third-party exceptions and actual future first-publication-date policy.
- [ ] Single final independent reporting contract and public URL/navigation/privacy/cookie implementation reviewed.
- [ ] Build produces the intended public page *only after separately authorized changes to guards and sitemap rules*.
- [ ] New protected preview and anonymous-access denial verified if later requested; **none is authorized by this Stage B preparation**.
- [ ] Final, separate **exact-commit** owner authorization for public site merge, Production go-live and indexability.
- [ ] Post-go-live public page link, source claims, actual publication timestamp and negative original Score checks verified.
- [ ] First Monthly eligibility established only after **four actually published consecutive-Friday independent Weeklies**, not the current private candidate.

**Do not tick a checkbox or change `releaseAuthorized:false` solely because CI passes.** A user asking to continue preparation is not an authorization to publish.

## Verification links for next session

Source stage work: [Draft PR #1019](https://github.com/usdimpact/usd-impact-site/pull/1019).  
Parallel reference rights: [Draft PR #1020](https://github.com/usdimpact/usd-impact-site/pull/1020).  
The new branch's separate Draft PR should reference the exact head and preserve #1019 as its base until a later explicitly authorized integration plan exists.
