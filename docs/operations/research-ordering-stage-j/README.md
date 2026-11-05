# USD Impact Research O1/O4 Stage J — invoice identity, price and lifecycle policy

**DRAFT / REVIEW ONLY / NO-GO. Do not import, merge, deploy or install.**

Stacked on Stage I Draft [#1143](https://github.com/usdimpact/usd-impact-site/pull/1143) at `062ee9981c1b811bb1fae5c03b09a5ea2bc53157`.
This Stage J layer is *in addition* to Stages F–I, not an alternative to the
existing webhook or a Production ordering patch. New code is inside
`docs/operations/research-ordering-stage-j` plus a dedicated isolated workflow;
there are no application imports or deployable `supabase/migrations`.

## New synthetic negative tests

| Independent D2-18 finding | Stage J offline review behavior |
| --- | --- |
| NG1: signed success and recovered webhook names for one invoice create distinct event keys | Canonical receipt identity is `(provider, store_id, test_mode, invoice_id)`; a different subscription claim for the same invoice is a conflict, not a second first receipt. Companion events have separately retained signed-delivery hashes but are one pending invoice; two PostgreSQL backends race to one original. No second entitlement effect. |
| NG2: older paid invoice can appear consistent with current subscription `renews_at` | Require an explicitly synthetic, invoice-specific cycle-link witness; mismatches hold. A synthetic match is **not provider-authoritative** and never permits access. |
| NG3: Stage G accepts a paid 1-cent invoice regardless of issued offer | Compare exact invoice total/currency to a synthetic locally issued quote/approved adjustment; mismatch holds. No arbitrary price floor, since legitimate discounts/tax can change totals. |
| NG4: `initial` vs `renewal` `billing_reason` not bound to membership transition | Require synthetic transition kind, local subscription version, pending initial checkout intent or existing renewal terms; mismatches hold. `updated` remains non-granting. |

The Stage J JS evaluator **internally calls** Stage H with injected mock
invoice/subscription GETs and captures both invoice responses to compare the
fields Stage H omitted from its digest. A change in total or billing reason
between the two mock reads is held even if the provider `updated_at` strings
remain unchanged. All results set `canMutate=false`, `providerSettlementProven=false`,
`providerCycleStartProven=false`, `remoteAtomicityProven=false`. No real
network access or credentials; `globalThis.fetch` is forbidden in tests.

`invoice_journal_review.sql` is loaded **only into a disposable PG17.6
database** after the six real historical Research migrations and purchase-backed
Library Pass fixtures. The receipt's provider/store/environment/invoice key is unique independently of subscription ID, while the original subscription ID stays immutable; a cross-subscription reuse must quarantine. The private schema has a NOLOGIN/NOBYPASSRLS owner,
EXECUTE-only simulated holder, append-only audit with FK, statement-level
DELETE/TRUNCATE denial, immutable original evidence and monotonic quarantine.
The snapshot digest and quote are still synthetic caller-supplied evidence.
No lifecycle APPLY or entitlement-grant operation exists.

## Exact-head acceptance requirements

- [ ] Stage J offline NG1–NG4 positive/negative examples pass and always stay non-authorizing.
- [ ] Stage G/H/I offline provider tests stay green, no mock real-network fallback.
- [ ] Six historical migrations plus PG17 journal test pass with *two physical connections*.
- [ ] Same paid invoice success and recovered events produce first + duplicate, not two first receipts.
- [ ] Conflicting invoice digest quarantines permanently; old evidence never overwritten.
- [ ] Table DML/TRUNCATE/DELETE, audit history rewrites and orphan insert denied.
- [ ] Research and Library Pass fixture records remain byte-identical.
- [ ] Production migration-intake guard passes.
- [ ] Independent reviewer verifies exact child SHA and accepts/rejects specific findings.

## Non-goals and unresolved gates

Even a green Stage J is not an authoritative paid-cycle-start attestation,
settlement proof or remote commit transaction. Lemon Squeezy's documented
subscription invoice status/total/billing_reason and subscription
`renews_at`/`ends_at` do not independently establish paid-cycle start or
conditional provider-version updates. The post-final-GET refund race persists.
The SDK/runtime trust boundary, authorized quote source and real handler/
binder integration are **NOT** implemented.

Stage F first-activation F1, provider-paid-cycle R2, atomic remote freshness R1,
old 16-arg RPC, shared `service_role` writes, account deletion,
shared-commerce TRUNCATE/TRIGGER/Library Pass/Paddle compatibility, B-5
D2-B/C/D4/D6/D7 and Development parity remain OPEN. An isolated NOLOGIN
owner is not protection against a superuser or a table owner allowed to disable
triggers. These safeguards cannot be transplanted into the shared Production
schema without separate reviewed cutover.

Keep Research checkout already activated 2026-10-28 and existing Library Pass
access unchanged. **No Production/Development SQL, live provider API,
payment/refund, credential, customer entitlement, checkout switch, merge or
deployment action is authorized by this PR.**

Official provider references:
- https://docs.lemonsqueezy.com/help/webhooks/event-types
- https://docs.lemonsqueezy.com/api/subscription-invoices/the-subscription-invoice-object
- https://docs.lemonsqueezy.com/api/subscriptions/the-subscription-object
