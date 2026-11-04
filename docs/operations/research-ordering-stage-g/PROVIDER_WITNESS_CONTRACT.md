# Stage G provider evidence / replay / cutover acceptance contract (design only)

Status: **DRAFT HOLD, NO-GO**, no live implementation.

## Proposed chain of custody

1. **Ingress:** capture exact raw request bytes, bounded size; validate HMAC-SHA256 in constant time using the correct environment's dedicated webhook secret. Compare event-header and JSON event-name. Store a *redacted* digest and a durable pending receipt under a separately trusted service. No event metadata grants account ownership by itself.
2. **Internal binding:** load a uniquely issued, still-valid checkout intent or uniquely accepted Research subscription from the internal database. Bind account UUID, provider subscription, order, customer, store, product, variant, environment, and the approved Research variant. Reject missing, duplicate or ambiguous binding. Do not derive account UUID from `meta.custom_data` or an API caller argument.
3. **Provider reads:** from a dedicated backend credential, GET the specific invoice and subscription JSON:API resources over authenticated HTTPS. Fail closed on timeout, non-200, redirect, content mismatch, scope mismatch, refund, unpaid/zero settlement, wrong currency, unsupported payment reason, missing time or unsupported subscription state. A service with compromised API key or injected fetch could still forge this boundary; lock down runtime/network/secret custody separately.
4. **Period semantics:** recheck the precise invoice and subscription pairing, settled amount/currency, no refund/chargeback, paid-cycle start and end, existing entitlement floor and grace/dunning policy. Lemon Squeezy's standard subscription GET exposes `renews_at` or `ends_at` but not a documented signed current-period-start/conditional-version token. **No paid extension is authorized until that gap has a separately accepted binding policy.**
5. **Effect-attestation:** if all provider and local requirements pass, issue a tightly scoped witness from a dedicated verifier that includes event key/hash, provider invoice/subscription IDs and versions, account/store/variant/order, environment, **exact state + paid start/end + entitlement effect**, local subscription/entitlement versions, expiration/nonce and evidence provenance. A caller-supplied `verified=true` is never sufficient. The Stage F test uses a synthetic table, not this real provenance.
6. **Commit protection:** lock the matching local subscription, entitlement and durable event receipt, compare versions, verify witness freshness and single use, advance a monotonic watermark and persist the audit/effect in the same transaction. Concurrent duplicates must be idempotent; equal-time differing payloads and stale versions quarantine. **Local locks do not fence concurrent remote provider changes**; require explicit risk acceptance plus a compensating provider reconciliation/stop policy, or a demonstrable provider-side conditional-version capability before release.
7. **Coordinated cutover:** first prove existing Library Pass purchase/refund, Paddle, QA, dual-product deletion and TRUNCATE semantics under the proposed Research-scoped guards. Only then redirect the existing Research webhook/binder to dedicated callers, retire the legacy RPC and shared-role direct Research writes atomically, and retain a rollback plan that cannot reactivate the bypass. No blanket grants change.
8. **Operational follow-up:** independently reconcile paid/unbound events, late refunds, customer cancels, failures and stale provider responses. Alert on unresolved events and require owner review before claiming billing/release readiness.

## Event policy under current documentation

| Signed event | Object | Offline decision | Reason |
|---|---|---|---|
| `subscription_payment_success` / `subscription_payment_recovered` | subscription invoice | Candidate only after provider invoice and subscription GETs | Signed notification alone is not settlement; current invoice can be refunded |
| `subscription_updated`, `subscription_cancelled`, `subscription_expired` | subscription | Quarantine for lifecycle reconciliation | The signed event may be stale, and cancellation may retain a paid grace period |
| `subscription_payment_failed` | subscription invoice | Quarantine, never truncate paid access | Dunning and existing paid term require independent policy |
| `subscription_payment_refunded` | subscription invoice | Quarantine, never independently revoke Library Pass | Partial/full refunds and retained paid terms require explicit policy |
| Unrecognized/malformed/mismatched | any | Reject/pending | No authorized transition |

## Unresolved approvals and owner questions

- Which provider-side evidence proves **paid-period start**, first-purchase/renewal settlement and the exact invoice-to-current-cycle mapping? A plain `updated_at` equality comparison is insufficient.
- What is the approved response to a provider change occurring between the final GET and SQL commit: periodic reconciliation cadence, short-lived quarantine, reversible pending states, and maximum exposure? Do not claim zero race window without a provider-conditional API.
- Who holds the Lemon Squeezy API key and webhook signing secret in separate least-privilege runtimes, and how will TLS/redirect/egress and secret rotation be verified?
- How will the current Research subscriber/binder migrate to Stage F without a no-access window, and how will rollback avoid reinstating the old `service_role` bypass?
- How will unrelated Library Pass, customer deletion, Paddle, refunds and QA fixtures be preserved, including TRUNCATE/SECURITY DEFINER paths?

All require independent reviewer and explicit owner approval before any connected database, merchant, payment, credential, migration, PR merge or Production deployment action.
