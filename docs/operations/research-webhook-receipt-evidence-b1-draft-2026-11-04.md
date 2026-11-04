# P1 Research Membership — B-1 receipt evidence Draft (2026-11-04)

**Canonical:** [Issue #1103](https://github.com/usdimpact/usd-impact-site/issues/1103). **Source:** Claude Assignment 29, independent checkout [Draft #1107](https://github.com/usdimpact/usd-impact-site/pull/1107) TECHNICAL PASS at `ce9ee3e9dcf2cb1a732181efd0d44d736762435e`. This B-1 branch was created from protected main `bb6fb9b5cd6212c6a4bbed3069c2cba6a5b17eea`, **not** stacked on #1107 or Stage A #1105.

## Scope, no activation

This Draft adds **opt-in** Research receipt begin/finish around the existing signed Research webhook flow, using the already-existing `public.webhook_receipts` and functions `begin_commerce_webhook_receipt(text,text,text,text)` / `finish_commerce_webhook_receipt(uuid,text,text)` under provider namespace `lemon-squeezy-research`.

New server-only flag: `RESEARCH_WEBHOOK_RECEIPTS_ENABLED`. **DEFAULT: OFF** unless exactly `true`. No flag value, key, runtime setting, migration, SQL, workflow, deployment or live customer record is changed in this Draft. Existing webhook behavior and checkout behavior remain identical while flag OFF. No real Lemon Squeezy or Supabase requests in synthetic CI.

**Reviewer warning:** Do **not** turn this feature on merely because CI passes. Existing `finish_commerce_webhook_receipt` writes status unconditionally; there is **no compare-and-swap protection** against two concurrent in-flight attempts finishing in opposite orders. Receipt begin serializes only the brief receipt RPC, not the whole business transition. Its `should_process=false` duplicate acknowledgment is trusted only after the existing SQL has marked it processed/ignored, not as a subscription-state proof. The flag requires a separate security/concurrency decision and independent QA; a second Subscription may still bill without access.

## How evidence is generated

1. Verify the exact raw provider HMAC signature, Research environment flag, canonical project, Test/Live mode, store, product/variant and event/object class before any receipt call. Do not persist unsigned or wrong-catalog events.
2. Derive a stable event ID from signed provider event name, data object type/ID, and provider object timestamp. Compute a sorted-key SHA-256 of the complete signed semantic payload excluding **only** the provider delivery-only `meta.webhook_id`, without storing body or personal information. Changed event/account/period fields remain hash-distinct and fail closed against an existing nonterminal receipt.
3. Call existing receipt begin with provider `lemon-squeezy-research`. On already `processed` or `ignored`, return duplicate without business mutation. On failure/ambiguous begin, do not process the subscription.
4. Run the existing Research webhook/first-binding flow unchanged. On genuine success mark `processed` or `ignored`.
5. If binding fails with exact trusted SQL message `Research Membership account already has a current subscription`, categorize `RESEARCH_DUPLICATE_PAID_SUBSCRIPTION` (no raw SQL text in receipt). If entitlement transition rejects the exact `Research Membership entitlement subscription mismatch`, categorize `RESEARCH_ENTITLEMENT_CONFLICT`. Other errors receive a generic allow-listed `RESEARCH_WEBHOOK_PROCESSING_FAILED` code. Mark receipt **failed** through separate committed RPC and propagate non-2xx. No PII, credentials, invoice body or buyer email is persisted in the last-error code.
6. A failed receipt finalization is itself a retryable 503. Do not respond 200 when a required receipt write could not be verified. No auto-refund, provider cancellation, new Research entitlement, migration, retry scheduler or recovery executor is added.

## Required independent test matrix

- First signed Research event and already processed duplicate; no repeated provider bind.
- Same signed logical event with changed delivery-only `meta.webhook_id` => same receipt hash. Changed paid-renewal data => different semantic hash.
- Untrusted signature and wrong store/product/mode rejected before any receipt.
- Duplicate paid second subscription and existing Research entitlement conflict => distinct **failed** categorical evidence, not successful acknowledgment.
- Receipt begin network outage/bad response => no subscription processing.
- Receipt finish failure after business transition => non-2xx; retry/replay safety must be independently challenged.
- Tests for both Preview and Production config are offline mock-only.
- **Not proved:** real 2-session PostgreSQL, CAS receipt updates, PostgREST role grants in Production, all provider delivery metadata variants, real idempotency of provider billing, complete operational refund/cancel workflow or a merchant public buy-link check.

## LIVE P1 limitations outside this Draft

- Two simultaneous hosted Research checkouts can charge twice; the second signed provider subscription is not bound. B-1 **records a failure only when it is delivered through the signed webhook**; it neither reserves checkouts nor prevents or reverses charges. The second provider subscription may continue renewing until owner-approved correction.
- An existing hosted checkout URL or a complimentary grant between checkout and payment can still cause charge-without-access.
- Merchant public Research buy-link configuration is unknown; owner D5 read-only dashboard check needed.
- The new code is **not** a durable, immutable conflict journal separate from the general mutable receipt state. Long-term remediation requires schema-level receipt event history or CAS, authoritative account/provider linkage, and a controlled refund/cancel runbook.
- Stage B ordering failure (stale subscription event after renewal), direct service-role UPDATE bypass and first provider watermark issues are untouched.

## Owner decisions and acceptance gates

D1: select isolated real PostgreSQL two-session test environment (secrets-free ephemeral GH Actions service container preferred, not created here).
D2: decide securely-scoped NOLOGIN writer SECURITY DEFINER approach vs reviewed equivalent (strict privileges, RLS/search_path/owner assertions).
D3: choose interim Research checkout stop for any prior entitlement, then safe relinking policy (PR #1107 stays Draft).
D4: defer provider API key access until separate read-only scope approval.
D5: manually verify in Lemon Squeezy dashboard that Research product's public buy link is disabled; do not change it during an inspection.

**No Production activation, branch merge, migration, service-role grant, real checkout, webhook replay, refund, provider lookup, email, scheduler or authorization is permitted.** Existing P0/P1, Daily, F2/Score/rights/publication HOLDS stay in force.
