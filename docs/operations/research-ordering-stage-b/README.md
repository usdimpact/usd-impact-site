# Research Membership live O1/O4 — Stage B atomic-ordering prototype (Draft, HOLD)

**Scope:** [P1 issue #1103](https://github.com/usdimpact/usd-impact-site/issues/1103); stacked on the non-mutating Stage A [Draft #1105](https://github.com/usdimpact/usd-impact-site/pull/1105). This is an **isolated synthetic contract test**, not a migration or a fix to the active Research checkout.

## What is tested

The SQL creates only a new private `research_ordering_review` schema inside an ephemeral PostgreSQL 17.6 CI service. It models the necessary atomic invariants: `subscriptions ... FOR UPDATE`, monotonic subscription-object `occurred_at`, immutable audit of stale/conflicting/pending webhook deliveries, no state/entitlement mutation for those deliveries, full-fingerprint duplicate handling, finite/nondecreasing paid periods, terminal-state non-resurrection, and a Library Pass row unchanged. A two-connection test shows a late payment-failure waiting behind a renewal and being classified stale after the renewal commits. No provider or external connection occurs.

A boolean `verified_current_snapshot` is an **inert mock input**. It is **not trustworthy authorization** if supplied by a generic caller; neither a live Lemon Squeezy snapshot fetch, verified custody, nor provider-authoritative account/merchant binding is implemented here. Tests are not the actual `public.subscriptions`, `public.entitlements`, `public.subscription_events` migrations. These results cannot be treated as deployed or release-ready PostgreSQL acceptance.

## Non-negotiable release blockers

1. Replace mock `verified_current_snapshot` with an independently authenticated, fresh subscription-object reconciliation and store/variant/account binding. Invoice timestamps are not comparable with subscription-object timestamps; invoice failures, recovery and refunds need a current authoritative subscription snapshot or durable pending reconciliation.
2. Review the actual Production/Development schema drift and prepare a **separate** native Supabase migration file only after owner authorization. Under the real `subscriptions FOR UPDATE` lock, atomically save the trusted watermark, state, finite paid horizon, entitlement state and ignored delivery audit; duplicate verification must account for audit dispositions.
3. Make the **old 16-argument `apply_research_membership_transition` path fail closed** as part of an authorized coordinated cutover, without breaking in-flight paid webhooks. Direct `service_role` writes to Research entitlements/subscriptions and any first-binding bypass must be removed or restricted under D2-C; otherwise a new guard is bypassable.
4. Preserve existing Library Pass, complimentary/admin Research entitlements and account-deletion behavior. Do not reopen terminal refunds or chargebacks without provider-authoritative reconciliation.
5. Run O1/O4/equal-time/invoice/terminal/duplicate/2-session tests **against the actual six Research migrations and application handler** in an independently isolated PG17 service, then a single integrated release-candidate exact-head CI and independent reviewer PASS.
6. Separate owner approvals required for Development rehearsal, Production SQL, deployment, existing checkout switch, merchant settings and payments. No merge of this draft. Existing Research checkout stays active; the B-5 replacement remains NO-GO.

**Explicit safety contract:** No file in `supabase/migrations`, no import into live webhook code, no Vercel/merchant/API credentials, no provider calls, no connected database, no deployment or merge. The private synthetic schema exists only inside GitHub-hosted disposable CI PostgreSQL.
