# Research #1103 — A-strict conflict decision packet (DRAFT / OWNER CHOICE PENDING)

**Purpose:** exact-ref, read-only source reconciliation and a non-vacuous D3 stress gate after Claude's independent #1235 PASS DRAFT-ONLY. This note does **not** select D1–D6, approve financial incidents, deploy SQL, merge branches, or authorize an Auth DELETE.

## Source-of-truth snapshots (verified 2026-11-10)

| Lane | Exact commit | Status |
| --- | --- | --- |
| #1235 N1/N2/N3 / invoice custody | `eeedd10f398570f7fe7dc14810ace7b946d87804` | Independent reviewer **PASS DRAFT-ONLY** for N1/N2/N3, synthetic 53/56 PG17.6 jobs passed; unmerged |
| #1230 newer A-strict author lane | `e1aafe7a8d096d6c5ad9d4cd78247308c92c8e6d` | 19 commits ahead of the inherited `6aaa27e0` base, three shared files changed, synthetic PG17 225/225 author checks; **not** integrated with #1235 |
| #1232 original post-Auth recovery overlay | `14d1665a640d919ea83cf5374f25ac55b87cf50d` | Inherited by #1235, uninstalled and synthetically tested |
| #1231 original completion-email guard | `0d80b06bfcfa6acc8f373e96a7edb721ff9c960b` | Inherited by #1235, uninstalled and synthetically tested |
| Protected main | `eecdc4aff221006289c9d7996ce2cb191f6da98b` | No Research release authorized |

Re-read current branch heads before future work. #1230 was already updated after Claude inspected `a75d54e2`; do **not** treat any earlier reviewer pin as today's head. No current branch has a reviewed *unified* SQL + webhook + A-strict runtime cutover.

## Concrete source collision inventory

The A-strict overlay at #1230 `e1aafe7` has Git blob `f63ee0e51514fca13df9507aa9404ea063af3f57`; #1235 has blob `8d4c19b34a96a374139b8fb1bd99b2f07dd0feee`. They define 16 functions with matching names but divergent bodies. Two different completion-email triggers and multiple finance-reconciliation mechanisms would coexist if concatenated without explicit design.

- **Owner reconciliation and bypass:** #1235 inherits `a_strict_owner_reconcile_financial` and append-only `a_strict_financial_reconciliations` from the post-Auth-only #1232 recovery overlay. #1230 introduces a separate `a_strict_owner_reconcile`, `a_strict_owner_resolutions` (`resume` / `terminal_hold`) and `a_strict_require_incident_decision` trigger to prevent direct owner calls to the legacy `resolve_research_deletion_billing_incident` from bypassing the decision ledger. **Do not install two independent owner resolvers, or omit B1 while porting B3.**
- **Completion email:** #1235 has the #1231 `a_strict_completion_email_identity_guard` trigger. #1230 instead has `a_strict_completion_identity_immutable`, protects additional consent/created timestamps and terminal no-rearm states, and replaces table-wide `service_role` UPDATE with a listed delivery-status column grant. The effects on shared non-Research email writers have not been independently verified against the #1235 financial/UI tree. **Choose one final trigger and one role-grant contract; do not chain two unreviewed guards.**
- **Auth-intact pre-intent:** #1230 adds owner-only reviewed clearance/decision for a nonpayment incident while Auth is intact **and no Auth DELETE attempt** is recorded. #1235's #1232 recovery overlay does not permit equivalent reconciliation in this stage. A newly recorded intent or a known signed paid event must remain fail-closed. **This is a distinct owner D2/D4/D5 authorization decision, not merely a code merge.**
- **Source state:** #1230 still inherits the old P1 migration and webhook files and does **not** contain #1235's signed invoice/partial refund receipt custody, N1 chronology, N2 revokes, N3 one-account legacy claim and 15-minute migration predicates. Porting its overlay wholesale onto a new migration can lose these fixes.
- **Auth uncertainty:** Neither branch proves Supabase managed Auth request finality on a timeout; a subsequent `active` GET is insufficient for safe re-DELETE. No automatic repeat DELETE, reopening access or false privacy completion.

## Owner decision items (all currently PENDING)

| Decision | A: existing #1235 behavior | B: newer #1230 behavior | Conservative default to review, **not approval** |
| --- | --- | --- | --- |
| R1 — Post-Auth financial reconciliation | #1232 owner-only post-Auth append-only receipt + legal refs, then legacy resolver | #1230 case/incident-generation D2/D4 ledger, `resume`/`terminal_hold`, guarded legacy resolver, audited retired-under-incident | **HOLD; require B1 ledger-bypass defense** if either reconciliation is ever accepted. Select one owner state machine, not both. |
| R2 — Email identity/grants | #1231 trigger guards identity; ordinary shared `service_role` UPDATE grants unchanged in overlay | #1230 expanded immutable field set, terminal no-rearm and column-limited `service_role` delivery writes | Prefer evaluating the **stricter #1230 privilege boundary** against all email writers, but leave adoption pending a full cross-outbox QA pass. |
| R3 — Financial recovery with Auth intact, before any DELETE intent | No owner resume in #1232 post-Auth recovery module | #1230 permits conditional owner-only pre-intent nonpayment decision and new supervised claim | **HOLD by default** until D2/D4/D5 owner procedure, no outstanding signed charge/paid rights, fresh merchant scope, and independently verified pre-intent provenance. |

**Owner may accept or reject R1/R2/R3 independently.** A general "continue" or "approved" is not a D1–D6 or R1/R2/R3 decision. If any decision remains pending, avoid a destructive or deployable composite candidate. Preserve both branches and their exact evidence.

## Reviewer C2 — stale-clearance fixture stress, no policy decision

The isolated child of #1235 adds two assertions that its synthetic `UPDATE ... RETURNING` targeted **exactly one** cleanup row with equal non-null `financial_hold_first_at` and `financial_hold_at`, proper class and `auth_pending`. CI invokes the original 20-minute stale/14-minute fresh source test **10 times in each disposable PG17 job**, each with a new synthetic account. Exit status is fatal on any failed iteration.

This closes the missing-setup-assertion risk in Claude's reviewer test and explores nondeterminism; it does **not** prove production freshness, provider cessation or 10 completely independent database servers. The source still uses the proposed, unapproved D3 15-minute threshold. Label exact-head test results only after actual completion.

## Safe downstream integration contract — NOT a merge instruction

1. Freeze and **re-pin** #1230 and #1235 after the owner resolves R1/R2/R3. Keep the source and reviewer SHAs, tests and evidence unchanged on their original branches.
2. Create a *new* isolated, Draft-only integration branch from the verified #1235 invoice/F3 source. Manually integrate **only the approved** newer A-strict function/triggers, resolving semantic duplicates; never overwrite a reviewed function just because a newer branch touches it.
3. Preserve #1235 N1 chronology exclusions, N2 direct grants/revokes, N3 exact single-account limit, source invoice/partial/full-refund custody, D3 negative+positive controls, UI02/UI03 original source SHA checks, Library Pass and Research historical events.
4. Reconcile the owner ledger, retired-under-incident evidence and legacy resolver against a single atomic owner decision; test direct SQL-owner resolver bypass, service_role preclaim/forgery, duplicate signed event, conflicting signed invoice, invalid 2099 future timestamp and all independently supplied E3 fixtures.
5. Test the single outbox trigger and column grants against **all** email writers, retry/delivery/terminal states and callback/outbox idempotency; preserve 0 premature completion emails.
6. Replay both immutable disposable PG17 jobs and Claude's `xrev_chronology.py` / `xrev_negatives.py` after obtaining their exact script bytes. Independent reviewer must verify one frozen head; original author CI is not signoff.
7. **No Production GO** until D1–D6 individual decisions, Lemon Squeezy merchant cessation/settlement facts, Supabase Auth request-finality semantics, legal privacy response/remedy, hosted F3 applied-byte parity, synthetic JWT/session tests, legacy Auth-first worker drain and verified D6 monitoring. Support inquiries are pending; do not fabricate answers.

**Status:** #1103 OPEN, Research checkout/new sales PAUSED, real-account deletion and publication NO-GO; no merge/deploy/hosted SQL/Auth/merchant/customer action authorized.
