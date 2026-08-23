# Account-deletion Production Gate 6 evidence — 2026-08-24

## Authorization and baseline

The owner explicitly approved **Gate 6 scheduler activation** on 2026-08-24 after the Production Gate 5 bounded zero-due proof passed.

Accepted pre-scheduler baseline:

- source `main`: `034d0ab78690f9e13aff1fb4b9141bfa7e4d1f44`;
- Production deployment after `CRON_SECRET` rotation: `dpl_3xdwrbJ7iBo8J5mnYCtFtjFkQ3yA`, READY;
- unauthenticated `/api/account-deletion-finalizer` remains guarded with `401 SCHEDULER_AUTHORIZATION_REQUIRED`;
- authenticated Gate 5 invocation returned HTTP 200 with `ok: true`, `enabled: true`, and zero scanned/finalized/recovery/failure counts;
- read-only Production preflight after Gate 5: 2 active profiles, 0 suspended, 0 deletion-pending, 0 deleted, 0 unexpected statuses, 0 due deletions, and 0 broken active/suspended Auth links;
- no Vercel runtime errors were present after the bounded proof;
- public checkout remains disabled and provider selection remains separate.

No secret values are recorded in this file.

## Scheduler contract

This Gate 6 change adds exactly one Production Vercel cron entry:

- path: `/api/account-deletion-finalizer`;
- schedule: `20 4 * * *` (04:20 UTC daily).

Rationale:

- account deletion requests have a 7-day application grace period before `deletion_due_at`;
- one daily invocation is comfortably inside that operational SLA;
- the finalizer remains bounded by the reviewed Production batch size of `1`;
- a single daily entry avoids intentionally overlapping finalizer schedules;
- 04:20 UTC is separated from the existing Daily Learning dispatch cron windows at 06:10 and 06:40 UTC.

Vercel Cron Jobs send the configured `CRON_SECRET` as the bearer authorization header. The application continues to reject unauthenticated requests and does not expose a request-controlled batch override.

## CI guard

The change adds a focused scheduler contract test and GitHub Actions workflow. The contract requires:

1. exactly one finalizer cron entry;
2. the exact reviewed daily schedule `20 4 * * *`;
3. the scheduled public path to continue rewriting only to `/api/account?action=deletion-finalizer`.

The scheduler change must not weaken the existing authorization, Production approval, batch-size, Supabase-project, email-ledger, or failure-response guards.

## Activation acceptance

Gate 6 is not complete merely because this configuration merges. Final acceptance requires the first genuine Vercel-scheduled Production invocation to provide non-secret evidence that:

- the invocation reached `/api/account-deletion-finalizer` with scheduler authorization and returned HTTP 200 when there are no failures;
- no real account was unexpectedly processed;
- post-run due-deletion/Auth-link counts remain consistent with the expected state;
- no relevant Vercel runtime error was produced;
- any non-zero `failed + recoveryFailed` response remains an HTTP 503 failure;
- no scheduler change enables commerce, Web Push, knowledge search, or provider lifecycle delivery.

Until that scheduled proof is captured in Issue #130, Gate 6 status is **SCHEDULER CONFIGURATION APPROVED / SCHEDULED PROOF PENDING**.

The pre-Gate-6 `account-deletion-production-activation-runbook.md` statements describing the scheduler as absent represent the earlier baseline; this evidence record governs the explicitly approved Gate 6 transition and should be reconciled into the runbook after the scheduled proof is green.
