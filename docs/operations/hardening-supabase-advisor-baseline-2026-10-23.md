# Supabase hardening baseline — 2026-10-23

Status: **READ-ONLY EVIDENCE / NO DATABASE CHANGES**

This snapshot records advisor state observed during the isolated hardening work. It is not a remediation migration and does not authorize Production changes.

## Production project

Project: `usd-impact-production`

Security advisor:
- 17 `rls_enabled_no_policy` informational findings.
- 1 `authenticated_security_definer_function_executable` warning for `public.request_account_deletion()`.

Performance advisor:
- 2 `unindexed_foreign_keys` informational findings:
  - `sed_newsletter.newsletter_consent_events_subscriber_id_fkey`
  - `sed_newsletter.newsletter_issue_deliveries_subscriber_id_fkey`
- 13 `unused_index` informational findings.

## Development project

Project: `usd-impact-development`

Security advisor:
- 15 `rls_enabled_no_policy` informational findings.
- 1 `authenticated_security_definer_function_executable` warning for `public.request_account_deletion()`.

## Interpretation

- Do **not** add permissive RLS policies merely to clear the advisor. Backend-only tables can intentionally remain fail-closed when RLS is enabled and no browser-role policy applies.
- Do **not** change `request_account_deletion()` merely to clear the warning. Existing repository evidence indicates this is an intentional privileged boundary and should be protected with regression tests before any redesign.
- Do **not** add or remove indexes in Production from this audit alone. The two newsletter foreign keys should first be validated against query plans and workload in development.
- Unused-index findings are observational only; absence of recorded use is not proof an index is unnecessary.

## Hardening follow-up

Safe next steps:
1. maintain an explicit intentional-RLS-deny manifest;
2. add isolated negative-access tests for anon and cross-user access;
3. validate the two newsletter foreign-key indexes in development before proposing a migration;
4. keep Production unchanged until isolated evidence and explicit approval exist.

Observed advisor documentation:
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
