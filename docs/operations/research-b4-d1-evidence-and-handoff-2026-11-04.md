# Research #1103 — A35 follow-up B-4 synthetic binding/conflict proof

**Status:** Owner D1 test-only authorization. Branch stacked from [Draft #1115](https://github.com/usdimpact/usd-impact-site/pull/1115) exact `c0ef515be89ef15ffab617cc20e817c3da4b3918`. Original protected main `bb6fb9b5cd6212c6a4bbed3069c2cba6a5b17eea`. No Supabase migrations, connected database, real users, payments, merchant API, runtime app code, feature flags, roles/grants on real infrastructure or deployment.

## Independent Claude Assignment 35 result (user supplied)

Claude independently re-ran prior isolated PostgreSQL T17/T18/T19/V1/T20 and reported PASS. It additionally loaded the **actual Research main-branch migrations into synthetic stubs**, using two independent real PostgreSQL 16.15 sessions, with these key results:

- **T13 FAIL on main SQL:** One paid subscription binds pending; a second paid provider subscription for the same account raises `already has a current subscription`, with **no durable second-payment conflict observation**.
- **T21 partial on main SQL:** An attempted paid activation against complimentary Research raises `entitlement subscription mismatch`; complimentary access remains unchanged, but no conflict observation commits.
- **T22 PASS on tested fixtures:** Library Pass entitlement/receipt rows remained byte-identical.
- **X2:** Previous B-3 prototype calculated lease expiry from `transaction_timestamp()`; a transaction already running for 3 seconds effectively grants 87 seconds. This child switches the isolated B-3 prototype's `v_now` to `clock_timestamp()`.
- **X3:** A conflict observation inserted in a rollbackable business transaction disappears on ROLLBACK. PostgreSQL lacks autonomous transactions. A **separately committed, signed-paid observation BEFORE binding** is therefore a prerequisite for trustworthy recovery.
- **X6:** Newly created functions are `PUBLIC EXECUTE` by default; this child models same-transaction revoke/grant in an ephemeral private schema. This is **NOT actual Supabase D2 approval**.
- **X8:** An existing failed v1 receipt cannot be safely retried by a v3-only hash. It must use a reviewed frozen v1 implementation, or fail closed for owner-led recovery.
- **X1/X4:** Real expired-lease contention and journal `TRUNCATE ... CASCADE` negative tests need to be retained.

## New D1-only B-4 model

The companion SQL fixture `docs/operations/research-b4-synthetic-binding-conflict-2026-11-04.sql` is deliberately under `docs/operations`, **NOT** `supabase/migrations`. It creates independent `research_binding_review` tables and synthetic roles, completely disjoint from actual Research account, entitlement and Library Pass schema.

The flow models:

1. **Receive authenticated paid evidence:** An upstream, externally trusted HMAC/catalog/account verification step is ASSUMED for this synthetic test. A `observe_signed_paid` call commits an append-only event/subscription/account observation **before** any binding attempt. It cannot itself authenticate Lemon Squeezy signatures; do not confuse recording a caller-supplied value with proof of a real charge.
2. **Bind:** `try_bind_paid` acquires the profile row lock, checks the paid observation and any current provider subscription, and returns `created`, `already_bound`, or `conflict`. It writes a conflict observation on the non-throwing path. A second paid subscription may remain **pending external resolution** but does NOT receive an entitlement.
3. **Activate:** `try_activate_paid` locks the profile then pending subscription and existing Research entitlement. If a complimentary entitlement already exists, it returns a non-throwing `entitlement_conflict`, leaves the paid subscription pending, does not alter complimentary access, and appends an observation.
4. **Journal:** Private append-only tables for paid-event observations and conflict observations, distinct evidence owner, forbidden UPDATE/DELETE/TRUNCATE via triggers and no direct service caller grants. This is intentional D2 **simulation only**.
5. **Synthetic privileges:** Distinct, throwaway `review_binding_api` (non-superuser login), `review_binding_writer` (NOLOGIN) and `review_binding_evidence_owner` (NOLOGIN), all created and removed inside CI. The app-only role may call narrow SECURITY DEFINER demo functions but cannot SELECT/UPDATE tables or assume writer role. Function creation+PUBLIC EXECUTE revocation occur within the same fixture transaction. No actual Supabase role/RLS test is implied.

**Known limitation:** The raw `observe_signed_paid` fixture is callable by a synthetic server role and does not check a real provider signature. Production would require trusted server-side provider verification, proper source, catalog and user-account authorization, monitoring and narrow RPC grants. The proposed model does **not** solve customer-facing duplicate checkout generation, recurring billing, refund/cancel, purchase confirmation or D6 case resolution.

## Required hosted test evidence

The child PR's D1 workflow runs **both** the original isolated receipt tests and the new B-4 Python suite on one ephemeral PostgreSQL 16.15 service container:

| Test | Required proof | Scope |
|---|---|---|
| T13 | Two non-superuser API sessions; profile row lock observed; second signed-paid sub returns `conflict` without error, committed `duplicate_paid_subscription` observation, first stays pending | **B-4 synthetic fixture ONLY**, not main SQL |
| T21 | Complimentary Research entitlement byte-identical, paid activation returns `entitlement_conflict`, observation committed | **B-4 synthetic fixture ONLY** |
| T22 | All synthetic Library Pass rows and receipts byte-identical through T13/T21 | **B-4 synthetic fixture ONLY** |
| X1 | 12 two-connection expired-lease contests, exactly one reacquires | B-3 receipt review schema |
| X2 | Delayed transaction still yields nearly 90s from real wall clock | B-3 receipt review schema |
| X3 | ROLLBACK erases an uncommitted conflict journal but **not** the independently committed paid observation | **Expected limitation**, not a durability PASS for journal |
| X4 | `TRUNCATE ... CASCADE` and standalone resolution TRUNCATE explicitly blocked by triggers | B-3/B-4 review schemas |
| X8 | Stored failed v1 event rejects v3 hash; exact old version hash remains usable | **Known activation blocker**, not automatic v1 migration |
| D2 | Narrow function EXECUTE, non-superuser caller, no direct UPDATE/DELETE/TRUNCATE or SET ROLE | Synthetic D2 approximation, real Supabase **not tested** |

The new workflow runs only on a same-repo PR matching the existing `agent/1103-d1-ephemeral-pg-` branch prefix. It has `contents: read`, uses pinned PostgreSQL image and pinned checkout, a local synthetic account and no real GitHub App, Supabase, merchant or Production credentials.

## Owner approvals / unreleased gates

- **D1:** Approved for synthetic, isolated two-connection PostgreSQL and temporary fixture roles; no connected Supabase.
- **D2:** Real PostgreSQL roles, privileges, RLS/SECURITY DEFINER architecture and Production migrations **HOLD**. Testing a fake `review_binding_api` role does not authorize or prove those changes.
- **D3:** Live checkout pre-check / reservations not authorized; existing hosted payment links remain a risk.
- **D4:** Provider read-credential access deferred.
- **D5:** Owner screenshots **confirm** a shareable, Live Research Membership checkout URL with Monthly $29 and Annual $290, no USD Impact custom-binding query parameters visible. External signed-out accessibility and real payment outcome untested. [Issue evidence](https://github.com/usdimpact/usd-impact-site/issues/1103#issuecomment-6635251803). Do not repeat the older `UNKNOWN` claim about whether Share URLs exist.
- **D6:** Owner-controlled refund, cancellation, relinking and privacy retention policy HOLD.
- **D7:** Research receipt activation HOLD; `RESEARCH_WEBHOOK_RECEIPTS_ENABLED` remains OFF.
- **Daily #840:** Nov 4 publication incident remains separate P0, not in this branch.

## Next independent Claude review

Independently inspect the exact child SHA, workflow branch guard and actual CI job outputs. Reproduce test fixtures from an isolated Postgres service if possible. Differentiate the current-main T13/T21 failures (Claude A35) from synthetic B-4 fixture PASS, and explicitly report that B-4 is **not** the Production fix. Probe X3 crash window, signed provider authenticity preconditions, provider ID collision, role/function owner, unconditional receipt reactivation, active complimentary entitlement and immutable evidence. Return code-level PASS/BLOCK/HOLD for test-only Draft, separate payment/receipt activation BLOCK, and the minimum remaining D2/D6 approvals. Do not merge/deploy or propose enabling Production on the basis of synthetic suite acceptance.
