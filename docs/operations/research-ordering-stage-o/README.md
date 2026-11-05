# Stage O — complete historic PG replay + external cancellation + R1/R2 strict hold

**STATUS: DRAFT, TEST-ONLY, NO LIVE AUTHORIZATION**

Parent [Stage N Draft #1150](https://github.com/usdimpact/usd-impact-site/pull/1150)
exact head `a57e78c94eb522e709939941e2ea757451e97626`.
This branch changes only this Stage O directory and its isolated read-only
GitHub Actions workflow. It adds no runtime imports, secrets or migrations.

## O-1: close the Stage N hosted regression coverage gap

Hosted CI re-runs **all six** historical Research migrations against a
separate disposable PostgreSQL **17.6** instance for EACH original Stage
I/J/K/L/M/N Python suite. Stage N hosted CI included only L/M/N; the
independent D2-24 handoff explicitly requested I/J/K regression.
G72, H31, J30 and M36 JS synthetic provider/quote tests run alongside the
Stage O R1/R2 non-authorizing screen. No deployed SQL or provider reads.

Each suite owns its own isolated cluster, so no helper role, temporary
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
