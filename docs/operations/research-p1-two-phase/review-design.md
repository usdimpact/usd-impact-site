# Research P1 — recoverable two-phase account deletion (Draft review specification)

**Status:** REVIEW-ONLY / NOT WIRED TO VERCEL / OWNER POLICY HOLD / NO-GO.  
**Repository:** `usdimpact/usd-impact-site`, Draft PR #1164.  
**Reference:** Issue #1103, D2-33 through D2-40 independent observations; #1164 scheduling fix already complete at `9cd3990a`.  
**Security boundary:** No Development or Production SQL/migrations, real Auth, merchant, customer or payment operations were performed while preparing this candidate.

## Verified source constraints

* `public.finalize_account_deletion(uuid)` requires `profiles.auth_user_id IS NULL`. A direct Auth↔SQL swap is wrong.
* An existing `public.prepare_account_deletion_auth_removal(uuid)` detaches the nullable foreign-key link inside a SQL transaction; it **does not call Auth Admin**.
* The old app uses three independent steps: readiness RPC → Auth DELETE → SQL finalization. A new signed payment between the first two can leave a deleted Auth identity and a billing-held database profile.
* The SQL owner clearance is not evidence that Lemon Squeezy stopped billing by itself. The owner must authenticate external merchant state. `cancel_scheduled`, `past_due`, local `cancelled`, and a locally forged `provider_webhook` row are **not** proof of settled billing.

## Candidate phase protocol

1. **Phase A: atomic DB commit (pre-Auth).** In one database transaction: lock the canonical profile `FOR UPDATE`; enforce status/deletion due; evaluate *all* known billing evidence, open checkouts and unresolved signed-payment quarantine; require a current owner-recorded externally verified cessation for every Research footprint; capture pending privacy-request IDs and the necessary recipient email in a private RLS-forced custody row; call the existing auth-link detachment helper; invoke the existing SQL finalizer; then revert privacy-request status to `in_progress` until later confirmed Auth retirement. If any statement fails, the entire SQL transaction rolls back—**zero Auth DELETE calls**.
2. **Phase B: leased Auth cleanup.** A bounded `service_role`-only RPC leases incomplete rows with `FOR UPDATE SKIP LOCKED`, fresh opaque lease IDs and a 15-minute retry interval. The review-only web module requires canonical Development config. For `auth_pending`, request Auth soft deletion and independently query Auth Admin: only 404 or a matching identity with valid `deleted_at` is accepted. Unavailable/malformed/active responses **hold**; nothing is marked complete. The original recipient email stays in the inaccessible private custody ledger.
3. **Phase C: acknowledgment, email, privacy completion.** Confirm the current lease in SQL after verified Auth retirement; enqueue the existing idempotent account-deletion-completed email; require a matching actual `notification_outbox` record in the SQL acknowledgment RPC; only then set the private row to `email_enqueued`, scrub its temporary copy of recipient email and mark the previously recorded privacy request(s) `completed`. The actual notification outbox retains its existing retention, suppression and delivery controls.
4. **Recovery:** Crash before Phase A commit → SQL rollback, Auth untouched. Crash after A commit → durable Auth queue survives. Auth DELETE 503/network timeout → retry lease after 15 minutes. Auth returns 404 on repeat → verify absent and resume. Crash after Auth DELETE before SQL acknowledgment → repeated Auth check, re-leased token. Crash after Auth confirmation before email → skip Auth deletion and retry idempotent enqueue. Crash after email enqueue before SQL acknowledgment → outbox deduplication and SQL completion on retry. Lost/expired leases cannot confirm. Concurrent claims skip locked rows.
5. **Paid event ordering:** checkout creation/binding and lifecycle transitions already lock the profile; the Draft quarantine writer now also takes a profile `FOR SHARE` lock before writing verified payment evidence. Thus an event that commits **before** Phase A prevents irreversible database deletion. An event arriving after Phase A must still be saved as financial quarantine (never silently dropped or regranting benefits), trigger incident/support reconciliation and not be treated as proof of successful account billing cessation. External merchant certainty remains an owner-specified release prerequisite.

The new SQL is in `supabase/migrations/20261105190000_research_p1_billing_safe_lifecycle.sql` as **Draft Part 9**, and the review-only, unregistered JS module is `apps/web/src/lib/account-deletion-two-phase-review.js`. They are intentionally **not called** by `api/account` or the deployed cron. Their tests run in GitHub Actions with synthetic identities and a disposable PostgreSQL 17.6 database only.

## Proposed authoritative Lemon Squeezy cancellation proof (OWNER DECISION REQUIRED)

* The owner must independently authenticate directly to **Lemon Squeezy** using an authorized read-only API request or authenticated merchant dashboard. A local subscription status, a signed webhook alone, a screenshot forwarded by a third party, and an arbitrary `provider_webhook` database row never suffice.
* For the canonical merchant customer, enumerate **all** related Research subscriptions, pending checkout sessions, outstanding charges, scheduled renewals and failed-payment retries, using the provider's canonical IDs. Confirm each charge pathway is permanently canceled/expired/settled and cannot rebill. `cancel_scheduled` or `past_due` alone does not close the payment pathway. Where provider state is inconsistent or delayed, retain the billing hold and obtain provider support confirmation before proceeding.
* Record provider evidence source, opaque verification reference, observation timestamp and owner identity through the existing **owner-only** `record_research_billing_clearance` custody function. Never grant this to `service_role`, web roles or CI. Keep the original API/dashboard receipt in a separately protected owner audit location and limit access. The local row certifies the owner's verification, **not the merchant itself**.
* Require verification **after** the last known subscription, entitlement, checkout or signed event mutation, with no still-open checkout window and no unresolved quarantine. Re-verify when any new signed payment/renewal/refund/chargeback observation occurs. Never invent a provider cancellation event to clear a hold.
* **Proposed internal escalation only (not a legal finding):** alert a privacy/support owner when a due deletion first holds or Auth cleanup fails, review within one business day, recheck every business day, and escalate before the earliest applicable privacy-policy or statutory deadline. The system's current 7-day deletion due date and one-month privacy-request due date are *data-model defaults*, not a verified legal SLA. The owner must approve a maximum hold and escalation owner. No default timed auto-clearance.

## Acceptance and release requirements

| Gate | Evidence required | Current posture |
|---|---|---|
| Source migration replay | 53/53 clean replay against disposable PG17 with non-superuser modeled owner | Author CI; not connected compatibility |
| Atomic Phase A | Zero Auth operations for failed/unverified/forged billing; detach + finalize + queue one transaction | Synthetic tests only |
| Auth cleanup | 2xx and verified deleted state or 404; network/active/malformed hold; crash/retry/idempotence | Mocked Auth API; real response semantics unverified |
| Financial ordering | Two-connection tests for signed paid/refused checkout before, during and after Phase A | Partial; late after finalization requires owner incident policy |
| Grants/custody | `anon`/`authenticated` denied, `service_role` no private-table direct access, owner-only clearance; exact real roles/definers | Disposable model only; hosted parity not verified |
| Outbox and privacy | No completion email until Auth confirmed; SQL verifies outbox and privacy status afterward | Synthetic |
| Production/Development migrations | Compare live 57 Production and 58 Development metadata records against 52 source base; verify exact bodies/owners/trigger semantics through separately authorized read-only work | **Unverified parity**; the new migration is not installed |
| Independent acceptance | Independent reviewer who did not author this code reproduces final exact-head race/forgery/recovery tests | **Missing** |
| Owner policy and approval | Signed specific provider proof/custody, privacy deadline, runtime cutover/migration and rollback approvals | **Missing** |

**Critical limitations:** The prototype is not connected to the runtime finalizer, and therefore does **not** fix currently deployed account deletion. Supabase Auth Admin soft-delete GET behavior on real projects is not verified. The database cannot independently authenticate a remote Auth HTTP response or verify Lemon Squeezy stopped billing; it trusts the restricted server and the separately controlled owner's verified evidence. A signed paid event received *after* Phase A cannot undo an already committed database deletion, so the merchant-payment observation boundary and post-deletion financial reconciliation need explicit owner acceptance and independent testing. Production and Development remain unchanged.

**Do not:** merge Draft #1164; apply new migrations; run account deletion; change merchant billing, refunds, customer entitlements, credentials, webhook/cron controls or Production runtime; mark Issue #1103 closed; activate B-5/Score rights/Stage P without separate approval.
