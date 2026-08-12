# Account RPC hardening release gate

This runbook controls migration `20260812180308_harden_account_rpcs.sql`.
It covers only account export and staged account-deletion RPC authorization.

## Security outcome

- `public.account_export()` is parameterless, `SECURITY INVOKER`, and uses
  `search_path = ''`.
- The export target comes only from `auth.uid()`; all source tables continue to
  enforce their existing authenticated-account RLS policies.
- `public.account_export(uuid)` remains temporarily available for database-first
  rollout compatibility, but is also `SECURITY INVOKER` and returns data only
  when the supplied UUID equals `auth.uid()`.
- `public.request_account_deletion()` remains the single intentional
  authenticated `SECURITY DEFINER` RPC because customers have no direct profile
  update grant. It uses `search_path = ''`, rejects a null authenticated identity,
  and updates only the profile matching `auth.uid()`.
- `PUBLIC`, `anon`, and `service_role` have no execute privilege on these RPCs.
  Only `authenticated` is granted execution.

## Deployment order

1. Apply the migration to the target Supabase project.
2. Verify the migration version appears exactly once.
3. Verify both export overloads are invoker functions and the deletion function
   is the only remaining definer function in this scope.
4. Verify all three functions use an empty search path and their ACLs grant only
   the database owner and `authenticated` execution.
5. Run `supabase/tests/20260812_account_rpc_hardening_rollback.sql`.
6. Confirm every rollback-only step passes and the tested profile and privacy
   request counts return to their original values.
7. Run the Security and Performance Advisors.
8. Deploy the application change that calls the parameterless export RPC.

Applying the database migration first is required. The compatibility overload
keeps the previous application request shape functional during this window.

## Required verification

- anonymous execution of export and deletion is denied;
- parameterless export returns only the authenticated account payload;
- the compatibility overload returns the same payload for the caller's UUID;
- a different UUID returns no payload;
- an own-account deletion request stages the profile and creates one privacy
  request;
- a repeat deletion request is rejected;
- the rollback-only test restores the original profile and privacy-request state;
- the Account Export Security Advisor warning is absent;
- the remaining Account Deletion Security Advisor warning is recorded as an
  intentional, source-reviewed exception;
- no new Security or Performance Advisor warning or error appears.

Advisor references:

- [Authenticated SECURITY DEFINER execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [RLS enabled without a policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

## Rollback

An application rollback is safe after the database migration because the
compatibility `account_export(uuid)` overload remains available.

Do not reverse the database migration during an incident unless the hardened
functions themselves are proven to be the cause. Prefer restoring the previous
application deployment while leaving the reduced database privilege surface in
place. If database rollback is unavoidable, use a separately reviewed migration;
do not edit migration history or run ad hoc destructive SQL.

## Development verification — 12 August 2026

- target: `usd-impact-development` (`ycstrcvshdluovtuasjc`);
- migration version recorded: `20260812180308`;
- parameterless own export: pass;
- compatibility own export: pass;
- compatibility cross-account denial: pass;
- anonymous export and deletion denial: pass;
- own deletion staging: pass;
- repeat deletion rejection: pass;
- rollback restoration: pass;
- Account Export advisor warning removed;
- no new Security or Performance Advisor warning or error;
- Production was not changed.
