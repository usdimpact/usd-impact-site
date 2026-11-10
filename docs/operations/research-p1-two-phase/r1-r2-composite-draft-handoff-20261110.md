# Research #1103 — R1/R2 composite Draft-only implementation handoff

**Scope/authority:** The owner approved **R1 composite security design and R2 composite security design for isolated Draft work only** on 2026-11-10; **R3 Auth-intact pre-intent resume stays on HOLD**. No D1–D6 item-specific operational policy, real-account deletion, merchant settlement, privacy decision, checkout, installation, merge or Production change is authorized by this approval.

**Branch:** \`agent/research-p1-r1-r2-composite-review-20261110\`, based on frozen #1236 \`bcb12f32a6f1484b7d7c8ae4ac0ba53abfb1c28f\`. This is a **new, unmerged child Draft**. Do not modify or rebase #1230 or #1235; #1230 has been moving independently and contains additional E3, soft-delete and incident-hardening work. Re-pin its HEAD before future reconciliation.

## R1 — one post-Auth owner financial-resolution path, full-generation custody

Review-only SQL: \`supabase/tests/research-p1/a-strict-r1-r2-composite-review.sql\`. Applied *after* #1236's ordinary A-strict and owner recovery overlays in disposable PostgreSQL only.

- The source incident record advances \`(last_observed_at, observation_count)\` on every reopen. A new, append-only \`a_strict_incident_observation_journal\` records each observed generation, with *review-only current-row seeding* for test fixtures. **This is not safe historical backfill of hosted customer events; full-source migration/backfill and proof remain unsolved.**
- \`a_strict_owner_generation_decisions\` binds one decision per account, case, full timestamp+count, owner, legal/remedy reference and disposition \`resume\` or \`terminal_hold\`. All foreign keys are restrictive; no public/service-role writes or EXECUTE on owner-only entrypoints.
- The revised post-Auth-only \`a_strict_owner_reconcile_financial\` continues enforcing fresh scoped post-Auth merchant receipt, reviewed retired-Auth digest, paid-rights hold and profile-first locks. It writes BOTH the generation decision and existing #1232 financial reconciliation ledger **before** invoking the old base resolver in one SQL transaction, rolling everything back on failure. It does not restore identity, access, subscriptions or entitlements, send completion mail or repeat Auth DELETE.
- The **global** \`BEFORE UPDATE/DELETE\` incident guard refuses owner direct resolution without account+case+timestamp+count+clearance+decision plus reconciliation ledger, including **case-less accounts**. It also rejects DELETE, TRUNCATE, observation-count/timestamp rewind, removal of financial reason codes and overwriting terminal resolution evidence. A second late signed event reopens custody under a fresh generation, never reuses the old decision.
- Owner-only \`a_strict_owner_terminal_financial_hold\` logs a non-destructive legal/remedy disposition for an open case but cannot resolve the incident or reopen Auth. No Auth-intact pre-intent resume is added (R3 HOLD). Residual risk: the SQL **database owner/superuser** can administratively modify triggers; the source is not a separate immutable external authorization service. Owner-attribution and credential custody require D5 acceptance and extra controls.

## R2 — one terminal-safe completion-email trigger

- The existing #1231 trigger function is **replaced in place**, not layered with a competing #1230 trigger. It preserves immutable \`id\`, event/idempotency, case, recipient, template, provider, payload, consent/checked timestamps, and \`created_at\`. The original Part 10 staged→queued financial release trigger remains untouched.
- \`service_role\` no longer has table-wide outbox UPDATE in this synthetic overlay; delivery PATCH permission is limited to exactly **nine** fields: \`status\`, \`attempt_count\`, \`next_attempt_at\`, \`provider_message_ref\`, \`error_code\`, \`accepted_at\`, \`delivered_at\`, \`failed_at\`, \`updated_at\`. Other notification writers and \`ignore-duplicates\` upserts still need independent negative verification before a release migration.
- Completion \`delivered → queued/sending\` is refused, as is any \`complained → queued\`. The actual \`resend-webhook.js\` planner explicitly accepts \`email.complained\` after \`delivered\`; the SQL trigger permits **only** \`delivered → complained\` among later terminal changes. It intentionally does **not** accept \`delivered → hard_bounced/suppressed\`, because the current Resend planner rejects those transitions. Do not expand them without explicit provider-contract review.
- \`test_r1_r2_composite_review.py\` verifies SQL-owner and service-role negative writes on real synthetic completion rows. \`test-account-deletion-resend-r2-review.mjs\` verifies an offline HMAC-signed synthetic Resend complaint with the actual verifier and planner, including nine-column PATCH compatibility and terminal replay negatives. This is NOT a live webhook end-to-end delivery or Production suppression proof.

## Test inventory and exact-HEAD verification

The workflow \`.github/workflows/research-p1-integrated-review.yml\` loads the new overlay only inside both disposable PostgreSQL jobs. It replays all inherited #1236 tests, including source Research + pinned UI02/UI03 F3, 10× D3 stale/fresh scenarios, A-strict, outbox, recovery, signed invoice replay and cross-layer synthetic paid invoice after Auth intent. It then runs the new R1/R2 matrix and offline signed Resend planner.

**Record final exact HEAD SHA, GitHub Actions run IDs, individual results and migration-intake conclusion only after both jobs complete.** Prior results from intermediate commits are provisional and do not certify later changes. Author-written tests are not independent Claude acceptance.

## Required independent Claude negatives at the frozen final SHA

1. Reproduce the **direct legacy resolver** on a supervised **and case-less** incident: no ledger and no successful resolution. Attempt direct SQL-owner UPDATE, DELETE and TRUNCATE. Advance generation twice; attempt to rewind timestamp or count, remove a reason, reuse the first owner decision and to resolve with a mismatched clearance. Check observation journal agrees with every signed event.
2. Two-connection collision: owner reconcile under profile-first lock versus signed payment from provider. Under either ordering, no stale generation may clear the new event, restore an entitlement or send a completion email. Re-run original E3 conflicting invoice, retry and future-timestamp negatives.
3. Check that owner terminal_hold is append-only/nonreleasing, cannot be forged by \`service_role\`, and blocks same-generation resume. R3 must remain disabled; no prior Auth DELETE can be repeated.
4. On outbox, prove immutable \`id\`, \`created_at\`, recipient and consent under both SQL-owner and \`service_role\`. Test legitimate \`queued → delivered → complained\` using the *actual* Resend webhook+SQL PATCH, with no missing complaint/suppression signal; \`delivered → queued\` and \`complained → queued\` must fail. Verify delivery nine-column grant against **every** other writer/POST upsert and the Part 10 staged barrier.
5. Cross-check current #1230 head carefully: its newer incident protections, soft-deleted \`auth.users.deleted_at\` semantics and invoice E3 custody are **not silently included** in this composite. Any divergence requires a new, separately reviewed integration package, not direct cherry-pick.

## Unresolved hard release gates

**Research NO-GO** until a single deployable schema and runtime tree is independently reviewed at one SHA; any missing source invoice/migration bytes are reconciled; historical incident provenance is proved; Supabase Auth soft-delete/request finality, JWT/session invalidation and worker drain verified; independent merchant cancellation/checkout/PayPal/retry/settlement proof and legal/privacy deadlines/remedies supplied; F3 Development/Production immutable migration provenance confirmed; D1–D6 each accepted by owner and D6 monitoring established.

No real-account Auth deletion, customer-data handling, hosted SQL/migration, merchant requests, refund, checkout activation, credentials, merge, deployment or Production setting changes were performed by this Draft.
