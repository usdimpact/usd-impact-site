# Claude Manual Issue Review: one-shot identity-only check (Draft HOLD)

**Status:** Prepared for independent review. Not merged or dispatched. No paid model call. This is a new mode of the existing manual GitHub workflow. It does not modify the existing `preflight` or `model_review` implementation.

## What is being tested?

One `identity_check` workflow run gets a short-lived OIDC JWT from GitHub Actions and exchanges it once at the Anthropic `/v1/oauth/token` endpoint. If the rule matches, it validates the disposable access token response and immediately discards the token **without ever calling `/v1/messages`**. This establishes connectivity only, not permission to run Claude or execute tasks.

The first local Node 22 test suite has **18/18 PASS**. Tests are fully mocked: no GitHub, Claude or credential requests. The independent PR CI must run both the original 13 tests and these 18 new negative tests. A real exchange is NOT authorized by authoring or merging this PR.

## Verified IDs (not placeholders)

| Required repository variable | Exact verified value |
| --- | --- |
| `USD_IMPACT_CLAUDE_ISSUE_REVIEW_RULE_ID` | `fdrl_0155aihurC9hFwhp4qeVBv6m` |
| `USD_IMPACT_CLAUDE_ISSUE_REVIEW_SERVICE_ACCOUNT_ID` | `svac_01XaAxLMutnfzNuK5KCNwayu` |
| `USD_IMPACT_CLAUDE_ISSUE_REVIEW_ORGANIZATION_ID` | `dc187cb9-51e9-4059-a01f-1d2f5ea0b2b2` |

Optional `USD_IMPACT_CLAUDE_ISSUE_REVIEW_WORKSPACE_ID` may remain absent for the rule restricted to one workspace. The selected existing **USD Impact Automation** workspace corresponds to previously verified `wrkspc_013c8nMSXXPc8sVBvSKbtnFZ`. No login tokens, JWTs or static API keys should be pasted into issues, chat or GitHub variables.

## Owner approval gates and beginner steps

1. Review the separate [Draft PR](https://github.com/usdimpact/usd-impact-site/pulls) and its exact head. It must change only the manual workflow YAML, the offline QA YAML, this guide, and the two new identity-check source/test files. Verify required CI; **do not merge until separately approved**. A merge can initiate a Vercel Production rebuild.
2. Once separately approved and merged, open [GitHub Actions repository variables](https://github.com/usdimpact/usd-impact-site/settings/variables/actions). Confirm the three real ID values above. Keep `USD_IMPACT_CLAUDE_ISSUE_REVIEW_BILLING_READY` absent or `no`; keep legacy `USD_IMPACT_CLAUDE_ONE_SHOT_BILLING_READY=no`. Do not set `...ONE_SHOT_RUN_NUMBER` used for paid model calls.
3. Open [Manual Issue Review workflow](https://github.com/usdimpact/usd-impact-site/actions/workflows/usd-impact-claude-issue-review.yml). Before dispatch, confirm the **next unused run number**. It was **#2 at the read-only check on November 6, 2026**, but this must be checked again immediately before approval. A previous extra run changes the number. On the variables page, create `USD_IMPACT_CLAUDE_ISSUE_REVIEW_IDENTITY_CHECK_RUN_NUMBER` with ONLY that exact future run number and only after the owner authorizes the exchange. Leave the value unset otherwise.
4. After distinct owner authorization for a **single non-model authentication exchange**, use the GitHub **Run workflow** dropdown: branch `main`, `issue_number=1193`, `mode=identity_check`, `identity_check_confirmation=I_APPROVE_ONE_FREE_IDENTITY_EXCHANGE`. All model-review approval fields remain empty. Click **Run workflow once only**.
5. Check the job named `one-shot-identity-check` in the [Actions run](https://github.com/usdimpact/usd-impact-site/actions). Success must log `IDENTITY_EXCHANGE_PASS`, `MODEL_REQUESTS=0`, `TOKEN_DISCARDED=true`. No token or customer content may appear in logs. If any check fails, report HOLD and do not rerun.
6. Remove the identity-check run-number variable (or leave it pointing at the already consumed run number, which fails closed for future runs). Paid Claude use still requires a separate owner approval, a safe issue content review, a fresh digest, and the other `model_review` gates.

Codespaces is optional for independent offline tests: [open Codespaces](https://github.com/codespaces/new?hide_repo_select=true&repo=1265351071), choose the proposed PR branch and run:

```bash
node --check scripts/claude/manual-issue-identity-check.mjs
node --test scripts/claude/manual-issue-identity-check.test.mjs
```

## Hard security boundaries

- GitHub OIDC JWT issuer, audience, repository name and numeric IDs, exact workflow ref, branch, event, run attempt, Anthropic IDs, and single approved run number must all match. Any mismatch fails before token exchange.
- OIDC JWT decoding within GitHub is a local sanity check; **Anthropic performs signature/JWKS verification** at the exchange endpoint.
- `workspace:developer` is broader than inference-only, because the Claude Console wizard currently offered no narrower option. The rule stays isolated to the single service account, the precise manual workflow, and the selected workspace.
- The only outbound requests allowed by this code are GitHub's OIDC endpoint and Anthropic's token endpoint. It does not read customer data, create GitHub PRs, run models, deploy, email, publish or authorize autonomy.
- The currently merged Stage 1/2/3 code, Research P1, F2 Stage B, Score source rights, Issue #950 NO-GO, Daily publication, commerce/Library Pass and media/IP HOLD gates all remain untouched.

The one-shot identity exchange is designed to incur **zero model token charges**. Authentication traffic may still appear in service audit logs. A successful exchange does not authorize any paid API call.
