# Claude Manual Issue Review - owner-gated operational guide

**Current state, November 6, 2026:** Manual workflow and the corrective response validator in [PR #1196](https://github.com/usdimpact/usd-impact-site/pull/1196) are MERGED at `449bef469328b1907ae535f3888109a8354ca51c`; Vercel Production is READY. Paid run #3 failed after one Messages API request; no advisory was validated. Billing flags remain `no`. Model output has not yet passed a subsequent live test. This workflow is advisory only and cannot edit code, approve PRs, deploy, publish, email or execute issue instructions.

## Step A - verify the current installation (no new merge needed)

1. Open [merged PR #1196](https://github.com/usdimpact/usd-impact-site/pull/1196) and verify its merge commit `449bef469328b1907ae535f3888109a8354ca51c`. It changed three Claude script/test/documentation files; the manual workflow was installed earlier in [PR #1194](https://github.com/usdimpact/usd-impact-site/pull/1194).
2. Open the [Manual Issue Review workflow](https://github.com/usdimpact/usd-impact-site/actions/workflows/usd-impact-claude-issue-review.yml). Runs #1 and #2 succeeded; [owner-approved paid run #3](https://github.com/usdimpact/usd-impact-site/actions/runs/42275865424) failed response validation. **Run #4 was unused at the November 6 read-only inspection.** Recheck before any later manual action.
3. Check [GitHub repository Actions variables](https://github.com/usdimpact/usd-impact-site/settings/variables/actions): `USD_IMPACT_CLAUDE_ISSUE_REVIEW_BILLING_READY=no`, `USD_IMPACT_CLAUDE_ONE_SHOT_BILLING_READY=no`, old `USD_IMPACT_CLAUDE_ISSUE_REVIEW_ONE_SHOT_RUN_NUMBER=3` consumed, and `USD_IMPACT_CLAUDE_ISSUE_REVIEW_IDENTITY_CHECK_RUN_NUMBER` absent. Do not enable paid access without a separate owner approval.

## Step B - first real GitHub issue read, no payment or Anthropic

1. Open [GitHub issues](https://github.com/usdimpact/usd-impact-site/issues) and choose a **public, non-sensitive**, non-Production issue. Do **not** use Research, Score, account deletion, F2, private data, media rights, billing, customer email, Daily publication, or Issue #950. For first use, create a small **synthetic accessibility QA** issue in [New issue](https://github.com/usdimpact/usd-impact-site/issues/new), containing no personal information or secrets. This is optional but recommended for testing.
2. For future model eligibility, a maintainer must add the repository label `claude-review-safe`. If it does not exist, a maintainer can create it under [Labels](https://github.com/usdimpact/usd-impact-site/labels). Label + explicit user approval are required; **a label alone is not an authorization**. For free preflight, the label is optional.
3. For a separately owner-authorized FREE preflight, open [Manual Issue Review in Actions](https://github.com/usdimpact/usd-impact-site/actions/workflows/usd-impact-claude-issue-review.yml), click **Run workflow**, select `main`, enter `issue_number=1193` and set **mode = preflight**. Leave all other inputs empty; click **Run workflow** only once. Run #4 was unused at the November 6 audit but may change after new runs.
4. Open the created run > **preflight** > **Summary** or log. Find `ISSUE_ID`, `SOURCE_DIGEST` (64 hexadecimal characters), and `ELIGIBLE_FOR_OWNER_REVIEW`. This read makes **zero Anthropic requests** and costs no model tokens. If ineligible, use another non-sensitive issue or remove held content; do not bypass the gate.
5. Do not paste issue bodies or any token into ChatGPT. Issue titles/bodies are not logged by the workflow.

## Step C - optional *one* real Claude review, only after fresh owner approval

**Do not perform this section until the owner separately approves a specific safe issue, one bounded paid Claude Haiku call, and the security-reviewed new workflow.** An existing Stage 1 pilot approval does *not* authorize this.

1. The owner-specific WIF identity is already configured and succeeded in identity-only run #2. In [Claude Console](https://platform.claude.com/settings/workload-identity-federation), inspect the pinned rule `fdrl_0155aihurC9hFwhp4qeVBv6m`, service account `svac_01XaAxLMutnfzNuK5KCNwayu` and organization UUID `dc187cb9-51e9-4059-a01f-1d2f5ea0b2b2`. Do not recreate these, broaden permissions or approve the separate GitHub Claude App permission request.
2. In [GitHub repository Actions variables](https://github.com/usdimpact/usd-impact-site/settings/variables/actions), independently verify the saved existing `USD_IMPACT_CLAUDE_ISSUE_REVIEW_RULE_ID=fdrl_0155aihurC9hFwhp4qeVBv6m`, `USD_IMPACT_CLAUDE_ISSUE_REVIEW_SERVICE_ACCOUNT_ID=svac_01XaAxLMutnfzNuK5KCNwayu`, and `USD_IMPACT_CLAUDE_ISSUE_REVIEW_ORGANIZATION_ID=dc187cb9-51e9-4059-a01f-1d2f5ea0b2b2`. Optional workspace variable can be absent for the restricted rule. Never paste JWTs or API tokens. Leave billing at **no**.
3. **Only after a distinct new approval for a single paid call**, inspect the latest [Manual Issue Review workflow runs](https://github.com/usdimpact/usd-impact-site/actions/workflows/usd-impact-claude-issue-review.yml) and identify the **next unused run number**. Previously approved number `3` cannot be reused. The one-shot gate requires `USD_IMPACT_CLAUDE_ISSUE_REVIEW_BILLING_READY=yes`, a separately approved matching one-shot run-number variable, and attempt number 1. Reset billing to `no` immediately after the first attempt. A FREE preflight does not require enabling billing.
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

## November 6, 2026: run #3 failure and merged corrective release

The owner-approved paid review [run #3](https://github.com/usdimpact/usd-impact-site/actions/runs/42275865424) passed the pinned synthetic-issue preflight and made exactly one Messages API request, but exited with `CLAUDE_MODEL_RESPONSE_HOLD`. The old validator used that same code both for unexpected text-block cardinality and for invalid JSON. No raw response body was logged, so the precise cause is unproven. The request may have incurred a small charge; no automatic or manual retry is permitted.

Merged PR #1196 added the supported Anthropic `output_config.format` JSON schema for `claude-haiku-5-5` and a shorter advisory. The output cap remains **256 tokens**, thinking remains disabled, effort remains low, and the request is still **exactly one Messages API call with no tools**. Local schema/length limits and the existing source, owner, OIDC, billing and exact-run safeguards remain enforced. The API schema uses only supported fields: `type`, `properties`, `enum`, `items`, `required`, `additionalProperties:false` and `description`; length/array limits remain enforced in local validation.

Safe diagnostics now emit only an allowlisted stop reason, counts of content/text blocks, and bounded numeric token usage. They never log response text, GitHub issue content, JWTs or tokens. Distinct fail-closed reasons cover `max_tokens` truncation, refusals, abnormal stops, content-block anomalies, invalid JSON, invalid schema and invalid usage. No retry, fallback model or output repair is added.

References: [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs); [stop reasons](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons); [Haiku 5.5 migration](https://platform.claude.com/docs/en/models/haiku-5-5/migration-guide).

**Current owner-gate status:** `USD_IMPACT_CLAUDE_ISSUE_REVIEW_BILLING_READY=no`, original pilot billing `no`, previous paid run #3 consumed. This correction is merged and offline-tested; **a successful live model response is still unproven**. Recomputing the current synthetic issue #1193 content on November 6 yielded ID `6246887373` and source digest `5bc9f9792c676d5298627d25af9894f2a166f9a430bc0de2e5d571d4fbe8bb73`. For future paid review, use a new free workflow preflight and new distinct owner approval. Preserve Research P1, F2 Stage B, Score rights, Issue #950 NO-GO, Daily, Library Pass/commerce and media/IP holds.
