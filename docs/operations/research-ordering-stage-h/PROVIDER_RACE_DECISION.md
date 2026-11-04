# Research O1/O4 Stage H — provider freshness and paid-cycle decision record

**Owner status: REVIEW / HOLD, NO-GO. No Production or Development action authorized.**

## Exactly what Stage G + H establish

- The signed raw Lemon Squeezy webhook is authenticated with HMAC, but the webhook event does **not** prove an invoice remains paid, unreversed or unrefunded at the instant of entitlement commitment.
- Separate credentialed API GETs of a subscription invoice and subscription can show consistent **current responses at observation time**. In this review both GETs are mocked. Even real HTTPS/credentialed reads do not themselves bind two objects into an atomic point-in-time snapshot.
- Repeating GETs identifies changes during the observation window (refund, changed version, altered paid end) and quarantines inconsistent observations. It does **not** detect a provider update immediately after the final read; a small configured TTL bounds elapsed time but is not a lock.
- Lemon Squeezy's invoice attributes include `created_at`, `updated_at`, `status`, `billing_reason`, `total`, and refund fields. The subscription attributes include `renews_at`, `ends_at`, status and update date. Neither documented object alone establishes the current paid-cycle **start** or a provider-side `If-Match`/CAS operation. See:
  - https://docs.lemonsqueezy.com/api/subscription-invoices/the-subscription-invoice-object
  - https://docs.lemonsqueezy.com/api/subscriptions/the-subscription-object
  - https://docs.lemonsqueezy.com/help/webhooks/event-types

## Fail-closed decision table

| Evidence or event | Stage H isolated disposition | Future live permission |
|---|---|---|
| Paid invoice + matching subscription, two stable snapshots, no start authority | `pending_reconciliation` | None |
| Paid invoice + matching subscription + **synthetic** cycle-start reviewer witness | Candidate for **human review** only | None |
| Refund/past-due/newer provider version between GETs | `pending_reconciliation` | None |
| Conflicting hash for same signed delivery key | `quarantined_conflict` in private journal | None |
| Duplicate matching fingerprint | Audit `duplicate_held` with same original evidence | None |
| Same key delivered concurrently | One original pending row, append-only attempts | None |
| Provider changes immediately after the final GET | **Undetectable by repeated GET**; never claim atomicity | None |
| Local DB subscription/entitlement version changes | Stage F local version fence blocks stale write | Not provider freshness |
| Invoice is `partial_refund` or `refunded` | Quarantine for refund/entitlement policy | None |
| `subscription_payment_failed`/`subscription_cancelled` delayed | O1/O4 ordering quarantine; honor paid horizon until independently reconciled | None |

## Owner-level release choices not made

1. Identify an authoritative **invoice-to-billing-cycle start/end source** with explicit Lemon Squeezy/merchant evidence, tied to the current subscription and internally issued checkout intent. Do not substitute `created_at` or `updated_at` as paid-period start by assumption.
2. Choose a documented post-commit provider reconciliation schedule, maximum exposure, refundable/cancellable entitlement policy, and fail-closed handling of unresolved/paid-unbound events. Otherwise the remote GET-to-commit race remains an uncapped release blocker.
3. Prove real provider API response authentication, egress allowlist, TLS verify-full, credentials scoped to independent verifier, and runtime separation from bearer-bearing gateway; distinguish signed webhook from API read and settlement.
4. Coordinate the actual live webhook/binder routing, Stage F effect-bound witness, local journal/row locks, old 16-arg RPC and shared `service_role` restrictions **atomically**, while preserving Library Pass, refunds, QA, account deletion, TRUNCATE and other `SECURITY DEFINER` pathways. Never install a deny trigger without rerouting the current Research handler first.
5. Run real application JS + historic-migration PostgreSQL two-session tests at one immutable RC HEAD, independent P1 security review, Development parity approval, then separately authorize any connected action. Rollback must not reactivate the old bypass.

**No live customer, payment, DB, role, webhook, merchant, deployment or DNS action in Stage H.**
