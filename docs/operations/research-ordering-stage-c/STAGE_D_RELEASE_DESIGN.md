# Research live O1/O4 — Stage D protected lifecycle cutover design (NO-GO, Draft only)

Prepared 2026-11-05 against original Research migration sources, accepted Stage B review-only evidence (#1134), and Stage C exact-head test evidence (#1135). No connected SQL, key, Vercel, merchant, provider, payment or user mutation was performed.

## Evidence that changes the priority

- Historical `public.apply_research_membership_transition` has `FOR UPDATE`, duplicate-event lookup and expected-from-state CAS, **but does not compare a trusted subscription-object event watermark**. It can accept a distinct-key stale `subscription.payment_failed` when the state is still `active`.
- The historical `service_role` is granted SELECT/UPDATE on `public.subscriptions` and SELECT/INSERT/UPDATE on `public.entitlements`. In Supabase, `service_role` bypasses RLS. A new security-invoker function or a private append-only journal **cannot** prevent direct privileged UPDATEs while these grants remain active.
- Stage C's PG17.6 real-six-migration review deliberately cloned `service_role` with BYPASSRLS. The legacy 16-argument RPC applied an out-of-order payment failure, shortened the paid period, and suspended Research entitlement on a synthetic subscription; direct entitlement UPDATE also succeeded. All effects were explicitly rolled back. This is proof of a currently possible *source-level* bypass, **not** evidence that any Production event occurred.
- A private atomic ordering prototype passed two-session O1/O4/equal-time and concurrent duplicate tests against the real historical table types, with a **mock provider proof**. Its successful results do not close the above bypass or validate a real checkout payment.

## Required end-to-end boundary, in strict order

1. **Signed ingress:** Keep exact raw webhook-body signature validation and provider/event binding; reject mismatched store/product/variant/test mode and signed account-reference mismatches. Generate a SHA-256 raw-body digest. Never use a client-supplied `provider_verified=true` or normalized `occurred_at` as authority.
2. **Durable receipt:** Write an immutable, uniquely keyed raw-delivery digest and `pending_reconciliation` disposition before successful transport acknowledgment. A processing retry must read and verify the entire stored binding/fingerprint and must not treat a prior ignored receipt as a previously applied entitlement. Crash/retry and conflicting fingerprints require independent tests.
3. **Provider query by trusted backend:** Fetch `GET /v1/subscriptions/:id` with a backend-only Lemon Squeezy API key and exact provider subscription ID obtained from verified persisted binding. Validate returned store/customer/product/variant/test mode and current `updated_at` with microsecond precision. Protect against 404/401/429/5xx, redirects, malformed or oversized JSON. Do not compare invoice.updated_at with subscription.updated_at. An invoice refund requires additional provider invoice/settlement scope verification; do not infer full refund from a callback timestamp alone.
4. **Prevent GET/commit time-of-check drift:** A fresh GET is a snapshot, not a database-transaction lock on the provider. Use a separately authenticated, versioned, exact-subscription-object witness created only by the trusted caller and tied to immutable signed delivery/account binding. Its validity and freshness policy must be reviewed; advance applied watermark only with the **same transaction** that updates subscription and entitlement. If a newer provider version is observed or a trustworthy witness cannot be established, durably hold and reconcile instead of mutating. The Stage C Boolean is not an implementation.
5. **Atomic protected commit:** Under one `public.subscriptions ... FOR UPDATE` lock, verify the trusted account/customer/store/product/variant/test mode/plan binding, full duplicate evidence, comparable subscription-object watermark, permitted state transition, finite/nondecreasing paid-period horizon and correct entitlement commercial source. Hold older/equal/different-key events and invoice clocks with immutable disposition, not `RAISE EXCEPTION` after audit insert. Applied updates and `public.subscription_events`/`public.entitlement_events` journaling must commit atomically. Preserve one-time purchase-backed Library Pass and complimentary Research records.
6. **Privileged bypass closure:** Before routing any live caller to the new function, prove and enforce that the historical 16-arg RPC **cannot** execute for the live caller and that its credential cannot directly UPDATE/INSERT Research subscription/entitlement rows. The existing `service_role` caller cannot be considered restricted merely by issuing separate Supabase secret API keys. Require separate trusted PostgreSQL identity/permission custody, explicit `EXECUTE` matrix, runtime transport proof, and negative tests for old-RPC + direct DML. Do not revoke existing Production service_role table grants without a separately authorized, complete dependency inventory and coordinated release plan.
7. **Subscriber and recovery cases:** Initial subscription binding must start `pending` with a trusted signed subscription-object watermark or remain in durable quarantine. Payment settlement, paid-but-unbound, plan changes, cancel/resume, historic versus current full/partial invoice refund, dispute/chargeback, dunning and terminal recovery each need provider-authoritative evidence and negative tests. Existing October 28 live checkout and Library Pass must not be silently paused.
8. **Deployment and rollback:** Review a multi-step deployment with synchronized credential/function/router guard changes and explicit backout. Any rollback must preserve fail-closed denial of legacy privileged access; never rollback to the open old RPC. Approvals are item-specific and must not be inferred from Draft testing.

## Test and release gates (all required)

| Gate | Present evidence | Still missing |
|---|---|---|
| O1/O4 algorithm | Stage B synthetic PG17 and Stage C real historical schema PG17 (2 sessions) PASS | Provider-authenticated account/payment proof and actual webhook integration |
| Provider snapshot | Stage C 29/29 offline GET validator cases PASS | Live/reviewed backend caller, trusted key custody, GET-to-commit witness and settlement |
| Schema / RLS | Six original Research migrations replayed on PG17; RLS tested | Production/Development parity reconciliation and independent live object diff |
| Legacy bypass | **Confirmed reproducible in disposable PG17** | Complete dependency review, permission revocation/role isolation, irreversible fail-closed legacy cutover |
| Historical member protection | Real purchase-backed Library Pass row preserved in offline concurrency test | Actual Development rehearsal and customer-safe existing entitlement classification |
| Integrated acceptance | Stage C self-contained Draft CI and migration guard PASS | Actual app/webhook ↔ isolated PG with trusted witness, exact main-targeted CI SHA, independent QA |
| Financial lifecycle | No real provider action taken | D4 paid settlement, D6 paid-unbound/replay/refund recovery, D7 approved B-5 replacement activation |

## Decisions held for specific owner approval

- Architecture owner: choose whether a dedicated SQL/connection role is allowed for the lifecycle gateway (separate from B-5 writer/verifier/binder authority); do not equate Vercel environment variables with PostgreSQL roles.
- Security owner: approve the full catalogue of legacy `service_role` Research access dependents, safe deny/rollback mechanism, and how to maintain existing webhooks through the cutover.
- Provider owner: authorize read-only real provider test-mode snapshot access and separately approve paid-invoice/settlement verification; never use a live customer or charge as a development fixture.
- Migration owner: approve only a future Development-only rehearsal after resolving Research migration/index/policy parity; Production is a later distinct decision.
- Release owner: require one exact SHA carrying app logic, SQL, test oracle, role/transport proof, all standard checks and independent reviewer PASS before separately authorizing Production.

## Explicit NO-GO

This is a documentation and disposable-test result only. None of these recommendations instruct or authorize creating, updating, deleting or pausing a Production/Development subscription, entitlement, merchant object, credential, webhook, checkout switch, RLS policy, database migration, Vercel deployment, or protected-branch merge. Live P1 issue #1103 remains open, and B-5 PRs #1124/#1128 remain unmerged.
