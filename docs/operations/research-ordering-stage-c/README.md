# Research O1/O4 — Stage C: real-schema ordering and provider-snapshot design (REVIEW-ONLY)

**Date:** 2026-11-05. **Status:** Draft-only, unmerged, uninstalled, NOT a P1 remediation or release authorization. Stacked on Stage B Draft PR #1134, which is stacked on inert Stage A PR #1105. No B-5 PR #1124/#1128 changes.

## What the review artifacts do

- `provider_snapshot_review.mjs`: An inert, unimported client-side *review utility* using an injected fetch. Validates GET `/v1/subscriptions/:id` payload type, provider subscription ID, bound store/customer/product/variant/test mode, microsecond UTC event ordering, provider status and paid horizon. It never issues a network call in tests, never stores or logs a credential, and **always** returns `canMutate:false`. It cannot prove USD Impact account ownership or payment settlement from the provider GET alone.
- `test_provider_snapshot_review.mjs`: synthetic positive/negative tests; no provider network, no customer data, no real API key.
- `real_schema_ordering_review.sql`: A **review-only** private `research_ordering_stage_c` schema with a watermark and immutable audit linked by foreign keys to the **actual historical `public.subscriptions` and `public.entitlements`**. A private SQL function updates real-schema rows only inside a disposable test database; it is **not** a deployable migration and is not in the Supabase migration directory. It uses review-only synthetic provider-custody metadata and a mock `p_snapshot_verified` boolean. Those placeholders are not trustworthy authorities in Production.
- `test_real_schema_ordering.py`: Boots the six historical Research migrations from repository source, authenticates only to a loopback PostgreSQL 17.6 service with disposable credentials, seeds synthetic accounts/entitlements, checks RLS and direct-write risk, and tests O1/O4/equal-time, invoice ambiguity, absent provider watermark, purchase-backed Library Pass invariants, old-vs-new under `FOR UPDATE`, conflicting duplicate, binding mismatch, immutable audit, and same-key two-session idempotence. There is NO real Supabase connection.

## Provider docs and actual authority boundary

Lemon Squeezy returns current subscription state at `GET https://api.lemonsqueezy.com/v1/subscriptions/:id`, including `updated_at`, store/customer/product/variant/test mode/status and renewal/expiry dates. Subscription-object and invoice-object timestamps are **not globally comparable**. A GET response **does not authenticate the customer's USD Impact account**, prove a signed webhook was received, verify cleared settlement, or rule out a newer provider state between the GET and database commit.

Docs: https://docs.lemonsqueezy.com/api/subscriptions/retrieve-subscription ; https://docs.lemonsqueezy.com/help/webhooks/event-types ; https://docs.lemonsqueezy.com/api/subscriptions/the-subscription-object

This review requires future trusted runtime custody of provider API credentials and an **authenticated, non-client-supplied evidence grant** tying webhook raw-body signature, provider customer/subscription identity, USD Impact account, store/product/variant/test mode, paid-invoice scope, and current provider version to the exact database transaction. A caller-controlled `verified_current_snapshot` boolean is expressly **forbidden as a Production authorization claim**. A delay between GET and commit must be handled by a versioned/rechecked state authority, not optimistic assumption.

## Hard blockers before Stage D release-candidate

1. **Live legacy bypass:** Existing `public.apply_research_membership_transition` (16-arg, `SECURITY INVOKER`) lacks order watermark. `service_role` still directly UPDATEs `public.subscriptions` and `public.entitlements`, bypassing any new function. A safe migration-first cutover must prevent those paths **without disrupting existing webhook deliveries**, and must be coordinated with a restricted hosted caller role. Revocation and credentials require separate owner approval.
2. **No first-purchase trusted watermark:** `public.bind_research_membership_subscription` creates pending rows without accepted provider-object order proof. Backfill must be based on independently authenticated, signed subscription evidence, not `updated_at` guesswork.
3. **Durable audit and webhook replay:** Ignored/pending rows must be unique, immutable, and safely distinguished from successfully applied state transitions. Existing replay verification understands applied rows only. Provider message handling must not ACK unprocessed events as paid.
4. **Authority and proof:** Provider GET validates one snapshot but not a durable signed account/settlement witness; provider invoice refund and renewal clocks are incomparable. Terminal refund, paid-unbound, disputes, recovery and cancellation need evidence-specific tests and policy.
5. **Schema parity:** Production/Development Research migration history and RLS/index details differ. This suite replays the **original committed migrations**, not a claim that either connected project exactly matches its schema.
6. **Integrated release acceptance:** Actual webhook JS and SQL with two true database sessions, fail-closed old-RPC and direct-write access probes, source-to-live diff, independent reviewer, one exact main-targeted CI SHA, Development approval then separate Production owner authorization remain outstanding.

## Fail-closed boundaries

No files are placed under `supabase/migrations`. No live code imports the proposed provider validator. The PostgreSQL runner rejects remote database/provider environment variables, binds `PGHOST=127.0.0.1` and uses exact PostgreSQL 17.6. Only synthetic accounts and one-time purchase records are generated. The historical `service_role` direct-write grant is **asserted as an unresolved defect**, not silently described as fixed. Nothing in this Draft permits a merchant action, checkout pause, deployed change or customer entitlement mutation.

## Exact-head security negative added after initial acceptance

At the later Stage C review head, the fixture models the historical Supabase `service_role` with `BYPASSRLS`. It demonstrates that the legacy 16-parameter RPC **can** apply an older payment failure after a newer renewal, shortening a synthetic paid period and suspending a synthetic entitlement; a direct entitlement UPDATE also succeeds. All such writes are performed in a disposable transaction that is explicitly **rolled back**, and the original synthetic rows are compared afterward. This documents a **still-open P1 bypass**, not a remediation. See `STAGE_D_RELEASE_DESIGN.md` for the required coordinated old-RPC/direct-write cutover, authenticated provider evidence and rollback plan.
