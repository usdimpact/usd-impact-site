# Stage O — complete historic PG replay + external cancellation + R1/R2 strict hold

**STATUS: DRAFT, TEST-ONLY, NO LIVE AUTHORIZATION**

Parent [Stage N Draft #1150](https://github.com/usdimpact/usd-impact-site/pull/1150)
exact head `a57e78c94eb522e709939941e2ea757451e97626`.
This branch changes only this Stage O directory and its isolated read-only
GitHub Actions workflow. It adds no runtime imports, secrets or migrations.

## O-0: D2-24 N-X0 P1 — B5 binder blocked by Stage E guard

The independent D2-24 reviewer found a P1 design conflict:
Stage N's positive test ran the B5 binder **before** the Stage E→N
protection overlays. Installing the actual overlays first causes Stage E's
\`reject_unauthorized_research_write\` trigger to reject B5's legitimate
\`review_checkout_owner\` INSERT of a **pending** Research subscription.
The original checkout intent remains attached rather than consumed. This
is an integration defect in the disposable design; no live customer was
affected.

This Stage O-only SQL overlay overrides the isolated Stage E trigger
function with an allow-list for **exactly one action**: a
\`review_checkout_owner\` INSERT into \`public.subscriptions\` with
Research product + Lemon Squeezy provider + state \`pending\` + no paid
period or lifecycle event. It requires a separately recorded signed B5
observation and an attached, issued intent matching account, variant,
store, environment, checkout proof, paid timestamp and conflict
quarantine. Only verified identity material from those B5 tables
generates the *test-only* Stage L binding metadata. No caller can supply
arbitrary metadata or turn this into an \`active\` subscription.

The new \`test_guard_first_b5_bind.py\` reproduces **RED** after
E..N installation; confirms the original signed event survives and
intent stays attached; installs the narrow overlay and then exercises
**GREEN**: B5 binder creates a pending subscription with zero Research
entitlements, J/K invoice is held, Stage N synthetic lifecycle creates
one Research entitlement and one each subscription and entitlement
event. Additional negatives require direct owner INSERT active/forged
pending, UPDATE, Library Pass insertion, \`service_role\` direct UPDATE
and \`postgres\` direct UPDATE to fail. Purchase-backed Library Pass
remains byte-identical.

This does **not** resolve live L1 role/legacy RPC containment and does
not authorize real payment or access. The original Stage N and B5
branches are deliberately unchanged. The reviewer must independently
confirm the new exact head and all privilege/signed-evidence invariants.

## O-1: close the Stage N hosted regression coverage gap

Hosted CI re-runs **all six** historical Research migrations against a
separate disposable PostgreSQL **17.6** instance for EACH original Stage
I/J/K/L/M/N Python suite. Stage N hosted CI included only L/M/N; the
independent D2-24 handoff explicitly requested I/J/K regression.
G72, H31, J30 and M36 JS synthetic provider/quote tests run alongside the
Stage O R1/R2 non-authorizing screen. No deployed SQL or provider reads.

Each suite and the separate N-X0 guards-first test own an isolated cluster, so no helper role, temporary
schema or fixture row from another suite can make a failing test pass.

## O-2: P2-K1 driver cancellation is independently needed

Stage K's restricted LOGIN role declared session defaults
`statement_timeout=2s` and `lock_timeout=1s`.
The independent reviewer demonstrated its **own session** can disable them.
Stage O's new PostgreSQL test reproduces the same bypass with a separate
synthetic login. It then sends an explicit *external client* `CANCEL`
while a 8-second statement and a locked row are pending, requires
`SQLSTATE 57014` promptly, verifies the connection is recoverable and
the original row is intact. This proves only client cancellation in a
healthy local TCP connection. It does NOT establish a hard network-partition
deadline or a trusted Production pooler configuration. Owner-reviewed
network/driver watchdog, disconnection, recovery and monitoring tests are
still needed before real operations.

## O-3: R1/R2 uncertainty remains HOLD even if checks look perfect

Official Lemon Squeezy API reference (rechecked Nov 5):
- https://docs.lemonsqueezy.com/api/subscription-invoices/retrieve-subscription-invoice
  invoice exposes payment/refund status and timestamps, not an authoritative
  paid-cycle **start** or conditional remote-commit version token.
- https://docs.lemonsqueezy.com/api/subscriptions/the-subscription-object
  subscription exposes `renews_at` / `ends_at` and `updated_at`, not a
  settlement-bound start or compare-and-swap token.

A positive paid invoice and active subscription are necessary checks, not
a proof that no refund could happen **after** the final GET and **before**
the local entitlement COMMIT. Even two identical GET responses are
indistinguishable from a refund right after the second read. The pure
Stage O screen holds/quarantines all such cases and exposes only
`canMutate=false` and `releaseApproved=false`; it never calls
an entitlement, merchant account or connected database.

### Remaining owner/provider decisions — not assumed from generic "approve"

1. **R2 paid-cycle authority:** obtain an authenticated provider or
   merchant-issued source that explicitly binds invoice ID, start, end,
   subscription, variant, amount and environment; document handling for
   trials, prorations, delayed recovery, cancellation and refund.
   A copied `invoice.created_at` or inferred date from `renews_at`
   is NOT proof.
2. **R1 last-read race:** either a provider-supported atomic settlement/
   entitlement fence (not documented currently), or explicit **owner
   acceptance of bounded eventual consistency** with documented maximum
   exposure, post-commit reconciliation cadence, customer appeal/reversal,
   reconciliation retention and live stop switch. No exposure value or
   cadence is preselected by the author.
3. **J-3 recovered invoice conflicts:** preserve all conflicting updates in
   durable quarantine until a separate owner-approved adjudication rule,
   evidence provenance and audit checks are accepted. Do not automatically
   unquarantine a changed provider invoice.
4. **Security release gate:** independent Stage N/O exact-head acceptance,
   live `service_role` + legacy 16-arg RPC containment, B5/D2-C
   Library Pass/Paddle/dual-product deletion/TRUNCATE/TRIGGER/account
   removal, actual role/secret custody, network failure cancellation,
   Development parity, main-targeted integrated RC and owner Production GO.

## Non-effects and status

No live checkout, Lemon Squeezy API, real settlement, Supabase connection,
Production/Development SQL, merchant setting, credential, real customer
subscription/entitlement, Library Pass, merge, deployment or pricing action.
**LIVE O1/O4 P1 OPEN, B-5 NO-GO** after successful synthetic CI too.
