# Daily PR-author GitHub App — approval and acceptance gate (November 5, 2026)

**Status:** DRAFT ONLY / NO MERGE / NO PRODUCTION ACTIVATION. GitHub App credentials were configured by the owner outside this Draft and successfully validated in an isolated nonpublishing run; no secret value was exposed.

**Incident:** [#840](https://github.com/usdimpact/usd-impact-site/issues/840). **Publication tracker:** [#1129](https://github.com/usdimpact/usd-impact-site/issues/1129). Separate closed manual-late [PR #1160](https://github.com/usdimpact/usd-impact-site/pull/1160) delivered the November 5 edition; it is **not** proof of unattended publication.

## Observed cause

On November 5 the native/backstop Daily generator opened original PR [#1156](https://github.com/usdimpact/usd-impact-site/pull/1156) from the default GitHub Actions token, exact head `152af17522d388c0e8f1fce030271466ea014afb`. Three check jobs completed successfully at that head, but all were in `workflow_dispatch` workflow runs. Native `pull_request` runs for the same three workflows were `action_required`, with no accepted job results. The bounded publisher refused GitHub's `mergeable_state=blocked` and held `pre-merge-main-or-pr-changed`. The active [Protect main ruleset #19557112](https://github.com/usdimpact/usd-impact-site/rules/19557112) requires these exact GitHub Actions check contexts (strict/up-to-date):

- `validate-and-build`
- `Dependency review`
- `Reject Development-only Production migration files`

**CodeQL also runs on normal PRs, but is not one of the three ruleset-required contexts.** Do not confuse its `action_required` run with the root cause.

GitHub explains that Actions job checks from `workflow_dispatch` cannot satisfy required PR status checks, even when they report success for the exact head: [Troubleshooting required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks#checks-from-some-workflow-jobs-are-not-evaluated). Legitimate `pull_request` runs must be allowed to complete.

## Scope of this isolated candidate

Only the existing Daily generator workflow and two offline policy/action-runtime test suites are modified, plus this review document. The GitHub Action allowlist accepts the pinned App-token action only inside `daily-news.yml` (with negative tests for other workflows). The candidate does **not** change the publisher's security checks, rule #19557112, source rights, schedule, code that spends on source generation, Preview/Production deployment settings, webhook permissions, account access, or any unmerged PR.

Proposed generator behavior if this Draft is separately approved and merged *after* an App has been provisioned:

1. Before paid generation, require the existing newsfeed credentials **and** configured `DAILY_NEWS_PR_APP_CLIENT_ID` (repository variable) and `DAILY_NEWS_PR_APP_PRIVATE_KEY` (repository secret). If missing, skip generation; do not fall back to the default Actions-token PR-author path.
2. **Before any paid news generation**, mint a restricted App installation token to prove that the key, client ID, installation and requested repo-scoped permissions really work; if this fails, stop without starting background generation. Do not use this token for publishing.
3. Generate, import and preflight the single current-date Daily exactly as before; continue the original run, branch and one-file identity constraints.
4. Immediately before PR creation, mint a **fresh** GitHub App installation token using [`actions/create-github-app-token`](https://github.com/actions/create-github-app-token) pinned to reviewed v3.3.0 commit `64ab729a6294000f5aa4a4bc0b73d1f32bc45510`. Scope it to **this repository only** by omitting `owner` and `repositories` and selecting **Contents: read, Pull requests: write**. The action automatically revokes the token at job completion; it lasts at most one hour.
5. Keep the default `GITHUB_TOKEN` for the existing branch push, GitHub read calls, Web Quality dispatch and trusted publisher dispatch; substitute the short-lived App token **only** around `gh pr create`. If the App token is empty or token creation fails, **HOLD**; never silently fall back.
6. When the App creates the PR event, native eligible `pull_request` jobs should start for all three ruleset-required workflows. Treat raw SHA successes from the old `workflow_dispatch` as **supplemental only**. The bounded publisher must still see `mergeable_state=clean` from GitHub and unchanged SHA/base before doing a normal protected squash merge.
7. Preserve the 08:30 America/New_York stop, one paid-generation budget/retry policy, source-run actor and attempt checks, unchanged source ownership, original PR protection, READY Preview, and same-SHA Production + four independent live outputs.

## Beginner setup steps — must be completed by the owner in GitHub

The repository owner is **`usdimpact` (a personal GitHub account, not an organization)**. The GitHub connector used for this review cannot register GitHub Apps or set encrypted repository secrets; these are genuine owner-side operations. **Nothing below automatically activates the Draft.** Never send the private key in ChatGPT, a GitHub PR, issue, email, screenshot or shared file.

1. **Sign in as the `usdimpact` account.** Open [GitHub App registration](https://github.com/settings/apps/new) (or profile photo → **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**). Ensure the App owner shown is `usdimpact`, not another signed-in personal account.
2. Under **GitHub App name**, use a descriptive unique name, for example `usd-impact-daily-pr-author`. Under **Homepage URL**, use `https://github.com/usdimpact/usd-impact-site`. Leave OAuth **Callback URL**, **Setup URL** and **Device Flow** unused. Do **not** request user authorization on installation.
3. Under **Webhook**, turn off **Active**; no webhook endpoint is needed. Under **Repository permissions**, set **Contents → Read-only** and **Pull requests → Read & write**. Leave other permissions **No access** (except GitHub's automatically granted Metadata read). Do not grant Administration, Actions write, Workflows, Secrets, Webhooks or organization permissions. Under **Where can this GitHub App be installed?**, choose **Only on this account**. Select **Create GitHub App**.
4. On the new App's **General/Credentials** settings, locate the **Client ID** (it is **not** the numeric App ID). Copy this nonsecret ID for the repository variable. Under **Credentials → Key pairs**, choose **New key**. GitHub downloads a **.pem** file containing the private key. Keep it local and private. Do not upload the file to the repository.
5. Open your App settings → **Install App** → **Install** beside `usdimpact` → select **Only select repositories** → pick **usd-impact-site** → **Install**. Confirm only this repository was selected.
6. Open the repository's [Actions variables and secrets page](https://github.com/usdimpact/usd-impact-site/settings/secrets/actions). On **Variables** → **New repository variable**, create name **`DAILY_NEWS_PR_APP_CLIENT_ID`**, value = the App's exact **Client ID**. Save.
7. On the same page, choose **Secrets** → **New repository secret**, create name **`DAILY_NEWS_PR_APP_PRIVATE_KEY`**. Open the downloaded .pem in a local plain-text editor; paste **the entire multiline key, including its BEGIN/END lines**, into the secret value. Save, close the file and safeguard the original locally. **Do not paste its contents into chat.**
8. Check the GitHub App's **Permissions** and installed repositories again; verify that they match step 3 and step 5. Only then report **"GitHub App installed; repository variable and secret configured"**; give no credential values. The Draft still needs independent install/scope verification, no-publisher live PR-event proof and owner approval before merging.

Official references: [register an App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app), [install an App](https://docs.github.com/en/apps/using-github-apps/installing-your-own-github-app), [private keys](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps), [Actions repository secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets), [Actions repository variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables).

### Setup has not activated Production

The current live `main` still uses the old bot-token generator. If the Draft is not reviewed and merged before the next native Daily, do **not** claim automation is fixed. A real App test must never dispatch the paid generator manually or use the published November 5 content as a fresh source; use a separately authorized nonpublisher proof of legitimate `pull_request` events. The final rollout must remain a new exact-head protected-merge decision.

## Completed independent nonpublishing GitHub App acceptance proof — PASS

**Date:** November 5, 2026. **Status:** VERIFIED_GITHUB_APP_EVENT / DRAFT ONLY / NO PRODUCTION CHANGE.

### Evidence chain (exact commits, genuine native events)

1. Owner installed GitHub App `usd-impact-daily-pr-author` on account `usdimpact` for **only** repository `usdimpact/usd-impact-site`, with **Contents read** and **Pull requests write** (plus implicit Metadata read). Owner configured repository Actions variable `DAILY_NEWS_PR_APP_CLIENT_ID` and encrypted secret `DAILY_NEWS_PR_APP_PRIVATE_KEY`. Secret contents were **never read** through the connector.
2. A first **isolated** manual verification run [#42084751238](https://github.com/usdimpact/usd-impact-site/actions/runs/42084751238) failed closed with `Invalid keyData`, proving malformed PEM blocks token issuance. The ordinary `build-and-publish` news-generator job was **SKIPPED**. Owner replaced the private-key secret using a proper GitHub App PEM key; no key was shared.
3. One new manual verification run [#42085754013](https://github.com/usdimpact/usd-impact-site/actions/runs/42085754013), original first attempt on the exact isolated Draft branch `fix/daily-pr-app-author-draft-20261105` (source HEAD `7daddb323bf0ea6f00bf5f5549da4663e1509aa5`), completed **SUCCESS**. Source generator job `build-and-publish`: **SKIPPED**. Isolated `app-pr-event-smoke`: **SUCCESS**, including GitHub App token issuance and verification of GitHub bot author and exactly one harmless docs-only file.
4. The App-authored [test Draft PR #1165](https://github.com/usdimpact/usd-impact-site/pull/1165), exact head `c838903deb0e1fa2c2b5c9c03abb34d382c91a00`, had author `usd-impact-daily-pr-author[bot]`, source branch `verification/daily-pr-app-event-42085754013`, base protected main `f9abf41cddf5cf5b878fcbe035942ef8a8dcf8dd`, `ahead_by=1`, `behind_by=0` and **one added Markdown file** `docs/operations/daily-pr-app-event-smoke-42085754013.md`. No file under `apps/web/src/content/news` was created.
5. **All four genuine `pull_request` event workflows SUCCESS at exactly the inert PR head**, with actor `usd-impact-daily-pr-author[bot]`: Web Quality [#42085803239](https://github.com/usdimpact/usd-impact-site/actions/runs/42085803239), Dependency Review [#42085803462](https://github.com/usdimpact/usd-impact-site/actions/runs/42085803462), Production migration guard [#42085803255](https://github.com/usdimpact/usd-impact-site/actions/runs/42085803255), and CodeQL [#42085803590](https://github.com/usdimpact/usd-impact-site/actions/runs/42085803590). The first three are exactly those required by protected ruleset #19557112; they were **native PR-event** runs, not ineligible supplemental `workflow_dispatch` runs.
6. Evidence PR #1165 was **CLOSED WITHOUT MERGE** after gathering the checks. The temporary `app-pr-event-smoke` job, exact-Draft generator branch exclusion and their temporary test fixtures were then **removed** from the four-file implementation Draft. The permanent no-spend credential/installation preflight, short-lived PR-only token and original trusted source/publisher gates remain. GitHub protected `main` and the November 5 Production edition did not change.

### What this proof establishes — and what it does not

**PASS:** Valid real GitHub App credential/private key; repo-only App installation-token issuance; safe App-authored PR creation; native GitHub `pull_request` events run the three protected required checks and separate CodeQL; these checks completed SUCCESS for an inert fixture; no paid generation or Production changes.

**NOT YET PROVEN:** An original naturally scheduled morning generator, publication-source accuracy, the normal auto-publisher finishing before the 08:30 America/New_York cutoff, the `mergeable_state=clean` guard on an actual *non-draft* generated Daily PR, protected squash merge, matching READY Production deploy and four independent live outputs. The smoke PR remained Draft by design, so it was **not** used to prove its mergeability.

**Remaining release gate:** complete exact-head CI on the smoke-free four-file Draft, independently review its permissions and source/paid-generation guard, obtain a separate exact-version owner approval before protected merge, and monitor the first naturally eligible weekday end-to-end. Until then [incident #840](https://github.com/usdimpact/usd-impact-site/issues/840) remains OPEN. Do not manually dispatch the paid generator for the sake of testing.

## Owner-only App provisioning (completed by the owner outside this Draft; retained as an audit runbook)

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
