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

## Temporary nonpublishing App-token / PR-event acceptance proof — Draft only

**Status:** Owner authorized an isolated test after confirming the repository App variable and encrypted secret are configured. **No smoke run has been dispatched at this point.** The new App action will prove actual access or fail before any PR is created. The smoke job is **temporary** and must be removed from Draft #1163 before any Production merge.

The existing workflow `.github/workflows/daily-news.yml` is already registered on default `main` with `workflow_dispatch`, and GitHub supports choosing another branch in **Run workflow**. The Draft adds a **branch-specific** `app-pr-event-smoke` job with the following hard checks:

- It runs only on an original, first-attempt **manual `workflow_dispatch`** from exact ref `refs/heads/fix/daily-pr-app-author-draft-20261105`; any other ref/replay/schedule fails the job condition. The existing `build-and-publish` generator job is explicitly **skipped** on this Draft ref. Therefore no source endpoint, paid request, import, public Daily, trusted publisher or production merge can run from the test branch.
- The smoke first verifies event/ref/repository/attempt, then uses the pinned App-token action with **Contents read** and **Pull requests write**, scoped to `usdimpact/usd-impact-site`, with automatic token revocation. The private key never goes to the shell or job output.
- Using the ordinary default `GITHUB_TOKEN` **only for contents writes**, it creates a unique branch from current protected main with exactly **one inert Markdown documentation fixture**. It verifies the compare is exactly one added file and no other changes.
- It uses the short-lived **App token only for `gh pr create --draft`**, creating one explicitly named `TEST ONLY` Draft PR. It reads back PR identity and fails if the author is not `usd-impact-daily-pr-author[bot]`, if the base is not main, or if the file branch differs. It **does not merge, close, auto-approve, publish or enable auto-merge**. An external reviewer must inspect the native `pull_request` run event for the three required checks.

### Mandatory beginner action — no credentials and no local installs

1. Confirm [Draft PR #1163](https://github.com/usdimpact/usd-impact-site/pull/1163) still shows **Draft / unmerged**, with current technical CI green. Do not press Merge.
2. Open [Actions → Daily USD Impact publication](https://github.com/usdimpact/usd-impact-site/actions/workflows/daily-news.yml).
3. Click **Run workflow** and choose **`fix/daily-pr-app-author-draft-20261105`** in the **Use workflow from / Branch** dropdown. **Do not leave the selection on `main`**. This distinction is mandatory: manually dispatching `main` is a *different*, potentially paid workflow.
4. Click **Run workflow** once. Do not rerun failed jobs or manually dispatch a second copy; keep the one-test budget.
5. Open the new run. It must show **`build-and-publish` SKIPPED** and **`app-pr-event-smoke` SUCCESS**. If either differs, stop and report the run URL; do not retry.
6. The successful log summary gives the newly created **TEST ONLY** Draft PR URL. Send only that PR link and the Actions run URL (no credentials, screenshots of key values or private contents). The reviewer will inspect author attribution and eligible native `pull_request` checks.
7. The evidence PR must **never be merged**. After independent acceptance it will be closed, then the temporary smoke job and generator-branch guard will be **removed from #1163**, with exact-head CI repeated. Only the separately owner-approved production PR-author change can later be merged.

GitHub official guidance: [Manually run workflow, selecting a branch](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow); [GitHub App tokens enable eligible workflow triggers](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

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
