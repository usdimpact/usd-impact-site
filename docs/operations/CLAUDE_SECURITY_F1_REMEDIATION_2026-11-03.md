# Claude security F1 remediation and remaining HOLDs — 2026-11-03

**DRAFT / NO MERGE / NO DEPLOY / NO INDEX / NO RIGHTS CLEARANCE.**

Source: Claude's independently reproduced P1 Score-rights freeze bypass in the submitted read-only handoff (F1). Earlier staged Score guard scanned only top-level `.md` files while Astro's content loader recursively loads `**/*.md`. A file in `weekly-reports/archive/` could therefore enter Production as a new indexed report without being inventoried. This was demonstrated by Claude on a disposable build; the new patch prevents that path at the rights/source guard.

## Isolated implementation

- Parent is Draft [#1077](https://github.com/usdimpact/usd-impact-site/pull/1077), exact base `9f81f3987d9c99d2576ded2bd631eb67aab72a65`. Do not overwrite #1077 or #1074.
- The Score guard now recursively enumerates all filesystem entries in both `src/content/weekly-reports/` and `src/content/monthly-reports/`, **including every extension and dotfile**. It fails on symlinks, special files, and a symlinked collection root, rather than silently ignoring them.
- The baseline is bumped to version 2 and pins the pre-existing single-byte `monthly-reports/.gitkeep` Git blob `8b137891791fe96927ad78e64b0aad7bded08bdc` in an explicit **non-report** entry. All 13 historical Weekly and 3 historical Monthly blobs retain their original pinned SHA-1s. A new or edited report remains forbidden. New miscellaneous files at any level are also forbidden.
- A new regression uses the actual `collectScoreContents` with a disposable temp-tree, not only a hand-built file map. Negatives cover nested `.md`, nested `.mdx`, unexpected `.json`, tampered `.gitkeep`, symlinked files, directories and a source-root symlink. A clean source tree must still pass.
- The CI workflow's three build steps now use `steps.plan.outputs.build != 'false'`. If the planner output is missing, full Production/Preview builds run instead of being silently skipped. Tests and builds are CI-only. No hosted Preview is created.

## Remaining security decisions

**F2 remains HOLD, not fixed by this child.** The always-reported `fail-closed-contract` currently runs PR-controlled JS. The trusted `main` tree does not yet contain the unmerged held Spanish/Monthly policy sources, so requiring this check on `main` would cause failures; it could also be controlled by a malicious PR. Any future main-integrated design needs trusted policy loading or a mandatory independently reviewed check, plus a separate owner change for CODEOWNERS/branch protection and expected status source. Do not enable it now.

**F3 remains owner HOLD:** Vercel Preview authentication exclusion for custom-domain-bound branches, including `passkeys-dev.usd-impact.com`. No authentication or domain setting changed. `noindex` is not access control.

**F4 remains HOLD:** all current stacked security Drafts are based on the unmerged combined Preview ancestry, not main; mandatory `validate-and-build` and Dependency review for a future main integration are not certified by these stack checks.

**F5 source scope:** static artifact checks cover the identified Spanish and independent calendar Monthly output paths only. The project may contain Score-derived prose in other locations; no universal semantic source/rights analyzer is claimed.

**#1078 overlap:** [#1078](https://github.com/usdimpact/usd-impact-site/pull/1078) changes `apps/web/src/pages/macro-reviews/monthly/[period]/index.astro` on an independent Monthly accessibility/editorial Draft. The future integration must reconcile its `main:focus`, `tabindex=-1`, and revised opening wording with #1068/#1074 rights/noindex conditions. This P1 guard Draft intentionally DOES NOT replace the Monthly route or wording.

## Exact-head acceptance requests

1. Source guard and nested/MDX/symlink negative fixture PASS.
2. Production-classified static build and Preview-classified build PASS.
3. Existing Chrome endpoint/redirect fixtures and other scope checks PASS (unless legitimately not triggered).
4. Independently review the exact source diff and CodeQL results. Keep original four CodeQL threads open until full integration/appropriate scan.
5. Verify there is still no new Vercel deployment or main branch mutation.

Until an integrated, owner-approved separate release review, H-15/H-16, Score Issue #155, film #23 rights, Spanish editorial and actual assistive-technology QA all remain HOLD.
