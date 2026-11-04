# Research O1/O4 Stage E — segregated database caller and product-scoped guard (DRAFT HOLD)

**Review-only artifact.** Nothing in this folder is an installable migration or a Production fix. All SQL executes **only** in an isolated disposable PostgreSQL 17.6 GitHub service after the six historical Research migrations and the private Stage C oracle. This branch is stacked on Stage D PR #1136, separate from B-5/D2-C. No code is imported by the live web application. Do not merge, deploy, provision roles, set Vercel environment variables or enable Research commerce using this evidence.

## Scope / specific questions

Stage D proved blanket revocation of `service_role` write permissions stops the old 16-argument Research RPC **but also** breaks purchase-backed Library Pass updates through the shared caller. Stage E tests an alternative *synthetic* least-privilege cutover architecture:

1. Install a private, product-scoped trigger guard that rejects **both OLD and NEW** rows bearing `product_id='research-membership'` unless the effective PostgreSQL role is the isolated, non-login Research owner. The guard covers `subscriptions`, `entitlements`, `subscription_events` and `entitlement_events`. It does not revoke any shared `service_role` entitlement grants; purchase-backed Library Pass writes remain possible.
2. Create three synthetic roles: `research_e_owner` (NOLOGIN, NOBYPASSRLS), `research_e_gateway` (LOGIN, NOINHERIT, NOBYPASSRLS) and `research_e_verifier` (LOGIN, NOINHERIT, NOBYPASSRLS). No caller membership in the owner role. The gateway has EXECUTE only on a single protected function in an unexposed schema, no direct DML, no legacy RPC access; the verifier can only INSERT immutable synthetic snapshot witness rows. No role can `SET ROLE` to the owner.
3. For the synthetic review, a tightly scoped `SECURITY DEFINER` gateway wrapper is owned by the NOLOGIN review owner, with `search_path=''` and fully qualified objects. Grants/RLS are explicit. The owner delegates to Stage C's original security-invoker ordering oracle **only after** a separately recorded witness matches event, account, subscription, store/variant, fingerprint and object timestamp. The external caller has **no `p_snapshot_verified` Boolean** that can directly grant a mutation.
4. Replay existing Research and Library Pass rows under the historical schema, test the old RPC and direct DML are denied, and prove purchase-backed Library Pass updates still work through shared `service_role`. Then test real PostgreSQL connections as distinct gateway/verifier logins, missing/forged witness denial, legitimate signed-*mock*-witness renewal, stale/equal/replay behavior and audit invariants.

### Why this is still **NO-GO**

The verifier has a *synthetic test privilege*, **not** cryptographic Lemon Squeezy authority. A compromised verifier could issue fabricated snapshot rows. There is no provider signature/settlement proof, trusted transport/TLS/Supavisor identity, source-to-live provider snapshot or GET-to-commit race protection. The Stage C private oracle still treats a matched witness as a test Boolean. This CI does not prove Production `service_role` isolation or custody separation between web runtimes.

The product-scoped trigger guard itself is **NOT SAFE TO DEPLOY**: it would block current Research webhook/binder flows unless their routing and identity are migrated atomically. Additional SECURITY DEFINER functions, owner DDL rights, support/privacy deletion, refunds, event ledgers, historical commerce paths and `webhook_receipts` are not fully mediated. The private test uses broad RLS policies for the isolated NOLOGIN owner only, and its security-definer function has not received independent real-source integration review. A privileged table owner/superuser can disable triggers; this is not a proof against a hostile database administrator.

## Required next authorization gates

Before any Development rehearsal or Production correction: (1) inspect all shared-secret consumers and their exact DML, (2) establish a provider-authoritative versioned witness with account/merchant/catalog/settlement proofs, (3) validate dedicated Postgres authentication and TLS transport via supported Supavisor mode in a separately approved Development-only environment, (4) complete real application JS integration, (5) address the legacy binder and all old `service_role`/SECURITY DEFINER paths without breaking paid Library Pass, (6) review Development/Production migration/ACL drift, (7) integrate one release candidate and independent negative + concurrent checks, and (8) obtain separate owner approval for migration, deployment and checkout changes. Never roll back by re-enabling the old vulnerable RPC.

## Exact boundaries

- No connected Supabase query beyond earlier *read-only* catalog inventory.
- No customer data, merchant/API calls, real keys, Production checkout switch, payments/refunds, real entitlement changes or deployments.
- Official PostgreSQL `17.6-bookworm` image pinned by digest; synthetic credentials, `PGHOST=127.0.0.1`, environment assertions reject provider/Supabase connection strings.
- This synthetic role separation is a **design candidate**, not an approved role/credential provisioning instruction.

Related: [Live Research P1 issue #1103](https://github.com/usdimpact/usd-impact-site/issues/1103), inert Stage A #1105, Stage B #1134, Stage C #1135, Stage D #1136; B-5 Draft #1124 and PG tests Draft #1128 remain separate.
