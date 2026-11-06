# Claude Stage 3: signed read-only metadata provenance design (DRAFT HOLD)

**Status: preparation and offline tests only.** Stage 2's merged manual-only contract and successful run #42241931520 remain the baseline. Nothing in this document or PR enables a GitHub issue fetch, task intake, model call, agent, scheduler, grant, queue replay, repository write, publication or Production action.

## Proposed source and least-data boundary

The proposed first real *candidate source* is **GitHub issue metadata** for the single repository `usdimpact/usd-impact-site` (repository ID `1265351071`). A future separately approved read-only adapter, not present in this PR, would issue a short-lived receipt after fetching an issue via an authenticated GitHub REST `GET`, verifying it is an issue rather than a PR, and verifying exact repository ID. The adapter must **not** pass through issue title, body, author identity, comments, customer details, URLs, labels, attachments, free-form instructions or any model prompt. The only proposed source tuple is repository ID, issue number, unique issue ID and source `updated_at`; SHA-256 of the ordered tuple is for *integrity*, not authentication. No data is fetched today.

An approved future producer must use a dedicated **Ed25519 private signing key** under separate access controls; the consumer's public key is pinned independently in trusted deployment configuration, never supplied in the receipt. An Ed25519 signature covers a deterministic canonical representation of all receipt fields. No signing keys or live allowlist configuration are provisioned by this PR. Test keys are ephemeral and created inside the Node test process only.

## Receipt and consumer boundary

`stage3-provenance.mjs` is a pure verifier for the proposed exact schema. It expects `receipt = { payload, signature }` and *out-of-band* trusted context `{ public_key, now_ms, workflow_sha, run_id, nonce }`. Input receipts cannot assert their own signing key, clock, current workflow SHA, run ID, nonce or approval. All extra and hidden properties, unexpected types, wrong issuer/audience/repository/source, unknown identity, stale or future timestamps, signatures under other keys and cross-run replay attempts fail closed.

Required signed metadata: schema version, fixed audience/issuer/source type, repository ID/name, issue number and issue ID, source updated timestamp, minimal-source SHA-256, observed and expiry times, exact *proposed* workflow ref on protected main, checked-out workflow SHA, GitHub run ID, and a 128-bit run nonce. Maximum proposed validity: 5 minutes; observed time may be ahead of the trusted clock by at most 30 seconds. A valid receipt returns **`REVIEW_ONLY`**, `human_review_required: true`, `side_effects: "NONE"`; otherwise **`HOLD`** with no issue number. A receipt is not a grant of user consent or owner authorization.

The expected workflow ref is a **design target only**, not an existing enabled workflow. The verifier never reads GitHub, never uses `fetch`, never exchanges OIDC, never sends or receives secrets, and has no model or execution entrypoint.

## Crucial limitations and activation gates

1. **Cryptographic validity is not GitHub truth.** A signed receipt proves which configured key attested to minimal metadata. It does not independently prove the producer fetched the right live GitHub issue. Future adapter code must authenticate the provider, verify the response against fixed repository ID, reject PRs, and record provider provenance. The adapter must independently authenticate GitHub Actions OIDC signature/audience and exact workflow identity *before* it signs caller context; a `workflow_ref` string in a receipt is never sufficient.
2. **Freshness is not revocation.** `updated_at` and a five-minute expiry are a bounded snapshot, not immutable GitHub Issue history. Future code must re-fetch at the actual decision boundary and fail closed if the issue was edited, deleted, made private, or its identity changed. A durable, authorized nonce/receipt replay ledger would be required before any actual task orchestration; this prototype does not include one and cannot guarantee single-use within the same run.
3. **There is no trusted key configured.** The exported pure function requires its caller to inject the trusted public key, verified clock, expected workflow SHA, run ID and nonce. The production caller must source all of those from trusted runtime configuration/context, not input payload. Never promote a caller-provided key to authority. A valid offline test receipt is *not* a real issued credential.
4. **No task authority.** Neither the repository's issue content nor a signature from a read adapter may authorize a model call, paid usage, GitHub write, PR merge, deployment, message, customer-data processing, publishing, entitlement change or source-rights use. A separate authenticated **owner action bound to exact requested operation/head/limits** and an independent executable policy gate are mandatory before any future execution. This stage has no approved operations or execution handler.
5. **Explicit next decisions:** choose whether GitHub Issues is appropriate (vs another source), define verified principal identity and role mapping, trusted key custody and rotation, replay handling, privacy/data retention, provider API request rate/rights, exact-run budget, per-task approval UX, and a separate read-only adapter Draft PR. No autonomous polling or scheduled workflows. Current Stage 1 `USD_IMPACT_CLAUDE_ONE_SHOT_BILLING_READY=no` and all Research P1, Score rights, F2 Stage B, Issue #950, Daily publishing, merchant/Library Pass and media/IP holds remain unchanged.

## Local offline verification

```sh
node --check scripts/claude/stage3-provenance.mjs
node --test scripts/claude/stage3-provenance.test.mjs
```

Test cases use ephemeral Ed25519 keys and synthetic metadata; no Github/Anthropic connection, local file writes or credentials are needed. The runner cannot sign or verify real receipts without a separately trusted producer. Tests cover malformed source fields, forged/cross-repository metadata, altered issue IDs and digests, mismatched workflow SHA/run/nonce, stale/future timestamps, extra/hideable approval fields, attacker keys, hostile JavaScript objects and no-network evaluation.

**Merge or live activation of this prototype is NOT approved by Draft authoring.** A merge can trigger Vercel Production automatically. Require exact-head independent review, green required CI and separate owner approval; then separately approve any live adapter, key provision, model call, queue, notification, data fetch or execution.
