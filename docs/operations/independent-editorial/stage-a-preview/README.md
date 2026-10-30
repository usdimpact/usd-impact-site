# Stage A independent Macro Weekly — isolated protected preview

> **DRAFT ONLY — NO PUBLICATION / NO RIGHTS APPROVAL / NO MERGE / NO PUBLIC PRODUCTION.**

This source tree contains precisely one self-contained original English educational page, `macro-reviews/weekly/2026-10-30/index.html`, and its two Vercel static-serving controls. It is a separate review artifact, not the original eight-driver Score, not a new public `/reports/weekly/` route, and not part of the running USD Impact site. The exact article is based on the independently authored unpublished Weekly in Draft PR #1019 and cites the same five issuer sources and the five existing published Dailies.

## Deployment invariants

- Target: **isolated standalone Vercel project** with **Vercel Authentication for ALL deployments** configured and read back *before* any upload/deployment. Do not connect Git, alias a custom domain, or deploy to the public site project.
- **Observed API behavior:** The first file-only deploy with `target` omitted was labeled **`production` INSIDE THE SEPARATE ISOLATED PROJECT**. An explicit literal `target:"preview"` was previously rejected by the API on another project. Omission is **not** proof of Preview target. Do not claim this is a literal Preview-target deploy or retry with speculative target values. This is an authenticated isolated Stage A *review build*, not public USD Impact Production.
- Files: one HTML page, this `vercel.json` and `robots.txt`. No analytics, scripts, fonts, images, remote assets, auth secrets, provider APIs, market observations or dependencies.
- `vercel.json`: noindex/nofollow/noarchive/nosnippet via X-Robots-Tag, no-store, strict CSP (no scripts or network calls), anti-framing and robots disallow.
- Anonymous direct URL must be denied by platform Vercel Authentication. **An HTML noindex tag alone is insufficient protection.** Do not share an unprotected URL, grant a share link with public access, disable Vercel auth or promote this review build or assign any public domain.
- Verify account-authenticated access, exact headline and sources; compare the same file blobs. Recheck public USD Impact Production as an independent project.

## Owner Stage A editorial/layout PASS — exact source frozen

The owner explicitly reported **PASS on the reviewed editorial copy and layout only** on **October 30, 2026**. This PASS is pinned to the unchanged HTML Git blob `4fc7844ebb8701dd3682326dfe4e119c8783467f` and reviewed PR commit `77551873f9d7a68cfeec11804dc0237cdc0154ac` in the [fail-closed owner review record](../stage-a-editorial-layout-owner-pass.draft.json). The record does **not** claim a precise UTC review timestamp or a formal GitHub APPROVED PR review.

The same file-only deployment, `dpl_5qTFTzp6FaEMrqWvwLqFpmc3ESxT`, remains on the separate `usd-impact-macro-weekly-stage-a` project (`prj_rJ1pQKXoNAbrjMivScWeRYNfsAJa`). The project still has **Vercel Authentication for all deployment targets** and **no Git link**. Its two tested anonymous URLs returned `login_required`. The deployment has the **isolated-project Production target classification discrepancy**, not a public-site release.

**Any change to the approved HTML or its presentation must obtain a new editorial/layout review before the revised version can be described as PASSED.** Source rights, exact source item exceptions, international publication, final editorial provenance, public-indexability, merges, Production and the original Score all remain **HOLD**. This PASS does not make the October 26–30 Weekly an independently published issue; Monthly eligibility remains **0/4**.

## Releasing is a DIFFERENT future decision

- Original publication rights and Score-derived Weekly/Monthly remain HOLD.
- Exact five-item reuse and Romania/EU/international treatment remain pending. A protected private Preview can be reviewed without treating public-domain notices as completed legal signoff.
- Official issuer-stated release times are not first HTTP-posting times. The original Weekly's three missing sourceReleaseAt fields remain unresolved pending adopted methodology and claim-level independent editorial PASS.
- The authenticated isolated review build is not a member page, a public site release, or an actually published independent Weekly. Monthly eligibility remains **0/4**.
- Future live route, publication method, date, indexability and rights require separate affirmative owner approval and exact-commit QA.

In case of unexpected anonymous access to the project URL, stop sharing the Preview and immediately restore project-wide Vercel Authentication before proceeding.
