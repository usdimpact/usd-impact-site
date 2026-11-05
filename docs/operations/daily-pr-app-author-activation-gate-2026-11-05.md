# Daily PR-author GitHub App — approval and acceptance gate (November 5, 2026)

**Status:** DRAFT ONLY / NO MERGE / NO CREDENTIAL / NO PRODUCTION ACTIVATION.

**Incident:** [#840](https://github.com/usdimpact/usd-impact-site/issues/840). **Publication tracker:** [#1129](https://github.com/usdimpact/usd-impact-site/issues/1129). Separate closed manual-late [PR #1160](https://github.com/usdimpact/usd-impact-site/pull/1160) delivered the November 5 edition; it is **not** proof of unattended publication.

## Observed cause

On November 5 the native/backstop Daily generator opened original PR [#1156](https://github.com/usdimpact/usd-impact-site/pull/1156) from the default GitHub Actions token, exact head `152af17522d388c0e8f1fce030271466ea014afb`. Three check jobs completed successfully at that head, but all were in `workflow_dispatch` workflow runs. Native `pull_request` runs for the same three workflows were `action_required`, with no accepted job results. The bounded publisher refused GitHub's `mergeable_state=blocked` and held `pre-merge-main-or-pr-changed`. The active [Protect main ruleset #19557112](https://github.com/usdimpact/usd-impact-site/rules/19557112) requires these exact GitHub Actions check contexts (strict/up-to-date):

- `validate-and-build`
- `Dependency review`
- `Reject Development-only Production migration files`

**CodeQL also runs on normal PRs, but is not one of the three ruleset-required contexts.** Do not confuse its `action_required` run with the root cause.

GitHub explains that Actions job checks from `workflow_dispatch` cannot satisfy required PR status checks, even when they report success for the exact head: [Troubleshooting required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks#checks-from-some-workflow-jobs-are-not-evaluated). Legitimate `pull_request` runs must be allowed to complete.

## Scope of this isolated candidate

Only the existing Daily generator workflow and its offline policy-contract tests are modified, plus this review document. The candidate does **not** change the publisher's security checks, rule #19557112, source rights, schedule, code that spends on source generation, Preview/Production deployment settings, webhook permissions, account access, or any unmerged PR.

Proposed generator behavior if this Draft is separately approved and merged *after* an App has been provisioned:

1. Before paid generation, require the existing newsfeed credentials **and** configured `DAILY_NEWS_PR_APP_CLIENT_ID` (repository variable) and `DAILY_NEWS_PR_APP_PRIVATE_KEY` (repository secret). If missing, skip generation; do not fall back to the default Actions-token PR-author path.
2. Generate, import and preflight the single current-date Daily exactly as before; continue the original run, branch and one-file identity constraints.
3. Immediately before PR creation, mint a GitHub App installation token using [`actions/create-github-app-token`](https://github.com/actions/create-github-app-token) pinned to reviewed v3.3.0 commit `64ab729a6294000f5aa4a4bc0b73d1f32bc45510`. Scope it to **this repository only** by omitting `owner` and `repositories` and selecting **Contents: read, Pull requests: write**. The action automatically revokes the token at job completion; it lasts at most one hour.
4. Keep the default `GITHUB_TOKEN` for the existing branch push, GitHub read calls, Web Quality dispatch and trusted publisher dispatch; substitute the short-lived App token **only** around `gh pr create`. If the App token is empty or token creation fails, **HOLD**; never silently fall back.
5. When the App creates the PR event, native eligible `pull_request` jobs should start for all three ruleset-required workflows. Treat raw SHA successes from the old `workflow_dispatch` as **supplemental only**. The bounded publisher must still see `mergeable_state=clean` from GitHub and unchanged SHA/base before doing a normal protected squash merge.
6. Preserve the 08:30 America/New_York stop, one paid-generation budget/retry policy, source-run actor and attempt checks, unchanged source ownership, original PR protection, READY Preview, and same-SHA Production + four independent live outputs.

## Owner-only provisioning (NOT performed by this Draft)

- Review the App's name, owner, installation/repository allowlist, consent and rights. The App must be installed only on `usdimpact/usd-impact-site`, with repository **Contents read** and **Pull requests write** and no administrative or Actions write/other privileges. GitHub App has required metadata read implicitly.
- Put its **client ID** in the repository variable `DAILY_NEWS_PR_APP_CLIENT_ID` and its **private key** in the encrypted repository secret `DAILY_NEWS_PR_APP_PRIVATE_KEY` through approved GitHub settings; never paste keys into a chat, commit, issue or action log. Avoid persistent personal access tokens.
- Test the App installation and scoped short-lived token against a safe nonpublisher branch/PR fixture before any production activation or any scheduled paid generation. This cannot be done by synthetic tests alone. Verify `pull_request` triggers create eligible check runs and distinguish App event actor from the original bot source-workflow actor.
- Review Actions access, token scope/revocation, handling of missing/invalid credentials, source publisher timing, and the manually triggered generator path. Do not merge solely because the static/CI tests are green.
- Grant a **separate exact-HEAD owner approval** to merge this PR and enable the next natural weekday trial. There is no approval here to create credentials, weaken main, disable branch protections, force a merge, or spend on a test generator.

## Negative test and acceptance inventory

The existing `test-daily-news-auto-publish-workflow.mjs` receives synthetic tests for: missing App client ID; missing App private key; missing newsfeed token; already-published edition; complete fictional environment; no key-value leakage; pinned action SHA; repo-only token scope; exactly one `gh pr create` using the App token; ordinary Actions token remains for workflow dispatch. Original actor, rerun, source, SHA, cutoff and forged-dispatch fixtures remain intact.

Before declaring #840 fixed, capture a new genuine weekday **natural** run: preflight `404` confirmed for the correct date; one eligible generator, one original bot source, App-authored PR, distinct `pull_request`-event check runs with all three **SUCCESS**; protected `mergeable_state=clean`; exact head protected squash; matching Vercel Production `READY`; dated article, latest index, JSON and RSS containing that date. If any gate fails, report **AUTO_HOLD** and leave #840 OPEN. A manually published late editorial recovery never counts as zero-touch acceptance.

## Coordination

Do not modify historical bot PR #1156 or force publication of its pre-release article after the calendar cutoff. Do not merge or rebase active Research, Score, Monthly, Storage #950, Portuguese, access or commerce Drafts. This proposal is limited to the Daily **PR creation identity**, not an independent product release.
