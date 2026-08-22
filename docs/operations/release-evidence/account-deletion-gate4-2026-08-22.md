# Account-deletion Production Gate 4 evidence — 2026-08-22

## Purpose

Durable release evidence for the first bounded Production runtime activation of the account-deletion finalizer. This record supplements the canonical runbook in `docs/operations/account-deletion-production-activation-runbook.md`; it does not replace or weaken any gate in that runbook.

## Baseline before environment uptake

- Git `main` / live Production baseline before the activation rebuild: `fee003bc6443fc4a8e56d73a04e2669872eee46f`.
- Vercel plan: Pro.
- Public checkout: disabled.
- Commerce provider: none selected.
- Web Push subscriptions/delivery: disabled.
- Knowledge search: disabled.
- Account-deletion scheduler: absent.
- Production database preflight immediately before Gate 4: 2 active profiles, 0 due deletions, 0 active/suspended profiles with broken Auth links.
- `finalize_account_deletion(uuid)` and `prepare_account_deletion_auth_removal(uuid)` are present; finalizer execution is restricted to `service_role` and browser roles cannot write `notification_outbox`.

## Operator-confirmed Production controls

On 2026-08-22, the owner confirmed the following reviewed variables were saved in the Vercel **Production** environment:

- `ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED=true`
- `ACCOUNT_DELETION_FINALIZER_ENABLED=true`
- `ACCOUNT_DELETION_FINALIZER_PRODUCTION_APPROVED=true`
- `EMAIL_READINESS_LEDGER_ENABLED=true`
- `EMAIL_READINESS_PRODUCTION_APPROVED=true`
- `ACCOUNT_DELETION_FINALIZER_BATCH_SIZE=1`

No value for `CRON_SECRET`, Supabase credentials, provider credentials, or any other secret is recorded here.

## Required deployment-uptake checks

The saved environment controls do not affect an already-built deployment. Before any authenticated finalizer execution:

1. create one fresh Production deployment from the current reviewed `main` source;
2. require READY state and exact source SHA attribution;
3. verify an unauthenticated GET to `/api/account-deletion-finalizer` changes from the pre-activation disabled `404 ACCOUNT_DELETION_FINALIZER_ROUTE_DISABLED` to `401 SCHEDULER_AUTHORIZATION_REQUIRED`;
4. re-run the read-only Production due-deletion and Auth-link preflight;
5. abort if due deletions are non-zero, the source SHA is unexpected, commerce/Web Push/knowledge-search state changed, or runtime errors appear;
6. only then perform the separately authenticated batch-1 zero-due proof using the existing Production scheduler secret without exposing it in GitHub, logs, chat, or client code.

## Rollback

If deployment uptake or the bounded proof fails, disable the two finalizer execution gates first (`ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED` and `ACCOUNT_DELETION_FINALIZER_ENABLED`), redeploy, preserve audit evidence, and investigate. Do not create a scheduler, process a real customer deletion, change commerce, or enable unrelated optional runtime features as part of this gate.

## Status

**ENVIRONMENT CONTROLS SAVED — FRESH PRODUCTION DEPLOYMENT AND BOUNDED RUNTIME PROOF PENDING.**
