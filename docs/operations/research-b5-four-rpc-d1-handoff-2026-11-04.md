# Research #1103 — B5 four-RPC exact application contract, D1 isolated verification

2026-11-04. Draft child pinned to application #1123 at 259903e5fc73cc5404098e4249135518bac9b4eb. No changes to main, #1123 or B4.1 #1121. This changes review-only SQL, a synthetic PostgreSQL test harness, and one new read-only workflow. The workflow has read-only contents permission, uses existing D1-approved pinned PostgreSQL 16.15 image, no repository secrets and fake-only test credentials.

The SQL in docs/operations/research-b5-real-app-rpc-proposed-d1-review-2026-11-04.sql implements all four public RPC signatures exactly matching #1123:
1. issue_research_membership_checkout_intent: account-locked server-side, catalog-approved, 32 cryptographically random bytes encoded as 43 base64url chars; stores only SHA256, expiry max 30 minutes, refuses an existing checkout/subscription or complimentary Research access.
2. attach_research_membership_checkout_intent: atomically verifies issuance and proof before a provider checkout ID is saved; rejects repeated attachment or expiry.
3. observe_signed_research_subscription_created: D2 **simulated verifier** inserts private committed paid evidence keyed by provider subscription with exact signed SHA256; even no account claim/direct Share is observed without binding. Changed signed identity appends a conflict; no existing evidence overwrite.
4. bind_research_membership_with_checkout_intent: D2 **simulated binder** joins exact signed raw SHA, server-issued proof digest, account, store, variant and mode, attached provider checkout, expiry and unique account; only one pending subscription may be created, while the second paid transaction receives immutable conflict evidence. Binding never grants an entitlement.

Tests (real two independent PostgreSQL sessions) cover a concurrent T13 duplicate-paid binding, T21 complimentary Research, T22 Library Pass byte-identical invariance, expired/forged checkout, missing account direct Share, immutable paid journal, refunded replay and cross-role/public function denial. The isolated fixture uses relevant real table names/types/indexes; it deliberately DOES NOT replay all existing migrations, lifecycle triggers or receipt versions.

**Not deployable as-is:**
- SQL creates fake D1 login roles, catalog IDs and extension schema. It is intentionally under docs, NOT supabase/migrations.
- The current application uses one SUPABASE_SECRET_KEY for issuer, observer and binder, while this contract requires three separate trusted caller boundaries. D2 implementation, secret separation and exact Supabase PostgREST schema grants remain unresolved. Never solve it by broad service_role EXECUTE.
- A simulated verifier is not independent HMAC validation. The actual app verifies raw Lemon Squeezy HMAC and catalog; D2 must ensure no other server path can assert a paid event or bypass the account-issued checkout proof.
- A subscription_created event cannot prove provider checkout origin if no trusted reference is present. D4 provider reconciliation and D6 handling of orphan checkouts/paid-but-unbound remain required.
- In a binding transaction that later rolls back, the previously committed paid observation persists; conflict evidence committed inside the aborted bind does not. Real crash-recovery X3, X8 historical receipt versions, O1/O4 monotonic transitions, all Supabase RLS ownership and actual full-schema compatibility are NOT proved.
- No paid provider transactions, real user identities, merchant settings, Production/Development SQL, migrations, deployment, merge, refund or activation were performed.

**Release sequence:** exact-head CI; independent security/SQL review; D2 role+migration approval; full existing-schema two-session integration; D3/D4/D6/D7 owner decisions; separate rollout and rollback verification. Research #1103 stays P1 until then.
