# F1 — isolated Vercel ignored-build investigation (Draft only)

**Owner boundary:** This branch is `agent/f1-vercel-skip-qa-20261101`, which matches the existing `apps/web/vercel.json` deployment-disabled pattern `agent/*`. Do **not** merge this PR into `main`, change the Production Vercel project, or deploy an isolated application for this test. Only synthetic Git-fixture QA is authorized.

## Why this branch exists

The three checks in GitHub's active `Protect main` ruleset include `Reject Development-only Production migration files`. Yet the underlying workflow remains in unmerged [Draft PR #1042](https://github.com/usdimpact/usd-impact-site/pull/1042), reviewed at commit `fc9f0d912cfaad2d289d417ad4593143e357bf99`. Merging directly to `main` could trigger a Production Vercel build despite the change being CI-only.

This PR is deliberately separate from #1042. The two new scripts plus read-only GitHub Actions workflow test a strict allowlist of the exact four paths and their Git blob IDs. They do not call any service or read secrets. The fixture recreates an isolated local Git history rather than relying on live accounts. It tests expected one-parent squash and two-parent merge behavior, app-code tampering, file modes, missing checkout history, wrong branch/environment, stale parent and incorrect blobs.

## Contract and source provenance

- Approved parent of protected `main`: `4221668716c2214012e4dd26a1dae8ee050f728a`; any change invalidates this proposal.
- Reviewed #1042 files and blob SHA-1 IDs:
  - `.github/scripts/check-supabase-production-intake.mjs` — `0f6d8f4ec591025afb9e5c0e6f137101aef9f179`
  - `.github/scripts/test-supabase-production-intake.mjs` — `f1f605a757d2d9565fd98bb513740169db81895c`
  - `.github/workflows/supabase-production-intake-guard.yml` — `032369eadc17f28ced2c4f3d438199269853f6cd`
  - `docs/operations/ui02-ui34-production-migration-intake-guard-2026-11-01.draft.md` — `16ec3a48ce15789001619bafaa4f74cd55586d59`
- Vercel's Ignored Build Step convention: **exit 0 means request to ignore the build; exit 1 means proceed with a normal build**. The proposed script deliberately returns 1 if anything is uncertain. This protects against suppressing unrelated application deployments, but it does **not** guarantee that a Production deployment cannot happen.
- Current production project root is `apps/web`. The script searches for the Git root; fixture tests execute from `apps/web` too. This is not proof of Vercel's live checkout depth, shell, environment variables, ignoreCommand length limit, or custom project settings.

### More direct *inline* candidate (not enabled)

The Vercel project's \`commandForIgnoringBuildStep\` has a maximum accepted length of 256 characters. The following one-time shell expression is **252 characters**, so unlike the source-file helper it can be entered into the project setting without adding a script to PR #1042. It compares \`VERCEL_ENV\`, the branch, the full first-parent commit, and a Git blob hash over \`git diff --raw --no-abbrev\` including all four file paths, modes and source blobs:


```sh
[ "$VERCEL_ENV:$VERCEL_GIT_COMMIT_REF" = production:main ] && [ "$(git rev-parse HEAD^)" = 4221668716c2214012e4dd26a1dae8ee050f728a ] && [ "$(git diff --raw --no-abbrev HEAD^ HEAD | git hash-object --stdin)" = 8f2bdca5f1a38cb4fec5fd66ec09db431fee0286 ]
```

The expected raw-diff Git hash \`8f2bdca5f1a38cb4fec5fd66ec09db431fee0286\` was independently derived from the **four added files** and their exact reviewed Git blob IDs in PR #1042. A synthetic commit with those precise blob identities created using \`git update-index --cacheinfo\` and \`git write-tree --missing-ok\` gave the same raw-diff hash. The 7-case [\`test-f1-vercel-inline-ignore.sh\`](/usdimpact/usd-impact-site/blob/agent/f1-vercel-skip-qa-20261101/.github/scripts/test-f1-vercel-inline-ignore.sh) checks skip on exact change, no skip on Preview/wrong branch/missing environment/stale parent/extra app change, and execution from \`apps/web\`.

**Boundary:** This is an **offline-tested candidate only**, not a live integration. There has been no Vercel checkout/environment test, no verification of the current project's Ignored Build Step setting, and no observation of an ignored *Production* deployment. A missing Git parent, unsupported shell, unexpected Git formatting, or missing system environment variable evaluates to **build normally**, which could violate the no-Production-deployment hold if used blindly. Do not install/merge without isolated validation and separate authorization. Because the expression is near 256 characters, do not add whitespace/comments when considering the project setting. Any \`main\` change invalidates the pinned parent and requires re-review.

## IMPORTANT: not deployable as-is

The source-level candidate is **not installed in Vercel** and does not exist in PR #1042's four-file changed set. A project Ignored Build Step command cannot invoke a script that is absent from the merge's checkout. Adding this script to #1042 changes the reviewed file allowlist and requires retesting/review. Do not assume its successful synthetic tests give a safe shortcut to merging #1042.

An alternative is a bounded **inline** Ignored Build Step that checks Vercel environment, expected parent, and a cryptographic hash of the entire first-parent Git raw diff (paths, file modes, blob IDs); it may avoid needing a script file, subject to the Vercel project command-length limit. Before using any such candidate, independently verify the exact Git diff hash, command limit, source checkout behavior and a no-new-READY-Production outcome in a safe isolated environment. Any uncertain execution returns build normally: do **not** trial-and-error on the live Production project.

## Stop conditions and gates

1. **This Draft PR is not a release.** No Vercel project settings, GitHub ruleset, Production application, Supabase migration ledger, or upstream Draft PR #1022/#1028 is to be modified.
2. Do not submit any merge request while source history or Vercel build-skip behavior is unverified.
3. Verify in an isolated project *only with separate explicit authorization for that project and any associated cost*. Do not reuse the existing GA4/Macro or panel staging projects without their owners' separate approval.
4. For a live one-time Ignored Build Step, separately authorize a recorded, reversible settings change; capture existing setting, immutable main/PR SHAs, existing Production aliases/deployment, and a rollback plan. The merge itself must remain a distinct approved event.
5. Recheck current `main` first parent, exact PR head, 4/4 CI, and GitHub required check immediately before any integration. Strictly exclude app, commerce, data-rights, email, migration files, and release-hold changes.
6. F1 migration provenance isolation, F2 truly distinct signed synthetic-user RLS QA, and F3 deletion_pending export privacy approval remain separate holds.

Official references: [Vercel Ignored Build Step](https://vercel.com/docs/project-configuration/vercel-json), [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration), [GitHub required checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).

## 2026-11-01 isolated runtime receipts — Preview positive and negative

An isolated, **new** Vercel project `usd-impact-f1-merge-skip-isolated-20261101` (`prj_O1gSDJg5NDzwms0iCOG37rvOXmnf`) was created with **Vercel Authentication for all deployments**, no public USD Impact domain, and a deliberately failing fallback build command `echo F1_ISOLATED_FALLBACK_BUILD_BLOCKED; exit 65`. The project's Ignored Build Step tests the exact first-parent/diff hash from #1042, but uses `VERCEL_ENV=preview` instead of Production. No public Vercel project settings were touched.

- **Git source reconstruction:** `agent/f1-merged-tree-skip-qa-20261101` commit `997045396f55d0f1137e4f10056a31f585580c2d` with first parent `4221668716c2214012e4dd26a1dae8ee050f728a`, tree `e68844e1b92689a038c805b7e94a618e8887a6ee`, and only the four reviewed PR #1042 blobs. GitHub compare verifies exactly four CI/doc paths, no app source modifications.
- **Initial first-deployment anomaly:** Request specified `target=preview`, but newly created project returned a `target=production` deployment `dpl_EqH4d5HLiSJjxE121qLdjcMDV9FM`. Preview-only command intentionally did not match. Fallback ran and exited 65; terminal `ERROR`, no READY application. This appears consistent with Vercel's **first deployment is Production** behavior acknowledged publicly: https://community.vercel.com/t/vercel-cli-ignores-target-preview-and-creates-production-deployment/46384 . API `target: preview` literal should not be relied upon; omit target to request normal Preview on an already-initialized project.
- **Positive exact-merge Preview validation:** With API `target` **omitted**, same isolated project and approved four-blob commit `99704539...`, deployment `dpl_BvSepFRFVcDJsrJFycBBS7Y14qmA` returned `target=null` (Preview). Vercel's build logs contain the actual Git clone/command execution followed by **"The deployment was canceled because the Ignored Build Step command returned exit code 0."** Terminal `CANCELED`; application install/build never started.
- **Negative extra-app-file Preview validation:** Constructed a new **single-parent** Git commit `fb3738f5ce35dc8314ad8c17e8f4c2571e0e22cf` on `agent/f1-merged-tree-negative-qa-20261101`: same four reviewed files PLUS `apps/web/f1-negative-build-fixture.txt`. API `target` omitted. Deployment `dpl_9PoEBWs8iwXFAW2M3RJm2dw7oKya` was Preview (`target=null`), rejected the skip, executed the safe fallback `F1_ISOLATED_FALLBACK_BUILD_BLOCKED`, and ended `ERROR`; no READY app release.
- Both tests used the actual Vercel Git clone and Ignored Build Step shell, not merely the GitHub Actions/offline fixtures. Positive and negative branch names are under `agent/*`, which is already deployment-disabled for the public USD Impact project. Neither QA commit nor branch is release-ready or to be merged.
- **Post-tests public Production verification:** public project `prj_ZoLLM35ksI6wk17PcfS2xYknaVl7` retained READY deployment `dpl_EmRG6A6tKtXjWuzp3FDNKVfJGC9i` associated with protected-main `4221668716c2214012e4dd26a1dae8ee050f728a`. PR #1042 remained Draft, unchanged; no live project settings, Supabase database, branch ruleset, or customer entitlements were modified.

### Remaining Production release boundary

The Vercel **Preview** environment proves the exact Git tree/diff behavior and correct rejection when source changes. It does **not** prove that the 252-character **Production** expression will run successfully at the real public project's next main-branch push or that the public project setting will persist over repository configuration. The public project currently uses **Automatic** Ignored Build Step, not the custom rule. If a live custom command fails to match (missing Git history, branch, environment, altered main), it returns nonzero and **permits a normal Production build**; therefore a no-deployment outcome is not guaranteed.

Before considering integration: obtain an explicit separate approval to temporarily change the **public** Vercel ignored-build setting, with exact existing value and one-shot rollback, along with the previously scoped PR #1042 merge. Race-check main/PR heads and current deployment/aliases immediately before mutation. Reverify the ignored command in the project UI, preserve existing required GitHub checks, then use only the reviewed four-file head. Inspect Vercel deployment events (CANCELED/IGNORED expected), confirm no new READY public deployment, restore the original Automatic setting, and check newly merged guard required-check behavior on another PR. Stop immediately on any mismatch; do not switch off branch protection, force push, alter Supabase ledgers or enter API keys.

These steps are **not** authorized merely by the successful isolated Preview tests. F1 source history isolation, F2 two distinct signed users and F3 deletion_pending privacy approval remain blocked.
