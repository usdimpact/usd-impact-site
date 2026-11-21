# Research P1 — post-fence payment/Auth race: options and owner decisions D1–D6

**Status:** DRAFT design preparation by the code author at Draft head `910acac9`. **Not** independent security acceptance (Q-01–Q-07 stay open). **No policy below is approved.** Every D-item needs an explicit, dated owner decision. Production account deletion stays **NO-GO**.

## 1. The unresolved race, precisely

Draft worker path for one leased account (`apps/web/src/lib/account-deletion-two-phase-review.js`):

| Step | Where | What holds |
|---|---|---|
| 1. Phase A (database finalization, irreversible in SQL) | `finalize_deletion_and_queue_auth_cleanup`, migration line 2069 | Profile `FOR UPDATE`; all local billing holds (`billing_hold_reasons`, line 1167) |
| 2. Fence | worker line 244 → `check_deletion_auth_cleanup_billing_fence`, line 2215 | Lease valid; no local hold; owner provider clearance verified after Phase A, ≤ 24 h old (line 1990) and after any hold; stamps `financial_fence_passed_at` (line 2255). **The profile lock ends when this transaction commits.** |
| 3. Auth soft delete | worker line 257 → `confirmedAuthRetirement` (line 147), `DELETE …/admin/users/{id}` with `{should_soft_delete:true}` (lines 152–154), bounded by 25 s (line 11) | **No database lock. Irreversible on success.** |
| 4. Confirm | worker line 264 → `confirm_deletion_auth_cleanup`, line 2375 | Rechecks billing; refuses on new evidence |
| 5. Classify on refusal | `holdOnFinancialEvidence` (line 201) → `hold_deletion_auth_cleanup`, line 2286 | Durable, monotonic hold; append-only history (line 1942) |

**What the author tests show, separated from intended SQL behaviour** (all author-written, synthetic; none is independent acceptance):

- *Observed by the offline worker witness* `apps/web/scripts/test-account-deletion-two-phase-review.mjs:425–452`: the mocked fence returns `true` and flips a flag that stands in for a signed payment committing; the mocked Auth `DELETE` then succeeds while that flag is set (`authRetiredAfterPaid`); the mocked confirm returns `409 55000`. The test asserts the call order `FENCE,AUTH_DELETE,AUTH_GET,CONFIRM,HOLD`, no `FINISH`, no email, and rejection with `TWO_PHASE_DATABASE_UNAVAILABLE`. The `HOLD` mock is the default one at line 143, which returns `null`; the worker then rethrows the original confirm error (`holdOnFinancialEvidence`, worker line 215). **The test therefore shows only that the worker calls `hold_deletion_auth_cleanup` after the refusal.** It does not show a persisted hold, a hold class, monotonicity, or the request body sent with `HOLD` (it does not inspect `p_auth_retired_observed`).
- *Intended SQL behaviour, exercised separately* on disposable PostgreSQL 17.6 by `supabase/tests/research-p1/test_research_p1_auth_split_fence.py`: case 5 persists `auth_retired_financial_evidence` and keeps privacy and email held; case 5r shows the post-fence payment opening a `deletion_billing_incidents` row (Part 14, line 2802) and owner-only recovery; case 8 shows the class is never lowered. These run against the Draft SQL only; nothing is installed on a hosted database.

**Detection and custody are designed and tested synthetically. Prevention is not achieved.** Step 3 cannot be undone by this code. A database transaction could keep row locks open while an HTTP request is in flight, but that does not make the PostgreSQL commit, the Supabase Auth soft delete and any Lemon Squeezy charge one atomic operation: each system commits on its own, a payment does not wait on our locks, and a late webhook can arrive whatever we hold. The current Draft does not hold locks across the HTTP call in any case (step 2 commits first).

The window is not only the milliseconds between steps 2 and 3. It covers any payment that becomes **visible locally** after step 2:
- a webhook for an earlier charge delivered late, or retried;
- a renewal or a payment retry (`past_due`) collected at the provider;
- a checkout completed from a saved link (`expires_at` can be `null`);
- a resumed `cancelled`-in-grace subscription.

The provider customer portal and checkout links do not require USD Impact Auth, so retiring Auth does not stop any of these.

## 2. Alternatives (all fail-closed)

### Option A — owner-controlled Auth retirement on authoritative provider evidence (recommended)

**NOT IMPLEMENTED.** In the Draft at `910acac9`, when the worker is enabled it runs Phase A and then fence → Auth `DELETE` automatically for every claimable row; the only gate is the owner clearance (≤ 24 h). Option A exists only as a proposal. It has two variants, which are the D1 choice:

| Variant | Phase A (database finalization) | Auth retirement | Status |
|---|---|---|---|
| **A-strict** (strict D1 proposal) | Runs only inside the owner's supervised single-account session, after step 1 below | Same session, steps 2–5 below | Proposal only. Needs code and SQL changes and independent review. |
| **A-alt** (Phase A automatic) | Automatic, as in the Draft today | Waits in `auth_pending` for the owner session | Proposal only. Needs a code switch and an owner-only trigger and independent review. Leaves irreversible database finalization automatic, including for accounts with no local Research footprint. |

In either variant the Auth retirement session for **one account** is:

1. **Close the billable path at the provider first.** For the account's canonical Lemon Squeezy customer, establish from an authenticated read of every page of subscriptions, subscription invoices, orders and checkouts:
   - every Research subscription is `expired`, not merely `cancelled`, which is resumable in grace;
   - no invoice is pending or retrying;
   - no checkout for that customer can still complete.
   Where a path is still open, any cancellation or expiry is a separate merchant action under D4. It is never automatic.
2. **Quiet period (length UNVERIFIED).** A wait since the last provider-side event for that customer, intended to cover the provider's webhook-retry horizon. That horizon has **not** been verified for this store and must be confirmed by the owner from current provider documentation or support. The wait is bounded by privacy obligations: it counts against the D2 maximum hold and the privacy response deadline and may never extend them silently; if the two conflict, escalate under D2. Every signed event the database knows about is reconciled.
3. **Record evidence:** `record_research_billing_clearance` (owner-only, line 1395) with `verified_at` set to the actual provider read time.
4. **Retire Auth within the D3 window**, using the existing fence → `DELETE` → `GET` → confirm sequence for that one account.
5. **Post-retirement re-read** of the provider, and a second clearance. Any new event is handled as an `auth_retired_financial_evidence` incident (`auth-split-fail-closed.md` §5).

   **Limitation: this re-read is not a completion gate today.** In `resumeDraftAuthCleanup` (`account-deletion-two-phase-review.js`), a successful Auth retirement (line 257) is followed in the same call by SQL confirmation (line 263), the completion-email enqueue (line 286) and the final acknowledgement `finish_deletion_auth_cleanup` (line 306) before the function returns (line 319). No provider read sits between those steps. A provider re-read done afterwards is therefore an **audit and remediation step**: it can open an incident, but the privacy request and the staged completion email may already be completed. If a post-Auth provider check must gate completion, that needs a future code and SQL change (a new held state between Auth retirement and confirmation, released only by a fresh post-retirement clearance), new tests and independent acceptance. None of that exists or is proposed in code here.

**Removes:** automatic irreversible Auth actions; reliance on local rows for cessation; webhook-delay blindness, because the provider read sees charges whose webhooks are late.
**Residual (non-atomic):**
- a charge initiated in the seconds between the provider read and the `DELETE`, which needs an open billable path that step 1 should already have closed;
- provider read-after-write lag;
- in-flight settlement of an earlier authorization;
- a later dispute or chargeback (a financial-record event, not a new charge);
- owner error.
**Cost:** manual work per account; throughput bounded by owner time; privacy deadlines (D2) must absorb the queue.
**Code change needed later (not in this diff):** for A-alt, a configuration or SQL switch that makes the worker stop after Phase A, plus an owner-only single-account trigger; for A-strict, additionally removing automatic Phase A. If D3 is shortened, the SQL freshness check (line 1990) must also change. Each change needs its own independent review. The fence and hold logic are otherwise reused.

### Option B — automatic, provider-verified just-in-time fence

The worker keeps Auth `DELETE`, but immediately before it, and again immediately after, calls the Lemon Squeezy API **read-only** with a dedicated restricted key. It proceeds only if the step 1 conditions hold at that moment, and records the provider response time as evidence.

**Removes:** manual work; narrows the window to the seconds around the `DELETE`.
**Residual:** the same window as Option A, but without a human checking ambiguous provider states. It also adds a new long-lived provider credential in the worker runtime, a new attack surface under D5, and a dependence on API completeness (pagination, rate limits, eventual consistency).
**Cost:** new code, credential custody, an independent review of the provider client. Reasonable only once deletion volume makes Option A impractical.

### Option C — defer Auth deletion; disable and scrub sign-in identity first

After Phase A, instead of deleting the Auth user, the owner:
- disables sign-in (a ban, or the existing app-level deny);
- removes direct identifiers from the Auth record where the platform allows;
- keeps a minimal private recovery mapping;
- performs the real Auth `DELETE` only after a long quiet period, for example past the chargeback window.

**Removes:** irreversibility during the risk window; a late charge can still be matched to a person for refund or contact.
**Residual / cost:** this retains personal data longer and must be justified under the privacy deadline and retention rules (D2, legal review). Whether the platform permits scrubbing the identifiers is **UNVERIFIED**. A banned user's existing JWT can stay valid until it expires; existing server-side denial covers paid routes, but every route would need checking. This is a larger design change, and it is not recommended without legal sign-off.

### Baseline (what `910acac9` already does)

Automatic Auth retirement gated by an owner clearance at most 24 hours old, with durable, monotonic detection afterwards. This is better than the legacy path, but the 24-hour window and the absence of a provider-side "no billable path" requirement leave the race fully open. **Not acceptable for real accounts** without Option A or B.

## 3. Conditions before any real account deletion (any option)

1. Independent Q-01–Q-07 acceptance at the exact SHA to be deployed, by a reviewer who did not author this PR.
2. Legacy path retired (§4): route verified off and quiesced, recovery backlog zero, then the **full** candidate migration (which contains the Part 11 revocation) applied under separate approval, and the expected privilege state verified on the hosted database by **read-only catalog checks only** (§4 step 3).
3. Hosted parity verified: function bodies, owners, grants, RLS, triggers (including the Development-only UI02/UI03 purge triggers) and the shared outbox and dispatcher behaviour with `deletion_staged`.
4. Supabase Auth soft-delete, `GET`, refresh and JWT semantics verified on Development with synthetic users.
5. D1–D6 decided and recorded with dates and approvers.
6. Monitoring (D6) running before the first real case.
7. Per-account provider evidence for the specific account (Option A step 1). A whole-store baseline is not enough.
8. A written rollback that never re-enables the legacy Auth-first worker.

## 4. Retiring the legacy path (prerequisite)

All read-only until the migration step, which needs separate approval.
- **Runtime:** the procedure in `interim-deletion-mode.md` §2 (names-only listing per target, deployment time, unauthenticated `404`/`401` probe, cron history). Currently **UNVERIFIED**.
- **In-flight work:** a count-only query of `deletion_pending` profiles whose `auth_user_id` is null (detached but not finalized) must return `0`. The legacy finalizer recovers these.
- **Grants:** catalog read of `has_function_privilege` for `service_role`, `anon` and `authenticated` on `prepare_account_deletion_auth_removal(uuid)` and `finalize_account_deletion(uuid)`, plus owner, `SECURITY DEFINER` and `search_path`. Earlier owner readback reported `service_role` EXECUTE in both projects; **UNVERIFIED** at this head.
- **Other callers:** inventory every holder of the `service_role` key and every script or integration able to call those RPCs.
- **Part 11 is not separately applicable.** The revocation (migration line 2593) is one part of the single candidate migration `20261105190000_research_p1_billing_safe_lifecycle.sql`; it is applied only by applying that whole migration (see `review-design.md`, *Migration part order*). Do not extract or run it on its own.
- **Order:**
  1. Legacy quiescence: route verified off, cron history shows no new runs, no in-flight legacy worker, recovery backlog `0`.
  2. Apply the **full** candidate migration, only under its own separate, explicit owner approval.
  3. Verify the permission state **read-only**. In Production, use only catalog reads (`has_function_privilege` for `service_role`, `anon` and `authenticated` on both legacy helpers, plus function owner and grants from `pg_proc`/`information_schema.routine_privileges`) inside a read-only transaction. **Never call either legacy helper in Production**, with any role or account ID, real or synthetic: if the revocation had not taken effect, the call could finalize a real account. A behavioural denial test, if wanted, may run only on **isolated synthetic Development fixtures**, only after the catalog check there shows the expected revoked state, and only under its own separate authorization. **No such test is authorized now.**
  4. Only later, under a further separate authorization, enable any two-phase runtime step.

## 5. Owner decisions D1–D6 (none approved)

| ID | Decision | Strict recommended default | Alternatives | Consequences | Approvals needed |
|---|---|---|---|---|---|
| **D1** | Who may run Phase A and retire Auth, and for which accounts | **A-strict proposal:** for **every** account, including those with no local Research footprint, both Phase A and Auth retirement run only in the owner's supervised single-account session. **Not implemented**: the Draft runs both automatically when the worker is enabled. | (a) **A-alt:** Phase A stays automatic, Auth retirement owner-gated (also not implemented). (b) Option B automation. (c) A cohort exemption backed by provider proof that Live Research was never purchasable for that cohort. | A-strict: slowest, safest; queue time counts against D2. (a) leaves irreversible database finalization automatic, including for accounts with no local footprint. (b) adds a credential and a review. (c) needs authoritative cohort proof. All options require code changes and independent review before use. | Owner; independent reviewer (technical); privacy owner (deadline impact) |
| **D2** | Maximum hold, escalation and customer communication | Escalate to the privacy owner at the first hold, review every business day, escalate to counsel at 7 days before the privacy deadline. Never exceed a deadline silently; inform the customer before it. Confirm the applicable law with counsel. (Context to verify with counsel, not legal advice: the GDPR generally allows one month to respond, extendable by two further months with notice, and allows retention required by other law, such as transaction records.) | Fixed shorter internal SLA; case-by-case. | Defines how long financial uncertainty can block deletion. Sets the copy in `interim-deletion-customer-copy.md`. | Owner; privacy/legal |
| **D3** | Evidence freshness | **Proposed:** provider read ≤ 15 minutes before Auth retirement, plus a re-read after retirement (audit/remediation only, not a completion gate; see Option A step 5). **Not enforced:** the Draft SQL accepts a clearance up to **24 hours** old (`auth_retirement_hold_reasons`, migration line 1990). Enforcing 15 minutes requires a SQL change, new tests and independent review; until then it could only be an owner procedure, which the database does not check. | Keep 24 h; 1 h. | Shorter is safer but needs the owner present. 24 h leaves a full renewal or retry cycle unobserved. | Owner; independent reviewer |
| **D4** | Charge after a deletion request, or after Auth retirement | Full refund of any charge after the request date, provider cancellation to `expired`, customer contact through the retained private recipient address, and an incident record. No automatic refunds. | Refund only post-request periods; credit; case-by-case. | Financial cost versus consumer trust and dispute risk. The required merchant actions are outside this code. | Owner; finance/accounting; legal |
| **D5** | Who records clearances, and receipt custody | One named owner. Receipts (provider responses, timestamps, IDs) in restricted owner storage. Only opaque references in the database. Never `service_role`, CI or web roles (already enforced, line 1421). | Dual control (second approver); delegated operator with an audit log. | One person is a single point of failure and error; dual control is slower. | Owner; independent reviewer (custody) |
| **D6** | Monitoring | Run the review queue daily. Alert the same day on `auth_retired_financial_evidence`, `auth_outcome_unknown_financial_evidence`, any open `deletion_billing_incidents` row (especially with `financial_fence_passed_at` set), and overdue privacy cases. Run the secretless flag verification weekly. | Weekly; alerting tool integration later. | Without monitoring, held rows silently breach D2. **What exists vs. what does not (owner-reported, not verified by the author):** the existing watch is the ChatGPT automation *USD Impact Deletion Safety Watch* (`Automation_2d152fc729c8819194bf3dfa2e9ba6c7`), enabled and scheduled daily from 2026-11-07 08:00 Europe/Tirane. It checks the Production legacy route and aggregate privacy counts. It is **not** a GitHub Actions workflow, and its first execution has **not** been verified. The separate `.github/workflows/production-security-posture.yml` checks public-site security posture and is not a deletion watch. Neither reads held deletion rows, hold classes or billing incidents; those Draft tables are not installed in Production. **Held-row and financial-incident alerting does not exist** and must be built and reviewed before any hosted rehearsal. | Owner; independent reviewer |

## 6. Blockers that no option removes

- Cross-service atomicity is impossible, so the residual window must be accepted in writing for the chosen option.
- Provider behaviour (retry horizon, resumability, checkout expiry, API consistency) is documentation-based and **UNVERIFIED** for this store.
- Hosted parity, Auth semantics and legacy retirement remain unverified (§3, §4).
- Independent acceptance is open.
