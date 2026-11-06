# Claude Stage 2: offline queue contract (DRAFT HOLD)

Status: **PREPARATION ONLY**. This proposal is not a task dispatcher, paid model integration, or authorization to change Production. Stage 1's exact successful manual WIF fixture and its exhausted one-shot guard are intentionally untouched.

## Purpose and hard boundaries

Provide a small, deterministic, **synthetic-only** classification contract that can later be used to evaluate an advisory model proposal without converting the proposal into an approval. The only positive category is `REVIEW_ONLY`, never `READY`, `APPROVED` or `EXECUTE`. There is no API request, token exchange, GitHub write, customer data, network I/O, file write, deployment, publication, or task execution path.

The separate `usd-impact-claude-stage2-offline.yml` workflow is `workflow_dispatch` only, on protected `main`, with repository identity check, `contents: read` and checkout credentials disabled. It runs local Node tests using built-in synthetic cases. The workflow cannot execute from a Draft PR and must not be merged without a separate exact-head approval; a merge may trigger automatic Vercel Production build even for workflow-only changes. No manual workflow dispatch is authorized by this PR.

## Synthetic input envelope v1

Exact fields (no others):

```json
{"schema_version":1,"task_id":"S2-A01","origin":"synthetic_fixture","operation":"isolated_draft_qa","scope":"offline_read_only"}
```

`schema_version` must be integer `1`. `task_id` must match `S2-[A-Z][0-9]{2}` **and correspond to one of the five exact fixture IDs with its canonical operation/scope**. Arbitrary valid-looking IDs and task-ID/operation swaps fail closed. `origin` must be `synthetic_fixture`. `operation` and `scope` are a fixed compatible pair. Unrecognized operations, mismatched scopes, malformed objects, accessors, extra fields, narratives, URLs, customer information and asserted approvals are rejected. The stage does **not** accept actual issue, email, spreadsheet, chat or customer task content.

| Operation | Required scope | Deterministic recommendation |
| --- | --- | --- |
| `isolated_draft_qa` | `offline_read_only` | `REVIEW_ONLY` |
| `research_production_merge` | `production` | `HOLD` |
| `score_unlicensed_publication` | `public_release` | `HOLD` |
| `external_customer_email` | `external_io` | `HOLD` |
| `daily_publication` | `production` | `HOLD` |

`REVIEW_ONLY` means an owner may inspect an isolated Draft QA *proposal*, not authorize execution. Even existing approved Daily publication remains outside this Stage 2 pathway.

## Output envelope v1

Every local result has exactly these fields: `schema_version`, `task_id`, `recommendation`, `reason_code`, `human_review_required: true` and `side_effects: "NONE"`. The only recommendations are `REVIEW_ONLY` and `HOLD`.

An optional untrusted model-shaped proposal may contain **only** `schema_version`, `task_id`, `recommendation`. It cannot override the deterministic gate or add tool instructions. An invalid or mismatched proposal becomes `HOLD`. A valid proposal for the one reviewable synthetic category remains advisory, with reason `ADVISORY_MATCH_ONLY`. This stage makes **no actual model request**.

## Offline QA acceptance

```bash
node --check scripts/claude/stage2-contract.mjs
node --test scripts/claude/stage2-contract.test.mjs
node scripts/claude/stage2-contract.mjs
```

Twelve offline test groups cover wrong fields, fabricated or swapped fixture identities, throwing hostile objects/proposals, symbol/nonenumerable extra fields, forged owner approval, injection in task identifiers, prototype/accessor inputs, customer data, unlicensed publication, Research Production merge, external sends, Daily publishing, proposal escalation, offline network guard and manual-only workflow permissions. The source is in `scripts/claude/` and has no third-party dependencies.

## Requirements before any next stage

1. Independent exact-commit review of schemas, authorization boundaries, workflow triggers, Actions permissions, CI negative test evidence, and overlapping repository work.
2. A distinct owner decision on whether a real read-only source is even needed; if approved, specify a narrowly scoped immutable provenance receipt, caller identity, data minimization and retention. A task's own text cannot assert an approval.
3. A separate reviewed implementation for real model inference, with explicit account credit/budget gate, exact-run limits, no retries, no access to untrusted private/customer/source-rights data, and explicit approval **before** each spend.
4. An independent human approval and verified hold disposition for any execution, write, merge, publication, message, merchant/Research change, rights usage, or Production action. A model recommendation is not an authorization source.
5. Preserve the active Research P1, Score rights, private F2 Stage B, Issue #950, Daily publication, media/IP, consumer-access and merchant/checkout safeguards. No self-approval or implicit release from a green CI result.

Canonical execution evidence for completed Stage 1: [GitHub run #42231300069](https://github.com/usdimpact/usd-impact-site/actions/runs/42231300069), merged PR #1174 at `85ce0ecd429fe7806c6ab9da632c258dcef17146`, and Vercel `dpl_HG8pnY2jfPFZjdeW7pEs4nVnsBFo` READY. After cleanup the repository variable `USD_IMPACT_CLAUDE_ONE_SHOT_BILLING_READY` was independently verified saved as `no`. This historical success does **not** grant Stage 2 deployment or new API authorization.

## Adversarial review checkpoint (2026-11-06)

The original Draft head `bb662b89` passed its nine original tests but an independent local adversarial check reproduced two uncovered failures: a held task ID could be paired with the synthetic Draft QA operation to obtain an advisory `REVIEW_ONLY` classification, and a throwing untrusted proposal object could escape as an exception instead of returning `HOLD`. The exact source was matched against GitHub blob SHA `6e558ed65606b7c50c7cea290642a9986df09791` before reproduction. The revision binds IDs to canonical fixture values, catches all proposal-inspection failures, and rejects symbols/nonenumerable extras. Added three negative test groups; Node 22 local `node --test` now passes **12/12**. Existing workflow and Stage 1 pilot are unchanged. This engineering adversarial review is not an independent third-party audit and does not grant Production/merge/model authorization.
