# Claude Manual Issue Review - beginner setup (DRAFT HOLD)

**Not active until this Draft PR has been reviewed and explicitly approved for merge.** The current pilot and Stage 2/3 files are unchanged. This workflow never creates PRs, edits code, sends emails, publishes news, or executes issue instructions. The optional model review generates *advice only*.

## Step A - approve and merge the Draft (owner decision required)

1. Open the GitHub [Draft PR](https://github.com/usdimpact/usd-impact-site/pulls), select **Claude Manual Issue Review**, and read **Files changed**. It should contain only this workflow, its offline QA workflow, one script, its test, and this guide.
2. Confirm all required GitHub checks, including **Claude Manual Issue Review - Offline Security Tests**, passed at the exact current commit. If main has moved, refresh the branch and require *new* checks.
3. Only after a separate explicit approval, mark the PR **Ready for review** and **Merge**. A merge may trigger an automatic Vercel Production build even though these are isolated workflow files. Verify the deployment and do not use Merge without that approval.

## Step B - first real GitHub issue read, no payment or Anthropic

1. Open [GitHub issues](https://github.com/usdimpact/usd-impact-site/issues) and choose a **public, non-sensitive**, non-Production issue. Do **not** use Research, Score, account deletion, F2, private data, media rights, billing, customer email, Daily publication, or Issue #950. For first use, create a small **synthetic accessibility QA** issue in [New issue](https://github.com/usdimpact/usd-impact-site/issues/new), containing no personal information or secrets. This is optional but recommended for testing.
2. For future model eligibility, a maintainer must add the repository label `claude-review-safe`. If it does not exist, a maintainer can create it under [Labels](https://github.com/usdimpact/usd-impact-site/labels). Label + explicit user approval are required; **a label alone is not an authorization**. For free preflight, the label is optional.
3. Open [Manual Issue Review in Actions](https://github.com/usdimpact/usd-impact-site/actions/workflows/usd-impact-claude-issue-review.yml), click **Run workflow**, select **main**, enter just the issue's number and keep **mode = preflight**. Leave all other inputs empty. Click **Run workflow** once.
4. Open the created run > **preflight** > **Summary** or log. Find `ISSUE_ID`, `SOURCE_DIGEST` (64 hexadecimal characters), and `ELIGIBLE_FOR_OWNER_REVIEW`. This read makes **zero Anthropic requests** and costs no model tokens. If ineligible, use another non-sensitive issue or remove held content; do not bypass the gate.
5. Do not paste issue bodies or any token into ChatGPT. Issue titles/bodies are not logged by the workflow.

## Step C - optional *one* real Claude review, only after fresh owner approval

**Do not perform this section until the owner separately approves a specific safe issue, one bounded paid Claude Haiku call, and the security-reviewed new workflow.** An existing Stage 1 pilot approval does *not* authorize this.

1. In [Claude Console - Workload identity](https://platform.claude.com/settings/workload-identity-federation), create or configure a distinct **GitHub Actions** federation rule. Pin the workload's issuer to `https://token.actions.githubusercontent.com`, repository to `usdimpact/usd-impact-site`, `sub` to `repo:usdimpact/usd-impact-site:ref:refs/heads/main`, and `workflow_ref` to `usdimpact/usd-impact-site/.github/workflows/usd-impact-claude-issue-review.yml@refs/heads/main`. Give the service account only the workspace privileges/rate limits required for one Messages API review. Do not broaden the existing Stage 1 pilot rule. See [official Claude WIF documentation](https://platform.claude.com/docs/en/manage-claude/workload-identity-federation).
2. In [GitHub repository Actions variables](https://github.com/usdimpact/usd-impact-site/settings/variables/actions), configure new **repository variables** (not secrets) for the new workflow: `USD_IMPACT_CLAUDE_ISSUE_REVIEW_RULE_ID` (the new `fdrl_...`), `USD_IMPACT_CLAUDE_ISSUE_REVIEW_ORGANIZATION_ID` (UUID), `USD_IMPACT_CLAUDE_ISSUE_REVIEW_SERVICE_ACCOUNT_ID` (`svac_...`), and optionally `USD_IMPACT_CLAUDE_ISSUE_REVIEW_WORKSPACE_ID` (`wrkspc_...`). Never enter or copy a token, API key, or JWT. Leave `USD_IMPACT_CLAUDE_ISSUE_REVIEW_BILLING_READY` at **no** until separate approval.
3. Inspect the latest [Manual Issue Review workflow runs](https://github.com/usdimpact/usd-impact-site/actions/workflows/usd-impact-claude-issue-review.yml) and identify the **next unused run number** for this workflow. The one-shot gate requires both `USD_IMPACT_CLAUDE_ISSUE_REVIEW_BILLING_READY=yes` and `USD_IMPACT_CLAUDE_ISSUE_REVIEW_ONE_SHOT_RUN_NUMBER=<next number>`. A rerun attempt is always blocked. If the next number is uncertain, leave billing set to `no`.
4. Independently re-open the selected public issue and inspect all content. The script excludes known held categories and email/secret patterns, but this filter is **not a complete privacy guarantee**. Confirm no personal, secret, licensed, or otherwise restricted information. Get the `ISSUE_ID` and digest from a **new preflight** after the last issue edit.
5. Run the workflow once more, mode **model_review**; enter the same issue number, `expected_issue_id`, `expected_source_digest`, and the exact confirmation text `I_APPROVE_ONE_CLAUDE_ISSUE_REVIEW`. It will verify the issue has not changed, the maintainer-controlled label is present, the exact run is approved, and new OIDC claims match before attempting **at most one** Haiku Messages API call. It never uses a persistent API key.
6. Inspect the **one-shot-model-review** job Summary: recommendation is only `REVIEW_ONLY` or `HOLD`, with reasons and token usage. **Neither result grants authority to perform the task.** Set `USD_IMPACT_CLAUDE_ISSUE_REVIEW_BILLING_READY` back to **no** and verify the saved value; do not retry or dispatch another paid run unless separately authorized.

## If you prefer Codespaces

Optional: go to [repository Codespaces](https://github.com/codespaces/new?hide_repo_select=true&repo=1265351071), use branch containing the Draft PR, open terminal, and run (no installs):

```bash
node --check scripts/claude/manual-issue-review.mjs
node --test scripts/claude/manual-issue-review.test.mjs
```

Codespaces is only for independent **offline** tests. Do **not** call the model from Codespaces or put Anthropic tokens/API keys into files or terminals. Use the protected manual GitHub Actions workflow for any separately approved model call.

## Safety boundaries

- GitHub workflow is `workflow_dispatch` only. The separate PR QA workflow runs tests automatically with `contents: read` and no secrets.
- Production and all Research P1, F2 Stage B, Score source rights, Issue #950, Daily publishing, Library Pass/merchant and media/IP restrictions remain unchanged.
- **The Stage 3 Ed25519 metadata-receipt verifier is not integrated here.** This first functional prototype relies on verified GitHub REST source identity, exact digest and two-phase human review. A cryptographic signed-receipt adapter with separate key custody, durable anti-replay, and source revalidation remains a future approval gate.
- The `claude-review-safe` label and simple blocklist are defense in depth, not a substitute for owner review. Only choose deliberately public, non-sensitive issues for the paid model test.
- If any validation fails, stop. Never bypass a HOLD status, repeat a paid call, or make an unauthorized merge.
