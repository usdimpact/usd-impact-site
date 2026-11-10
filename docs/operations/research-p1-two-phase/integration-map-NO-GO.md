# Research #1103 — exact-ref integration map (NOT authorization)

**Status: DRAFT PLAN / NO-GO**. This document does not merge, move, rebase, dispatch, deploy, run hosted SQL, call Supabase Auth or merchants, touch customers or approve D1–D6. All real-account deletion stays held.

## Verified source lanes (2026-11-10)

| Lane | Pinned SHA | Ownership and non-deployed scope |
| --- | --- | --- |
| Protected main | `eecdc4aff221006289c9d7996ce2cb191f6da98b` | Production source checkpoint; unrelated branch, do not alter |
| Parent P1 #1164 | `18a3c73bb514f1e380f741353707026835fa9af0` | Parent Draft; original uninstalled P1 lifecycle migration, legacy Auth-first code remains |
| UI02/UI03 #1189 | `35aa2701c51561fe24ee684e113b9308d6dcd43b` | Separate F3 synthetic integrated branch from older #1164 ancestry; original source byte equivalence with hosted Development is UNVERIFIED |
| D3 #1229 | `5ba5af790d8c520fbf05c47ec871bafad32ade30` | 15-minute proposed P1 SQL and negative test; no owner D3 approval |
| A-strict #1230 | **verify newest SHA when reviewing** | Sole code-author Draft branch; unscheduled 423 route containment + isolated uninstalled A-strict SQL/Node tests; not a migration/runtime |

## Change collision and boundary inventory

- #1164, #1189 and #1229 all touch `supabase/migrations/20261105190000_research_p1_billing_safe_lifecycle.sql`. #1189 is based on an older #1164 commit and includes UI-specific reconciliation, while #1229 changes the same 24-hour→15-minute predicate. **Do not choose by filenames, commit count, name, or line-level auto-merge**.
- #1189 and #1230 both touch `.github/workflows/research-p1-integrated-review.yml`. The future exact-head workflow must include BOTH the pinned UI02/UI03 two-job PG17 replay and A-strict adversarial tests. Don't silently drop either job, assertions or path filters.
- #1230's `supabase/tests/research-p1/a-strict-overlay-review.sql` is **test-only**, applied in a disposable runner AFTER the existing source migration and baseline suite. It revokes legacy direct functions, but the original migration itself remains unchanged and is **not hardened for deployment**.
- #1230's `apps/web/src/lib/account-deletion-a-strict-review.js` is **synthetic-only and not routed**; its injection seams are not an executable supervised live procedure. The old Auth-first scheduled endpoint exists independently and must be quiesced before any future cutover. No team should connect a new route based on preview flags.
- A-strict adds private append-only merchant-scope receipts and owner-only Phase A, Auth intent and Auth observation; service_role may only use the narrower bounded claim/fence/completion wrappers when given an owner-issued case. An owner cap is not a merchant signature.

## Required gated integration order (future, separate authorization)

1. **Freeze exact refs, evidence and owners.** Obtain nonauthor review of #1230 at its then-current SHA; obtain the F3 original-byte/read-only catalogue proof and the externally verified inventory/merchant documentation. Keep signed receipts/PII out of GitHub.
2. **Owner policy decision before a deployable SQL file:** D1 single-account operator, D2 maximum privacy hold and notice, D3 exact 15-minute policy or rejection, D4 late-charge/refund/remediation, D5 credential/owner custody, D6 held-row monitoring. Separate genuine legal/privacy review. If any remains undecided, Draft can be tested but real rollout stays blocked.
3. **Prepare a NEW isolated reconciliation Draft only if explicitly assigned.** Derive a single expected source tree from current supported code. Port the needed, independently reviewed patches from pinned #1189 (including all UI02/UI03/notification-outbox behavior), proposed #1229 D3 and #1230 A-strict, resolving semantic conflicts manually. Do **not** move, rebase, merge or edit #1164/#1189/#1229/#1230 to achieve this; no automatic extraction of D3 from a proposal.
4. **Review the unified SQL object graph.** Install solely in disposable PG17 from all expected source migrations and independently pinned UI02/UI03 bytes; verify default-PUBLIC EXECUTE, service_role/anon/authenticated grants, bypass-RLS role attributes, email outbox trigger order, source-entitlement historical events, paid-period holds, Library Pass receipts, account deletion privacy request detachment, timeout and lease owner. Test direct legacy function/route denial (not just Draft two-phase route).
5. **Prove hard negatives independently:** cancelled-in-grace, past_due, unpaid, customer portal resume, previously issued checkout/settlement, provider-only order, incomplete merchant pagination/mismatched store+customer+mode; 16-minute evidence and expiry between fence/DELETE; two workers + signed payment; ambiguous Auth GET/DELETE; crash after Auth; lost signed events; outbox early release; expired-case owner rotation; post-hold privacy deadline and remediation.
6. **No Auth or merchant actions until separate synthetic hosted approval.** Development Auth Admin DELETE/GET, token refresh and lingering JWT behavior need explicit owner authorization and synthetic fixtures; no real customers. Prior to any later migration, independently verify live Development and Production F3 schema provenance and effective grants.
7. **Future Production sequence needs separate exact-item GO:** pause and drain legacy Auth-first cron, identify all service-role callers, verify zero in-flight old worker, apply one reviewed full candidate migration (not extracted revokes), confirm catalog-only privilege results, enable supervised one-account procedure only after external per-account cessation, monitor/hold privacy notifications, complete post-Auth merchant re-read, release outbox in a single SQL transaction. Never use the old Auth-first worker as rollback. Stop on any ambiguous result.

## Explicit unresolved risk and recovery

No SQL fence, digest or 15-minute window can prevent a merchant charge arriving after the last verified read and before the independent Auth operation, nor guarantee future provider settlement cannot occur. All owner receipts remain **attestations** until independent provider/merchant proof is established. If any step is unknown, stop that account, preserve ledger/email request and signed payment custody, block access restoration and notification dispatch, and escalate financial/privacy response. Open incidents **cannot be automatically released**; D2/D4/D5 owner decisions and audited case-bound reconciliation are still absent.

**End state of this document:** planning and synthetic containment only. Issue #1103 OPEN; Research real-account deletion NO-GO; no Production changes authorized.
