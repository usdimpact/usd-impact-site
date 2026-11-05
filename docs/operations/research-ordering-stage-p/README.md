# Stage P — N-5/6, N-P, N-T, N-D: stricter synthetic first-activation evidence

**DRAFT / DISPOSABLE POSTGRESQL 17.6 ONLY / RESEARCH LIVE P1 AND B-5 NO-GO.** This is not a deployable SQL migration, webhook handler, issuer signing proof, or merchant settlement authority.

Parent: [Stage O Draft #1151](https://github.com/usdimpact/usd-impact-site/pull/1151) at exact `8200cef8308edff563158e766bfdedce5e4dc179`, unchanged. Stage O's guards-first B-5 binder N-X0 test and Stage N's original pinned B-5 M1 SQL remain untouched.

This child adds a test-only SQL overlay, a fresh PG17 test and a scoped 10-job review workflow. No app imports, credentials, live Supabase SQL, checkout/merchant/payments/refunds, Library Pass, customer subscription/entitlement, merge or deployment.

## Review contracts

**N-5 / N-6 consumed checkout ordering.** Require `created_at <= consumed_at <= expires_at` **and** signed `paid.occurred_at <= consumed_at` for the persisted B-5 checkout. The pinned M1 strict table permits malformed `consumed_at` independent of its other CHECK constraints. Two corruption-injection tests deliberately set the consumed timestamp before creation and after expiry; a third temporarily disables the *disposable fixture's* signed-observation immutability trigger to inject a payment timestamp after consumption, verifies rejection, and rolls back the DDL and data edits. All tests require gateway denial and zero Research entitlement effects. Neither attempt may create a Research entitlement or change the pending subscription.

**N-P exact paid fact.** The B-5 fixture already has `UNIQUE(provider,provider_subscription_id)`; Stage P uses `SELECT ... INTO STRICT ... FOR UPDATE` and maps missing/ambiguous cardinality to a fail-closed permission error. This protects against future schema drift and avoids nondeterministic row selection. It does not turn a B-5 signed observation into a settled paid invoice.

**N-T environment isolation.** Match invoice, signed B-5 observation and consumed checkout against the **persisted** test-mode value; the synthetic lifecycle explicitly holds if `test_mode=false`. The old hidden `test_mode=true` equivalence is no longer used to infer production eligibility. An attempted environment flip is rejected and rolled back. There is **no live-mode success test** and no Production authority.

**N-D canonical JS-to-SQL digest actual gateway verification.** A private append-only `research_ordering_stage_p.verified_handoffs` evidence table can be written only by the test `research_e_verifier` role and read by the NOLOGIN `research_e_owner`. A digest generated using the existing Stage M exact ASCII `m1|provider|store|mode|invoice|subscription|snapshot_digest|quote_digest` serialization is compared, at the locked synthetic first transition, to `research_ordering_stage_m.invoice_handoff_digest_v1` recomputed from persisted J/K and Stage L witness fields. Missing or mismatched digest is denied before any entitlement effect. The test proves cross-language transport byte consistency, **not** independence, signature, provider authentication, invoice settlement or paid-cycle start.

The Stage N original lifecycle entrypoint retains `research_e_owner` and its existing gateway ACL under `CREATE OR REPLACE`. Stage P adds no public SQL API and no new `service_role` privileges. Handoff table history is guarded against UPDATE, DELETE and TRUNCATE under the synthetic role model; privileged schema owners/DDL may still disable triggers and require out-of-band audit.

## Test ordering

1. Pin actual B-5 M1 strict fixture SHA256 and replay all six historical Research migrations in disposable PG17.
2. Install Stage E/F/H/I/J/K/L/M/N, then the Stage O pending-only guard and Stage P strict overlay **before the B-5 binder**.
3. B-5 real issuer→attach→synthetic signed observation→binder creates one consumed intent and **pending** subscription with **zero Research entitlements**.
4. K/J invoice and L first witness held pending only. No handoff → deny. Malformed consumed timestamp (both directions) → deny. Test/live mismatch → deny. Wrong digest → deny. All negatives rolled back, no Research entitlement.
5. Restricted verifier stores correct canonical digest; direct service role/gateway writes to private table rejected; table immutability tested.
6. The Stage P locked gateway creates exactly one **synthetic** Research entitlement and events in disposable PG, and duplicate event is no-op. Purchase-backed Library Pass rows remain byte-identical.
7. Separate fresh PG17 I/J/K/L/M/N/O/O-P jobs plus G72/H31/J30/M36/O35 offline screens and the Production migration-intake guard.

## Unresolved release gates

- Actual Lemon Squeezy payment settlement and merchant-issued **invoice-to-paid-cycle start/end** plus source custody (R2) remain unproven. Synthetic verified digest is not a provider signature.
- An after-final-provider-GET refund can occur before local commit (R1). No remote conditional fence is documented. An explicit owner risk-exposure and customer-safe reconciliation policy remains required.
- Original shared `service_role`, 16-argument Research RPC, D2-C Library Pass/Paddle/account-deletion/TRUNCATE/TRIGGER integration, owner/superuser bypass detection, outside-DB cancellation under network failure, provider TLS/keys, Development parity and main-targeted integrated RC remain HOLD.
- J-3 recovered invoice changes and trial/proration/retry cycle provenance require explicit adjudication, not silent auto-approval.
- Independent Stage O and Stage P exact-head reviews required; the green author-side PG17 tests are not security sign-off.

**NO live O1/O4 access GO, no B-5 commerce GO.** All existing customer records, Research checkout and purchase-backed Library Pass remain unchanged.