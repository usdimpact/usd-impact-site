# Issue #950 — Review-only guarded Storage policy rollback (2026-10-30)

**HARD HOLD: NOT a live SQL authorization, migration or deployment.**

The earlier scoped source/restore S3 JWT session SQL proposals install policies only after verifying a privately supplied, short-lived database-host fingerprint. Their original cleanup SQL did not enforce the same host preflight and could drop same-named policies if inadvertently executed against another database.

This review branch changes only both rollback templates and the disposable PostgreSQL offline test:

- Each rollback requires an intentionally invalid private `__ISSUE950_SOURCE|RESTORE_SERVER_HOST_MD5__` placeholder and exact synthetic UUID; both must be supplied only in a protected, independently approved operator environment.
- The host is checked inside a transaction before any `DROP POLICY`. The PostgreSQL cluster identifier must **not** substitute for the project identity: it matches across all three projects. The host check is supplemental and failover-sensitive; the Management API project ref must be independently attested.
- All Storage policies on `storage.objects` and `storage.buckets` must match the exact expected counts, names, commands, roles and synthetic subject and contain a time guard. Any extra, missing or changed policy aborts the transaction. No broad policy removal or `DROP TABLE` is permitted.
- Zero existing Storage policies makes the correctly host-bound rollback idempotent. Policy cleanup must remain possible even after Auth session expiry or token revocation.
- Disposable PGlite tests exercise the invalid uninstantiated SQL, wrong-host denial, unknown-policy denial and intact policy counts after failure, followed by successful exact-name cleanup and idempotency. This **does not** prove a real provider/DBA execution.
- Operational escape hatch for drift/partial installation: **stop and obtain separate DBA/security incident review**. Do not weaken project-binding or delete user data to unblock a rollback.

**Boundary:** No Supabase DDL/DML, Auth users or sessions, private Storage requests, S3 transfer, project deletion, GitHub merge, Production deploy, email or account-deletion activation. Independent DBA/security/privacy signoff, actual fresh-synthetic provider S3 acceptance and 21-file cryptographic recovery remain mandatory in [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950). Isolated restore billing and separate cleanup authorization are tracked in [Issue #978](https://github.com/usdimpact/usd-impact-site/issues/978).

Supabase reference: https://supabase.com/docs/guides/storage/s3/authentication
