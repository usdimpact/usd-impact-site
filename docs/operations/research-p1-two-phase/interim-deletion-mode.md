# Research P1 — interim non-destructive account deletion mode

**Status:** DRAFT operating procedure. It changes no Production setting and does not fix the legacy deletion risk in §3. Irreversible deletion stays Production **NO-GO**; independent technical acceptance stays **OPEN**.
**Purpose:** handle deletion requests without irreversible steps until the two-phase design is approved, using only the existing request-intake path. This is not a second deletion system.

## 1. What interim mode is

| Step | Interim behaviour | Evidence (source / synthetic test) |
|---|---|---|
| Customer requests deletion | `request_account_deletion()` moves an `active` profile to `deletion_pending` with a 7-day `deletion_due_at`, and opens one `privacy_requests` row (`deletion`, `open`, due in one month). A repeat request is refused. | `supabase/migrations/20260812180308_harden_account_rpcs.sql:83-134`; PG17 cases 1–2 |
| Acknowledgement | API returns `202` `deletion_pending`. The `account_deletion_requested` email says the request "is being processed" and that "access may be restricted". It never claims completion. Delivery of that email is **NOT VERIFIED**. | `apps/web/api/account.js` `handleDelete`; `launch-email-templates.js:169-180` |
| Paid access | The tested paid routes decide from a server-side profile read on every request, not from the frontend or JWT expiry. A still-valid or refreshed session for a `deletion_pending` account is denied. | `supabase-server.js` `readAccountAccessState` (`profile.status !== 'active'`); offline suite §2–3 |
| Customer records | Purchases, entitlements (including Library Pass) and Research subscriptions are untouched. The customer can still read their own records. | PG17 cases 1, 3 |
| Finalization | **Intended** never to run in interim mode. Whether Production actually has every destructive setting off is **NOT VERIFIED** (§2). | §2 procedure |
| Owner review | The owner runs the read-only queue (§4) on a schedule and handles every case manually. | `interim-deletion-review-queue.sql`; PG17 case 5 |

Routes covered by the synthetic tests: the Guided Edition chapter page, book, audiobook and video library (Library Pass); Score member content and the Score membership check; the account access endpoint; the Preview-only Research report gate. Any other route that serves paid content is outside this evidence.

## 2. Production state: what is and is not known

**Known from source** (Production deployment `85ce0ecd`; `main` has since changed only content and CI files):
- `vercel.json` schedules `/api/account-deletion-finalizer` daily at `20 4 * * *`. This is the legacy Auth-first finalizer.
- That route returns `404 ACCOUNT_DELETION_FINALIZER_ROUTE_DISABLED` unless `ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED` is exactly `true`. When it is on, Production also needs `ACCOUNT_DELETION_FINALIZER_ENABLED`, `EMAIL_READINESS_LEDGER_ENABLED`, `ACCOUNT_DELETION_FINALIZER_PRODUCTION_APPROVED` and `EMAIL_READINESS_PRODUCTION_APPROVED` before it does anything (`api/account.js` `handleAccountDeletionFinalizer`; `account-deletion-finalizer.js:56-77`).
- The two-phase Draft routes and the Draft migration are not in the Production code.

**Not verified:**
- A read-only Vercel environment listing (2026-11-06, values not decrypted) returned exactly 100 entries with some fields truncated. No `ACCOUNT_DELETION_*` name appeared, but the listing may be incomplete.
- No log line exists for the disabled route, so runtime logs did not confirm its state.
- An unauthenticated probe from this session was blocked by the fetch allowlist.

**Therefore:** do not claim that the legacy finalizer is disabled, or that it can never run, until the owner completes the procedure below.

### Secretless verification procedure (owner)

No secret value is read, no flag is changed, and no deletion is triggered.

1. **Every environment-variable name, every target.** In the Vercel dashboard, open the project's Settings → Environment Variables. Without revealing any value, filter by `ACCOUNT_DELETION`, then by `EMAIL_READINESS_PRODUCTION_APPROVED`, separately for Production, Preview (including branch-specific overrides) and Development. Alternatively run `vercel env ls production`, `vercel env ls preview` and `vercel env ls development`; these list names, not values. Record the names found (expected: none), the date, and the total count shown, so a truncated listing is detectable.
2. **The running deployment.** Environment changes reach a deployment only when it is built. Record the Production deployment ID and its creation time, and confirm that no deletion-related variable was added or changed after that time (dashboard variable history, or the team activity log).
3. **Unauthenticated route probe.** Send a plain `GET` with no credentials to `https://www.usd-impact.com/api/account-deletion-finalizer` (browser address bar or `curl -i`). The route checks its switch before the scheduler secret, so this cannot run the finalizer:
   - `404` with `ACCOUNT_DELETION_FINALIZER_ROUTE_DISABLED` → the legacy route is off.
   - `401` with `SCHEDULER_AUTHORIZATION_REQUIRED` → **the route is ON.** Stop and escalate; do not call it with the cron secret.
   - The same probe on `/api/account?action=deletion-two-phase-review` and `…=deletion-two-phase-preflight` should return `404`, because those actions are absent from Production code.
   The offline suite §2c proves this behaviour, including that a probe never executes even with every flag set.
4. **Cron history.** In the Vercel dashboard, open the cron job for `/api/account-deletion-finalizer` and confirm that recent invocations returned `404`.
5. **Record the result** (date, deployment ID, names found, probe status codes) in the owner's restricted release log. Repeat after any environment change or redeploy, and at least weekly during interim mode.

## 3. Unfixed legacy risk (release-blocking)

In the live schema, `service_role` can still execute `prepare_account_deletion_auth_removal` and `finalize_account_deletion`. The PG17 witness (case 6) shows that once an account is past its due date, that path finalizes it **despite an active Research subscription**, and marks the privacy case `completed`. Interim mode does not change this. It only avoids calling that path, so safety depends on:
- the route settings in §2 staying off (unverified until the procedure is completed);
- the `service_role` key staying in restricted custody, with no manual RPC calls;
- no one manually completing a deletion privacy case or deleting an Auth user.

The fix belongs to the reviewed two-phase cutover: Draft Part 11 revokes these grants. It is not installed.

## 4. Owner review queue

Run `interim-deletion-review-queue.sql` as the owner, inside `begin transaction read only; … rollback;`.

**Data handling.** `account_ref` and `privacy_request_id` are restricted, linkable personal identifiers: anyone with database access can join them to a person, and a row reveals that the person asked for deletion and what their payment states are. The output is **not** anonymous. It holds no email, name, provider customer id or payment id, but it must stay in owner custody: never in GitHub, CI, trackers, chat, tickets or logs.

**Reading a row.**
- `review_flags` lists every condition at once (`privacy_overdue`, `privacy_due_within_7_days`, `financial_exception`, `state_mismatch`), so a financial exception never hides a deadline.
- `review_priority`: 1 = overdue, 2 = due within 7 days, 3 = other flags, 4 = no local flag. The queue is ordered by priority, then due date.
- `merchant_cessation_evidence` is always `unknown`. `unchecked_financial_sources` lists what local rows cannot show: provider subscriptions on every page, pending invoices and retries, open or non-expiring checkouts, signed late or out-of-order webhooks, and paid-binding quarantine.
- `deletion_eligibility` is always `not_determined`, and `automatic_finalization_allowed` is always `false`.

**An empty `review_flags` (priority 4) does not mean "safe" or "eligible".** It only means nothing was found in local rows.

| Flag | Owner action |
|---|---|
| `privacy_overdue` / `privacy_due_within_7_days` | Escalate to the privacy owner immediately (decision D2), whatever the other flags say. |
| `financial_exception` | Reconcile with the provider first (`merchant-cessation-acceptance.md`). Do not delete. |
| `state_mismatch` | An open deletion case whose profile is not `deletion_pending`. Investigate; never auto-close. |
| no flag | Still requires per-account merchant evidence and an explicit owner decision. |

## 5. Customer-facing copy

The live account page promises a "seven-day safety period" that "ends" on a date, and the privacy policy says data is deleted "after the documented safety period". In interim mode nothing happens on that date, and the customer has no self-service way to cancel. Proposed Draft-only EN/ES wording is in `interim-deletion-customer-copy.md`. The live copy is unchanged; owner and legal review is required before publishing.

## 6. Research Preview gate fix included with this procedure

`research-preview-route.js` authorized from the entitlement row alone. `readAccountAccessState` returns that row even for non-active profiles, so a `deletion_pending`, `deleted` or `suspended` account with an active Research entitlement could open Preview-deployment Research reports. The gate now requires an `active` profile. In Production code this gate runs only when `VERCEL_ENV=preview`.

## 7. Evidence and limits

- `apps/web/scripts/test-account-deletion-interim-mode.mjs`: offline. It drives the real handlers against a synthetic Supabase model.
- `supabase/tests/research-p1/test_research_p1_interim_deletion.py`: disposable PG17, live schema only (Draft migration excluded).

Both are author tests, not independent acceptance. Not established: Vercel environment completeness (§2), hosted schema and grant parity, email delivery, untested paid routes, and the merchant state of real accounts.
