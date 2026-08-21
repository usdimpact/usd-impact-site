# Production account-deletion activation runbook

## Status and authorization boundary

This document is a release runbook, not authorization to change Production.

Production project: `gjzetjugmnwanvjkchux` (`usd-impact-production`).

As of 2026-08-21, Production account-deletion finalization and scheduling remain disabled. The Development application-path proof is complete, but the Production schema apply, runtime activation, scheduler activation, controlled proof, lifecycle delivery, and any customer mutation remain separate explicit Production gates.

Do not interpret a merged runbook, a green CI run, or a green Development proof as approval to execute any Production step below.

## Current source contract

The finalizer is reachable in application source through:

- public rewrite: `/api/account-deletion-finalizer` -> `/api/account?action=deletion-finalizer`;
- route gate: `ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED=true`;
- finalizer gate: `ACCOUNT_DELETION_FINALIZER_ENABLED=true`;
- scheduler authentication: `Authorization: Bearer <CRON_SECRET>`, with `CRON_SECRET` at least 32 characters;
- Production project guard: Supabase project ref must equal `gjzetjugmnwanvjkchux`;
- Production finalizer approval: `ACCOUNT_DELETION_FINALIZER_PRODUCTION_APPROVED=true`;
- durable ledger gate: `EMAIL_READINESS_LEDGER_ENABLED=true`;
- Production ledger approval: `EMAIL_READINESS_PRODUCTION_APPROVED=true`.

The repository intentionally has no Vercel `crons` configuration today. Creating or enabling a Production scheduler is therefore a separate release action after schema verification and separate approval.

The finalizer queues the application-owned `account_deletion_completed` acknowledgement in `notification_outbox`. Provider delivery is a separate control plane. Do not enable `LAUNCH_EMAIL_DISPATCH_ENABLED` or `LAUNCH_EMAIL_PRODUCTION_APPROVED` merely because account-deletion finalization is enabled.

## Required migration sequence

The Production schema gate is four migrations in this exact source order:

1. `20260821015500_account_deletion_finalization.sql`
2. `20260821192449_fix_account_deletion_support_identity.sql`
3. `20260821195116_harden_account_deletion_auth_link_and_recovery.sql`
4. `20260821195413_grant_notification_outbox_service_role_writes.sql`

The first migration is mandatory. It creates `finalize_account_deletion(uuid)` and the due-profile index and adjusts authenticated read policies so deleted profiles cannot continue to read commerce/access rows. The second migration patches the base finalizer and will fail if the base function is absent. The third migration introduces the durable `profiles.auth_user_id` relationship and the guarded v2 finalizer. The fourth grants only the backend writes required to queue the completion acknowledgement.

Do not skip, reorder, manually concatenate, or mark any migration as applied without executing the canonical source migration through the supported migration workflow.

## Gate 0 — immutable release inputs

Before any Production database action:

- record the exact `main` commit to be deployed;
- confirm Web Quality is green on that exact commit;
- confirm the four migration files above are byte-for-byte the reviewed source at that commit;
- confirm the Development full application-path proof remains the latest accepted proof and has no unresolved defect follow-up;
- confirm Production finalizer route, finalizer execution, and scheduler are still disabled;
- confirm Production lifecycle provider dispatch remains in its separately approved state and is not being implicitly enabled by this gate;
- confirm no unrelated Production migration is being bundled into the same approval.

Abort if any item is ambiguous.

## Gate 1 — read-only Production preflight

Run read-only checks before applying the first migration. Capture counts and object state without exposing email addresses, account UUIDs, tokens, keys, or other customer data in tracker comments.

Required checks:

1. Migration ledger
   - determine whether each of the four versions is absent or already present;
   - if any subset is unexpectedly present, stop and reconcile the ledger/object state before proceeding.

2. Base function/object state
   - confirm whether `public.finalize_account_deletion(uuid)` exists;
   - confirm whether `public.profiles.auth_user_id` exists;
   - confirm the current `profiles_account_id_fkey` relationship to `auth.users` before mutation.

3. Profile-state consistency
   - count `active`, `suspended`, `deletion_pending`, and `deleted` profiles;
   - identify any profile status outside the expected enum/contract;
   - confirm there is no unexplained deleted-profile residue from an earlier partial finalizer experiment.

4. Auth relationship
   - for every active or suspended profile, confirm `account_id` maps to an existing `auth.users.id` before the new relationship is introduced;
   - any active/suspended profile without its canonical Auth user is a hard stop because migration `20260821195116` deliberately raises instead of accepting a broken link.

5. Backend permissions
   - record current `service_role` privileges on `support_requests` and `notification_outbox`;
   - verify no planned migration expands `anon` or `authenticated` write access to those backend-only surfaces.

6. Due deletion inventory
   - count profiles already in `deletion_pending`;
   - separately count profiles whose `deletion_due_at <= now()`;
   - if any real Production account is already due, do not enable the finalizer until the owner explicitly approves how those accounts will be handled in the first run.

### Suggested read-only SQL shapes

Use the canonical Production SQL/connector path and adapt only if the live schema requires it:

```sql
select status, count(*)
from public.profiles
group by status
order by status;

select count(*) as due_deletions
from public.profiles
where status = 'deletion_pending'
  and deletion_due_at <= now();

select count(*) as active_without_auth_user
from public.profiles p
left join auth.users u on u.id = p.account_id
where p.status in ('active', 'suspended')
  and u.id is null;

select to_regprocedure('public.finalize_account_deletion(uuid)') is not null as finalizer_present;
```

Do not query or paste customer emails or identifiers unless a separately approved bounded proof requires one exact fixture.

### Hard abort conditions

Abort the Production schema gate if any of the following is true:

- project ref is not exactly `gjzetjugmnwanvjkchux`;
- migration history does not match the expected preflight state;
- an active/suspended profile lacks a matching Auth user;
- an unexplained partial `auth_user_id`/finalizer state already exists;
- there are due real-customer deletions without an explicitly approved first-run disposition;
- CI no longer passes on the exact release commit;
- source migration contents differ from the reviewed commit;
- any operator proposes weakening RLS, function grants, state constraints, or finalizer guards to make the apply succeed.

## Gate 2 — schema apply only

This gate requires a separate explicit Production database authorization.

Apply the four canonical migrations in order. Keep all runtime flags disabled during the entire schema apply:

- `ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED` must remain false/unset;
- `ACCOUNT_DELETION_FINALIZER_ENABLED` must remain false/unset;
- no Production scheduler is created or enabled;
- lifecycle provider delivery is not activated as part of the database apply.

If an apply fails, stop. Do not mark the migration repaired/applied simply to advance the ledger. Do not manually edit the database to approximate the intended final state unless a new reviewed forward-fix is prepared and separately authorized.

## Gate 3 — post-apply read-only verification

Before runtime activation, verify all of the following:

- all four migration versions are present exactly once in the Production migration ledger;
- `profiles.auth_user_id` exists;
- active/suspended profiles satisfy `auth_user_id = account_id`;
- deletion-pending profiles satisfy the allowed nullable/equal relationship;
- deleted profiles have `auth_user_id is null`;
- `profiles_account_id_fkey` no longer blocks Auth deletion;
- `profiles_auth_user_id_fkey` points to `auth.users(id)` with `ON DELETE SET NULL`;
- `profiles_auth_user_id_uidx` exists for non-null Auth links;
- `profiles_auth_link_state` exists and is valid;
- `handle_new_auth_user()` populates both `account_id` and `auth_user_id` and retains the hardened empty search path;
- `prepare_account_deletion_auth_removal(uuid)` and `finalize_account_deletion(uuid)` are executable by `service_role`, not `public`, `anon`, or `authenticated`;
- `finalize_account_deletion()` contains the `auth_user_id is null` guard and `account-deletion-finalizer:v2` evidence reference;
- support identities are pseudonymized to the deterministic `@support.invalid` form rather than nulled;
- `service_role` has only the required `SELECT/INSERT/UPDATE` access on `support_requests` for this flow;
- `service_role` has the required `INSERT/UPDATE` on `notification_outbox`;
- no new `anon` or `authenticated` backend write grant was introduced;
- broken live Auth-link count is zero;
- broken deleted Auth-link count is zero.

Run Supabase security advisors after the apply and compare with the pre-apply baseline. Existing known advisors are not automatically regressions; any newly introduced warning or error tied to these objects is a stop condition until reviewed.

At the end of Gate 3, the correct state is: **schema ready, finalizer still disabled, scheduler absent/disabled, provider dispatch unchanged**.

## Gate 4 — runtime activation preparation

This is a separate explicit Production runtime authorization. Do not combine it implicitly with the schema gate.

Before changing environment controls:

- choose the first-run scope;
- confirm whether the first run is expected to process zero accounts or one specifically approved controlled fixture;
- if any real account is due, list only its opaque operational reference in the approval record, not customer PII;
- confirm a valid Production `CRON_SECRET` exists without exposing its value;
- confirm Production Supabase configuration points to `gjzetjugmnwanvjkchux`;
- verify lifecycle dispatch flags remain at the separately approved setting.

Required runtime gates for a Production execution are:

- `ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED=true`
- `ACCOUNT_DELETION_FINALIZER_ENABLED=true`
- `ACCOUNT_DELETION_FINALIZER_PRODUCTION_APPROVED=true`
- `EMAIL_READINESS_LEDGER_ENABLED=true`
- `EMAIL_READINESS_PRODUCTION_APPROVED=true`
- correct Production Supabase URL/key configuration
- valid `CRON_SECRET`

The route must still reject requests without a valid bearer scheduler secret.

## Gate 5 — bounded first execution

Prefer a controlled execution with no due real-customer accounts, or exactly one explicitly approved synthetic/controlled Production fixture if Production fixture creation itself has been separately authorized.

The current public route does not expose a batch-size query parameter; the application finalizer defaults to a maximum batch size of 25. Therefore **do not enable the route while multiple unreviewed real accounts are already due**. If a batch-size-one Production rehearsal is required, implement that bound in reviewed source before activation rather than assuming the public route can set it.

For a single intended completion, the acceptance evidence is:

- due profile was discovered once;
- Auth admin deletion succeeded or authoritatively reported already absent;
- stale access is rejected;
- refresh is rejected;
- profile is pseudonymized and `status='deleted'`;
- learning progress and bookmarks are removed;
- entitlements are `account_deleted` with the idempotent entitlement event recorded;
- support and privacy identity fields are detached/pseudonymized as designed;
- deletion privacy request is completed when applicable;
- `account_deletion_finalized` audit entry is recorded with v2 evidence;
- exactly one durable `account_deletion_completed` notification intent is queued;
- replay does not create a duplicate completion effect;
- any completion-acknowledgement failure creates the bounded authenticated recovery/escalation path rather than silently losing the acknowledgement.

Do not treat provider email delivery as proven by the queued outbox row. Provider delivery/callback proof is the separate Production lifecycle-email gate in Issue #130.

## Gate 6 — scheduler activation

There is no scheduler in `apps/web/vercel.json` today. A recurring Production invocation must be introduced or configured only under a separate reviewed change and explicit scheduler approval.

Scheduler acceptance requirements:

- invokes only `/api/account-deletion-finalizer`;
- sends the platform-supported bearer `CRON_SECRET` authorization;
- cannot be invoked anonymously through a weaker alternate route;
- frequency is appropriate to the deletion-due SLA and does not cause overlapping runs;
- failure is observable;
- a non-zero `failed + recoveryFailed` response remains a failure (`503`), not a green run;
- no scheduler change enables lifecycle provider delivery or commerce.

Do not create an external polling workaround that bypasses the route authorization or Production approval flags.

## Failure and rollback policy

The safe rollback is primarily **disable execution**, not destructive schema reversal.

If schema apply succeeds but runtime proof fails:

1. disable/unset `ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED`;
2. disable/unset `ACCOUNT_DELETION_FINALIZER_ENABLED`;
3. disable the scheduler if one was separately created;
4. leave lifecycle provider dispatch at its prior separately approved state;
5. preserve audit/outbox/support evidence;
6. inspect the exact failed gate and prepare a reviewed forward-fix.

Do not drop the new Auth link, constraints, indexes, finalizer, or migration ledger entries ad hoc. Do not restore the database as a routine rollback. Any Production restore is an exceptional separately authorized action with the project restore checklist/two-person-style confirmation.

If the first execution has already removed Auth for an account, disabling the route prevents further processing but does not undo that deletion. Handle that account through the recovery/escalation contract and an explicitly reviewed remediation; never fabricate a replacement Auth identity.

## Completion evidence for Issue #130

The Production account-deletion finalization/scheduler gate is complete only when the tracker contains evidence for:

1. exact source commit and green CI;
2. explicit Production schema authorization;
3. preflight counts and hard-abort checks passing;
4. four migration versions applied in canonical order;
5. post-apply object/grant/advisor verification;
6. explicit Production runtime authorization;
7. bounded first-run proof with access revocation, data finalization, audit and idempotency evidence;
8. completion acknowledgement outbox proof;
9. recovery/escalation behavior where applicable;
10. separately reviewed scheduler creation/activation and healthy scheduled proof;
11. separately gated provider delivery/callback proof if that gate is being completed at the same release stage;
12. final documented state of every activation flag.

Until all required gates are independently green, Issue #130 must continue to state that Production account-deletion finalization/scheduling is not fully activated/proven.

## Canonical source references

- `supabase/migrations/20260821015500_account_deletion_finalization.sql`
- `supabase/migrations/20260821192449_fix_account_deletion_support_identity.sql`
- `supabase/migrations/20260821195116_harden_account_deletion_auth_link_and_recovery.sql`
- `supabase/migrations/20260821195413_grant_notification_outbox_service_role_writes.sql`
- `apps/web/src/lib/account-deletion-finalizer.js`
- `apps/web/src/lib/account-deletion-completed-email.js`
- `apps/web/api/account.js`
- `apps/web/vercel.json`
- `apps/web/scripts/test-account-deletion-finalizer.mjs`
- `docs/operations/email-readiness-release-gate.md`
- GitHub Issue #130
