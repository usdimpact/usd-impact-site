# Issue #950 — Completion-recipient escrow health, without exposing personal information

**Recorded:** 2026-10-30. **Status:** Review-only SQL and synthetic CI; no live migration, read/send/purge, or change to legal retention.

## Why a separate check is needed

The reviewed transactional deletion procedure guarantees that the original recipient is stored in a private pending completion escrow in the **same database transaction** as irreversible account erasure. After a verified durable notification outbox record is acknowledged, the escrow recipient is cleared. An outage before that acknowledgment can leave a private recipient value pending for an unbounded period without an independent health report.

USD Impact's already-published [email operations policy](./email-operations-policy.md) defines a **transactional critical** retry schedule of at most **five attempts** (first attempt, 1 minute, 5 minutes, 30 minutes, 2 hours) and a **24-hour stale limit**, with manual escalation on exhaustion. Its privacy/deletion acknowledgement evidence retention defaults are separate rules and **must not be interpreted as automatic permission to keep or purge the raw escrow recipient**.

## New operator-only, aggregate SQL proposal

`docs/operations/candidates/account-deletion-completion-escrow-health.review.sql` defines a `SECURITY INVOKER` function exclusively within the private `account_deletion_internal` schema. It is **not** installed and `EXECUTE` is revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`. A separately authorized operator could call it only after a reviewed schema installation, subject to existing project database privileges.

It reports only:

- Number of pending escrows;
- Number pending at least 2 hours and 24 hours;
- Count of pending rows whose profile/attempts are inconsistent;
- Count of previously acknowledged rows with a missing or mismatched outbox;
- Coarse oldest pending age band (`none`, `under_two_hours`, `two_to_24_hours`, `at_least_24_hours`);
- A boolean **manual review required** if a record is stale 24 hours or internally inconsistent.

It never returns emails, account/request UUIDs, tokens, notification identities, exact event timestamps, full PII rows, or paths, and has **NO ability to send, delete, retry Auth, purge the escrow, or acknowledge the outbox**. The two- and 24-hour markers are **operational alerting**, not legal retention or automatic deletion limits.

## Offline acceptance and controls

The new PR-only test executes the real claim+escrow SQL and monitor SQL against disposable synthetic PostgreSQL and verifies empty-state zero counts, a recent finalized account, a synthetic 27-hour-old stalled escrow with manual review, durable acknowledgment scrubbing the recipient, recovery to zero pending, missing outbox record escalation, and real denial of the service role. The existing no-live-migration guard is expanded to the new SQL and function name.

## Remaining human decisions

- Independently approve a concrete privacy-escrow retention cap, documented lawful basis, data controller/operator responsibilities, access log, manual escalation protocol, and terminal cleanup policy; do **not** equate the 24-hour transactional delivery window with a legal retention deadline.
- Decide what to do when recipient escrow is stale but the required completion notification has never been durably recorded. Indefinite retention and unverified deletion are both unacceptable; current proposal deliberately takes **no** such action without a reviewed policy.
- Review access control and incident routing with qualified DBA/privacy/security owners and provide dated approval evidence.
- Continue to block account deletion until the Auth claim-aware finalizer, complete Storage file recovery, synthetic GoTrue/PostgREST/JWT acceptance and Production release are independently authorized.

This is a **monitoring design only**, not authorization to run SQL on Development, Production, or the restored real-data clone.
