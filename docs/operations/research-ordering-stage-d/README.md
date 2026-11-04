# O1/O4 Stage D - privilege-cutover blast-radius review (DRAFT HOLD)

**Scope:** dedicated, disposable PostgreSQL 17.6 CI test using all six original Research migrations, real historical RLS, and the Stage C synthetic accounts. This is not a migration, not an integrated webhook, and not live caller authentication. No user or merchant data is accessed.

## Why the naive fix is not safe

On the live Production catalog (read-only check, November 5, 2026), `service_role` is a `BYPASSRLS` role. It can execute the old 16-arg Research transition RPC, update `public.subscriptions`, and insert/update/delete the *shared* `public.entitlements` table. Production also grants broader rights than Development on shared `purchases`, `entitlement_events`, and `webhook_receipts` tables. Prior Stage C proved that an older payment failure can bypass an isolated ordering guard using the original RPC and privileges.

Static source callers include `research-membership-persistence.js` for the legacy RPC, `lifecycle-qa-handler.js` direct `POST` and `DELETE` on `entitlements`, and the Lemon Squeezy commerce and Supabase server modules that read Library Pass/purchase-backed entitlements. These are evidence of possible shared-credential dependencies; the complete runtime dependency inventory and deployed environment flags are **not** proven.

The deliberately incomplete `candidate_acl_review.sql` revokes the old RPC EXECUTE and risky *table-wide* DML permissions from `service_role`. The test confirms both that the O1/O4 old-RPC/direct-DML bypass is blocked **and** that the same revocation would prevent service-role purchase-backed Library Pass entitlement UPDATEs. This is a concrete blast-radius risk, **not** an acceptable Production release plan. Tests run the revokes inside an explicitly rolled-back disposable database transaction and verify both grants and rows restore exactly.

## Required replacement before any real privilege changes

1. Complete every shared `service_role` caller/read/write dependency, including Library Pass purchase flows, QA cleanup, privacy/account deletion, refunds and support.
2. Create a separately authenticated and sufficiently restricted database caller for the lifecycle gateway; validate actual Vercel/Supavisor TLS transport, not just different Supabase API keys. The fallback cannot retain the old `service_role` DML bypass.
3. Provider-authoritative current object, account/store/variant and settlement evidence must be versioned into a trusted witness, with GET-to-commit race handling. The Stage C snapshot Boolean is a mock.
4. Migrate/refactor other legitimate shared entitlements writers before removing broad table DML. Do not revoke existing Production grants preemptively.
5. Coordinated fail-closed cutover: new function, new caller/credentials, router switch, old 16-param EXEC denial, shared DML closure and independent two-session real-app tests. Rollback must **not** re-enable the vulnerable old RPC.
6. Resolve Development migration/grant drift and rehearse with distinct owner approval. Independent reviewer and one exact-head integrated CI, then separate Production deployment authorization.

**NO-GO:** Existing checkout activated October 28 remains unchanged. O1/O4 P1 OPEN. B-5/D2-B/C, D4/D6/D7 and Issue #950 remain on HOLD. No Development or Production migration, credential, merchant, payment, entitlement, deploy or merge action is authorized by this Draft.
